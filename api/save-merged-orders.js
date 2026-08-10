import { kv } from '@vercel/kv';

// Global server memory fallback when KV is not initialized
const globalMemoryStore = globalThis.__shopeeMergedOrders || (globalThis.__shopeeMergedOrders = null);

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
      const { orders } = req.body || {};
      if (!Array.isArray(orders)) {
        return res.status(400).json({ error: 'Invalid orders array' });
      }

      globalThis.__shopeeMergedOrders = orders;

      try {
        if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
          await kv.set('shopee_merged_orders', orders);
        }
      } catch (kvErr) {
        console.warn('Vercel KV write warning (memory fallback used):', kvErr.message);
      }

      return res.status(200).json({ success: true, count: orders.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      let orders = null;
      try {
        if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
          orders = await kv.get('shopee_merged_orders');
        }
      } catch (kvErr) {
        console.warn('Vercel KV read warning (memory fallback used):', kvErr.message);
      }

      if (!orders) {
        orders = globalThis.__shopeeMergedOrders || null;
      }

      return res.status(200).json({ orders: orders || [] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
