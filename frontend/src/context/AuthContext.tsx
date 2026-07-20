import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { api, loadToken, setToken } from '../api/client';

WebBrowser.maybeCompleteAuthSession();

async function registerForPush(userId: string) {
  if (Platform.OS === 'web') return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await api.post('/register-push', {
      user_id: userId,
      platform: Platform.OS,
      device_token: tokenResp.data,
    });
  } catch { /* silent — push is best-effort */ }
}

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
  signInWithGoogle: () => Promise<{ is_new: boolean } | null>;
  updateProfile: (u: Partial<User>) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

function extractSessionId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const hashIdx = url.indexOf('#');
    if (hashIdx >= 0) {
      const frag = url.slice(hashIdx + 1);
      const params = new URLSearchParams(frag);
      const sid = params.get('session_id');
      if (sid) return sid;
    }
    const qIdx = url.indexOf('?');
    if (qIdx >= 0) {
      const params = new URLSearchParams(url.slice(qIdx + 1));
      const sid = params.get('session_id');
      if (sid) return sid;
    }
  } catch {}
  return null;
}

async function exchangeSession(sessionId: string) {
  const res = await api.post('/auth/emergent-session', { session_id: sessionId });
  await setToken(res.token);
  if (res.user?.id) registerForPush(res.user.id);
  return res;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const t = await loadToken();
      if (!t) { setUser(null); return; }
      const me = await api.get('/auth/me');
      setUser(me);
      if (me?.id) registerForPush(me.id);
    } catch {
      await setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Web: if we returned from Google, URL contains session_id
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const sid = extractSessionId(window.location.href);
        if (sid) {
          try {
            const res = await exchangeSession(sid);
            setUser(res.user);
            try { window.history.replaceState(null, '', window.location.pathname); } catch {}
            setLoading(false);
            return;
          } catch { /* fall through to normal refresh */ }
        }
      } else {
        // Mobile cold-start deep-link
        try {
          const url = await Linking.getInitialURL();
          const sid = extractSessionId(url);
          if (sid) {
            const res = await exchangeSession(sid);
            setUser(res.user);
            setLoading(false);
            return;
          }
        } catch {}
      }
      await refresh();
      setLoading(false);
    })();

    // Mobile hot deep-link listener
    let sub: any = null;
    if (Platform.OS !== 'web') {
      sub = Linking.addEventListener('url', async ({ url }) => {
        const sid = extractSessionId(url);
        if (!sid) return;
        try {
          const res = await exchangeSession(sid);
          setUser(res.user);
        } catch {}
      });
    }
    return () => { try { sub?.remove?.(); } catch {} };
  }, [refresh]);

  const signInWithGoogle = async () => {
    // Compute platform-specific redirect
    let redirectUrl: string;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      redirectUrl = window.location.origin + '/';
    } else {
      redirectUrl = Linking.createURL('');
    }
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = authUrl;
      return null;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type !== 'success' || !result.url) return null;
    const sid = extractSessionId(result.url);
    if (!sid) return null;
    const res = await exchangeSession(sid);
    setUser(res.user);
    return { is_new: !!res.is_new };
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
    <AuthCtx.Provider value={{ user, loading, signInWithGoogle, updateProfile, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
