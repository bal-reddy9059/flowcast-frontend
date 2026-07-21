'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Search, X, RefreshCw, MapPin, Clock,
  ArrowRight, Radio, AlertCircle, Bus, Train,
  Activity, Zap,
} from 'lucide-react';
import { stationsApi, crowdApi } from '@/lib/api';
import {
  Station, getCrowdColor, getCrowdStyle, getCrowdLevelFromScore,
  getTypeEmoji, getTypeLabel,
  normalizeStations, isCrowdAvailable, applyCrowdWsUpdate, crowdWsUrl,
} from '@/lib/crowdHelpers';
import CrowdBadge from '@/components/crowd/CrowdBadge';
import CrowdScoreBar from '@/components/crowd/CrowdScoreBar';

const REFRESH_INTERVAL = 30;

// ── Refresh Countdown Ring ────────────────────────────────────────────────────

function RefreshRing({ seconds, total, onRefresh }: { seconds: number; total: number; onRefresh: () => void }) {
  const R = 17, C = 2 * Math.PI * R;
  const pct = seconds / total;
  const color = seconds <= 8 ? '#ef4444' : seconds <= 15 ? '#f97316' : '#3b82f6';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px 7px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
        <svg style={{ transform: 'rotate(-90deg)', width: 40, height: 40 }} viewBox="0 0 40 40">
          <circle cx="20" cy="20" r={R} fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
          <circle cx="20" cy="20" r={R} fill="none" stroke={color}
            strokeWidth="3.5" strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }} />
        </svg>
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color }}>{seconds}</span>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 9.5, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Auto-refresh</p>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#334155' }}>in {seconds}s</p>
      </div>
      <button onClick={onRefresh} title="Refresh now" style={{ marginLeft: 4, padding: 6, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', color: '#64748b', display: 'flex', transition: 'all 0.15s ease' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#3b82f6'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}>
        <RefreshCw size={14} />
      </button>
    </div>
  );
}

// ── Station Card ──────────────────────────────────────────────────────────────

function StationCard({ station, index }: { station: Station; index: number }) {
  const router = useRouter();
  const available = isCrowdAvailable(station);
  const score = available ? (station.crowdScore as number) : null;
  const level = station.crowdLevel ?? (score != null ? getCrowdLevelFromScore(score) : 'Unavailable');
  const s = getCrowdStyle(level);
  const color = getCrowdColor(level);
  const emoji = getTypeEmoji(station.type);
  const typeLabel = getTypeLabel(station.type);
  const peakHours = station.peakHours ?? station.peak_hours;
  const source = station.dataSource ?? station.data_source;

  return (
    <article
      className="neon-card card-hover"
      style={{ padding: 0, cursor: 'pointer', overflow: 'hidden', animationDelay: `${index * 0.05}s` }}
      onClick={() => router.push(`/crowd-monitor/station/${station.id}`)}
    >
      {/* Crowd-level colour bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${color}, ${color}80)`, boxShadow: `0 2px 8px ${color}60` }} />

      <div style={{ padding: '18px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Station header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <div className={`icon-glow ${s.iconGlowClass}`}
              style={{ width: 46, height: 46, borderRadius: 13, fontSize: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {emoji}
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                {station.name}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <MapPin size={11} color="#94a3b8" />
                <span style={{ fontSize: 11.5, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {station.city}{station.state ? `, ${station.state}` : ''}
                </span>
              </div>
            </div>
          </div>
          <CrowdBadge level={level} />
        </div>

        {/* Live score */}
        <div style={{ padding: '14px 16px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
            <span style={{ fontSize: 44, fontWeight: 900, color, letterSpacing: '-0.04em', lineHeight: 1, textShadow: `0 0 24px ${color}40` }}>
              {score != null ? score : '—'}
            </span>
            <div>
              <span style={{ fontSize: 15, color: '#94a3b8', fontWeight: 400 }}>/100</span>
              <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 600, color: s.text }}>
                {available ? `${level} crowd` : 'No live score'}
              </p>
            </div>
          </div>
          {score != null && <CrowdScoreBar score={score} level={level} showLabel={false} height={6} />}
          {source && (
            <p style={{ margin: '8px 0 0', fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Source · {source}
            </p>
          )}
        </div>

        {/* Info chips */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { icon: Users, label: 'Capacity', value: station.capacity ? `${station.capacity.toLocaleString()}` : null },
            { icon: Clock, label: 'Peak Hours', value: peakHours ?? null },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 10 }}>
              <Icon size={13} color="#94a3b8" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value ?? '—'}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: 6 }}>
            {typeLabel}
          </span>
          <button
            onClick={e => { e.stopPropagation(); router.push(`/crowd-monitor/station/${station.id}`); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(59,130,246,0.08)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.16)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)'; }}
          >
            View Details <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}

