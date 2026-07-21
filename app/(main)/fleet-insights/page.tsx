'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Truck, Zap, RefreshCw, AlertTriangle, TrendingUp,
  Fuel, Route, Clock, BarChart3, ChevronRight, CheckCircle,
  Activity, MapPin, Car, Users,
} from 'lucide-react';
import api from '@/lib/api';

/* ── API shapes (match GET /fleet/{org_id}/ai-insights exactly) ── */
interface FleetInsight {
  type: string;
  title: string;
  detail: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
}

interface LiveSummary {
  avg_speed_kmh: number;
  active_incidents: number;
  congestion_breakdown: { high: number; medium: number; low: number };
  peak_hours_today: number[];
  top_hotspot: string;
}

interface FleetInsightsResult {
  org_id: string;
  org_name: string;
  vehicle_count: number;
  live_summary: LiveSummary;
  insights: FleetInsight[];
  message?: string;
  generated_at: string;
}

/* ── Insight type config ─────────────────────────────────────────── */
const INSIGHT_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string; iconClass: string }> = {
  fuel_waste:         { icon: <Fuel size={15} />,          color: '#ef4444', bg: 'rgba(239,68,68,0.08)',    label: 'Fuel Waste',       iconClass: 'icon-glow-red'    },
  route_optimization: { icon: <Route size={15} />,         color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',   label: 'Route',            iconClass: 'icon-glow-blue'   },
  schedule:           { icon: <Clock size={15} />,         color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',   label: 'Schedule',         iconClass: 'icon-glow-yellow' },
  scheduling:         { icon: <Clock size={15} />,         color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',   label: 'Schedule',         iconClass: 'icon-glow-yellow' },
  driver_coaching:    { icon: <TrendingUp size={15} />,    color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',   label: 'Driver Coaching',  iconClass: 'icon-glow-purple' },
  driver_behavior:    { icon: <Users size={15} />,         color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',   label: 'Driver Behaviour', iconClass: 'icon-glow-purple' },
  maintenance:        { icon: <AlertTriangle size={15} />, color: '#f97316', bg: 'rgba(249,115,22,0.08)',   label: 'Maintenance',      iconClass: 'icon-glow-orange' },
};

const PRIORITY_STYLE: Record<string, { color: string; bg: string; border: string; label: string; glow: string }> = {
  high:   { color: '#dc2626', bg: 'rgba(220,38,38,0.07)',  border: 'rgba(220,38,38,0.25)',  label: 'High Priority',   glow: 'rgba(220,38,38,0.2)'   },
  medium: { color: '#d97706', bg: 'rgba(217,119,6,0.07)',  border: 'rgba(217,119,6,0.25)',  label: 'Medium Priority', glow: 'rgba(217,119,6,0.2)'   },
  low:    { color: '#16a34a', bg: 'rgba(22,163,74,0.07)',   border: 'rgba(22,163,74,0.25)', label: 'Low Priority',    glow: 'rgba(22,163,74,0.2)'   },
};

/* ── Insight card ────────────────────────────────────────────────── */
function InsightCard({
  insight,
  onResolve,
}: {
  insight: FleetInsight;
  onResolve: () => void;
}) {
  const cfg = INSIGHT_CONFIG[insight.type] ?? INSIGHT_CONFIG.route_optimization;
  const pri = PRIORITY_STYLE[insight.priority] ?? PRIORITY_STYLE.medium;

  return (
    <div
      className="neon-card"
      style={{
        borderLeft: `3px solid ${cfg.color}`,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Type + priority */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`icon-glow ${cfg.iconClass}`}
            style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0 }}
          >
            {cfg.icon}
          </div>
          <span style={{
            padding: '2px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
            background: cfg.bg, color: cfg.color,
            border: `1px solid ${cfg.color}30`,
            boxShadow: `0 0 8px ${cfg.color}25`,
          }}>
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            style={{
              padding: '2px 9px', borderRadius: 99,
              fontSize: 10.5, fontWeight: 700,
              background: pri.bg, color: pri.color,
              border: `1px solid ${pri.border}`,
              boxShadow: `0 0 8px ${pri.glow}`,
            }}
          >
            {pri.label}
          </span>
          <button
            onClick={onResolve}
            style={{
              padding: '4px 10px', borderRadius: 7,
              fontSize: 11, fontWeight: 700,
              background: 'rgba(16,185,129,0.1)',
              color: '#10b981',
              border: '1px solid rgba(16,185,129,0.25)',
              boxShadow: '0 0 8px rgba(16,185,129,0.15)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <CheckCircle size={11} />
            Resolve
          </button>
        </div>
      </div>

      {/* Title */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.4, margin: 0 }}>
        {insight.title}
      </h3>

      {/* Detail */}
      <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.65, margin: 0 }}>
        {insight.detail}
      </p>

      {/* Action */}
      <div
        style={{
          borderTop: '1px solid rgba(59,130,246,0.1)', paddingTop: 12,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}
      >
        <ChevronRight size={13} color="#8b5cf6" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12.5, color: '#6d28d9', fontWeight: 600, lineHeight: 1.4, margin: 0 }}>
          {insight.action}
        </p>
      </div>
    </div>
  );
}

/* ── Live summary strip ──────────────────────────────────────────── */
function LiveSummaryStrip({ summary }: { summary: LiveSummary }) {
  const peaks = Array.isArray(summary.peak_hours_today) ? summary.peak_hours_today : [];
  const peakLabel = peaks
    .slice(0, 3)
    .map((h) => `${String(h).padStart(2, '0')}:00`)
    .join(', ');
  const breakdown = summary.congestion_breakdown ?? { high: 0, medium: 0, low: 0 };

  return (
    <div
      className="neon-card"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
        border: '1px solid rgba(59,130,246,0.2)',
        boxShadow: '0 0 32px rgba(59,130,246,0.1)',
        padding: '18px 22px',
      }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
        <div className="icon-glow icon-glow-blue" style={{ width: 22, height: 22, borderRadius: 6 }}>
          <Activity size={12} color="#60a5fa" />
        </div>
        <p style={{ fontSize: 11.5, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Live Traffic Context — used to generate insights
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {/* Avg speed */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)', paddingRight: 12 }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Car size={12} color="#94a3b8" />
            <p style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>Avg Speed</p>
          </div>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1, textShadow: '0 0 12px rgba(59,130,246,0.5)' }}>
            {Number(summary.avg_speed_kmh ?? 0).toFixed(0)}
          </p>
          <p style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>km/h</p>
        </div>

        {/* Active incidents */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)', paddingRight: 12 }}>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle size={12} color="#94a3b8" />
            <p style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>Incidents</p>
          </div>
          <p style={{ fontSize: 22, fontWeight: 800, color: summary.active_incidents > 3 ? '#f87171' : '#fff', letterSpacing: '-0.02em', lineHeight: 1, textShadow: summary.active_incidents > 3 ? '0 0 12px rgba(239,68,68,0.6)' : 'none' }}>
            {summary.active_incidents ?? 0}
          </p>
          <p style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>active now</p>
        </div>

        {/* Congestion breakdown */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)', paddingRight: 12 }}>
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 size={12} color="#94a3b8" />
            <p style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>Congestion</p>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {[
              { label: 'H', value: breakdown.high ?? 0, color: '#ef4444' },
              { label: 'M', value: breakdown.medium ?? 0, color: '#f59e0b' },
              { label: 'L', value: breakdown.low ?? 0, color: '#10b981' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1, textShadow: `0 0 8px ${color}60` }}>{value}</p>
                <p style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Peak hours */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)', paddingRight: 12 }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={12} color="#94a3b8" />
            <p style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>Peak Hours</p>
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', lineHeight: 1.4, marginTop: 4, textShadow: '0 0 8px rgba(245,158,11,0.5)' }}>
            {peakLabel || '—'}
          </p>
        </div>

        {/* Top hotspot */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin size={12} color="#94a3b8" />
            <p style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>Top Hotspot</p>
          </div>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: '#f87171', lineHeight: 1.4, marginTop: 4, textShadow: '0 0 8px rgba(239,68,68,0.4)' }}>
            {summary.top_hotspot || '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */
function unwrapFleetInsights(body: unknown): FleetInsightsResult {
  const root = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const inner = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>;
  const insightsRaw = inner.insights;
  const insights = Array.isArray(insightsRaw) ? (insightsRaw as FleetInsight[]) : [];
  const live = (inner.live_summary && typeof inner.live_summary === 'object'
    ? inner.live_summary
    : {}) as Partial<LiveSummary>;
  return {
    org_id: String(inner.org_id ?? ''),
    org_name: String(inner.org_name ?? 'Fleet'),
    vehicle_count: Number(inner.vehicle_count ?? 0),
    live_summary: {
      avg_speed_kmh: Number(live.avg_speed_kmh ?? 0),
      active_incidents: Number(live.active_incidents ?? 0),
      congestion_breakdown: {
        high: Number(live.congestion_breakdown?.high ?? 0),
        medium: Number(live.congestion_breakdown?.medium ?? 0),
        low: Number(live.congestion_breakdown?.low ?? 0),
      },
      peak_hours_today: Array.isArray(live.peak_hours_today) ? live.peak_hours_today.map(Number) : [],
      top_hotspot: String(live.top_hotspot ?? '—'),
    },
    insights,
    message: inner.message != null ? String(inner.message) : undefined,
    generated_at: String(inner.generated_at ?? new Date().toISOString()),
  };
}

export default function FleetInsightsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FleetInsightsResult | null>(null);
  const [error, setError] = useState('');
  const [acknowledged, setAcknowledged] = useState<Set<number>>(new Set());

  const generate = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setError('');
    setAcknowledged(new Set());
    try {
      // Backend auto-resolves "demo-org" → user's first org, or auto-creates one
      const res = await api.get('/fleet/demo-org/ai-insights');
      setResult(unwrapFleetInsights(res.data));
    } catch (e) {
      const err = e as { response?: { data?: { error?: string; detail?: string } }; message?: string };
      setError(err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to load fleet insights');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-generate on mount
  useEffect(() => { void generate(); }, [generate]);

  const insights = result?.insights ?? [];
  const activeInsights = insights.filter((_, i) => !acknowledged.has(i));
  const resolvedCount = acknowledged.size;

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
                <Truck size={10} style={{ display: 'inline', marginRight: 4 }} />
                Fleet AI
              </span>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
              Fleet AI Insights
            </h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
              AI-generated patterns from live traffic + your fleet data
            </p>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="btn-gradient"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 9,
              fontSize: 13, fontWeight: 700,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading
              ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
              : <Zap size={14} />}
            {loading ? 'Analysing…' : 'Regenerate'}
          </button>
        </div>
      </div>

      {/* ── Loading ───────────────────────────── */}
      {error && !loading && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              padding: '16px 22px', borderRadius: 12,
              background: 'rgba(59,130,246,0.05)',
              border: '1px solid rgba(59,130,246,0.15)',
              boxShadow: '0 0 16px rgba(59,130,246,0.08)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            <div className="icon-glow icon-glow-blue radium-pulse" style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0 }}>
              <RefreshCw size={16} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: '#1e40af' }}>
                AI is analysing live traffic + your fleet data…
              </p>
              <p style={{ fontSize: 12, color: '#60a5fa', marginTop: 2 }}>
                Pulling peak hours, hotspots, incidents, and congestion breakdown from the database
              </p>
            </div>
          </div>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="skeleton-neon"
              style={{
                height: 150, borderRadius: 14,
                animation: `shimmer 1.4s ease ${i * 0.18}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* ── Results ───────────────────────────── */}
      {result && !loading && (
        <>
          {/* Optional message from backend */}
          {result.message && (
            <div
              className="flex items-center gap-2"
              style={{
                padding: '11px 16px', borderRadius: 10,
                background: 'rgba(245,158,11,0.07)',
                border: '1px solid rgba(245,158,11,0.25)',
                boxShadow: '0 0 12px rgba(245,158,11,0.1)',
                fontSize: 13, color: '#92400e',
              }}
            >
              <AlertTriangle size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
              {result.message}
            </div>
          )}

          {/* Fleet summary bar */}
          <div className="neon-card" style={{ padding: '16px 24px' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>{result.org_name}</h2>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  {result.vehicle_count} vehicle{result.vehicle_count !== 1 ? 's' : ''} · Generated{' '}
                  {new Date(result.generated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: 'Total',    value: insights.length, color: '#3b82f6', glow: 'rgba(59,130,246,0.4)'  },
                  { label: 'Active',   value: activeInsights.length,   color: '#ef4444', glow: 'rgba(239,68,68,0.4)'  },
                  { label: 'Resolved', value: resolvedCount,           color: '#10b981', glow: 'rgba(16,185,129,0.4)' },
                ].map(({ label, value, color, glow }) => (
                  <div key={label} style={{ textAlign: 'center', padding: '0 16px', borderLeft: '1px solid #f1f5f9' }}>
                    <p style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: '-0.02em', lineHeight: 1, textShadow: `0 0 12px ${glow}` }}>{value}</p>
                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontWeight: 600 }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live summary (real-time data that informed insights) */}
          {result.live_summary && <LiveSummaryStrip summary={result.live_summary} />}

          {/* Insights */}
          {activeInsights.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {insights.map((insight, i) => {
                if (acknowledged.has(i)) return null;
                return (
                  <InsightCard
                    key={`${insight.type}-${i}`}
                    insight={insight}
                    onResolve={() => setAcknowledged((prev) => new Set([...prev, i]))}
                  />
                );
              })}
            </div>
          ) : (
            <div className="neon-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div className="icon-glow icon-glow-green" style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 12px' }}>
                <CheckCircle size={28} color="#10b981" />
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                All insights resolved!
              </p>
              <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                Your fleet is running optimally. Regenerate to check for new patterns.
              </p>
              <button
                onClick={generate}
                className="btn-gradient"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 18px', borderRadius: 8,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <RefreshCw size={13} />
                Regenerate
              </button>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
      `}</style>
    </div>
  );
}
