import crypto from 'crypto';
import { getShopeeTokens, saveShopeeTokens } from './_kv.js';

/**
 * Vercel Serverless Function: api/get-orders.js
 * 
 * Flow:
 * 1. Reads access_token, refresh_token, and expire_at directly from Vercel KV.
 * 2. Checks token expiration. If expired or near expiration, automatically calls
 *    Shopee refresh token endpoint (/api/v2/auth/access_token/get) and updates Vercel KV.
 * 3. Fetches recent orders via /api/v2/order/get_order_list.
 * 4. Fetches order details & recipient address via /api/v2/order/get_order_detail.
 * 5. Returns formatted orders to frontend.
 */

const SHOPEE_HOST = 'https://partner.shopeemobile.com';

function generateSign(partnerKey, baseString) {
  return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

/**
 * Refresh access_token using refresh_token and save new tokens to Vercel KV
 */
async function refreshShopeeToken(partnerId, partnerKey, shopId, refreshToken) {
  const timestamp = Math.floor(Date.now() / 1000);
  const path = '/api/v2/auth/access_token/get';
  const baseStr = `${partnerId}${path}${timestamp}`;
  const sign = generateSign(partnerKey, baseStr);

  const url = `${SHOPEE_HOST}${path}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&sign=${sign}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: refreshToken,
      partner_id: Number(partnerId),
      shop_id: Number(shopId)
    })
  });

  const data = await resp.json();
  if (data.error && data.error !== '') {
    throw new Error(`Shopee token refresh failed: ${data.message || data.error}`);
  }

  // Save new refreshed tokens to Vercel KV
  const updatedTokens = await saveShopeeTokens(shopId, {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expire_in: data.expire_in || 86400
  });

  return updatedTokens;
}

/**
 * SNIPPET / HELPER: Fetch escrow detail (Commission & Transaction Fees) for an order
 * Endpoint: /api/v2/payment/get_escrow_detail
 */
export async function getOrderEscrowDetail(orderSn, accessToken, shopId, partnerId, partnerKey) {
  const timestamp = Math.floor(Date.now() / 1000);
  const path = '/api/v2/payment/get_escrow_detail';
  const baseStr = `${partnerId}${path}${timestamp}${accessToken}${Number(shopId)}`;
  const sign = generateSign(partnerKey, baseStr);

  const url = `${SHOPEE_HOST}${path}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&sign=${sign}&access_token=${accessToken}&shop_id=${Number(shopId)}&order_sn=${orderSn}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    const income = data.response?.order_income || data.response;
    if (income) {
      const origPrice = Number(income.original_price ?? income.cost_of_goods_sold ?? income.buyer_total_amount ?? 0);
      const voucherDiscount = Number(income.voucher_from_seller ?? income.seller_voucher_discount ?? income.voucher_discount ?? income.seller_discount ?? 0);
      const commFee = Number(income.commission_fee ?? 0);
      const transFee = Number(income.seller_transaction_fee ?? income.transaction_fee ?? 0);
      const adsFee = Number(income.ads_escrow_top_up_fee_or_technical_support_fee ?? income.ads_escrow_fee ?? income.ads_top_up_fee ?? income.ads_fee ?? 0);
      const svcFee = Number(income.service_fee ?? 0);

      let netEscrow = income.escrow_amount != null ? Number(income.escrow_amount) : null;
      if (netEscrow == null || netEscrow === 0) {
        netEscrow = origPrice - commFee - transFee - adsFee - svcFee - voucherDiscount;
      } else if (adsFee > 0 && Math.abs(netEscrow - (origPrice - commFee - transFee - voucherDiscount)) < 0.05) {
        netEscrow = netEscrow - adsFee - svcFee;
      }

      return {
        order_sn: orderSn,
        original_price: origPrice > 0 ? origPrice.toFixed(2) : null,
        cost_of_goods_sold: origPrice > 0 ? origPrice.toFixed(2) : null,
        seller_voucher_discount: voucherDiscount.toFixed(2),
        voucher_code: income.voucher_code || income.shop_voucher_code || null,
        commission_fee: commFee.toFixed(2),
        seller_transaction_fee: transFee.toFixed(2),
        ads_escrow_top_up_fee_or_technical_support_fee: adsFee.toFixed(2),
        service_fee: svcFee.toFixed(2),
        escrow_amount: Math.max(0, netEscrow).toFixed(2)
      };
    }
  } catch (err) {
    console.warn(`Escrow detail fetch notice for order ${orderSn}:`, err.message);
  }
  return null;
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const queryOrBody = req.method === 'POST' ? req.body : req.query;
    const params = typeof queryOrBody === 'string' ? JSON.parse(queryOrBody) : queryOrBody || {};

    const reqShopId = params.shop_id || '1562261313';
    const partnerId = process.env.SHOPEE_PARTNER_ID || '2039798';
    const partnerKey = process.env.SHOPEE_PARTNER_KEY || 'shpk78614841454a6d4e424d63716c4a7a62754b764544786c6e624e55545076';

    // 1. Read token data directly from Vercel KV (no longer requiring frontend to send tokens)
    let tokenData = await getShopeeTokens(reqShopId);

    if (!tokenData || (!tokenData.access_token && !tokenData.refresh_token)) {
      return res.status(401).json({
        success: false,
        error: 'no_tokens_in_kv',
        message: 'No Shopee access tokens found in Vercel KV. Please authorize your store account once via the dashboard.'
      });
    }

    const numericShopId = Number(tokenData.shop_id || reqShopId);
    const numericPartnerId = Number(partnerId);
    const currentTimestamp = Math.floor(Date.now() / 1000);

    // 2. Check token expiration timestamp in KV. If expired, automatically refresh.
    let accessToken = tokenData.access_token;
    let refreshToken = tokenData.refresh_token;

    const isExpired = tokenData.expire_at ? currentTimestamp >= (tokenData.expire_at - 120) : false;

    if (isExpired && refreshToken) {
      console.log('Vercel KV access_token is expired. Auto-refreshing via Shopee API...');
      try {
        const refreshed = await refreshShopeeToken(partnerId, partnerKey, numericShopId, refreshToken);
        accessToken = refreshed.access_token;
        refreshToken = refreshed.refresh_token;
      } catch (refreshErr) {
        return res.status(401).json({
          success: false,
          error: 'token_refresh_failed',
          message: 'Vercel KV access token expired and auto-refresh failed. Please re-authorize store.',
          details: refreshErr.message
        });
      }
    }

    // Helper to call Shopee Order List with 15-day time window iteration & cursor pagination
    // (Shopee API v2 restricts time_to - time_from <= 15 days)
    const fetchOrderList = async (token) => {
      let accumulatedOrders = [];
      const nowTs = Math.floor(Date.now() / 1000);
      const FIFTEEN_DAYS = 15 * 24 * 60 * 60; // 1,296,000 seconds
      const numWindows = 6; // 6 x 15 days = 90 days of order history
      let lastTimestamp = nowTs;
      let lastError = null;

      for (let w = 0; w < numWindows; w++) {
        const timeTo = nowTs - (w * FIFTEEN_DAYS);
        const timeFrom = timeTo - FIFTEEN_DAYS;

        let cursor = '';
        let hasMore = true;
        let pageCount = 0;
        const maxPagesPerWindow = 10; // Up to 1,000 orders per 15-day window

        while (hasMore && pageCount < maxPagesPerWindow) {
          pageCount++;
          const timestamp = Math.floor(Date.now() / 1000);
          lastTimestamp = timestamp;
          const orderListPath = '/api/v2/order/get_order_list';
          const orderListBaseStr = `${partnerId}${orderListPath}${timestamp}${token}${numericShopId}`;
          const orderListSign = generateSign(partnerKey, orderListBaseStr);

          let url = `${SHOPEE_HOST}${orderListPath}?partner_id=${numericPartnerId}&timestamp=${timestamp}&sign=${orderListSign}&access_token=${token}&shop_id=${numericShopId}&time_range_field=create_time&time_from=${timeFrom}&time_to=${timeTo}&page_size=100`;
          if (cursor) {
            url += `&cursor=${encodeURIComponent(cursor)}`;
          }

          const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });

          const data = await response.json();
          if (data.error && data.error !== '') {
            lastError = data;
            if (w === 0 && pageCount === 1) {
              return { data, timestamp };
            }
            break; // Skip rest of window if error occurred
          }

          const pageOrders = data.response?.order_list || [];
          accumulatedOrders = [...accumulatedOrders, ...pageOrders];

          hasMore = Boolean(data.response?.more);
          cursor = data.response?.next_cursor || '';

          if (!hasMore || !cursor || pageOrders.length === 0) {
            break;
          }
        }
      }

      // Deduplicate accumulated orders by order_sn
      const uniqueMap = new Map();
      accumulatedOrders.forEach((o) => {
        if (o && o.order_sn) {
          uniqueMap.set(o.order_sn, o);
        }
      });
      const uniqueOrders = Array.from(uniqueMap.values());

      return {
        data: {
          error: lastError ? lastError.error : '',
          message: lastError ? lastError.message : '',
          response: { order_list: uniqueOrders }
        },
        timestamp: lastTimestamp
      };
    };

    let { data: orderListData, timestamp } = await fetchOrderList(accessToken);

    // If Shopee returns token error unexpectedly, perform token refresh and retry
    const isTokenError = orderListData.error === 'error_auth' ||
                         orderListData.error === 'error_param' ||
                         (orderListData.message && orderListData.message.toLowerCase().includes('token'));

    if (isTokenError && refreshToken) {
      console.log('Shopee API reported token error. Refreshing token and updating Vercel KV...');
      try {
        const refreshed = await refreshShopeeToken(partnerId, partnerKey, numericShopId, refreshToken);
        accessToken = refreshed.access_token;
        
        const retryRes = await fetchOrderList(accessToken);
        orderListData = retryRes.data;
        timestamp = retryRes.timestamp;
      } catch (retryErr) {
        return res.status(401).json({
          success: false,
          error: 'token_retry_failed',
          message: 'Unable to refresh token stored in Vercel KV. Please re-authorize store.'
        });
      }
    }

    if (orderListData.error && orderListData.error !== '' && (!orderListData.response?.order_list || orderListData.response.order_list.length === 0)) {
      return res.status(400).json({
        success: false,
        error: orderListData.error,
        message: orderListData.message || 'Failed to fetch order list from Shopee.',
        shopee_request_id: orderListData.request_id
      });
    }

    const orderList = orderListData.response?.order_list || [];

    if (orderList.length === 0) {
      return res.status(200).json({
        success: true,
        shop_id: numericShopId,
        source: 'Vercel KV',
        orders_count: 0,
        orders: []
      });
    }

    // 3. Fetch Order Details & Recipient Address in chunks of 50 (Shopee API limit per request)
    const allOrderSns = orderList.map(o => o.order_sn);
    const chunkSize = 50;
    const chunkPromises = [];

    for (let i = 0; i < allOrderSns.length; i += chunkSize) {
      const chunkSns = allOrderSns.slice(i, i + chunkSize).join(',');
      const orderDetailPath = '/api/v2/order/get_order_detail';
      const orderDetailBaseStr = `${partnerId}${orderDetailPath}${timestamp}${accessToken}${numericShopId}`;
      const orderDetailSign = generateSign(partnerKey, orderDetailBaseStr);

      const fields = 'buyer_user_id,buyer_username,recipient_address,item_list,total_amount,order_status,create_time,pay_time,ship_time,update_time,currency,payment_method';
      const orderDetailUrl = `${SHOPEE_HOST}${orderDetailPath}?partner_id=${numericPartnerId}&timestamp=${timestamp}&sign=${orderDetailSign}&access_token=${accessToken}&shop_id=${numericShopId}&order_sn_list=${chunkSns}&response_optional_fields=${fields}`;

      chunkPromises.push(
        fetch(orderDetailUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
        .then(res => res.json())
        .then(d => d.response?.order_list || [])
        .catch(err => {
          console.warn('Chunk order detail fetch error:', err.message);
          return [];
        })
      );
    }

    const chunkResults = await Promise.all(chunkPromises);
    const rawOrderDetails = chunkResults.flat();

    // 4. Fetch Escrow Details (Commission & Transaction Fees) via /api/v2/payment/get_escrow_detail
    const escrowMap = {};
    try {
      const escrowPromises = rawOrderDetails.map(order => 
        getOrderEscrowDetail(order.order_sn, accessToken, numericShopId, partnerId, partnerKey)
      );
      const escrowResults = await Promise.all(escrowPromises);
      escrowResults.forEach(res => {
        if (res && res.order_sn) {
          escrowMap[res.order_sn] = res;
        }
      });
    } catch (escrowErr) {
      console.warn('Escrow detail fetch warning:', escrowErr.message);
    }

function formatShopeeEpochToMytString(epochSeconds) {
  if (!epochSeconds || epochSeconds <= 0) return null;
  try {
    const d = new Date(Number(epochSeconds) * 1000);
    if (isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(d);

    const map = {};
    parts.forEach(p => { map[p.type] = p.value; });
    return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
  } catch (err) {
    return null;
  }
}

    const formattedOrders = rawOrderDetails.map(order => {
      const sn = order.order_sn;
      const escrow = escrowMap[sn] || {};

      const payOrCreateTime = order.pay_time || order.create_time;

      return {
        order_sn: sn,
        order_status: order.order_status || 'READY_TO_SHIP',
        total_amount: order.total_amount ? Number(order.total_amount).toFixed(2) : '0.00',
        currency: order.currency || 'MYR',
        buyer_username: order.buyer_username || `Buyer_${order.buyer_user_id || 'Shopee'}`,
        item_count: order.item_list?.length || 1,
        recipient_address: order.recipient_address || null,
        items: order.item_list?.map(item => ({
          item_id: item.item_id,
          item_name: item.item_name,
          model_quantity: item.model_quantity_purchased,
          model_original_price: item.model_original_price
        })) || [],
        create_time: formatShopeeEpochToMytString(payOrCreateTime),
        pay_time: formatShopeeEpochToMytString(payOrCreateTime),
        ship_time: order.ship_time ? formatShopeeEpochToMytString(order.ship_time) : null,
        delivery_time: (order.order_status === 'COMPLETED' && order.update_time) ? formatShopeeEpochToMytString(order.update_time) : null,
        original_price: escrow.original_price ?? escrow.cost_of_goods_sold ?? null,
        cost_of_goods_sold: escrow.cost_of_goods_sold ?? escrow.original_price ?? null,
        seller_voucher_discount: escrow.seller_voucher_discount ?? '0.00',
        voucher_code: escrow.voucher_code ?? order.voucher_code ?? null,
        commission_fee: escrow.commission_fee ?? null,
        seller_transaction_fee: escrow.seller_transaction_fee ?? null,
        ads_escrow_top_up_fee_or_technical_support_fee: escrow.ads_escrow_top_up_fee_or_technical_support_fee ?? null,
        service_fee: escrow.service_fee ?? null,
        escrow_amount: escrow.escrow_amount ?? null
      };
    });

    return res.status(200).json({
      success: true,
      shop_id: numericShopId,
      source: 'Vercel KV',
      orders_count: formattedOrders.length,
      orders: formattedOrders
    });

  } catch (error) {
    console.error('Shopee Order Fetch Error:', error);
    return res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: error.message || 'An error occurred while fetching Shopee orders from Vercel KV token.'
    });
  }
}
