'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Activity, MapPin, Wifi,
  TrendingUp, TrendingDown, Minus,
  ExternalLink, Download, Radio, RefreshCw, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import api, { analyticsApi } from '@/lib/api';
import { formatRelativeTime, generateTrendData } from '@/lib/utils';

/* ─── Sparkline ──────────────────────────────────────────────────── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 74, h = 28;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / range) * (h - 4) - 2,
  ]);
  const d = `M ${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ')}`;
  return (
    <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0.01} />
        </linearGradient>
      </defs>
      <path d={d + ` V${h} H0 Z`} fill={`url(#sg-${color.replace('#', '')})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={color}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

function genSparkline(len = 14, base = 50, variance = 22) {
  return Array.from({ length: len }, () =>
    Math.max(0, Math.min(100, base + (Math.random() - 0.5) * variance * 2))
  );
}

/* ─── Types ──────────────────────────────────────────────────────── */
interface Incident {
  id: number;
  title: string;
  location: string;
  severity: string;
  reported_at: string;
}

interface Hotspot {
  city_node: string;
  state: string;
  avg_speed: number;
  current_speed: number;
  congestion: string;
  pct: number;
  trend: 'up' | 'down' | 'stable';
}

interface HotspotMeta {
  source: 'leaderboard' | 'analytics snapshot' | 'India hotspots' | 'none';
  hasData: boolean;
  usedFallbackWindow: boolean;
  periodHours: number | null;
  generatedAt: string | null;
  totalLocations: number;
}

/* ─── Stat Card ──────────────────────────────────────────────────── */
interface StatCardProps {
  title: string; value: string;
  change?: string; changeDir?: 'up' | 'down' | 'flat'; changeGood?: boolean;
  label: string; labelColor?: string;
  icon: React.ReactNode; gradientFrom: string; gradientTo: string;
  sparkData: number[]; sparkColor: string; delay?: number;
}

