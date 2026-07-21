'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Trash2, AlertCircle, Info, Zap, RefreshCw } from 'lucide-react';
import { notificationApi } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import { useNotifications } from '@/contexts/NotificationContext';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  severity: string;
  is_read: boolean;
  created_at: string;
}

function mapRow(n: Record<string, unknown>, i: number): Notification {
  return {
    id: String(n.id ?? n.notification_id ?? `n-${i}`),
    title: String(n.title ?? n.subject ?? 'Notification'),
    message: String(n.message ?? n.body ?? n.content ?? ''),
    type: String(n.type ?? n.notification_type ?? 'system'),
    severity: String(n.severity ?? n.level ?? 'low'),
    is_read: Boolean(n.is_read ?? n.read ?? n.read_at),
    created_at: String(n.created_at ?? n.timestamp ?? n.sent_at ?? new Date().toISOString()),
  };
}

function normalizeList(data: unknown): Notification[] {
  if (Array.isArray(data)) return data.map((item, i) => mapRow((item ?? {}) as Record<string, unknown>, i));
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  // Unwrap nested envelopes: { data: { notifications } } or { notifications }
  const inner = (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)
    ? obj.data
    : obj) as Record<string, unknown>;
  const raw = inner.notifications ?? inner.items ?? inner.history ?? inner.results ?? (Array.isArray(obj.data) ? obj.data : null);
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => mapRow((item ?? {}) as Record<string, unknown>, i));
}

function apiError(e: unknown) {
  const err = e as { response?: { data?: { error?: string; detail?: string } }; message?: string };
  return err.response?.data?.error || err.response?.data?.detail || err.message || 'Could not load notifications';
}

function notifIcon(type: string, severity: string) {
  if (severity === 'critical' || severity === 'high') return <AlertCircle size={18} style={{ color: '#dc2626' }} />;
  if (type === 'departure_alert') return <Zap size={18} style={{ color: '#d97706' }} />;
  return <Info size={18} style={{ color: '#3b82f6' }} />;
}

function notifGlowClass(severity: string) {
  if (severity === 'critical' || severity === 'high') return 'icon-glow-red';
  if (severity === 'medium') return 'icon-glow-yellow';
  return 'icon-glow-blue';
}

function badgeClass(severity: string) {
  if (severity === 'critical' || severity === 'high') return 'neon-badge-red';
  if (severity === 'medium') return 'neon-badge-blue';
  return 'neon-badge-green';
}

