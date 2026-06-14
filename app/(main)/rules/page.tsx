'use client';

import { useState, useEffect, useCallback } from 'react';
import { GitBranch, Plus, Trash2, CheckCircle2, ToggleLeft, ToggleRight, Clock, AlertTriangle, X, Zap, History } from 'lucide-react';
import api from '@/lib/api';

interface Rule {
  id: string; name: string; condition: string; action: string;
  is_active: boolean; trigger_count: number; last_triggered?: string; created_at: string;
}
interface TriggerHistory {
  id: string; rule_id: string; rule_name: string; triggered_at: string; detail: string; resolved: boolean;
}

const RULE_STUBS: Rule[] = [
  { id: 'r1', name: 'Mumbai Peak Hour Spike',     condition: 'congestion > 0.85 AND city = "Mumbai"',         action: 'Send alert + notify fleet',   is_active: true,  trigger_count: 23, last_triggered: new Date(Date.now()-600000).toISOString(),  created_at: '2024-03-01' },
  { id: 'r2', name: 'Fleet Vehicle Offline',       condition: 'vehicle.status = "offline" AND duration > 30m', action: 'Notify admin via webhook',    is_active: true,  trigger_count: 7,  last_triggered: new Date(Date.now()-7200000).toISOString(), created_at: '2024-03-15' },
  { id: 'r3', name: 'Zone Threshold Breach',       condition: 'zone.congestion > zone.threshold',              action: 'Fire zone alert + log event', is_active: true,  trigger_count: 41, last_triggered: new Date(Date.now()-300000).toISOString(),  created_at: '2024-04-01' },
  { id: 'r4', name: 'Low Fuel Warning',            condition: 'vehicle.fuel_pct < 25',                         action: 'Alert driver + log warning',  is_active: false, trigger_count: 12, last_triggered: new Date(Date.now()-86400000).toISOString(),created_at: '2024-04-20' },
  { id: 'r5', name: 'High Speed in School Zone',  condition: 'vehicle.speed > 40 AND zone.type = "school"',   action: 'Immediate alert + log',       is_active: true,  trigger_count: 3,  last_triggered: new Date(Date.now()-172800000).toISOString(),created_at: '2024-05-01' },
];

const HISTORY_STUBS: TriggerHistory[] = [
  { id: 'h1', rule_id: 'r3', rule_name: 'Zone Threshold Breach',   triggered_at: new Date(Date.now()-300000).toISOString(),   detail: 'Chennai Port Entry exceeded 60% threshold',         resolved: false },
  { id: 'h2', rule_id: 'r1', rule_name: 'Mumbai Peak Hour Spike',  triggered_at: new Date(Date.now()-600000).toISOString(),   detail: 'Congestion reached 87% in Andheri West',            resolved: true  },
  { id: 'h3', rule_id: 'r3', rule_name: 'Zone Threshold Breach',   triggered_at: new Date(Date.now()-1800000).toISOString(),  detail: 'Bengaluru Tech Corridor at 74%',                    resolved: true  },
  { id: 'h4', rule_id: 'r2', rule_name: 'Fleet Vehicle Offline',   triggered_at: new Date(Date.now()-7200000).toISOString(),  detail: 'Vehicle GJ-01-IJ-7890 offline for 35 minutes',      resolved: true  },
  { id: 'h5', rule_id: 'r5', rule_name: 'High Speed in School Zone', triggered_at: new Date(Date.now()-172800000).toISOString(), detail: 'Vehicle KA-09-CD-5678 at 52 km/h near school zone', resolved: true  },
];

const CONDITION_TEMPLATES = [
  'congestion > 0.80 AND city = "Mumbai"',
  'vehicle.status = "offline" AND duration > 30m',
  'zone.congestion > zone.threshold',
  'vehicle.fuel_pct < 20',
  'vehicle.speed > 60',
];

