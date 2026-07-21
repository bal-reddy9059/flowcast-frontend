'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Timer, MapPin, Gauge, Car, Footprints, Bus, Zap, TrendingUp, TrendingDown, Search,
} from 'lucide-react';
import { etaApi } from '@/lib/api';
import { ApiPageShell, Field, StatPill } from '@/components/ui/ApiPageShell';
import type {
  EtaBatchResponse,
  EtaCompareResponse,
  EtaLocationsResponse,
  EtaResult,
} from '@/lib/types';

const DEFAULT_BATCH = ['Whitefield', 'Marathahalli', 'Bellandur', 'Electronic City'];
const MODES = ['driving', 'transit', 'walking'] as const;

function errorText(error: unknown) {
  const axiosErr = error as { response?: { data?: { detail?: string } }; message?: string };
  return axiosErr.response?.data?.detail || axiosErr.message || 'Unable to reach the ETA service.';
}

function congColor(level?: string) {
  const l = (level || '').toLowerCase();
  if (l === 'high' || l === 'critical') return '#ef4444';
  if (l === 'medium' || l === 'moderate') return '#f59e0b';
  return '#22c55e';
}

function fmtMins(v?: number) {
  if (v == null || Number.isNaN(v)) return '—';
  if (v >= 60) {
    const h = Math.floor(v / 60);
    const m = Math.round(v % 60);
    return `${h}h ${m}m`;
  }
  return `${Number(v).toFixed(v >= 10 ? 0 : 1)} min`;
}

