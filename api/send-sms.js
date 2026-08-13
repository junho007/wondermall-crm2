import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Fetch SMS logs and Movider settings
  if (req.method === 'GET') {
    try {
      let logs = [];
      let settings = { apiKey: 'iPnNDUbKo2OyVvr5osnidwt8uL1-GW', apiSecret: 'Jl0WWdL6vGjbq5ZVT2qxLFJqUYadPE', senderId: 'WCGMall' };

      try {
        if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
          logs = (await kv.get('movider_sms_logs')) || [];
          const storedSettings = await kv.get('movider_sms_settings');
          if (storedSettings && storedSettings.apiKey) settings = storedSettings;
        }
      } catch (kvErr) {
        console.warn('KV read warning for SMS logs:', kvErr.message);
      }

      if (!logs || logs.length === 0) {
        logs = globalThis.__shopeeSmsLogs || [];
      }
      if (!settings.apiKey && globalThis.__shopeeSmsSettings) {
        settings = globalThis.__shopeeSmsSettings;
      }
      settings.senderId = 'WCGMall';

      return res.status(200).json({ logs, settings });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST: Send SMS or Save Settings
  if (req.method === 'POST') {
    try {
      const { action, apiKey, apiSecret, senderId, recipientPhone, messageText, recipientName } = req.body || {};

      // Save Movider API Settings
      if (action === 'save_settings') {
        const newSettings = { apiKey: apiKey || '', apiSecret: apiSecret || '', senderId: 'WCGMall' };
        globalThis.__shopeeSmsSettings = newSettings;

        try {
          if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
            await kv.set('movider_sms_settings', newSettings);
          }
        } catch (kvErr) {
          console.warn('KV write warning for SMS settings:', kvErr.message);
        }

        return res.status(200).json({ success: true, settings: newSettings });
      }

      // Send SMS or WhatsApp Action via Movider API or Local Log
      if (action === 'send_sms') {
        const { channel } = req.body || {};
        if (!recipientPhone || !messageText) {
          return res.status(400).json({ error: 'recipientPhone and messageText are required' });
        }

        const effectiveKey = apiKey || process.env.MOVIDER_API_KEY || (globalThis.__shopeeSmsSettings && globalThis.__shopeeSmsSettings.apiKey) || 'iPnNDUbKo2OyVvr5osnidwt8uL1-GW';
        const effectiveSecret = apiSecret || process.env.MOVIDER_API_SECRET || (globalThis.__shopeeSmsSettings && globalThis.__shopeeSmsSettings.apiSecret) || 'Jl0WWdL6vGjbq5ZVT2qxLFJqUYadPE';
        const effectiveSender = 'WCGMall';

        // Format phone number: remove leading plus or non-digits, e.g. +60109223278 -> 60109223278
        let cleanPhone = (recipientPhone || '').replace(/\s+/g, '');
        if (cleanPhone.startsWith('+')) {
          cleanPhone = cleanPhone.substring(1);
        }

        let moviderResponse = null;
        let isRealApiSuccess = false;
        let errorMessage = null;

        // If credentials exist, execute actual HTTP request to Movider REST API
        if (effectiveKey && effectiveSecret) {
          try {
            const params = new URLSearchParams();
            params.append('api_key', effectiveKey);
            params.append('api_secret', effectiveSecret);
            params.append('to', cleanPhone);
            params.append('from', effectiveSender);
            params.append('text', messageText);

            const apiRes = await fetch('https://api.movider.co/v1/sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: params.toString(),
            });

            moviderResponse = await apiRes.json();
            isRealApiSuccess = apiRes.ok && !moviderResponse.error && (Array.isArray(moviderResponse.phone_number_list) || moviderResponse.remaining_balance !== undefined || moviderResponse.total_sms !== undefined);

            if (moviderResponse && moviderResponse.error) {
              const errObj = moviderResponse.error;
              errorMessage = `[Movider ${errObj.code || apiRes.status}] ${errObj.name || ''}: ${errObj.description || 'API request rejected'}`;
            } else if (!apiRes.ok) {
              errorMessage = `[Movider HTTP ${apiRes.status}] Gateway request failed`;
            }
          } catch (movErr) {
            console.warn('Movider API connection error:', movErr.message);
            errorMessage = `Connection error: ${movErr.message}`;
          }
        }

        const newLog = {
          id: `sms-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          recipientName: recipientName || 'Shopee Buyer',
          recipientPhone,
          messageText,
          senderId: effectiveSender,
          sentTime: new Date().toISOString(),
          status: isRealApiSuccess ? 'DELIVERED' : moviderResponse ? 'FAILED' : 'SENT_SIMULATED',
          errorMessage: errorMessage,
          channel: channel || 'SMS',
          moviderResult: moviderResponse,
        };

        let currentLogs = globalThis.__shopeeSmsLogs || [];
        currentLogs = [newLog, ...currentLogs].slice(0, 100);
        globalThis.__shopeeSmsLogs = currentLogs;

        try {
          if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
            await kv.set('movider_sms_logs', currentLogs);
          }
        } catch (kvErr) {
          console.warn('KV write warning for SMS log:', kvErr.message);
        }

        return res.status(200).json({
          success: true,
          log: newLog,
          isRealApiSuccess,
          moviderResponse,
        });
      }

      // Sync or fetch past Movider report logs
      if (action === 'sync_history' || action === 'get_reports') {
        const effectiveKey = apiKey || process.env.MOVIDER_API_KEY || (globalThis.__shopeeSmsSettings && globalThis.__shopeeSmsSettings.apiKey) || 'iPnNDUbKo2OyVvr5osnidwt8uL1-GW';
        const effectiveSecret = apiSecret || process.env.MOVIDER_API_SECRET || (globalThis.__shopeeSmsSettings && globalThis.__shopeeSmsSettings.apiSecret) || 'Jl0WWdL6vGjbq5ZVT2qxLFJqUYadPE';

        let fetchedMoviderLogs = [];
        try {
          if (effectiveKey && effectiveSecret) {
            const params = new URLSearchParams();
            params.append('api_key', effectiveKey);
            params.append('api_secret', effectiveSecret);

            const repRes = await fetch(`https://api.movider.co/v1/reports/sms?${params.toString()}`);
            if (repRes.ok) {
              const repData = await repRes.json();
              const rawItems = repData.sms || repData.items || repData.reports || repData.data || [];
              if (Array.isArray(rawItems)) {
                fetchedMoviderLogs = rawItems.map((item, idx) => ({
                  id: item.id || item.message_id || `movider-${idx}-${Date.now()}`,
                  recipientName: item.recipientName || 'Shopee Buyer',
                  recipientPhone: item.to || item.phone_number || item.recipientPhone || '',
                  messageText: item.text || item.message || 'SMS Delivery',
                  senderId: item.from || 'WonderMall',
                  sentTime: item.created_at || item.sent_at || item.date || new Date().toISOString(),
                  status: (item.status === 'delivered' || item.status === 'DELIVERED') ? 'DELIVERED' : 'DELIVERED',
                  channel: 'SMS',
                }));
              }
            }
          }
        } catch (movErr) {
          console.warn('Movider reports API query notice:', movErr.message);
        }

        let existingLogs = globalThis.__shopeeSmsLogs || [];
        try {
          if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
            const kvLogs = (await kv.get('movider_sms_logs')) || [];
            if (kvLogs && kvLogs.length > 0) existingLogs = kvLogs;
          }
        } catch (e) {}

        const logMap = new Map();
        [...existingLogs, ...fetchedMoviderLogs].forEach((l) => {
          if (l && l.id) logMap.set(l.id, l);
        });

        const merged = Array.from(logMap.values());
        globalThis.__shopeeSmsLogs = merged;

        try {
          if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
            await kv.set('movider_sms_logs', merged);
          }
        } catch (kvErr) {}

        return res.status(200).json({ success: true, logs: merged });
      }

      return res.status(400).json({ error: 'Invalid action specified' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
