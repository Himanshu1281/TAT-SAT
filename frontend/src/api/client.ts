import { Platform } from 'react-native';
import { storage } from '@/src/utils/storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const TOKEN_KEY = 'aathman_token';

let TOKEN: string | null = null;

async function readToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
      return raw;
    } catch { return null; }
  }
  return await storage.secureGet<string>(TOKEN_KEY, '');
}

async function writeToken(t: string | null) {
  if (Platform.OS === 'web') {
    try {
      if (t) window.localStorage.setItem(TOKEN_KEY, t);
      else window.localStorage.removeItem(TOKEN_KEY);
    } catch {}
    return;
  }
  if (t) await storage.secureSet(TOKEN_KEY, t);
  else await storage.secureRemove(TOKEN_KEY);
}

export async function loadToken() {
  if (TOKEN) return TOKEN;
  const t = await readToken();
  TOKEN = t && String(t).length > 0 ? String(t) : null;
  return TOKEN;
}

export async function setToken(t: string | null) {
  TOKEN = t;
  await writeToken(t);
}

async function request(path: string, opts: RequestInit = {}) {
  await loadToken();
  const headers: any = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err: any = new Error(data?.detail || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p: string) => request(p),
  post: (p: string, body?: any) => request(p, { method: 'POST', body: JSON.stringify(body || {}) }),
  put: (p: string, body?: any) => request(p, { method: 'PUT', body: JSON.stringify(body || {}) }),
  del: (p: string) => request(p, { method: 'DELETE' }),
};
