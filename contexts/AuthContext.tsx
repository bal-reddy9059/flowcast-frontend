'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { authApi, setTokens, clearTokens } from '@/lib/api';
import { User } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, fullName: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const COOKIE_NAME = 'flowcast_token';
const STORAGE_KEY = 'flowcast_token';
const USER_KEY = 'flowcast_user';
// 30-day cookie, readable by middleware (no HttpOnly)
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function setCookie(token: string) {
  document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function clearCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

function cacheUser(user: User | null) {
  if (typeof window === 'undefined') return;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

function readCachedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    // Re-normalize so stale envelope-shaped caches are discarded
    return normalizeUser(JSON.parse(raw));
  } catch {
    return null;
  }
}

// Read the token from the HTTP cookie (set by the server-side OAuth route handler).
// This lets AuthContext pick up a token even when localStorage hasn't been synced yet.
function readCookieToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)flowcast_token=([^;]+)/);
  return match?.[1] ?? null;
}

// Returns the stored token, preferring localStorage and falling back to the cookie.
// Syncs cookie → localStorage so all subsequent reads are consistent.
function getInitialToken(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  const fromCookie = readCookieToken();
  if (fromCookie) {
    localStorage.setItem(STORAGE_KEY, fromCookie);
    return fromCookie;
  }
  return null;
}

function normalizeUser(raw: unknown): User | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  // JWT uses `sub` for email; API responses use `email`
  const email =
    (typeof d.email === 'string' && d.email.trim()) ||
    (typeof d.sub === 'string' && d.sub.includes('@') ? d.sub.trim() : '') ||
    '';
  const fullName =
    (typeof d.full_name === 'string' && d.full_name.trim()) ||
    (typeof d.name === 'string' && d.name.trim()) ||
    (typeof d.fullName === 'string' && d.fullName.trim()) ||
    (typeof d.display_name === 'string' && d.display_name.trim()) ||
    (typeof d.displayName === 'string' && d.displayName.trim()) ||
    (email ? email.split('@')[0] : '');
  if (!email && !fullName) return null;
  // Never treat the literal placeholder "User" as a real name when email exists
  const cleanedName =
    fullName && fullName.toLowerCase() !== 'user'
      ? fullName
      : email
        ? email.split('@')[0]
        : fullName;
  return {
    id: String(d.id ?? d.user_id ?? d.sub ?? ''),
    email,
    full_name: cleanedName,
    is_admin: Boolean(d.is_admin ?? d.isAdmin),
    auth_provider: typeof d.auth_provider === 'string'
      ? d.auth_provider
      : typeof d.authProvider === 'string'
        ? d.authProvider
        : 'unknown',
    is_active: typeof d.is_active === 'boolean'
      ? d.is_active
      : typeof d.isActive === 'boolean'
        ? d.isActive
        : undefined,
    created_at: typeof d.created_at === 'string' ? d.created_at : undefined,
  };
}

/** Peel `{ success, data }` envelopes (one or two layers). Keeps login token payloads intact. */
function unwrapAuthBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  let cur: unknown = body;
  for (let i = 0; i < 2; i++) {
    if (cur && typeof cur === 'object' && 'data' in (cur as object)) {
      const inner = (cur as { data: unknown }).data;
      if (inner != null && typeof inner === 'object') cur = inner;
      else break;
    } else break;
  }
  return cur;
}

/** Prefer nested `user`, else treat the payload itself as the user object. */
function extractUserPayload(body: unknown): unknown {
  const unwrapped = unwrapAuthBody(body);
  if (unwrapped && typeof unwrapped === 'object' && 'user' in (unwrapped as object)) {
    const u = (unwrapped as { user: unknown }).user;
    if (u != null && typeof u === 'object') return u;
  }
  return unwrapped;
}

/** Derive display info from the JWT when /auth/me is slow or unreachable. */
function userFromToken(token: string): User | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return normalizeUser(JSON.parse(json));
  } catch {
    return null;
  }
}

