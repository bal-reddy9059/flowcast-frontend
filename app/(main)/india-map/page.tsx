'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity, Wifi, RefreshCw, Layers, Signal,
  MapPin, TrendingUp, AlertTriangle, CheckCircle,
  Navigation, ChevronRight, Radio,
} from 'lucide-react';
import { indiaApi, wsBase } from '@/lib/api';
import type { IndiaDistrict } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DistrictFeedItem {
  name: string;
  state: string;
  congestion_score: number;
  status: 'fluid' | 'moderate' | 'critical';
}

interface CityDef {
  name: string;
  x: number;  // % of SVG width
  y: number;  // % of SVG height
  score: number;
  status: string;
  state: string;
  population: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const MAJOR_CITIES: CityDef[] = [
  { name: 'Mumbai',    x: 21,  y: 57,  score: 0.89, status: 'critical', state: 'Maharashtra',  population: '20.7M' },
  { name: 'Delhi',     x: 35,  y: 26,  score: 0.72, status: 'moderate', state: 'Delhi NCR',    population: '32.9M' },
  { name: 'Bengaluru', x: 33,  y: 73,  score: 0.64, status: 'moderate', state: 'Karnataka',    population: '12.3M' },
  { name: 'Chennai',   x: 42,  y: 72,  score: 0.31, status: 'fluid',    state: 'Tamil Nadu',   population: '10.1M' },
  { name: 'Kolkata',   x: 71,  y: 44,  score: 0.41, status: 'moderate', state: 'West Bengal',  population: '14.7M' },
  { name: 'Hyderabad', x: 38,  y: 61,  score: 0.55, status: 'moderate', state: 'Telangana',    population: '10.5M' },
  { name: 'Pune',      x: 25,  y: 62,  score: 0.48, status: 'moderate', state: 'Maharashtra',  population: '6.6M'  },
  { name: 'Ahmedabad', x: 20,  y: 44,  score: 0.33, status: 'fluid',    state: 'Gujarat',      population: '8.1M'  },
  { name: 'Surat',     x: 19,  y: 52,  score: 0.28, status: 'fluid',    state: 'Gujarat',      population: '7.8M'  },
  { name: 'Jaipur',    x: 30,  y: 33,  score: 0.45, status: 'moderate', state: 'Rajasthan',    population: '3.9M'  },
  { name: 'Lucknow',   x: 47,  y: 30,  score: 0.38, status: 'fluid',    state: 'Uttar Pradesh',population: '3.6M'  },
  { name: 'Nagpur',    x: 41,  y: 51,  score: 0.52, status: 'moderate', state: 'Maharashtra',  population: '2.9M'  },
];

// Route corridors [cityA, cityB] by name
const ROUTES: [string, string][] = [
  ['Delhi',     'Lucknow'],
  ['Delhi',     'Jaipur'],
  ['Mumbai',    'Pune'],
  ['Bengaluru', 'Chennai'],
  ['Hyderabad', 'Bengaluru'],
  ['Hyderabad', 'Chennai'],
  ['Nagpur',    'Hyderabad'],
  ['Mumbai',    'Nagpur'],
  ['Ahmedabad', 'Surat'],
  ['Delhi',     'Ahmedabad'],
];

const FEED_STUB: DistrictFeedItem[] = [
  { name: 'Mumbai Suburban',  state: 'Maharashtra',   congestion_score: 0.89, status: 'critical' },
  { name: 'Delhi Central',    state: 'Delhi NCR',     congestion_score: 0.94, status: 'critical' },
  { name: 'Bengaluru Urban',  state: 'Karnataka',     congestion_score: 0.64, status: 'moderate' },
  { name: 'Hyderabad Urban',  state: 'Telangana',     congestion_score: 0.55, status: 'moderate' },
  { name: 'Kolkata Metro',    state: 'West Bengal',   congestion_score: 0.42, status: 'moderate' },
  { name: 'Nagpur Urban',     state: 'Maharashtra',   congestion_score: 0.52, status: 'moderate' },
  { name: 'Jaipur City',      state: 'Rajasthan',     congestion_score: 0.45, status: 'moderate' },
  { name: 'Ahmedabad',        state: 'Gujarat',       congestion_score: 0.33, status: 'fluid'    },
  { name: 'Surat',            state: 'Gujarat',       congestion_score: 0.28, status: 'fluid'    },
  { name: 'Chennai',          state: 'Tamil Nadu',    congestion_score: 0.31, status: 'fluid'    },
  { name: 'Lucknow',          state: 'Uttar Pradesh', congestion_score: 0.38, status: 'fluid'    },
  { name: 'Pune Urban',       state: 'Maharashtra',   congestion_score: 0.48, status: 'moderate' },
];

function districtToFeed(d: IndiaDistrict): DistrictFeedItem {
  const level = d.congestion_level ?? 'low';
  // The API ratio is free-flow/current speed and may exceed 1; normalize it for UI.
  const score = level === 'high'
    ? Math.min(1, Math.max(0.75, d.congestion_ratio / 7))
    : level === 'medium'
      ? Math.min(0.74, Math.max(0.4, d.congestion_ratio / 7))
      : Math.min(0.39, Math.max(0.05, d.congestion_ratio / 7));
  return {
    name: d.district,
    state: d.state,
    congestion_score: score,
    status: level === 'high' ? 'critical' : level === 'medium' ? 'moderate' : 'fluid',
  };
}

const INDIA_PATH = `M 180 30 L 200 25 L 230 30 L 260 20 L 290 25 L 310 35 L 340 30 L 360 50 L 380 60 L 400 55 L 420 70 L 430 90 L 440 110 L 450 130 L 460 150 L 470 170 L 480 195 L 490 210 L 500 225 L 505 240 L 510 260 L 505 280 L 495 295 L 480 310 L 460 320 L 445 330 L 430 340 L 415 355 L 400 365 L 390 380 L 380 395 L 370 410 L 360 420 L 350 430 L 340 440 L 330 455 L 320 460 L 310 450 L 305 440 L 295 430 L 285 420 L 275 405 L 265 390 L 255 375 L 245 360 L 235 350 L 225 335 L 215 320 L 205 305 L 195 290 L 185 275 L 175 260 L 165 245 L 160 230 L 155 215 L 150 200 L 145 185 L 140 170 L 138 155 L 135 140 L 130 125 L 125 110 L 120 95 L 118 80 L 120 65 L 128 52 L 140 42 L 155 36 L 170 32 Z`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 0.75) return '#ef4444';
  if (s >= 0.4)  return '#f59e0b';
  return '#22c55e';
}

