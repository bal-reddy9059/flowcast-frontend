'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area,
} from 'recharts';
import {
  ArrowLeft, Users, Clock, MapPin, Navigation, RefreshCw,
  CheckCircle2, Star, TrendingDown, BarChart2, TrendingUp,
  Wifi, ScrollText, AlertCircle, Zap,
} from 'lucide-react';
import { stationsApi, crowdApi, crowdLogsApi } from '@/lib/api';
import {
  Station, HourlyPoint, WeeklyPoint, BestTime, CrowdLog,
  getCrowdColor, getCrowdStyle, getCrowdLevelFromScore,
  getTypeEmoji, getTypeLabel, getDayName,
  unwrapArray, unwrapOne, normLog,
  normalizeStation, normalizeHourly, normalizeWeekly, normalizeBestTime,
  crowdWsUrl,
} from '@/lib/crowdHelpers';
import CrowdBadge from '@/components/crowd/CrowdBadge';
import CrowdScoreBar from '@/components/crowd/CrowdScoreBar';

// ── Shared chart tooltip style ────────────────────────────────────────────────

const ttStyle = {
  background: '#0f172a',
  border: '1px solid rgba(59,130,246,0.25)',
  borderRadius: 10,
  fontSize: 12,
  color: '#f1f5f9',
  boxShadow: '0 8px 24px rgba(0,0,0,0.35), 0 0 20px rgba(59,130,246,0.08)',
  padding: '10px 14px',
};

// ── Hourly Chart ──────────────────────────────────────────────────────────────

function HourlyTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const score = payload[0].value;
  const level = getCrowdLevelFromScore(score);
  const color = getCrowdColor(level);
  return (
    <div style={ttStyle}>
      <p style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>{label}</p>
      <p style={{ fontWeight: 800, fontSize: 18, margin: 0 }}>{score}<span style={{ color: '#334155', fontWeight: 400, fontSize: 12 }}>/100</span></p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
        <span style={{ color, fontWeight: 700, fontSize: 11 }}>{level}</span>
      </div>
    </div>
  );
}

