'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Flame, TrendingUp, TrendingDown, Minus, RefreshCw,
  MapPin, Download, AlertTriangle, ChevronDown, Clock,
} from 'lucide-react';
import { heatmapApi } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Hotspot {
  name:      string;
  state?:    string;
  x:         number;
  y:         number;
  score:     number;
  severity:  'critical' | 'high' | 'moderate' | 'low';
  vehicles?: number;
  speed?:    number;
  trend?:    string;
}

interface Summary {
  total_vehicles?:            number;
  avg_congestion?:            number;
  critical_zones?:            number;
  data_points?:               number;
  total_monitored_locations?: number;
  coverage_area?:             string;
}

type SeverityFilter = 'all' | 'critical' | 'high' | 'moderate' | 'low';
type SortMode       = 'intensity' | 'vehicles' | 'name';

// ── Constants ─────────────────────────────────────────────────────────────────

const SEV_META: Record<string, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Critical' },
  high:     { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', label: 'High'     },
  moderate: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Moderate' },
  low:      { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Low'      },
};

const FILTERS: SeverityFilter[]                          = ['all', 'critical', 'high', 'moderate', 'low'];
const SORT_OPTIONS: { v: SortMode; l: string }[]         = [
  { v: 'intensity', l: 'Intensity' },
  { v: 'vehicles',  l: 'Vehicles'  },
  { v: 'name',      l: 'Name'      },
];
const LIMIT_OPTIONS                                      = [10, 25, 50];
const REFRESH_SECS                                       = 60;

const INDIA_PATH = `M 180 30 L 200 25 L 230 30 L 260 20 L 290 25 L 310 35 L 340 30 L 360 50
  L 380 60 L 400 55 L 420 70 L 430 90 L 440 110 L 450 130 L 460 150 L 470 170
  L 480 195 L 490 210 L 500 225 L 505 240 L 510 260 L 505 280 L 495 295 L 480 310
  L 460 320 L 445 330 L 430 340 L 415 355 L 400 365 L 390 380 L 380 395 L 370 410
  L 360 420 L 350 430 L 340 440 L 330 455 L 320 460 L 310 450 L 305 440 L 295 430
  L 285 420 L 275 405 L 265 390 L 255 375 L 245 360 L 235 350 L 225 335 L 215 320
  L 205 305 L 195 290 L 185 275 L 175 260 L 165 245 L 160 230 L 155 215 L 150 200
  L 145 185 L 140 170 L 138 155 L 135 140 L 130 125 L 125 110 L 120 95 L 118 80
  L 120 65 L 128 52 L 140 42 L 155 36 L 170 32 Z`;

// ── Stub data ─────────────────────────────────────────────────────────────────

const STUB_HOTSPOTS: Hotspot[] = [
  { name: 'Mumbai Andheri West',   state: 'Maharashtra', x: 21, y: 57, score: 0.92, severity: 'critical', vehicles: 1240, speed: 8,  trend: 'worsening' },
  { name: 'Delhi Connaught Place', state: 'Delhi NCR',   x: 36, y: 26, score: 0.78, severity: 'high',     vehicles:  980, speed: 14, trend: 'stable'    },
  { name: 'Bangalore Silk Board',  state: 'Karnataka',   x: 33, y: 73, score: 0.74, severity: 'high',     vehicles:  870, speed: 12, trend: 'improving'  },
  { name: 'Hyderabad HITEC City',  state: 'Telangana',   x: 38, y: 61, score: 0.68, severity: 'high',     vehicles:  760, speed: 18, trend: 'stable'    },
  { name: 'Kolkata EM Bypass',     state: 'West Bengal', x: 71, y: 44, score: 0.61, severity: 'moderate', vehicles:  640, speed: 22, trend: 'stable'    },
  { name: 'Chennai Anna Salai',    state: 'Tamil Nadu',  x: 42, y: 72, score: 0.55, severity: 'moderate', vehicles:  590, speed: 24, trend: 'improving'  },
  { name: 'Pune Hinjewadi',        state: 'Maharashtra', x: 25, y: 62, score: 0.51, severity: 'moderate', vehicles:  520, speed: 26, trend: 'worsening'  },
  { name: 'Ahmedabad SG Highway',  state: 'Gujarat',     x: 20, y: 44, score: 0.44, severity: 'moderate', vehicles:  480, speed: 28, trend: 'stable'    },
  { name: 'Jaipur MI Road',        state: 'Rajasthan',   x: 30, y: 33, score: 0.38, severity: 'low',      vehicles:  340, speed: 35, trend: 'improving'  },
  { name: 'Surat Ring Road',       state: 'Gujarat',     x: 19, y: 52, score: 0.29, severity: 'low',      vehicles:  270, speed: 40, trend: 'stable'    },
  { name: 'Lucknow Hazratganj',    state: 'UP',          x: 47, y: 30, score: 0.35, severity: 'low',      vehicles:  310, speed: 38, trend: 'stable'    },
  { name: 'Nagpur Dharampeth',     state: 'Maharashtra', x: 41, y: 51, score: 0.42, severity: 'moderate', vehicles:  380, speed: 30, trend: 'worsening'  },
];

const STUB_SUMMARY: Summary = {
  total_vehicles: 18240,
  avg_congestion: 0.62,
  critical_zones: 2,
  data_points:    766,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function heatColor(score: number, alpha = 1): string {
  if (score >= 0.8) return `rgba(239,68,68,${alpha})`;
  if (score >= 0.6) return `rgba(249,115,22,${alpha})`;
  if (score >= 0.4) return `rgba(245,158,11,${alpha})`;
  return `rgba(34,197,94,${alpha})`;
}

function latLngToSVG(lat: number, lng: number): { x: number; y: number } {
  const x = Math.round(((lng - 68)  / (97.5 - 68)) * 100);
  const y = Math.round(((37 - lat)  / (37 - 8))    * 100);
  return { x: Math.min(95, Math.max(5, x)), y: Math.min(95, Math.max(5, y)) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseHotspot(raw: any, idx: number): Hotspot {
  const name  = raw.location ?? raw.name ?? raw.area_name ?? raw.district ?? `Area ${idx + 1}`;
  const score = raw.intensity ?? raw.score ?? raw.congestion_score ?? 0;
  // Prefer the explicit `severity` field added by the backend, fall back to `congestion_level`, then derive
  const sevRaw = raw.severity ?? raw.congestion_level ?? (
    score >= 0.8 ? 'critical' : score >= 0.6 ? 'high' : score >= 0.4 ? 'moderate' : 'low'
  );
  const severity: Hotspot['severity'] =
    (['critical', 'high', 'moderate', 'low'] as const).includes(sevRaw) ? sevRaw : 'low';

  let coords: { x: number; y: number };
  if (raw.x != null && raw.y != null) {
    coords = { x: raw.x, y: raw.y };
  } else if (raw.latitude != null && raw.longitude != null) {
    coords = latLngToSVG(raw.latitude, raw.longitude);
  } else {
    const hash = name.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
    coords = { x: 20 + (hash % 55), y: 20 + (hash % 55) };
  }

  const parts       = name.split(',');
  const displayName = parts[0].trim();
  const state       = parts.length > 1 ? parts.slice(1).join(',').trim() : (raw.state ?? undefined);

  return {
    name:     displayName,
    state,
    x:        coords.x,
    y:        coords.y,
    score,
    severity,
    vehicles: raw.vehicle_count ?? raw.vehicles ?? raw.count ?? undefined,
    speed:    raw.average_speed ?? raw.speed ?? undefined,
    trend:    raw.trend ?? undefined,
  };
}

function exportCSV(hotspots: Hotspot[]) {
  const header = ['Rank', 'Name', 'State', 'Severity', 'Intensity(%)', 'Vehicles', 'Speed(km/h)', 'Trend'].join(',');
  const rows   = hotspots.map((h, i) =>
    [
      i + 1,
      `"${h.name}"`,
      `"${h.state ?? ''}"`,
      h.severity,
      (h.score * 100).toFixed(1),
      h.vehicles ?? '',
      h.speed?.toFixed(1) ?? '',
      h.trend ?? '',
    ].join(',')
  );
  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `flowcast-hotspots-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sevCountFallback(list: Hotspot[]) {
  return list.filter((h) => h.severity === 'critical').length;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TrendBadge({ trend }: { trend?: string }) {
  if (trend === 'worsening')
    return <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: '#ef4444', fontWeight: 600 }}><TrendingDown size={10} />Worsening</span>;
  if (trend === 'improving')
    return <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: '#22c55e', fontWeight: 600 }}><TrendingUp   size={10} />Improving</span>;
  return   <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}><Minus        size={10} />Stable</span>;
}

function LoadingSkeleton() {
  return (
    <div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ padding: '11px 16px', borderBottom: '1px solid #f9fafb', opacity: 1 - i * 0.12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 18, height: 12, borderRadius: 4, background: '#f1f5f9' }} />
            <div style={{ width: 4,  height: 40, borderRadius: 99, background: '#f1f5f9' }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 12, width: '65%', borderRadius: 6, background: '#f1f5f9', marginBottom: 5 }} />
              <div style={{ height: 10, width: '40%', borderRadius: 6, background: '#f1f5f9', marginBottom: 5 }} />
              <div style={{ height: 10, width: '30%', borderRadius: 6, background: '#f1f5f9' }} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ height: 20, width: 44, borderRadius: 6, background: '#f1f5f9', marginBottom: 5 }} />
              <div style={{ height: 14, width: 52, borderRadius: 99, background: '#f1f5f9' }} />
            </div>
          </div>
          <div style={{ height: 3, borderRadius: 99, background: '#f1f5f9', marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HeatmapPage() {
  const [mapPoints,   setMapPoints]   = useState<Hotspot[]>(STUB_HOTSPOTS);
  const [allHotspots, setAllHotspots] = useState<Hotspot[]>(STUB_HOTSPOTS);
  const [summary,     setSummary]     = useState<Summary>(STUB_SUMMARY);
  const [selected,    setSelected]    = useState<Hotspot | null>(null);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [fromApi,     setFromApi]     = useState(false);
  const [filter,      setFilter]      = useState<SeverityFilter>('all');
  const [sortMode,    setSortMode]    = useState<SortMode>('intensity');
  const [limit,       setLimit]       = useState(25);
  const [hours,       setHours]       = useState(6);
  const [countdown,   setCountdown]   = useState(REFRESH_SECS);
  const [lastUpdated, setLastUpdated] = useState('');
  const [showSort,    setShowSort]    = useState(false);
  const [showLimit,   setShowLimit]   = useState(false);

  const fetchRef = useRef<() => Promise<void>>(async () => {});

  const extractList = (data: unknown): unknown[] => {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    const obj = data as Record<string, unknown>;
    const raw =
      obj.points ??
      obj.hotspots ??
      obj.top_congested ??
      obj.data ??
      obj.items ??
      obj.results ??
      obj.heatmap;
    return Array.isArray(raw) ? raw : [];
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [heatmapRes, hotRes, sumRes] = await Promise.allSettled([
        heatmapApi.get({ hours, limit: Math.max(limit, 50) }),
        heatmapApi.hotspots({ limit }),
        heatmapApi.summary(),
      ]);

      const heatData = heatmapRes.status === 'fulfilled' ? heatmapRes.value.data : null;
      const hotData = hotRes.status === 'fulfilled' ? hotRes.value.data : null;
      const sumData = sumRes.status === 'fulfilled' ? sumRes.value.data : null;

      const heatPoints = extractList(heatData).map(normaliseHotspot);
      const hotspots = extractList(hotData).map(normaliseHotspot);

      if (heatPoints.length) setMapPoints(heatPoints);
      if (hotspots.length) {
        setAllHotspots(hotspots);
      } else if (heatPoints.length) {
        // Fallback: use heatmap points for list if hotspots endpoint returns empty
        setAllHotspots(heatPoints.slice(0, limit));
      }

      if (heatPoints.length || hotspots.length || sumData) setFromApi(true);

      const generatedAt =
        (hotData as { generated_at?: string } | null)?.generated_at ??
        (heatData as { generated_at?: string } | null)?.generated_at ??
        (sumData as { generated_at?: string } | null)?.generated_at;
      if (generatedAt) {
        try { setLastUpdated(new Date(generatedAt).toLocaleTimeString()); }
        catch { setLastUpdated(new Date().toLocaleTimeString()); }
      } else if (heatPoints.length || hotspots.length) {
        setLastUpdated(new Date().toLocaleTimeString());
      }

      if (sumData && typeof sumData === 'object') {
        const s = sumData as Summary & Record<string, number | string | undefined>;
        const pointsForFallback = hotspots.length ? hotspots : heatPoints;
        const dataPoints =
          s.data_points ?? s.points ?? s.total_monitored_locations ?? heatPoints.length ?? STUB_SUMMARY.data_points;
        setSummary({
          total_vehicles: Number(s.total_vehicles ?? s.vehicles ?? STUB_SUMMARY.total_vehicles),
          avg_congestion: Number(s.avg_congestion ?? s.average_congestion ?? s.avg_intensity ?? STUB_SUMMARY.avg_congestion),
          critical_zones: Number(s.critical_zones ?? s.critical_count ?? sevCountFallback(pointsForFallback)),
          data_points: Number(dataPoints || 0),
          total_monitored_locations: Number(s.total_monitored_locations ?? s.data_points ?? heatPoints.length) || undefined,
          coverage_area: s.coverage_area ? String(s.coverage_area) : undefined,
        });
      }
    } catch {
      setError('Could not reach heatmap APIs — showing last cached data.');
    } finally {
      setIsLoading(false);
    }
  }, [limit, hours]);

  useEffect(() => { fetchRef.current = fetchData; }, [fetchData]);
  useEffect(() => { void fetchData(); }, [fetchData]);

  // 30s auto-refresh countdown; uses ref so the interval never goes stale
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void fetchRef.current();
          return REFRESH_SECS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Severity counts for chips — prefer full heatmap field when available
  const sevCounts = useMemo(() => {
    const source = mapPoints.length ? mapPoints : allHotspots;
    const c: Record<SeverityFilter, number> = { all: source.length, critical: 0, high: 0, moderate: 0, low: 0 };
    source.forEach((h) => { c[h.severity] = (c[h.severity] ?? 0) + 1; });
    return c;
  }, [mapPoints, allHotspots]);

  // List filtered + sorted client-side (no API refetch on chip change)
  const displayed = useMemo(() => {
    const list = filter === 'all'
      ? [...allHotspots]
      : allHotspots.filter((h) => h.severity === filter);
    if (sortMode === 'vehicles') return list.sort((a, b) => (b.vehicles ?? 0) - (a.vehicles ?? 0));
    if (sortMode === 'name')     return list.sort((a, b) => a.name.localeCompare(b.name));
    return list.sort((a, b) => b.score - a.score);
  }, [allHotspots, filter, sortMode]);

  const mapDots = useMemo(() => {
    if (filter === 'all') return mapPoints;
    return mapPoints.filter((h) => h.severity === filter);
  }, [mapPoints, filter]);

  const avgCong  = summary.avg_congestion ?? 0;
  const totalVeh = summary.total_vehicles ?? 0;
  const dpCount  = (summary.data_points ?? summary.total_monitored_locations ?? mapPoints.length) || 766;
  const criticalZones = summary.critical_zones ?? sevCounts.critical;

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!showSort && !showLimit) return;
    const handle = () => { setShowSort(false); setShowLimit(false); };
    window.addEventListener('click', handle);
    return () => window.removeEventListener('click', handle);
  }, [showSort, showLimit]);

  return (
    <div className="space-y-5" style={{ maxWidth: 1200 }}>

      {/* ── Page Hero ─────────────────────────────────────────────── */}
      <div className="page-hero" style={{ marginBottom: 0 }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="icon-glow icon-glow-red" style={{ width: 52, height: 52 }}>
              <Flame size={26} color="#f87171" />
            </div>
            <div>
              <h1 className="gradient-text-neon" style={{ fontWeight: 800, fontSize: 22, margin: 0 }}>Traffic Heatmap</h1>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 3 }}>
                Congestion intensity across {dpCount.toLocaleString()} districts · {fromApi ? 'live heatmap APIs' : 'demo data'} · {hours}h window
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
            {lastUpdated && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>
                <Clock size={12} /> Updated {lastUpdated}
              </span>
            )}

            {/* Hours window for GET /traffic/heatmap */}
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="btn-neon"
              style={{ padding: '7px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            >
              {[1, 3, 6, 12, 24].map((h) => (
                <option key={h} value={h}>{h}h heatmap</option>
              ))}
            </select>

            {/* Sort dropdown */}
            <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { setShowSort(!showSort); setShowLimit(false); }}
                className="btn-neon"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600 }}
              >
                Sort: {SORT_OPTIONS.find((o) => o.v === sortMode)?.l}
                <ChevronDown size={12} style={{ transition: 'transform 0.15s', transform: showSort ? 'rotate(180deg)' : 'none' }} />
              </button>
              {showSort && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 130, overflow: 'hidden' }}>
                  {SORT_OPTIONS.map((o) => (
                    <button
                      key={o.v}
                      onClick={() => { setSortMode(o.v); setShowSort(false); }}
                      style={{ display: 'block', width: '100%', padding: '8px 14px', fontSize: 12.5, textAlign: 'left', background: sortMode === o.v ? '#eff6ff' : 'none', border: 'none', cursor: 'pointer', fontWeight: sortMode === o.v ? 700 : 400, color: sortMode === o.v ? '#2563eb' : '#374151' }}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Limit dropdown */}
            <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { setShowLimit(!showLimit); setShowSort(false); }}
                className="btn-neon"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600 }}
              >
                Show: {limit}
                <ChevronDown size={12} style={{ transition: 'transform 0.15s', transform: showLimit ? 'rotate(180deg)' : 'none' }} />
              </button>
              {showLimit && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 130, overflow: 'hidden' }}>
                  {LIMIT_OPTIONS.map((l) => (
                    <button
                      key={l}
                      onClick={() => { setLimit(l); setShowLimit(false); }}
                      style={{ display: 'block', width: '100%', padding: '8px 14px', fontSize: 12.5, textAlign: 'left', background: limit === l ? '#eff6ff' : 'none', border: 'none', cursor: 'pointer', fontWeight: limit === l ? 700 : 400, color: limit === l ? '#2563eb' : '#374151' }}
                    >
                      {l} hotspots
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Export CSV */}
            <button
              onClick={() => exportCSV(displayed)}
              className="btn-neon"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 600 }}
            >
              <Download size={13} /> Export CSV
            </button>

            {/* Refresh + countdown */}
            <button
              onClick={() => { void fetchData(); setCountdown(REFRESH_SECS); }}
              disabled={isLoading}
              className="btn-gradient"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, opacity: isLoading ? 0.7 : 1 }}
            >
              <RefreshCw size={13} style={{ animation: isLoading ? 'spin 0.8s linear infinite' : 'none' }} />
              {isLoading ? 'Loading…' : `Refresh · ${countdown}s`}
            </button>
          </div>
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────────────────── */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, fontSize: 13 }} className="neon-badge-red">
          <AlertTriangle size={14} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => void fetchData()}
            style={{ fontSize: 12, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', textDecoration: 'underline' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Summary stats ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Vehicles',  value: totalVeh.toLocaleString(),               color: '#2563eb', sub: 'across India',   glowClass: 'icon-glow-blue'   },
          { label: 'Avg Congestion',  value: `${(avgCong * 100).toFixed(0)}%`,          color: heatColor(avgCong), sub: 'from /summary', glowClass: 'icon-glow-orange' },
          { label: 'Critical Zones',  value: String(criticalZones),                     color: '#ef4444', sub: 'intensity ≥ 80%', glowClass: 'icon-glow-red'  },
          { label: 'Districts',       value: dpCount.toLocaleString(),                  color: '#8b5cf6', sub: 'from heatmap',     glowClass: 'icon-glow-purple' },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="neon-card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', marginTop: 6 }}>{label}</p>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Severity distribution bar ──────────────────────────────── */}
      <div className="neon-card" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: '#374151' }}>Severity Distribution</p>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{allHotspots.length} hotspots total</span>
        </div>
        {/* Stacked bar */}
        <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', background: '#f1f5f9', gap: 1 }}>
          {(['critical', 'high', 'moderate', 'low'] as const).map((sev) => {
            const pct = allHotspots.length > 0 ? (sevCounts[sev] / allHotspots.length) * 100 : 0;
            return pct > 0 ? (
              <div
                key={sev}
                title={`${SEV_META[sev].label}: ${sevCounts[sev]}`}
                style={{ width: `${pct}%`, background: SEV_META[sev].color, transition: 'width 0.4s ease', cursor: 'pointer', boxShadow: `0 0 6px ${SEV_META[sev].color}80` }}
                onClick={() => setFilter(sev)}
              />
            ) : null;
          })}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 18, marginTop: 9, flexWrap: 'wrap' }}>
          {(['critical', 'high', 'moderate', 'low'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setFilter(filter === sev ? 'all' : sev)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: filter === sev ? SEV_META[sev].color : '#6b7280', fontWeight: filter === sev ? 700 : 400, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 3, background: SEV_META[sev].color, display: 'inline-block', boxShadow: filter === sev ? `0 0 6px ${SEV_META[sev].color}` : 'none' }} />
              {SEV_META[sev].label}
              <span style={{ fontWeight: 700, color: SEV_META[sev].color }}>{sevCounts[sev]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Map + List ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 390px', gap: 16, alignItems: 'start' }}>

        {/* ── SVG Map ──────────────────────────────────────────── */}
        <div className="neon-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="icon-glow icon-glow-red" style={{ width: 28, height: 28 }}>
              <Flame size={13} color="#f87171" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: '#111827' }}>India Congestion Map</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>
              {[['#22c55e', 'Low'], ['#f59e0b', 'Moderate'], ['#f97316', 'High'], ['#ef4444', 'Critical']].map(([c, l]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block', boxShadow: `0 0 6px ${c}` }} />{l}
                </span>
              ))}
            </div>
          </div>

          <div style={{ padding: '16px 24px 24px', position: 'relative' }}>
            <svg viewBox="0 0 640 490" style={{ width: '100%', height: 'auto' }}>
              {/* India outline */}
              <path d={INDIA_PATH} fill="none" stroke="#e2e8f0" strokeWidth="1.5" />

              {/* Glow blobs from GET /traffic/heatmap */}
              {mapDots.map((h, i) => {
                const active = true;
                return (
                  <circle
                    key={`glow-${i}`}
                    cx={`${h.x}%`} cy={`${h.y}%`}
                    r={h.score * 36 + 10}
                    fill={heatColor(h.score, active ? 0.11 : 0.025)}
                    style={{ filter: 'blur(8px)', transition: 'fill 0.35s' }}
                  />
                );
              })}

              {/* Hotspot dots */}
              {mapDots.map((h, i) => {
                const active     = true;
                const isSelected = selected?.name === h.name;
                const r          = h.score * 10 + 5;
                return (
                  <g key={`dot-${h.name}-${i}`} style={{ cursor: 'pointer' }} onClick={() => setSelected(isSelected ? null : h)}>
                    {h.severity === 'critical' && active && (
                      <circle cx={`${h.x}%`} cy={`${h.y}%`} r={r + 8} fill="none" stroke={heatColor(h.score, 0.45)} strokeWidth="1.2">
                        <animate attributeName="r"              values={`${r + 4};${r + 16};${r + 4}`} dur="2s"   repeatCount="indefinite" />
                        <animate attributeName="stroke-opacity" values="0.6;0;0.6"                     dur="2s"   repeatCount="indefinite" />
                      </circle>
                    )}
                    {h.severity === 'high' && active && (
                      <circle cx={`${h.x}%`} cy={`${h.y}%`} r={r + 6} fill="none" stroke={heatColor(h.score, 0.3)} strokeWidth="0.8">
                        <animate attributeName="r"              values={`${r + 3};${r + 11};${r + 3}`} dur="2.8s" repeatCount="indefinite" />
                        <animate attributeName="stroke-opacity" values="0.4;0;0.4"                     dur="2.8s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {isSelected && (
                      <circle cx={`${h.x}%`} cy={`${h.y}%`} r={r + 6} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 3" />
                    )}
                    <circle
                      cx={`${h.x}%`} cy={`${h.y}%`} r={r}
                      fill={heatColor(h.score, active ? (isSelected ? 1 : 0.88) : 0.18)}
                      stroke={isSelected ? '#fff' : 'none'}
                      strokeWidth={isSelected ? 1.5 : 0}
                      style={{ transition: 'fill 0.35s' }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Selected hotspot tooltip */}
            {selected && (() => {
              const m = SEV_META[selected.severity];
              return (
                <div style={{ position: 'absolute', bottom: 24, left: 24, background: '#0f172a', color: '#fff', borderRadius: 14, padding: '14px 16px', maxWidth: 270, boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 0 20px rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <MapPin size={11} style={{ color: heatColor(selected.score), flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{selected.name}</span>
                      </div>
                      {selected.state && <p style={{ fontSize: 11, color: '#94a3b8', marginLeft: 17 }}>{selected.state}</p>}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: m.bg, color: m.color, border: `1px solid ${m.border}`, textTransform: 'capitalize', whiteSpace: 'nowrap', marginLeft: 8 }}>
                      {selected.severity}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: selected.trend ? 8 : 0 }}>
                    {[
                      { l: 'Intensity', v: `${(selected.score * 100).toFixed(0)}%`, c: heatColor(selected.score) },
                      { l: 'Vehicles',  v: selected.vehicles?.toLocaleString() ?? '—', c: '#60a5fa' },
                      { l: 'Speed',     v: selected.speed != null ? `${selected.speed} km/h` : '—', c: '#a78bfa' },
                    ].map(({ l, v, c }) => (
                      <div key={l} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '7px 9px' }}>
                        <p style={{ fontSize: 9.5, color: '#64748b', marginBottom: 3 }}>{l}</p>
                        <p style={{ fontSize: 13, fontWeight: 800, color: c }}>{v}</p>
                      </div>
                    ))}
                  </div>
                  {selected.trend && (
                    <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <TrendBadge trend={selected.trend} />
                    </div>
                  )}
                  <button
                    onClick={() => setSelected(null)}
                    style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 18, lineHeight: 1, padding: 2 }}
                  >
                    ×
                  </button>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── Hotspot list ──────────────────────────────────────── */}
        <div className="neon-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* List header: title + filter pills */}
          <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontWeight: 700, fontSize: 13.5, color: '#111827' }}>Top Hotspots</p>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{displayed.length} shown</span>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {FILTERS.map((f) => {
                const isActive = filter === f;
                const meta     = f !== 'all' ? SEV_META[f] : null;
                const count    = sevCounts[f];
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 10.5, fontWeight: 700,
                      padding: '3px 10px', borderRadius: 99,
                      border: isActive ? 'none' : '1px solid #e5e7eb',
                      cursor: 'pointer',
                      background: isActive ? (meta ? meta.color : '#1e3a5f') : '#fff',
                      color:      isActive ? '#fff' : (meta ? meta.color : '#6b7280'),
                      transition: 'all 0.15s',
                      boxShadow: isActive ? `0 0 10px ${meta ? meta.color : '#3b82f6'}60` : 'none',
                    }}
                  >
                    {f === 'all' ? 'All' : meta!.label}
                    <span style={{
                      fontSize: 9.5, fontWeight: 800, minWidth: 14, textAlign: 'center',
                      padding: '0 4px', borderRadius: 99,
                      background: isActive ? 'rgba(255,255,255,0.22)' : (meta ? meta.bg : '#f1f5f9'),
                      color:      isActive ? '#fff' : (meta ? meta.color : '#6b7280'),
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable list */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 520 }}>
            {isLoading ? (
              <LoadingSkeleton />
            ) : displayed.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#9ca3af' }}>No hotspots for this filter.</p>
                <button
                  onClick={() => setFilter('all')}
                  style={{ marginTop: 8, fontSize: 12.5, color: '#3b82f6', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Show all
                </button>
              </div>
            ) : (
              displayed.map((h, i) => {
                const m          = SEV_META[h.severity];
                const isSelected = selected?.name === h.name;
                return (
                  <div
                    key={`${h.name}-${i}`}
                    onClick={() => setSelected(isSelected ? null : h)}
                    style={{
                      padding: '11px 16px',
                      borderBottom: '1px solid #f9fafb',
                      borderLeft: `3px solid ${isSelected ? '#3b82f6' : m.color}`,
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(59,130,246,0.04)' : 'transparent',
                      transition: 'background 0.12s',
                      boxShadow: isSelected ? 'inset 3px 0 0 rgba(59,130,246,0.3)' : 'none',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#fafafa'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Rank */}
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#d1d5db', width: 20, flexShrink: 0, textAlign: 'right' }}>#{i + 1}</span>
                      {/* Vertical score bar */}
                      <div style={{ width: 4, height: 42, borderRadius: 99, background: '#f1f5f9', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${h.score * 100}%`, background: m.color, borderRadius: 99, transition: 'height 0.5s ease', boxShadow: `0 0 6px ${m.color}80` }} />
                      </div>
                      {/* Name / state / trend */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</p>
                        {h.state && <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{h.state}</p>}
                        <div style={{ marginTop: 3 }}>
                          <TrendBadge trend={h.trend} />
                        </div>
                      </div>
                      {/* Score + severity badge */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 17, fontWeight: 800, color: m.color, lineHeight: 1 }}>{(h.score * 100).toFixed(0)}%</p>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: m.bg, color: m.color, border: `1px solid ${m.border}`, textTransform: 'capitalize', letterSpacing: '0.02em', marginTop: 4, display: 'inline-block' }}>
                          {h.severity}
                        </span>
                      </div>
                    </div>

                    {/* Vehicles + speed inline */}
                    {(h.vehicles != null || h.speed != null) && (
                      <div style={{ display: 'flex', gap: 14, marginTop: 5, marginLeft: 34 }}>
                        {h.vehicles != null && (
                          <span style={{ fontSize: 10.5, color: '#9ca3af' }}>
                            <span style={{ fontWeight: 700, color: '#374151' }}>{h.vehicles.toLocaleString()}</span> vehicles
                          </span>
                        )}
                        {h.speed != null && (
                          <span style={{ fontSize: 10.5, color: '#9ca3af' }}>
                            <span style={{ fontWeight: 700, color: '#374151' }}>{h.speed}</span> km/h
                          </span>
                        )}
                      </div>
                    )}

                    {/* Progress bar */}
                    <div style={{ height: 3, borderRadius: 99, background: '#f1f5f9', marginTop: 7, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${h.score * 100}%`, background: m.color, borderRadius: 99, transition: 'width 0.5s ease', boxShadow: `0 0 6px ${m.color}60` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* List footer */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              {filter !== 'all' && (
                <button
                  onClick={() => setFilter('all')}
                  style={{ fontSize: 11.5, color: '#3b82f6', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  ← Clear filter
                </button>
              )}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#9ca3af' }}>
              <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              Live · {countdown}s
            </span>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
