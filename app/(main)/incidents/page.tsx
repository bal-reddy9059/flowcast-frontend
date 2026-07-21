'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Construction, Ban, Droplets, ShieldCheck,
  ThumbsUp, ThumbsDown, Plus, Clock, MapPin, RefreshCw, X, CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { incidentsApi } from '@/lib/api';
import type { CommunityIncident } from '@/lib/types';

const TYPES = [
  { id: 'accident', label: 'Accident',      Icon: AlertTriangle, color: '#ef4444', bg: '#fef2f2' },
  { id: 'roadwork', label: 'Roadwork',      Icon: Construction,  color: '#f59e0b', bg: '#fffbeb' },
  { id: 'closure',  label: 'Closure',       Icon: Ban,           color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'flooding', label: 'Flooding',      Icon: Droplets,      color: '#3b82f6', bg: '#eff6ff' },
  { id: 'police',   label: 'Police Check',  Icon: ShieldCheck,   color: '#10b981', bg: '#ecfdf5' },
  { id: 'event',    label: 'Event',         Icon: Sparkles,      color: '#ec4899', bg: '#fdf2f8' },
];

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad'];

const SEV_MAP: Record<string, string> = {
  minor: 'low',
  moderate: 'medium',
  major: 'high',
  severe: 'high',
  critical: 'critical',
  low: 'low',
  medium: 'medium',
  high: 'high',
};

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
  return '';
}

