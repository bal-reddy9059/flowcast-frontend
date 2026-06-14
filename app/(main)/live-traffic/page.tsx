'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Car, Zap, Navigation2, AlertTriangle, CheckCircle2,
  Play, Square, TrendingUp, TrendingDown, Minus, MapPin,
  Signal, RefreshCw, Brain, Activity, Clock, Gauge,
  Radio, ArrowRight, Cpu, CloudLightning,
} from 'lucide-react';
import api, { wsBase } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface CarEvent {
  car_id?: string;
  location?: string;
  city?: string;
  speed?: number;
  congestion?: number;
  timestamp?: string;
}

interface PulseEvent {
  event_type?: string;
  location?: string;
  severity?: string;
  message?: string;
  congestion_before?: number;
  congestion_after?: number;
  timestamp?: string;
}

interface MlPrediction {
  hour: number;
  label: string;
  confidence: number;
}

interface MlLiveData {
  predictions?: MlPrediction[];
  active_incidents?: number;
  avg_speed?: number;
  congestion_level?: string;
  timestamp?: string;
}

interface TripEta {
  session_id?: string;
  eta_minutes?: number;
  trend?: string;
  current_congestion?: number;
  distance_remaining?: number;
  route?: string;
}

interface ShouldLeaveData {
  should_leave_now?: boolean;
  recommendation?: string;
  best_departure_time?: string;
  current_score?: number;
  forecast_score?: number;
  reason?: string;
}

// ── Stubs ─────────────────────────────────────────────────────────────────────

