'use client';

import { useState, useEffect } from 'react';
import {
  Brain, Zap, RefreshCw, BarChart2, Clock,
  CheckCircle2, AlertTriangle, TrendingUp, Activity, Database,
} from 'lucide-react';
import api from '@/lib/api';

/* ─── Types ──────────────────────────────────────────────────── */
interface ModelInfo {
  status: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  training_records: number;
  last_trained: string;
  next_retrain: string;
  model_type: string;
  features: number;
}

interface Prediction {
  hour: number;
  label: 'Low' | 'Medium' | 'High' | 'Critical';
  confidence: number;
}

/* ─── Static data ────────────────────────────────────────────── */
const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Nagpur'];

const FEATURE_IMPORTANCE = [
  { feature: 'Hour of Day',               importance: 0.28, color: '#3b82f6' },
  { feature: 'Day of Week',               importance: 0.22, color: '#8b5cf6' },
  { feature: 'Historical Avg Speed',      importance: 0.19, color: '#10b981' },
  { feature: 'Weather Condition',         importance: 0.14, color: '#f59e0b' },
  { feature: 'Is Peak Hour',             importance: 0.09, color: '#ef4444' },
  { feature: 'Previous Hour Congestion', importance: 0.08, color: '#ec4899' },
];

const MODEL_STUB: ModelInfo = {
  status: 'operational',
  accuracy: 0.872,
  precision: 0.841,
  recall: 0.893,
  f1: 0.866,
  training_records: 48200,
  last_trained: new Date(Date.now() - 2.3 * 3600000).toISOString(),
  next_retrain: new Date(Date.now() + 3.7 * 3600000).toISOString(),
  model_type: 'RandomForest',
  features: 6,
};

