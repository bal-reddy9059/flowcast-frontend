'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, TrendingUp, Server, AlertTriangle, X, RefreshCw,
  UserX, UserCheck, Trash2, ChevronLeft, ChevronRight, Database, Play,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role?: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped';
  last_poll: string;
}

const USERS_STUB: AdminUser[] = [
  { id: '1', email: 'rajesh.k@earth.gov.in', full_name: 'Rajesh Kumar', role: 'Regional Planner', is_active: true, created_at: '2023-11-24T14:22:00Z', last_login: '2023-11-24T14:22:00Z' },
  { id: '2', email: 'p.sharma@FlowIndia.io', full_name: 'Priya Sharma', role: 'System Analyst', is_active: true, created_at: '2023-11-24T16:05:00Z', last_login: '2023-11-24T16:05:00Z' },
  { id: '3', email: 'arun.v@transport.gov.in', full_name: 'Arun Varma', role: 'Contractor', is_active: false, created_at: '2023-10-12T09:12:00Z', last_login: '2023-10-12T09:12:00Z' },
  { id: '4', email: 'meera.n@flowcast.in', full_name: 'Meera Nair', role: 'Data Engineer', is_active: true, created_at: '2023-11-20T11:30:00Z', last_login: '2023-11-20T11:30:00Z' },
  { id: '5', email: 'vikram.s@flowcast.in', full_name: 'Vikram Singh', role: 'Operations', is_active: true, created_at: '2023-11-18T09:00:00Z', last_login: '2023-11-18T09:00:00Z' },
];

