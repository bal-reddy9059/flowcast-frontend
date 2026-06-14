'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { notificationApi, wsBase } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationContextType {
  unreadCount: number;
  isConnected: boolean;
  decrementUnread: (by?: number) => void;
  resetUnread: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  isConnected: false,
  decrementUnread: () => {},
  resetUnread: () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

// ─── Provider ────────────────────────────────────────────────────
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef        = useRef<WebSocket | null>(null);
  const retryRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectWSRef = useRef<() => void>(() => {});
  const mountedRef   = useRef(true);

  // ── Fetch initial unread count ────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await notificationApi.stats();
      if (typeof res.data?.unread === 'number') {
        setUnreadCount(res.data.unread);
      }
    } catch { /* backend unavailable — keep count at 0 */ }
  }, []);

  // ── Open user notification WebSocket ─────────────────────────
  const connectWS = useCallback(() => {
    if (!user?.id) return;
    if (retryRef.current) clearTimeout(retryRef.current);

    const url = `${wsBase()}/notifications/ws/${user.id}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen  = () => setIsConnected(true);
    ws.onclose = () => {
      setIsConnected(false);
      // Only reconnect if the provider is still mounted
      if (mountedRef.current) {
        retryRef.current = setTimeout(() => connectWSRef.current(), 5000);
      }
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Backend pushes notification objects or { type, data } envelopes
        if (
          data?.type === 'notification' ||
          data?.title ||           // bare notification object
          data?.notification_type  // alternate field name the backend uses
        ) {
          setUnreadCount((n) => n + 1);
        }
      } catch { /* ignore malformed frames */ }
    };
  }, [user]);

  useEffect(() => { connectWSRef.current = connectWS; });

  // ── Lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStats();
    connectWS();

    return () => {
      mountedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
      setIsConnected(false);
    };
  }, [isAuthenticated, user?.id, fetchStats, connectWS]);

  const decrementUnread = useCallback((by = 1) => {
    setUnreadCount((n) => Math.max(0, n - by));
  }, []);

  const resetUnread = useCallback(() => setUnreadCount(0), []);

  return (
    <NotificationContext.Provider
      value={{ unreadCount, isConnected, decrementUnread, resetUnread }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
