'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Star, MapPin, RefreshCw, Trash2, Gauge, AlertTriangle, Clock, Radio,
} from 'lucide-react';
import { favoritesApi } from '@/lib/api';
import type { FavoriteLocation, FavoritesStatusData, FavoritesStatusLocation } from '@/lib/types';

const PRESETS = [
  'Banjara Hills', 'Jubilee Hills', 'Madhapur', 'Kondapur',
  'Hitech City', 'Gachibowli', 'Ameerpet', 'Secunderabad',
];

function apiError(e: unknown) {
  const err = e as { response?: { data?: { error?: string; detail?: string } }; message?: string };
  return err.response?.data?.error || err.response?.data?.detail || err.message || 'Favorites request failed';
}

function congColor(level?: string | null) {
  const l = (level || '').toLowerCase();
  if (l === 'high' || l === 'critical') return '#ef4444';
  if (l === 'medium' || l === 'moderate') return '#f59e0b';
  if (l === 'low') return '#22c55e';
  return '#94a3b8';
}

function fmtWhen(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function statusMeta(loc: FavoritesStatusLocation | FavoriteLocation['traffic_status']) {
  if (!loc) {
    return { label: 'Unknown', color: '#94a3b8', hint: 'No traffic status' };
  }
  const level = 'congestion_level' in loc ? loc.congestion_level : null;
  const stale = 'is_stale' in loc ? loc.is_stale : false;
  const message = 'message' in loc ? loc.message : undefined;

  if (message && (!level || level === 'unknown')) {
    return { label: 'No data', color: '#94a3b8', hint: message };
  }
  if (stale) {
    return { label: 'Stale', color: '#f59e0b', hint: message || 'Reading older than 6 hours' };
  }
  if (!level || level === 'unknown') {
    return { label: 'Unknown', color: '#94a3b8', hint: message || 'No recent traffic data for this location' };
  }
  return { label: level, color: congColor(level), hint: message || 'Live (≤6h)' };
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [status, setStatus] = useState<FavoritesStatusData | null>(null);
  const [form, setForm] = useState({ nickname: '', location_name: '' });
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, nextStatus] = await Promise.all([
        favoritesApi.list(),
        favoritesApi.status(),
      ]);
      setFavorites(list.data.favorites);
      setStatus(nextStatus.data);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const add = async () => {
    if (!form.location_name.trim()) {
      setError('Location name is required (lat/lng optional — backend geocodes).');
      return;
    }
    setError('');
    setOkMsg('');
    try {
      const res = await favoritesApi.add({
        location_name: form.location_name.trim(),
        nickname: form.nickname.trim() || undefined,
      });
      setForm({ nickname: '', location_name: '' });
      setOkMsg(res.data.message || `Added ${res.data.location_name}`);
      await refresh();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const update = async (favorite: FavoriteLocation) => {
    const id = favorite.id;
    const nickname = editing[id];
    if (!id || !nickname?.trim()) return;
    setError('');
    try {
      await favoritesApi.update(id, { nickname: nickname.trim() });
      setEditing((items) => ({ ...items, [id]: '' }));
      setOkMsg(`Nickname updated to “${nickname.trim()}”`);
      await refresh();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const remove = async (id: string) => {
    if (!id) return;
    try {
      await favoritesApi.delete(id);
      setFavorites((items) => items.filter((item) => item.id !== id));
      await refresh();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const statusById = new Map((status?.locations ?? []).map((l) => [l.id, l]));

  return (
    <div className="space-y-5">
      <div className="page-hero">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="neon-badge-blue" style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                ● Favorites
              </span>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Favorite Locations
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.9)', marginTop: 4 }}>
              Bookmark places for quick live traffic checks · only ≤6h readings count as live
            </p>
          </div>
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="btn-neon flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ color: '#2563eb' }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <StatCard label="Saved" value={String(favorites.length)} icon={<Star size={15} color="#f59e0b" />} />
        <StatCard label="Live status rows" value={String(status?.total ?? '—')} icon={<Radio size={15} color="#3b82f6" />} />
        <StatCard
          label="High congestion alerts"
          value={String(status?.high_congestion_alerts ?? 0)}
          icon={<AlertTriangle size={15} color="#ef4444" />}
          color="#ef4444"
        />
      </div>

      {(error || okMsg) && (
        <div style={{
          padding: '12px 14px', borderRadius: 12, fontSize: 13,
          background: error ? '#fef2f2' : '#ecfdf5',
          border: `1px solid ${error ? '#fecaca' : '#a7f3d0'}`,
          color: error ? '#b91c1c' : '#047857',
        }}>
          {error || okMsg}
        </div>
      )}

      {/* Add */}
      <div className="neon-card" style={{ padding: 20 }}>
        <h2 style={{ margin: '0 0 6px', color: '#0f172a', fontSize: 15, fontWeight: 800 }}>Add a favorite</h2>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8' }}>
          Send location_name + nickname — lat/lng optional (backend geocodes)
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Nickname
            <input
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              placeholder="Home"
              style={{ display: 'block', width: '100%', marginTop: 6, padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
            />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Location name
            <input
              value={form.location_name}
              onChange={(e) => setForm({ ...form, location_name: e.target.value })}
              list="favorite-presets"
              placeholder="Banjara Hills"
              style={{ display: 'block', width: '100%', marginTop: 6, padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
            />
            <datalist id="favorite-presets">
              {PRESETS.map((p) => <option key={p} value={p} />)}
            </datalist>
          </label>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setForm((f) => ({ ...f, location_name: p, nickname: f.nickname || p.split(',')[0] }))}
              style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99, cursor: 'pointer',
                border: form.location_name === p ? '1px solid rgba(59,130,246,0.4)' : '1px solid #e2e8f0',
                background: form.location_name === p ? 'rgba(59,130,246,0.08)' : '#f8fafc',
                color: form.location_name === p ? '#2563eb' : '#64748b',
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          onClick={() => void add()}
          className="btn-gradient"
          style={{ marginTop: 14, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}
        >
          Save favorite
        </button>
      </div>

      {/* Live status strip */}
      <div className="neon-card" style={{ padding: 20 }}>
        <h2 style={{ margin: '0 0 6px', color: '#0f172a', fontSize: 15, fontWeight: 800 }}>Live status</h2>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8' }}>
          GET /favorites/status · live ≤6h · stale ≤24h · older → unknown
        </p>
        {!status?.locations?.length ? (
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>No status rows yet — add a favorite first.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {status.locations.map((loc) => {
              const meta = statusMeta(loc);
              return (
                <div
                  key={loc.id}
                  style={{
                    padding: 14, borderRadius: 12,
                    border: `1px solid ${meta.color}33`,
                    background: `${meta.color}0a`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <p style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: 14 }}>{loc.name}</p>
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 99, textTransform: 'capitalize',
                      color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}33`,
                    }}>
                      {meta.label}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: 11, color: '#64748b' }}>{meta.hint}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: '#334155' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Gauge size={12} /> {loc.average_speed_kmh != null ? `${loc.average_speed_kmh} km/h` : '—'}
                    </span>
                    <span>{loc.vehicle_count != null ? `${loc.vehicle_count} vehicles` : '—'}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> {fmtWhen(loc.last_updated)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* List + rename */}
      <div className="neon-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: 15, fontWeight: 800 }}>Your favorites</h2>
        </div>
        {!favorites.length ? (
          <p style={{ padding: 20, margin: 0, color: '#94a3b8', fontSize: 13 }}>No saved locations yet.</p>
        ) : (
          favorites.map((favorite) => {
            const live = statusById.get(favorite.id);
            const traffic = live || favorite.traffic_status;
            const meta = statusMeta(traffic);
            return (
              <div
                key={favorite.id}
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                  background: `${meta.color}14`, border: `1px solid ${meta.color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MapPin size={16} color={meta.color} />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, color: '#0f172a', fontWeight: 800, fontSize: 14 }}>
                      {favorite.nickname || favorite.location_name}
                    </p>
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99, textTransform: 'capitalize',
                      color: meta.color, background: `${meta.color}14`, border: `1px solid ${meta.color}33`,
                    }}>
                      {meta.label}
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: 12 }}>
                    {favorite.location_name}
                    {favorite.latitude != null && favorite.longitude != null
                      ? ` · ${favorite.latitude.toFixed(4)}, ${favorite.longitude.toFixed(4)}`
                      : ''}
                  </p>
                  <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 11 }}>
                    {traffic && 'average_speed_kmh' in traffic && traffic.average_speed_kmh != null
                      ? `${traffic.average_speed_kmh} km/h · ${traffic.vehicle_count ?? 0} vehicles · updated ${fmtWhen(traffic.last_updated)}`
                      : meta.hint}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    value={editing[favorite.id] ?? ''}
                    onChange={(e) => setEditing({ ...editing, [favorite.id]: e.target.value })}
                    placeholder="New nickname"
                    style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, minWidth: 120 }}
                  />
                  <button
                    onClick={() => void update(favorite)}
                    className="btn-neon"
                    style={{ padding: '7px 10px', color: '#2563eb', borderRadius: 8, fontSize: 12, fontWeight: 700 }}
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => void remove(favorite.id)}
                    style={{
                      padding: '7px 10px', color: '#dc2626', background: '#fef2f2',
                      border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function StatCard({
  label, value, icon, color = '#0f172a',
}: {
  label: string;
  value: string;
  icon: ReactNode;
  color?: string;
}) {
  return (
    <div className="neon-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 900, color, letterSpacing: '-0.03em' }}>{value}</p>
      </div>
    </div>
  );
}
