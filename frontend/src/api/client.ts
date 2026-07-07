import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

let TOKEN: string | null = null;

export async function loadToken() {
  if (TOKEN) return TOKEN;
  TOKEN = await AsyncStorage.getItem('aathman_token');
  return TOKEN;
}

export async function setToken(t: string | null) {
  TOKEN = t;
  if (t) await AsyncStorage.setItem('aathman_token', t);
  else await AsyncStorage.removeItem('aathman_token');
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
