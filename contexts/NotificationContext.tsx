'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { notificationApi, wsBase, isApiCircuitOpen } from '@/lib/api';
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

function userIdFromJwt(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    const id = payload.sub ?? payload.user_id ?? payload.id ?? payload.uid;
    return id != null ? String(id) : null;
  } catch {
    return null;
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, token, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectWSRef = useRef<() => void>(() => {});
  const mountedRef = useRef(true);
  const attemptRef = useRef(0);

  const userId = user?.id ?? userIdFromJwt(token);

  const fetchStats = useCallback(async () => {
    if (isApiCircuitOpen()) return;
    try {
      const res = await notificationApi.stats();
      if (!mountedRef.current) return;
      const unread = res.data?.unread ?? res.data?.unread_count;
      if (typeof unread === 'number' && Number.isFinite(unread)) {
        setUnreadCount(Math.max(0, Math.min(999, Math.floor(unread))));
      }
    } catch {
      /* optional probe; Live badge is driven by WebSocket only */
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (retryRef.current) clearTimeout(retryRef.current);
    attemptRef.current += 1;
    const delay = Math.min(45000, 2000 * Math.pow(1.8, Math.min(attemptRef.current, 8)));
    retryRef.current = setTimeout(() => connectWSRef.current(), delay);
  }, []);

  const connectWS = useCallback(() => {
    if (!mountedRef.current || !userId) return;
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      try { wsRef.current.close(); } catch { /* ignore */ }
      wsRef.current = null;
    }

    const base = wsBase().replace(/\/$/, '');
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    const url = `${base}/notifications/ws/${encodeURIComponent(userId)}${qs}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      if (mountedRef.current) setIsConnected(true);
      // Re-sync count from API whenever the socket connects (avoids 99+ drift)
      void fetchStats();
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      scheduleReconnect();
    };

    ws.onerror = () => {
      try { ws.close(); } catch { /* ignore */ }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'ping' || data?.type === 'pong' || data?.type === 'connected') {
          if (data?.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        // Only count real notification payloads — not every WS frame
        const isNotif =
          data?.type === 'notification' ||
          (typeof data?.id === 'string' && (data?.title || data?.message || data?.notification_type));
        if (isNotif) {
          setUnreadCount((n) => Math.min(999, n + 1));
        }
      } catch { /* ignore malformed frames */ }
    };
  }, [userId, token, scheduleReconnect, fetchStats]);

  useEffect(() => {
    connectWSRef.current = connectWS;
  });

  useEffect(() => {
    mountedRef.current = true;

    if (!isAuthenticated || !userId) {
      setIsConnected(false);
      return;
    }

    // One lightweight stats fetch on mount — no repeating HTTP health loop
    void fetchStats();
    connectWS();

    return () => {
      mountedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = null;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        try { wsRef.current.close(); } catch { /* ignore */ }
        wsRef.current = null;
      }
    };
  }, [isAuthenticated, userId, fetchStats, connectWS]);

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