// ── City Overview Strip ───────────────────────────────────────────────────────

function CityStrip({ stations }: { stations: Station[] }) {
  const cities = Array.from(new Set(stations.map(s => s.city).filter(Boolean))).slice(0, 6);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
      {cities.map(city => {
        const cs = stations.filter(s => (s.city ?? '').toLowerCase() === city.toLowerCase());
        if (!cs.length) return null;
        const scored = cs.filter(isCrowdAvailable);
        const avg = scored.length
          ? Math.round(scored.reduce((a, s) => a + (s.crowdScore ?? 0), 0) / scored.length)
          : 0;
        const level = scored.length ? getCrowdLevelFromScore(avg) : 'Unavailable';
        const color = getCrowdColor(level);
        const s = getCrowdStyle(level);
        const busCount = cs.filter(x => (x.type ?? '').toLowerCase() === 'bus').length;
        const railCount = cs.filter(x => (x.type ?? '').toLowerCase().includes('rail')).length;

        return (
          <div key={city} className="neon-card" style={{ padding: '18px 22px', background: s.bg, borderColor: s.border }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{city}</p>
                <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#64748b' }}>
                  {cs.length} stations · {busCount > 0 ? `🚌 ${busCount} bus` : ''} {railCount > 0 ? `🚆 ${railCount} rail` : ''}
                </p>
              </div>
              <CrowdBadge level={level} size="md" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
              <span style={{ fontSize: 38, fontWeight: 900, color, letterSpacing: '-0.03em', lineHeight: 1, textShadow: `0 0 20px ${color}40` }}>
                {scored.length ? avg : '—'}
              </span>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>/100 avg</span>
            </div>
            {scored.length > 0 && <CrowdScoreBar score={avg} level={level} showLabel={false} height={5} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CrowdMonitorPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'bus' | 'railway'>('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [wsLive, setWsLive] = useState(false);

  const fetchingRef = useRef(false);

  const fetchData = useCallback(async (silent = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (!silent) setRefreshing(true);
    setError(null);
    try {
      // The crowd endpoint now includes station metadata. Only call /stations
      // when the primary source is unavailable, avoiding duplicate cold-cache work.
      let liveList: Station[] = [];
      let primaryError: unknown = null;
      try {
        const response = await crowdApi.allNow();
        liveList = normalizeStations(response.data ?? response);
      } catch (err) {
        primaryError = err;
      }
      if (liveList.length) {
        setStations(liveList);
      } else {
        try {
          const response = await stationsApi.list();
          const stationMeta = normalizeStations(response.data ?? response);
          if (stationMeta.length) setStations(stationMeta);
          else setError('Failed to load crowd data');
        } catch (fallbackError) {
          const reason = primaryError instanceof Error ? primaryError : fallbackError;
          setError(reason instanceof Error ? reason.message : 'Failed to load crowd data');
        }
      }

      setLastUpdated(new Date());
      setCountdown(REFRESH_INTERVAL);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch station data');
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchData(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  // Live WebSocket: ws://host/ws/crowd
  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(crowdWsUrl());
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
          if (msg?.type === 'crowd_update' || Array.isArray(msg?.stations)) {
            setStations((prev) => applyCrowdWsUpdate(prev, msg));
            setLastUpdated(new Date());
            setCountdown(REFRESH_INTERVAL);
          }
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
  }, []);

  // HTTP poll as backup (slower when WS is live)
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          void fetchData(true);
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [fetchData]);

  const filtered = stations.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      (s.name ?? '').toLowerCase().includes(q) ||
      (s.city ?? '').toLowerCase().includes(q) ||
      (s.id ?? '').toLowerCase().includes(q);
    const t = (s.type ?? '').toLowerCase();
    const matchType =
      typeFilter === 'all' ||
      (typeFilter === 'bus' && t === 'bus') ||
      (typeFilter === 'railway' && (t.includes('rail') || t.includes('train')));
    const matchCity =
      cityFilter === 'all' ||
      (s.city ?? '').toLowerCase() === cityFilter.toLowerCase();
    return matchSearch && matchType && matchCity;
  });

  const total = stations.length;
  const lowCount = stations.filter(s => s.crowdLevel === 'Low').length;
  const moderateCount = stations.filter(s => s.crowdLevel === 'Moderate').length;
  const highCount = stations.filter(s => s.crowdLevel === 'High').length;
  const overcrowdedCount = stations.filter(s => s.crowdLevel === 'Overcrowded').length;
  const cityOptions = Array.from(new Set(stations.map(s => s.city).filter(Boolean))).sort();

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero ── */}
      <div className="page-hero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 800, padding: '4px 12px', borderRadius: 99, background: wsLive ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: wsLive ? '#34d399' : '#fbbf24', border: `1px solid ${wsLive ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`, letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: wsLive ? '#10b981' : '#f59e0b', animation: 'pulse-dot 1.5s ease-in-out infinite', display: 'inline-block' }} />
                  {wsLive ? 'Live WS' : 'Polling'} — refreshes every {REFRESH_INTERVAL}s
                </span>
              </div>
              <h1 className="gradient-text-neon" style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
                Crowd Monitor
              </h1>
              <p style={{ fontSize: 13.5, color: 'rgba(148,163,184,0.85)', marginTop: 6, maxWidth: 520 }}>
                Live TomTom/HERE crowd when available — otherwise IST time-of-day baseline across major Indian stations.
              </p>
              {lastUpdated && (
                <p style={{ fontSize: 11, color: 'rgba(100,116,139,0.65)', marginTop: 5 }}>
                  Updated {lastUpdated.toLocaleTimeString('en-IN', { hour12: true })}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Quick level pills */}
              {!loading && !error && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Low', count: lowCount, color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' },
                    { label: 'Moderate', count: moderateCount, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' },
                    { label: 'High', count: highCount, color: '#f97316', bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.3)' },
                    { label: 'Overcrowded', count: overcrowdedCount, color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)' },
                  ].map(({ label, count, color, bg, border }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: bg, border: `1px solid ${border}`, borderRadius: 99 }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color }}>{count}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color, opacity: 0.8 }}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => fetchData()} disabled={refreshing} className="btn-neon"
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, opacity: refreshing ? 0.6 : 1 }}>
                <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── City Overview ── */}
      {!loading && !error && stations.length > 0 && <CityStrip stations={stations} />}

      {/* ── Controls ── */}
      <div className="neon-card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input type="text" placeholder="Search station or city…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '9px 34px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: 13, color: '#334155', outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s ease' }}
              onFocus={e => { e.target.style.borderColor = 'rgba(59,130,246,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; e.target.style.background = '#fff'; }}
              onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#f8fafc'; }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: '#e2e8f0', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <X size={10} />
              </button>
            )}
          </div>

          {/* Type pills */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {([
              { value: 'all' as const, label: 'All', icon: Activity },
              { value: 'bus' as const, label: '🚌 Bus', icon: Bus },
              { value: 'railway' as const, label: '🚆 Railway', icon: Train },
            ]).map(({ value, label }) => {
              const active = typeFilter === value;
              return (
                <button key={value} onClick={() => setTypeFilter(value)} style={{ padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease', border: active ? '1.5px solid #3b82f6' : '1.5px solid #e2e8f0', background: active ? '#3b82f6' : '#fff', color: active ? '#fff' : '#64748b', boxShadow: active ? '0 4px 12px rgba(59,130,246,0.2)' : 'none' }}>
                  {label}
                </button>
              );
            })}
          </div>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: 9, border: '1.5px solid #e2e8f0', color: '#64748b', fontSize: 12 }}>
            <option value="all">All cities</option>
            {Array.from(new Set([
              'Bangalore', 'Hyderabad', 'Mumbai', 'Delhi', 'Chennai', 'Kolkata',
              'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Bhopal', 'Surat',
              ...cityOptions,
            ])).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {!loading && !error && <RefreshRing seconds={countdown} total={REFRESH_INTERVAL} onRefresh={() => fetchData()} />}
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', gap: 16 }}>
          <div style={{ position: 'relative', width: 52, height: 52 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid #e2e8f0' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid transparent', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' }} />
            <Zap size={16} color="#3b82f6" style={{ position: 'absolute', inset: 0, margin: 'auto' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#334155', fontSize: 14, fontWeight: 600, margin: 0 }}>Fetching live crowd data…</p>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0 0' }}>Connecting to {total || 6} stations</p>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div className="neon-card" style={{ padding: '48px 24px', textAlign: 'center', border: '1px solid rgba(239,68,68,0.2)', background: '#fef2f2' }}>
          <div style={{ width: 56, height: 56, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <AlertCircle size={24} color="#ef4444" />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Could not load stations</p>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '6px 0 20px' }}>{error}</p>
          <button onClick={() => fetchData()} className="btn-gradient" style={{ padding: '10px 28px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
            Try Again
          </button>
        </div>
      )}

      {/* ── Grid ── */}
      {!loading && !error && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Radio size={13} color="#94a3b8" />
            <p style={{ margin: 0, fontSize: 12.5, color: '#94a3b8' }}>
              Showing <strong style={{ color: '#334155' }}>{filtered.length}</strong> of <strong style={{ color: '#334155' }}>{total}</strong> stations
            </p>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <p style={{ fontSize: 40, margin: '0 0 12px' }}>🔍</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#334155', margin: 0 }}>No stations match</p>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0' }}>Try a different search or filter</p>
            </div>
          ) : (
            <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
              {filtered.map((s, i) => <StationCard key={s.id} station={s} index={i} />)}
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
