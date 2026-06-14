'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle, Construction, Ban, Droplets, ShieldCheck,
  ThumbsUp, ThumbsDown, Plus, Clock, MapPin, RefreshCw, X, CheckCircle2,
  Sparkles,
} from 'lucide-react';
import api from '@/lib/api';

/* ── Type catalogue — matches all backend incident_type values ── */
const TYPES = [
  { id: 'accident', label: 'Accident',      Icon: AlertTriangle, color: '#ef4444', bg: '#fef2f2' },
  { id: 'roadwork', label: 'Roadwork',      Icon: Construction,  color: '#f59e0b', bg: '#fffbeb' },
  { id: 'closure',  label: 'Closure',       Icon: Ban,           color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'flooding', label: 'Flooding',      Icon: Droplets,      color: '#3b82f6', bg: '#eff6ff' },
  { id: 'police',   label: 'Police Check',  Icon: ShieldCheck,   color: '#10b981', bg: '#ecfdf5' },
  { id: 'event',    label: 'Event',         Icon: Sparkles,      color: '#ec4899', bg: '#fdf2f8' },
];

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad'];

/* ── Severity mapping: backend labels → frontend labels ── */
const SEV_MAP: Record<string, string> = {
  minor:    'low',
  moderate: 'medium',
  major:    'high',
  severe:   'high',
  critical: 'critical',
};

/* ── City lookup from lat/lon (approximate bounding boxes) ── */
function cityFromCoords(lat?: number | null, lon?: number | null): string {
  if (lat == null || lon == null) return '';
  if (lat >= 12.8 && lat <= 13.2 && lon >= 77.4 && lon <= 77.8) return 'Bangalore';
  if (lat >= 17.3 && lat <= 17.6 && lon >= 78.2 && lon <= 78.6) return 'Hyderabad';
  if (lat >= 28.4 && lat <= 28.9 && lon >= 76.8 && lon <= 77.5) return 'Delhi';
  if (lat >= 18.8 && lat <= 19.3 && lon >= 72.7 && lon <= 73.1) return 'Mumbai';
  if (lat >= 12.9 && lat <= 13.2 && lon >= 80.1 && lon <= 80.4) return 'Chennai';
  if (lat >= 22.4 && lat <= 22.7 && lon >= 88.2 && lon <= 88.5) return 'Kolkata';
  if (lat >= 18.4 && lat <= 18.7 && lon >= 73.7 && lon <= 74.0) return 'Pune';
  if (lat >= 22.9 && lat <= 23.2 && lon >= 72.4 && lon <= 72.8) return 'Ahmedabad';
  if (lat >= 26.8 && lat <= 27.0 && lon >= 75.7 && lon <= 75.9) return 'Jaipur';
  if (lat >= 26.7 && lat <= 27.0 && lon >= 80.8 && lon <= 81.1) return 'Lucknow';
  if (lat >= 21.0 && lat <= 21.3 && lon >= 79.0 && lon <= 79.2) return 'Nagpur';
  if (lat >= 22.6 && lat <= 22.8 && lon >= 88.3 && lon <= 88.5) return 'Kolkata';
  return '';
}

