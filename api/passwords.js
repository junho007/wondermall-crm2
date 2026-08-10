import { kv } from '@vercel/kv';

const DEFAULT_DEPT_PASSWORDS = {
  admin: 'gio988',
  accountant: 'acc988',
  cs: 'cs988',
  marketing: 'mkt988',
};

if (!globalThis.__shopeePasswordsStore) {
  globalThis.__shopeePasswordsStore = {
    departmentPasswords: { ...DEFAULT_DEPT_PASSWORDS },
    staffPasswords: [],
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { departmentPasswords, staffPasswords } = req.body || {};

      let current = globalThis.__shopeePasswordsStore || {
        departmentPasswords: { ...DEFAULT_DEPT_PASSWORDS },
        staffPasswords: [],
      };

      if (departmentPasswords && typeof departmentPasswords === 'object') {
        current.departmentPasswords = {
          ...current.departmentPasswords,
          ...departmentPasswords,
        };
      }

      if (Array.isArray(staffPasswords)) {
        current.staffPasswords = staffPasswords;
      }

      globalThis.__shopeePasswordsStore = current;

      try {
        if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
          await kv.set('shopee_passwords', current);
        }
      } catch (kvErr) {
        console.warn('Vercel KV write warning for passwords:', kvErr.message);
      }

      return res.status(200).json({
        success: true,
        departmentPasswords: current.departmentPasswords,
        staffPasswords: current.staffPasswords,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      let stored = null;
      try {
        if (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) {
          stored = await kv.get('shopee_passwords');
        }
      } catch (kvErr) {
        console.warn('Vercel KV read warning for passwords:', kvErr.message);
      }

      if (!stored || typeof stored !== 'object') {
        stored = globalThis.__shopeePasswordsStore || {
          departmentPasswords: { ...DEFAULT_DEPT_PASSWORDS },
          staffPasswords: [],
        };
      } else {
        stored.departmentPasswords = {
          ...DEFAULT_DEPT_PASSWORDS,
          ...(stored.departmentPasswords || {}),
        };
        stored.staffPasswords = Array.isArray(stored.staffPasswords) ? stored.staffPasswords : [];
      }

      globalThis.__shopeePasswordsStore = stored;

      return res.status(200).json({
        departmentPasswords: stored.departmentPasswords,
        staffPasswords: stored.staffPasswords,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
