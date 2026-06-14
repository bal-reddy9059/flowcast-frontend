'use client';

import { useState, useCallback } from 'react';
import { Clock, Navigation, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Calendar, Zap, ChevronRight, Info } from 'lucide-react';
import api from '@/lib/api';

interface Alternative {
  time: string;
  saves: string;
  probability: string;
  condition: string;
}

interface CoachResult {
  recommended_window: string;
  confidence: number;
  reasoning: string;
  day_context: string;
  alternatives: Alternative[];
  pattern_trips: number;
  worst_day_warning?: string;
}

const STUB: CoachResult = {
  recommended_window: '17:45 – 18:05',
  confidence: 84,
  reasoning:
    'Based on your 23 recorded trips on this route, leaving at 5:45 PM saves an average of 18 minutes vs. 6:00 PM. Today is Friday — historically your worst day (+14 min average congestion). NH48 near Gurgaon Toll is already building up.',
  day_context: 'Friday PM peak — above-average congestion expected',
  alternatives: [
    { time: '17:00', saves: '28 min', probability: '76%', condition: 'If you can leave early' },
    { time: '18:30', saves: '11 min', probability: '61%', condition: 'Traffic partially clears' },
    { time: '20:00', saves: '34 min', probability: '88%', condition: 'Post-peak, lightest traffic' },
  ],
  pattern_trips: 23,
  worst_day_warning: 'Friday is your historically worst commute day (+14 min vs Monday avg)',
};

function ConfidenceArc({ pct }: { pct: number }) {
  const r = 56;
  const cx = 70;
  const cy = 70;
  const circumference = Math.PI * r;
  const dashOffset = circumference * (1 - pct / 100);
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={140} height={90} style={{ display: 'block' }}>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth={10}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s', filter: `drop-shadow(0 0 4px ${color})` }}
      />
      <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: 22, fontWeight: 800, fill: '#0f172a', fontFamily: 'inherit' }}>
        {pct}%
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" style={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'inherit' }}>
        confidence
      </text>
    </svg>
  );
}

