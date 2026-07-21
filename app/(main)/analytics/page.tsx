'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Cell,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Activity, TrendingUp, MapPin, Zap, RefreshCw,
  ArrowUpRight, ArrowDownRight, AlertTriangle, Minus,
} from 'lucide-react';
import { analyticsApi } from '@/lib/api';
import { useSearchParams } from 'next/navigation';
import type {
  AnalyticsCityHealthRow,
  AnalyticsHealthData,
  AnalyticsLocationData,
  AnalyticsSnapshotData,
  AnalyticsTimelapseData,
  AnalyticsTimelapseSnapshot,
} from '@/lib/types';

type TrendRow = {
  time: string;
  congestion: number | null;
  vehicles: number;
  has_data: boolean;
};

function healthPalette(score: number | null | undefined) {
  if (score == null) {
    return {
      bar: '#94a3b8',
      bg: 'rgba(148,163,184,0.08)',
      text: '#94a3b8',
      border: 'rgba(148,163,184,0.2)',
      progressClass: '',
    };
  }
  if (score >= 80) return { bar: '#10b981', bg: 'rgba(16,185,129,0.08)', text: '#10b981', border: 'rgba(16,185,129,0.2)', progressClass: 'progress-neon-green' };
  if (score >= 60) return { bar: '#f59e0b', bg: 'rgba(245,158,11,0.08)', text: '#f59e0b', border: 'rgba(245,158,11,0.2)', progressClass: 'progress-neon-orange' };
  return { bar: '#ef4444', bg: 'rgba(239,68,68,0.08)', text: '#ef4444', border: 'rgba(239,68,68,0.2)', progressClass: 'progress-neon-red' };
}

function congColor(level?: string) {
  const l = (level || '').toLowerCase();
  if (l === 'high') return '#ef4444';
  if (l === 'medium') return '#f59e0b';
  if (l === 'low') return '#22c55e';
  return '#94a3b8';
}

function fmtUpdated(iso?: string) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  iconClass: string;
  change?: string;
  changeUp?: boolean;
}