function fmtTime(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function ModeIcon({ mode }: { mode: string }) {
  if (mode === 'walking') return <Footprints size={16} color="#8b5cf6" />;
  if (mode === 'transit') return <Bus size={16} color="#0ea5e9" />;
  return <Car size={16} color="#3b82f6" />;
}

export default function EtaPage() {
  const [form, setForm] = useState({
    location: 'Hitech City',
    distance_km: '23',
    mode: 'driving',
  });
  const [batchLocations, setBatchLocations] = useState(DEFAULT_BATCH.join(', '));
  const [batchDistance, setBatchDistance] = useState('24.3');

  const [result, setResult] = useState<EtaResult | null>(null);
  const [comparison, setComparison] = useState<EtaCompareResponse | null>(null);
  const [batch, setBatch] = useState<EtaBatchResponse | null>(null);
  const [locMeta, setLocMeta] = useState<EtaLocationsResponse | null>(null);

  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const loadLocations = useCallback(async () => {
    try {
      const res = await etaApi.locations();
      setLocMeta(res.data);
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const filteredLocations = useMemo(() => {
    const list = locMeta?.locations ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list.slice(0, 40);
    return list.filter((l) => l.toLowerCase().includes(q)).slice(0, 40);
  }, [locMeta, query]);

  const getEta = async () => {
    if (!form.location.trim()) {
      setError('Enter a location name (e.g. Hitech City).');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = {
        location: form.location.trim(),
        distance_km: Number(form.distance_km) || 10,
        mode: form.mode,
      };
      const [eta, compare] = await Promise.all([
        etaApi.get(params),
        etaApi.compare(params),
      ]);
      setResult(eta.data);
      setComparison(compare.data);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };

  const runBatch = async () => {
    const locations = batchLocations
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!locations.length) {
      setError('Add at least one location for batch ETA.');
      return;
    }
    setBatchLoading(true);
    setError('');
    try {
      const res = await etaApi.batch(
        locations.map((location) => ({
          location,
          distance_km: Number(batchDistance) || 10,
          mode: 'driving',
        })),
      );
      setBatch(res.data);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <ApiPageShell
      title="ETA Calculator"
      subtitle="Real-time ETA for Indian cities using live congestion data."
      badge="LIVE ETA"
      onRefresh={loadLocations}
      loading={loading || batchLoading}
    >
      {/* ── Calculator ─────────────────────────────────────────── */}
      <div className="neon-card" style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Field
            label="Location"
            value={form.location}
            onChange={(location) => setForm({ ...form, location })}
            placeholder="e.g. Hitech City"
          />
          <Field
            label="Distance (km)"
            type="number"
            value={form.distance_km}
            onChange={(distance_km) => setForm({ ...form, distance_km })}
          />
          <Field
            label="Mode"
            value={form.mode}
            onChange={(mode) => setForm({ ...form, mode })}
            options={[...MODES]}
          />
        </div>
        <button
          onClick={() => void getEta()}
          disabled={loading}
          className="btn-gradient"
          style={{
            marginTop: 16,
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            opacity: loading ? 0.65 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Timer size={15} />
          {loading ? 'Calculating…' : 'Calculate ETA'}
        </button>
        {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '12px 0 0' }}>{error}</p>}
      </div>

      {/* ── Single ETA stats ───────────────────────────────────── */}
      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatPill label="ETA" value={fmtMins(result.eta_minutes)} />
            <StatPill label="With buffer" value={fmtMins(result.eta_with_buffer_minutes)} color="#8b5cf6" />
            <StatPill label="Avg speed" value={`${result.average_speed_kmh ?? '—'} km/h`} color="#0ea5e9" />
            <StatPill
              label="Arrival"
              value={fmtTime(result.arrival_time)}
              color="#f59e0b"
            />
          </div>

          <div className="neon-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <MapPin size={16} color="#3b82f6" />
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{result.location}</h2>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                  {result.traffic_condition || 'Traffic condition unavailable'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
                  color: congColor(result.congestion_level),
                  background: `${congColor(result.congestion_level)}14`,
                  border: `1px solid ${congColor(result.congestion_level)}33`,
                  textTransform: 'capitalize',
                }}>
                  {result.congestion_level} congestion
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
                  color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0',
                  textTransform: 'capitalize',
                }}>
                  {result.confidence} confidence
                </span>
                {result.vehicle_count != null && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
                    color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0',
                  }}>
                    {result.vehicle_count} vehicles
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 16 }}>
              <Meta label="Distance" value={`${result.distance_km} km`} />
              <Meta label="Data age" value={`${Number(result.data_age_minutes ?? 0).toFixed(1)} min`} />
              <Meta label="Calculated" value={fmtTime(result.calculated_at)} />
            </div>
          </div>
        </>
      )}

      {/* ── Mode comparison ────────────────────────────────────── */}
      {comparison?.modes && (
        <div className="neon-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Mode comparison</h2>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                {comparison.location} · {comparison.distance_km} km
              </p>
            </div>
            {comparison.recommended_mode && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 99,
                background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.25)',
                textTransform: 'capitalize',
              }}>
                <Zap size={12} /> Recommended: {comparison.recommended_mode}
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {Object.entries(comparison.modes).map(([mode, m]) => {
              const recommended = comparison.recommended_mode === mode;
              return (
                <div
                  key={mode}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    border: recommended ? '1.5px solid rgba(34,197,94,0.35)' : '1px solid #e2e8f0',
                    background: recommended ? 'rgba(34,197,94,0.04)' : '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <ModeIcon mode={mode} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', textTransform: 'capitalize' }}>{mode}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.04em' }}>
                    {fmtMins(m.eta_minutes)}
                  </p>
                  <p style={{ margin: '4px 0 10px', fontSize: 11, color: '#94a3b8' }}>
                    buffer {fmtMins(m.eta_with_buffer_minutes)} · arrive {fmtTime(m.arrival_time)}
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Chip color={congColor(m.congestion_level)}>{m.congestion_level}</Chip>
                    <Chip color="#64748b">{m.average_speed_kmh} km/h</Chip>
                    <Chip color="#64748b">{m.confidence}</Chip>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Batch ETA ──────────────────────────────────────────── */}
      <div className="neon-card" style={{ padding: 20 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Batch ETA</h2>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748b' }}>
          Compare multiple destinations in one request (POST /traffic/eta/batch).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Locations (comma-separated)
            <textarea
              value={batchLocations}
              onChange={(e) => setBatchLocations(e.target.value)}
              rows={2}
              style={{
                padding: 10, borderRadius: 10, border: '1px solid #e2e8f0',
                fontSize: 13, color: '#0f172a', background: '#fff', resize: 'vertical',
              }}
            />
          </label>
          <Field
            label="Distance (km)"
            type="number"
            value={batchDistance}
            onChange={setBatchDistance}
          />
        </div>
        <button
          onClick={() => void runBatch()}
          disabled={batchLoading}
          className="btn-neon"
          style={{
            marginTop: 12, padding: '9px 16px', borderRadius: 9,
            color: '#2563eb', fontSize: 13, fontWeight: 700,
            opacity: batchLoading ? 0.65 : 1,
          }}
        >
          {batchLoading ? 'Running…' : 'Run batch'}
        </button>

        {batch && (
          <div style={{ marginTop: 18 }}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ marginBottom: 14 }}>
              <MiniStat label="Locations" value={String(batch.total_locations)} />
              <MiniStat
                label="Fastest"
                value={batch.fastest_location || '—'}
                icon={<TrendingUp size={12} color="#16a34a" />}
                color="#16a34a"
              />
              <MiniStat
                label="Slowest"
                value={batch.slowest_location || '—'}
                icon={<TrendingDown size={12} color="#ef4444" />}
                color="#ef4444"
              />
              <MiniStat label="Avg ETA" value={fmtMins(batch.average_eta_minutes)} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(batch.results ?? []).map((row) => (
                <div
                  key={row.location}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 11,
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 140 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{row.location}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>
                      {row.traffic_condition || row.congestion_level}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em' }}>
                        {fmtMins(row.eta_minutes)}
                      </p>
                      <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>arrive {fmtTime(row.arrival_time)}</p>
                    </div>
                    <Chip color={congColor(row.congestion_level)}>{row.congestion_level}</Chip>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Gauge size={12} /> {row.average_speed_kmh} km/h
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Locations browser ──────────────────────────────────── */}
      <div className="neon-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Supported locations</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
              {locMeta?.total != null ? `${locMeta.total} locations` : 'Loading…'}
              {locMeta?.city_level_supported?.length ? ` · ${locMeta.city_level_supported.length} city shortcuts` : ''}
            </p>
          </div>
          <div style={{ position: 'relative', minWidth: 220, flex: 1, maxWidth: 320 }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search locations…"
              style={{
                width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10,
                border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a', background: '#fff',
              }}
            />
          </div>
        </div>

        {locMeta?.city_level_supported && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {locMeta.city_level_supported.slice(0, 24).map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setForm((f) => ({ ...f, location: city }))}
                style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
                  border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer',
                }}
              >
                {city}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
          {filteredLocations.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
              {locMeta ? 'No locations match your search.' : 'Locations will appear once the backend responds.'}
            </p>
          ) : (
            filteredLocations.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => {
                  setForm((f) => ({ ...f, location: loc }));
                  setQuery('');
                }}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 8,
                  border: form.location === loc ? '1px solid rgba(59,130,246,0.4)' : '1px solid #e2e8f0',
                  background: form.location === loc ? 'rgba(59,130,246,0.08)' : '#fff',
                  color: form.location === loc ? '#2563eb' : '#334155',
                  cursor: 'pointer',
                }}
              >
                {loc}
              </button>
            ))
          )}
        </div>
        {locMeta?.message && (
          <p style={{ margin: '14px 0 0', fontSize: 11, color: '#94a3b8' }}>{locMeta.message}</p>
        )}
      </div>
    </ApiPageShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{value}</p>
    </div>
  );
}

function Chip({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
      color, background: `${color}14`, border: `1px solid ${color}33`,
      textTransform: 'capitalize',
    }}>
      {children}
    </span>
  );
}

function MiniStat({
  label, value, color = '#0f172a', icon,
}: {
  label: string;
  value: string;
  color?: string;
  icon?: ReactNode;
}) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon}{label}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 800, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </p>
    </div>
  );
}
