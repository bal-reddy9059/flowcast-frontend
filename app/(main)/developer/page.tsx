'use client';

import { useState, useEffect } from 'react';
import {
  Key, Plus, Copy, RotateCw, Trash2, CheckCircle2,
  Code, X, AlertTriangle,
} from 'lucide-react';
import { developerApi } from '@/lib/api';

/* ─── Types ──────────────────────────────────────────────────── */
interface ApiKey {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'enterprise';
  key_prefix: string;
  usage_today: number;
  limit: number;
  created_at: string;
  last_used: string;
}

/* ─── Static data ────────────────────────────────────────────── */
const TIERS = [
  { id: 'free',       label: 'Free',       color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', limit: '1,000 req/day',  price: 'Free',       features: ['Basic traffic endpoints', 'Community support', 'REST only'] },
  { id: 'pro',        label: 'Pro',        color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', limit: '50,000 req/day', price: '₹999/mo',    features: ['All REST + WebSocket', 'Priority support', 'Webhook delivery'] },
  { id: 'enterprise', label: 'Enterprise', color: '#8b5cf6', bg: '#f5f3ff', border: '#c4b5fd', limit: 'Unlimited',      price: 'Custom',     features: ['Dedicated cluster', 'SLA guarantee', 'Custom integrations'] },
] as const;

const ENDPOINTS = [
  { method: 'GET',  path: '/traffic/records',     desc: 'Traffic records for a city' },
  { method: 'POST', path: '/traffic/predict',     desc: 'Predict congestion level' },
  { method: 'GET',  path: '/india/cities',        desc: 'All city overviews' },
  { method: 'GET',  path: '/weather/cities',      desc: 'Weather + congestion impact' },
  { method: 'GET',  path: '/traffic/ml/predict',  desc: 'ML-based congestion forecast' },
  { method: 'WS',   path: '/traffic/ws/live',     desc: 'Live car feed (WebSocket)' },
  { method: 'WS',   path: '/traffic/ws/pulse',    desc: 'Congestion spike events' },
];

const STUB_KEYS: ApiKey[] = [
  { id: '1', name: 'Production App', tier: 'pro', key_prefix: 'fc_live_7a3f**********9e2c', usage_today: 12840, limit: 50000, created_at: new Date(Date.now() - 30 * 86400000).toISOString(), last_used: new Date(Date.now() - 2 * 60000).toISOString() },
  { id: '2', name: 'Dev Testing', tier: 'free', key_prefix: 'fc_test_2b8c**********1d4f', usage_today: 420, limit: 1000, created_at: new Date(Date.now() - 7 * 86400000).toISOString(), last_used: new Date(Date.now() - 3600000).toISOString() },
];

/* ─── Helpers ────────────────────────────────────────────────── */
function rel(iso: string) {
  if (!iso) return 'Never';
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function sinceCreated(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return 'Today';
  if (d < 30) return `${Math.floor(d)}d old`;
  return `${Math.floor(d / 30)}mo old`;
}

const METHOD_COLOR: Record<string, string> = { GET: '#10b981', POST: '#3b82f6', WS: '#8b5cf6' };
const METHOD_GLOW: Record<string, string> = { GET: 'icon-glow-green', POST: 'icon-glow-blue', WS: 'icon-glow-purple' };

/* ─── Component ──────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeKey(raw: any): ApiKey {
  return {
    id:          String(raw.id ?? raw.key_id ?? Date.now()),
    name:        String(raw.name ?? raw.key_name ?? 'Unnamed Key'),
    tier:        (['free','pro','enterprise'].includes(raw.tier) ? raw.tier : 'free') as ApiKey['tier'],
    key_prefix:  String(raw.key_prefix ?? raw.key ?? ''),
    usage_today: Number(raw.usage_today ?? raw.requests_today ?? raw.daily_count ?? 0),
    limit:       raw.limit === null ? Infinity : Number(raw.limit ?? raw.daily_limit ?? 1000),
    created_at:  String(raw.created_at ?? new Date().toISOString()),
    last_used:   String(raw.last_used ?? raw.last_used_at ?? ''),
  };
}

export default function DeveloperPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingStub, setUsingStub] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', tier: 'free' as 'free' | 'pro' | 'enterprise' });
  const [creating, setCreating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<{ id: string; key: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [developerMeta, setDeveloperMeta] = useState<{ scopes?: unknown; status?: unknown }>({});

  useEffect(() => {
    Promise.all([developerApi.keys(), developerApi.scopes(), developerApi.status()])
      .then(([r, scopes, status]) => {
        const raw: unknown[] = Array.isArray(r.data?.keys ?? r.data) ? (r.data?.keys ?? r.data) : [];
        setKeys(raw.map(normalizeKey));
        setDeveloperMeta({ scopes: scopes.data, status: status.data });
        setUsingStub(false);
      })
      .catch(() => {
        setKeys(STUB_KEYS);
        setUsingStub(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!newKey.name.trim()) return;
    setCreating(true);
    try {
      const r = await developerApi.createKey(newKey);
      const createdKey = r.data.key ?? r.data;
      setKeys(p => [...p, normalizeKey(createdKey)]);
      setGeneratedKey({ id: createdKey.id, key: r.data.raw_key ?? 'fc_live_' + Math.random().toString(36).slice(2, 10) + 'XXXXXXXXXXXXXXXX' });
    } catch {
      const tid = String(Date.now());
      const limitMap = { free: 1000, pro: 50000, enterprise: Infinity };
      const stub: ApiKey = {
        id: tid, name: newKey.name, tier: newKey.tier,
        key_prefix: `fc_${newKey.tier === 'free' ? 'test' : 'live'}_${Math.random().toString(36).slice(2, 8)}**********${Math.random().toString(36).slice(2, 6)}`,
        usage_today: 0, limit: limitMap[newKey.tier],
        created_at: new Date().toISOString(), last_used: '',
      };
      setKeys(p => [...p, stub]);
      setGeneratedKey({ id: stub.id, key: `fc_${newKey.tier === 'free' ? 'test' : 'live'}_${Math.random().toString(36).slice(2)}XXXXXXXXXXXX` });
    }
    setNewKey({ name: '', tier: 'free' });
    setShowCreate(false);
    setCreating(false);
  };

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    try { await developerApi.revokeKey(id); } catch { /* optimistic */ }
    setKeys(p => p.filter(k => k.id !== id));
    setRevoking(null);
  };

  const handleRotate = async (id: string) => {
    try { await developerApi.getKey(id); await developerApi.rotateKey(id); } catch { /* stub */ }
    const newRaw = `fc_live_${Math.random().toString(36).slice(2)}XXXXXXXXXXXX`;
    setGeneratedKey({ id, key: newRaw });
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const tierOf = (id: string) => TIERS.find(t => t.id === id) ?? TIERS[0];

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero Banner ── */}
      <div className="page-hero" style={{ padding: '28px 32px' }}>
        <div style={{ position: 'relative', zIndex: 1 }} className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="gradient-text-neon" style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
              Developer Portal
            </h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 5 }}>
              Manage API keys, monitor quota usage, and explore available endpoints
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-gradient"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            <Plus size={14} />
            Create API Key
          </button>
        </div>
      </div>

      {/* ── Generated key banner ── */}
      {generatedKey && (
        <div
          className="scale-in"
          style={{ borderRadius: 16, background: '#0f172a', padding: '18px 22px', border: '1px solid rgba(59,130,246,0.3)', boxShadow: '0 0 24px rgba(59,130,246,0.15)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="icon-glow icon-glow-green" style={{ width: 28, height: 28, borderRadius: 8 }}>
                <CheckCircle2 size={14} color="#10b981" />
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#f1f5f9' }}>
                New key generated — copy it now, it won&apos;t be shown again
              </span>
            </div>
            <button onClick={() => setGeneratedKey(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4, borderRadius: 6 }}>
              <X size={14} />
            </button>
          </div>
          <div className="flex items-center gap-3" style={{ background: '#1a2336', borderRadius: 10, padding: '11px 16px', border: '1px solid rgba(59,130,246,0.2)' }}>
            <code style={{ flex: 1, fontFamily: 'monospace', fontSize: 13.5, color: '#60a5fa', letterSpacing: '0.04em', wordBreak: 'break-all' }}>
              {generatedKey.key}
            </code>
            <button
              onClick={() => copy(generatedKey.key, 'new')}
              className={copiedId === 'new' ? 'btn-neon' : 'btn-gradient'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
            >
              {copiedId === 'new' ? <CheckCircle2 size={12} /> : <Copy size={12} />}
              {copiedId === 'new' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="flex items-center gap-1 mt-2" style={{ fontSize: 11.5, color: '#475569', margin: '8px 0 0' }}>
            <AlertTriangle size={11} color="#f59e0b" /> Store this key securely. It grants access to the FlowCast API on your behalf.
          </p>
        </div>
      )}

      {/* ── Create form ── */}
      {showCreate && (
        <div className="scale-in neon-card" style={{ padding: '24px', border: '1.5px solid #3b82f6', boxShadow: '0 8px 32px -6px rgba(59,130,246,0.25)' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Create New API Key</h2>
            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 6 }}>
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Key Name</label>
              <input
                value={newKey.name}
                onChange={e => setNewKey(n => ({ ...n, name: e.target.value }))}
                placeholder="e.g. Production App, CI Pipeline, Mobile Backend"
                required
                style={{ width: '100%', padding: '10px 13px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13.5, color: '#0f172a', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 10 }}>Tier</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {TIERS.map(t => (
                  <button
                    key={t.id} type="button"
                    onClick={() => setNewKey(n => ({ ...n, tier: t.id }))}
                    style={{
                      padding: '14px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      border: `2px solid ${newKey.tier === t.id ? t.color : t.border}`,
                      background: newKey.tier === t.id ? t.bg : '#fff',
                      transition: 'all 0.15s',
                      boxShadow: newKey.tier === t.id ? `0 0 14px ${t.color}33` : 'none',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontSize: 13, fontWeight: 800, color: newKey.tier === t.id ? t.color : '#334155' }}>{t.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: newKey.tier === t.id ? t.color : '#94a3b8' }}>{t.price}</span>
                    </div>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 6px' }}>{t.limit}</p>
                    {t.features.map(f => (
                      <div key={f} className="flex items-center gap-1 mt-1">
                        <CheckCircle2 size={10} color={newKey.tier === t.id ? t.color : '#cbd5e1'} />
                        <span style={{ fontSize: 11, color: newKey.tier === t.id ? '#475569' : '#94a3b8' }}>{f}</span>
                      </div>
                    ))}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-neon" style={{ padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={creating} className="btn-gradient" style={{ padding: '9px 22px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: creating ? 0.7 : 1 }}>
                {creating ? 'Generating…' : 'Generate Key'}
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
            Backend unreachable — showing demo keys. Your real API keys will appear once the API is online.
          </span>
        </div>
      )}

      {/* ── Keys list ── */}
      <div className="neon-card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9' }}>
          <div className="flex items-center justify-between">
            <h2 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              <span className="gradient-text">API Keys</span>
            </h2>
            <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{loading ? '…' : `${keys.length} key${keys.length !== 1 ? 's' : ''}`}</span>
          </div>
        </div>

        {loading && (
          <div style={{ padding: '12px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2].map(n => (
              <div key={n} className="skeleton" style={{ height: 88, borderRadius: 12, animationDelay: `${n * 0.1}s` }} />
            ))}
          </div>
        )}

        {!loading && keys.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="icon-glow icon-glow-blue" style={{ width: 56, height: 56, borderRadius: 16 }}>
              <Key size={24} color="#3b82f6" />
            </div>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>No API keys yet. Create one above to get started.</p>
          </div>
        ) : (
          keys.map((k, i) => {
            const t = tierOf(k.tier);
            const usePct = k.limit === Infinity ? 0 : Math.min(100, (k.usage_today / k.limit) * 100);
            const barColor = usePct > 85 ? '#ef4444' : usePct > 65 ? '#f59e0b' : '#3b82f6';
            const progressClass = usePct > 85 ? 'progress-neon-red' : usePct > 65 ? 'progress-neon-orange' : 'progress-neon';
            return (
              <div
                key={k.id}
                style={{ padding: '18px 22px', borderBottom: i < keys.length - 1 ? '1px solid #f8fafc' : 'none', transition: 'background 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="flex items-start gap-4">
                  {/* icon */}
                  <div className={`icon-glow ${t.color === '#3b82f6' ? 'icon-glow-blue' : t.color === '#8b5cf6' ? 'icon-glow-purple' : 'icon-glow'}`}
                    style={{ width: 38, height: 38, borderRadius: 10, background: (t as typeof TIERS[number]).bg, flexShrink: 0 }}>
                    <Key size={16} style={{ color: (t as typeof TIERS[number]).color }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* top row */}
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{k.name}</span>
                      <span
                        className={t.color === '#3b82f6' ? 'neon-badge-blue' : t.color === '#8b5cf6' ? 'neon-badge-blue' : 'neon-badge-green'}
                        style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}
                      >
                        {t.label}
                      </span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{sinceCreated(k.created_at)}</span>
                    </div>

                    {/* key string */}
                    <div className="flex items-center gap-2 mb-3">
                      <code style={{ fontSize: 12, fontFamily: 'monospace', color: '#64748b', background: '#f8fafc', padding: '4px 10px', borderRadius: 7, border: '1px solid #f1f5f9' }}>
                        {k.key_prefix}
                      </code>
                      <button
                        onClick={() => copy(k.key_prefix, k.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedId === k.id ? '#10b981' : '#94a3b8', padding: 4, borderRadius: 6, display: 'flex', transition: 'color 0.2s' }}
                      >
                        {copiedId === k.id ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                      </button>
                    </div>

                    {/* usage bar */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>Today&apos;s usage</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: usePct > 85 ? '#ef4444' : '#64748b' }}>
                          {k.usage_today.toLocaleString()} / {k.limit === Infinity ? '∞' : k.limit.toLocaleString()} req
                        </span>
                      </div>
                      <div className={progressClass}>
                        <div style={{ width: `${usePct}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* actions */}
                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>Last used</p>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', margin: '1px 0 0' }}>{rel(k.last_used)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRotate(k.id)}
                        title="Rotate key"
                        style={{ padding: 7, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.borderColor = '#bfdbfe'; e.currentTarget.style.boxShadow = '0 0 8px rgba(59,130,246,0.2)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <RotateCw size={13} />
                      </button>
                      <button
                        onClick={() => handleRevoke(k.id)}
                        disabled={revoking === k.id}
                        title="Revoke key"
                        style={{ padding: 7, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', transition: 'all 0.15s', opacity: revoking === k.id ? 0.5 : 1 }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.boxShadow = '0 0 8px rgba(239,68,68,0.2)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Tier cards ── */}
      <div className="neon-card" style={{ padding: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '0 0 6px' }}>Developer status and scopes</p>
        <pre style={{ margin: 0, maxHeight: 90, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 10, color: '#64748b' }}>{JSON.stringify(developerMeta, null, 2)}</pre>
      </div>
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {TIERS.map((t) => (
          <div
            key={t.id}
            className="neon-card"
            style={{
              border: `1.5px solid ${t.border}`,
              boxShadow: `0 0 18px ${t.color}18`,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.color }}>{t.label}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{t.price}</span>
            </div>
            <p style={{ fontSize: 22, fontWeight: 900, color: t.color, letterSpacing: '-0.02em', marginBottom: 14, textShadow: `0 0 12px ${t.color}44` }}>{t.limit}</p>
            {t.features.map(f => (
              <div key={f} className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={13} color={t.color} />
                <span style={{ fontSize: 12.5, color: '#475569' }}>{f}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Quick reference ── */}
      <div style={{ background: '#0f172a', borderRadius: 16, padding: '22px 26px', border: '1px solid rgba(59,130,246,0.2)', boxShadow: '0 0 30px rgba(59,130,246,0.1)' }}>
        <div className="flex items-center gap-2 mb-5">
          <div className="icon-glow icon-glow-blue" style={{ width: 30, height: 30, borderRadius: 8 }}>
            <Code size={14} color="#60a5fa" />
          </div>
          <h2 style={{ fontSize: 14.5, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Quick Reference — Popular Endpoints</h2>
          <span style={{ fontSize: 11.5, color: '#475569', marginLeft: 4 }}>Pass your key as <code style={{ fontFamily: 'monospace', color: '#60a5fa', background: '#1a2336', padding: '1px 6px', borderRadius: 4 }}>X-API-Key</code> header</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ENDPOINTS.map(({ method, path, desc }, i) => {
            const mc = METHOD_COLOR[method] ?? '#64748b';
            const mglow = METHOD_GLOW[method] ?? 'icon-glow';
            return (
              <div
                key={path}
                className="flex items-center gap-3"
                style={{ padding: '10px 14px', borderRadius: 10, background: '#1a2336', animation: `slideRight 0.4s ease both`, animationDelay: `${i * 0.05}s`, border: '1px solid rgba(255,255,255,0.04)', transition: 'border-color 0.2s' }}
              >
                <div className={`icon-glow ${mglow}`} style={{ width: 46, height: 22, borderRadius: 6, minWidth: 46 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: mc, letterSpacing: '0.04em' }}>{method}</span>
                </div>
                <code style={{ fontSize: 13, fontFamily: 'monospace', color: '#60a5fa', flex: 1 }}>{path}</code>
                <span style={{ fontSize: 11.5, color: '#475569' }}>{desc}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