function StatCard({
  title, value, change, changeDir, changeGood, label, labelColor,
  icon, gradientFrom, gradientTo, sparkData, sparkColor, delay = 0,
}: StatCardProps) {
  const ChangeIcon = changeDir === 'up' ? ArrowUpRight : changeDir === 'down' ? ArrowDownRight : Minus;
  const changeColor = changeGood ? '#10b981' : changeDir === 'flat' ? '#f59e0b' : '#ef4444';

  return (
    <div
      className="neon-card"
      style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12, animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div
          style={{
            width: 42, height: 42, borderRadius: 13,
            background: `linear-gradient(135deg, ${gradientFrom}22, ${gradientTo}22)`,
            border: `1px solid ${gradientFrom}33`,
            boxShadow: `0 0 20px ${gradientFrom}30, inset 0 0 12px ${gradientFrom}10`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'all 0.25s ease',
          }}
        >
          {icon}
        </div>
        <Sparkline data={sparkData} color={sparkColor} />
      </div>

      <div>
        <p className="number-pop" style={{
          fontSize: 28, fontWeight: 800, color: '#0f172a',
          letterSpacing: '-0.03em', lineHeight: 1,
          textShadow: `0 0 24px ${gradientFrom}20`,
        }}>
          {value}
        </p>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: labelColor || '#64748b', marginTop: 3 }}>
          {label}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p style={{ fontSize: 11, color: '#94a3b8' }}>{title}</p>
        {change && (
          <div className="flex items-center gap-0.5"
            style={{
              color: changeColor, padding: '2px 7px', borderRadius: 99,
              background: `${changeColor}12`, border: `1px solid ${changeColor}25`,
              boxShadow: `0 0 8px ${changeColor}20`,
            }}>
            <ChangeIcon size={11} />
            <span style={{ fontSize: 10.5, fontWeight: 700 }}>{change}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Severity / Congestion colour maps ──────────────────────────── */
const SEV: Record<string, { bg: string; color: string; dot: string; glow: string }> = {
  high:     { bg: 'rgba(239,68,68,0.07)',   color: '#dc2626', dot: '#ef4444', glow: 'rgba(239,68,68,0.4)' },
  severe:   { bg: 'rgba(239,68,68,0.07)',   color: '#dc2626', dot: '#ef4444', glow: 'rgba(239,68,68,0.4)' },
  critical: { bg: 'rgba(239,68,68,0.07)',   color: '#dc2626', dot: '#ef4444', glow: 'rgba(239,68,68,0.4)' },
  medium:   { bg: 'rgba(245,158,11,0.07)',  color: '#d97706', dot: '#f59e0b', glow: 'rgba(245,158,11,0.4)' },
  moderate: { bg: 'rgba(245,158,11,0.07)',  color: '#d97706', dot: '#f59e0b', glow: 'rgba(245,158,11,0.4)' },
  low:      { bg: 'rgba(16,185,129,0.07)',  color: '#16a34a', dot: '#22c55e', glow: 'rgba(16,185,129,0.4)' },
  minor:    { bg: 'rgba(16,185,129,0.07)',  color: '#16a34a', dot: '#22c55e', glow: 'rgba(16,185,129,0.4)' },
};

const CONG: Record<string, { bg: string; color: string; bar: string; glow: string }> = {
  Critical: { bg: 'rgba(239,68,68,0.08)',  color: '#dc2626', bar: 'linear-gradient(90deg,#ef4444,#dc2626)', glow: 'rgba(239,68,68,0.5)' },
  High:     { bg: 'rgba(249,115,22,0.08)', color: '#c2410c', bar: 'linear-gradient(90deg,#f97316,#ea580c)', glow: 'rgba(249,115,22,0.5)' },
  Medium:   { bg: 'rgba(245,158,11,0.08)', color: '#d97706', bar: 'linear-gradient(90deg,#f59e0b,#d97706)', glow: 'rgba(245,158,11,0.5)' },
  Low:      { bg: 'rgba(16,185,129,0.08)', color: '#16a34a', bar: 'linear-gradient(90deg,#22c55e,#16a34a)', glow: 'rgba(16,185,129,0.5)' },
};

/* ─── Helpers ────────────────────────────────────────────────────── */
function toTitleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function speedToPct(speedKmh: number): number {
  // Inverse of speed: 0 km/h = 100% load, 80 km/h = 0% load
  return Math.min(95, Math.max(5, Math.round((1 - Math.min(speedKmh, 80) / 80) * 100)));
}

function congestionTrend(level: string): 'up' | 'down' | 'stable' {
  if (level === 'high') return 'down';
  if (level === 'low')  return 'up';
  return 'stable';
}

/* ─── Page ─────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const router = useRouter();
  const [trendData, setTrendData] = useState(generateTrendData());
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentsLoaded, setIncidentsLoaded] = useState(false);
  const [hotspots, setHotspots]   = useState<Hotspot[]>([]);
  const [hotspotsLoaded, setHotspotsLoaded] = useState(false);
  const [hotspotMeta, setHotspotMeta] = useState<HotspotMeta>({
    source: 'none',
    hasData: false,
    usedFallbackWindow: false,
    periodHours: null,
    generatedAt: null,
    totalLocations: 0,
  });
  const [stats, setStats] = useState({ incidents: 0, healthScore: 0, districts: 766, latency: 17 });
  const [isLive, setIsLive] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState<string>('loading');
  const [sparklines] = useState({
    incidents: genSparkline(14, 22, 8),
    health:    genSparkline(14, 90, 5),
    districts: genSparkline(14, 766, 2),
    latency:   genSparkline(14, 17, 6),
  });

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [snapshotRes, sourcesRes, incidentRes, leaderboardRes, trendRes, healthRes] = await Promise.allSettled([
        analyticsApi.snapshot({ hours: 1 }),
        api.get('/traffic/sources', { timeout: 6000 }),
        api.get('/traffic/incidents', {
          timeout: 6000,
          params: { active_only: true, limit: 20, offset: 0 },
        }),
        api.get('/traffic/leaderboard', {
          timeout: 6000,
          params: { order: 'worst', top: 6, hours: 1 },
        }),
        analyticsApi.trends(6),
        analyticsApi.health(),
      ]);

      if (snapshotRes.status === 'fulfilled' && snapshotRes.value.data) {
        const d = snapshotRes.value.data;
        setStats((p) => ({
          ...p,
          incidents:   d.active_incidents ?? p.incidents,
          healthScore: healthRes.status === 'fulfilled' && healthRes.value.data?.score != null
            ? Math.round(Number(healthRes.value.data.score))
            : (d.city_health_score ?? p.healthScore),
          districts:   d.total_locations_observed ?? d.monitored_districts ?? p.districts,
        }));
      } else if (healthRes.status === 'fulfilled' && healthRes.value.data?.score != null) {
        setStats((p) => ({ ...p, healthScore: Math.round(Number(healthRes.value.data.score)) }));
      }
      if (sourcesRes.status === 'fulfilled') {
        const srcBody = sourcesRes.value.data as { data?: { active_source?: string }; active_source?: string };
        const active = srcBody?.data?.active_source ?? srcBody?.active_source;
        if (active) setDataSource(active);
      }

      if (incidentRes.status === 'fulfilled') {
        const rawBody = incidentRes.value.data as unknown;
        const unwrapped = (rawBody as { data?: unknown })?.data ?? rawBody;
        const rawInc = Array.isArray(unwrapped)
          ? unwrapped
          : Array.isArray((unwrapped as { incidents?: unknown[] })?.incidents)
            ? (unwrapped as { incidents: unknown[] }).incidents
            : [];
        setIncidents(
          rawInc.slice(0, 3).map((inc: {
              id: number;
              incident_type: string;
              description?: string;
              location: string;
              severity: string;
              reported_at: string;
            }) => ({
              id:          inc.id,
              title:       toTitleCase(inc.incident_type || 'Incident'),
              location:    inc.location,
              severity:    inc.severity || 'low',
              reported_at: inc.reported_at,
            }))
        );
      }
      setIncidentsLoaded(true);

      try {
        type HotspotRow = {
          location?: string;
          city?: string;
          state?: string;
          congestion_level?: string;
          congestion_score?: number | null;
          avg_speed_kmh?: number | null;
          avg_speed?: number | null;
          free_flow_speed_kmh?: number | null;
          avg_vehicle_count?: number | null;
          vehicle_count?: number | null;
          record_count?: number | null;
        };

        // Prefer the leaderboard, then the snapshot, then the wider India endpoint.
        // Previously snapshot fallback only ran when leaderboard fulfilled, so a
        // transient leaderboard failure permanently left this table empty.
        let rows: HotspotRow[] = [];
        let meta: HotspotMeta = {
          source: 'none',
          hasData: false,
          usedFallbackWindow: false,
          periodHours: null,
          generatedAt: null,
          totalLocations: 0,
        };
        if (leaderboardRes.status === 'fulfilled') {
          const body = leaderboardRes.value.data as {
            timestamp?: string;
            data?: {
              leaderboard?: HotspotRow[];
              has_data?: boolean;
              used_fallback_window?: boolean;
              period_hours?: number;
              generated_at?: string;
              total_locations_observed?: number;
            };
            leaderboard?: HotspotRow[];
          };
          const data = body?.data;
          const leaderboard = data?.leaderboard ?? body?.leaderboard ?? [];
          // Respect an explicit no-data status even if a stale array is present.
          rows = data?.has_data === false ? [] : leaderboard;
          if (rows.length) {
            meta = {
              source: 'leaderboard',
              hasData: true,
              usedFallbackWindow: data?.used_fallback_window === true,
              periodHours: data?.period_hours ?? null,
              generatedAt: data?.generated_at ?? body?.timestamp ?? null,
              totalLocations: data?.total_locations_observed ?? rows.length,
            };
          }
        }
        if (!rows.length && snapshotRes.status === 'fulfilled') {
          rows = (snapshotRes.value.data?.locations ?? []) as HotspotRow[];
          if (rows.length) {
            meta = {
              source: 'analytics snapshot',
              hasData: true,
              usedFallbackWindow: false,
              periodHours: snapshotRes.value.data?.period_hours ?? null,
              generatedAt: snapshotRes.value.data?.snapshot_time ?? null,
              totalLocations: snapshotRes.value.data?.total_locations_observed ?? rows.length,
            };
          }
        }
        if (!rows.length) {
          try {
            // This is a broader, more expensive lookup: only call it when both
            // indexed primary sources are empty.
            const response = await api.get('/india/hotspots?limit=6', { timeout: 9_000 });
            const body = response.data as {
              timestamp?: string;
              data?: { hotspots?: HotspotRow[]; top_congested?: HotspotRow[] };
              hotspots?: HotspotRow[];
              top_congested?: HotspotRow[];
            };
            rows =
              body?.data?.hotspots ??
              body?.data?.top_congested ??
              body?.hotspots ??
              body?.top_congested ??
              [];
            if (rows.length) {
              meta = {
                source: 'India hotspots',
                hasData: true,
                usedFallbackWindow: false,
                periodHours: null,
                generatedAt: body?.timestamp ?? null,
                totalLocations: rows.length,
              };
            }
          } catch {
            rows = [];
          }
        }

        const validRows = rows.filter((row) => typeof row.location === 'string' && row.location.trim().length > 0);
        setHotspots(
          validRows.slice(0, 6).map((row) => {
            const speed = Number(row.avg_speed_kmh ?? row.avg_speed ?? 0);
            const freeFlow = Number(row.free_flow_speed_kmh ?? 60);
            const vehicles = Number(row.avg_vehicle_count ?? row.vehicle_count ?? 0);
            const level = String(row.congestion_level || 'medium').toLowerCase();
            return {
              city_node:     row.location!,
              state:         row.city && row.state
                ? `${row.city}, ${row.state}`
                : vehicles > 0
                  ? `Vehicles: ${Math.round(vehicles).toLocaleString()} avg`
                  : `${Math.round(Number(row.record_count ?? 0)).toLocaleString()} observations`,
              avg_speed:     Math.max(Math.round(freeFlow), Math.round(speed)),
              current_speed: Math.round(speed),
              congestion:    toTitleCase(level),
              pct:           speedToPct(speed || 35),
              trend:         congestionTrend(level),
            };
          })
        );
        setHotspotMeta({ ...meta, hasData: validRows.length > 0 });
      } finally {
        setHotspotsLoaded(true);
      }

      if (trendRes.status === 'fulfilled' && trendRes.value.data?.data_points) {
        const points = trendRes.value.data.data_points
          .filter((p) => p.has_data !== false && p.congestion_level != null)
          .map((p) => ({
            time:       `${String(p.hour).padStart(2, '0')}:00`,
            congestion: Math.round(Number(p.congestion_level) * 100),
          }));
        setTrendData(points.length > 0 ? points : generateTrendData());
      } else if (trendRes.status === 'rejected') {
        setTrendData(generateTrendData());
      }
    } catch { /* leave previous state intact */ }
    finally { setIsRefreshing(false); }
  }, []);

  useEffect(() => {
    // Defer initial state updates out of the effect's synchronous phase.
    const initial = window.setTimeout(() => void fetchData(), 0);
    // Retry real data after cold startup and keep the dashboard current.
    const interval = setInterval(() => void fetchData(), 30_000);
    return () => {
      window.clearTimeout(initial);
      clearInterval(interval);
    };
  }, [fetchData]);

  const sourceLabel: Record<string, string> = {
    tomtom:     'TomTom Live',
    here:       'HERE Live',
    simulation: 'Simulated',
    loading:    'Connecting…',
  };

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Gradient hero banner ──────────────────────── */}
      <div className="page-hero">
        <div className="stack-mobile" style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px rgba(16,185,129,0.9)', display: 'inline-block' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live Dashboard</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                background: dataSource === 'simulation' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)',
                color: dataSource === 'simulation' ? '#fbbf24' : '#34d399',
                border: `1px solid ${dataSource === 'simulation' ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`,
              }}>
                {sourceLabel[dataSource] ?? dataSource}
              </span>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
              Traffic Command Center
            </h1>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
              Real-time intelligence across all of India — {stats.districts.toLocaleString()} districts monitored
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchData} disabled={isRefreshing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10,
                fontSize: 12.5, fontWeight: 600,
                background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)',
                border: '1px solid rgba(255,255,255,0.12)',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                opacity: isRefreshing ? 0.6 : 1,
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(8px)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            >
              <RefreshCw size={13} style={{ animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
              Refresh
            </button>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10,
              fontSize: 12.5, fontWeight: 700,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: '#fff', border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
              transition: 'all 0.2s ease',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(59,130,246,0.5)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.4)'; }}
            >
              <Download size={13} />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI cards ─────────────────────────────────── */}
      <div className="stagger grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <StatCard
          title="Active Incidents" value={stats.incidents > 0 ? String(stats.incidents) : '—'}
          change={stats.incidents > 0 ? `${stats.incidents} active now` : 'Loading…'} changeDir="up" changeGood={false}
          label="Live TomTom reports" labelColor="#dc2626"
          icon={<AlertTriangle size={18} color="#ef4444" style={{ filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.7))' }} />}
          gradientFrom="#ef4444" gradientTo="#dc2626"
          sparkData={sparklines.incidents} sparkColor="#ef4444" delay={0}
        />
        <StatCard
          title="City Health Score" value={stats.healthScore > 0 ? `${stats.healthScore}` : '—'}
          change="Network avg" changeDir="up" changeGood={true}
          label="/ 100 — Network avg" labelColor="#10b981"
          icon={<Activity size={18} color="#10b981" style={{ filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.7))' }} />}
          gradientFrom="#10b981" gradientTo="#059669"
          sparkData={sparklines.health} sparkColor="#10b981" delay={70}
        />
        <StatCard
          title="Monitored Districts" value={stats.districts.toLocaleString()}
          change="All nodes live" changeDir="up" changeGood={true}
          label="India-wide coverage"
          icon={<MapPin size={18} color="#3b82f6" style={{ filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.7))' }} />}
          gradientFrom="#3b82f6" gradientTo="#2563eb"
          sparkData={sparklines.districts} sparkColor="#3b82f6" delay={140}
        />
        <StatCard
          title="WebSocket Latency" value={`${stats.latency}ms`}
          change="Real-time feed" changeDir="flat" changeGood={true}
          label="Live connection" labelColor="#8b5cf6"
          icon={<Wifi size={18} color="#8b5cf6" style={{ filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.7))' }} />}
          gradientFrom="#8b5cf6" gradientTo="#7c3aed"
          sparkData={sparklines.latency} sparkColor="#8b5cf6" delay={210}
        />
      </div>

      {/* ── Charts row ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3.5">

        {/* Congestion trend */}
        <div className="neon-card" style={{ padding: '22px 26px' }}>
          <div className="flex items-start justify-between" style={{ marginBottom: 18 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                24-Hour Congestion Trend
              </h2>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                Network-wide average traffic load against capacity
              </p>
            </div>
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 13px', borderRadius: 8,
                fontSize: 11.5, fontWeight: 700,
                background: isLive ? 'linear-gradient(135deg, #0f172a, #1e293b)' : '#f1f5f9',
                color: isLive ? '#fff' : '#64748b',
                border: 'none', cursor: 'pointer',
                boxShadow: isLive ? '0 4px 12px rgba(15,23,42,0.3)' : 'none',
                transition: 'all 0.2s ease',
              }}
              onClick={() => setIsLive(!isLive)}
            >
              <Radio size={11} style={{ filter: isLive ? 'drop-shadow(0 0 4px rgba(16,185,129,0.8))' : 'none', color: isLive ? '#34d399' : 'inherit' }} />
              {isLive ? 'Live' : 'Paused'}
            </button>
          </div>

          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="congGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="60%"  stopColor="#8b5cf6" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.06)" />
              <XAxis dataKey="time" tick={{ fontSize: 10.5, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fontSize: 10.5, fill: '#94a3b8' }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, fontSize: 12, color: '#f1f5f9', boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 0 20px rgba(59,130,246,0.1)' }}
                itemStyle={{ color: '#60a5fa' }}
                labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                formatter={(v) => [`${v}%`, 'Congestion'] as [string, string]}
              />
              <Area type="monotone" dataKey="congestion" stroke="#3b82f6" strokeWidth={2.5} fill="url(#congGrad)" dot={false} activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2, style: { filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.8))' } }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent incidents — live from API */}
        <div className="neon-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="flex items-center justify-between" style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Recent Incidents</h2>
              <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>Live active reports — TomTom</p>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
              background: 'rgba(239,68,68,0.08)', color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.2)', boxShadow: '0 0 8px rgba(239,68,68,0.12)',
            }}>
              {incidents.length > 0
                ? `${incidents.length} active`
                : incidentsLoaded ? '0 active' : 'loading…'}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {incidents.length === 0 ? (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                No active incidents right now
              </div>
            ) : incidents.map((inc) => {
              const sev = SEV[inc.severity] ?? SEV.low;
              return (
                <div key={inc.id}
                  style={{
                    padding: '13px 20px', borderBottom: '1px solid #f8fafc',
                    borderLeft: `3px solid ${sev.dot}`,
                    boxShadow: `inset 3px 0 12px ${sev.glow}15`,
                    transition: 'background 0.12s', cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{inc.title}</p>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, flexShrink: 0,
                      background: sev.bg, color: sev.color,
                      border: `1px solid ${sev.dot}30`,
                      boxShadow: `0 0 8px ${sev.glow}20`,
                      textTransform: 'capitalize' as const,
                    }}>
                      {inc.severity}
                    </span>
                  </div>
                  <p style={{ fontSize: 11.5, color: '#64748b', marginBottom: 6 }}>{inc.location}</p>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatRelativeTime(inc.reported_at)}</span>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, transition: 'color 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#3b82f6')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                    >
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: '13px 20px', borderTop: '1px solid #f1f5f9' }}>
            <button style={{
              width: '100%', padding: '9px', borderRadius: 9,
              fontSize: 12.5, fontWeight: 700, color: '#3b82f6',
              background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.15)',
              cursor: 'pointer', transition: 'all 0.2s ease',
              boxShadow: '0 0 0 0 rgba(59,130,246,0)',
            }}
              onClick={() => router.push('/incidents')}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(59,130,246,0.1)';
                e.currentTarget.style.boxShadow = '0 0 16px rgba(59,130,246,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(59,130,246,0.06)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              View All Reports
            </button>
          </div>
        </div>
      </div>

      {/* ── Hotspots table — live from /traffic/leaderboard ─────── */}
      <div className="neon-card" style={{ overflow: 'hidden' }}>
        <div className="flex items-center justify-between" style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Top Congestion Hotspots</h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              Source: <span style={{ color: hotspotMeta.source === 'leaderboard' ? '#10b981' : '#f59e0b', fontWeight: 700 }}>{hotspotMeta.source}</span>
              {hotspotMeta.periodHours != null ? ` · ${hotspotMeta.periodHours}h window` : ''}
              {hotspotMeta.usedFallbackWindow ? ' · fallback window' : ''}
              {hotspotMeta.generatedAt ? ` · ${new Date(hotspotMeta.generatedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST` : ''}
            </p>
          </div>
          <div style={{
            fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
            background: 'rgba(59,130,246,0.06)', color: '#3b82f6',
            border: '1px solid rgba(59,130,246,0.15)',
          }}>
            {hotspotMeta.hasData ? `${hotspotMeta.totalLocations} locations` : 'All India'}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}>
                {['Location', 'Free-Flow', 'Live Speed', 'Congestion Level', 'Load', 'Trend'].map((h) => (
                  <th key={h} style={{
                    padding: '11px 22px', textAlign: 'left',
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: '#94a3b8',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hotspots.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    {hotspotsLoaded ? 'No hotspot data available' : 'Loading live traffic hotspots…'}
                  </td>
                </tr>
              ) : hotspots.map((row, i) => {
                const cs = CONG[row.congestion] ?? CONG.Medium;
                return (
                  <tr
                    key={i}
                    style={{ borderTop: '1px solid #f1f5f9', transition: 'all 0.15s ease', cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.03), transparent)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '14px 22px' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{row.city_node}</p>
                      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{row.state}</p>
                    </td>
                    <td style={{ padding: '14px 22px', fontSize: 13, color: '#475569' }}>{row.avg_speed} km/h</td>
                    <td style={{ padding: '14px 22px' }}>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: row.current_speed < 25 ? '#dc2626' : row.current_speed < 40 ? '#d97706' : '#16a34a',
                        textShadow: row.current_speed < 25 ? '0 0 10px rgba(239,68,68,0.4)' : row.current_speed < 40 ? '0 0 10px rgba(245,158,11,0.4)' : '0 0 10px rgba(16,185,129,0.4)',
                      }}>
                        {row.current_speed} km/h
                      </span>
                    </td>
                    <td style={{ padding: '14px 22px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 99,
                        background: cs.bg, color: cs.color,
                        boxShadow: `0 0 10px ${cs.glow}20`,
                      }}>
                        {row.congestion}
                      </span>
                    </td>
                    <td style={{ padding: '14px 22px', minWidth: 130 }}>
                      <div className="flex items-center gap-2.5">
                        <div style={{ flex: 1, height: 7, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                          <div style={{
                            width: `${row.pct}%`, height: '100%', borderRadius: 99,
                            background: cs.bar,
                            boxShadow: `0 0 8px ${cs.glow}60`,
                            transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
                          }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: cs.color, minWidth: 30 }}>{row.pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 22px' }}>
                      {row.trend === 'down'   && <TrendingDown size={16} color="#ef4444" style={{ filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.6))' }} />}
                      {row.trend === 'up'     && <TrendingUp   size={16} color="#10b981" style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.6))' }} />}
                      {row.trend === 'stable' && <Minus        size={16} color="#f59e0b" style={{ filter: 'drop-shadow(0 0 4px rgba(245,158,11,0.6))' }} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
