import crypto from 'crypto';
import { getLazadaTokens, saveLazadaTokens } from './_kv.js';

/**
 * Vercel Serverless Function: api/lazada-get-orders.js
 *
 * Endpoint to test fetching orders from Lazada Open Platform for authorized whitelist seller.
 * Host: https://api.lazada.com.my/rest
 */

function generateLazadaSign(apiPath, params, appSecret) {
  const keys = Object.keys(params).sort();
  let baseStr = apiPath;
  for (const k of keys) {
    if (params[k] !== undefined && params[k] !== null) {
      baseStr += `${k}${params[k]}`;
    }
  }
  return crypto.createHmac('sha256', appSecret).update(baseStr, 'utf8').digest('hex').toUpperCase();
}

/**
 * Refresh Lazada access token using refresh_token if expired
 */
async function refreshLazadaToken(appKey, appSecret, refreshToken, sellerId) {
  const apiPath = '/auth/token/refresh';
  const timestamp = Date.now();
  const params = {
    app_key: String(appKey),
    refresh_token: String(refreshToken),
    sign_method: 'sha256',
    timestamp: String(timestamp)
  };

  const sign = generateLazadaSign(apiPath, params, appSecret);
  const refreshUrl = `https://auth.lazada.com/rest${apiPath}?app_key=${encodeURIComponent(appKey)}&refresh_token=${encodeURIComponent(refreshToken)}&sign_method=sha256&timestamp=${timestamp}&sign=${sign}`;

  const resp = await fetch(refreshUrl, { method: 'POST' });
  const data = await resp.json();

  if (data.code && data.code !== '0') {
    throw new Error(`Lazada token refresh failed: ${data.message || data.code}`);
  }

  const updatedTokens = await saveLazadaTokens(sellerId, data);
  return updatedTokens;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const appKey = process.env.LAZADA_APP_KEY || '140689';
    const appSecret = process.env.LAZADA_APP_SECRET || 'nKfxi7sEWlsu9l3CZekKBZPTFRQpHMYP';

    const { seller_id } = req.query;

    let tokenData = await getLazadaTokens(seller_id);

    if (!tokenData || !tokenData.access_token) {
      return res.status(400).json({
        success: false,
        error: 'no_lazada_token',
        message: 'No Lazada OAuth tokens found in Vercel KV. Please authorize your seller account first via /api/lazada-auth.',
        seller_id: seller_id || 'active'
      });
    }

    // Check if token needs refresh
    const nowSec = Math.floor(Date.now() / 1000);
    if (tokenData.expire_at && tokenData.expire_at <= nowSec + 300 && tokenData.refresh_token) {
      try {
        tokenData = await refreshLazadaToken(appKey, appSecret, tokenData.refresh_token, tokenData.seller_id);
      } catch (refErr) {
        console.warn('Token refresh warning:', refErr.message);
      }
    }

    const accessToken = tokenData.access_token;
    const apiPath = '/orders/get';
    const timestamp = Date.now();

    // Default to last 30 days orders
    const date30DaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const params = {
      app_key: String(appKey),
      access_token: String(accessToken),
      created_after: date30DaysAgo,
      sign_method: 'sha256',
      timestamp: String(timestamp)
    };

    const sign = generateLazadaSign(apiPath, params, appSecret);

    // Call Lazada Open API
    const lazadaApiUrl = `https://api.lazada.com.my/rest${apiPath}?app_key=${encodeURIComponent(appKey)}&access_token=${encodeURIComponent(accessToken)}&created_after=${encodeURIComponent(date30DaysAgo)}&sign_method=sha256&timestamp=${timestamp}&sign=${sign}`;

    const response = await fetch(lazadaApiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (data.code && data.code !== '0') {
      return res.status(200).json({
        success: false,
        api_status: 'error',
        lazada_code: data.code,
        message: data.message || 'Lazada API returned an error.',
        request_id: data.request_id,
        token_info: {
          seller_id: tokenData.seller_id,
          account: tokenData.account,
          country: tokenData.country,
          updated_at: tokenData.updated_at
        }
      });
    }

    const rawOrders = data.data?.orders || [];

    // Fetch items for orders if available
    if (rawOrders.length > 0) {
      try {
        const orderIds = rawOrders.map((o) => o.order_id || o.order_number).filter(Boolean);
        const itemsApiPath = '/orders/items/get';
        const itemsTs = Date.now();
        const orderIdsJson = JSON.stringify(orderIds);

        const itemsParams = {
          access_token: String(accessToken),
          app_key: String(appKey),
          order_ids: orderIdsJson,
          sign_method: 'sha256',
          timestamp: String(itemsTs)
        };

        const itemsSign = generateLazadaSign(itemsApiPath, itemsParams, appSecret);
        const itemsUrl = `https://api.lazada.com.my/rest${itemsApiPath}?app_key=${encodeURIComponent(appKey)}&access_token=${encodeURIComponent(accessToken)}&order_ids=${encodeURIComponent(orderIdsJson)}&sign_method=sha256&timestamp=${itemsTs}&sign=${itemsSign}`;

        const itemsResp = await fetch(itemsUrl, { method: 'GET' });
        const itemsData = await itemsResp.json();

        if (itemsData.data && Array.isArray(itemsData.data)) {
          const itemsByOrderId = new Map();
          itemsData.data.forEach((orderItemGroup) => {
            const oid = String(orderItemGroup.order_id);
            const items = orderItemGroup.order_items || [];
            itemsByOrderId.set(oid, items);
          });

          rawOrders.forEach((o) => {
            const oid = String(o.order_id || o.order_number);
            if (itemsByOrderId.has(oid)) {
              o.items = itemsByOrderId.get(oid);
            }
          });
        }
        // Fetch Finance details (exact payment fees, commission fees, etc.) if available
        try {
          const finApiPath = '/finance/transaction/detail/get';
          const finTs = Date.now();
          const startTime = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
          const endTime = new Date().toISOString().split('T')[0];

          const finParams = {
            access_token: String(accessToken),
            app_key: String(appKey),
            end_time: endTime,
            sign_method: 'sha256',
            start_time: startTime,
            timestamp: String(finTs)
          };

          const finSign = generateLazadaSign(finApiPath, finParams, appSecret);
          const finUrl = `https://api.lazada.com.my/rest${finApiPath}?app_key=${encodeURIComponent(appKey)}&access_token=${encodeURIComponent(accessToken)}&start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}&sign_method=sha256&timestamp=${finTs}&sign=${finSign}`;

          const finResp = await fetch(finUrl, { method: 'GET' });
          const finData = await finResp.json();

          if (finData.data && Array.isArray(finData.data)) {
            const finByOrderId = new Map();
            finData.data.forEach((item) => {
              const orderId = String(item.order_no || item.trade_order_id);
              if (!finByOrderId.has(orderId)) {
                finByOrderId.set(orderId, []);
              }
              finByOrderId.get(orderId).push(item);
            });

            rawOrders.forEach((o) => {
              const oid = String(o.order_id || o.order_number);
              if (finByOrderId.has(oid)) {
                o.finance_details = finByOrderId.get(oid);
              }
            });
          }
        } catch (finErr) {
          console.warn('Could not fetch Lazada Finance API details:', finErr.message);
        }
      } catch (itemErr) {
        console.warn('Could not fetch Lazada order items:', itemErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      api_status: 'success',
      seller_id: tokenData.seller_id,
      orders_count: rawOrders.length,
      orders: rawOrders,
      raw_response: data
    });

  } catch (error) {
    console.error('Lazada Get Orders API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: error.message || 'Error executing Lazada Get Orders API test.'
    });
  }
}