const CITIES = ['Mumbai', 'Delhi NCR', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Surat', 'Jaipur'];
const ROADS  = ['Expressway', 'Ring Road', 'Bypass', 'NH-48', 'Flyover', 'Highway'];
const LOCATIONS = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur'];

function makeCarStub(seed: number): CarEvent {
  const city = CITIES[seed % CITIES.length];
  const road = ROADS[Math.floor(seed / CITIES.length) % ROADS.length];
  const cong = Math.min(1, Math.max(0, 0.3 + Math.sin(seed * 2.3 + Date.now() / 30000) * 0.35 + Math.random() * 0.15));
  const spd  = Math.floor(cong > 0.7 ? 8 + Math.random() * 18 : cong > 0.4 ? 22 + Math.random() * 28 : 52 + Math.random() * 28);
  return {
    car_id:     `CAR-${String(seed + 1).padStart(3, '0')}`,
    location:   `${city} ${road}`,
    city,
    speed:      spd,
    congestion: parseFloat(cong.toFixed(2)),
    timestamp:  new Date().toISOString(),
  };
}

const PULSE_STUBS: PulseEvent[] = [
  { event_type: 'spike', location: 'Mumbai Western Expressway', severity: 'critical', message: 'Congestion spiked — 95% capacity', congestion_before: 0.6,  congestion_after: 0.95, timestamp: new Date(Date.now() - 45000).toISOString() },
  { event_type: 'clear', location: 'Outer Ring Road, Bangalore', severity: 'low',    message: 'Traffic cleared — flow restored',  congestion_before: 0.82, congestion_after: 0.27, timestamp: new Date(Date.now() - 130000).toISOString() },
  { event_type: 'spike', location: 'Delhi NH-44',                severity: 'high',   message: 'Sudden congestion spike detected', congestion_before: 0.45, congestion_after: 0.82, timestamp: new Date(Date.now() - 310000).toISOString() },
  { event_type: 'clear', location: 'Hyderabad ORR',              severity: 'low',    message: 'Incident resolved — normalised',   congestion_before: 0.71, congestion_after: 0.32, timestamp: new Date(Date.now() - 490000).toISOString() },
  { event_type: 'spike', location: 'Pune Expressway',            severity: 'medium', message: 'Moderate congestion increase',     congestion_before: 0.30, congestion_after: 0.61, timestamp: new Date(Date.now() - 730000).toISOString() },
];

const SHOULD_LEAVE_STUB: ShouldLeaveData = {
  should_leave_now:     true,
  recommendation:       'Leave within the next 10 minutes',
  best_departure_time:  '07:45 AM',
  current_score:        68,
  forecast_score:       88,
  reason:               'Traffic on your route is currently moderate but will worsen significantly in 20 minutes due to peak office hours.',
};

const ML_LIVE_STUB: MlLiveData = {
  predictions: [
    { hour: 1, label: 'Medium', confidence: 0.87 },
    { hour: 2, label: 'High',   confidence: 0.79 },
    { hour: 3, label: 'Low',    confidence: 0.91 },
  ],
  active_incidents: 3,
  avg_speed:        42,
  congestion_level: 'medium',
  timestamp:        new Date().toISOString(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function congColor(c: number) {
  if (c >= 0.75) return '#ef4444';
  if (c >= 0.4)  return '#f59e0b';
  return '#22c55e';
}

function labelColor(label: string) {
  const map: Record<string, string> = { Low: '#22c55e', Medium: '#f59e0b', High: '#f97316', Critical: '#ef4444' };
  return map[label] ?? '#94a3b8';
}

function labelBg(label: string) {
  const map: Record<string, string> = { Low: 'rgba(34,197,94,0.1)', Medium: 'rgba(245,158,11,0.1)', High: 'rgba(249,115,22,0.1)', Critical: 'rgba(239,68,68,0.1)' };
  return map[label] ?? 'rgba(148,163,184,0.1)';
}

function labelBorder(label: string) {
  const map: Record<string, string> = { Low: 'rgba(34,197,94,0.25)', Medium: 'rgba(245,158,11,0.25)', High: 'rgba(249,115,22,0.25)', Critical: 'rgba(239,68,68,0.25)' };
  return map[label] ?? 'rgba(148,163,184,0.2)';
}

function pulseStyle(type: string, sev: string) {
  if (type === 'spike') {
    if (sev === 'critical') return { dot: '#ef4444', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.2)',  text: '#f87171', glow: 'rgba(239,68,68,0.15)' };
    if (sev === 'high')     return { dot: '#f97316', bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.2)', text: '#fb923c', glow: 'rgba(249,115,22,0.15)' };
    return                         { dot: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', text: '#fbbf24', glow: 'rgba(245,158,11,0.15)' };
  }
  return                           { dot: '#22c55e', bg: 'rgba(34,197,94,0.06)',  border: 'rgba(34,197,94,0.2)',  text: '#4ade80', glow: 'rgba(34,197,94,0.15)' };
}

function formatAge(iso?: string) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function TrendIcon({ trend }: { trend?: string }) {
  if (trend === 'worsening') return <TrendingDown size={14} color="#ef4444" />;
  if (trend === 'improving') return <TrendingUp   size={14} color="#22c55e" />;
  return <Minus size={14} color="#94a3b8" />;
}

// ── Circular Score Gauge ──────────────────────────────────────────────────────

function ScoreRing({ score, size = 72, label, color }: { score: number; size?: number; label: string; color: string }) {
  const r   = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={7} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: size / 4 }}>
        <span style={{ fontSize: size === 72 ? 20 : 16, fontWeight: 900, color, letterSpacing: '-0.03em' }}>{score}</span>
      </div>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
    </div>
  );
}

// ── WS Badge ─────────────────────────────────────────────────────────────────

function WsBadge({ label, on }: { label: string; on: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '5px 11px', borderRadius: 99,
      fontSize: 11, fontWeight: 700,
      background: on ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.10)',
      color:       on ? '#4ade80'              : '#f87171',
      border:      `1px solid ${on ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}`,
      boxShadow:   on ? '0 0 10px rgba(34,197,94,0.2)' : '0 0 8px rgba(239,68,68,0.15)',
    }}>
      <span className={on ? 'pulse-dot' : ''} style={{ width: 6, height: 6, borderRadius: '50%', background: on ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
      {label}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LiveTrafficPage() {
  const [carFeed,      setCarFeed]      = useState<CarEvent[]>(() => Array.from({ length: 18 }, (_, i) => makeCarStub(i)));
  const [pulseFeed,    setPulseFeed]    = useState<PulseEvent[]>(PULSE_STUBS);
  const [mlLive,       setMlLive]       = useState<MlLiveData>(ML_LIVE_STUB);
  const [shouldLeave,  setShouldLeave]  = useState<ShouldLeaveData>(SHOULD_LEAVE_STUB);
  const [location,     setLocation]     = useState('Mumbai');
  const [checkingAdv,  setCheckingAdv]  = useState(false);
  const [tripSession,  setTripSession]  = useState<string | null>(null);
  const [tripEta,      setTripEta]      = useState<TripEta | null>(null);
  const [startingTrip, setStartingTrip] = useState(false);
  const [wsLive,       setWsLive]       = useState(false);
  const [wsPulse,      setWsPulse]      = useState(false);
  const [wsMl,         setWsMl]         = useState(false);
  const [ticker,       setTicker]       = useState(0);
  const [nowTime,      setNowTime]      = useState('');

  const wsLiveRef  = useRef<WebSocket | null>(null);
  const wsPulseRef = useRef<WebSocket | null>(null);
  const wsMlRef    = useRef<WebSocket | null>(null);
  const wsTripRef  = useRef<WebSocket | null>(null);
  const connectLiveRef  = useRef<() => void>(() => {});
  const connectPulseRef = useRef<() => void>(() => {});
  const connectMlRef    = useRef<() => void>(() => {});

  // Live clock
  useEffect(() => {
    const update = () => setNowTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const connectLive = useCallback(() => {
    const ws = new WebSocket(`${wsBase()}/traffic/ws/live`);
    wsLiveRef.current = ws;
    ws.onopen  = () => setWsLive(true);
    ws.onclose = () => { setWsLive(false); setTimeout(() => connectLiveRef.current(), 5000); };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw: any[] = Array.isArray(d) ? d : d.cars ?? [d];
        if (!raw.length) return;
        const mapped: CarEvent[] = raw.slice(0, 20).map((c) => {
          const level = c.congestion_level ?? 'low';
          const cong  = level === 'high' ? 0.82 : level === 'medium' ? 0.52 : 0.18;
          return {
            car_id:     c.id ?? c.car_id,
            location:   c.location ?? c.city ?? '—',
            city:       c.city ?? c.location,
            speed:      c.speed_kmh ?? c.speed ?? 0,
            congestion: cong,
            timestamp:  c.timestamp,
          };
        });
        setCarFeed(mapped);
      } catch { /* ignore */ }
    };
  }, []);

  const connectPulse = useCallback(() => {
    const ws = new WebSocket(`${wsBase()}/traffic/ws/pulse`);
    wsPulseRef.current = ws;
    ws.onopen  = () => setWsPulse(true);
    ws.onclose = () => { setWsPulse(false); setTimeout(() => connectPulseRef.current(), 5000); };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === 'pulse_connected' || d.type === 'ping') return;
        if (d.type !== 'pulse_event') return;
        const evtName: string   = d.event ?? 'congestion_spike';
        const isSpike            = evtName.includes('spike') || evtName.includes('drop');
        const toLevel: string   = d.to_level ?? 'medium';
        const fromLevel: string = d.from_level ?? 'low';
        const severity           = toLevel === 'high' ? 'critical' : toLevel === 'medium' ? 'medium' : 'low';
        const levelToNum         = (l: string) => l === 'high' ? 0.85 : l === 'medium' ? 0.55 : 0.18;
        const mapped: PulseEvent = {
          event_type:        isSpike ? 'spike' : 'clear',
          location:          d.location,
          severity,
          message:           evtName.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) + (d.speed_kmh ? ` — ${d.speed_kmh} km/h` : ''),
          congestion_before: levelToNum(fromLevel),
          congestion_after:  levelToNum(toLevel),
          timestamp:         d.timestamp,
        };
        setPulseFeed((p) => [mapped, ...p].slice(0, 15));
      } catch { /* ignore */ }
    };
  }, []);

  const connectMl = useCallback(() => {
    const ws = new WebSocket(`${wsBase()}/traffic/ws/ml-live`);
    wsMlRef.current = ws;
    ws.onopen  = () => setWsMl(true);
    ws.onclose = () => { setWsMl(false); setTimeout(() => connectMlRef.current(), 5000); };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (!d || d.type === 'ping') return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const preds: MlPrediction[] = (d.predictions ?? []).map((p: any) => ({
          hour:       Number(p.hour ?? p.target_hour ?? 1),
          label:      String(p.congestion ?? p.label ?? 'Medium'),
          confidence: Number(p.confidence ?? 0.8),
        }));
        setMlLive({
          predictions:      preds.length ? preds : undefined,
          active_incidents: d.active_incidents ?? d.incidents,
          avg_speed:        d.avg_speed ?? d.speed_kmh,
          congestion_level: d.congestion_level ?? d.current_level,
          timestamp:        d.timestamp,
        });
      } catch { /* ignore */ }
    };
  }, []);

  useEffect(() => {
    connectLiveRef.current  = connectLive;
    connectPulseRef.current = connectPulse;
    connectMlRef.current    = connectMl;
  });

  useEffect(() => {
    connectLive();
    connectPulse();
    connectMl();
    const tick = setInterval(() => {
      if (!wsLiveRef.current || wsLiveRef.current.readyState !== WebSocket.OPEN) {
        setCarFeed((prev) => {
          const next = [...prev];
          const idx  = Math.floor(Math.random() * next.length);
          next[idx]  = makeCarStub(idx);
          return next;
        });
      }
      setTicker((n) => n + 1);
    }, 2000);
    return () => {
      clearInterval(tick);
      wsLiveRef.current?.close();
      wsPulseRef.current?.close();
      wsMlRef.current?.close();
      wsTripRef.current?.close();
    };
  }, [connectLive, connectPulse, connectMl]);

  void ticker;

  const checkAdvisor = async () => {
    setCheckingAdv(true);
    try {
      const res = await api.get('/commute/should-i-leave', { params: { location } });
      if (res.data) setShouldLeave(res.data);
    } catch { /* keep stub */ }
    setCheckingAdv(false);
  };

  const startTrip = async () => {
    setStartingTrip(true);
    try {
      const res = await api.post('/trips/live/start', { location, destination: 'Work' });
      const sid = res.data?.session_id || `TRIP-${Date.now()}`;
      setTripSession(sid);
      const ws = new WebSocket(`${wsBase()}/trips/ws/${sid}`);
      wsTripRef.current = ws;
      ws.onmessage = (e) => { try { setTripEta(JSON.parse(e.data)); } catch { /* ignore */ } };
      setTripEta({ session_id: sid, eta_minutes: 24, trend: 'stable', current_congestion: 0.54, distance_remaining: 12.8, route: `${location} → Work` });
    } catch {
      const sid = `TRIP-${Date.now()}`;
      setTripSession(sid);
      setTripEta({ session_id: sid, eta_minutes: 24, trend: 'stable', current_congestion: 0.54, distance_remaining: 12.8, route: `${location} → Work` });
    }
    setStartingTrip(false);
  };

  const endTrip = async () => {
    if (tripSession) {
      try { await api.delete(`/trips/live/${tripSession}`); } catch { /* ignore */ }
    }
    wsTripRef.current?.close();
    setTripSession(null);
    setTripEta(null);
  };

  const sl         = shouldLeave;
  const nowScore   = sl.current_score  ?? 0;
  const fcstScore  = sl.forecast_score ?? 0;
  const nowColor   = congColor(nowScore / 100);
  const fcstColor  = congColor(fcstScore / 100);
  const mlPreds    = mlLive.predictions ?? ML_LIVE_STUB.predictions ?? [];
  const spikeCount = pulseFeed.filter((p) => p.event_type === 'spike').length;
  const clearCount = pulseFeed.filter((p) => p.event_type === 'clear').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1280 }}>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div
        className="page-hero"
        style={{ marginBottom: 0, padding: '24px 28px' }}
      >
        {/* bg orbs */}
        <div style={{ position: 'absolute', top: -30, right: 80, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: '30%', width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          {/* Left: title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="icon-glow icon-glow-blue" style={{ width: 56, height: 56, borderRadius: 16, animation: 'float 4s ease-in-out infinite' }}>
              <Radio size={26} color="#60a5fa" />
            </div>
            <div>
              <h1 className="gradient-text-neon" style={{ fontWeight: 900, fontSize: 24, margin: 0, letterSpacing: '-0.03em' }}>Live Traffic Control</h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12.5, marginTop: 4 }}>
                Real-time WebSocket feeds · 200 vehicles · ML predictions every 5 s
              </p>
            </div>
          </div>

          {/* Right: WS status + clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <WsBadge label="Car Stream" on={wsLive}  />
            <WsBadge label="Pulse Feed" on={wsPulse} />
            <WsBadge label="ML Feed"    on={wsMl}    />
            {nowTime && (
              <div style={{ marginLeft: 6, padding: '5px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: 11.5, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                {nowTime}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 4 Stat Cards ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { icon: Car,            label: 'Active Vehicles',   value: '200',                        sub: 'across India',    color: '#3b82f6', glowClass: 'icon-glow-blue'   },
          { icon: Gauge,          label: 'Avg Speed',         value: `${mlLive.avg_speed ?? 42} km/h`, sub: 'all corridors', color: '#8b5cf6', glowClass: 'icon-glow-purple' },
          { icon: CloudLightning, label: 'Congestion Events', value: String(spikeCount),           sub: 'last hour',       color: '#ef4444', glowClass: 'icon-glow-red'    },
          { icon: CheckCircle2,   label: 'Cleared Events',    value: String(clearCount),           sub: 'last hour',       color: '#22c55e', glowClass: 'icon-glow-green'  },
        ].map(({ icon: Icon, label, value, sub, color, glowClass }) => (
          <div key={label} className="neon-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className={`icon-glow ${glowClass}`} style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <p className="number-pop" style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.04em' }}>{value}</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginTop: 3 }}>{label}</p>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Should I Leave? ──────────────────────────────────────────── */}
      <div
        className="neon-card"
        style={{
          padding: '22px 26px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1035 60%, #0f1f2e 100%)',
          border: `1.5px solid ${sl.should_leave_now ? 'rgba(34,197,94,0.35)' : 'rgba(245,158,11,0.35)'}`,
          boxShadow: sl.should_leave_now
            ? '0 4px 30px rgba(34,197,94,0.12), 0 0 0 1px rgba(34,197,94,0.06)'
            : '0 4px 30px rgba(245,158,11,0.12), 0 0 0 1px rgba(245,158,11,0.06)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* bg glow */}
        <div style={{ position: 'absolute', top: -50, right: 200, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${sl.should_leave_now ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)'} 0%, transparent 70%)`, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', justifyContent: 'space-between' }}>

          {/* Icon + decision text */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flex: 1 }}>
            <div className={sl.should_leave_now ? 'icon-glow icon-glow-green' : 'icon-glow icon-glow-orange'} style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 16 }}>
              <Navigation2 size={26} color={sl.should_leave_now ? '#4ade80' : '#fb923c'} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <h2 style={{ fontWeight: 800, fontSize: 16, color: '#f1f5f9', margin: 0 }}>Should I Leave Now?</h2>
                {sl.should_leave_now
                  ? <span className="neon-badge-green" style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>YES — LEAVE NOW</span>
                  : <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 0 10px rgba(245,158,11,0.2)' }}>WAIT — Best: {sl.best_departure_time}</span>
                }
              </div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: '#cbd5e1', marginBottom: 5 }}>{sl.recommendation}</p>
              <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.55, maxWidth: 480 }}>{sl.reason}</p>
            </div>
          </div>

          {/* Score rings + controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
            {/* Rings */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <ScoreRing score={nowScore}  size={80} label="Now"      color={nowColor}  />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <ArrowRight size={16} color="#475569" />
                <span style={{ fontSize: 9, color: '#475569', fontWeight: 600 }}>+20m</span>
              </div>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <ScoreRing score={fcstScore} size={80} label="Forecast"  color={fcstColor} />
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 }}>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{ fontSize: 12.5, borderRadius: 10, padding: '8px 10px', border: '1.5px solid rgba(255,255,255,0.1)', color: '#e2e8f0', background: 'rgba(255,255,255,0.06)', outline: 'none', cursor: 'pointer' }}
              >
                {LOCATIONS.map((l) => <option key={l} style={{ background: '#0f172a' }}>{l}</option>)}
              </select>
              <button
                onClick={checkAdvisor}
                disabled={checkingAdv}
                className="btn-gradient"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, padding: '8px 12px', borderRadius: 10, opacity: checkingAdv ? 0.7 : 1, cursor: checkingAdv ? 'not-allowed' : 'pointer' }}
              >
                <RefreshCw size={12} style={{ animation: checkingAdv ? 'spin 0.8s linear infinite' : 'none' }} />
                {checkingAdv ? 'Checking…' : 'Check Now'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3-column live feeds ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

        {/* ── Car Stream ── */}
        <div className="neon-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 520 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div className="icon-glow icon-glow-blue" style={{ width: 30, height: 30, borderRadius: 8 }}>
                <Car size={14} color="#60a5fa" />
              </div>
              <div>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#111827', display: 'block' }}>Live Car Stream</span>
                <span style={{ fontSize: 10.5, color: '#9ca3af' }}>updates every 2 s</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#2563eb' }}>{carFeed.length} active</span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {carFeed.map((car, i) => {
              const c = car.congestion ?? 0;
              const col = congColor(c);
              return (
                <div
                  key={car.car_id || i}
                  style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid #f9fafb',
                    display: 'flex', alignItems: 'center', gap: 11,
                    transition: 'background 0.2s',
                  }}
                >
                  {/* Speed dot */}
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: col, flexShrink: 0, boxShadow: `0 0 7px ${col}` }} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{car.location}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10.5, color: '#6b7280' }}>{car.speed} km/h</span>
                      <span style={{ fontSize: 10, color: '#d1d5db' }}>·</span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: col }}>{(c * 100).toFixed(0)}% load</span>
                    </div>
                  </div>

                  {/* Mini bar */}
                  <div style={{ width: 44, flexShrink: 0 }}>
                    <div style={{ height: 5, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{ width: `${c * 100}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${col}, ${col}cc)`, boxShadow: `0 0 5px ${col}66`, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Pulse Alerts ── */}
        <div className="neon-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 520 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div className="icon-glow icon-glow-orange" style={{ width: 30, height: 30, borderRadius: 8 }}>
                <Zap size={14} color="#fb923c" />
              </div>
              <div>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#111827', display: 'block' }}>Pulse Events</span>
                <span style={{ fontSize: 10.5, color: '#9ca3af' }}>instant congestion alerts</span>
              </div>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.25)', boxShadow: '0 0 8px rgba(245,158,11,0.18)' }}>Live</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            {pulseFeed.map((ev, i) => {
              const type = ev.event_type || 'spike';
              const sev  = ev.severity   || 'medium';
              const ps   = pulseStyle(type, sev);
              const pct  = (v?: number) => v != null ? `${(v * 100).toFixed(0)}%` : '—';
              return (
                <div
                  key={i}
                  style={{
                    borderRadius: 13, padding: '12px 14px',
                    background: ps.bg,
                    border: `1px solid ${ps.border}`,
                    boxShadow: `0 2px 12px ${ps.glow}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${ps.glow}` }}>
                      {type === 'spike'
                        ? <AlertTriangle  size={12} style={{ color: ps.text }} />
                        : <CheckCircle2   size={12} style={{ color: ps.text }} />}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: ps.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {type === 'spike' ? 'Spike' : 'Cleared'}
                    </span>
                    <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 'auto' }}>{formatAge(ev.timestamp)}</span>
                  </div>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{ev.location}</p>
                  <p style={{ fontSize: 11, color: '#6b7280' }}>{ev.message}</p>
                  {ev.congestion_before != null && ev.congestion_after != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: congColor(ev.congestion_before), fontFamily: 'monospace' }}>{pct(ev.congestion_before)}</span>
                      <ArrowRight size={10} color="#9ca3af" />
                      <span style={{ fontSize: 12, fontWeight: 700, color: congColor(ev.congestion_after), fontFamily: 'monospace' }}>{pct(ev.congestion_after)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── ML Live Feed ── */}
        <div className="neon-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 520, background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)', border: '1px solid rgba(139,92,246,0.2)', boxShadow: '0 0 30px rgba(139,92,246,0.1)' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div className="icon-glow icon-glow-purple" style={{ width: 30, height: 30, borderRadius: 8 }}>
                <Brain size={14} color="#c084fc" />
              </div>
              <div>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#e2e8f0', display: 'block' }}>ML Live Feed</span>
                <span style={{ fontSize: 10.5, color: '#475569' }}>RandomForest · every 5 s</span>
              </div>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(139,92,246,0.15)', color: '#c084fc', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 0 10px rgba(139,92,246,0.2)' }}>AI</span>
          </div>

          <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

            {/* Current snapshot */}
            <div style={{ borderRadius: 12, padding: '14px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>Live Snapshot</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Avg Speed', value: `${mlLive.avg_speed ?? 42} km/h`, color: '#60a5fa' },
                  { label: 'Incidents', value: String(mlLive.active_incidents ?? 3),   color: '#f87171' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ fontSize: 20, fontWeight: 900, color, letterSpacing: '-0.04em', margin: 0 }}>{value}</p>
                    <p style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{label}</p>
                  </div>
                ))}
              </div>
              {mlLive.congestion_level && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Activity size={12} color="#a78bfa" />
                  <span style={{ fontSize: 11.5, color: '#a78bfa', fontWeight: 600, textTransform: 'capitalize' }}>
                    Current: {mlLive.congestion_level} congestion
                  </span>
                </div>
              )}
            </div>

            {/* Next 3h predictions */}
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>Next 3 Hours Forecast</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {mlPreds.map(({ hour, label, confidence }, idx) => {
                  const col  = labelColor(label);
                  const bg   = labelBg(label);
                  const bdr  = labelBorder(label);
                  return (
                    <div
                      key={idx}
                      style={{
                        borderRadius: 11, padding: '11px 13px',
                        background: bg, border: `1px solid ${bdr}`,
                        boxShadow: `0 0 12px ${col}18`,
                        display: 'flex', alignItems: 'center', gap: 12,
                        animation: `slideUp 0.35s ease both`,
                        animationDelay: `${idx * 0.1}s`,
                      }}
                    >
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${col}18`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${col}30` }}>
                        <Clock size={10} color={col} />
                        <span style={{ fontSize: 12, fontWeight: 900, color: col, lineHeight: 1 }}>+{hour}h</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: col }}>{label}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: col }}>{Math.round(confidence * 100)}%</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ width: `${confidence * 100}%`, height: '100%', background: `linear-gradient(90deg, ${col}, ${col}88)`, borderRadius: 99, boxShadow: `0 0 6px ${col}66`, transition: 'width 0.8s ease' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Powered-by pill */}
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.12)' }}>
              <Cpu size={11} color="#6d28d9" />
              <span style={{ fontSize: 11, color: '#475569' }}>Powered by RandomForest classifier · 48k records</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Live Trip Tracker (full-width) ──────────────────────────── */}
      <div
        className="neon-card"
        style={{
          overflow: 'hidden',
          background: tripSession
            ? 'linear-gradient(135deg, #0f172a 0%, #0c1a0f 100%)'
            : undefined,
          border: tripSession ? '1.5px solid rgba(34,197,94,0.3)' : undefined,
          boxShadow: tripSession ? '0 4px 30px rgba(34,197,94,0.1)' : undefined,
        }}
      >
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${tripSession ? 'rgba(34,197,94,0.12)' : '#f3f4f6'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className={tripSession ? 'icon-glow icon-glow-green' : 'icon-glow icon-glow-purple'} style={{ width: 32, height: 32, borderRadius: 9 }}>
              <Signal size={15} color={tripSession ? '#4ade80' : '#c084fc'} />
            </div>
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: tripSession ? '#e2e8f0' : '#111827', display: 'block' }}>Live Trip Tracker</span>
              <span style={{ fontSize: 10.5, color: '#6b7280' }}>real-time ETA · updates every 15 s</span>
            </div>
          </div>
          {tripSession && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              <span className="neon-badge-green" style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99 }}>ACTIVE</span>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#475569' }}>{tripEta?.session_id?.slice(-10)}</span>
            </div>
          )}
        </div>

        <div style={{ padding: '20px' }}>
          {!tripSession ? (
            /* ── Start state ── */
            <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
              <div className="icon-glow icon-glow-purple" style={{ width: 72, height: 72, borderRadius: 20, flexShrink: 0, animation: 'float 4s ease-in-out infinite' }}>
                <Navigation2 size={34} color="#c084fc" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 800, fontSize: 16, color: '#111827', marginBottom: 5 }}>Start a Live Trip</p>
                <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.55 }}>
                  Real-time ETA updates every 15 s with trend indicators, congestion alerts, and distance tracking.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  style={{ fontSize: 13, borderRadius: 10, padding: '9px 12px', border: '1.5px solid #e5e7eb', color: '#374151', background: '#fff', minWidth: 130 }}
                >
                  {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
                </select>
                <button
                  onClick={startTrip}
                  disabled={startingTrip}
                  className="btn-gradient"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 12, fontWeight: 700, fontSize: 14, opacity: startingTrip ? 0.7 : 1, cursor: startingTrip ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                >
                  <Play size={14} fill="white" />
                  {startingTrip ? 'Starting…' : 'Start Trip'}
                </button>
              </div>
            </div>
          ) : (
            /* ── Active trip ── */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 1fr', gap: 20, alignItems: 'center' }}>

              {/* Route info */}
              <div>
                {tripEta?.route && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', marginBottom: 14 }}>
                    <MapPin size={13} style={{ color: '#22c55e', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#d1fae5', fontWeight: 600 }}>{tripEta.route}</span>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ borderRadius: 12, padding: '14px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)', textAlign: 'center' }}>
                    <p style={{ fontSize: 24, fontWeight: 900, color: '#4ade80', margin: 0, letterSpacing: '-0.04em' }}>{tripEta?.distance_remaining ?? '--'}</p>
                    <p style={{ fontSize: 10.5, color: '#6b7280', marginTop: 2 }}>km remaining</p>
                  </div>
                  <div style={{ borderRadius: 12, padding: '14px', background: `${congColor(tripEta?.current_congestion ?? 0)}10`, border: `1px solid ${congColor(tripEta?.current_congestion ?? 0)}22`, textAlign: 'center' }}>
                    <p style={{ fontSize: 24, fontWeight: 900, color: congColor(tripEta?.current_congestion ?? 0), margin: 0, letterSpacing: '-0.04em' }}>{((tripEta?.current_congestion ?? 0) * 100).toFixed(0)}%</p>
                    <p style={{ fontSize: 10.5, color: '#6b7280', marginTop: 2 }}>congestion</p>
                  </div>
                </div>
              </div>

              {/* ETA hero */}
              <div style={{ textAlign: 'center', padding: '20px', borderRadius: 16, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', boxShadow: '0 0 24px rgba(139,92,246,0.1)' }}>
                <p className="gradient-text-animated" style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.06em', margin: 0 }}>{tripEta?.eta_minutes ?? '--'}</p>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 6, fontWeight: 600 }}>minutes ETA</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8, padding: '5px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <TrendIcon trend={tripEta?.trend} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'capitalize', color: tripEta?.trend === 'worsening' ? '#f87171' : tripEta?.trend === 'improving' ? '#4ade80' : '#94a3b8' }}>
                    {tripEta?.trend ?? 'stable'}
                  </span>
                </div>
              </div>

              {/* End trip */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={endTrip}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '11px 22px', borderRadius: 12, fontWeight: 700, fontSize: 13.5,
                    background: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.25)',
                    color: '#dc2626', cursor: 'pointer', boxShadow: '0 0 14px rgba(239,68,68,0.12)',
                    transition: 'all 0.2s',
                  }}
                >
                  <Square size={12} fill="#dc2626" />
                  End Trip
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes float    { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @keyframes slideUp  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