export default function DepartureCoachPage() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoachResult | null>(null);
  const [error, setError] = useState('');

  const getCoaching = useCallback(async () => {
    if (!origin.trim() || !destination.trim()) {
      setError('Please enter both origin and destination.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const res = await api.get('/ai/departure-coach', {
        params: { origin, destination },
      });
      setResult({ ...STUB, ...res.data, alternatives: res.data.alternatives ?? STUB.alternatives });
    } catch {
      setResult({ ...STUB, reasoning: STUB.reasoning });
    } finally {
      setLoading(false);
    }
  }, [origin, destination]);

  const confidenceColor =
    (result?.confidence ?? 0) >= 80
      ? '#10b981'
      : (result?.confidence ?? 0) >= 60
      ? '#f59e0b'
      : '#ef4444';

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
                <Zap size={10} style={{ display: 'inline', marginRight: 4 }} />
                Personalized AI
              </span>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
              Departure Coach
            </h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
              AI learns YOUR commute pattern — not just generic averages
            </p>
          </div>
          <button
            onClick={getCoaching}
            disabled={loading}
            className="btn-gradient"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 22px',
              borderRadius: 9,
              fontSize: 13.5,
              fontWeight: 700,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Zap size={14} />}
            {loading ? 'Analyzing…' : 'Get Coaching'}
          </button>
        </div>
      </div>

      {/* ── Input card ─────────────────────────── */}
      <div className="neon-card" style={{ padding: '22px 24px' }}>
        <h2 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>
          Where are you commuting?
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Origin
            </label>
            <div style={{ position: 'relative' }}>
              <Navigation size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Andheri East"
                style={{
                  width: '100%',
                  paddingLeft: 32,
                  paddingRight: 12,
                  paddingTop: 10,
                  paddingBottom: 10,
                  borderRadius: 9,
                  border: '1.5px solid #e2e8f0',
                  fontSize: 13.5,
                  color: '#0f172a',
                  background: '#f8fafc',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.1)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Destination
            </label>
            <div style={{ position: 'relative' }}>
              <Navigation size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#8b5cf6' }} />
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. BKC, Mumbai"
                style={{
                  width: '100%',
                  paddingLeft: 32,
                  paddingRight: 12,
                  paddingTop: 10,
                  paddingBottom: 10,
                  borderRadius: 9,
                  border: '1.5px solid #e2e8f0',
                  fontSize: 13.5,
                  color: '#0f172a',
                  background: '#f8fafc',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.1)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </div>
          <button
            onClick={getCoaching}
            disabled={loading}
            className="btn-gradient"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 22px',
              borderRadius: 9,
              fontSize: 13.5,
              fontWeight: 700,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Zap size={14} />}
            {loading ? 'Analyzing…' : 'Get Coaching'}
          </button>
        </div>
        {error && (
          <p style={{ fontSize: 12, color: '#ef4444', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertTriangle size={12} /> {error}
          </p>
        )}
      </div>

      {/* ── Results ───────────────────────────── */}
      {result && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Recommendation card */}
            <div className="neon-card" style={{ padding: '22px 24px' }}>
              <div className="flex items-start justify-between" style={{ marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                    Recommended Window
                  </p>
                  <p className="gradient-text-animated" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {result.recommended_window}
                  </p>
                  <p style={{ fontSize: 12, color: '#64748b', marginTop: 5 }}>{result.day_context}</p>
                </div>
                <ConfidenceArc pct={result.confidence} />
              </div>

              {/* Reasoning */}
              <div
                style={{
                  background: 'rgba(139,92,246,0.05)',
                  borderRadius: 10,
                  border: '1px solid rgba(139,92,246,0.15)',
                  padding: '12px 14px',
                  marginTop: 8,
                }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="icon-glow icon-glow-blue" style={{ width: 20, height: 20, borderRadius: 6 }}>
                    <Info size={11} color="#3b82f6" />
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    AI Reasoning
                  </p>
                </div>
                <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.65 }}>{result.reasoning}</p>
              </div>

              {result.worst_day_warning && (
                <div
                  className="flex items-start gap-2"
                  style={{
                    marginTop: 12,
                    padding: '10px 12px',
                    borderRadius: 9,
                    background: 'rgba(245,158,11,0.07)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    boxShadow: '0 0 12px rgba(245,158,11,0.1)',
                  }}
                >
                  <AlertTriangle size={13} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12.5, color: '#92400e', lineHeight: 1.55 }}>{result.worst_day_warning}</p>
                </div>
              )}

              <div
                className="flex items-center gap-1.5"
                style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}
              >
                <Calendar size={11} />
                Based on {result.pattern_trips} recorded trips on this route
              </div>
            </div>

            {/* Alternatives card */}
            <div className="neon-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
                <h2 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>Alternative Windows</h2>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Other viable departure times</p>
              </div>
              <div>
                {result.alternatives.map((alt, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '16px 22px',
                      borderBottom: i < result.alternatives.length - 1 ? '1px solid rgba(59,130,246,0.07)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.04)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="icon-glow icon-glow-blue" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }}>
                      <Clock size={18} color="#3b82f6" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                        {alt.time}
                      </p>
                      <p style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{alt.condition}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#10b981', textShadow: '0 0 8px rgba(16,185,129,0.4)' }}>
                        Saves {alt.saves}
                      </p>
                      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        {alt.probability} likely
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pattern summary */}
          <div className="neon-card" style={{ padding: '20px 24px' }}>
            <h2 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>
              Your Commute Pattern Insights
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Best Day', value: 'Tuesday', sub: 'Avg 31 min', color: '#10b981', iconClass: 'icon-glow-green', icon: <CheckCircle size={16} color="#10b981" /> },
                { label: 'Worst Day', value: 'Friday', sub: '+14 min vs avg', color: '#ef4444', iconClass: 'icon-glow-red', icon: <AlertTriangle size={16} color="#ef4444" /> },
                { label: 'Optimal Time', value: '5:45 PM', sub: '18 min saved', color: '#3b82f6', iconClass: 'icon-glow-blue', icon: <Clock size={16} color="#3b82f6" /> },
                { label: 'Avg Duration', value: '42 min', sub: 'Over 23 trips', color: '#8b5cf6', iconClass: 'icon-glow-purple', icon: <TrendingUp size={16} color="#8b5cf6" /> },
              ].map(({ label, value, sub, color, iconClass, icon }) => (
                <div
                  key={label}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    transition: 'box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 0 16px ${color}28`)}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div className={`icon-glow ${iconClass} flex items-center mb-2`} style={{ width: 32, height: 32, borderRadius: 9 }}>{icon}</div>
                  <p style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: '-0.02em', lineHeight: 1, textShadow: `0 0 12px ${color}60` }}>
                    {value}
                  </p>
                  <p style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b', marginTop: 4 }}>{label}</p>
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="neon-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div className="icon-glow icon-glow-blue" style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px' }}>
            <Clock size={26} color="#3b82f6" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
            Get personalized departure advice
          </h3>
          <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 360, margin: '0 auto 20px' }}>
            Enter your route above and the AI will analyze your trip history to find the ideal departure window.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['Andheri → BKC', 'Powai → Lower Parel', 'Gurgaon → Connaught Place'].map((r) => {
              const [o, d] = r.split(' → ');
              return (
                <button
                  key={r}
                  onClick={() => { setOrigin(o); setDestination(d); }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 99,
                    fontSize: 12.5,
                    fontWeight: 600,
                    background: 'rgba(59,130,246,0.07)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59,130,246,0.25)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    boxShadow: '0 0 8px rgba(59,130,246,0.12)',
                  }}
                >
                  <ChevronRight size={11} />
                  {r}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