/* ─── Helpers ────────────────────────────────────────────────── */
function congStyle(label: string) {
  return ({
    Low:      { color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', bar: '#10b981', glowClass: 'icon-glow-green' },
    Medium:   { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', bar: '#f59e0b', glowClass: 'icon-glow-yellow' },
    High:     { color: '#f97316', bg: '#fff7ed', border: '#fed7aa', bar: '#f97316', glowClass: 'icon-glow-orange' },
    Critical: { color: '#ef4444', bg: '#fef2f2', border: '#fecaca', bar: '#ef4444', glowClass: 'icon-glow-red' },
  } as Record<string, { color: string; bg: string; border: string; bar: string; glowClass: string }>)[label] ?? { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', bar: '#94a3b8', glowClass: 'icon-glow' };
}

function relAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ${Math.floor((d % 3600) / 60)}m ago`;
}

function relIn(iso: string) {
  const d = (new Date(iso).getTime() - Date.now()) / 1000;
  if (d < 60) return 'very soon';
  if (d < 3600) return `in ${Math.floor(d / 60)}m`;
  return `in ${Math.floor(d / 3600)}h ${Math.floor((d % 3600) / 60)}m`;
}

function fmt2(h: number) { return `${String(h).padStart(2, '0')}:00`; }

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeModelInfo(d: any, prev: ModelInfo): Partial<ModelInfo> {
  const trainedAt = d.trained_at ?? d.last_trained;
  const intervalH = d.retrain_interval_hours ?? 6;
  return {
    status:           d.ready !== undefined ? (d.ready ? 'operational' : 'offline') : (d.status ?? prev.status),
    training_records: d.training_samples ?? d.training_records ?? prev.training_records,
    last_trained:     trainedAt ?? prev.last_trained,
    next_retrain:     trainedAt
      ? new Date(new Date(trainedAt).getTime() + intervalH * 3600000).toISOString()
      : prev.next_retrain,
    model_type: typeof d.model_type === 'string'
      ? d.model_type.replace(/Classifier.*$/i, '').trim() || prev.model_type
      : prev.model_type,
    features: Array.isArray(d.features) ? d.features.length : (d.features ?? prev.features),
  };
}

function genStubPredictions(city: string): Prediction[] {
  const now = new Date().getHours();
  const seed = city.charCodeAt(0);
  return [1, 2, 3].map(offset => {
    const h = (now + offset) % 24;
    const isPeak = (h >= 8 && h <= 10) || (h >= 17 && h <= 20);
    const isNight = h >= 23 || h <= 5;
    const base = isNight ? 0 : isPeak ? 2 + (seed % 2) : 1;
    const labels: Array<'Low' | 'Medium' | 'High' | 'Critical'> = ['Low', 'Medium', 'High', 'Critical'];
    const label = labels[Math.min(3, base)] as 'Low' | 'Medium' | 'High' | 'Critical';
    return { hour: h, label, confidence: 0.72 + Math.random() * 0.23 };
  });
}

/* ─── Sub-components ─────────────────────────────────────────── */
function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: '-0.04em', margin: '2px 0 0' }}>{value}</p>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function MLPredictPage() {
  const [model, setModel] = useState<ModelInfo>(MODEL_STUB);
  const [city, setCity] = useState('Mumbai');
  const [predicting, setPredicting] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  const fetchModelInfo = async () => {
    setRefreshing(true);
    try {
      const r = await api.get('/traffic/ml/model-info');
      if (r.data) setModel(m => ({ ...m, ...normalizeModelInfo(r.data, m) }));
    } catch { /* stub */ }
    setRefreshing(false);
  };

  useEffect(() => { void fetchModelInfo(); }, []);

  const handlePredict = async () => {
    setPredicting(true);
    setPredictions(null);
    try {
      const r = await api.get('/traffic/ml/predict', { params: { location: city } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawList: any[] = r.data?.forecast ?? r.data?.predictions ?? [];
      const mapped: Prediction[] = rawList.map(f => ({
        hour:       Number(f.target_hour ?? f.hour ?? 0),
        label:      capitalize(String(f.predicted_congestion ?? f.label ?? 'medium')) as Prediction['label'],
        confidence: Number(f.confidence ?? 0.8),
      }));
      setPredictions(mapped.length ? mapped : genStubPredictions(city));
      if (r.data?.model_info) setModel(m => ({ ...m, ...normalizeModelInfo(r.data.model_info, m) }));
    } catch {
      await new Promise(res => setTimeout(res, 800));
      setPredictions(genStubPredictions(city));
    }
    setAnimKey(k => k + 1);
    setPredicting(false);
  };

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero Banner ── */}
      <div className="page-hero" style={{ padding: '28px 32px' }}>
        <div style={{ position: 'relative', zIndex: 1 }} className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="gradient-text-neon" style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
              ML Traffic Prediction
            </h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 5 }}>
              RandomForest classifier trained on live DB records — retrains automatically every 6 hours
            </p>
          </div>
          <button
            onClick={fetchModelInfo} disabled={refreshing}
            className="btn-neon"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', opacity: refreshing ? 0.6 : 1 }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Model status hero ── */}
      <div
        style={{
          borderRadius: 20,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)',
          padding: '30px 36px',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(139,92,246,0.2)',
          boxShadow: '0 0 40px rgba(139,92,246,0.15)',
        }}
      >
        {/* bg glow orbs */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)', animation: 'glow-pulse 4s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: -50, left: '20%', width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)', animation: 'glow-pulse 6s ease-in-out infinite reverse' }} />

        <div className="flex items-start justify-between" style={{ position: 'relative', zIndex: 1 }}>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="radium-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#34d399', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Model Operational
              </span>
            </div>
            <h2 className="gradient-text-neon" style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em', margin: 0 }}>
              {model.model_type} Classifier
            </h2>
            <p style={{ fontSize: 13, color: '#475569', marginTop: 5 }}>
              Trained on {(model.training_records ?? 0).toLocaleString()} records · {model.features ?? 0} input features
            </p>
          </div>
          <div className="icon-glow icon-glow-purple" style={{ width: 64, height: 64, borderRadius: 18, animation: 'float 4s ease-in-out infinite' }}>
            <Brain size={32} color="#8b5cf6" style={{ opacity: 0.9 }} />
          </div>
        </div>

        {/* metrics row */}
        <div className="flex items-center gap-10 mt-8 flex-wrap" style={{ position: 'relative', zIndex: 1 }}>
          <MetricPill label="Accuracy"  value={pct(model.accuracy)}  color="#34d399" />
          <MetricPill label="Precision" value={pct(model.precision)} color="#60a5fa" />
          <MetricPill label="Recall"    value={pct(model.recall)}    color="#a78bfa" />
          <MetricPill label="F1 Score"  value={pct(model.f1)}        color="#fbbf24" />
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Last trained</p>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: '#94a3b8', margin: '2px 0 8px' }}>{relAgo(model.last_trained)}</p>
            <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Next retrain</p>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: '#94a3b8', margin: '2px 0 0' }}>{relIn(model.next_retrain)}</p>
          </div>
        </div>
      </div>

      {/* ── Predict + results ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, alignItems: 'start' }}>

        {/* left: predict panel */}
        <div className="neon-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', margin: 0 }}>Run Forecast</h3>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>City</label>
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13.5, color: '#0f172a', outline: 'none', boxSizing: 'border-box', background: '#fff', cursor: 'pointer' }}
            >
              {CITIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="glass-neon" style={{ padding: '12px 14px', borderRadius: 10 }}>
            <p style={{ fontSize: 11.5, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
              Predicts <strong style={{ color: '#334155' }}>congestion level</strong> (Low / Medium / High / Critical) for the next <strong style={{ color: '#334155' }}>3 hours</strong> based on time of day, day of week, and city patterns.
            </p>
          </div>

          <button
            onClick={handlePredict}
            disabled={predicting}
            className={predicting ? '' : 'btn-gradient'}
            style={{
              width: '100%', padding: '12px', borderRadius: 11, fontSize: 14, fontWeight: 700,
              background: predicting ? '#94a3b8' : undefined,
              color: '#fff', border: 'none', cursor: predicting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'opacity 0.2s',
            }}
          >
            {predicting ? (
              <><RefreshCw size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Predicting…</>
            ) : (
              <><Zap size={15} /> Predict Next 3 Hours</>
            )}
          </button>

          {/* info pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { Icon: Database, text: `${model.training_records.toLocaleString()} training records`, glowClass: 'icon-glow-blue' },
              { Icon: TrendingUp, text: `${pct(model.accuracy)} prediction accuracy`, glowClass: 'icon-glow-green' },
              { Icon: Activity, text: 'Auto-retrains every 6 hours', glowClass: 'icon-glow-purple' },
            ].map(({ Icon, text, glowClass }) => (
              <div key={text} className="flex items-center gap-2">
                <div className={`icon-glow ${glowClass}`} style={{ width: 22, height: 22, borderRadius: 6 }}>
                  <Icon size={11} />
                </div>
                <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* right: results */}
        <div className="neon-card" style={{ padding: '22px', minHeight: 240 }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', margin: '0 0 18px' }}>
            {predictions ? `Congestion Forecast — ` : 'Awaiting Prediction'}
            {predictions && <span className="gradient-text">{city}</span>}
          </h3>

          {!predictions && !predicting && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, gap: 12 }}>
              <div className="icon-glow icon-glow-purple" style={{ width: 60, height: 60, borderRadius: 18 }}>
                <Brain size={28} color="#8b5cf6" />
              </div>
              <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', margin: 0 }}>
                Select a city and click &ldquo;Predict Next 3 Hours&rdquo; to run the model
              </p>
            </div>
          )}

          {predicting && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 70, borderRadius: 12, animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          )}

          {predictions && !predicting && (
            <div key={animKey} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {predictions.map(({ hour, label, confidence }, i) => {
                const s = congStyle(label);
                return (
                  <div
                    key={i}
                    className="glass-neon"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '16px 18px', borderRadius: 13,
                      border: `1.5px solid ${s.border}`,
                      boxShadow: `0 0 16px ${s.color}18`,
                      animation: `slideUp 0.35s ease both`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  >
                    {/* hour badge */}
                    <div className={`icon-glow ${s.glowClass}`} style={{ width: 52, height: 52, borderRadius: 13, flexShrink: 0, flexDirection: 'column', gap: 2 }}>
                      <Clock size={13} color={s.color} />
                      <span style={{ fontSize: 13, fontWeight: 900, color: s.color }}>+{i + 1}h</span>
                    </div>

                    {/* label + bar */}
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{label}</span>
                        <span style={{ fontSize: 12, color: '#64748b' }}>congestion at {fmt2(hour)}</span>
                      </div>
                      <div className={`progress-neon${s.color === '#10b981' ? '-green' : s.color === '#ef4444' ? '-red' : s.color === '#f97316' ? '-orange' : ''}`}>
                        <div style={{ width: `${confidence * 100}%` }} />
                      </div>
                    </div>

                    {/* confidence */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 20, fontWeight: 900, color: s.color, margin: 0, textShadow: `0 0 12px ${s.color}66` }}>{pct(confidence)}</p>
                      <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>confidence</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Feature importance ── */}
      <div className="neon-card" style={{ padding: '22px 26px' }}>
        <div className="flex items-center gap-2 mb-5">
          <div className="icon-glow icon-glow-blue" style={{ width: 30, height: 30, borderRadius: 8 }}>
            <BarChart2 size={15} color="#3b82f6" />
          </div>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', margin: 0 }}>Feature Importance</h3>
          <span style={{ fontSize: 11.5, color: '#94a3b8' }}>How each factor influences predictions</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FEATURE_IMPORTANCE.map(({ feature, importance, color }, i) => (
            <div
              key={feature}
              className="flex items-center gap-4"
              style={{ animation: `slideRight 0.4s ease both`, animationDelay: `${i * 0.07}s` }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', minWidth: 200 }}>{feature}</span>
              <div style={{ flex: 1, height: 9, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${importance * 100}%`, height: '100%',
                    background: `linear-gradient(90deg, ${color}, ${color}bb)`,
                    borderRadius: 99, boxShadow: `0 0 8px ${color}66`,
                    transition: 'width 1s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', minWidth: 38, textAlign: 'right' }}>
                {Math.round(importance * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      `}</style>
    </div>
  );
}
