import crypto from 'crypto';
import { saveShopeeTokens } from './_kv.js';

/**
 * Vercel Serverless Function: api/shopee-auth.js
 * 
 * Exchanges temporary Shopee OAuth 'code' for 24-hour 'access_token' and 'refresh_token',
 * and saves them directly into Vercel KV for global server-side access.
 */

const SHOPEE_HOST = 'https://partner.shopeemobile.com';

function generateSign(partnerKey, baseString) {
  return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = req.method === 'POST' ? req.body : req.query;
    const { code, shop_id } = typeof body === 'string' ? JSON.parse(body) : body || {};

    if (!code || !shop_id) {
      return res.status(400).json({
        success: false,
        error: 'missing_params',
        message: 'Both "code" and "shop_id" parameters are required.'
      });
    }

    const partnerId = process.env.SHOPEE_PARTNER_ID || '2039798';
    const partnerKey = process.env.SHOPEE_PARTNER_KEY || 'shpk78614841454a6d4e424d63716c4a7a62754b764544786c6e624e55545076';

    const timestamp = Math.floor(Date.now() / 1000);
    const numericShopId = Number(shop_id);
    const numericPartnerId = Number(partnerId);

    // Endpoint: /api/v2/auth/token/get
    const tokenPath = '/api/v2/auth/token/get';
    const tokenBaseStr = `${partnerId}${tokenPath}${timestamp}`;
    const tokenSign = generateSign(partnerKey, tokenBaseStr);

    const tokenUrl = `${SHOPEE_HOST}${tokenPath}?partner_id=${numericPartnerId}&timestamp=${timestamp}&sign=${tokenSign}`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: String(code),
        partner_id: numericPartnerId,
        shop_id: numericShopId
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error && tokenData.error !== '') {
      return res.status(400).json({
        success: false,
        error: tokenData.error,
        message: tokenData.message || 'Failed to exchange authorization code for access token.',
        shopee_request_id: tokenData.request_id
      });
    }

    // Save access_token, refresh_token, and expiry timestamp directly into Vercel KV
    const savedKVData = await saveShopeeTokens(numericShopId, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expire_in: tokenData.expire_in || 86400
    });

    return res.status(200).json({
      success: true,
      shop_id: numericShopId,
      access_token: savedKVData.access_token,
      expire_at: savedKVData.expire_at,
      stored_in_kv: true,
      message: 'Tokens successfully exchanged and stored globally in Vercel KV.',
      shopee_request_id: tokenData.request_id
    });

  } catch (error) {
    console.error('Shopee Auth Exchange Error:', error);
    return res.status(500).json({
      success: false,
      error: 'auth_server_error',
      message: error.message || 'Server error during Shopee token exchange.'
    });
  }
}
