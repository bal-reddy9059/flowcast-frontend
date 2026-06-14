'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Trash2, AlertCircle, Info, Zap } from 'lucide-react';
import api from '@/lib/api';
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

const STUBS: Notification[] = [
  { id: '1', title: 'Critical Congestion Alert', message: 'Mumbai-Pune Expressway at 95% capacity. Major delay expected.', type: 'congestion_alert', severity: 'critical', is_read: false, created_at: new Date(Date.now() - 3 * 60000).toISOString() },
  { id: '2', title: 'Departure Reminder', message: 'Your morning commute (Miyapur → Hitech City) departs in 15 minutes.', type: 'departure_alert', severity: 'medium', is_read: false, created_at: new Date(Date.now() - 15 * 60000).toISOString() },
  { id: '3', title: 'Route Optimized', message: 'Alternative route saved 12 minutes on Outer Ring Road corridor.', type: 'system', severity: 'low', is_read: true, created_at: new Date(Date.now() - 45 * 60000).toISOString() },
  { id: '4', title: 'New Incident Reported', message: 'Signal Malfunction at Connaught Place, New Delhi — Medium severity.', type: 'congestion_alert', severity: 'medium', is_read: false, created_at: new Date(Date.now() - 120 * 60000).toISOString() },
  { id: '5', title: 'System Maintenance', message: 'Scheduled maintenance window tonight 02:00–04:00 IST.', type: 'system', severity: 'low', is_read: true, created_at: new Date(Date.now() - 3 * 3600000).toISOString() },
];

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
  const [notifications, setNotifications] = useState<Notification[]>(STUBS);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [stats, setStats] = useState({ total: 5, unread: 3, unread_critical: 1 });

  const fetchNotifs = useCallback(async () => {
    try {
      const [listRes, statsRes] = await Promise.all([
        api.get('/notifications'),
        api.get('/notifications/stats'),
      ]);
      if (listRes.data?.notifications?.length) setNotifications(listRes.data.notifications);
      if (statsRes.data) setStats(statsRes.data);
    } catch { /* use stubs */ }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchNotifs(); }, [fetchNotifs]);

  const markRead = async (id: string) => {
    try { await api.put(`/notifications/${id}/read`); } catch { /* ignore */ }
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setStats((s) => ({ ...s, unread: Math.max(0, s.unread - 1) }));
    decrementUnread(1);
  };

  const markAllRead = async () => {
    try { await api.put('/notifications/read-all'); } catch { /* ignore */ }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setStats((s) => ({ ...s, unread: 0 }));
    resetUnread();
  };

  const deleteNotif = async (id: string) => {
    try { await api.delete(`/notifications/${id}`); } catch { /* ignore */ }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const displayed = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <div className="slide-up" style={{ maxWidth: 768, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero Banner ── */}
      <div className="page-hero" style={{ padding: '24px 28px' }}>
        <div style={{ position: 'relative', zIndex: 1 }} className="flex items-center justify-between">
          <div>
            <h1 className="gradient-text-neon" style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Notifications</h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
              {stats.unread} unread · {stats.unread_critical} critical
            </p>
          </div>
          <button
            onClick={markAllRead}
            className="btn-neon"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <CheckCheck size={15} />
            Mark All Read
          </button>
        </div>
      </div>

      {/* Stats row */}
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

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'rgba(59,130,246,0.06)', width: 'fit-content', border: '1px solid rgba(59,130,246,0.15)' }}>
        {(['all', 'unread'] as const).map((f) => (
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
            {f}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {displayed.length === 0 ? (
          <div className="neon-card" style={{ padding: '60px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="icon-glow icon-glow-blue" style={{ width: 56, height: 56, borderRadius: 16 }}>
              <Bell size={26} color="#3b82f6" />
            </div>
            <p style={{ fontWeight: 600, color: '#9ca3af', margin: 0, fontSize: 14 }}>No notifications</p>
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
                    <div style={{ display: 'flex', gap: 8 }}>
                      {!notif.is_read && (
                        <button
                          onClick={() => markRead(notif.id)}
                          style={{ fontSize: 12, padding: '3px 10px', borderRadius: 7, color: '#3b82f6', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
                        >
                          Mark read
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotif(notif.id)}
                        style={{ padding: '3px 7px', borderRadius: 7, color: '#d1d5db', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', transition: 'color 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#d1d5db'; }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
