'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  MapPinned, Search, RefreshCw, Clock, TrendingUp, TrendingDown, AlertCircle,
} from 'lucide-react';
import { areaApi } from '@/lib/api';
import type {
  AreaCityItem,
  AreaCompareData,
  AreaPredictData,
  AreaSearchItem,
} from '@/lib/types';

const PRESETS = ['Gachibowli', 'Hitech City', 'Ameerpet', 'Banjara Hills', 'Madhapur', 'Kondapur'];

function apiError(e: unknown) {
  const err = e as { response?: { data?: { error?: string; detail?: string } }; message?: string };
  return err.response?.data?.error || err.response?.data?.detail || err.message || 'Area request failed';
}

function congColor(level?: string | null) {
  const l = (level || '').toLowerCase();
  if (l === 'high' || l === 'critical') return '#ef4444';
  if (l === 'medium' || l === 'moderate') return '#f59e0b';
  if (l === 'low') return '#22c55e';
  return '#94a3b8';
}

function congScore(level?: string | null) {
  const l = (level || '').toLowerCase();
  if (l === 'high' || l === 'critical') return 85;
  if (l === 'medium' || l === 'moderate') return 55;
  if (l === 'low') return 22;
  return 0;
}

function areaName(item: AreaSearchItem | AreaCityItem | string) {
  if (typeof item === 'string') return item;
  return String(item.name ?? item.area ?? item.city ?? '');
}

