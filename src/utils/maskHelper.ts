import { UserRole } from '../types';

export const DEFAULT_DEPARTMENT_PASSWORDS: Record<UserRole, string> = {
  admin: 'gio988',
  accountant: 'acc988',
  cs: 'cs988',
  marketing: 'mkt988',
};

export function getDepartmentPasswords(): Record<UserRole, string> {
  if (typeof window === 'undefined') return DEFAULT_DEPARTMENT_PASSWORDS;
  try {
    const saved = localStorage.getItem('wm_department_passwords');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        admin: parsed.admin || 'gio988',
        accountant: parsed.accountant || 'acc988',
        cs: parsed.cs || 'cs988',
        marketing: parsed.marketing || 'mkt988',
      };
    }
  } catch (err) {
    console.warn('Failed to parse department passwords', err);
  }
  const oldAdminPass = localStorage.getItem('wm_dashboard_password');
  return {
    admin: oldAdminPass || 'gio988',
    accountant: 'acc988',
    cs: 'cs988',
    marketing: 'mkt988',
  };
}

export async function syncPasswordsWithServer(): Promise<{
  departmentPasswords: Record<UserRole, string>;
  staffPasswords: StaffPasswordEntry[];
}> {
  if (typeof window === 'undefined') {
    return {
      departmentPasswords: getDepartmentPasswords(),
      staffPasswords: getStaffPasswords(),
    };
  }

  try {
    const res = await fetch('/api/passwords');
    if (res.ok) {
      const data = await res.json();
      if (data.departmentPasswords) {
        saveDepartmentPasswords(data.departmentPasswords, false);
      }
      if (data.staffPasswords && Array.isArray(data.staffPasswords)) {
        saveStaffPasswords(data.staffPasswords, false);
      }
      return {
        departmentPasswords: data.departmentPasswords || getDepartmentPasswords(),
        staffPasswords: data.staffPasswords || getStaffPasswords(),
      };
    }
  } catch (err) {
    console.warn('Failed to sync passwords with database server:', err);
  }

  return {
    departmentPasswords: getDepartmentPasswords(),
    staffPasswords: getStaffPasswords(),
  };
}

export function saveDepartmentPasswords(passwords: Record<UserRole, string>, syncServer = true): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('wm_department_passwords', JSON.stringify(passwords));
    if (passwords.admin) {
      localStorage.setItem('wm_dashboard_password', passwords.admin);
    }
    if (syncServer) {
      fetch('/api/passwords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentPasswords: passwords }),
      }).catch((err) => console.warn('Server sync failed for department passwords', err));
    }
  } catch (err) {
    console.warn('Failed to save department passwords', err);
  }
}

/**
 * Masks customer name e.g. "Ahmad Rizal" -> "A***d R***l"
 * Applicable to: Accountant & Marketing
 */
export function maskCustomerName(name: string | undefined | null, role: UserRole | string = 'admin'): string {
  if (!name) return 'Customer';
  if (role === 'admin' || role === 'cs') return name;
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed[0] + '*';
  const parts = trimmed.split(' ');
  return parts
    .map((part) => {
      if (part.length <= 2) return part[0] + '*';
      return part[0] + '*'.repeat(Math.max(2, part.length - 2)) + part[part.length - 1];
    })
    .join(' ');
}

/**
 * Masks username e.g. "shopee_user" -> "s****r"
 * Applicable to: Accountant & Marketing
 */
export function maskUsername(username: string | undefined | null, role: UserRole | string = 'admin'): string {
  if (!username) return 'buyer';
  if (role === 'admin' || role === 'cs') return username;
  const trimmed = username.trim();
  if (trimmed.length <= 3) return trimmed[0] + '***';
  return trimmed[0] + '*'.repeat(Math.max(3, trimmed.length - 2)) + trimmed[trimmed.length - 1];
}

/**
 * Masks phone number e.g. "+60123456789" -> "+6012****6789"
 * Applicable to: Accountant & Marketing
 */
export function maskPhone(phone: string | undefined | null, role: UserRole | string = 'admin'): string {
  if (!phone) return 'Hidden';
  if (role === 'admin' || role === 'cs') return phone;
  const trimmed = phone.trim();
  if (trimmed.length <= 5) return '****';
  const start = trimmed.slice(0, 4);
  const end = trimmed.slice(-3);
  return `${start}****${end}`;
}

/**
 * Masks shipping address
 * Applicable to: Accountant & Marketing
 */
export function maskAddress(address: string | undefined | null, role: UserRole | string = 'admin'): string {
  if (!address) return 'N/A';
  if (role === 'admin' || role === 'cs') return address;
  return '***********************************';
}

/**
 * Masks prices & monetary amounts
 * Applicable to: CS role ONLY
 */
export function maskPrice(
  amount: number | string | undefined | null,
  role: UserRole | string = 'admin',
  formatFn?: (val: number) => string
): string {
  if (role === 'cs') {
    return 'RM ***.**';
  }
  if (typeof amount === 'number') {
    return formatFn ? formatFn(amount) : `RM ${amount.toFixed(2)}`;
  }
  return amount ? String(amount) : 'RM 0.00';
}

export interface StaffPasswordEntry {
  id: string;
  staffName: string;
  role: UserRole;
  password: string;
  updatedAt: string;
}

export function getStaffPasswords(): StaffPasswordEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('wm_staff_passwords');
    if (saved) return JSON.parse(saved);
  } catch (err) {
    console.warn('Failed to parse staff passwords', err);
  }
  return [];
}

export function saveStaffPasswords(entries: StaffPasswordEntry[], syncServer = true): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('wm_staff_passwords', JSON.stringify(entries));
    if (syncServer) {
      fetch('/api/passwords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffPasswords: entries }),
      }).catch((err) => console.warn('Server sync failed for staff passwords', err));
    }
  } catch (err) {
    console.warn('Failed to save staff passwords', err);
  }
}

export function saveStaffPassword(staffName: string, role: UserRole, password: string): StaffPasswordEntry {
  const entries = getStaffPasswords();
  const cleanName = staffName.trim() || 'Staff Member';
  const id = `${role}_${cleanName.toLowerCase().replace(/\s+/g, '_')}`;
  const existingIdx = entries.findIndex((e) => e.id === id || (e.staffName.toLowerCase() === cleanName.toLowerCase() && e.role === role));

  const newEntry: StaffPasswordEntry = {
    id,
    staffName: cleanName,
    role,
    password,
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    entries[existingIdx] = newEntry;
  } else {
    entries.push(newEntry);
  }

  saveStaffPasswords(entries);
  return newEntry;
}

export function deleteStaffPassword(id: string): void {
  const entries = getStaffPasswords();
  const filtered = entries.filter((e) => e.id !== id);
  saveStaffPasswords(filtered);
}