export default function NotificationsPage() {
  const { decrementUnread, resetUnread } = useNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [history, setHistory] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'history'>('all');
  const [stats, setStats] = useState({ total: 0, unread: 0, unread_critical: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchNotifs = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [listRes, statsRes, historyRes] = await Promise.allSettled([
        notificationApi.list({ limit: 50 }),
        notificationApi.stats(),
        notificationApi.history({ limit: 50 }),
      ]);

      if (listRes.status === 'rejected' && historyRes.status === 'rejected') {
        throw listRes.reason;
      }

      const list = listRes.status === 'fulfilled' ? normalizeList(listRes.value.data) : [];
      const hist = historyRes.status === 'fulfilled' ? normalizeList(historyRes.value.data) : [];
      setNotifications(list);
      setHistory(hist);

      if (statsRes.status === 'fulfilled') {
        const s = statsRes.value.data ?? {};
        const unread = Number(s.unread ?? s.unread_count ?? (listRes.status === 'fulfilled' ? listRes.value.data.unread : undefined) ?? list.filter((n) => !n.is_read).length);
        const total = Number(s.total ?? s.total_notifications ?? (listRes.status === 'fulfilled' ? listRes.value.data.total : undefined) ?? list.length);
        const unreadCritical = Number(s.unread_critical ?? 0);
        setStats({ total, unread, unread_critical: unreadCritical });
      } else if (listRes.status === 'fulfilled') {
        setStats({
          total: Number(listRes.value.data.total ?? list.length),
          unread: Number(listRes.value.data.unread ?? list.filter((n) => !n.is_read).length),
          unread_critical: Number(listRes.value.data.unread_critical ?? 0),
        });
      }

      if (listRes.status === 'rejected') {
        setError(apiError(listRes.reason));
      }
    } catch (e) {
      setError(apiError(e));
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchNotifs(); }, [fetchNotifs]);

  const markRead = async (id: string) => {
    setBusy(true);
    try {
      try {
        await notificationApi.markRead(id);
      } catch {
        await notificationApi.markReadPost(id);
      }
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setStats((s) => ({ ...s, unread: Math.max(0, s.unread - 1) }));
      decrementUnread(1);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const markAllRead = async () => {
    setBusy(true);
    try {
      try {
        await notificationApi.markAllRead();
      } catch {
        await notificationApi.markAllReadPost();
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setStats((s) => ({ ...s, unread: 0, unread_critical: 0 }));
      resetUnread();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteNotif = async (id: string) => {
    setBusy(true);
    try {
      await notificationApi.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setHistory((prev) => prev.filter((n) => n.id !== id));
      setStats((s) => ({ ...s, total: Math.max(0, s.total - 1) }));
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setError('');
    try {
      await notificationApi.test();
      await fetchNotifs();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const displayed =
    filter === 'history' ? history :
    filter === 'unread' ? notifications.filter((n) => !n.is_read) :
    notifications;

  return (
    <div className="slide-up" style={{ maxWidth: 768, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-hero" style={{ padding: '24px 28px' }}>
        <div style={{ position: 'relative', zIndex: 1 }} className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="gradient-text-neon" style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Notifications</h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
              {stats.unread} unread · {stats.unread_critical} critical · live API
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => void fetchNotifs()}
              disabled={loading}
              className="btn-neon"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              <RefreshCw size={13} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
              Refresh
            </button>
            <button
              onClick={() => void markAllRead()}
              disabled={busy}
              className="btn-neon"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              <CheckCheck size={15} />
              Mark All Read
            </button>
            <button
              onClick={() => void sendTest()}
              disabled={busy}
              className="btn-gradient"
              style={{ padding: '8px 12px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Test notification
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Total', value: stats.total, glowClass: 'icon-glow-blue', color: '#3b82f6' },
          { label: 'Unread', value: stats.unread, glowClass: 'icon-glow-purple', color: '#8b5cf6' },
          { label: 'Critical', value: stats.unread_critical, glowClass: 'icon-glow-red', color: '#ef4444' },
        ].map(({ label, value, glowClass, color }) => (
          <div key={label} className="neon-card" style={{ textAlign: 'center', padding: '18px' }}>
            <div className="flex items-center justify-center mb-2">
              <div className={`icon-glow ${glowClass}`} style={{ width: 36, height: 36, borderRadius: 10 }}>
                <Bell size={16} style={{ color }} />
              </div>
            </div>
            <p style={{ fontSize: 28, fontWeight: 900, color, margin: 0, textShadow: `0 0 12px ${color}44` }}>{value}</p>
            <p style={{ fontSize: 11.5, color: '#9ca3af', margin: '3px 0 0' }}>{label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'rgba(59,130,246,0.06)', width: 'fit-content', border: '1px solid rgba(59,130,246,0.15)' }}>
        {(['all', 'unread', 'history'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? 'btn-gradient' : ''}
            style={{
              padding: '7px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: filter === f ? undefined : 'transparent',
              color: filter === f ? undefined : '#9ca3af',
              border: 'none',
              textTransform: 'capitalize',
            }}
          >
            {f}{f === 'history' ? ` (${history.length})` : ''}
          </button>
        ))}
      </div>

      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          [1, 2, 3].map((n) => <div key={n} className="skeleton" style={{ height: 88, borderRadius: 14 }} />)
        ) : displayed.length === 0 ? (
          <div className="neon-card" style={{ padding: '60px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="icon-glow icon-glow-blue" style={{ width: 56, height: 56, borderRadius: 16 }}>
              <Bell size={26} color="#3b82f6" />
            </div>
            <p style={{ fontWeight: 600, color: '#9ca3af', margin: 0, fontSize: 14 }}>
              {error ? 'Notifications unavailable — check login / backend' : 'No notifications'}
            </p>
            {!error && (
              <button onClick={() => void sendTest()} className="btn-gradient" style={{ padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700 }}>
                Send test notification
              </button>
            )}
          </div>
        ) : (
          displayed.map((notif) => (
            <div
              key={notif.id}
              className="neon-card"
              style={{
                padding: '16px',
                opacity: notif.is_read ? 0.75 : 1,
                borderLeft: notif.is_read ? undefined : `3px solid ${notif.severity === 'critical' || notif.severity === 'high' ? '#ef4444' : notif.severity === 'medium' ? '#f59e0b' : '#3b82f6'}`,
              }}
            >
              <div className="flex items-start gap-3">
                <div className={`icon-glow ${notifGlowClass(notif.severity)}`} style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }}>
                  {notifIcon(notif.type, notif.severity)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <p style={{ fontWeight: 700, fontSize: 13.5, color: '#111827', margin: 0 }}>{notif.title}</p>
                    {!notif.is_read && (
                      <span className="radium-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', flexShrink: 0 }} />
                    )}
                    <span className={`${badgeClass(notif.severity)} capitalize`} style={{ fontSize: 10, fontWeight: 700, marginLeft: 'auto' }}>
                      {notif.severity}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 8px' }}>{notif.message}</p>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 11.5, color: '#9ca3af' }}>{formatRelativeTime(notif.created_at)}</span>
                    {filter !== 'history' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        {!notif.is_read && (
                          <button
                            disabled={busy}
                            onClick={() => void markRead(notif.id)}
                            style={{ fontSize: 12, padding: '3px 10px', borderRadius: 7, color: '#3b82f6', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => void deleteNotif(notif.id)}
                          style={{ padding: '3px 7px', borderRadius: 7, color: '#d1d5db', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