function tokenExpiryTime(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = Number((JSON.parse(json) as { exp?: number }).exp);
    return Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function applyUserFallback(authToken: string, current: User | null): User | null {
  if (current?.full_name && current.email) return current;
  const fallback = userFromToken(authToken);
  if (!fallback) return current;
  return current
    ? {
        ...fallback,
        ...current,
        full_name: current.full_name || fallback.full_name,
        email: current.email || fallback.email,
      }
    : fallback;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(readCachedUser);
  const [token, setToken] = useState<string | null>(getInitialToken);
  // isLoading is false when a token already exists — render immediately, verify in background.
  const [isLoading, setIsLoading] = useState(() => !getInitialToken());

  const fetchCurrentUser = useCallback(async (authToken: string) => {
    try {
      const res = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 3000,
        softFail: true,
      } as Parameters<typeof api.get>[1] & { softFail: boolean });
      const payload = extractUserPayload(res.data);
      const normalized = normalizeUser(payload) ?? applyUserFallback(authToken, readCachedUser());
      if (normalized) {
        setUser(normalized);
        cacheUser(normalized);
      }
    } catch (err) {
      // Only wipe the session on an explicit 401 (invalid/expired token).
      // Timeouts and network errors do NOT mean the token is bad — keep the user logged in.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        clearTokens();
        clearCookie();
        cacheUser(null);
        setToken(null);
        setUser(null);
      } else {
        setUser((prev) => {
          const fallback = applyUserFallback(authToken, prev ?? readCachedUser());
          if (fallback) cacheUser(fallback);
          return fallback;
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate auth state from browser storage */
  useEffect(() => {
    const stored = getInitialToken();
    if (stored) {
      // Update React token state — the useState initializer returns null on the
      // server, and React hydration reuses that null value on the client. Calling
      // setToken here is what actually makes isAuthenticated flip to true on load.
      setToken(stored);
      setCookie(stored);
      const cached = readCachedUser();
      if (cached) {
        setUser(cached);
      } else {
        const fallback = userFromToken(stored);
        if (fallback) {
          setUser(fallback);
          cacheUser(fallback);
        }
      }
      void fetchCurrentUser(stored);
    } else {
      clearCookie();
      cacheUser(null);
      setToken(null);
      setUser(null);
      setIsLoading(false);
    }
  }, [fetchCurrentUser]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Refresh shortly before JWT expiry while the existing token is still valid.
  useEffect(() => {
    if (!token) return;
    const expiresAt = tokenExpiryTime(token);
    if (!expiresAt) return;
    const delay = Math.max(0, expiresAt - Date.now() - 60_000);
    const timer = window.setTimeout(() => {
      void authApi.refresh().then((res) => {
        const nextToken = res.data.access_token;
        if (!nextToken) return;
        setTokens(nextToken);
        setToken(nextToken);
        const nextUser = normalizeUser(res.data.user);
        if (nextUser) {
          setUser(nextUser);
          cacheUser(nextUser);
        }
      }).catch(() => {
        // The request interceptor handles an explicit authentication failure.
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const body = res.data as unknown as Record<string, unknown>;
    const access_token = res.data.access_token;
    if (!access_token) throw new Error('Login succeeded but no access token returned');
    setTokens(access_token);
    setToken(access_token);
    const normalized = normalizeUser(res.data.user) ?? normalizeUser(body) ?? userFromToken(access_token);
    if (normalized) {
      setUser(normalized);
      cacheUser(normalized);
    } else {
      await fetchCurrentUser(access_token);
    }
  };

  const register = async (email: string, fullName: string, password: string) => {
    const res = await authApi.register(email, fullName, password);
    const accessToken = res.data.access_token;
    if (!accessToken) throw new Error('Registration succeeded but no access token returned');
    setTokens(accessToken);
    setToken(accessToken);
    const normalized = normalizeUser(res.data.user) ?? userFromToken(accessToken);
    if (normalized) {
      setUser(normalized);
      cacheUser(normalized);
    } else {
      await fetchCurrentUser(accessToken);
    }
  };

  const logout = () => {
    clearTokens();
    cacheUser(null);
    setToken(null);
    setUser(null);
  };

  const refreshUser = useCallback(async () => {
    const stored = getInitialToken();
    if (stored) {
      setToken(stored);
      await fetchCurrentUser(stored);
    }
  }, [fetchCurrentUser]);

  return (
    <AuthContext.Provider
      value={{ user, token, login, register, logout, refreshUser, isLoading, isAuthenticated: !!token }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
