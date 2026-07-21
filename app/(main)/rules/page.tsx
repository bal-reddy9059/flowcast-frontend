'use client';

import { useState, useEffect, useCallback } from 'react';
import { GitBranch, Plus, Trash2, CheckCircle2, ToggleLeft, ToggleRight, Clock, X, Zap, History } from 'lucide-react';
import { rulesApi } from '@/lib/api';
import type { AlertRule } from '@/lib/types';

interface TriggerHistory {
  id: string;
  rule_id: string;
  rule_name: string;
  triggered_at: string;
  metric_value: string | number | null;
}

function timeSince(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export default function RulesPage() {
  const [rules,     setRules]     = useState<AlertRule[]>([]);
  const [history,   setHistory]   = useState<TriggerHistory[]>([]);
  const [showForm,  setShowForm]  = useState(false);
  const [success,   setSuccess]   = useState('');
  const [error,     setError]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [rName,     setRName]     = useState('');
  const [rLocation, setRLocation] = useState('Bangalore');
  const [rMetric,   setRMetric]   = useState<AlertRule['condition_metric']>('congestion_level');
  const [rOperator, setROperator] = useState<AlertRule['condition_operator']>('>=');
  const [rValue,    setRValue]    = useState('high');
  const [rDuration, setRDuration] = useState(5);
  const [rAction,   setRAction]   = useState<AlertRule['action_type']>('notify');
  const [tab,       setTab]       = useState<'rules' | 'history'>('rules');
  const [totalRules, setTotalRules] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const r = await rulesApi.list({ limit: 50, offset: 0 });
      setRules(r.data.rules);
      setTotalRules(r.data.total);
    } catch {
      setError('Unable to load rules within 4 seconds.');
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  const createRule = async () => {
    if (!rName.trim() || !rLocation.trim() || !rValue.trim()) return;
    setSaving(true);
    setError('');
    try {
      const response = await rulesApi.create({
        name: rName.trim(),
        location: rLocation.trim(),
        condition_metric: rMetric,
        condition_operator: rOperator,
        condition_value: rValue.trim(),
        duration_minutes: rDuration,
        action_type: rAction,
        cooldown_minutes: 30,
      });
      setRules((p) => [response.data, ...p]);
      setTotalRules((n) => n + 1);
      setSuccess(`Rule "${response.data.name}" created`);
      setRName('');
      setShowForm(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Rule creation failed. Check the condition values and try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (id: string) => {
    setError('');
    try {
      const response = await rulesApi.toggle(id);
      setRules((p) => p.map((r) => r.id === id ? { ...r, is_active: response.data.is_active } : r));
    } catch {
      setError('Unable to toggle this rule.');
    }
  };

  const deleteRule = async (id: string) => {
    setError('');
    try {
      await rulesApi.delete(id);
      setRules((p) => p.filter((r) => r.id !== id));
      setTotalRules((n) => Math.max(0, n - 1));
    } catch {
      setError('Unable to delete this rule.');
    }
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setError('');
    try {
      // The API exposes per-rule history, so cap and parallelize to avoid an unbounded N+1 request.
      const responses = await Promise.allSettled(rules.slice(0, 10).map((rule) => rulesApi.history(rule.id)));
      const events = responses.flatMap((result) => {
        if (result.status !== 'fulfilled') return [];
        const data = result.value.data;
        return data.triggers.map((trigger, index) => ({
          id: `${data.rule_id}-${trigger.triggered_at}-${index}`,
          rule_id: data.rule_id,
          rule_name: data.rule_name,
          triggered_at: trigger.triggered_at,
          metric_value: trigger.metric_value,
        }));
      });
      setHistory(events.sort((a, b) => Date.parse(b.triggered_at) - Date.parse(a.triggered_at)));
    } catch {
      setError('Unable to load rule history within 4 seconds.');
    } finally {
      setHistoryLoading(false);
    }
  }, [rules]);

  const activeCount   = rules.filter((r) => r.is_active).length;
  const totalTriggers = history.length;

  return (
    <div className="space-y-5" style={{ maxWidth: 980 }}>

      {/* ── Page Hero ─────────────────────────────── */}
      <div className="page-hero" style={{ marginBottom: 0 }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="icon-glow icon-glow-purple" style={{ width: 52, height: 52 }}>
              <GitBranch size={26} color="#c084fc" />
            </div>
            <div>
              <h1 className="gradient-text-neon" style={{ fontWeight: 800, fontSize: 22, margin: 0 }}>Alert Rules Engine</h1>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 3 }}>Custom rule builder, toggle control &amp; trigger history</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            {[{ l: 'Total Rules', v: totalRules }, { l: 'Active', v: activeCount }, { l: 'Loaded Triggers', v: totalTriggers }, { l: 'Page Size', v: rules.length }].map(({ l, v }) => (
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
      {error && (
        <div role="alert" style={{ padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {(['rules', 'history'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); if (t === 'history') void loadHistory(); }}
            style={{ padding: '7px 18px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none', transition: 'all 0.15s', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#111827' : '#64748b', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
            {t === 'rules' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><GitBranch size={13} /> Rules</span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><History size={13} /> Trigger History</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'rules' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{rules.length} Rules Configured</span>
            <button onClick={() => setShowForm(!showForm)} className="btn-gradient"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              <Plus size={14} /> New Rule
            </button>
          </div>

          {showForm && (
            <div className="neon-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Build New Rule</span>
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={16} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>Rule Name</label>
                  <input placeholder="e.g. Delhi Peak Congestion Alert" value={rName} onChange={(e) => setRName(e.target.value)}
                    style={{ width: '100%', fontSize: 13, borderRadius: 9, padding: '9px 12px', border: '1.5px solid #e5e7eb', outline: 'none', color: '#111827', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>Location</label>
                  <input placeholder="e.g. Bangalore" value={rLocation} onChange={(e) => setRLocation(e.target.value)}
                    style={{ width: '100%', fontSize: 13, borderRadius: 9, padding: '9px 12px', border: '1.5px solid #e5e7eb', outline: 'none', color: '#111827', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr', gap: 8 }}>
                  <select value={rMetric} onChange={(e) => setRMetric(e.target.value as AlertRule['condition_metric'])}>
                    <option value="congestion_level">Congestion level</option>
                    <option value="average_speed">Average speed</option>
                    <option value="vehicle_count">Vehicle count</option>
                  </select>
                  <select value={rOperator} onChange={(e) => setROperator(e.target.value as AlertRule['condition_operator'])}>
                    {['>=', '<=', '==', '>', '<'].map((operator) => <option key={operator}>{operator}</option>)}
                  </select>
                  <input value={rValue} onChange={(e) => setRValue(e.target.value)} placeholder="Value" />
                  <input type="number" min={1} max={120} value={rDuration} onChange={(e) => setRDuration(Number(e.target.value))} title="Duration in minutes" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>Action</label>
                  <select value={rAction} onChange={(e) => setRAction(e.target.value as AlertRule['action_type'])}
                    style={{ width: '100%', fontSize: 13, borderRadius: 9, padding: '9px 12px', border: '1.5px solid #e5e7eb', color: '#111827', background: '#fff' }}>
                    <option value="notify">Notify</option>
                    <option value="webhook" disabled>Webhook (select a webhook first)</option>
                    <option value="both" disabled>Notify + webhook (select a webhook first)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={createRule} disabled={saving || !rName.trim() || !rLocation.trim() || !rValue.trim()} className="btn-gradient"
                    style={{ padding: '9px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, opacity: (saving || !rName.trim()) ? 0.5 : 1 }}>
                    {saving ? 'Creating…' : 'Create Rule'}
                  </button>
                  <button onClick={() => setShowForm(false)} style={{ padding: '9px 16px', borderRadius: 10, fontSize: 13, color: '#9ca3af', background: 'none', border: '1px solid #e5e7eb', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rules.map((r) => (
              <div key={r.id} className="neon-card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div className={`icon-glow ${r.is_active ? 'icon-glow-purple' : ''}`} style={{ width: 32, height: 32, background: r.is_active ? 'rgba(139,92,246,0.12)' : '#f1f5f9' }}>
                        <GitBranch size={14} color={r.is_active ? '#7c3aed' : '#9ca3af'} />
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 13, color: '#111827', margin: 0 }}>{r.name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          <span
                            className={r.is_active ? 'neon-badge-green' : ''}
                            style={r.is_active
                              ? { fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99 }
                              : { fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#f1f5f9', color: '#9ca3af' }
                            }>
                            {r.is_active ? 'Active' : 'Paused'}
                          </span>
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>{r.location}</span>
                          {r.last_triggered_at && <span style={{ fontSize: 10, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={9} /> {timeSince(r.last_triggered_at)}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: 9, padding: '8px 12px', marginBottom: 6 }}>
                      <p style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, margin: '0 0 3px' }}>CONDITION</p>
                      <code style={{ fontSize: 12, color: '#334155', fontFamily: 'monospace' }}>{r.condition}</code>
                    </div>
                    <div style={{ background: 'rgba(139,92,246,0.05)', borderRadius: 9, padding: '8px 12px', border: '1px solid rgba(139,92,246,0.1)' }}>
                      <p style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, margin: '0 0 3px' }}>ACTION</p>
                      <span style={{ fontSize: 12, color: '#6d28d9', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Zap size={11} color="#8b5cf6" /> {r.action_type}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => void toggleRule(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: r.is_active ? '#7c3aed' : '#9ca3af', display: 'flex', transition: 'color 0.15s', filter: r.is_active ? 'drop-shadow(0 0 6px rgba(124,58,237,0.5))' : 'none' }}>
                      {r.is_active ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                    </button>
                    <button onClick={() => deleteRule(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 4, borderRadius: 6 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#d1d5db')}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="neon-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="icon-glow icon-glow-purple" style={{ width: 28, height: 28 }}>
              <History size={13} color="#a78bfa" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Trigger History</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, marginLeft: 'auto' }} className="neon-badge-blue">{history.length} events</span>
          </div>
          {historyLoading && <p style={{ padding: '18px 20px', color: '#94a3b8', fontSize: 12 }}>Loading history…</p>}
          {!historyLoading && history.length === 0 && <p style={{ padding: '18px 20px', color: '#94a3b8', fontSize: 12 }}>No rule triggers recorded.</p>}
          {history.map((h, i) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 20px', borderBottom: i < history.length - 1 ? '1px solid #f9fafb' : 'none' }}>
              <div className="icon-glow icon-glow-purple" style={{ width: 32, height: 32 }}>
                <Zap size={14} color="#8b5cf6" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: '#111827', margin: 0 }}>{h.rule_name}</p>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, flexShrink: 0 }} className="neon-badge-blue">Triggered</span>
                </div>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>Metric value: {String(h.metric_value ?? '—')}</p>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> {timeSince(h.triggered_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