function HourlyChart({ data }: { data: HourlyPoint[] }) {
  const currentHour = new Date().getHours();
  if (!data.length) return null;
  return (
    <div className="neon-card" style={{ padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div className="icon-glow icon-glow-blue" style={{ width: 38, height: 38, borderRadius: 11 }}><BarChart2 size={17} color="#3b82f6" /></div>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>24-Hour Crowd Forecast</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Predicted crowd levels throughout today</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -26, bottom: 4 }} barCategoryGap="18%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 9.5, fontWeight: 500 }} tickLine={false} axisLine={false} interval={2} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<HourlyTooltip />} cursor={{ fill: 'rgba(59,130,246,0.05)', radius: 6 }} />
          <Bar dataKey="crowdScore" radius={[5, 5, 0, 0]} maxBarSize={18}>
            {data.map(entry => {
              const isCurrent = entry.hour === currentHour;
              const c = isCurrent ? '#3b82f6' : `${getCrowdColor(getCrowdLevelFromScore(entry.crowdScore))}55`;
              return <Cell key={`h-${entry.hour}`} fill={c} style={isCurrent ? { filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.6))' } : undefined} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 10, flexWrap: 'wrap' }}>
        {[['#3b82f6', 'Current hour'], [`${getCrowdColor('Low')}55`, 'Low'], [`${getCrowdColor('High')}55`, 'High'], [`${getCrowdColor('Overcrowded')}55`, 'Overcrowded']].map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8' }}>
            <div style={{ width: 12, height: 10, borderRadius: 3, background: color }} />{label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Weekly Chart ──────────────────────────────────────────────────────────────

function WeeklyTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const score = payload[0].value;
  const level = getCrowdLevelFromScore(score);
  const color = getCrowdColor(level);
  const today = getDayName();
  return (
    <div style={ttStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <p style={{ color: '#64748b', fontSize: 11, margin: 0 }}>{label}</p>
        {label === today && <span style={{ fontSize: 9, background: 'rgba(249,115,22,0.2)', color: '#f97316', border: '1px solid rgba(249,115,22,0.35)', padding: '1px 6px', borderRadius: 99, fontWeight: 800 }}>TODAY</span>}
      </div>
      <p style={{ fontWeight: 800, fontSize: 18, margin: 0 }}>Avg {score}<span style={{ color: '#334155', fontWeight: 400, fontSize: 12 }}>/100</span></p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
        <span style={{ color, fontWeight: 700, fontSize: 11 }}>{level}</span>
      </div>
    </div>
  );
}

function WeeklyChart({ data }: { data: WeeklyPoint[] }) {
  const today = getDayName();
  if (!data.length) return null;
  const norm = data.map(d => ({ ...d, avgScore: d.avgScore ?? d.avg_score ?? 0 }));
  return (
    <div className="neon-card" style={{ padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div className="icon-glow icon-glow-purple" style={{ width: 38, height: 38, borderRadius: 11 }}><TrendingUp size={17} color="#8b5cf6" /></div>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Weekly Crowd Pattern</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Mon–Sun average crowd levels</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={norm} margin={{ top: 10, right: 10, left: -26, bottom: 4 }}>
          <defs>
            <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <XAxis dataKey="day" tick={(p: any) => (
            <text x={p.x} y={p.y + 14} textAnchor="middle" fill={p.payload.value === today ? '#f97316' : '#94a3b8'} fontSize={12} fontWeight={p.payload.value === today ? 800 : 500}>{p.payload.value}</text>
          )} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<WeeklyTooltip />} />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Area type="monotone" dataKey="avgScore" stroke="#3b82f6" strokeWidth={2.5} fill="url(#wg)"
            dot={(p: any) => {
              const isToday = p.payload.day === today;
              return <circle key={p.payload.day} cx={p.cx} cy={p.cy} r={isToday ? 7 : 4} fill={isToday ? '#f97316' : '#3b82f6'} stroke={isToday ? '#fed7aa' : '#bfdbfe'} strokeWidth={2} />;
            }}
            activeDot={{ r: 7, fill: '#3b82f6', stroke: '#bfdbfe', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10 }}>
        {[['#3b82f6', 'Regular day'], ['#f97316', `Today (${today})`]].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />{l}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Best Time Card ────────────────────────────────────────────────────────────

function BestTimeCard({ data }: { data: BestTime }) {
  const bestTime = data.bestTime ?? data.best_time ?? data.best_window_label ?? data.window ?? data.recommendedTime;
  const reason = data.reason ?? data.description ?? data.message;
  const expectedScore = data.expectedScore ?? data.expected_score ?? data.avg_score_in_window ?? data.avgScore;
  const tips = Array.isArray(data.tips) ? data.tips : [];
  const level = expectedScore != null ? getCrowdLevelFromScore(expectedScore) : null;
  const s = level ? getCrowdStyle(level) : null;
  return (
    <div className="neon-card" style={{ padding: '22px 24px', background: 'linear-gradient(135deg,rgba(16,185,129,0.04) 0%,#fff 50%)', borderColor: 'rgba(16,185,129,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="icon-glow icon-glow-green" style={{ width: 40, height: 40, borderRadius: 12 }}><Star size={18} color="#10b981" /></div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Best Time to Visit</h3>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', marginTop: 2 }}>AI-recommended low-crowd window</p>
          </div>
        </div>
        {level && <CrowdBadge level={level} size="md" />}
      </div>

      {bestTime && (
        <div style={{ background: '#f0fdf4', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <Clock size={13} color="#10b981" />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Recommended Window</span>
          </div>
          <p style={{ fontSize: 24, fontWeight: 900, color: '#10b981', margin: 0, letterSpacing: '-0.02em', textShadow: '0 0 16px rgba(16,185,129,0.25)' }}>{bestTime}</p>
          {reason && <p style={{ fontSize: 13, color: '#64748b', margin: '8px 0 0', lineHeight: 1.55 }}>{reason}</p>}
        </div>
      )}

      {expectedScore != null && s && (
        <div style={{ marginBottom: tips.length ? 16 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <TrendingDown size={13} color="#10b981" />
            <span style={{ fontSize: 13, color: '#334155' }}>Expected score: <strong style={{ color: s.text }}>{expectedScore}/100</strong></span>
          </div>
          <CrowdScoreBar score={expectedScore} level={level!} showLabel={false} height={6} />
        </div>
      )}

      {tips.length > 0 && (
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
          <p style={{ margin: '0 0 10px', fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Visit Tips</p>
          {tips.map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{tip}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Crowd Logs Table ──────────────────────────────────────────────────────────

function CrowdLogsTable({ logs }: { logs: CrowdLog[] }) {
  const [showAll, setShowAll] = useState(false);
  const items = logs.map(normLog);
  const visible = showAll ? items : items.slice(0, 15);

  if (!items.length) return null;

  return (
    <div className="neon-card" style={{ padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="icon-glow icon-glow-orange" style={{ width: 38, height: 38, borderRadius: 11 }}><ScrollText size={17} color="#f97316" /></div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Crowd Activity Log</h3>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Last {items.length} entries, newest first</p>
          </div>
        </div>
        {items.length > 15 && (
          <button onClick={() => setShowAll(v => !v)} className="btn-neon" style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
            {showAll ? 'Show less' : `Show all ${items.length}`}
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
              {['#', 'Time', 'Score', 'Level', 'Bar'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: h === '#' ? 'center' : 'left', fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((log, i) => {
              const color = getCrowdColor(log.level);
              const s = getCrowdStyle(log.level);
              const timeStr = log.time ? (() => {
                try { return new Date(log.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); } catch { return log.time; }
              })() : '—';
              const dateStr = log.time ? (() => {
                try { return new Date(log.time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); } catch { return ''; }
              })() : '';
              const isEven = i % 2 === 0;
              return (
                <tr key={`${log.id}-${i}`} style={{ borderBottom: '1px solid #f8fafc', background: isEven ? 'transparent' : '#fafbfc', transition: 'background 0.1s ease' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = isEven ? 'transparent' : '#fafbfc')}>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#334155' }}>{timeStr}</p>
                    {dateStr && <p style={{ margin: 0, fontSize: 10.5, color: '#94a3b8' }}>{dateStr}</p>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color, letterSpacing: '-0.02em', textShadow: `0 0 12px ${color}40` }}>{log.score}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>/100</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.bg, color: s.text, border: `1px solid ${s.border}`, boxShadow: `0 0 6px ${s.glow}` }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.text, flexShrink: 0 }} />
                      {log.level}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', minWidth: 100 }}>
                    <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', width: 80 }}>
                      <div style={{ height: '100%', width: `${log.score}%`, background: color, borderRadius: 99, boxShadow: `0 0 6px ${color}80` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!showAll && items.length > 15 && (
        <div style={{ textAlign: 'center', marginTop: 14, padding: '12px 0 0', borderTop: '1px solid #f1f5f9' }}>
          <button onClick={() => setShowAll(true)} style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
            + {items.length - 15} more entries
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function StationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [station, setStation] = useState<Station | null>(null);
  const [crowd, setCrowd]   = useState<{
    crowdScore?: number | null;
    crowd_score?: number | null;
    crowdLevel?: string;
    crowd_level?: string;
    recommendation?: string;
    data_source?: string;
    estimated_people?: number | null;
  } | null>(null);
  const [hourly, setHourly] = useState<HourlyPoint[]>([]);
  const [weekly, setWeekly] = useState<WeeklyPoint[]>([]);
  const [bestTime, setBestTime] = useState<BestTime | null>(null);
  const [logs, setLogs]     = useState<CrowdLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [wsLive, setWsLive] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    setError(null);
    try {
      const [stRes, crRes, hrRes, wkRes, btRes, lgRes] = await Promise.all([
        stationsApi.byId(id),
        crowdApi.now(id).catch(() => null),
        crowdApi.hourly(id).catch(() => null),
        crowdApi.weekly(id).catch(() => null),
        crowdApi.bestTime(id).catch(() => null),
        crowdLogsApi.get(id).catch(() => null),
      ]);

      const st = normalizeStation(stRes.data ?? stRes);
      if (!st) throw new Error('Station not found');
      setStation(st);

      const live = crRes ? unwrapOne<Record<string, unknown>>(crRes.data ?? crRes) : null;
      if (live) {
        const score = typeof live.crowd_score === 'number' ? live.crowd_score
          : typeof live.crowdScore === 'number' ? live.crowdScore : null;
        setCrowd({
          crowdScore: score,
          crowd_score: score,
          crowdLevel: typeof live.crowd_level === 'string' ? live.crowd_level : undefined,
          crowd_level: typeof live.crowd_level === 'string' ? live.crowd_level : undefined,
          recommendation: typeof live.recommendation === 'string' ? live.recommendation : undefined,
          data_source: typeof live.data_source === 'string' ? live.data_source : undefined,
          estimated_people: typeof live.estimated_people === 'number' ? live.estimated_people : undefined,
        });
      } else {
        setCrowd({
          crowdScore: st.crowdScore,
          crowd_score: st.crowdScore,
          crowdLevel: st.crowdLevel,
          crowd_level: st.crowdLevel,
          data_source: st.dataSource ?? st.data_source,
          estimated_people: st.estimatedPeople ?? st.estimated_people ?? undefined,
        });
      }

      setHourly(hrRes ? normalizeHourly(hrRes.data ?? hrRes) : []);
      setWeekly(wkRes ? normalizeWeekly(wkRes.data ?? wkRes) : []);
      setBestTime(btRes ? normalizeBestTime(btRes.data ?? btRes) : null);
      // Prefer newest logs; skip near-zero junk rows from older buggy samples
      const rawLogs = lgRes ? unwrapArray<CrowdLog>(lgRes.data ?? lgRes) : [];
      setLogs(rawLogs.filter((l) => {
        const s = typeof l.crowd_score === 'number' ? l.crowd_score : typeof l.crowdScore === 'number' ? l.crowdScore : null;
        return s == null || s > 5;
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load station');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  // Live WebSocket for this station: ws://host/ws/crowd/{id}
  useEffect(() => {
    if (!id) return;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(crowdWsUrl(id));
      } catch {
        retry = setTimeout(connect, 4000);
        return;
      }
      ws.onopen = () => setWsLive(true);
      ws.onclose = () => {
        setWsLive(false);
        if (!closed) retry = setTimeout(connect, 4000);
      };
      ws.onerror = () => { try { ws?.close(); } catch { /* ignore */ } };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const raw = msg?.station ?? (msg?.type === 'crowd_update' ? msg : null);
          const n = raw ? normalizeStation(raw) : null;
          if (!n) return;
          setCrowd({
            crowdScore: n.crowdScore,
            crowd_score: n.crowdScore,
            crowdLevel: n.crowdLevel,
            crowd_level: n.crowdLevel,
            recommendation: n.recommendation,
            data_source: n.dataSource ?? n.data_source,
            estimated_people: n.estimatedPeople ?? n.estimated_people ?? undefined,
          });
          setStation((prev) => prev ? { ...prev, ...n, name: n.name || prev.name } : n);
        } catch { /* ignore */ }
      };
    };
    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      if (ws) {
        ws.onclose = null;
        try { ws.close(); } catch { /* ignore */ }
      }
    };
  }, [id]);

  // ── Loading ──
  if (loading) return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '100px 0', gap: 18 }}>
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid #e2e8f0' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid transparent', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' }} />
        <Zap size={18} color="#3b82f6" style={{ position: 'absolute', inset: 0, margin: 'auto' }} />
      </div>
      <p style={{ color: '#64748b', fontSize: 14 }}>Loading station details…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error || !station) return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <button onClick={() => router.push('/crowd-monitor')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, fontWeight: 600, padding: 0, alignSelf: 'flex-start' }}>
        <ArrowLeft size={15} /> Back to Crowd Monitor
      </button>
      <div className="neon-card" style={{ padding: '48px 24px', textAlign: 'center', borderColor: 'rgba(239,68,68,0.2)', background: '#fef2f2' }}>
        <AlertCircle size={32} color="#ef4444" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Station not found</p>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: '6px 0 20px' }}>{error}</p>
        <button onClick={() => fetchAll()} className="btn-gradient" style={{ padding: '10px 28px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>Retry</button>
      </div>
    </div>
  );

  const scoreRaw = crowd?.crowdScore ?? crowd?.crowd_score ?? station.crowdScore ?? station.crowd_score;
  const score = typeof scoreRaw === 'number' ? scoreRaw : null;
  const level = (() => {
    const raw = crowd?.crowdLevel ?? crowd?.crowd_level ?? station.crowdLevel ?? station.crowd_level;
    if (raw && raw.toLowerCase() !== 'unavailable') return raw;
    return score != null ? getCrowdLevelFromScore(score) : 'Unavailable';
  })();
  const available = score != null && level.toLowerCase() !== 'unavailable';
  const s      = getCrowdStyle(level);
  const color  = getCrowdColor(level);
  const emoji  = getTypeEmoji(station.type);
  const typeLabel = getTypeLabel(station.type);
  const peakHours = station.peakHours ?? station.peak_hours;
  const dataSource = crowd?.data_source ?? station.dataSource ?? station.data_source;

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => router.push('/crowd-monitor')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, fontWeight: 600, padding: '7px 12px', borderRadius: 8, transition: 'all 0.15s ease' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#334155'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#64748b'; }}>
          <ArrowLeft size={15} /> Back to Crowd Monitor
        </button>
        <button onClick={() => fetchAll()} disabled={refreshing} className="btn-neon"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600, opacity: refreshing ? 0.6 : 1 }}>
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── Station Hero ── */}
      <div className="page-hero">
        <div style={{ position: 'relative', zIndex: 1 }}>

          {/* Header row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className={`icon-glow ${s.iconGlowClass}`} style={{ width: 60, height: 60, borderRadius: 18, fontSize: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {emoji}
              </div>
              <div>
                <h1 className="gradient-text-neon" style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.025em', margin: 0 }}>{station.name}</h1>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(148,163,184,0.8)', fontSize: 13 }}>
                    <MapPin size={13} />{station.city}{station.state ? `, ${station.state}` : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(148,163,184,0.7)', fontSize: 13 }}>
                    <Navigation size={13} />{typeLabel}
                  </div>
                  <code style={{ fontSize: 11, color: 'rgba(100,116,139,0.6)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
                    {station.id}
                  </code>
                </div>
              </div>
            </div>
            <CrowdBadge level={level} size="lg" />
          </div>

          {/* Live score panel */}
          <div className="glass-neon" style={{ borderRadius: 14, padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}`, animation: 'radium-pulse 2s ease-in-out infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.8)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                {wsLive ? 'Live Crowd Score · WS' : 'Live Crowd Score'}
              </span>
              <Wifi size={12} color={wsLive ? '#34d399' : 'rgba(100,116,139,0.5)'} style={{ marginLeft: 'auto' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 68, fontWeight: 900, color, letterSpacing: '-0.05em', lineHeight: 1, textShadow: `0 0 30px ${color}55` }}>
                {available ? score : '—'}
              </span>
              <div>
                <span style={{ fontSize: 20, color: 'rgba(148,163,184,0.5)', fontWeight: 300 }}>/100</span>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: s.text, fontWeight: 700 }}>
                  {available ? `${level} crowd density` : 'Crowd data unavailable'}
                </p>
                {dataSource && (
                  <p style={{ margin: '4px 0 0', fontSize: 10, color: 'rgba(148,163,184,0.55)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Source · {dataSource}
                  </p>
                )}
              </div>
            </div>
            {available && score != null && <CrowdScoreBar score={score} level={level} showLabel={false} height={10} />}
            {crowd?.recommendation && (
              <p style={{ margin: '12px 0 0', fontSize: 13, color: 'rgba(226,232,240,0.85)', lineHeight: 1.5 }}>{crowd.recommendation}</p>
            )}
            {available && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                {['0 Low', '25', '50 Moderate', '75', '100 Over'].map(t => (
                  <span key={t} style={{ fontSize: 9, color: 'rgba(100,116,139,0.45)', fontWeight: 500 }}>{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Info chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {[
              { Icon: Users, label: 'Capacity', value: station.capacity?.toLocaleString() },
              { Icon: Users, label: 'Est. people', value: (() => {
                const n = crowd?.estimated_people ?? station.estimatedPeople ?? station.estimated_people;
                return typeof n === 'number' ? n.toLocaleString() : null;
              })() },
              { Icon: Clock, label: 'Peak Hours', value: peakHours },
              { Icon: Navigation, label: 'Station Type', value: typeLabel },
            ].filter(x => x.value != null && x.value !== '').map(({ Icon, label, value }) => (
              <div key={label} className="glass-neon" style={{ borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 9 }}>
                <Icon size={14} color="rgba(148,163,184,0.7)" style={{ flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 9.5, color: 'rgba(100,116,139,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>{label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: 'rgba(241,245,249,0.9)', fontWeight: 600 }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <HourlyChart data={hourly} />
        <WeeklyChart data={weekly} />
      </div>

      {/* ── Best time ── */}
      {bestTime && <BestTimeCard data={bestTime} />}

      {/* ── Crowd logs ── */}
      {logs.length > 0 && <CrowdLogsTable logs={logs} />}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
