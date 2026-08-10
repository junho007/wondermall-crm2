import crypto from 'crypto';
import { saveLazadaTokens } from './_kv.js';

/**
 * Vercel Serverless Function: api/lazada-auth.js
 *
 * Callback / Token Exchange Handler for Lazada Open Platform OAuth.
 * Registered Callback URL: https://shopee-info-zeta.vercel.app/api/lazada-auth
 */

function generateLazadaSign(apiPath, params, appSecret) {
  // Sort parameters alphabetically by key
  const keys = Object.keys(params).sort();
  let baseStr = apiPath;
  for (const k of keys) {
    if (params[k] !== undefined && params[k] !== null) {
      baseStr += `${k}${params[k]}`;
    }
  }
  return crypto.createHmac('sha256', appSecret).update(baseStr, 'utf8').digest('hex').toUpperCase();
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
    const { code } = typeof body === 'string' ? JSON.parse(body) : body || {};

    // If accessed without 'code' parameter (e.g. direct browser GET visit)
    if (!code) {
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Lazada Auth Endpoint Status</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; padding: 40px; color: #0f172a; }
              .card { max-width: 500px; margin: 0 auto; background: white; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
              .badge { display: inline-block; background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 12px; text-transform: uppercase; margin-bottom: 16px; }
              h1 { font-size: 20px; font-weight: 800; margin: 0 0 8px 0; }
              p { color: #64748b; font-size: 14px; line-height: 1.5; margin: 0 0 20px 0; }
              code { background: #f1f5f9; padding: 4px 8px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #2563eb; }
            </style>
          </head>
          <body>
            <div class="card">
              <span class="badge">Endpoint Active</span>
              <h1>Lazada OAuth Callback Ready</h1>
              <p>This endpoint receives authorization callbacks from Lazada Open Platform.</p>
              <p>When authenticating from Lazada, Lazada redirects with <code>?code=YOUR_AUTHORIZATION_CODE</code> to automatically complete the token exchange and store tokens in Vercel KV.</p>
            </div>
          </body>
        </html>
      `);
    }

    const appKey = process.env.LAZADA_APP_KEY || '140689';
    const appSecret = process.env.LAZADA_APP_SECRET || 'nKfxi7sEWlsu9l3CZekKBZPTFRQpHMYP';

    const timestamp = Date.now();
    const apiPath = '/auth/token/create';

    const params = {
      app_key: String(appKey),
      code: String(code),
      sign_method: 'sha256',
      timestamp: String(timestamp)
    };

    const sign = generateLazadaSign(apiPath, params, appSecret);

    const tokenUrl = `https://auth.lazada.com/rest${apiPath}?app_key=${encodeURIComponent(appKey)}&code=${encodeURIComponent(code)}&sign_method=sha256&timestamp=${timestamp}&sign=${sign}`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
      }
    });

    const tokenData = await response.json();

    if (tokenData.code && tokenData.code !== '0') {
      return res.status(400).json({
        success: false,
        error: tokenData.code,
        message: tokenData.message || 'Failed to exchange Lazada authorization code for access token.',
        request_id: tokenData.request_id
      });
    }

    const sellerId = tokenData.account || tokenData.country_user_info?.[0]?.user_id || 'lazada_seller';

    // Store tokens directly in Vercel KV
    const savedKVData = await saveLazadaTokens(sellerId, tokenData);

    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lazada Authorization Successful</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f0fdf4; padding: 40px; color: #0f172a; text-align: center; }
            .card { max-width: 480px; margin: 40px auto; background: white; padding: 36px; border-radius: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05); border: 1px solid #bbf7d0; }
            .icon { width: 64px; height: 64px; background: #16a34a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; font-size: 32px; }
            h1 { font-size: 22px; font-weight: 800; color: #14532d; margin: 0 0 10px 0; }
            p { color: #475569; font-size: 14px; margin-0 0 24px 0; }
            .btn { display: inline-block; background: #16a34a; color: white; padding: 12px 28px; border-radius: 12px; font-weight: 700; text-decoration: none; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✓</div>
            <h1>Lazada Connected Successfully!</h1>
            <p>Your Lazada seller store account has been authorized and tokens are securely saved in Vercel KV.</p>
            <a href="/" class="btn">Return to Dashboard</a>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Lazada Auth Exchange Error:', error);
    return res.status(500).json({
      success: false,
      error: 'lazada_auth_error',
      message: error.message || 'Server error during Lazada token exchange.'
    });
  }
}
