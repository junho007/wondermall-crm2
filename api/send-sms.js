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

      const memoryLogs = globalThis.__shopeeSmsLogs || [];
      const combinedMap = new Map();

      // Merge KV logs and Memory logs
      [...memoryLogs, ...(Array.isArray(logs) ? logs : [])].forEach((l) => {
        if (l && l.id) {
          combinedMap.set(l.id, l);
        } else if (l && l.recipientPhone && l.sentTime) {
          combinedMap.set(`${l.recipientPhone}_${l.sentTime}`, l);
        }
      });

      let finalLogs = Array.from(combinedMap.values()).sort(
        (a, b) => new Date(b.sentTime || 0).getTime() - new Date(a.sentTime || 0).getTime()
      );

      finalLogs = finalLogs.map((l) => ({
        ...l,
        recipientPhone: (l.recipientPhone || '').replace(/^\+/, '').replace(/\s+/g, ''),
      }));

      // Update memory store
      globalThis.__shopeeSmsLogs = finalLogs;

      if (!settings.apiKey && globalThis.__shopeeSmsSettings) {
        settings = globalThis.__shopeeSmsSettings;
      }
      settings.senderId = 'WCGMall';

      return res.status(200).json({ logs: finalLogs, settings });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST: Send SMS, Log Outreach, Sync Logs or Save Settings
  if (req.method === 'POST') {
    try {
      const { action, apiKey, apiSecret, senderId, recipientPhone, messageText, recipientName, logs: incomingLogs, log: singleLog, channel } = req.body || {};

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

      // Sync Client-Side Logs (e.g. all 90 WhatsApp & SMS records from all CS staff browsers)
      if (action === 'sync_logs' || action === 'save_logs') {
        let existingLogs = globalThis.__shopeeSmsLogs || [];
        try {
          if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
            const kvLogs = (await kv.get('movider_sms_logs')) || [];
            if (Array.isArray(kvLogs) && kvLogs.length > 0) {
              existingLogs = [...existingLogs, ...kvLogs];
            }
          }
        } catch (e) {}

        const logMap = new Map();
        [...existingLogs, ...(Array.isArray(incomingLogs) ? incomingLogs : singleLog ? [singleLog] : [])].forEach((l) => {
          if (l && l.id) {
            logMap.set(l.id, l);
          } else if (l && l.recipientPhone && l.sentTime) {
            logMap.set(`${l.recipientPhone}_${l.sentTime}`, l);
          }
        });

        const mergedLogs = Array.from(logMap.values())
          .sort((a, b) => new Date(b.sentTime || 0).getTime() - new Date(a.sentTime || 0).getTime())
          .slice(0, 10000); // retain up to 10,000 logs so nothing is lost

        globalThis.__shopeeSmsLogs = mergedLogs;

        try {
          if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
            await kv.set('movider_sms_logs', mergedLogs);
          }
        } catch (kvErr) {
          console.warn('KV write warning during sync_logs:', kvErr.message);
        }

        return res.status(200).json({ success: true, logs: mergedLogs, totalCount: mergedLogs.length });
      }

      // Log Outreach (for WhatsApp, Direct Contact, or Manual dispatch recorded across all CS staff)
      if (action === 'log_outreach') {
        const outreachLog = singleLog || {
          id: `wa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          recipientName: recipientName || 'Customer',
          recipientPhone: (recipientPhone || '').replace(/^\+/, '').replace(/\s+/g, ''),
          messageText: messageText || 'Outreach dispatched',
          senderId: senderId || 'WHATSAPP_WEB',
          sentTime: new Date().toISOString(),
          status: req.body.status || 'WHATSAPP_LAUNCHED',
          channel: channel || 'WHATSAPP',
        };

        let currentLogs = globalThis.__shopeeSmsLogs || [];
        try {
          if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
            const kvLogs = (await kv.get('movider_sms_logs')) || [];
            if (Array.isArray(kvLogs)) currentLogs = [...currentLogs, ...kvLogs];
          }
        } catch (e) {}

        const logMap = new Map();
        [outreachLog, ...currentLogs].forEach((l) => {
          if (l && l.id) logMap.set(l.id, l);
        });

        const merged = Array.from(logMap.values())
          .sort((a, b) => new Date(b.sentTime || 0).getTime() - new Date(a.sentTime || 0).getTime())
          .slice(0, 10000);

        globalThis.__shopeeSmsLogs = merged;

        try {
          if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
            await kv.set('movider_sms_logs', merged);
          }
        } catch (kvErr) {
          console.warn('KV write warning for log_outreach:', kvErr.message);
        }

        return res.status(200).json({ success: true, log: outreachLog, logs: merged });
      }

      // Send SMS via Movider API
      if (action === 'send_sms') {
        if (!recipientPhone || !messageText) {
          return res.status(400).json({ error: 'recipientPhone and messageText are required' });
        }

        const effectiveKey = apiKey || process.env.MOVIDER_API_KEY || (globalThis.__shopeeSmsSettings && globalThis.__shopeeSmsSettings.apiKey) || 'iPnNDUbKo2OyVvr5osnidwt8uL1-GW';
        const effectiveSecret = apiSecret || process.env.MOVIDER_API_SECRET || (globalThis.__shopeeSmsSettings && globalThis.__shopeeSmsSettings.apiSecret) || 'Jl0WWdL6vGjbq5ZVT2qxLFJqUYadPE';
        const effectiveSender = 'WCGMall';

        // Format phone number: remove leading plus or non-digits, e.g. +60109223278 -> 60109223278
        let cleanPhone = (recipientPhone || '').replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '60' + cleanPhone.substring(1);
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
          recipientPhone: cleanPhone,
          messageText,
          senderId: effectiveSender,
          sentTime: new Date().toISOString(),
          status: isRealApiSuccess ? 'DELIVERED' : moviderResponse ? 'FAILED' : 'SENT_SIMULATED',
          errorMessage: errorMessage,
          channel: channel || 'SMS',
          moviderResult: moviderResponse,
        };

        let currentLogs = globalThis.__shopeeSmsLogs || [];
        try {
          if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
            const kvLogs = (await kv.get('movider_sms_logs')) || [];
            if (Array.isArray(kvLogs)) currentLogs = [...currentLogs, ...kvLogs];
          }
        } catch (e) {}

        const logMap = new Map();
        [newLog, ...currentLogs].forEach((l) => {
          if (l && l.id) logMap.set(l.id, l);
        });

        const mergedLogs = Array.from(logMap.values())
          .sort((a, b) => new Date(b.sentTime || 0).getTime() - new Date(a.sentTime || 0).getTime())
          .slice(0, 10000);

        globalThis.__shopeeSmsLogs = mergedLogs;

        try {
          if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
            await kv.set('movider_sms_logs', mergedLogs);
          }
        } catch (kvErr) {
          console.warn('KV write warning for SMS log:', kvErr.message);
        }

        return res.status(200).json({
          success: true,
          log: newLog,
          isRealApiSuccess,
          moviderResponse,
          logs: mergedLogs,
        });
      }

      // Sync or fetch past Movider report logs and merge with local logs
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
                  recipientPhone: (item.to || item.phone_number || item.recipientPhone || '').replace(/^\+/, ''),
                  messageText: item.text || item.message || 'SMS Delivery',
                  senderId: item.from || 'WCGMall',
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
            if (kvLogs && kvLogs.length > 0) existingLogs = [...existingLogs, ...kvLogs];
          }
        } catch (e) {}

        const logMap = new Map();
        [...existingLogs, ...fetchedMoviderLogs, ...(Array.isArray(incomingLogs) ? incomingLogs : [])].forEach((l) => {
          if (l && l.id) {
            logMap.set(l.id, l);
          } else if (l && l.recipientPhone && l.sentTime) {
            logMap.set(`${l.recipientPhone}_${l.sentTime}`, l);
          }
        });

        const merged = Array.from(logMap.values())
          .sort((a, b) => new Date(b.sentTime || 0).getTime() - new Date(a.sentTime || 0).getTime())
          .slice(0, 10000);

        globalThis.__shopeeSmsLogs = merged;

        try {
          if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
            await kv.set('movider_sms_logs', merged);
          }
        } catch (kvErr) {}

        return res.status(200).json({ success: true, logs: merged, totalCount: merged.length });
      }

      return res.status(400).json({ error: 'Invalid action specified' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