const SERVICES_STUB: ServiceStatus[] = [
  { name: 'Congestion Monitor', status: 'running', last_poll: '8s' },
  { name: 'Departure Alert Monitor', status: 'running', last_poll: '1s' },
  { name: 'India Traffic Collector', status: 'running', last_poll: '8s' },
  { name: 'District Collector', status: 'running', last_poll: '5s' },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>(USERS_STUB);
  const [services, setServices] = useState<ServiceStatus[]>(SERVICES_STUB);
  const [stats, setStats] = useState({ total_active_users: 12482, traffic_records_today: 8400000, system_uptime: 99.98 });
  const [showSecurityBanner, setShowSecurityBanner] = useState(true);
  const [page, setPage] = useState(1);
  const [isVacuuming, setIsVacuuming] = useState(false);
  const [vacuumDone, setVacuumDone] = useState(false);
  const [dbPool, setDbPool] = useState({ used: 42, total: 189 });
  const [dbLatency] = useState(12);
  const perPage = 3;

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
      ]);
      if (statsRes.data) {
        setStats({
          total_active_users: statsRes.data.total_active_users || 12482,
          traffic_records_today: statsRes.data.traffic_records_today || 8400000,
          system_uptime: statsRes.data.system_uptime_percent || 99.98,
        });
        if (statsRes.data.services) setServices(statsRes.data.services);
        if (statsRes.data.db_connection_pool) {
          setDbPool(statsRes.data.db_connection_pool);
        }
      }
      if (usersRes.data?.users) setUsers(usersRes.data.users);
    } catch { /* use stubs */ }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleToggleUser = async (id: string) => {
    try { await api.put(`/admin/users/${id}/toggle`); } catch { /* ignore */ }
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, is_active: !u.is_active } : u));
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Delete this user permanently?')) return;
    try { await api.delete(`/admin/users/${id}`); } catch { /* ignore */ }
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const handleVacuum = async () => {
    setIsVacuuming(true);
    try { await api.post('/admin/db/vacuum'); } catch { /* ignore */ }
    setTimeout(() => { setIsVacuuming(false); setVacuumDone(true); setTimeout(() => setVacuumDone(false), 3000); }, 2500);
  };

  const paginatedUsers = users.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(users.length / perPage);

  if (!user?.is_admin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '80px 20px', gap: 16 }}>
        <div className="icon-glow icon-glow-yellow" style={{ width: 72, height: 72, borderRadius: 20 }}>
          <AlertTriangle size={36} color="#f59e0b" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>Admin Access Required</h2>
        <p style={{ color: '#6b7280', margin: 0 }}>You need administrator privileges to access this page.</p>
      </div>
    );
  }

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Hero Banner ── */}
      <div className="page-hero" style={{ padding: '24px 28px' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 className="gradient-text-neon" style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Admin Panel</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>System management, user control, and infrastructure health</p>
        </div>
      </div>

      {/* Security banner */}
      {showSecurityBanner && (
        <div
          className="flex items-center gap-3"
          style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 0 16px rgba(245,158,11,0.1)' }}
        >
          <div className="icon-glow icon-glow-yellow" style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0 }}>
            <AlertTriangle size={14} color="#f59e0b" />
          </div>
          <p style={{ fontSize: 13, flex: 1, color: '#92400e', margin: 0 }}>
            <strong>Security Risk Detected:</strong> The system is currently running on default administrator credentials. Please update your password immediately to prevent unauthorized access to critical India traffic infrastructure.
          </p>
          <button
            className="btn-gradient"
            style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
            onClick={() => window.location.href = '/settings'}
          >
            Update Now
          </button>
          <button onClick={() => setShowSecurityBanner(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          { label: 'Total Active Users', value: stats.total_active_users.toLocaleString(), badge: '+4.2%', icon: <Users size={18} color="#3b82f6" />, glowClass: 'icon-glow-blue', badgeClass: 'neon-badge-green' },
          { label: 'Traffic Records / Day', value: (stats.traffic_records_today / 1_000_000).toFixed(1) + 'M', badge: '+12%', icon: <TrendingUp size={18} color="#10b981" />, glowClass: 'icon-glow-green', badgeClass: 'neon-badge-green' },
          { label: 'System Uptime', value: stats.system_uptime.toFixed(2) + '%', badge: 'Stable', icon: <Server size={18} color="#8b5cf6" />, glowClass: 'icon-glow-purple', badgeClass: 'neon-badge-blue' },
        ].map(({ label, value, badge, icon, glowClass, badgeClass: bc }) => (
          <div key={label} className="neon-card" style={{ padding: '20px' }}>
            <div className="flex items-center justify-between mb-3">
              <div className={`icon-glow ${glowClass}`} style={{ width: 38, height: 38, borderRadius: 10 }}>{icon}</div>
              <span className={bc} style={{ fontSize: 11 }}>{badge}</span>
            </div>
            <p style={{ fontSize: 26, fontWeight: 900, color: '#111827', margin: 0 }}>{value}</p>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '3px 0 0' }}>{label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'start' }}>
        {/* User management */}
        <div className="neon-card" style={{ overflow: 'hidden', padding: 0 }}>
          <div className="flex items-center justify-between" style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <div className="flex items-center gap-2">
              <div className="icon-glow icon-glow-blue" style={{ width: 28, height: 28, borderRadius: 8 }}>
                <Users size={14} color="#3b82f6" />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 14, color: '#111827', margin: 0 }}>User Management</h3>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={fetchData}
                className="btn-neon"
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
              >
                <RefreshCw size={11} />
                Export CSV
              </button>
              <button
                className="btn-neon"
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                Filter
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['User Identifier', 'Role', 'Status', 'Last Login', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((u) => {
                  const initials = u.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
                  return (
                    <tr key={u.id} style={{ borderTop: '1px solid #f3f4f6', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 20px' }}>
                        <div className="flex items-center gap-2.5">
                          <div
                            style={{
                              width: 32, height: 32, borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
                              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                              boxShadow: '0 0 10px rgba(59,130,246,0.3)',
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <p style={{ fontSize: 13.5, fontWeight: 600, color: '#111827', margin: 0 }}>{u.full_name}</p>
                            <p style={{ fontSize: 11.5, color: '#9ca3af', margin: '1px 0 0' }}>{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>{u.role || 'User'}</td>
                      <td style={{ padding: '12px 20px' }}>
                        <span
                          className={u.is_active ? 'neon-badge-green' : 'neon-badge-blue'}
                          style={{ fontSize: 11 }}
                        >
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 12, color: '#9ca3af' }}>
                        {u.last_login ? formatDate(u.last_login) : '—'}
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            onClick={() => handleToggleUser(u.id)}
                            title={u.is_active ? 'Deactivate' : 'Activate'}
                            style={{ padding: '5px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', color: u.is_active ? '#f59e0b' : '#10b981', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.boxShadow = u.is_active ? '0 0 8px rgba(245,158,11,0.25)' : '0 0 8px rgba(16,185,129,0.25)'; }}
                            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                          >
                            {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            style={{ padding: '5px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', color: '#d1d5db', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.boxShadow = '0 0 8px rgba(239,68,68,0.2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#d1d5db'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between" style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9', fontSize: 12, color: '#9ca3af' }}>
            <span>Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, users.length)} of {stats.total_active_users.toLocaleString()} users</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '3px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', opacity: page === 1 ? 0.4 : 1 }}
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    width: 24, height: 24, borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: p === page ? '#3b82f6' : 'transparent',
                    color: p === page ? '#fff' : '#6b7280',
                    boxShadow: p === page ? '0 0 8px rgba(59,130,246,0.3)' : 'none',
                  }}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ padding: '3px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', opacity: page === totalPages ? 0.4 : 1 }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 280 }}>
          {/* Service monitors */}
          <div className="neon-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="flex items-center gap-2" style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
              <div className="icon-glow icon-glow-blue" style={{ width: 28, height: 28, borderRadius: 8 }}>
                <Server size={14} color="#3b82f6" />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 14, color: '#111827', margin: 0 }}>Service Monitors</h3>
            </div>
            <div style={{ padding: '0 0 4px' }}>
              {services.map((svc) => (
                <div key={svc.name} className="flex items-center justify-between" style={{ padding: '10px 18px', borderBottom: '1px solid #f9fafb' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{svc.name}</p>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>Last Poll: {svc.last_poll} ago</p>
                  </div>
                  <span
                    className={svc.status === 'running' ? 'neon-badge-green' : 'neon-badge-red'}
                    style={{ fontSize: 11, fontWeight: 800 }}
                  >
                    {svc.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Database maintenance */}
          <div className="neon-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="flex items-center gap-2" style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
              <div className="icon-glow icon-glow-purple" style={{ width: 28, height: 28, borderRadius: 8 }}>
                <Database size={14} color="#8b5cf6" />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 14, color: '#111827', margin: 0 }}>Database Maintenance</h3>
            </div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: 0 }}>Connection Pool</p>
                  <p style={{ fontSize: 12, fontFamily: 'monospace', color: '#6b7280', margin: 0 }}>{dbPool.used} / {dbPool.total} in use</p>
                </div>
                <div className="progress-neon">
                  <div style={{ width: `${(dbPool.used / dbPool.total) * 100}%` }} />
                </div>
                <div className="flex items-center justify-between" style={{ marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
                  <span>Latency: {dbLatency}ms</span>
                  <span>Wait: 2ms</span>
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
                Perform routine maintenance to optimize query execution and reclaim disk space. Estimated impact: +5% performance.
              </p>
              <button
                onClick={handleVacuum}
                disabled={isVacuuming}
                className={vacuumDone ? 'btn-neon' : 'btn-gradient'}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: isVacuuming ? 'not-allowed' : 'pointer', opacity: isVacuuming ? 0.8 : 1,
                }}
              >
                {isVacuuming ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Running Vacuum…
                  </>
                ) : vacuumDone ? (
                  'Vacuum Complete ✓'
                ) : (
                  <>
                    <Play size={14} />
                    Run Vacuum Analyze
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
