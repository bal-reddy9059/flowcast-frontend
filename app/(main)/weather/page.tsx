'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Cloud, Sun, CloudRain, Wind, Droplets,
  Eye, MapPin, AlertTriangle, RefreshCw, Search, Thermometer,
} from 'lucide-react';
import { weatherApi } from '@/lib/api';
import type {
  WeatherCityIdEntry,
  WeatherCitySnapshot,
  WeatherImpactData,
  WeatherStatusData,
} from '@/lib/types';

const MODIFIER_FLOAT: Record<string, number> = {
  none: 0,
  light: 0.1,
  moderate: 0.3,
  severe: 0.5,
};

type FilterKey = 'all' | 'rain' | 'clear' | 'impact';

type UiCity = {
  city_id: string;
  city: string;
  condition: string;
  temp: number;
  humidity: number;
  wind: number;
  visibility: number;
  rain_mm: number;
  congestionModifier: number;
  congestion_modifier: string;
  alert_level: string;
  impact_advice: string;
  modifier_label: string;
  tips: string[];
  source?: string;
  bump?: number;
};

function apiError(e: unknown) {
  const err = e as {
    response?: { data?: { error?: string; detail?: string | { message?: string }; details?: { message?: string } } };
    message?: string;
  };
  const d = err.response?.data;
  if (typeof d?.detail === 'object' && d.detail?.message) return d.detail.message;
  return d?.error || (typeof d?.detail === 'string' ? d.detail : undefined) || d?.details?.message || err.message || 'Weather request failed';
}

function normalizeCity(raw: WeatherCitySnapshot): UiCity {
  const modifier = String(raw.congestion_modifier ?? 'none').toLowerCase();
  return {
    city_id: String(raw.city_id ?? ''),
    city: String(raw.city ?? 'Unknown'),
    condition: String(raw.condition ?? 'Unknown'),
    temp: Number(raw.temp ?? raw.temp_c ?? 0),
    humidity: Number(raw.humidity ?? 0),
    wind: Number(raw.wind ?? raw.wind_kmh ?? 0),
    visibility: Number(raw.visibility ?? raw.visibility_km ?? 0),
    rain_mm: Number(raw.rain_mm_1h ?? 0),
    congestionModifier: Number(
      raw.congestionModifier ?? MODIFIER_FLOAT[modifier] ?? 0,
    ),
    congestion_modifier: modifier,
    alert_level: String(raw.alert_level ?? 'normal'),
    impact_advice: String(raw.impact_advice ?? ''),
    modifier_label: String(raw.modifier_label ?? ''),
    tips: Array.isArray(raw.tips) ? raw.tips.map(String) : [],
    source: raw.source,
    bump: raw.congestion_bump_levels,
  };
}

function WeatherIcon({ condition, size = 22 }: { condition: string; size?: number }) {
  const c = condition.toLowerCase();
  if (c.includes('rain') || c.includes('thunder') || c.includes('drizzle')) return <CloudRain size={size} />;
  if (c.includes('cloud')) return <Cloud size={size} />;
  if (c.includes('fog') || c.includes('haze') || c.includes('wind')) return <Wind size={size} />;
  if (c === 'unknown') return <Cloud size={size} />;
  return <Sun size={size} />;
}

function condColors(cond: string) {
  const c = cond.toLowerCase();
  if (c.includes('thunder') || c.includes('heavy'))
    return { accent: '#60a5fa', glow: 'rgba(96,165,250,0.3)' };
  if (c.includes('rain') || c.includes('drizzle'))
    return { accent: '#7dd3fc', glow: 'rgba(125,211,252,0.25)' };
  if (c.includes('cloud') || c.includes('haze') || c.includes('fog'))
    return { accent: '#94a3b8', glow: 'rgba(148,163,184,0.2)' };
  return { accent: '#fbbf24', glow: 'rgba(251,191,36,0.3)' };
}

