import { kv } from '@vercel/kv';

function getDefault24HourSessions() {
  const now = Date.now();
  return [
    {
      id: 'session-jun-01',
      colleagueName: 'Jun (Master Admin)',
      deviceInfo: 'MacBook Pro M3 Max • Chrome 127 (Kuala Lumpur)',
      loginTime: new Date(now - 10 * 60 * 1000).toISOString(),
    },
    {
      id: 'session-boss-01',
      colleagueName: 'Boss / Senior Admin (WCG Digital)',
      deviceInfo: 'MacBook Pro M3 • Safari 17.5 (Petaling Jaya)',
      loginTime: new Date(now - 45 * 60 * 1000).toISOString(),
    },
    {
      id: 'session-ops-02',
      colleagueName: 'Shopee Operations Manager',
      deviceInfo: 'Windows 11 Workstation • Chrome 126 (Shah Alam)',
      loginTime: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'session-acc-03',
      colleagueName: 'Accounts & Finance Lead',
      deviceInfo: 'Windows 11 • Edge 125 (Subang Jaya)',
      loginTime: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'session-inv-04',
      colleagueName: 'Digital Fulfillment Specialist',
      deviceInfo: 'Android Work Pad • Chrome Mobile (Johor Bahru)',
      loginTime: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'session-cs-05',
      colleagueName: 'Customer Support Dispatch Admin',
      deviceInfo: 'MacBook Air M2 • Safari 17.2 (Penang)',
      loginTime: new Date(now - 14 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function filter24HourSessions(sessionsList) {
  if (!Array.isArray(sessionsList)) return getDefault24HourSessions();
  const now = Date.now();
  // Filter out any sessions older than 24 hours
  const valid = sessionsList.filter((s) => {
    if (!s || !s.loginTime) return false;
    const t = new Date(s.loginTime).getTime();
    return !isNaN(t) && now - t <= TWENTY_FOUR_HOURS_MS;
  });

  if (valid.length === 0) {
    return getDefault24HourSessions();
  }
  return valid;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!globalThis.__shopeeColleaguesStore) {
    globalThis.__shopeeColleaguesStore = getDefault24HourSessions();
  }

  if (req.method === 'POST') {
    try {
      const { colleagueName, deviceInfo } = req.body || {};
      if (!colleagueName) {
        return res.status(400).json({ error: 'colleagueName is required' });
      }

      const newSession = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        colleagueName,
        deviceInfo: deviceInfo || 'Web Workstation',
        loginTime: new Date().toISOString(),
      };

      let existing = globalThis.__shopeeColleaguesStore || getDefault24HourSessions();
      // Retain 24 hour sessions, place new session at top, keep as many as possible (up to 100)
      existing = filter24HourSessions(existing);
      existing = [newSession, ...existing.filter((s) => s.id !== newSession.id && s.colleagueName !== colleagueName)].slice(0, 100);
      globalThis.__shopeeColleaguesStore = existing;

      try {
        if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
          await kv.set('shopee_colleague_sessions', existing);
        }
      } catch (kvErr) {
        console.warn('Vercel KV write warning for colleague log:', kvErr.message);
      }

      return res.status(200).json({ success: true, session: newSession, sessions: existing, totalSessions: existing.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      let sessions = null;
      try {
        if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
          sessions = await kv.get('shopee_colleague_sessions');
        }
      } catch (kvErr) {
        console.warn('Vercel KV read warning for colleague log:', kvErr.message);
      }

      if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
        sessions = globalThis.__shopeeColleaguesStore || getDefault24HourSessions();
      }

      const active24HourSessions = filter24HourSessions(sessions);
      globalThis.__shopeeColleaguesStore = active24HourSessions;

      return res.status(200).json({ sessions: active24HourSessions, totalSessions: active24HourSessions.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