/* ── Fix UTF-8 mojibake that the backend seeds contain ── */
function fixEncoding(s: string): string {
  return s
    .replace(/â€"/g, '—')
    .replace(/â€™/g, '’')
    .replace(/â€œ/g, '“')
    .replace(/â€/g, '”')
    .replace(/â€"/g, '–')
    .replace(/Â /g, ' ');
}

/* ── Normalise a raw backend incident into the shape the UI expects ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeIncident(raw: any): Incident {
  return {
    id:          String(raw.incident_uuid ?? raw.id),
    type:        String(raw.incident_type ?? raw.type ?? 'accident').toLowerCase(),
    description: fixEncoding(String(raw.description ?? '')),
    location:    String(raw.location ?? ''),
    city:        String(raw.city ?? cityFromCoords(raw.latitude, raw.longitude)),
    severity:    SEV_MAP[String(raw.severity ?? 'low').toLowerCase()] ?? String(raw.severity ?? 'low'),
    upvotes:     Number(raw.upvotes ?? raw.upvote_count ?? 0),
    downvotes:   Number(raw.downvotes ?? raw.downvote_count ?? 0),
    reported_by: (() => { const r = String(raw.reported_by ?? 'Community'); return r === 'system' ? 'FlowCast' : r; })(),
    created_at:  String(raw.reported_at ?? raw.created_at ?? new Date().toISOString()),
    verified:    Boolean(raw.verified ?? (Number(raw.community_score ?? 0) >= 5)),
  };
}

interface Incident {
  id: string; type: string; description: string; location: string; city: string;
  severity: string; upvotes: number; downvotes: number; reported_by: string;
  created_at: string; verified: boolean;
}

/* ── Fallback stub used only when backend is completely unreachable ── */
const STUB: Incident[] = [
  { id: 's1', type: 'accident', description: 'Multi-vehicle collision, partial lane closure', location: 'Western Express Highway, Andheri', city: 'Mumbai', severity: 'high', upvotes: 23, downvotes: 1, reported_by: 'Community', created_at: new Date(Date.now() - 3 * 60000).toISOString(), verified: true },
  { id: 's2', type: 'roadwork', description: 'Metro Phase 3 construction — single-lane traffic', location: 'Outer Ring Road, Marathahalli', city: 'Bangalore', severity: 'medium', upvotes: 15, downvotes: 0, reported_by: 'Community', created_at: new Date(Date.now() - 18 * 60000).toISOString(), verified: false },
  { id: 's3', type: 'event', description: 'Cultural event causing parking overflow', location: 'Koramangala 5th Block', city: 'Bangalore', severity: 'low', upvotes: 5, downvotes: 0, reported_by: 'Community', created_at: new Date(Date.now() - 45 * 60000).toISOString(), verified: false },
];

function rel(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

const SEV: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#dc2626', bg: '#fef2f2', label: 'Critical' },
  high:     { color: '#dc2626', bg: '#fef2f2', label: 'High' },
  medium:   { color: '#d97706', bg: '#fffbeb', label: 'Medium' },
  low:      { color: '#16a34a', bg: '#f0fdf4', label: 'Low' },
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingStub, setUsingStub] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [form, setForm] = useState({ type: 'accident', description: '', location: '', city: 'Mumbai', severity: 'medium' });
  const [submitting, setSubmitting] = useState(false);
  const [votes, setVotes] = useState<Record<string, 'up' | 'down'>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fetchData = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const r = await api.get('/incidents');
      const raw: unknown[] = Array.isArray(r.data?.incidents) ? r.data.incidents : [];
      setIncidents(raw.map(normalizeIncident));
      setUsingStub(false);
    } catch {
      if (!isRefresh) {
        setIncidents(STUB);
        setUsingStub(true);
      }
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  };

  useEffect(() => { void fetchData(false); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || !form.location.trim()) return;
    setSubmitting(true);
    try {
      const r = await api.post('/incidents', {
        incident_type: form.type,
        description:   form.description,
        location:      form.location,
        city:          form.city,
        severity:      form.severity,
      });
      setIncidents(p => [normalizeIncident(r.data), ...p]);
    } catch {
      const optimistic: Incident = {
        ...form,
        id: String(Date.now()),
        upvotes: 0, downvotes: 0,
        reported_by: 'You',
        created_at: new Date().toISOString(),
        verified: false,
      };
      setIncidents(p => [optimistic, ...p]);
    }
    setForm({ type: 'accident', description: '', location: '', city: 'Mumbai', severity: 'medium' });
    setShowForm(false);
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const handleVote = async (id: string, dir: 'up' | 'down') => {
    if (votes[id] === dir) {
      setVotes(v => { const n = { ...v }; delete n[id]; return n; });
      return;
    }
    setVotes(v => ({ ...v, [id]: dir }));
    try { await api.post(`/incidents/${id}/${dir}vote`); } catch { /* optimistic */ }
  };

  const filtered = incidents.filter(i => activeFilter === 'all' || i.type === activeFilter);
  const typeOf = (t: string) => TYPES.find(x => x.id === t) ?? TYPES[0];

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero Banner ── */}
      <div className="page-hero" style={{ padding: '28px 32px' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="gradient-text-neon" style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
                Crowdsourced Incidents
              </h1>
              <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 5 }}>
                Community-reported traffic events — upvote to verify, downvote to dismiss
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchData(true)} disabled={refreshing}
                className="btn-neon"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', opacity: refreshing ? 0.6 : 1 }}
              >
                <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className="btn-gradient"
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                <Plus size={14} />
                Report Incident
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Success toast ── */}
      {submitted && (
        <div className="scale-in flex items-center gap-3 neon-badge-green" style={{ padding: '13px 18px', borderRadius: 11 }}>
          <CheckCircle2 size={16} color="#10b981" />
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>Incident reported successfully! It will appear in the feed after community verification.</span>
        </div>
      )}

      {/* ── Report form ── */}
      {showForm && (
        <div
          className="scale-in neon-card"
          style={{ padding: '24px', border: '1.5px solid #3b82f6', boxShadow: '0 8px 32px -6px rgba(59,130,246,0.25)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Report New Incident</h2>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 6 }}>
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Type */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>
                Incident Type
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {TYPES.map(({ id, label, Icon, color, bg }) => (
                  <button
                    key={id} type="button"
                    onClick={() => setForm(f => ({ ...f, type: id }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      border: `2px solid ${form.type === id ? color : '#e2e8f0'}`,
                      background: form.type === id ? bg : '#fff',
                      color: form.type === id ? color : '#64748b',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <Icon size={13} />{label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe the incident clearly so other drivers can understand the situation…"
                required rows={3}
                style={{ width: '100%', padding: '10px 13px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13.5, color: '#0f172a', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Location / City / Severity */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
              {[
                { key: 'location', label: 'Location', placeholder: 'Road / landmark name', type: 'input' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>{label}</label>
                  <input
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder} required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13.5, color: '#0f172a', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>City</label>
                <select value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13.5, color: '#0f172a', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                  {CITIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Severity</label>
                <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13.5, color: '#0f172a', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                  {[
                    { value: 'minor',    label: 'Minor' },
                    { value: 'moderate', label: 'Moderate' },
                    { value: 'severe',   label: 'Severe' },
                    { value: 'critical', label: 'Critical' },
                  ].map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-1">
              <button type="button" onClick={() => setShowForm(false)} className="btn-neon" style={{ padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={submitting} className="btn-gradient" style={{ padding: '9px 22px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Stub-data notice ── */}
      {usingStub && !loading && (
        <div className="flex items-center gap-2" style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <AlertTriangle size={14} color="#f59e0b" />
          <span style={{ fontSize: 12.5, color: '#92400e' }}>
            Backend unreachable — showing demo data. Real incidents will appear once the API is online.
          </span>
        </div>
      )}

      {/* ── Type stat chips ── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {TYPES.map(({ id }) => (
            <div key={id} className="skeleton" style={{ height: 72, borderRadius: 12 }} />
          ))}
        </div>
      ) : (
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {TYPES.map(({ id, label, Icon, color, bg }) => {
            const count = incidents.filter(i => i.type === id).length;
            const active = activeFilter === id;
            return (
              <div
                key={id}
                onClick={() => setActiveFilter(active ? 'all' : id)}
                className="neon-card"
                style={{
                  cursor: 'pointer',
                  border: active ? `2px solid ${color}` : undefined,
                  boxShadow: active ? `0 0 18px ${color}44` : undefined,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="icon-glow" style={{ width: 26, height: 26, borderRadius: 7, background: `${color}18`, boxShadow: `0 0 12px ${color}33` }}>
                    <Icon size={12} style={{ color }} />
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                </div>
                <p style={{ fontSize: 24, fontWeight: 900, color: active ? color : '#0f172a', margin: 0 }}>{count}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Incident feed ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && [1, 2, 3].map(n => (
          <div key={n} className="skeleton" style={{ height: 92, borderRadius: 14, animationDelay: `${n * 0.1}s` }} />
        ))}

        {!loading && filtered.length === 0 && (
          <div className="neon-card" style={{ padding: '56px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="icon-glow icon-glow-green" style={{ width: 56, height: 56, borderRadius: 16 }}>
              <CheckCircle2 size={26} color="#10b981" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              {activeFilter === 'all' ? 'No incidents reported yet' : `No ${activeFilter} incidents`}
            </p>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
              {activeFilter === 'all'
                ? 'Roads are clear! Be the first to report an incident.'
                : 'Try a different filter or clear it to see all incidents.'}
            </p>
            {activeFilter === 'all' && (
              <button
                onClick={() => setShowForm(true)}
                className="btn-gradient"
                style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                <Plus size={14} /> Report First Incident
              </button>
            )}
          </div>
        )}
        {filtered.map((inc, i) => {
          const t = typeOf(inc.type);
          const sev = SEV[inc.severity] ?? SEV.low;
          const myVote = votes[inc.id];
          const { Icon } = t;
          return (
            <div
              key={inc.id}
              className="neon-card"
              style={{
                padding: '18px 20px', borderLeft: `4px solid ${t.color}`,
                display: 'flex', gap: 16, alignItems: 'flex-start',
                animation: `slideUp 0.3s ease both`,
                animationDelay: `${Math.min(i * 0.05, 0.4)}s`,
              }}
            >
              {/* type icon */}
              <div className="icon-glow" style={{ width: 40, height: 40, borderRadius: 11, background: `${t.color}18`, boxShadow: `0 0 14px ${t.color}30`, flexShrink: 0 }}>
                <Icon size={18} style={{ color: t.color }} />
              </div>

              {/* body */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', margin: 0 }}>{inc.description}</p>
                  {inc.verified && (
                    <span className="neon-badge-green flex items-center gap-1" style={{ fontSize: 10, fontWeight: 700 }}>
                      <CheckCircle2 size={9} /> Verified
                    </span>
                  )}
                  <span
                    className={sev.color === '#dc2626' ? 'neon-badge-red' : sev.color === '#16a34a' ? 'neon-badge-green' : 'neon-badge-blue'}
                    style={{ fontSize: 10, fontWeight: 700 }}
                  >
                    {sev.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1" style={{ fontSize: 11.5, color: '#64748b' }}><MapPin size={11} />{inc.location}</span>
                  <span style={{ color: '#cbd5e1', fontSize: 12 }}>·</span>
                  <span className="flex items-center gap-1" style={{ fontSize: 11.5, color: '#94a3b8' }}><Clock size={11} />{rel(inc.created_at)}</span>
                  <span style={{ color: '#cbd5e1', fontSize: 12 }}>·</span>
                  <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{inc.reported_by}</span>
                </div>

                {/* community score bar */}
                <div style={{ marginTop: 8 }}>
                  <div className="progress-neon-green" style={{ maxWidth: 200 }}>
                    <div style={{ width: `${Math.min(100, (inc.upvotes / Math.max(1, inc.upvotes + inc.downvotes)) * 100)}%` }} />
                  </div>
                </div>
              </div>

              {/* votes */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleVote(inc.id, 'up')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: `1.5px solid ${myVote === 'up' ? '#10b981' : '#e2e8f0'}`,
                    background: myVote === 'up' ? 'rgba(16,185,129,0.1)' : '#fff',
                    color: myVote === 'up' ? '#10b981' : '#64748b',
                    cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: myVote === 'up' ? '0 0 10px rgba(16,185,129,0.25)' : 'none',
                  }}
                >
                  <ThumbsUp size={13} />
                  {inc.upvotes + (myVote === 'up' ? 1 : 0)}
                </button>
                <button
                  onClick={() => handleVote(inc.id, 'down')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: `1.5px solid ${myVote === 'down' ? '#ef4444' : '#e2e8f0'}`,
                    background: myVote === 'down' ? 'rgba(239,68,68,0.1)' : '#fff',
                    color: myVote === 'down' ? '#ef4444' : '#64748b',
                    cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: myVote === 'down' ? '0 0 10px rgba(239,68,68,0.25)' : 'none',
                  }}
                >
                  <ThumbsDown size={13} />
                  {inc.downvotes + (myVote === 'down' ? 1 : 0)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