function impactMeta(modifier: string, floatVal: number) {
  const m = modifier.toLowerCase();
  if (m === 'severe' || floatVal >= 0.35)
    return { label: 'Severe Impact', color: '#ef4444', pct: Math.round(Math.max(floatVal, 0.5) * 100) };
  if (m === 'moderate' || floatVal >= 0.15)
    return { label: 'Moderate Impact', color: '#f59e0b', pct: Math.round(Math.max(floatVal, 0.3) * 100) };
  if (m === 'light' || floatVal >= 0.05)
    return { label: 'Mild Impact', color: '#3b82f6', pct: Math.round(Math.max(floatVal, 0.1) * 100) };
  return { label: 'No Impact', color: '#10b981', pct: 0 };
}

export default function WeatherPage() {
  const [cities, setCities] = useState<UiCity[]>([]);
  const [directory, setDirectory] = useState<WeatherCityIdEntry[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [warming, setWarming] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<WeatherStatusData | null>(null);
  const [summary, setSummary] = useState({ severe: 0, moderate: 0, light: 0, clear: 0, alert: 'normal' });
  const [locationQuery, setLocationQuery] = useState('Gachibowli');
  const [impact, setImpact] = useState<WeatherImpactData | null>(null);
  const [impactBusy, setImpactBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);

  const selected = useMemo(
    () => cities.find((c) => c.city_id === selectedId) ?? cities[0] ?? null,
    [cities, selectedId],
  );

  const cc = condColors(selected?.condition ?? 'Clear');
  const imp = impactMeta(selected?.congestion_modifier ?? 'none', selected?.congestionModifier ?? 0);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    setWarming('');
    try {
      const [citiesRes, idsRes, statusRes] = await Promise.all([
        weatherApi.cities(),
        weatherApi.cityIds(),
        weatherApi.status(),
      ]);

      setStatus(statusRes.data);
      setDirectory(idsRes.data.cities ?? []);

      const payload = citiesRes.data;
      if (payload.message && (!payload.cities || payload.cities.length === 0)) {
        setWarming(payload.message);
        setCities([]);
      } else {
        const rows = (payload.cities ?? []).map(normalizeCity);
        setCities(rows);
        setSummary({
          severe: payload.severe_impact ?? 0,
          moderate: payload.moderate_impact ?? 0,
          light: payload.light_impact ?? 0,
          clear: payload.clear_cities ?? 0,
          alert: payload.network_alert ?? 'normal',
        });
        setSelectedId((prev) => {
          if (prev && rows.some((r) => r.city_id === prev)) return prev;
          return rows[0]?.city_id ?? '';
        });
      }
    } catch (e) {
      setError(apiError(e));
      setCities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchAll(false); }, [fetchAll]);

  /** Enrich selected city with /city/{id} tips + modifier_label */
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      setDetailBusy(true);
      try {
        const res = await weatherApi.city(selectedId);
        if (cancelled) return;
        const detail = normalizeCity(res.data);
        setCities((prev) => prev.map((c) => (c.city_id === detail.city_id ? { ...c, ...detail } : c)));
      } catch {
        /* list row still usable; cache may still be warming */
      } finally {
        if (!cancelled) setDetailBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  const lookupImpact = async () => {
    if (!locationQuery.trim()) return;
    setImpactBusy(true);
    setError('');
    try {
      const res = await weatherApi.impact({ location: locationQuery.trim() });
      setImpact(res.data);
      if (res.data.city_id) {
        setSelectedId(String(res.data.city_id));
      }
    } catch (e) {
      setError(apiError(e));
    } finally {
      setImpactBusy(false);
    }
  };

  const shown = cities.filter((c) => {
    const cond = c.condition.toLowerCase();
    if (filter === 'rain') return cond.includes('rain') || cond.includes('thunder') || cond.includes('drizzle');
    if (filter === 'clear') return cond.includes('clear') || cond.includes('sunny') || cond === 'partly cloudy';
    if (filter === 'impact') return c.congestion_modifier !== 'none' && c.congestionModifier > 0;
    return true;
  });

  const tips = selected?.tips?.length
    ? selected.tips
    : selected?.impact_advice
      ? [selected.impact_advice]
      : ['Conditions are good for travel.'];

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Hero */}
      <div className="page-hero" style={{ padding: '30px 36px', minHeight: 220 }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 240, height: 240, borderRadius: '50%', background: `radial-gradient(circle, ${cc.glow} 0%, transparent 70%)`, animation: 'glow-pulse 4s ease-in-out infinite' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="icon-glow icon-glow-blue" style={{ width: 26, height: 26, borderRadius: 7 }}>
                  <MapPin size={13} style={{ color: '#60a5fa' }} />
                </div>
                <span style={{ fontSize: 12.5, color: '#60a5fa', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Weather Impact
                </span>
              </div>
              <h1 className="gradient-text-neon" style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em', margin: 0, lineHeight: 1 }}>
                {selected?.city ?? (loading ? 'Loading…' : 'No cities')}
              </h1>
              <p style={{ fontSize: 16, color: '#94a3b8', marginTop: 6 }}>
                {selected?.condition ?? '—'}
                {detailBusy ? ' · updating…' : ''}
              </p>

              {selected && (
                <div className="flex items-center gap-6 mt-5 flex-wrap">
                  {[
                    { icon: <Droplets size={13} />, label: 'Humidity', value: `${selected.humidity}%`, glowClass: 'icon-glow-blue' },
                    { icon: <Wind size={13} />, label: 'Wind', value: `${selected.wind} km/h`, glowClass: 'icon-glow-purple' },
                    { icon: <Eye size={13} />, label: 'Visibility', value: `${selected.visibility} km`, glowClass: 'icon-glow-green' },
                    { icon: <AlertTriangle size={13} />, label: 'Traffic Impact', value: imp.label, glowClass: 'icon-glow-orange' },
                  ].map(({ icon, label, value, glowClass }) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className={`icon-glow ${glowClass}`} style={{ width: 26, height: 26, borderRadius: 7 }}>
                        {icon}
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{label}</p>
                        <p style={{ fontSize: 12.5, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selected && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: cc.accent, float: 'right', animation: 'float 4s ease-in-out infinite' }}>
                  <WeatherIcon condition={selected.condition} size={52} />
                </div>
                <p style={{ fontSize: 56, fontWeight: 900, color: '#f1f5f9', lineHeight: 1, letterSpacing: '-0.05em', marginTop: 12, clear: 'both' }}>
                  {Math.round(selected.temp)}°
                </p>
                {selected.rain_mm > 0 && (
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 0' }}>{selected.rain_mm} mm rain/h</p>
                )}
              </div>
            )}
          </div>

          {selected && selected.congestionModifier > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  {selected.modifier_label || 'Congestion modifier'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, color: imp.color }}>+{imp.pct}%</span>
              </div>
              <div className={`progress-neon${imp.color === '#ef4444' ? '-red' : imp.color === '#f59e0b' ? '-orange' : ''}`}>
                <div style={{ width: `${imp.pct}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status strip */}
      {status && (
        <div className="neon-card" style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span className={status.owm_configured ? 'neon-badge-green' : 'neon-badge-blue'} style={{ fontSize: 11, fontWeight: 700 }}>
              {status.data_source === 'simulated' ? 'Simulated' : 'Live OWM'}
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {status.cities_cached}/{status.cities_monitored} cached · refresh every {status.refresh_interval_minutes ?? 30}m
            </span>
            {!status.owm_configured && (
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                Set OPENWEATHERMAP_API_KEY for live data
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: 11, fontWeight: 700, color: '#64748b' }}>
            <span>⚠ {summary.severe} severe</span>
            <span>· {summary.moderate} mod</span>
            <span>· {summary.light} light</span>
            <span>· {summary.clear} clear</span>
          </div>
        </div>
      )}

      {warming && (
        <div style={{ padding: '12px 14px', borderRadius: 11, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{warming}</span>
          <button onClick={() => void fetchAll(true)} className="btn-neon" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
            Retry
          </button>
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 11, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Location impact */}
      <div className="neon-card" style={{ padding: 18 }}>
        <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
          Area → city impact
        </p>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#94a3b8' }}>
          Gachibowli, Hitech City, Silk Board, etc. resolve to monitored cities
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
          <input
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void lookupImpact(); }}
            placeholder="e.g. Gachibowli or Silk Board Junction"
            style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
          />
          <button
            onClick={() => void lookupImpact()}
            disabled={impactBusy}
            className="btn-gradient"
            style={{ padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Search size={14} /> {impactBusy ? '…' : 'Lookup'}
          </button>
        </div>
        {impact && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                  {impact.location}
                  {impact.city ? ` → ${impact.city}` : ''}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                  {impact.condition} · {impact.congestion_modifier} · alert {impact.alert_level}
                </p>
              </div>
              <span
                className={
                  impact.congestion_modifier === 'severe' ? 'neon-badge-red'
                    : impact.congestion_modifier === 'none' ? 'neon-badge-green'
                      : 'neon-badge-blue'
                }
                style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}
              >
                {impact.congestion_modifier}
              </span>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 13, color: '#475569', lineHeight: 1.45 }}>
              {impact.impact_advice || impact.modifier_label}
            </p>
            {(impact.tips?.length ?? 0) > 0 && (
              <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12, color: '#64748b' }}>
                {impact.tips!.map((t) => <li key={t} style={{ marginBottom: 4 }}>{t}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'rain', 'clear', 'impact'] as FilterKey[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={filter === f ? 'btn-gradient' : 'btn-neon'}
              style={{ padding: '7px 15px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}
            >
              {f === 'impact' ? 'Has Impact' : f === 'all' ? 'All Cities' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => void fetchAll(true)}
          disabled={refreshing}
          className="btn-neon"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', opacity: refreshing ? 0.6 : 1 }}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* City grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))', gap: 12 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 14 }} />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="neon-card" style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
          {warming
            ? 'Cache is warming — retry in ~30s (or after backend on-demand seed).'
            : 'No cities match this filter.'}
          {!warming && directory.length > 0 && (
            <p style={{ marginTop: 8, fontSize: 12 }}>
              Directory has {directory.length} city IDs ready — refresh once cache is seeded.
            </p>
          )}
        </div>
      ) : (
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))', gap: 12 }}>
          {shown.map((city) => {
            const colors = condColors(city.condition);
            const im = impactMeta(city.congestion_modifier, city.congestionModifier);
            const isActive = city.city_id === selected?.city_id;
            return (
              <div
                key={city.city_id || city.city}
                onClick={() => setSelectedId(city.city_id)}
                className="neon-card"
                style={{
                  cursor: 'pointer',
                  border: isActive ? '2px solid #3b82f6' : undefined,
                  boxShadow: isActive ? '0 0 20px rgba(59,130,246,0.35)' : undefined,
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', margin: 0 }}>{city.city}</p>
                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{city.condition}</p>
                  </div>
                  <div className="icon-glow icon-glow-blue" style={{ width: 32, height: 32, borderRadius: 9 }}>
                    <span style={{ color: colors.accent }}>
                      <WeatherIcon condition={city.condition} size={16} />
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Thermometer size={14} color="#94a3b8" />
                    {Math.round(city.temp)}°C
                  </span>
                  <span
                    className={im.color === '#ef4444' ? 'neon-badge-red' : im.color === '#10b981' ? 'neon-badge-green' : 'neon-badge-blue'}
                    style={{ fontSize: 10.5 }}
                  >
                    {im.label}
                  </span>
                </div>
                {city.congestionModifier > 0.05 && (
                  <div style={{ marginTop: 10 }}>
                    <div className="progress-neon" style={{ height: 4 }}>
                      <div style={{ width: `${im.pct}%` }} />
                    </div>
                    <p style={{ fontSize: 10, color: '#94a3b8', margin: '4px 0 0' }}>+{im.pct}% congestion</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tips */}
      {selected && (
        <div className="neon-card" style={{ padding: '22px 26px' }}>
          <h2 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
            Travel tips for <span className="gradient-text">{selected.city}</span>
          </h2>
          {selected.impact_advice && (
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px' }}>{selected.impact_advice}</p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
            {tips.map((tip, i) => (
              <div
                key={`${tip}-${i}`}
                className="glass-neon"
                style={{ display: 'flex', gap: 12, padding: '13px 15px', borderRadius: 11, animation: `slideUp 0.4s ease both`, animationDelay: `${i * 0.06}s` }}
              >
                <div className="icon-glow icon-glow-blue" style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }}>
                  <AlertTriangle size={13} color="#3b82f6" />
                </div>
                <p style={{ fontSize: 12.5, color: '#334155', margin: 0, lineHeight: 1.45 }}>{tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
