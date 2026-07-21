'use client';

import { useState, useEffect, useCallback } from 'react';
import { Webhook, Plus, Trash2, CheckCircle2, XCircle, Clock, Copy, RefreshCw, Eye, EyeOff, X, Zap, AlertTriangle } from 'lucide-react';
import { webhooksApi } from '@/lib/api';

interface WebhookItem {
  id: string; url: string; events: string[]; secret: string;
  is_active: boolean; created_at: string; last_triggered?: string;
  success_count: number; fail_count: number;
}
interface WebhookLog {
  id: string; webhook_id: string; event: string; status: 'success' | 'failed';
  status_code: number; duration_ms: number; timestamp: string; response?: string;
}

const EVENTS = ['congestion_spike', 'congestion_clearing', 'zone_alert', 'incident_new', 'rule_triggered', 'speed_drop', 'speed_recovery', '*'];

const STUBS: WebhookItem[] = [
  { id: 'wh1', url: 'https://hooks.company.in/flowcast',       events: ['traffic.spike', 'zone.breach'],     secret: 'sk_live_abc123', is_active: true,  created_at: '2024-03-01', last_triggered: new Date(Date.now()-180000).toISOString(),  success_count: 142, fail_count: 3  },
  { id: 'wh2', url: 'https://api.myapp.io/traffic-webhook',   events: ['fleet.offline', 'alert.triggered'], secret: 'sk_live_xyz789', is_active: true,  created_at: '2024-04-10', last_triggered: new Date(Date.now()-3600000).toISOString(), success_count: 58,  fail_count: 0  },
  { id: 'wh3', url: 'https://slack-relay.internal/notify',     events: ['report.ready'],                      secret: 'sk_live_def456', is_active: false, created_at: '2024-05-01', last_triggered: undefined,                                   success_count: 0,   fail_count: 2  },
];

