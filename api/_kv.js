import { kv } from '@vercel/kv';

// Memory store fallback for development environments before KV credentials are configured
const globalMemoryTokenStore = globalThis.__shopeeTokenStore || (globalThis.__shopeeTokenStore = {});

/**
 * Saves Shopee OAuth tokens directly to Vercel KV (and memory fallback)
 */
export async function saveShopeeTokens(shopId, tokens) {
  const expiresIn = tokens.expire_in || 86400; // default 24 hours
  const expireAt = Math.floor(Date.now() / 1000) + expiresIn;

  const tokenData = {
    shop_id: Number(shopId),
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expire_in: expiresIn,
    expire_at: expireAt,
    updated_at: new Date().toISOString()
  };

  // Store in Vercel KV
  try {
    if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
      await kv.set(`shopee_tokens_${shopId}`, tokenData);
      await kv.set('shopee_tokens_active', tokenData);
      await kv.set('shopee_latest_shop_id', String(shopId));
    }
  } catch (err) {
    console.warn('Vercel KV write warning (using server memory fallback):', err.message);
  }

  // Memory fallback
  globalMemoryTokenStore[String(shopId)] = tokenData;
  globalMemoryTokenStore['active'] = tokenData;

  return tokenData;
}

/**
 * Retrieves Shopee OAuth tokens directly from Vercel KV (or memory fallback)
 */
export async function getShopeeTokens(shopId) {
  let tokenData = null;

  // Try retrieving from Vercel KV
  try {
    if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
      if (shopId) {
        tokenData = await kv.get(`shopee_tokens_${shopId}`);
      }
      if (!tokenData) {
        tokenData = await kv.get('shopee_tokens_active');
      }
    }
  } catch (err) {
    console.warn('Vercel KV read warning (using server memory fallback):', err.message);
  }

  // Fallback to memory
  if (!tokenData) {
    if (shopId && globalMemoryTokenStore[String(shopId)]) {
      tokenData = globalMemoryTokenStore[String(shopId)];
    } else {
      tokenData = globalMemoryTokenStore['active'] || null;
    }
  }

  return tokenData;
}

/**
 * Saves Lazada OAuth tokens directly to Vercel KV (and memory fallback)
 */
export async function saveLazadaTokens(sellerId, tokens) {
  const expiresIn = tokens.expires_in || tokens.expire_in || (30 * 86400); // Lazada default ~30 days
  const expireAt = Math.floor(Date.now() / 1000) + expiresIn;

  const tokenData = {
    seller_id: String(sellerId || tokens.country_user_info?.[0]?.user_id || tokens.account || 'lazada_seller'),
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    country: tokens.country || 'my',
    account: tokens.account || '',
    account_platform: tokens.account_platform || 'seller_center',
    expires_in: expiresIn,
    expire_at: expireAt,
    updated_at: new Date().toISOString()
  };

  try {
    if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
      await kv.set(`lazada_tokens_${tokenData.seller_id}`, tokenData);
      await kv.set('lazada_tokens_active', tokenData);
    }
  } catch (err) {
    console.warn('Vercel KV write warning (using server memory fallback for Lazada):', err.message);
  }

  globalMemoryTokenStore[`lazada_${tokenData.seller_id}`] = tokenData;
  globalMemoryTokenStore['lazada_active'] = tokenData;

  return tokenData;
}

/**
 * Retrieves Lazada OAuth tokens directly from Vercel KV (or memory fallback)
 */
export async function getLazadaTokens(sellerId) {
  let tokenData = null;

  try {
    if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
      if (sellerId) {
        tokenData = await kv.get(`lazada_tokens_${sellerId}`);
      }
      if (!tokenData) {
        tokenData = await kv.get('lazada_tokens_active');
      }
    }
  } catch (err) {
    console.warn('Vercel KV read warning (using server memory fallback for Lazada):', err.message);
  }

  if (!tokenData) {
    if (sellerId && globalMemoryTokenStore[`lazada_${sellerId}`]) {
      tokenData = globalMemoryTokenStore[`lazada_${sellerId}`];
    } else {
      tokenData = globalMemoryTokenStore['lazada_active'] || null;
    }
  }

  return tokenData;
}