export default function AreaPredictPage() {
  const [cities, setCities] = useState<AreaCityItem[]>([]);
  const [matches, setMatches] = useState<AreaSearchItem[]>([]);
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('Gachibowli');
  const [compareAreas, setCompareAreas] = useState('Gachibowli,Hitech City,Ameerpet');
  const [hours, setHours] = useState('12');
  const [prediction, setPrediction] = useState<AreaPredictData | null>(null);
  const [comparison, setComparison] = useState<AreaCompareData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const refreshCities = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await areaApi.cities();
      setCities(res.data.cities);
    } catch (e) {
      setError(apiError(e));
      setCities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refreshCities(); }, [refreshCities]);

  const search = async () => {
    if (!query.trim()) return;
    setBusy('search');
    setError('');
    try {
      const res = await areaApi.search(query.trim());
      setMatches(res.data.areas);
      if (!res.data.areas.length) setError('No areas matched — try a broader query after backend reload.');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy('');
    }
  };

  const predict = async () => {
    if (!area.trim()) {
      setError('Choose or enter an area first.');
      return;
    }
    setBusy('predict');
    setError('');
    try {
      const res = await areaApi.predict({ area: area.trim(), hours: Number(hours) || 12 });
      setPrediction(res.data);
    } catch (e) {
      setPrediction(null);
      setError(apiError(e));
    } finally {
      setBusy('');
    }
  };

  const compare = async () => {
    const areas = compareAreas.split(',').map((s) => s.trim()).filter(Boolean);
    if (areas.length < 2) {
      setError('Enter at least two comma-separated areas to compare.');
      return;
    }
    setBusy('compare');
    setError('');
    try {
      const res = await areaApi.compare({ areas: areas.join(','), hours: Number(hours) || 12 });
      setComparison(res.data);
    } catch (e) {
      setComparison(null);
      setError(apiError(e));
    } finally {
      setBusy('');
    }
  };

  const forecastBars = useMemo(
    () => (prediction?.forecast ?? []).map((f) => ({
      label: f.time_label,
      score: congScore(f.predicted_congestion),
      congestion: f.predicted_congestion,
      speed: f.avg_speed_kmh,
      confidence: Math.round((f.confidence ?? 0) * 100),
    })),
    [prediction],
  );

  const hourlyBars = useMemo(() => {
    const pattern = prediction?.hourly_pattern ?? {};
    return Array.from({ length: 24 }, (_, h) => {
      const bucket = pattern[String(h)];
      return {
        label: `${String(h).padStart(2, '0')}`,
        score: congScore(bucket?.congestion),
        congestion: bucket?.congestion || 'unknown',
        samples: bucket?.sample_size ?? 0,
        speed: bucket?.avg_speed_kmh,
      };
    });
  }, [prediction]);

  const weeklyBars = useMemo(() => {
    const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const pattern = prediction?.weekly_pattern ?? {};
    return order.map((day) => {
      const bucket = pattern[day];
      return {
        label: day.slice(0, 3),
        score: congScore(bucket?.congestion),
        congestion: bucket?.congestion || 'unknown',
        samples: bucket?.sample_size ?? 0,
        speed: bucket?.avg_speed_kmh,
      };
    });
  }, [prediction]);

  const current = prediction?.current;

  return (
    <div className="space-y-5">
      <div className="page-hero">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="neon-badge-blue" style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                ● Area Forecast
              </span>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Area Prediction
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.9)', marginTop: 4 }}>
              Hyperlocal 12-hour forecast, hourly/weekly patterns, and multi-area compare
            </p>
          </div>
          <button
            onClick={() => void refreshCities()}
            disabled={loading}
            className="btn-neon flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ color: '#2563eb' }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh cities
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca',
          color: '#b91c1c', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Search + cities */}
      <div className="neon-card" style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Search areas
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void search(); }}
              placeholder="Search a city or neighbourhood"
              style={{ display: 'block', width: '100%', marginTop: 6, padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
            />
          </label>
          <button onClick={() => void search()} disabled={busy === 'search'} className="btn-gradient" style={{ padding: '9px 15px', borderRadius: 10, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Search size={14} /> {busy === 'search' ? '…' : 'Search'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {(matches.length ? matches.map(areaName) : PRESETS).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setArea(name)}
              className="btn-neon"
              style={{
                padding: '6px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                color: area === name ? '#2563eb' : '#64748b',
                border: area === name ? '1px solid rgba(59,130,246,0.4)' : '1px solid #e2e8f0',
                background: area === name ? 'rgba(59,130,246,0.08)' : '#fff',
              }}
            >
              {name}
            </button>
          ))}
        </div>
        {cities.length > 0 && (
          <div style={{ marginTop: 16, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>
              Cities ({cities.length})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {cities.slice(0, 24).map((c, i) => {
                const name = areaName(c) || `City ${i + 1}`;
                const score = c.health_score;
                return (
                  <span
                    key={`${name}-${i}`}
                    style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
                      background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569',
                    }}
                  >
                    {name}{score == null ? '' : ` · ${Math.round(Number(score))}`}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="neon-card" style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Primary area
            <input value={area} onChange={(e) => setArea(e.target.value)} list="area-presets" style={{ display: 'block', width: '100%', marginTop: 6, padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Forecast hours
            <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 6, padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Compare areas (comma-separated)
            <input value={compareAreas} onChange={(e) => setCompareAreas(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 6, padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
          </label>
          <datalist id="area-presets">
            {PRESETS.map((p) => <option key={p} value={p} />)}
          </datalist>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button onClick={() => void predict()} disabled={busy === 'predict'} className="btn-gradient" style={{ padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <MapPinned size={14} /> {busy === 'predict' ? 'Predicting…' : 'Predict area'}
          </button>
          <button onClick={() => void compare()} disabled={busy === 'compare'} className="btn-neon" style={{ padding: '9px 16px', borderRadius: 10, color: '#2563eb', fontSize: 13, fontWeight: 700 }}>
            {busy === 'compare' ? 'Comparing…' : 'Compare areas'}
          </button>
        </div>
      </div>

      {/* Prediction results */}
      {prediction && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <Stat label="Area" value={prediction.area} sub={prediction.city || '—'} />
            <Stat
              label="Current"
              value={current?.congestion_level || '—'}
              sub={`${current?.avg_speed_kmh ?? '—'} km/h · ${current?.data_source || '—'}`}
              color={congColor(current?.congestion_level)}
            />
            <Stat
              label="Best travel"
              value={prediction.best_travel_time?.time_label || '—'}
              sub={`${prediction.best_travel_time?.predicted_congestion || '—'} · ${prediction.best_travel_time?.avg_speed_kmh ?? '—'} km/h`}
              color="#16a34a"
              icon={<TrendingDown size={14} color="#16a34a" />}
            />
            <Stat
              label="Worst travel"
              value={prediction.worst_travel_time?.time_label || '—'}
              sub={`${prediction.worst_travel_time?.predicted_congestion || '—'} · ${prediction.worst_travel_time?.avg_speed_kmh ?? '—'} km/h`}
              color="#ef4444"
              icon={<TrendingUp size={14} color="#ef4444" />}
            />
          </div>

          {prediction.recommendation && (
            <div className="neon-card" style={{ padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Clock size={16} color="#3b82f6" style={{ marginTop: 2 }} />
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Recommendation</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{prediction.recommendation}</p>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8' }}>
                  Peak: {prediction.peak_hours || '—'} · history used: {prediction.historical_records_used ?? 0}
                  {current?.data_age_minutes != null ? ` · data age ${Number(current.data_age_minutes).toFixed(0)} min` : ''}
                </p>
              </div>
            </div>
          )}

          <div className="neon-card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>12-hour forecast</h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8' }}>Local clock labels · sparse history no longer flattens everything to “all low”</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={forecastBars} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, fontSize: 12, color: '#f1f5f9' }}
                  formatter={(v, _n, item) => {
                    const p = item?.payload as { congestion?: string; speed?: number; confidence?: number };
                    return [`${p?.congestion} · ${p?.speed ?? '—'} km/h · ${p?.confidence ?? 0}% conf`, 'Forecast'];
                  }}
                />
                <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                  {forecastBars.map((row, i) => (
                    <Cell key={i} fill={congColor(row.congestion)} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 14 }}>
            <div className="neon-card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Hourly pattern</h3>
              <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8' }}>Unknown hours stay empty (sample_size 0)</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={hourlyBars} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', borderRadius: 8, fontSize: 12, color: '#f1f5f9', border: '1px solid rgba(59,130,246,0.3)' }}
                    formatter={(_v, _n, item) => {
                      const p = item?.payload as { congestion?: string; samples?: number; speed?: number | null };
                      return [`${p?.congestion} · n=${p?.samples} · ${p?.speed ?? '—'} km/h`, 'Hour'];
                    }}
                  />
                  <Bar dataKey="score" radius={[2, 2, 0, 0]}>
                    {hourlyBars.map((row, i) => (
                      <Cell key={i} fill={row.samples ? congColor(row.congestion) : '#e2e8f0'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="neon-card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Weekly pattern</h3>
              <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8' }}>Day-of-week congestion</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={weeklyBars} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', borderRadius: 8, fontSize: 12, color: '#f1f5f9', border: '1px solid rgba(59,130,246,0.3)' }}
                    formatter={(_v, _n, item) => {
                      const p = item?.payload as { congestion?: string; samples?: number; speed?: number | null };
                      return [`${p?.congestion} · n=${p?.samples} · ${p?.speed ?? '—'} km/h`, 'Day'];
                    }}
                  />
                  <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                    {weeklyBars.map((row, i) => (
                      <Cell key={i} fill={row.samples ? congColor(row.congestion) : '#e2e8f0'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Compare */}
      {comparison && (
        <div className="neon-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Area comparison</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                {comparison.areas_compared} areas · best: {comparison.best_area || '—'} · worst: {comparison.worst_area || '—'}
              </p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {(comparison.results ?? []).map((row) => (
              <div
                key={row.area}
                style={{
                  padding: 14, borderRadius: 12,
                  border: row.error ? '1px solid #fecaca' : '1px solid #e2e8f0',
                  background: row.error ? '#fef2f2' : '#f8fafc',
                }}
              >
                <p style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: 14 }}>{row.area}</p>
                {row.error ? (
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#b91c1c', lineHeight: 1.45 }}>{row.error}</p>
                ) : (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <Chip label={String(row.congestion_level || '—')} color={congColor(String(row.congestion_level))} />
                    <Chip label={`${row.avg_speed_kmh ?? '—'} km/h`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Stat({
  label, value, sub, color = '#0f172a', icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="neon-card" style={{ padding: '14px 16px' }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}{label}
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 900, color, letterSpacing: '-0.03em', textTransform: 'capitalize' }}>{value}</p>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>{sub}</p>}
    </div>
  );
}

function Chip({ label, color = '#64748b' }: { label: string; color?: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, textTransform: 'capitalize',
      color, background: `${color}14`, border: `1px solid ${color}33`,
    }}>
      {label}
    </span>
  );
}
