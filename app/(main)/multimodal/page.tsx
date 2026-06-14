'use client';

import { useState, useCallback } from 'react';
import { Navigation, Car, Train, Bike, RefreshCw, Zap, ArrowRight, MapPin, Clock, Leaf, IndianRupee, ChevronRight, Info, Key } from 'lucide-react';
import api from '@/lib/api';

/* ── Real API shapes ─────────────────────────────────────────────── */
interface ApiSegment {
  mode: string;
  from: string;
  to: string;
  duration_min: number;
  cost_inr: number;
  notes?: string;
}

interface ApiPlan {
  segments: ApiSegment[];
  total_duration_min: number;
  vs_driving_only_min: number;
  total_cost_inr: number;
  carbon_saved_kg: number;
  summary?: string;
  error?: string;
}

interface ApiResponse {
  origin: string;
  destination: string;
  distance_km: number;
  plan: ApiPlan | null;
  generated_at: string;
}

/* ── Display shapes (transformed from API) ───────────────────────── */
interface DisplaySegment {
  mode: string;
  from: string;
  to: string;
  duration: string;
  cost?: string;
  reason?: string;
}

interface DisplayResult {
  segments: DisplaySegment[];
  total_duration: string;
  total_distance: string;
  estimated_cost: string;
  vs_driving_only: string;
  carbon_saved: string;
  summary?: string;
}

/* ── Transform API → display ─────────────────────────────────────── */
function transformResponse(data: ApiResponse): DisplayResult {
  const plan = data.plan!;
  const segments: DisplaySegment[] = (plan.segments ?? []).map((s) => ({
    mode:     s.mode ?? 'driving',
    from:     s.from ?? '',
    to:       s.to ?? '',
    duration: s.duration_min != null ? `${s.duration_min} min` : '—',
    cost:     (s.cost_inr ?? 0) > 0 ? `₹${s.cost_inr}` : undefined,
    reason:   s.notes ?? undefined,
  }));

  const savings = plan.vs_driving_only_min ?? 0;
  const savingsText =
    savings > 0
      ? `Saves ${savings} min vs driving all the way`
      : savings < 0
      ? `Takes ${Math.abs(savings)} min longer than driving`
      : 'Similar time to driving';

  const distKm = data.distance_km ?? 0;

  return {
    segments,
    total_duration:  plan.total_duration_min  != null ? `${plan.total_duration_min} min` : '—',
    total_distance:  `${distKm.toFixed(1)} km`,
    estimated_cost:  (plan.total_cost_inr ?? 0) > 0 ? `₹${plan.total_cost_inr}` : 'Free / minimal',
    vs_driving_only: savingsText,
    carbon_saved:    (plan.carbon_saved_kg ?? 0) > 0 ? `${plan.carbon_saved_kg} kg CO₂` : '—',
    summary:         plan.summary,
  };
}

/* ── Convert select value to ISO datetime for backend ─────────────── */
function resolveDepartAt(value: string): string | undefined {
  if (value === 'now' || value === 'peak' || value === 'offpeak') return undefined;
  const offsets: Record<string, number> = { '30min': 30 * 60_000, '1h': 60 * 60_000 };
  const ms = offsets[value];
  return ms ? new Date(Date.now() + ms).toISOString() : undefined;
}

