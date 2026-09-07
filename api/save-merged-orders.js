import { kv } from '@vercel/kv';

// Global server memory fallback when KV is not initialized
if (!globalThis.__shopeeMergedOrders) {
  globalThis.__shopeeMergedOrders = null;
}
if (!globalThis.__shopeeCustomerRegistry) {
  globalThis.__shopeeCustomerRegistry = {};
}

function isMasked(str) {
  if (!str) return true;
  const s = String(str).trim();
  if (
    s === '' ||
    s === 'N/A' ||
    s === 'n/a' ||
    s === 'Hidden' ||
    s === 'Customer' ||
    s === 'Shopee Customer' ||
    s === 'Lazada Customer' ||
    s === 'Guest' ||
    s === 'Guest Customer' ||
    s === 'Digital Asset Top-Up Buyer' ||
    s.startsWith('Buyer_')
  ) {
    return true;
  }
  return s.includes('*');
}

function selectUnmasked(existingVal, newVal) {
  if (!newVal || newVal === 'N/A') return existingVal || '';
  if (!existingVal || existingVal === 'N/A') return newVal;
  if (isMasked(existingVal) && !isMasked(newVal)) return newVal;
  if (!isMasked(existingVal) && isMasked(newVal)) return existingVal;
  return newVal;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { orders, customerRegistry } = req.body || {};
      if (!Array.isArray(orders)) {
        return res.status(400).json({ error: 'Invalid orders array' });
      }

      // 1. Fetch existing orders from KV or memory to ensure unmasked customer details are preserved
      let existingOrders = globalThis.__shopeeMergedOrders || [];
      try {
        if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
          const fromKv = await kv.get('shopee_merged_orders');
          if (Array.isArray(fromKv) && fromKv.length > 0) {
            existingOrders = fromKv;
          }
        }
      } catch (e) {
        // use memory fallback
      }

      const existingMap = new Map();
      existingOrders.forEach((o) => {
        if (o && o.orderSn) existingMap.set(o.orderSn, o);
      });

      // 2. Merge incoming orders with existing orders, ensuring unmasked data is NEVER overwritten by ****
      const safeMergedOrders = orders.map((incoming) => {
        if (!incoming || !incoming.orderSn) return incoming;
        const exist = existingMap.get(incoming.orderSn);
        if (!exist) return incoming;

        return {
          ...exist,
          ...incoming,
          buyerName: selectUnmasked(exist.buyerName, incoming.buyerName),
          recipientName: selectUnmasked(exist.recipientName, incoming.recipientName),
          buyerPhone: selectUnmasked(exist.buyerPhone, incoming.buyerPhone),
          recipientPhone: selectUnmasked(exist.recipientPhone || exist.buyerPhone, incoming.recipientPhone || incoming.buyerPhone),
          shippingAddress: selectUnmasked(exist.shippingAddress, incoming.shippingAddress),
          buyerUsername: selectUnmasked(exist.buyerUsername, incoming.buyerUsername),
        };
      });

      globalThis.__shopeeMergedOrders = safeMergedOrders;

      // 3. Save or update customer registry
      if (customerRegistry && typeof customerRegistry === 'object') {
        const mergedRegistry = { ...(globalThis.__shopeeCustomerRegistry || {}), ...customerRegistry };
        globalThis.__shopeeCustomerRegistry = mergedRegistry;

        try {
          if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
            await kv.set('shopee_customer_registry', mergedRegistry);
          }
        } catch (regErr) {
          console.warn('Customer registry KV write warning:', regErr.message);
        }
      }

      try {
        if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
          await kv.set('shopee_merged_orders', safeMergedOrders);
        }
      } catch (kvErr) {
        console.warn('Vercel KV write warning (memory fallback used):', kvErr.message);
      }

      return res.status(200).json({ success: true, count: safeMergedOrders.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      let orders = null;
      let customerRegistry = null;

      try {
        if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
          orders = await kv.get('shopee_merged_orders');
          customerRegistry = await kv.get('shopee_customer_registry');
        }
      } catch (kvErr) {
        console.warn('Vercel KV read warning (memory fallback used):', kvErr.message);
      }

      if (!orders) {
        orders = globalThis.__shopeeMergedOrders || null;
      }
      if (!customerRegistry) {
        customerRegistry = globalThis.__shopeeCustomerRegistry || {};
      }

      return res.status(200).json({ orders: orders || [], customerRegistry: customerRegistry || {} });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
