'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Route, Plus, Trash2, RefreshCw, MapPin, Clock, Gauge, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { tripsApi } from '@/lib/api';
import type { TripHistory, TripStatsData } from '@/lib/types';

const LOCATIONS = [
  'Gachibowli', 'Hitech City', 'Madhapur', 'Kondapur', 'Banjara Hills', 'Ameerpet',
  'Miyapur', 'Secunderabad', 'Silk Board', 'Koramangala', 'Whitefield', 'Mumbai',
];

function apiError(e: unknown) {
  const err = e as { response?: { data?: { error?: string; detail?: string; message?: string } }; message?: string };
  return err.response?.data?.error
    || err.response?.data?.detail
    || err.response?.data?.message
    || err.message
    || 'Trip request failed';
}

function congColor(level?: string | null) {
  const l = (level || '').toLowerCase();
  if (l === 'high' || l === 'critical') return '#ef4444';
  if (l === 'medium' || l === 'moderate') return '#f59e0b';
  if (l === 'low') return '#22c55e';
  return '#94a3b8';
}

function relTime(iso?: string | null) {
  if (!iso) return '—';
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (Number.isNaN(d)) return iso;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

export default function TripsPage() {
  const [trips, setTrips] = useState<TripHistory[]>([]);
  const [stats, setStats] = useState<TripStatsData | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [warning, setWarning] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modeFilter, setModeFilter] = useState('');
  const [form, setForm] = useState({
    origin: 'Gachibowli',
    destination: 'Hitech City',
    mode: 'driving',
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const refresh = useCallback(async (pageNum = page) => {
    setLoading(true);
    setError('');
    setWarning('');
    try {
      const [history, summary] = await Promise.all([
        tripsApi.list({
          page: pageNum,
          limit: 20,
          ...(modeFilter ? { mode: modeFilter } : {}),
        }),
        tripsApi.stats(),
      ]);
      setTrips(history.data.trips ?? []);
      setTotal(history.data.total ?? 0);
      setPage(history.data.page ?? pageNum);
      setTotalPages(history.data.total_pages ?? 1);
      if (history.data.warning) setWarning(history.data.warning);
      setStats(summary.data);
    } catch (e) {
      setError(apiError(e));
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [page, modeFilter]);

  useEffect(() => { void refresh(page); }, [refresh, page]);

  const logTrip = async () => {
    if (!form.origin.trim() || !form.destination.trim()) {
      setError('Origin and destination are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await tripsApi.log({
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        mode: form.mode,
      });
      showToast(
        res.message
          || (res.data.distance_km != null
            ? `Trip logged · ${res.data.distance_km} km · ${res.data.predicted_eta_minutes ?? '—'} min`
            : 'Trip logged'),
      );
      setPage(1);
      await refresh(1);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await tripsApi.delete(id);
      setTrips((rows) => rows.filter((t) => t.id !== id));
      showToast(res.message || 'Trip removed');
      await refresh(page);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const distTotal = stats?.distance_stats?.total_distance_km;
  const avgEta = stats?.eta_stats?.average_eta_minutes;
  const minEta = stats?.eta_stats?.min_eta_minutes;
  const maxEta = stats?.eta_stats?.max_eta_minutes;

  return (
    <div className="space-y-5">
      <div className="page-hero">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="neon-badge-blue" style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                ● Trip History
              </span>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Trip History
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.9)', marginTop: 4 }}>
              Log journeys with origin/destination only — distance &amp; ETA fill automatically
            </p>
          </div>
          <button
            onClick={() => void refresh(page)}
            disabled={loading}
            className="btn-neon flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ color: '#2563eb' }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}
      {toast && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', fontSize: 13, fontWeight: 600 }}>
          {toast}
        </div>
      )}
      {warning && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 13 }}>
          {warning}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <Stat label="Total trips" value={String(stats?.total_trips ?? '—')} sub={`${stats?.trips_last_7_days ?? 0} this week`} />
        <Stat label="Distance" value={distTotal != null ? `${distTotal} km` : '—'} sub={stats?.distance_stats?.average_distance_km != null ? `avg ${stats.distance_stats.average_distance_km} km` : undefined} color="#0ea5e9" />
        <Stat label="Avg ETA" value={avgEta != null ? `${avgEta} min` : '—'} sub={minEta != null && maxEta != null ? `${minEta}–${maxEta} min` : undefined} color="#10b981" />
        <Stat label="Top route" value={stats?.most_frequent_route?.split(' → ')[0] ?? '—'} sub={stats?.most_frequent_route?.includes('→') ? `→ ${stats.most_frequent_route.split(' → ')[1]}` : undefined} />
      </div>

      {/* Log form — sparse body */}
      <div className="neon-card" style={{ padding: 20 }}>
        <h2 style={{ margin: '0 0 6px', color: '#0f172a', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} color="#3b82f6" /> Log a trip
        </h2>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8' }}>
          Only origin + destination required. Coords, distance_km, ETA, and congestion are auto-filled.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Origin
            <select
              value={form.origin}
              onChange={(e) => setForm({ ...form, origin: e.target.value })}
              style={{ display: 'block', width: '100%', marginTop: 6, padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
            >
              {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Destination
            <select
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              style={{ display: 'block', width: '100%', marginTop: 6, padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
            >
              {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Mode
            <select
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value })}
              style={{ display: 'block', width: '100%', marginTop: 6, padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
            >
              <option value="driving">Driving</option>
              <option value="transit">Transit</option>
              <option value="walking">Walking</option>
            </select>
          </label>
        </div>
        <button
          onClick={() => void logTrip()}
          disabled={busy}
          className="btn-gradient"
          style={{ marginTop: 16, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, opacity: busy ? 0.7 : 1 }}
        >
          {busy ? 'Logging…' : 'Log trip'}
        </button>
      </div>

      {/* Breakdowns */}
      {stats && (stats.top_5_routes?.length || stats.mode_breakdown) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 14 }}>
          <div className="neon-card" style={{ padding: 18 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Top routes</h3>
            {(stats.top_5_routes ?? []).length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>No routes yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.top_5_routes!.map((r) => (
                  <div key={r.route} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                    <span style={{ color: '#334155', fontWeight: 600 }}>{r.route}</span>
                    <span style={{ color: '#64748b', fontWeight: 700 }}>×{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="neon-card" style={{ padding: 18 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Breakdown</h3>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#94a3b8' }}>Mode</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {Object.entries(stats.mode_breakdown ?? {}).map(([k, v]) => (
                <span key={k} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#eff6ff', color: '#2563eb' }}>
                  {k}: {v}
                </span>
              ))}
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#94a3b8' }}>Congestion at departure</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(stats.congestion_breakdown ?? {}).map(([k, v]) => (
                <span key={k} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: `${congColor(k)}18`, color: congColor(k), textTransform: 'capitalize' }}>
                  {k}: {v}
                </span>
              ))}
              {!Object.keys(stats.congestion_breakdown ?? {}).length && (
                <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* List + pagination */}
      <div className="neon-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: 15, fontWeight: 800 }}>Recent trips</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>
              page {page}/{totalPages} · {total} total · use page (1-based), not offset
            </p>
          </div>
          <select
            value={modeFilter}
            onChange={(e) => { setModeFilter(e.target.value); setPage(1); }}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          >
            <option value="">All modes</option>
            <option value="driving">Driving</option>
            <option value="transit">Transit</option>
            <option value="walking">Walking</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 20 }}>
            {[1, 2, 3].map((n) => <div key={n} className="skeleton" style={{ height: 64, borderRadius: 10, marginBottom: 10 }} />)}
          </div>
        ) : !trips.length ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div className="icon-glow icon-glow-blue mx-auto mb-3" style={{ width: 48, height: 48, margin: '0 auto 12px' }}>
              <Route size={22} color="#3b82f6" />
            </div>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>No trips yet. Log Gachibowli → Hitech City to get started.</p>
          </div>
        ) : (
          trips.map((trip) => (
            <div
              key={trip.id}
              style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
            >
              <div className="icon-glow icon-glow-blue" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}>
                <MapPin size={16} color="#3b82f6" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, color: '#0f172a', fontSize: 14, fontWeight: 700 }}>
                  {trip.origin} → {trip.destination}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4, fontSize: 12, color: '#64748b' }}>
                  <span style={{ textTransform: 'capitalize' }}>{trip.mode}</span>
                  <span>· {trip.distance_km ?? '—'} km</span>
                  <span className="inline-flex items-center gap-1"><Clock size={11} /> {trip.predicted_eta_minutes ?? '—'} min</span>
                  <span className="inline-flex items-center gap-1" style={{ color: congColor(trip.congestion_at_departure) }}>
                    <Gauge size={11} /> {trip.congestion_at_departure || '—'}
                  </span>
                  <span>· {relTime(trip.taken_at)}</span>
                </div>
              </div>
              <button
                disabled={busy}
                onClick={() => void remove(trip.id)}
                style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          ))
        )}

        {totalPages > 1 && (
          <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn-neon"
              style={{ padding: '6px 10px', borderRadius: 8, color: '#2563eb', opacity: page <= 1 ? 0.4 : 1 }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="btn-neon"
              style={{ padding: '6px 10px', borderRadius: 8, color: '#2563eb', opacity: page >= totalPages ? 0.4 : 1 }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Stat({
  label, value, sub, color = '#0f172a',
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="neon-card" style={{ padding: '14px 16px' }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 900, color, letterSpacing: '-0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>{sub}</p>}
    </div>
  );
}