/* ── Mode config ─────────────────────────────────────────────────── */
const MODE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string; iconClass: string }> = {
  driving:       { icon: <Car size={17} />,       label: 'Drive',  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  iconClass: 'icon-glow-blue'   },
  metro:         { icon: <Train size={17} />,      label: 'Metro',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', iconClass: 'icon-glow-purple' },
  auto_rickshaw: { icon: <Bike size={17} />,       label: 'Auto',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', iconClass: 'icon-glow-yellow' },
  walking:       { icon: <Navigation size={17} />, label: 'Walk',   color: '#10b981', bg: 'rgba(16,185,129,0.1)', iconClass: 'icon-glow-green'  },
  cycling:       { icon: <Bike size={17} />,       label: 'Cycle',  color: '#10b981', bg: 'rgba(16,185,129,0.1)', iconClass: 'icon-glow-green'  },
  bus:           { icon: <Car size={17} />,         label: 'Bus',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  iconClass: 'icon-glow-red'    },
};

function modeConfig(mode: string) {
  return MODE_CONFIG[mode] ?? MODE_CONFIG.driving;
}

/* ── Journey segment ─────────────────────────────────────────────── */
function SegmentStep({ seg, index, total }: { seg: DisplaySegment; index: number; total: number }) {
  const cfg = modeConfig(seg.mode);
  const isLast = index === total - 1;

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
        <div
          className={`icon-glow ${cfg.iconClass}`}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            border: `2px solid ${cfg.color}`,
            color: cfg.color, flexShrink: 0,
          }}
        >
          {cfg.icon}
        </div>
        {!isLast && (
          <div
            style={{
              width: 2, flex: 1, minHeight: 32,
              background: `linear-gradient(to bottom, ${cfg.color}40, #f1f5f9)`,
              marginTop: 4,
            }}
          />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 20 }}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                style={{
                  padding: '2px 9px', borderRadius: 99,
                  fontSize: 10.5, fontWeight: 700,
                  background: cfg.bg, color: cfg.color,
                  boxShadow: `0 0 8px ${cfg.color}30`,
                  border: `1px solid ${cfg.color}30`,
                }}
              >
                {cfg.label}
              </span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
              {seg.from}
              <span style={{ color: '#94a3b8', fontWeight: 400, margin: '0 6px' }}>→</span>
              {seg.to}
            </p>
            {seg.reason && (
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>
                {seg.reason}
              </p>
            )}
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
              {seg.duration}
            </p>
            {seg.cost && (
              <p style={{ fontSize: 12, fontWeight: 700, color: '#10b981', marginTop: 3, textShadow: '0 0 8px rgba(16,185,129,0.4)' }}>
                {seg.cost}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */
export default function MultimodalPage() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureTime, setDepartureTime] = useState('now');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DisplayResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [rawOrigin, setRawOrigin] = useState('');
  const [rawDest, setRawDest] = useState('');

  const plan = useCallback(async () => {
    if (!origin.trim() || !destination.trim()) return;
    setLoading(true);
    setResult(null);
    setApiError(null);
    setRawOrigin(origin);
    setRawDest(destination);

    try {
      const departAt = resolveDepartAt(departureTime);
      const res = await api.post<ApiResponse>('/routes/multimodal', {
        origin,
        destination,
        ...(departAt && { depart_at: departAt }),
      });

      const data = res.data;

      // Backend returned an error in the plan (e.g. no API key)
      if (!data.plan || data.plan.error) {
        setApiError(data.plan?.error ?? 'No plan returned from server.');
        setLoading(false);
        return;
      }

      setResult(transformResponse(data));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setApiError(msg ?? 'Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  }, [origin, destination, departureTime]);

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page Hero ───────────────────────────── */}
      <div className="page-hero">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  background: 'rgba(139,92,246,0.2)',
                  border: '1px solid rgba(139,92,246,0.4)',
                  color: '#c4b5fd',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  boxShadow: '0 0 12px rgba(139,92,246,0.3)',
                }}
              >
                <Train size={10} style={{ display: 'inline', marginRight: 4 }} />
                Multi-Mode AI
              </span>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
              Multi-Modal Planner
            </h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
              AI plans the optimal mix of drive, metro, and auto for your journey
            </p>
          </div>
          <button
            onClick={() => void plan()}
            disabled={loading || !origin.trim() || !destination.trim()}
            className="btn-gradient"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 22px', borderRadius: 9,
              fontSize: 13.5, fontWeight: 700,
              opacity: loading || !origin.trim() || !destination.trim() ? 0.5 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Zap size={14} />}
            {loading ? 'Planning…' : 'Plan Route'}
          </button>
        </div>
      </div>

      {/* ── Input form ────────────────────────── */}
      <div className="neon-card" style={{ padding: '22px 24px' }}>
        <h2 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Plan your journey</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 200px auto', gap: 12, alignItems: 'flex-end' }}>

          {/* Origin */}
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              From
            </label>
            <div style={{ position: 'relative' }}>
              <MapPin size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void plan()}
                placeholder="e.g. Andheri East"
                style={{
                  width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
                  borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 13.5, color: '#0f172a',
                  background: '#f8fafc', outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.1)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {/* Destination */}
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              To
            </label>
            <div style={{ position: 'relative' }}>
              <Navigation size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#8b5cf6' }} />
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void plan()}
                placeholder="e.g. BKC, Mumbai"
                style={{
                  width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
                  borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 13.5, color: '#0f172a',
                  background: '#f8fafc', outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.1)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {/* Departure */}
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Depart
            </label>
            <select
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              style={{
                width: '100%', padding: '10px 10px', borderRadius: 9,
                border: '1.5px solid #e2e8f0', fontSize: 13, color: '#0f172a',
                background: '#f8fafc', outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="now">Leave Now</option>
              <option value="30min">In 30 minutes</option>
              <option value="1h">In 1 hour</option>
              <option value="peak">Peak hour (8–10 AM)</option>
              <option value="offpeak">Off-peak (10 AM–5 PM)</option>
            </select>
          </div>

          {/* Button */}
          <button
            onClick={() => void plan()}
            disabled={loading || !origin.trim() || !destination.trim()}
            className="btn-gradient"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 22px', borderRadius: 9,
              fontSize: 13.5, fontWeight: 700,
              opacity: loading || !origin.trim() || !destination.trim() ? 0.5 : 1,
              cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {loading ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Zap size={14} />}
            {loading ? 'Planning…' : 'Plan Route'}
          </button>
        </div>

        {/* Quick samples */}
        <div className="flex gap-2 flex-wrap" style={{ marginTop: 12 }}>
          {[
            { o: 'Andheri East', d: 'BKC' },
            { o: 'Powai', d: 'Lower Parel' },
            { o: 'Gurgaon Sector 14', d: 'Connaught Place' },
          ].map(({ o, d }) => (
            <button
              key={`${o}→${d}`}
              onClick={() => { setOrigin(o); setDestination(d); }}
              style={{
                padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                background: 'rgba(139,92,246,0.07)', color: '#8b5cf6',
                border: '1px solid rgba(139,92,246,0.2)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                boxShadow: '0 0 8px rgba(139,92,246,0.1)',
              }}
            >
              <ChevronRight size={11} />
              {o} → {d}
            </button>
          ))}
        </div>
      </div>

      {/* ── API key error state ────────────────── */}
      {apiError && (
        <div className="neon-card" style={{ padding: '32px 24px', textAlign: 'center' }}>
          <div className="icon-glow icon-glow-yellow" style={{ width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px' }}>
            <Key size={22} color="#f59e0b" />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
            AI Planning Unavailable
          </h3>
          <p style={{ fontSize: 13, color: '#64748b', maxWidth: 420, margin: '0 auto 12px', lineHeight: 1.6 }}>
            {apiError}
          </p>
          <div
            style={{
              display: 'inline-block', padding: '8px 16px', borderRadius: 8,
              background: '#f8fafc', border: '1px solid #e2e8f0',
              fontSize: 12, fontFamily: 'monospace', color: '#334155',
            }}
          >
            ANTHROPIC_API_KEY=sk-ant-... in backend .env
          </div>
        </div>
      )}

      {/* ── Results ───────────────────────────── */}
      {result && (
        <>
          {/* Summary strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Total Time',   value: result.total_duration,  icon: <Clock size={16} color="#3b82f6" />,       color: '#3b82f6', iconClass: 'icon-glow-blue'   },
              { label: 'Distance',     value: result.total_distance,  icon: <Navigation size={16} color="#8b5cf6" />,   color: '#8b5cf6', iconClass: 'icon-glow-purple' },
              { label: 'Est. Cost',    value: result.estimated_cost,  icon: <IndianRupee size={16} color="#10b981" />, color: '#10b981', iconClass: 'icon-glow-green'  },
              { label: 'CO₂ Saved',   value: result.carbon_saved,    icon: <Leaf size={16} color="#059669" />,         color: '#059669', iconClass: 'icon-glow-green'  },
            ].map(({ label, value, icon, color, iconClass }) => (
              <div
                key={label}
                className="neon-card"
                style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <div className={`icon-glow ${iconClass}`} style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}>
                  {icon}
                </div>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {value}
                  </p>
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontWeight: 600 }}>{label}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>

            {/* Journey timeline */}
            <div className="neon-card" style={{ padding: '22px 24px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>Your Journey Plan</h2>
                  <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                    {result.segments.length} segment{result.segments.length !== 1 ? 's' : ''} · AI-optimised for current traffic
                  </p>
                </div>
              </div>

              {/* AI summary */}
              {result.summary && (
                <div
                  style={{
                    padding: '10px 14px', borderRadius: 9,
                    background: 'rgba(139,92,246,0.07)',
                    border: '1px solid rgba(139,92,246,0.2)',
                    fontSize: 12.5, color: '#6d28d9', lineHeight: 1.6,
                    marginBottom: 18,
                    boxShadow: '0 0 12px rgba(139,92,246,0.1)',
                  }}
                >
                  {result.summary}
                </div>
              )}

              {/* Origin dot */}
              <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
                <div
                  className="icon-glow icon-glow-purple"
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    flexShrink: 0,
                  }}
                >
                  <MapPin size={16} color="#a78bfa" />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{rawOrigin}</p>
                  <p style={{ fontSize: 11, color: '#94a3b8' }}>Starting point</p>
                </div>
              </div>

              {result.segments.map((seg, i) => (
                <SegmentStep key={i} seg={seg} index={i} total={result.segments.length} />
              ))}

              {/* Destination dot */}
              <div className="flex items-center gap-3" style={{ marginTop: 8 }}>
                <div
                  className="icon-glow icon-glow-green"
                  style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }}
                >
                  <Navigation size={16} color="#10b981" />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{rawDest}</p>
                  <p style={{ fontSize: 11, color: '#10b981', fontWeight: 600, textShadow: '0 0 8px rgba(16,185,129,0.4)' }}>
                    You've arrived · {result.total_duration}
                  </p>
                </div>
              </div>
            </div>

            {/* Side panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* vs driving card */}
              <div
                className="neon-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))',
                  border: '1px solid rgba(16,185,129,0.25)',
                  boxShadow: '0 0 20px rgba(16,185,129,0.1)',
                  padding: '18px',
                }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="icon-glow icon-glow-green" style={{ width: 22, height: 22, borderRadius: 6 }}>
                    <Zap size={12} color="#10b981" />
                  </div>
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    vs Drive-Only
                  </p>
                </div>
                <p style={{ fontSize: 13.5, color: '#14532d', lineHeight: 1.6, fontWeight: 600 }}>
                  {result.vs_driving_only}
                </p>
              </div>

              {/* Mode legend */}
              <div className="neon-card" style={{ padding: '18px' }}>
                <p style={{ fontSize: 11.5, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                  Modes in this plan
                </p>
                {result.segments.map((seg, i) => {
                  const cfg = modeConfig(seg.mode);
                  return (
                    <div key={i} className="flex items-center gap-2.5" style={{ marginBottom: 10 }}>
                      <div
                        className={`icon-glow ${cfg.iconClass}`}
                        style={{
                          width: 28, height: 28, borderRadius: 8,
                          color: cfg.color, flexShrink: 0,
                        }}
                      >
                        {cfg.icon}
                      </div>
                      <div>
                        <p style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{cfg.label}</p>
                        <p style={{ fontSize: 11, color: '#94a3b8' }}>{seg.duration}</p>
                      </div>
                      <ArrowRight size={12} color="#e2e8f0" style={{ marginLeft: 'auto' }} />
                    </div>
                  );
                })}
              </div>

              {/* Disclaimer */}
              <div
                className="flex items-start gap-2 glass-neon"
                style={{ padding: '12px 14px', borderRadius: 10 }}
              >
                <Info size={13} color="#60a5fa" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.6 }}>
                  Metro times are based on published schedules. Auto/cab costs are estimates based on local rates.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Empty state ───────────────────────── */}
      {!result && !loading && !apiError && (
        <div className="neon-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div className="icon-glow icon-glow-purple" style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px' }}>
            <Train size={26} color="#8b5cf6" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
            Get the smartest multi-modal route
          </h3>
          <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 400, margin: '0 auto' }}>
            AI combines driving, metro, and auto-rickshaw into a single optimised journey — saving time, money, and carbon vs driving alone.
          </p>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