function timeSince(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export default function RulesPage() {
  const [rules,     setRules]     = useState<Rule[]>(RULE_STUBS);
  const [history,   setHistory]   = useState<TriggerHistory[]>(HISTORY_STUBS);
  const [showForm,  setShowForm]  = useState(false);
  const [success,   setSuccess]   = useState('');
  const [saving,    setSaving]    = useState(false);
  const [rName,     setRName]     = useState('');
  const [rCond,     setRCond]     = useState('');
  const [rAction,   setRAction]   = useState('');
  const [tab,       setTab]       = useState<'rules' | 'history'>('rules');

  const fetchData = useCallback(async () => {
    try {
      const r = await api.get('/rules');
      if (r.data?.length) setRules(r.data);
    } catch { /* stub */ }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  const createRule = async () => {
    if (!rName.trim() || !rCond.trim() || !rAction.trim()) return;
    setSaving(true);
    const newR: Rule = { id: Date.now().toString(), name: rName, condition: rCond, action: rAction, is_active: true, trigger_count: 0, created_at: new Date().toISOString() };
    try { await api.post('/rules', { name: rName, condition: rCond, action: rAction }); } catch { /* ok */ }
    setRules((p) => [...p, newR]);
    setSuccess(`Rule "${rName}" created`);
    setRName(''); setRCond(''); setRAction(''); setShowForm(false); setSaving(false);
    setTimeout(() => setSuccess(''), 3000);
  };

  const toggleRule = async (id: string) => {
    try { await api.put(`/rules/${id}/toggle`); } catch { /* ok */ }
    setRules((p) => p.map((r) => r.id === id ? { ...r, is_active: !r.is_active } : r));
  };

  const deleteRule = async (id: string) => {
    try { await api.delete(`/rules/${id}`); } catch { /* ok */ }
    setRules((p) => p.filter((r) => r.id !== id));
  };

  const activeCount   = rules.filter((r) => r.is_active).length;
  const totalTriggers = rules.reduce((a, r) => a + r.trigger_count, 0);
  const unresolvedCount = history.filter((h) => !h.resolved).length;

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
            {[{ l: 'Total Rules', v: rules.length }, { l: 'Active', v: activeCount }, { l: 'Total Triggers', v: totalTriggers }, { l: 'Unresolved', v: unresolvedCount }].map(({ l, v }) => (
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

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {(['rules', 'history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
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
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>Condition Expression</label>
                  <textarea placeholder="e.g. congestion > 0.80 AND city = &quot;Delhi&quot;" value={rCond} onChange={(e) => setRCond(e.target.value)} rows={2}
                    style={{ width: '100%', fontSize: 12, borderRadius: 9, padding: '9px 12px', border: '1.5px solid #e5e7eb', outline: 'none', color: '#111827', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {CONDITION_TEMPLATES.map((t) => (
                      <button key={t} onClick={() => setRCond(t)}
                        style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.07)', color: '#475569', border: '1px solid rgba(59,130,246,0.15)', cursor: 'pointer', fontFamily: 'monospace' }}>
                        {t.slice(0, 30)}…
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>Action</label>
                  <input placeholder="e.g. Send alert + notify fleet" value={rAction} onChange={(e) => setRAction(e.target.value)}
                    style={{ width: '100%', fontSize: 13, borderRadius: 9, padding: '9px 12px', border: '1.5px solid #e5e7eb', outline: 'none', color: '#111827', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={createRule} disabled={saving || !rName.trim() || !rCond.trim() || !rAction.trim()} className="btn-gradient"
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
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>{r.trigger_count} triggers</span>
                          {r.last_triggered && <span style={{ fontSize: 10, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={9} /> {timeSince(r.last_triggered)}</span>}
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
                        <Zap size={11} color="#8b5cf6" /> {r.action}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => toggleRule(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: r.is_active ? '#7c3aed' : '#9ca3af', display: 'flex', transition: 'color 0.15s', filter: r.is_active ? 'drop-shadow(0 0 6px rgba(124,58,237,0.5))' : 'none' }}>
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
          {history.map((h, i) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 20px', borderBottom: i < history.length - 1 ? '1px solid #f9fafb' : 'none' }}>
              <div className={`icon-glow ${h.resolved ? 'icon-glow-green' : 'icon-glow-red'}`} style={{ width: 32, height: 32 }}>
                {h.resolved ? <CheckCircle2 size={14} color="#22c55e" /> : <AlertTriangle size={14} color="#ef4444" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: '#111827', margin: 0 }}>{h.rule_name}</p>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, flexShrink: 0 }} className={h.resolved ? 'neon-badge-green' : 'neon-badge-red'}>
                    {h.resolved ? 'Resolved' : 'Active'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>{h.detail}</p>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> {timeSince(h.triggered_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
