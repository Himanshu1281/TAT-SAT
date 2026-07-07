import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, loadToken, setToken } from '../api/client';

type User = {
  id: string;
  identifier: string;
  email?: string | null;
  phone?: string | null;
  name?: string;
  age?: number | null;
  sex?: string | null;
  gender?: string | null;
  state?: string | null;
  nationality?: string | null;
  avatar?: string | null;
  onboarded?: boolean;
  streak?: number;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  sendOtp: (identifier: string, method: 'email' | 'phone') => Promise<{ dev_otp?: string }>;
  verifyOtp: (identifier: string, otp: string, method: 'email' | 'phone') => Promise<{ is_new: boolean }>;
  updateProfile: (u: Partial<User>) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const t = await loadToken();
      if (!t) { setUser(null); return; }
      const me = await api.get('/auth/me');
      setUser(me);
    } catch {
      await setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const sendOtp = async (identifier: string, method: 'email' | 'phone') => {
    return await api.post('/auth/send-otp', { identifier, method });
  };

  const verifyOtp = async (identifier: string, otp: string, method: 'email' | 'phone') => {
    const res = await api.post('/auth/verify-otp', { identifier, otp, method });
    await setToken(res.token);
    setUser(res.user);
    return { is_new: res.is_new };
  };

  const updateProfile = async (u: Partial<User>) => {
    const updated = await api.put('/profile', u);
    setUser(updated);
    return updated;
  };

  const logout = async () => {
    await setToken(null);
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, sendOtp, verifyOtp, updateProfile, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