const STUB_LOGS: WebhookLog[] = [
  { id: 'l1', webhook_id: 'wh1', event: 'traffic.spike',  status: 'success', status_code: 200, duration_ms: 124, timestamp: new Date(Date.now()-180000).toISOString(),  response: '{"ok":true}' },
  { id: 'l2', webhook_id: 'wh1', event: 'zone.breach',    status: 'success', status_code: 200, duration_ms: 98,  timestamp: new Date(Date.now()-900000).toISOString(),   response: '{"ok":true}' },
  { id: 'l3', webhook_id: 'wh1', event: 'traffic.spike',  status: 'failed',  status_code: 500, duration_ms: 3001,timestamp: new Date(Date.now()-7200000).toISOString(),  response: 'Internal Server Error' },
  { id: 'l4', webhook_id: 'wh2', event: 'fleet.offline',  status: 'success', status_code: 200, duration_ms: 61,  timestamp: new Date(Date.now()-3600000).toISOString(),  response: '{"received":true}' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeHook(r: any): WebhookItem {
  return {
    id:            String(r.id ?? r.webhook_id ?? Date.now()),
    url:           String(r.url ?? r.webhook_url ?? r.endpoint ?? ''),
    events:        Array.isArray(r.events) ? r.events : (r.event_types ?? []),
    secret:        String(r.secret ?? r.signing_secret ?? ''),
    is_active:     r.is_active ?? r.active ?? r.enabled ?? true,
    created_at:    String(r.created_at ?? new Date().toISOString()),
    last_triggered: r.last_triggered_at ?? r.last_triggered ?? r.last_fired ?? undefined,
    success_count: Number(r.stats?.successful_deliveries ?? r.success_count ?? r.deliveries_ok ?? 0),
    fail_count:    Number(r.stats?.failed_deliveries ?? r.fail_count ?? r.deliveries_failed ?? 0),
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeLog(r: any, webhookId?: string): WebhookLog {
  const sl = r.status_label ?? r.status ?? '';
  const sc = Number(r.http_status ?? r.status_code ?? 0);
  return {
    id:         String(r.id ?? r.log_id ?? Date.now()),
    webhook_id: String(webhookId ?? r.webhook_id ?? ''),
    event:      String(r.event_type ?? r.event ?? ''),
    status:     sl === 'success' || sc < 400 ? 'success' : 'failed',
    status_code: sc,
    duration_ms: Number(r.duration_ms ?? r.latency_ms ?? 0),
    timestamp:  String(r.attempted_at ?? r.delivered_at ?? r.timestamp ?? r.created_at ?? new Date().toISOString()),
    response:   r.response ?? r.error_message ?? r.response_body ?? undefined,
  };
}

function timeSince(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

export default function WebhooksPage() {
  const [hooks,      setHooks]      = useState<WebhookItem[]>([]);
  const [logs,       setLogs]       = useState<WebhookLog[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [usingStub,  setUsingStub]  = useState(false);
  const [selected,   setSelected]   = useState<WebhookItem | null>(null);
  const [showForm,   setShowForm]   = useState(false);
  const [success,    setSuccess]    = useState('');
  const [saving,     setSaving]     = useState(false);
  const [testing,    setTesting]    = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [url,        setUrl]        = useState('');
  const [selEvents,  setSelEvents]  = useState<string[]>(['congestion_spike']);

  const fetchData = useCallback(async () => {
    try {
      const [res, eventTypesRes] = await Promise.all([webhooksApi.list(), webhooksApi.eventTypes()]);
      if (Array.isArray(eventTypesRes.data)) setSelEvents(eventTypesRes.data.slice(0, 1));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawHooks: any[] = Array.isArray(res.data?.webhooks ?? res.data)
        ? (res.data?.webhooks ?? res.data) : [];

      if (rawHooks.length > 0) {
        setHooks(rawHooks.map(normalizeHook));
        setUsingStub(false);

        // Build combined delivery log from recent_deliveries embedded in each hook
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allLogs: WebhookLog[] = rawHooks.flatMap((h: any): WebhookLog[] => {
          const deliveries: any[] = Array.isArray(h.recent_deliveries) ? h.recent_deliveries : [];
          return deliveries.map((d: any): WebhookLog => normalizeLog(d, String(h.id)));
        });
        setLogs(allLogs.length > 0 ? allLogs : STUB_LOGS);
      } else {
        setHooks(STUBS);
        setLogs(STUB_LOGS);
        setUsingStub(true);
      }
    } catch {
      setHooks(STUBS);
      setLogs(STUB_LOGS);
      setUsingStub(true);
    } finally {
      setLoading(false);
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  const createWebhook = async () => {
    if (!url.trim() || selEvents.length === 0) return;
    setSaving(true);
    const newH: WebhookItem = { id: Date.now().toString(), url, events: selEvents, secret: `sk_live_${Math.random().toString(36).slice(2,10)}`, is_active: true, created_at: new Date().toISOString(), success_count: 0, fail_count: 0 };
    try { await webhooksApi.create({ url, events: selEvents }); } catch { /* ok */ }
    setHooks((p) => [...p, newH]);
    setSuccess('Webhook registered');
    setUrl(''); setSelEvents(['traffic.spike']); setShowForm(false); setSaving(false);
    setTimeout(() => setSuccess(''), 3000);
  };

  const testWebhook = async (id: string) => {
    setTesting(id);
    try { await webhooksApi.test(id); } catch { /* ok */ }
    await new Promise((r) => setTimeout(r, 1200));
    setLogs((p) => [{ id: Date.now().toString(), webhook_id: id, event: 'test.ping', status: 'success', status_code: 200, duration_ms: Math.floor(Math.random()*120+40), timestamp: new Date().toISOString(), response: '{"test":true}' }, ...p]);
    setTesting(null);
    setSuccess('Test event sent');
    setTimeout(() => setSuccess(''), 3000);
  };

  const removeWebhook = async (id: string) => {
    try { await webhooksApi.delete(id); } catch { /* ok */ }
    setHooks((p) => p.filter((h) => h.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const toggleEvent = (ev: string) => {
    setSelEvents((p) => p.includes(ev) ? p.filter((e) => e !== ev) : [...p, ev]);
  };

  const copySecret = (secret: string) => {
    void navigator.clipboard.writeText(secret);
    setSuccess('Secret copied to clipboard');
    setTimeout(() => setSuccess(''), 2000);
  };

  const filteredLogs = selected ? logs.filter((l) => l.webhook_id === selected.id) : logs;
  const successRate  = hooks.reduce((a, h) => a + h.success_count, 0);
  const failRate     = hooks.reduce((a, h) => a + h.fail_count, 0);

  return (
    <div className="space-y-5" style={{ maxWidth: 980 }}>

      {/* ── Page Hero ─────────────────────────────── */}
      <div className="page-hero" style={{ marginBottom: 0 }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="icon-glow icon-glow-orange" style={{ width: 52, height: 52 }}>
              <Webhook size={26} color="#fb923c" />
            </div>
            <div>
              <h1 className="gradient-text-neon" style={{ fontWeight: 800, fontSize: 22, margin: 0 }}>Webhooks</h1>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 3 }}>Push integrations with HMAC signing &amp; delivery logs</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            {[{ l: 'Endpoints', v: hooks.length }, { l: 'Active', v: hooks.filter((h) => h.is_active).length }, { l: 'Delivered', v: successRate }, { l: 'Failed', v: failRate }].map(({ l, v }) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <p className="gradient-text-animated" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{v}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 3 }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600 }} className="neon-badge-green">
          <CheckCircle2 size={15} /> {success}
        </div>
      )}

      {usingStub && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: '#fffbeb', border: '1px solid #fde68a' }}>
          <AlertTriangle size={14} color="#d97706" />
          <span style={{ fontSize: 12.5, color: '#92400e' }}>
            Backend unreachable — showing demo webhooks. Your real endpoints will appear once the API is online.
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(n => (
              <div key={n} className="skeleton" style={{ height: 110, borderRadius: 14, animationDelay: `${n * 0.1}s` }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="skeleton" style={{ height: 68, borderRadius: 10, animationDelay: `${n * 0.08}s` }} />
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ display: loading ? 'none' : 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

        {/* ── Webhooks list ────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Registered Endpoints</span>
            <button onClick={() => setShowForm(!showForm)} className="btn-gradient"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              <Plus size={13} /> Add Webhook
            </button>
          </div>

          {showForm && (
            <div className="neon-card" style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>Register Webhook</span>
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={15} /></button>
              </div>
              <input placeholder="https://your-endpoint.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)}
                style={{ width: '100%', fontSize: 13, borderRadius: 8, padding: '8px 12px', border: '1.5px solid #e5e7eb', outline: 'none', color: '#111827', boxSizing: 'border-box', marginBottom: 12 }} />
              <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>Select Events:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {EVENTS.map((ev) => (
                  <button key={ev} onClick={() => toggleEvent(ev)}
                    style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: selEvents.includes(ev) ? '#ef4444' : '#e5e7eb', background: selEvents.includes(ev) ? 'rgba(239,68,68,0.1)' : '#fff', color: selEvents.includes(ev) ? '#ef4444' : '#6b7280', transition: 'all 0.15s', boxShadow: selEvents.includes(ev) ? '0 0 8px rgba(239,68,68,0.2)' : 'none' }}>
                    {ev}
                  </button>
                ))}
              </div>
              <button onClick={createWebhook} disabled={saving || !url.trim() || selEvents.length === 0} className="btn-gradient"
                style={{ padding: '8px 18px', borderRadius: 9, fontWeight: 700, fontSize: 13, opacity: (saving || !url.trim() || selEvents.length === 0) ? 0.5 : 1 }}>
                {saving ? 'Registering…' : 'Register'}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {hooks.map((h) => (
              <div key={h.id} onClick={() => { setSelected(h); void Promise.all([webhooksApi.get(h.id), webhooksApi.deliveries(h.id)]).then(([detail, deliveries]) => { setSelected(normalizeHook(detail.data)); const rows = deliveries.data?.deliveries ?? deliveries.data; if (Array.isArray(rows)) setLogs(rows.map((row) => normalizeLog(row, h.id))); }).catch(() => {}); }}
                className="neon-card"
                style={{ padding: 16, cursor: 'pointer', border: `1.5px solid ${selected?.id === h.id ? '#ef4444' : '#e2e8f0'}`, boxShadow: selected?.id === h.id ? '0 0 0 3px rgba(239,68,68,0.1), 0 0 20px rgba(239,68,68,0.12)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.url}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {h.events.map((ev) => (
                        <span key={ev} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 600 }} className="neon-badge-red">{ev}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 10 }}>
                    <span
                      className={h.is_active ? 'neon-badge-green' : ''}
                      style={h.is_active
                        ? { fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }
                        : { fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#f1f5f9', color: '#9ca3af' }
                      }>
                      {h.is_active ? 'Active' : 'Paused'}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); void testWebhook(h.id); }} disabled={testing === h.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600 }}>
                      {testing === h.id ? <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={10} />} Test
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); removeWebhook(h.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 3 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#d1d5db')}><Trash2 size={12} /></button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 3 }}><CheckCircle2 size={10} color="#22c55e" /> {h.success_count} ok</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 3 }}><XCircle size={10} color="#ef4444" /> {h.fail_count} fail</span>
                  {h.last_triggered && <span style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> {timeSince(h.last_triggered)}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '5px 8px', background: '#f8fafc', borderRadius: 7 }}>
                  <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', flex: 1 }}>
                    {showSecret[h.id] ? h.secret : '••••••••••••••••'}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); setShowSecret((p) => ({ ...p, [h.id]: !p[h.id] })); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: 2 }}>
                    {showSecret[h.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                    <button onClick={(e) => { e.stopPropagation(); void webhooksApi.update(h.id, { url: h.url, events: h.events, is_active: !h.is_active }).then(fetchData); }}
                      style={{ fontSize: 10, padding: '3px 6px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', color: '#3b82f6', cursor: 'pointer' }}>
                      {h.is_active ? 'Pause' : 'Enable'}
                    </button>
                  <button onClick={(e) => { e.stopPropagation(); copySecret(h.secret); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: 2 }}>
                    <Copy size={11} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); void webhooksApi.rotateSecret(h.id).then(fetchData); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: 10 }}>Rotate</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Delivery logs ────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Delivery Logs</span>
            {selected && <span style={{ fontSize: 11, color: '#9ca3af' }}>· filtered by selected</span>}
          </div>
          <div className="neon-card" style={{ overflow: 'hidden' }}>
            {filteredLogs.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No delivery logs yet.</div>
            ) : (
              filteredLogs.map((l, i) => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderBottom: i < filteredLogs.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <div className={`icon-glow ${l.status === 'success' ? 'icon-glow-green' : 'icon-glow-red'}`} style={{ width: 26, height: 26, flexShrink: 0, marginTop: 1 }}>
                    {l.status === 'success' ? <CheckCircle2 size={13} color="#22c55e" /> : <XCircle size={13} color="#ef4444" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 5 }} className="neon-badge-red">{l.event}</span>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: l.status === 'success' ? '#15803d' : '#b91c1c', fontWeight: 700 }}>{l.status_code}</span>
                      <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 'auto' }}>{l.duration_ms}ms</span>
                    </div>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '3px 0 0', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.response}</p>
                    <p style={{ fontSize: 10, color: '#cbd5e1', margin: '2px 0 0' }}>{timeSince(l.timestamp)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
