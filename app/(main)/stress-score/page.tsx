'use client';

import { useState, useCallback } from 'react';
import { HeartPulse, MapPin, RefreshCw, Zap, AlertTriangle, Wind, Clock, CheckCircle, User } from 'lucide-react';
import { commuteApi } from '@/lib/api';
import type { CommuteStressData } from '@/lib/types';

/* ── Real API shapes ─────────────────────────────────────────────── */
type StressResult = CommuteStressData;

/* ── Color map from API "color" string → hex ─────────────────────── */
const COLOR_HEX: Record<string, string> = {
  green:  '#10b981',
  yellow: '#f59e0b',
  orange: '#f97316',
  red:    '#ef4444',
};

const LABEL_BG: Record<string, string> = {
  green:  'rgba(16,185,129,0.1)',
  yellow: 'rgba(245,158,11,0.1)',
  orange: 'rgba(249,115,22,0.1)',
  red:    'rgba(239,68,68,0.1)',
};

const CONGESTION_STYLE: Record<string, { color: string; bg: string }> = {
  high:   { color: '#dc2626', bg: '#fef2f2' },
  medium: { color: '#d97706', bg: '#fffbeb' },
  low:    { color: '#16a34a', bg: '#f0fdf4' },
};

/* ── Gauge ───────────────────────────────────────────────────────── */
function ScoreGauge({ score, colorKey }: { score: number; colorKey: string }) {
  const r = 72;
  const cx = 90;
  const cy = 90;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - score / 100);
  const color = COLOR_HEX[colorKey] ?? '#f97316';

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={180} height={180} style={{ display: 'block', margin: '0 auto' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={12} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={12} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 1.2s ease, stroke 0.5s', filter: `drop-shadow(0 0 6px ${color})` }}
        />
        <text x={cx} y={cy - 8} textAnchor="middle"
          style={{ fontSize: 32, fontWeight: 900, fill: '#0f172a', fontFamily: 'inherit' }}>
          {score}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle"
          style={{ fontSize: 12, fill: color, fontWeight: 700, fontFamily: 'inherit', filter: `drop-shadow(0 0 4px ${color})` }}>
          / 100
        </text>
      </svg>

      {/* Score legend */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
        {[
          { label: 'Calm',       key: 'green'  },
          { label: 'Moderate',   key: 'yellow' },
          { label: 'Stressful',  key: 'orange' },
          { label: 'Intense',    key: 'red'    },
        ].map(({ label, key }) => (
          <div key={key} style={{ textAlign: 'center' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: COLOR_HEX[key],
              margin: '0 auto 3px',
              boxShadow: colorKey === key ? `0 0 10px ${COLOR_HEX[key]}, 0 0 4px ${COLOR_HEX[key]}` : 'none',
            }} />
            <p style={{ fontSize: 9.5, color: colorKey === key ? '#334155' : '#94a3b8', fontWeight: colorKey === key ? 700 : 500 }}>
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Factor row ──────────────────────────────────────────────────── */
function FactorBar({
  label, icon, children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div className="icon-glow icon-glow-purple" style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>{label}</p>
        {children}
      </div>
    </div>
  );
}

function ProgressFactorBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
        <div className="progress-neon-orange" style={{ width: `${pct}%`, height: '100%', transition: 'width 1s ease' }} />
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 700, color, minWidth: 36, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */
export default function StressScorePage() {
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StressResult | null>(null);

  const getScore = useCallback(async () => {
    if (!location.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await commuteApi.stressScore({ location: location.trim() });
      setResult(res.data);
    } catch {
      /* keep null */
    } finally {
      setLoading(false);
    }
  }, [location]);

  const colorHex = result ? (COLOR_HEX[result.color] ?? '#f97316') : '#f97316';
  const variabilityColor = (v: string) =>
    v === 'high' ? '#ef4444' : v === 'medium' ? '#f59e0b' : '#10b981';

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
                <HeartPulse size={10} style={{ display: 'inline', marginRight: 4 }} />
                Wellness Metric
              </span>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
              Commute Stress Score
            </h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
              A 0–100 wellness metric for your drive — 4 live factors, updated in real time
            </p>
          </div>
          <button
            onClick={getScore}
            disabled={loading || !location.trim()}
            className="btn-gradient"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 22px', borderRadius: 9, fontSize: 13.5, fontWeight: 700,
              opacity: loading || !location.trim() ? 0.5 : 1,
              cursor: loading || !location.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <HeartPulse size={14} />}
            {loading ? 'Calculating…' : 'Get Score'}
          </button>
        </div>
      </div>

      {/* ── Input ─────────────────────────────── */}
      <div className="neon-card" style={{ padding: '22px 24px' }}>
        <h2 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>
          Analyse a commute location
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <MapPin size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void getScore()}
              placeholder="Enter city or area, e.g. Silk Board, Bengaluru"
              style={{
                width: '100%', paddingLeft: 32, paddingRight: 14, paddingTop: 10, paddingBottom: 10,
                borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 13.5, color: '#0f172a',
                background: '#f8fafc', outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.1)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
          <button
            onClick={getScore}
            disabled={loading || !location.trim()}
            className="btn-gradient"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 22px', borderRadius: 9, fontSize: 13.5, fontWeight: 700,
              opacity: loading || !location.trim() ? 0.5 : 1,
              cursor: loading || !location.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <HeartPulse size={14} />}
            {loading ? 'Calculating…' : 'Get Score'}
          </button>
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2" style={{ marginTop: 12 }}>
          {['Silk Board, Bangalore', 'Andheri, Mumbai', 'Connaught Place, Delhi', 'Hitech City, Hyderabad'].map((loc) => (
            <button
              key={loc}
              onClick={() => setLocation(loc)}
              style={{
                padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                background: location === loc ? 'rgba(139,92,246,0.12)' : '#f1f5f9',
                color: location === loc ? '#8b5cf6' : '#64748b',
                border: `1px solid ${location === loc ? 'rgba(139,92,246,0.35)' : '#e2e8f0'}`,
                cursor: 'pointer', transition: 'all 0.1s',
                boxShadow: location === loc ? '0 0 10px rgba(139,92,246,0.2)' : 'none',
              }}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results ───────────────────────────── */}
      {result && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Score gauge */}
            <div className="neon-card" style={{ padding: '24px' }}>
              {/* Label pill */}
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                    Current Score
                  </p>
                  <p style={{ fontSize: 12, color: '#94a3b8' }}>
                    {result.matched_location && result.matched_location !== result.location
                      ? `${result.location} → matched “${result.matched_location}”`
                      : result.location}
                  </p>
                </div>
                <span
                  style={{
                    padding: '4px 12px', borderRadius: 99,
                    fontSize: 12, fontWeight: 700,
                    background: LABEL_BG[result.color] ?? LABEL_BG.orange,
                    color: colorHex,
                    boxShadow: `0 0 12px ${colorHex}40`,
                    border: `1px solid ${colorHex}40`,
                  }}
                >
                  {result.label}
                </span>
              </div>

              <ScoreGauge score={result.stress_score} colorKey={result.color} />

              {/* Verdict */}
              <div
                style={{
                  marginTop: 16, padding: '11px 14px', borderRadius: 9,
                  background: `${colorHex}0d`,
                  border: `1px solid ${colorHex}30`,
                  boxShadow: `0 0 12px ${colorHex}15`,
                }}
              >
                <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.55, margin: 0 }}>
                  {result.verdict}
                </p>
              </div>

              {/* Personal comparison */}
              {result.personal_comparison && (
                <div
                  className="flex items-center gap-2"
                  style={{
                    marginTop: 10, padding: '9px 12px', borderRadius: 9,
                    background: 'rgba(59,130,246,0.06)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    boxShadow: '0 0 12px rgba(59,130,246,0.1)',
                  }}
                >
                  <div className="icon-glow icon-glow-blue" style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0 }}>
                    <User size={12} color="#3b82f6" />
                  </div>
                  <p style={{ fontSize: 12.5, color: '#1e40af', fontWeight: 600 }}>
                    {result.personal_comparison}
                  </p>
                </div>
              )}
            </div>

            {/* Breakdown */}
            <div className="neon-card" style={{ padding: '22px 24px' }}>
              <h2 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Score Breakdown</h2>
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
                {result.breakdown?.data_available === false
                  ? 'Estimated — no recent traffic records for this area'
                  : 'Live factors from real traffic data (not inflated when congestion is already low)'}
              </p>

              {result.breakdown?.data_available === false ? (
                /* ── No-data state ── */
                <div
                  style={{
                    padding: '20px 16px', borderRadius: 10,
                    background: 'rgba(245,158,11,0.06)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    boxShadow: '0 0 16px rgba(245,158,11,0.08)',
                    textAlign: 'center',
                  }}
                >
                  <div className="icon-glow icon-glow-yellow" style={{ width: 40, height: 40, borderRadius: 12, margin: '0 auto 10px' }}>
                    <AlertTriangle size={20} color="#f59e0b" />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
                    No recent traffic data
                  </p>
                  <p style={{ fontSize: 12, color: '#b45309', lineHeight: 1.6 }}>
                    FlowCast has no records for <strong>{result.location}</strong> in the past hour.
                    The score of <strong>{result.stress_score}</strong> is a baseline estimate.
                    Try a major city area or check back when traffic data is available.
                  </p>
                  {/* Still show incidents from top-level field */}
                  <div
                    style={{
                      marginTop: 14, padding: '9px 14px', borderRadius: 8,
                      background: '#fff', border: '1px solid #e2e8f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={13} color="#f97316" />
                      <span style={{ fontSize: 12.5, color: '#334155', fontWeight: 600 }}>Active Incidents Nearby</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: (result.active_incidents ?? 0) > 0 ? '#ef4444' : '#10b981', textShadow: (result.active_incidents ?? 0) > 0 ? '0 0 8px rgba(239,68,68,0.5)' : '0 0 8px rgba(16,185,129,0.5)' }}>
                      {result.active_incidents ?? 0}
                    </span>
                  </div>
                </div>
              ) : (
                /* ── Data available — show all 4 factors ── */
                <>
                  {/* Factor 1: Duration vs free-flow */}
                  <FactorBar label="Duration vs Free-Flow" icon={<Clock size={15} color="#ef4444" />}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                        <div className="progress-neon-red" style={{
                          width: `${Math.min(100, result.breakdown?.duration_vs_freeflow_pct ?? 0)}%`,
                          height: '100%', transition: 'width 1s ease',
                        }} />
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#ef4444', minWidth: 42, textAlign: 'right' }}>
                        +{Math.round(result.breakdown?.duration_vs_freeflow_pct ?? 0)}%
                      </span>
                    </div>
                  </FactorBar>

                  {/* Factor 2: Active incidents — always from top-level field */}
                  <FactorBar label="Active Incidents Nearby" icon={<AlertTriangle size={15} color="#f97316" />}>
                    <ProgressFactorBar value={result.active_incidents ?? 0} max={5} color="#f97316" />
                  </FactorBar>

                  {/* Factor 3: Speed variability */}
                  <FactorBar
                    label="Speed Variability (stop-and-go)"
                    icon={<Wind size={15} color={variabilityColor(result.breakdown?.speed_variability ?? 'low')} />}
                  >
                    <div className="flex items-center gap-2">
                      <div style={{ flex: 1, height: 6, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                        <div className="progress-neon" style={{
                          width: result.breakdown?.speed_variability === 'high' ? '80%'
                            : result.breakdown?.speed_variability === 'medium' ? '45%' : '15%',
                          height: '100%', transition: 'width 1s ease',
                        }} />
                      </div>
                      <span style={{
                        fontSize: 12.5, fontWeight: 700,
                        color: variabilityColor(result.breakdown?.speed_variability ?? 'low'),
                        textTransform: 'capitalize', minWidth: 48, textAlign: 'right',
                      }}>
                        {result.breakdown?.speed_variability ?? '—'}
                      </span>
                    </div>
                  </FactorBar>

                  {/* Factor 4: Congestion level */}
                  <FactorBar
                    label="Overall Congestion Level"
                    icon={<HeartPulse size={15} color={CONGESTION_STYLE[result.breakdown?.congestion_level ?? '']?.color ?? '#64748b'} />}
                  >
                    <span
                      style={{
                        padding: '3px 12px', borderRadius: 99,
                        fontSize: 12, fontWeight: 700,
                        background: CONGESTION_STYLE[result.breakdown?.congestion_level ?? '']?.bg ?? '#f1f5f9',
                        color: CONGESTION_STYLE[result.breakdown?.congestion_level ?? '']?.color ?? '#64748b',
                        textTransform: 'capitalize',
                        boxShadow: `0 0 8px ${CONGESTION_STYLE[result.breakdown?.congestion_level ?? '']?.color ?? '#64748b'}30`,
                      }}
                    >
                      {result.breakdown?.congestion_level ?? '—'}
                    </span>
                  </FactorBar>
                </>
              )}
            </div>
          </div>

          {/* AI Tip */}
          {result.tip && (
            <div
              className="neon-card"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.04))',
                border: '1px solid rgba(16,185,129,0.25)',
                boxShadow: '0 0 24px rgba(16,185,129,0.1)',
                padding: '18px 22px', display: 'flex', gap: 14, alignItems: 'flex-start',
              }}
            >
              <div className="icon-glow icon-glow-green" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}>
                <CheckCircle size={18} color="#10b981" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Zap size={12} color="#10b981" />
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Recommendation
                  </p>
                </div>
                <p style={{ fontSize: 13.5, color: '#14532d', lineHeight: 1.65 }}>{result.tip}</p>
              </div>
            </div>
          )}

          {/* Evaluated timestamp */}
          {result.evaluated_at && (
            <p style={{ fontSize: 11.5, color: '#94a3b8', textAlign: 'right' }}>
              Evaluated at {new Date(result.evaluated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} IST
            </p>
          )}
        </>
      )}

      {/* ── Empty state ───────────────────────── */}
      {!result && !loading && (
        <div className="neon-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div className="icon-glow icon-glow-purple" style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px' }}>
            <HeartPulse size={26} color="#8b5cf6" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
            Know your commute stress level
          </h3>
          <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 380, margin: '0 auto' }}>
            Enter your city or area above. We&apos;ll calculate a 0–100 wellness score from live traffic data — no distance or route needed.
          </p>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