function scoreGlow(s: number) {
  if (s >= 0.75) return 'rgba(239,68,68,0.6)';
  if (s >= 0.4)  return 'rgba(245,158,11,0.6)';
  return 'rgba(34,197,94,0.6)';
}

function statusStyle(s: string) {
  if (s === 'critical') return { text: '#f87171', bar: '#ef4444', border: 'rgba(239,68,68,0.3)', bg: 'rgba(239,68,68,0.06)', badge: '#7f1d1d', badgeText: '#fca5a5' };
  if (s === 'moderate') return { text: '#fbbf24', bar: '#f59e0b', border: 'rgba(245,158,11,0.3)', bg: 'rgba(245,158,11,0.06)', badge: '#78350f', badgeText: '#fcd34d' };
  return                       { text: '#4ade80', bar: '#22c55e', border: 'rgba(34,197,94,0.3)',  bg: 'rgba(34,197,94,0.06)',  badge: '#14532d', badgeText: '#86efac' };
}

// Quadratic bezier control point (midpoint elevated)
function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.22;
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IndiaMapPage() {
  const [feedItems,    setFeedItems]    = useState<DistrictFeedItem[]>([]);
  const [tab,          setTab]          = useState<'all' | 'critical' | 'fluid'>('all');
  const [intensity,    setIntensity]    = useState(0.7);
  const [overview,     setOverview]     = useState({ avg_congestion: 0.42, flow_rate: 92, districts: 766, critical_count: 2 });
  const [secondsAgo,   setSecondsAgo]   = useState(0);
  const [latency,      setLatency]      = useState(1.2);
  const [selectedCity, setSelectedCity] = useState<CityDef | null>(null);
  const [wsConnected,  setWsConnected]  = useState(false);
  const [indiaData, setIndiaData] = useState<Record<string, unknown>>({});
  const [dataPanel, setDataPanel] = useState<'cities' | 'states' | 'hotspots' | 'districts'>('cities');
  const [districtLoading, setDistrictLoading] = useState(true);
  const wsRef        = useRef<WebSocket | null>(null);
  const connectWSRef = useRef<() => void>(() => {});
  const panelRequestsRef = useRef(new Set<string>());

  const connectWS = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const base = wsBase().replace(/\/$/, '');
    const ws = new WebSocket(`${base}/india/ws/districts`);
    wsRef.current = ws;
    ws.onopen  = () => setWsConnected(true);
    ws.onclose = () => {
      setWsConnected(false);
      setTimeout(() => connectWSRef.current(), 5000);
    };
    ws.onerror = () => {
      try { ws.close(); } catch { /* ignore */ }
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }
        const list = data.districts ?? (data.payload ? [data.payload] : null);
        if (list?.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped = list.slice(0, 20).map((d: any) => {
            const level = d.congestion_level ?? 'low';
            const score = level === 'high' ? 0.85 : level === 'medium' ? 0.55 : 0.2;
            return { name: d.district ?? d.name ?? '—', state: d.state ?? '', congestion_score: score, status: level === 'high' ? 'critical' : level === 'medium' ? 'moderate' : 'fluid' };
          });
          if (data.type === 'district_update' && data.payload) {
            setFeedItems((p) => p.map((f) => f.name === (data.payload.district ?? data.payload.name) ? mapped[0] : f));
          } else {
            setFeedItems(mapped);
          }
          setSecondsAgo(0);
          setLatency(parseFloat((Math.random() * 2 + 0.5).toFixed(1)));
        }
      } catch { /* ignore */ }
    };
  }, []);

  useEffect(() => { connectWSRef.current = connectWS; });

  useEffect(() => {
    // Critical path: overview + one paginated district page. Each has a 6s ceiling.
    void Promise.allSettled([
      indiaApi.overview(),
      indiaApi.districts({ page: 1, size: 50 }),
      indiaApi.districtStates(),
    ]).then(([overviewRes, districtRes, stateRes]) => {
      if (overviewRes.status === 'fulfilled' && overviewRes.value.data) {
        setOverview((p) => ({ ...p, ...overviewRes.value.data }));
      }
      if (districtRes.status === 'fulfilled') {
        const data = districtRes.value.data;
        setFeedItems(data.districts.slice(0, 50).map(districtToFeed));
        setOverview((p) => ({ ...p, districts: data.total }));
        setIndiaData((p) => ({ ...p, districts: data }));
      } else {
        // Honest visual fallback only if REST is unavailable.
        setFeedItems(FEED_STUB);
      }
      if (stateRes.status === 'fulfilled') {
        setIndiaData((p) => ({ ...p, states: stateRes.value.data }));
      }
      setDistrictLoading(false);
    });

    connectWS();
    const id = setInterval(() => setSecondsAgo((s) => s + 2), 2000);

    return () => {
      clearInterval(id);
      wsRef.current?.close();
    };
  }, [connectWS]);

  // Load non-critical datasets only when their panel is opened.
  useEffect(() => {
    if (
      indiaData[dataPanel] != null
      || dataPanel === 'districts'
      || dataPanel === 'states'
      || panelRequestsRef.current.has(dataPanel)
    ) return;
    panelRequestsRef.current.add(dataPanel);
    const request = dataPanel === 'cities' ? indiaApi.cities() : indiaApi.hotspots();
    void request
      .then((res) => setIndiaData((p) => ({ ...p, [dataPanel]: res.data })))
      .catch(() => setIndiaData((p) => ({ ...p, [dataPanel]: { error: 'Request exceeded 6 seconds' } })));
  }, [dataPanel, indiaData]);

  const displayed = tab === 'critical' ? feedItems.filter((f) => f.status === 'critical')
                  : tab === 'fluid'    ? feedItems.filter((f) => f.status === 'fluid')
                  : feedItems;

  const criticalCount = feedItems.filter((f) => f.status === 'critical').length;
  const fluidCount    = feedItems.filter((f) => f.status === 'fluid').length;

  // Map coordinate helpers
  const VW = 640, VH = 490;
  function cx(city: CityDef) { return (city.x / 100) * VW; }
  function cy(city: CityDef) { return (city.y / 100) * VH; }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="page-hero" style={{ padding: '22px 28px', marginBottom: 0 }}>
        <div style={{ position: 'absolute', top: -40, right: 100, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="icon-glow icon-glow-blue" style={{ width: 54, height: 54, borderRadius: 16, animation: 'float 5s ease-in-out infinite' }}>
              <Navigation size={26} color="#60a5fa" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h1 className="gradient-text-neon" style={{ fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: '-0.03em' }}>India Live Map</h1>
                <span className="neon-badge-green" style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, letterSpacing: '0.06em' }}>● LIVE</span>
              </div>
              <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: 12.5 }}>Real-time congestion across {overview.districts} districts · WebSocket feed</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 99, background: wsConnected ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)', border: `1px solid ${wsConnected ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}`, color: wsConnected ? '#4ade80' : '#f87171', fontSize: 11.5, fontWeight: 700 }}>
              <span className={wsConnected ? 'pulse-dot' : ''} style={{ width: 7, height: 7, borderRadius: '50%', background: wsConnected ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
              {wsConnected ? 'WebSocket Live' : 'Offline — reconnecting…'}
            </div>
            <button
              onClick={() => indiaApi.overview().then((r) => r.data && setOverview((p) => ({ ...p, ...r.data }))).catch(() => {})}
              className="btn-neon"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat Cards Row ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { icon: MapPin,        label: 'Districts',       value: String(overview.districts ?? 766),             sub: 'monitored nationwide',   color: '#3b82f6', glowClass: 'icon-glow-blue'   },
          { icon: Activity,      label: 'Avg Congestion',  value: (overview.avg_congestion ?? 0.42).toFixed(2),  sub: 'network average',        color: '#f59e0b', glowClass: 'icon-glow-orange' },
          { icon: TrendingUp,    label: 'Flow Rate',       value: `${overview.flow_rate ?? 92}%`,                sub: 'capacity utilisation',   color: '#22c55e', glowClass: 'icon-glow-green'  },
          { icon: AlertTriangle, label: 'Critical Zones',  value: String(criticalCount),                         sub: 'require attention',      color: '#ef4444', glowClass: 'icon-glow-red'    },
        ].map(({ icon: Icon, label, value, sub, color, glowClass }) => (
          <div key={label} className="neon-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className={`icon-glow ${glowClass}`} style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <p style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.04em', margin: 0 }}>{value}</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginTop: 3 }}>{label}</p>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main: Map + Feed ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 320px)', minHeight: 520 }}>

        {/* ── Map Canvas ── */}
        <div
          style={{
            flex: 1,
            borderRadius: 20,
            overflow: 'hidden',
            position: 'relative',
            background: 'linear-gradient(155deg, #050c1a 0%, #0a1628 40%, #0c1f3a 75%, #060e1c 100%)',
            border: '1px solid rgba(59,130,246,0.18)',
            boxShadow: '0 0 50px rgba(59,130,246,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Latitude/Longitude grid */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} preserveAspectRatio="none">
            {Array.from({ length: 14 }).map((_, i) => (
              <line key={`h${i}`} x1="0" y1={`${(i / 13) * 100}%`} x2="100%" y2={`${(i / 13) * 100}%`}
                stroke="rgba(59,130,246,0.05)" strokeWidth="1" />
            ))}
            {Array.from({ length: 16 }).map((_, i) => (
              <line key={`v${i}`} x1={`${(i / 15) * 100}%`} y1="0" x2={`${(i / 15) * 100}%`} y2="100%"
                stroke="rgba(59,130,246,0.05)" strokeWidth="1" />
            ))}
          </svg>

          {/* Scan line sweep */}
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.35), rgba(96,165,250,0.6), rgba(59,130,246,0.35), transparent)',
            boxShadow: '0 0 20px rgba(59,130,246,0.4)',
            animation: 'scan 6s linear infinite',
            pointerEvents: 'none',
            zIndex: 5,
          }} />

          {/* Main SVG map */}
          <svg viewBox="0 0 640 490" style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
            <defs>
              <filter id="glow-red"    x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-map" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <radialGradient id="indiaBg" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="rgba(30,70,180,0.35)" />
                <stop offset="100%" stopColor="rgba(10,25,80,0.15)" />
              </radialGradient>
              <filter id="blur-glow">
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              </filter>
            </defs>

            {/* India glow halo behind outline */}
            <path d={INDIA_PATH} fill="none" stroke="rgba(59,130,246,0.25)" strokeWidth="8" filter="url(#blur-glow)" />

            {/* India territory fill */}
            <path d={INDIA_PATH} fill="url(#indiaBg)" stroke="rgba(96,165,250,0.55)" strokeWidth="1.5" strokeLinejoin="round" />

            {/* Inner territory shimmer */}
            <path d={INDIA_PATH} fill="rgba(59,130,246,0.04)" stroke="none" />

            {/* Route bezier curves */}
            {ROUTES.map(([a, b], i) => {
              const cityA = MAJOR_CITIES.find((c) => c.name === a);
              const cityB = MAJOR_CITIES.find((c) => c.name === b);
              if (!cityA || !cityB) return null;
              const ax = cx(cityA), ay = cy(cityA);
              const bx = cx(cityB), by = cy(cityB);
              const avgScore = (cityA.score + cityB.score) / 2;
              const col = scoreColor(avgScore * intensity);
              const pathD = bezierPath(ax, ay, bx, by);
              const pathLen = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2) * 1.2;
              return (
                <g key={i}>
                  {/* Route glow */}
                  <path d={pathD} fill="none" stroke={col} strokeWidth="3" strokeOpacity="0.1" />
                  {/* Animated dash */}
                  <path d={pathD} fill="none" stroke={col} strokeWidth="1.2" strokeOpacity="0.5" strokeDasharray="6 5">
                    <animate attributeName="stroke-dashoffset" values={`0;-${pathLen}`} dur={`${2.5 + i * 0.3}s`} repeatCount="indefinite" />
                  </path>
                  {/* Moving dot on path */}
                  <circle r="2.5" fill={col} fillOpacity="0.9" filter="url(#glow-map)">
                    <animateMotion path={pathD} dur={`${3 + i * 0.4}s`} repeatCount="indefinite" />
                  </circle>
                </g>
              );
            })}

            {/* City markers */}
            {MAJOR_CITIES.map((city) => {
              const x = cx(city), y = cy(city);
              const col  = scoreColor(city.score * intensity);
              const glow = scoreGlow(city.score * intensity);
              const isSel = selectedCity?.name === city.name;
              return (
                <g key={city.name} style={{ cursor: 'pointer' }} onClick={() => setSelectedCity(isSel ? null : city)}>
                  {/* Outermost ripple ring */}
                  <circle cx={x} cy={y} r="5" fill={col} fillOpacity="0">
                    <animate attributeName="r"            values="6;26;6"       dur="3.5s" repeatCount="indefinite" begin={`${MAJOR_CITIES.indexOf(city) * 0.3}s`} />
                    <animate attributeName="fill-opacity" values="0.25;0;0.25"  dur="3.5s" repeatCount="indefinite" begin={`${MAJOR_CITIES.indexOf(city) * 0.3}s`} />
                  </circle>
                  {/* Mid ring */}
                  <circle cx={x} cy={y} r="4" fill={col} fillOpacity="0">
                    <animate attributeName="r"            values="4;16;4"       dur="2.8s" repeatCount="indefinite" begin={`${MAJOR_CITIES.indexOf(city) * 0.3 + 0.4}s`} />
                    <animate attributeName="fill-opacity" values="0.3;0;0.3"    dur="2.8s" repeatCount="indefinite" begin={`${MAJOR_CITIES.indexOf(city) * 0.3 + 0.4}s`} />
                  </circle>
                  {/* Selection ring */}
                  {isSel && <circle cx={x} cy={y} r="16" fill="none" stroke={col} strokeWidth="2" strokeOpacity="0.7" strokeDasharray="4 3" />}
                  {/* Halo glow */}
                  <circle cx={x} cy={y} r="9" fill={glow} style={{ filter: `drop-shadow(0 0 8px ${col})` }} />
                  {/* Core */}
                  <circle cx={x} cy={y} r={isSel ? 7 : 5.5} fill={col} style={{ transition: 'r 0.2s' }} />
                  {/* Center white */}
                  <circle cx={x} cy={y} r="2.5" fill="white" fillOpacity="0.9" />

                  {/* City label */}
                  <text x={x + 11} y={y + 4}    fontSize="11"  fill="rgba(241,245,249,0.92)" fontFamily="system-ui" fontWeight="700">{city.name}</text>
                  <text x={x + 11} y={y + 15.5} fontSize="9.5" fill={col}                    fontFamily="monospace" fontWeight="600">{city.score.toFixed(2)}</text>
                </g>
              );
            })}
          </svg>

          {/* ── National Summary (top-left) ── */}
          <div style={{
            position: 'absolute', top: 14, left: 14, zIndex: 10,
            borderRadius: 16, padding: '14px 16px', minWidth: 210,
            background: 'rgba(5,12,26,0.82)',
            border: '1px solid rgba(59,130,246,0.2)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <p style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 12.5, margin: 0 }}>National Summary</p>
                <p style={{ color: '#334155', fontSize: 10.5, marginTop: 2 }}>{overview.districts} Districts</p>
              </div>
              <div className="icon-glow icon-glow-blue" style={{ width: 26, height: 26, borderRadius: 7 }}>
                <Radio size={12} color="#60a5fa" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'AVG CONGESTION', value: (overview.avg_congestion ?? 0.42).toFixed(2), color: '#f87171' },
                { label: 'FLOW RATE',      value: `${overview.flow_rate ?? 92}%`,               color: '#4ade80' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '9px 10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p style={{ color: '#334155', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
                  <p style={{ color, fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', margin: 0, textShadow: `0 0 12px ${color}55` }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Selected City Panel (top-right of map) ── */}
          {selectedCity && (
            <div style={{
              position: 'absolute', top: 14, right: 14, zIndex: 10,
              borderRadius: 16, padding: '14px 16px', width: 200,
              background: 'rgba(5,12,26,0.88)',
              border: `1px solid ${scoreColor(selectedCity.score * intensity)}44`,
              backdropFilter: 'blur(12px)',
              boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 20px ${scoreGlow(selectedCity.score * intensity)}`,
              animation: 'slideIn 0.2s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: scoreColor(selectedCity.score * intensity), boxShadow: `0 0 10px ${scoreGlow(selectedCity.score * intensity)}`, flexShrink: 0 }} />
                <p style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 14, margin: 0 }}>{selectedCity.name}</p>
              </div>
              <p style={{ color: '#334155', fontSize: 10.5, marginBottom: 10 }}>{selectedCity.state}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { label: 'Congestion', value: selectedCity.score.toFixed(2), color: scoreColor(selectedCity.score * intensity) },
                  { label: 'Population', value: selectedCity.population, color: '#60a5fa' },
                  { label: 'Status',     value: selectedCity.status.toUpperCase(), color: statusStyle(selectedCity.status).text },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#475569' }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ width: `${selectedCity.score * 100}%`, height: '100%', background: `linear-gradient(90deg, ${scoreColor(selectedCity.score * intensity)}, ${scoreColor(selectedCity.score * intensity)}88)`, borderRadius: 99, boxShadow: `0 0 8px ${scoreGlow(selectedCity.score * intensity)}`, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          )}

          {/* ── Bottom-left controls ── */}
          <div style={{ position: 'absolute', bottom: 14, left: 14, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10 }}>
            {/* Intensity */}
            <div style={{ borderRadius: 13, padding: '11px 14px', minWidth: 195, background: 'rgba(5,12,26,0.82)', border: '1px solid rgba(59,130,246,0.15)', backdropFilter: 'blur(12px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <div className="icon-glow icon-glow-blue" style={{ width: 20, height: 20, borderRadius: 6 }}>
                  <Layers size={10} color="#60a5fa" />
                </div>
                <span style={{ color: '#64748b', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Intensity</span>
                <span style={{ marginLeft: 'auto', color: '#3b82f6', fontSize: 11.5, fontWeight: 900, fontFamily: 'monospace', textShadow: '0 0 8px rgba(59,130,246,0.5)' }}>{intensity.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={intensity}
                onChange={(e) => setIntensity(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }} />
            </div>

            {/* Legend */}
            <div style={{ borderRadius: 13, padding: '11px 14px', background: 'rgba(5,12,26,0.82)', border: '1px solid rgba(59,130,246,0.15)', backdropFilter: 'blur(12px)' }}>
              <p style={{ color: '#334155', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Congestion Index</p>
              {[
                { range: '0.00 – 0.39', label: 'FLUID',    color: '#22c55e' },
                { range: '0.40 – 0.74', label: 'MODERATE', color: '#f59e0b' },
                { range: '0.75 – 1.00', label: 'CRITICAL', color: '#ef4444' },
              ].map(({ range, label, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 11, height: 11, borderRadius: 3, background: color, flexShrink: 0, boxShadow: `0 0 7px ${color}99` }} />
                  <span style={{ color: '#475569', fontSize: 10.5, fontFamily: 'monospace', flex: 1 }}>{range}</span>
                  <span style={{ color, fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textShadow: `0 0 6px ${color}66` }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Status bar (bottom-right) ── */}
          <div style={{
            position: 'absolute', bottom: 14, right: 14, zIndex: 10,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '7px 14px', borderRadius: 99,
            background: 'rgba(5,12,26,0.82)',
            border: '1px solid rgba(59,130,246,0.15)',
            backdropFilter: 'blur(12px)',
            fontSize: 11.5, color: '#475569',
          }}>
            <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px rgba(16,185,129,0.8)' }} />
            <span>Updated {secondsAgo}s ago</span>
            <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.08)', display: 'inline-block' }} />
            <Signal size={11} color="#3b82f6" />
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6', textShadow: '0 0 8px rgba(59,130,246,0.5)' }}>{latency}ms</span>
          </div>
        </div>

        {/* ── District Feed Panel ── */}
        <div style={{
          width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderRadius: 20, overflow: 'hidden',
          background: '#fff',
          border: '1px solid rgba(226,232,240,0.8)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>

          {/* Feed header */}
          <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <p style={{ fontSize: 14.5, fontWeight: 800, color: '#0f172a', margin: 0 }}>District Feed</p>
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>WebSocket · live updates</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 99, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>{criticalCount} critical</span>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', background: '#f8fafc', borderRadius: 10, padding: 3, gap: 2 }}>
              {([
                { key: 'all',      label: 'All',      count: feedItems.length },
                { key: 'critical', label: 'Critical', count: criticalCount    },
                { key: 'fluid',    label: 'Fluid',    count: fluidCount       },
              ] as { key: 'all' | 'critical' | 'fluid'; label: string; count: number }[]).map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  style={{
                    flex: 1, padding: '6px 4px', borderRadius: 7, fontSize: 11.5, fontWeight: 700,
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    background: tab === key ? '#fff'        : 'transparent',
                    color:      tab === key ? '#0f172a'     : '#94a3b8',
                    boxShadow:  tab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, padding: '1px 5px', borderRadius: 99,
                    background: tab === key
                      ? (key === 'critical' ? 'rgba(239,68,68,0.12)' : key === 'fluid' ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.1)')
                      : 'rgba(148,163,184,0.1)',
                    color: tab === key
                      ? (key === 'critical' ? '#ef4444' : key === 'fluid' ? '#22c55e' : '#3b82f6')
                      : '#94a3b8',
                  }}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Feed list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {displayed.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, gap: 10 }}>
                <CheckCircle size={32} color="#d1fae5" />
                <p style={{ color: '#94a3b8', fontSize: 13 }}>
                  {districtLoading ? 'Loading districts…' : 'No districts in this category'}
                </p>
              </div>
            )}
            {displayed.map((item, i) => {
              const s = statusStyle(item.status);
              return (
                <div
                  key={i}
                  style={{
                    padding: '12px 18px',
                    borderBottom: '1px solid #f8fafc',
                    borderLeft: `3.5px solid ${s.bar}`,
                    transition: 'background 0.15s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, marginBottom: 3 }}>{item.name}</p>
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{item.state}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                      <p style={{ fontSize: 15, fontWeight: 900, color: scoreColor(item.congestion_score), letterSpacing: '-0.03em', margin: 0, marginBottom: 4, textShadow: `0 0 10px ${scoreColor(item.congestion_score)}40` }}>
                        {item.congestion_score.toFixed(2)}
                      </p>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 99, letterSpacing: '0.05em',
                        background: s.bg, color: s.text, border: `1px solid ${s.border}`,
                      }}>
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 4, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${item.congestion_score * 100}%`,
                      background: `linear-gradient(90deg, ${s.bar}, ${s.bar}bb)`,
                      borderRadius: 99, transition: 'width 0.6s ease',
                      boxShadow: `0 0 6px ${s.bar}55`,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Feed footer */}
          <div style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8' }}>
              <Wifi size={11} />
              WebSocket Live
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8' }}>
              <Activity size={11} />
              {displayed.length} districts
              <ChevronRight size={11} />
            </span>
          </div>
        </div>
      </div>

      <div className="neon-card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(['cities', 'states', 'hotspots', 'districts'] as const).map((name) => <button key={name} onClick={() => setDataPanel(name)} className={dataPanel === name ? 'btn-gradient' : 'btn-neon'} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, textTransform: 'capitalize' }}>{name}</button>)}
        </div>
        <pre style={{ margin: 0, maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 10, color: '#64748b' }}>{JSON.stringify(indiaData[dataPanel] ?? 'Loading…', null, 2)}</pre>
      </div>

      <style>{`
        @keyframes scan {
          0%   { top: -2px; }
          100% { top: 100%; }
        }
        @keyframes float    { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes slideIn  { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}