function fixEncoding(s: string): string {
  return s
    .replace(/â€"/g, '—')
    .replace(/â€™/g, '’')
    .replace(/â€œ/g, '“')
    .replace(/â€/g, '”')
    .replace(/Â /g, ' ');
}

function apiError(e: unknown) {
  const err = e as { response?: { data?: { error?: string; detail?: string } }; message?: string };
  return err.response?.data?.error || err.response?.data?.detail || err.message || 'Request failed';
}

interface UiIncident {
  key: string;
  apiId: string;
  type: string;
  description: string;
  location: string;
  city: string;
  severity: string;
  upvotes: number;
  downvotes: number;
  community_score: number;
  reported_by: string;
  created_at: string;
  expires_at?: string | null;
  verified: boolean;
  is_active: boolean;
}

function normalizeIncident(raw: CommunityIncident | Record<string, unknown>): UiIncident {
  const r = raw as CommunityIncident & Record<string, unknown>;
  const uuid = String(r.incident_uuid ?? r.id ?? '');
  const numeric = r.id != null ? String(r.id) : uuid;
  return {
    key: uuid || numeric,
    apiId: uuid || numeric,
    type: String(r.incident_type ?? r.type ?? 'accident').toLowerCase(),
    description: fixEncoding(String(r.description ?? '')),
    location: String(r.location ?? ''),
    city: String(r.city ?? cityFromCoords(r.latitude, r.longitude)),
    severity: SEV_MAP[String(r.severity ?? 'moderate').toLowerCase()] ?? 'medium',
    upvotes: Number(r.upvotes ?? 0),
    downvotes: Number(r.downvotes ?? 0),
    community_score: Number(r.community_score ?? (Number(r.upvotes ?? 0) - Number(r.downvotes ?? 0))),
    reported_by: (() => {
      const reported = String(r.reported_by ?? 'Community');
      return reported === 'system' ? 'FlowCast' : reported.length > 12 ? `${reported.slice(0, 8)}…` : reported;
    })(),
    created_at: String(r.reported_at ?? r.created_at ?? new Date().toISOString()),
    expires_at: (r.expires_at as string | null | undefined) ?? null,
    verified: Boolean(r.verified ?? (Number(r.community_score ?? 0) >= 5)),
    is_active: r.is_active !== false,
  };
}

function rel(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (Number.isNaN(d)) return '—';
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

const SEV: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#dc2626', bg: '#fef2f2', label: 'Critical' },
  high: { color: '#dc2626', bg: '#fef2f2', label: 'High' },
  medium: { color: '#d97706', bg: '#fffbeb', label: 'Medium' },
  low: { color: '#16a34a', bg: '#f0fdf4', label: 'Low' },
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<UiIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [form, setForm] = useState({
    type: 'accident',
    description: '',
    location: '',
    city: 'Hyderabad',
    severity: 'moderate',
  });
  const [submitting, setSubmitting] = useState(false);
  /** One vote per user — mirrors backend incident_votes */
  const [myVotes, setMyVotes] = useState<Record<string, 'up' | 'down'>>({});
  const [voteBusy, setVoteBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<UiIncident | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const r = await incidentsApi.list();
      setIncidents(r.data.incidents.map(normalizeIncident));
      setGeneratedAt(r.data.generated_at ?? null);
    } catch (e) {
      setError(apiError(e));
      if (!isRefresh) setIncidents([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(false); }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || !form.location.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const location = form.location.includes(form.city)
        ? form.location.trim()
        : `${form.location.trim()}, ${form.city}`;
      const r = await incidentsApi.create({
        incident_type: form.type,
        description: form.description.trim(),
        location,
        severity: form.severity,
        city: form.city,
      });
      const created = normalizeIncident(r.data.incident);
      setIncidents((p) => [created, ...p.filter((i) => i.key !== created.key)]);
      // Reporter's implicit upvote is a real vote row
      setMyVotes((v) => ({ ...v, [created.key]: 'up' }));
      showToast(r.data.message || 'Incident reported successfully');
      setForm({ type: 'accident', description: '', location: '', city: 'Hyderabad', severity: 'moderate' });
      setShowForm(false);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const applyVoteCounts = (key: string, upvotes: number, downvotes: number, community_score?: number) => {
    setIncidents((items) => items.map((inc) => (
      inc.key === key
        ? {
            ...inc,
            upvotes,
            downvotes,
            community_score: community_score ?? (upvotes - downvotes),
            verified: (community_score ?? (upvotes - downvotes)) >= 5,
          }
        : inc
    )));
    setSelectedDetail((cur) => (
      cur?.key === key
        ? {
            ...cur,
            upvotes,
            downvotes,
            community_score: community_score ?? (upvotes - downvotes),
          }
        : cur
    ));
  };

  const handleVote = async (inc: UiIncident, dir: 'up' | 'down') => {
    if (voteBusy === inc.key) return;
    setVoteBusy(inc.key);
    setError('');
    try {
      const r = dir === 'up'
        ? await incidentsApi.upvote(inc.apiId)
        : await incidentsApi.downvote(inc.apiId);
      const { upvotes, downvotes, community_score, changed, resolved, message } = r.data;

      applyVoteCounts(inc.key, upvotes, downvotes, community_score);

      if (resolved) {
        setIncidents((items) => items.filter((i) => i.key !== inc.key));
        setSelectedDetail(null);
        setMyVotes((v) => {
          const n = { ...v };
          delete n[inc.key];
          return n;
        });
        showToast(message || 'Incident resolved by community');
        return;
      }

      if (changed === false) {
        // Repeat same vote — no-op; keep selection, counts unchanged
        setMyVotes((v) => ({ ...v, [inc.key]: dir }));
        showToast(message || (dir === 'up' ? 'Already upvoted' : 'Already downvoted'));
      } else {
        // New vote or switch
        setMyVotes((v) => ({ ...v, [inc.key]: dir }));
        showToast(message || (dir === 'up' ? 'Upvoted' : 'Downvoted'));
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setVoteBusy(null);
    }
  };

  const openIncident = async (incident: UiIncident) => {
    setSelectedDetail(incident);
    try {
      const r = await incidentsApi.get(incident.apiId);
      const next = normalizeIncident(r.data);
      setSelectedDetail(next);
      setIncidents((items) => items.map((i) => (i.key === next.key ? next : i)));
    } catch {
      /* keep list row */
    }
  };

  const resolveIncident = async (inc: UiIncident) => {
    try {
      await incidentsApi.resolve(inc.apiId);
      setIncidents((items) => items.filter((i) => i.key !== inc.key));
      setSelectedDetail(null);
      showToast('Incident resolved');
    } catch (err) {
      setError(apiError(err));
    }
  };

  const filtered = incidents.filter((i) => activeFilter === 'all' || i.type === activeFilter);
  const typeOf = (t: string) => TYPES.find((x) => x.id === t) ?? TYPES[0];

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-hero" style={{ padding: '28px 32px' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="gradient-text-neon" style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
                Crowdsourced Incidents
              </h1>
              <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 5 }}>
                One vote per user — upvote confirms, downvote switches or clears
              </p>
              {generatedAt && (
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Feed generated {rel(generatedAt)} (IST)
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void fetchData(true)}
                disabled={refreshing}
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

      {toast && (
        <div className="scale-in flex items-center gap-3 neon-badge-green" style={{ padding: '13px 18px', borderRadius: 11 }}>
          <CheckCircle2 size={16} color="#10b981" />
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{toast}</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 11, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}

      {selectedDetail && (
        <div className="neon-card flex items-center justify-between gap-3" style={{ padding: 14 }}>
          <div>
            <strong>{selectedDetail.description}</strong>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
              {selectedDetail.location}
              {' · '}score {selectedDetail.community_score}
              {' · '}↑{selectedDetail.upvotes} ↓{selectedDetail.downvotes}
            </p>
          </div>
          <button onClick={() => void resolveIncident(selectedDetail)} className="btn-gradient px-3 py-2 rounded-lg text-xs">
            Resolve / delete
          </button>
        </div>
      )}

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
          <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>
                Incident Type
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {TYPES.map(({ id, label, Icon, color, bg }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: id }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      border: `2px solid ${form.type === id ? color : '#e2e8f0'}`,
                      background: form.type === id ? bg : '#fff',
                      color: form.type === id ? color : '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={13} />{label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe the incident clearly…"
                required
                rows={3}
                style={{ width: '100%', padding: '10px 13px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13.5, color: '#0f172a', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Location</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Road / landmark (e.g. Hitech City)"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13.5, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>City</label>
                <select
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13.5, color: '#0f172a', outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                >
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Severity</label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13.5, color: '#0f172a', outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                >
                  {[
                    { value: 'minor', label: 'Minor' },
                    { value: 'moderate', label: 'Moderate' },
                    { value: 'severe', label: 'Severe' },
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

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {TYPES.slice(0, 5).map(({ id }) => (
            <div key={id} className="skeleton" style={{ height: 72, borderRadius: 12 }} />
          ))}
        </div>
      ) : (
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {TYPES.filter((t) => t.id !== 'event').map(({ id, label, Icon, color }) => {
            const count = incidents.filter((i) => i.type === id).length;
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && [1, 2, 3].map((n) => (
          <div key={n} className="skeleton" style={{ height: 92, borderRadius: 14 }} />
        ))}

        {!loading && filtered.length === 0 && (
          <div className="neon-card" style={{ padding: '56px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="icon-glow icon-glow-green" style={{ width: 56, height: 56, borderRadius: 16 }}>
              <CheckCircle2 size={26} color="#10b981" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              {activeFilter === 'all' ? 'No active incidents' : `No ${activeFilter} incidents`}
            </p>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
              Expired incidents are dropped on read. Report a new one to test voting.
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
          const myVote = myVotes[inc.key];
          const { Icon } = t;
          const totalVotes = Math.max(1, inc.upvotes + inc.downvotes);
          return (
            <div
              key={inc.key}
              onClick={() => void openIncident(inc)}
              className="neon-card"
              style={{
                padding: '18px 20px', borderLeft: `4px solid ${t.color}`,
                display: 'flex', gap: 16, alignItems: 'flex-start',
                animation: 'slideUp 0.3s ease both',
                animationDelay: `${Math.min(i * 0.05, 0.4)}s`,
              }}
            >
              <div className="icon-glow" style={{ width: 40, height: 40, borderRadius: 11, background: `${t.color}18`, boxShadow: `0 0 14px ${t.color}30`, flexShrink: 0 }}>
                <Icon size={18} style={{ color: t.color }} />
              </div>

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
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>
                    score {inc.community_score}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1" style={{ fontSize: 11.5, color: '#64748b' }}><MapPin size={11} />{inc.location}</span>
                  <span style={{ color: '#cbd5e1', fontSize: 12 }}>·</span>
                  <span className="flex items-center gap-1" style={{ fontSize: 11.5, color: '#94a3b8' }}><Clock size={11} />{rel(inc.created_at)}</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div className="progress-neon-green" style={{ maxWidth: 200 }}>
                    <div style={{ width: `${Math.min(100, (inc.upvotes / totalVotes) * 100)}%` }} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  disabled={voteBusy === inc.key}
                  onClick={() => void handleVote(inc, 'up')}
                  title={myVote === 'up' ? 'Already upvoted (no-op)' : myVote === 'down' ? 'Switch to upvote' : 'Confirm incident'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: `1.5px solid ${myVote === 'up' ? '#10b981' : '#e2e8f0'}`,
                    background: myVote === 'up' ? 'rgba(16,185,129,0.1)' : '#fff',
                    color: myVote === 'up' ? '#10b981' : '#64748b',
                    cursor: voteBusy === inc.key ? 'wait' : 'pointer',
                    opacity: voteBusy === inc.key ? 0.7 : 1,
                    boxShadow: myVote === 'up' ? '0 0 10px rgba(16,185,129,0.25)' : 'none',
                  }}
                >
                  <ThumbsUp size={13} />
                  {inc.upvotes}
                </button>
                <button
                  disabled={voteBusy === inc.key}
                  onClick={() => void handleVote(inc, 'down')}
                  title={myVote === 'down' ? 'Already downvoted (no-op)' : myVote === 'up' ? 'Switch to downvote' : 'Mark inaccurate'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: `1.5px solid ${myVote === 'down' ? '#ef4444' : '#e2e8f0'}`,
                    background: myVote === 'down' ? 'rgba(239,68,68,0.1)' : '#fff',
                    color: myVote === 'down' ? '#ef4444' : '#64748b',
                    cursor: voteBusy === inc.key ? 'wait' : 'pointer',
                    opacity: voteBusy === inc.key ? 0.7 : 1,
                    boxShadow: myVote === 'down' ? '0 0 10px rgba(239,68,68,0.25)' : 'none',
                  }}
                >
                  <ThumbsDown size={13} />
                  {inc.downvotes}
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