function KpiCard({ label, value, sub, icon, iconClass, change, changeUp }: KpiCardProps) {
  return (
    <div className="neon-card" style={{ padding: '18px 20px' }}>
      <div className="flex items-start justify-between mb-4">
        <div className={`icon-glow ${iconClass}`} style={{ width: 42, height: 42 }}>
          {icon}
        </div>
        {change && (
          <div
            className="flex items-center gap-0.5"
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: changeUp ? '#10b981' : '#ef4444',
              padding: '3px 8px',
              borderRadius: 99,
              background: changeUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${changeUp ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}
          >
            {changeUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {change}
          </div>
        )}
      </div>
      <p className="gradient-text" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b', marginTop: 4 }}>{sub}</p>
      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{label}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const requestedLocation = searchParams.get('location')?.trim() || 'Hitech City';
  const [trendData, setTrendData] = useState<TrendRow[]>([]);
  const [cityHealth, setCityHealth] = useState<AnalyticsCityHealthRow[]>([]);
  const [cityUpdated, setCityUpdated] = useState('');
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshotData | null>(null);
  const [health, setHealth] = useState<AnalyticsHealthData | null>(null);
  const [timelapse, setTimelapse] = useState<AnalyticsTimelapseData | null>(null);
  const [location, setLocation] = useState<AnalyticsLocationData | null>(null);
  const [locationQuery, setLocationQuery] = useState(requestedLocation);
  const [selectedLocation, setSelectedLocation] = useState(requestedLocation);
  const [hours, setHours] = useState(6);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);
  const lastAutoFetchRef = useRef({ key: '', at: 0 });

  useEffect(() => {
    if (requestedLocation === selectedLocation) return;
    // Navigation from the global dashboard search updates this page in place.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocationQuery(requestedLocation);
    setSelectedLocation(requestedLocation);
  }, [requestedLocation, selectedLocation]);

  const fetchData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError('');
    try {
      // Apply city health as soon as its fast request resolves; do not wait for unrelated panels.
      const cityRequest = analyticsApi.cityHealth().then((response) => {
        if (requestId === requestIdRef.current) {
          setCityHealth(response.data.cities);
          setCityUpdated(response.data.updated_at || '');
        }
        return response;
      });
      const [snapRes, trendRes, healthRes, timelapseRes, locationRes, cityRes] = await Promise.allSettled([
        analyticsApi.snapshot({ hours: 1 }),
        analyticsApi.trends(hours),
        analyticsApi.health(),
        analyticsApi.timelapse({ hours: 24 }),
        analyticsApi.location(selectedLocation, { hours }),
        cityRequest,
      ]);

      if (requestId !== requestIdRef.current) return;
      if (snapRes.status === 'fulfilled') setSnapshot(snapRes.value.data);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data);

      if (trendRes.status === 'fulfilled' && Array.isArray(trendRes.value.data?.data_points)) {
        setTrendData(
          trendRes.value.data.data_points.map((p) => ({
            time: `${String(p.hour).padStart(2, '0')}:00`,
            congestion: p.has_data === false || p.congestion_level == null
              ? null
              : Math.round(Number(p.congestion_level) * 1000) / 10,
            vehicles: p.vehicle_count ?? 0,
            has_data: p.has_data !== false && p.congestion_level != null,
          })),
        );
      }

      if (timelapseRes.status === 'fulfilled') setTimelapse(timelapseRes.value.data);
      if (locationRes.status === 'fulfilled') setLocation(locationRes.value.data);

      const failed = [snapRes, trendRes, healthRes, cityRes].filter((r) => r.status === 'rejected');
      if (failed.length === 4) setError('Analytics endpoints unreachable. Is the backend running?');
    } catch (e) {
      if (requestId === requestIdRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load analytics');
      }
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [hours, selectedLocation]);

  useEffect(() => {
    const key = `${selectedLocation.toLowerCase()}|${hours}`;
    const now = Date.now();
    if (
      lastAutoFetchRef.current.key === key
      && now - lastAutoFetchRef.current.at < 1500
    ) {
      return;
    }
    lastAutoFetchRef.current = { key, at: now };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData, hours, selectedLocation]);

  const loadLocation = () => {
    const next = locationQuery.trim();
    if (!next) return;
    if (next === selectedLocation) void fetchData();
    else setSelectedLocation(next);
  };

  const dist = snapshot?.congestion_distribution;
  const highCount = dist?.high ?? snapshot?.high_congestion_count ?? 0;
  const lowCount = dist?.low ?? 0;
  const mediumCount = dist?.medium ?? 0;
  const observed = snapshot?.total_locations_observed ?? snapshot?.total_records ?? 0;
  const incidents = snapshot?.active_incidents ?? 0;
  const healthScore = health?.score ?? snapshot?.city_health_score ?? null;

  const timelapseBars = (timelapse?.snapshots ?? [])
    .filter((s): s is AnalyticsTimelapseSnapshot => Boolean(s))
    .map((s) => ({
      label: s.hour_label || '—',
      health: s.has_data === false || s.health_score == null ? null : s.health_score,
      high: s.high_pct,
      medium: s.medium_pct,
      low: s.low_pct,
      has_data: s.has_data !== false && s.health_score != null,
      dominant: s.dominant_congestion || 'unknown',
    }));

  const peak = timelapse?.peak_congestion_snapshot;
  const hotspotLocations = (snapshot?.locations ?? []).slice(0, 8);

  const kpis: KpiCardProps[] = [
    {
      label: `Last ${snapshot?.period_hours ?? 1}h window`,
      value: Number(observed).toLocaleString(),
      sub: 'Locations Observed',
      icon: <Activity size={18} color="#3b82f6" />,
      iconClass: 'icon-glow-blue',
    },
    {
      label: 'Aligned with health score',
      value: `${lowCount} / ${mediumCount} / ${highCount}`,
      sub: 'Low · Med · High',
      icon: <TrendingUp size={18} color="#f59e0b" />,
      iconClass: 'icon-glow-orange',
    },
    {
      label: 'Scoped look-back window',
      value: Number(incidents).toLocaleString(),
      sub: 'Active Incidents',
      icon: <AlertTriangle size={18} color="#ef4444" />,
      iconClass: 'icon-glow-red',
    },
    {
      label: health?.status || 'Network health',
      value: healthScore == null ? '—' : String(Math.round(healthScore)),
      sub: health?.grade ? `Grade ${health.grade}` : 'City Health Score',
      icon: <Zap size={18} color="#10b981" />,
      iconClass: 'icon-glow-green',
    },
  ];

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-hero">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="neon-badge-blue" style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                ● Live
              </span>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Analytics
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.9)', marginTop: 4 }}>
              Congestion trends, network snapshot, city health, and timelapse — from fixed live endpoints
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', color: '#334155' }}
            >
              {[1, 3, 6, 12, 24].map((h) => (
                <option key={h} value={h}>{h}h trends</option>
              ))}
            </select>
            <button
              onClick={() => void fetchData()}
              disabled={isLoading}
              className="btn-neon flex items-center gap-2"
              style={{ padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, opacity: isLoading ? 0.6 : 1 }}
            >
              <RefreshCw size={13} style={{ animation: isLoading ? 'spin 0.8s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {kpis.map((kpi) => <KpiCard key={kpi.sub} {...kpi} />)}
      </div>

      {/* Health breakdown */}
      {health?.breakdown && (
        <div className="neon-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 160 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Network breakdown
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#0f172a', fontWeight: 700 }}>
              {health.status} · {health.total_records ?? 0} records
            </p>
          </div>
          {[
            { label: 'Low', pct: health.breakdown.low_pct, color: '#22c55e' },
            { label: 'Medium', pct: health.breakdown.medium_pct, color: '#f59e0b' },
            { label: 'High', pct: health.breakdown.high_pct, color: '#ef4444' },
          ].map((b) => (
            <div key={b.label} style={{ flex: 1, minWidth: 120 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: b.color, marginBottom: 4 }}>
                <span>{b.label}</span>
                <span>{Number(b.pct ?? 0).toFixed(1)}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, Number(b.pct ?? 0))}%`, background: b.color, borderRadius: 99 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Congestion trend */}
        <div className="neon-card" style={{ padding: '20px 22px' }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
            {hours}-Hour Congestion Trend
          </h3>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>
            Empty hours stay blank (has_data: false) — no fake “perfect” scores
          </p>
          {trendData.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>No trend points yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 10.5, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(trendData.length / 6) - 1)} />
                <YAxis yAxisId="left" tick={{ fontSize: 10.5, fill: '#94a3b8' }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, fontSize: 12, color: '#f1f5f9' }}
                  formatter={(v, name) => {
                    if (v == null) return ['No data', String(name)];
                    return name === 'congestion' ? [`${v}%`, 'Congestion'] : [`${v}`, 'Vehicles'];
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                  formatter={(value) => (
                    <span style={{ color: '#64748b', fontSize: 11 }}>
                      {value === 'congestion' ? 'Congestion %' : 'Vehicle Count'}
                    </span>
                  )}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="congestion"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fill="url(#analyticsGrad)"
                  connectNulls={false}
                  dot={false}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="vehicles"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  fill="transparent"
                  connectNulls={false}
                  dot={false}
                  strokeDasharray="4 2"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Timelapse health */}
        <div className="neon-card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', margin: 0 }}>Congestion Timelapse</h3>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
                Hourly health · unknown hours stay empty
              </p>
            </div>
            {peak?.has_data && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: 'rgba(59,130,246,0.1)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.25)', height: 'fit-content' }}>
                Peak {peak.hour_label} · {peak.health_score}
              </span>
            )}
          </div>
          {timelapseBars.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 18 }}>No timelapse snapshots yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={timelapseBars} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(timelapseBars.length / 8) - 1)} />
                <YAxis tick={{ fontSize: 10.5, fill: '#94a3b8' }} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, fontSize: 12, color: '#f1f5f9' }}
                  formatter={(v, _n, item) => {
                    const row = item?.payload as { has_data?: boolean; dominant?: string };
                    if (!row?.has_data || v == null) return ['No data', 'Health'];
                    return [`${v} (${row.dominant})`, 'Health'];
                  }}
                />
                <Bar dataKey="health" name="Health" radius={[3, 3, 0, 0]} maxBarSize={16}>
                  {timelapseBars.map((row, i) => (
                    <Cell key={i} fill={row.has_data ? healthPalette(row.health).bar : '#e2e8f0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Snapshot hotspots + location drilldown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 14 }}>
        <div className="neon-card" style={{ padding: '20px 22px' }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Snapshot hotspots</h3>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
            Using stored congestion_level (aligned with health) · {fmtUpdated(snapshot?.snapshot_time)}
          </p>
          {hotspotLocations.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>No locations in this window.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {hotspotLocations.map((row) => (
                <button
                  key={row.location}
                  type="button"
                  onClick={() => {
                    setLocationQuery(row.location);
                    setSelectedLocation(row.location);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{row.location}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>
                      {Math.round(row.avg_speed ?? 0)} km/h · {Math.round(row.avg_vehicle_count ?? 0)} vehicles
                    </p>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, textTransform: 'capitalize',
                    color: congColor(row.congestion_level),
                    background: `${congColor(row.congestion_level)}14`,
                    border: `1px solid ${congColor(row.congestion_level)}33`,
                  }}>
                    {row.congestion_level || 'unknown'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="neon-card" style={{ padding: '20px 22px' }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Location summary</h3>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
            GET /analytics/location · try hours=6 if 1h is empty
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadLocation(); }}
              placeholder="Location name"
              style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
            />
            <button
              onClick={loadLocation}
              className="btn-gradient"
              style={{ padding: '9px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}
            >
              Load
            </button>
          </div>
          {location ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <MapPin size={15} color="#3b82f6" />
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{location.location}</p>
              </div>
              {(location.record_count ?? 0) === 0 ? (
                <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
                  No records in the last {location.period_hours ?? hours}h for this location.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Meta label="Records" value={String(location.record_count)} />
                  <Meta label="Congestion" value={location.congestion_level || '—'} />
                  <Meta label="Avg speed" value={`${location.avg_speed ?? '—'} km/h`} />
                  <Meta label="Vehicles" value={String(Math.round(location.avg_vehicle_count ?? 0))} />
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>Pick a location to inspect.</p>
          )}
        </div>
      </div>

      {/* City health */}
      <div className="neon-card" style={{ padding: '20px 22px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', margin: 0 }}>City Health Scores</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {cityUpdated ? `Updated ${fmtUpdated(cityUpdated)}` : 'Multi-city scores from /analytics/city-health'}
              {' · '}null when has_data is false (no fake metros)
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: '#94a3b8', fontSize: 11.5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981', display: 'inline-block' }} /> Healthy ≥80
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} /> Fair 60–79
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> Poor &lt;60
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#94a3b8', display: 'inline-block' }} /> No data
            </span>
          </div>
        </div>

        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {cityHealth.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13, gridColumn: '1 / -1' }}>Loading city health…</p>
          ) : (
            cityHealth.map(({ city, score, trend, has_data, period_hours, used_fallback_window, latest_sample_at }) => {
              const available = has_data !== false && score != null;
              const p = healthPalette(available ? score : null);
              return (
                <div
                  key={city}
                  className="card-hover"
                  style={{
                    borderRadius: 14,
                    padding: 16,
                    background: p.bg,
                    border: `1px solid ${p.border}`,
                  }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{city}</p>
                    {available ? (
                      <span
                        style={{
                          display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 700,
                          color: trend > 0 ? '#10b981' : trend < 0 ? '#ef4444' : '#64748b',
                          padding: '2px 7px', borderRadius: 99,
                          background: trend > 0 ? 'rgba(16,185,129,0.12)' : trend < 0 ? 'rgba(239,68,68,0.12)' : 'rgba(100,116,139,0.1)',
                          border: `1px solid ${trend > 0 ? 'rgba(16,185,129,0.3)' : trend < 0 ? 'rgba(239,68,68,0.3)' : 'rgba(100,116,139,0.25)'}`,
                        }}
                      >
                        {trend > 0 ? <ArrowUpRight size={10} /> : trend < 0 ? <ArrowDownRight size={10} /> : <Minus size={10} />}
                        {Math.abs(trend)}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', padding: '2px 7px', borderRadius: 99, background: '#f1f5f9' }}>
                        No data
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: 32, fontWeight: 800, color: p.text, letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {available ? Math.round(score as number) : '—'}
                  </p>
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {available
                      ? `/ 100 · ${used_fallback_window ? `${period_hours ?? 6}h fallback` : 'latest hour'}${latest_sample_at ? ` · ${fmtUpdated(latest_sample_at)}` : ''}`
                      : 'Awaiting city traffic samples'}
                  </p>

                  <div style={{ marginTop: 12, height: 6, borderRadius: 99, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                    <div
                      className={p.progressClass}
                      style={{
                        height: '100%',
                        width: available ? `${Math.min(100, score as number)}%` : '0%',
                        background: available ? undefined : '#cbd5e1',
                        transition: 'width 0.8s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>{value}</p>
    </div>
  );
}
