'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Clock, Star, TrendingUp, CalendarDays, Plus, Trash2, Navigation,
  Zap, RefreshCw,
} from 'lucide-react';
import { alertApi, commuteApi } from '@/lib/api';
import type {
  CommuteBestTimeData,
  CommuteDepartureSlot,
  CommuteForecastData,
  CommuteScoreData,
  CommuteShouldLeaveData,
  DepartureAlert,
} from '@/lib/types';

const LOCATIONS = [
  'Hyderabad', 'Hitech City', 'Gachibowli', 'Banjara Hills', 'Jubilee Hills', 'Kondapur',
  'Madhapur', 'Miyapur', 'LB Nagar', 'Kukatpally', 'Secunderabad', 'Ameerpet',
  'Silk Board', 'Silk Board, Bangalore', 'Marathahalli', 'Whitefield', 'Koramangala',
  'MG Road, Bengaluru', 'Bengaluru', 'Mumbai', 'Pune', 'Chennai', 'Delhi',
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function congToScore(level?: string) {
  const l = (level || '').toLowerCase();
  if (l === 'high' || l === 'critical') return 85;
  if (l === 'medium' || l === 'moderate') return 55;
  if (l === 'low') return 22;
  return 40;
}

function congColor(level?: string) {
  const l = (level || '').toLowerCase();
  if (l === 'high' || l === 'critical') return '#ef4444';
  if (l === 'medium' || l === 'moderate') return '#f59e0b';
  return '#22c55e';
}

function barColor(score: number) {
  if (score >= 70) return '#ef4444';
  if (score >= 40) return '#f59e0b';
  return '#22c55e';
}

function scoreColor(s: number) {
  if (s >= 80) return '#10b981';
  if (s >= 60) return '#f59e0b';
  return '#ef4444';
}

function apiError(e: unknown) {
  const err = e as { response?: { data?: { error?: string; detail?: string } }; message?: string };
  const detail = err.response?.data?.detail;
  return err.response?.data?.error || (typeof detail === 'string' ? detail : undefined) || err.message || 'Request failed';
}

function formatTrigger(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function normalizeAlert(raw: DepartureAlert | Record<string, unknown>): DepartureAlert {
  const r = raw as DepartureAlert;
  return {
    ...r,
    id: String(r.id),
    route_name: String(r.route_name ?? ''),
    origin: String(r.origin ?? ''),
    destination: String(r.destination ?? ''),
    departure_time: String(r.departure_time ?? ''),
    days: Array.isArray(r.days) ? r.days.map(String) : undefined,
    days_of_week: Array.isArray(r.days_of_week) ? r.days_of_week.map(String) : [],
    advance_notice_minutes: Number(r.advance_notice_minutes ?? 15),
    distance_km: r.distance_km == null ? null : Number(r.distance_km),
    is_active: Boolean(r.is_active),
    timezone: r.timezone || 'Asia/Kolkata',
    next_trigger_at: r.next_trigger_at ?? null,
  };
}

export default function CommutePlannerPage() {
  const [location, setLocation] = useState('Hyderabad');
  const [distanceKm, setDistanceKm] = useState('29');
  const [leaveOrigin, setLeaveOrigin] = useState('Silk Board, Bangalore');
  const [leaveDest, setLeaveDest] = useState('Hyderabad');

  const [forecast, setForecast] = useState<CommuteForecastData | null>(null);
  const [chartRows, setChartRows] = useState<Array<{ hour: string; score: number; congestion?: string }>>([]);
  const [bestTime, setBestTime] = useState<CommuteBestTimeData | null>(null);
  const [score, setScore] = useState<CommuteScoreData | null>(null);
  const [commuteScore, setCommuteScore] = useState<CommuteScoreData | null>(null);
  const [shouldLeave, setShouldLeave] = useState<CommuteShouldLeaveData | null>(null);

  const [alerts, setAlerts] = useState<DepartureAlert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [alertBusy, setAlertBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({
    route_name: 'Morning Commute',
    origin: 'Gachibowli',
    destination: 'Hitech City',
    departure_time: '08:30',
    advance_notice_minutes: 15,
    days_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    mode: 'driving',
  });
  const [loading, setLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [error, setError] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const dist = Number(distanceKm) || undefined;
      const [forecastRes, alertsRes, scoreRes, bestTimeRes, commuteScoreRes] = await Promise.allSettled([
        commuteApi.forecast(location),
        alertApi.list(),
        commuteApi.score(location),
        commuteApi.bestTime({ location, distance_km: dist, mode: 'driving', window_hours: 6 }),
        commuteApi.commuteScore(location),
      ]);

      if (forecastRes.status === 'fulfilled') {
        const data = forecastRes.value.data;
        setForecast(data);
        if (Array.isArray(data.hourly) && data.hourly.length) {
          setChartRows(data.hourly.map((h) => ({ hour: h.hour, score: h.score })));
        } else if (Array.isArray(data.hourly_forecast)) {
          setChartRows(
            data.hourly_forecast.map((h) => ({
              hour: h.time_label,
              score: congToScore(h.predicted_congestion),
              congestion: h.predicted_congestion,
            })),
          );
        }
      }

      if (scoreRes.status === 'fulfilled') setScore(scoreRes.value.data);
      if (commuteScoreRes.status === 'fulfilled') setCommuteScore(commuteScoreRes.value.data);
      if (bestTimeRes.status === 'fulfilled') setBestTime(bestTimeRes.value.data);

      if (alertsRes.status === 'fulfilled') {
        setAlerts(alertsRes.value.data.alerts.map(normalizeAlert));
      } else if (alertsRes.status === 'rejected') {
        setError(apiError(alertsRes.reason));
      }
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [location, distanceKm]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchData(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  const checkShouldLeave = async () => {
    if (!leaveOrigin.trim() || !leaveDest.trim()) return;
    setLeaveLoading(true);
    try {
      const res = await commuteApi.shouldILeave({
        origin: leaveOrigin.trim(),
        destination: leaveDest.trim(),
        distance_km: Number(distanceKm) || 10,
        mode: 'driving',
      });
      setShouldLeave(res.data);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLeaveLoading(false);
    }
  };

  const handleAddAlert = async () => {
    if (!form.route_name.trim() || form.days_of_week.length === 0) {
      setError('Route name and at least one day are required.');
      return;
    }
    setAlertBusy(true);
    setError('');
    try {
      const res = await alertApi.create({
        route_name: form.route_name.trim(),
        origin: form.origin,
        destination: form.destination,
        departure_time: form.departure_time,
        days_of_week: form.days_of_week,
        advance_notice_minutes: Number(form.advance_notice_minutes) || 15,
        mode: form.mode,
      });
      const created = normalizeAlert(res.data);
      setAlerts((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
      showToast(res.data.message || `Alert set — notified ${created.advance_notice_minutes} min before ${created.departure_time}`);
      setShowForm(false);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setAlertBusy(false);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    setAlertBusy(true);
    setError('');
    try {
      const res = await alertApi.delete(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      showToast(res.data.message || 'Alert deleted');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setAlertBusy(false);
    }
  };

  const handleToggle = async (id: string) => {
    setAlertBusy(true);
    setError('');
    try {
      const res = await alertApi.toggle(id);
      setAlerts((prev) => prev.map((a) => (
        a.id === id
          ? {
              ...a,
              is_active: res.data.is_active,
              next_trigger_at: res.data.next_trigger_at ?? (res.data.is_active ? a.next_trigger_at : null),
            }
          : a
      )));
      showToast(res.data.message || (res.data.is_active ? 'Alert enabled' : 'Alert disabled'));
    } catch (e) {
      setError(apiError(e));
    } finally {
      setAlertBusy(false);
    }
  };

  const displayScore = score?.score ?? commuteScore?.score ?? null;
  const grade = score?.grade ?? commuteScore?.grade;
  const verdict = score?.verdict ?? commuteScore?.verdict;
  const bestWindow = score?.best_window
    || bestTime?.top_3_recommended_departures?.[0]?.departure_time
    || forecast?.best_departure_next_8h?.time_label
    || '—';
  const worstWindow = score?.worst_window
    || forecast?.peak_congestion_hour?.time_label
    || '—';
  const topSlots: CommuteDepartureSlot[] = bestTime?.top_3_recommended_departures ?? [];

  return (
    <div className="space-y-6">
      <div className="page-hero">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="neon-badge-blue" style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                ● Smart Planner
              </span>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Commute Planner
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.9)', marginTop: 4 }}>
              Rush-hour forecast, best departure windows, scores &amp; leave-now advice
            </p>
          </div>
          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg outline-none"
              style={{ color: '#0f172a', background: '#fff', border: '1px solid #e2e8f0' }}
            >
              {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
            </select>
            <input
              type="number"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              title="Distance for best-time ETAs"
              placeholder="km"
              style={{ width: 72, padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
            />
            <button
              onClick={() => void fetchData()}
              disabled={loading}
              className="btn-neon flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ color: '#2563eb' }}
            >
              <RefreshCw size={13} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}

      {toast && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', fontSize: 13, fontWeight: 600 }}>
          {toast}
        </div>
      )}

      {/* Score cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger">
        <div className="neon-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="icon-glow icon-glow-orange" style={{ width: 32, height: 32 }}>
              <Star size={15} style={{ color: '#f59e0b' }} />
            </div>
            <h3 className="font-semibold text-sm" style={{ color: '#111827' }}>Commute Score</h3>
          </div>
          <p className="text-4xl font-bold mb-1" style={{ color: displayScore == null ? '#94a3b8' : scoreColor(displayScore) }}>
            {displayScore == null ? '—' : Math.round(displayScore)}
            {grade && <span style={{ fontSize: 16, marginLeft: 8, color: '#64748b' }}>{grade}</span>}
          </p>
          <p className="text-sm" style={{ color: '#9ca3af' }}>{verdict || `Score for ${location}`}</p>
          {(score?.message || commuteScore?.message) && (
            <p className="text-xs mt-2" style={{ color: '#f59e0b' }}>{score?.message || commuteScore?.message}</p>
          )}
        </div>

        <div className="neon-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="icon-glow icon-glow-green" style={{ width: 32, height: 32 }}>
              <Clock size={15} style={{ color: '#10b981' }} />
            </div>
            <h3 className="font-semibold text-sm" style={{ color: '#111827' }}>Best Window</h3>
          </div>
          <p className="text-xl font-bold mb-1" style={{ color: '#10b981' }}>{bestWindow}</p>
          <p className="text-sm" style={{ color: '#9ca3af' }}>
            {forecast?.best_departure_next_8h
              ? `${forecast.best_departure_next_8h.predicted_congestion} · conf ${Math.round((forecast.best_departure_next_8h.confidence_score || 0) * 100)}%`
              : 'Lowest congestion window'}
          </p>
        </div>

        <div className="neon-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="icon-glow icon-glow-red" style={{ width: 32, height: 32 }}>
              <TrendingUp size={15} style={{ color: '#ef4444' }} />
            </div>
            <h3 className="font-semibold text-sm" style={{ color: '#111827' }}>Peak / Worst</h3>
          </div>
          <p className="text-xl font-bold mb-1" style={{ color: '#ef4444' }}>{worstWindow}</p>
          <p className="text-sm" style={{ color: '#9ca3af' }}>
            {score?.avg_commute_minutes != null
              ? `Avg commute ~${score.avg_commute_minutes} min`
              : forecast?.peak_congestion_hour
                ? `Peak ${forecast.peak_congestion_hour.predicted_congestion}`
                : 'Highest congestion window'}
          </p>
        </div>
      </div>

      {/* Forecast chart */}
      <div className="neon-card p-5">
        <h3 className="font-semibold mb-1" style={{ color: '#111827' }}>
          24-Hour Rush Forecast — <span className="gradient-text">{location}</span>
        </h3>
        <p className="text-sm mb-4" style={{ color: '#9ca3af' }}>
          Congestion by hour (levels vary — empty samples no longer flatten to “all low”)
        </p>
        {chartRows.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13 }}>No forecast points yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartRows} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, fontSize: 12, color: '#f1f5f9' }}
                formatter={(v, _n, item) => {
                  const c = (item?.payload as { congestion?: string })?.congestion;
                  return [`${v}${c ? ` (${c})` : ''}`, 'Congestion'] as [string, string];
                }}
              />
              <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                {chartRows.map((entry, i) => (
                  <Cell key={i} fill={barColor(entry.score)} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Best departure slots */}
      <div className="neon-card p-5">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div>
            <h3 className="font-semibold text-sm" style={{ color: '#111827' }}>Best departure times</h3>
            <p className="text-xs" style={{ color: '#94a3b8', marginTop: 2 }}>
              ETAs by congestion class · {bestTime?.distance_km ?? distanceKm} km · {bestTime?.mode || 'driving'}
            </p>
          </div>
        </div>
        {topSlots.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>No recommended slots yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {topSlots.map((slot, idx) => (
              <div
                key={`${slot.departure_time}-${idx}`}
                style={{
                  padding: 14, borderRadius: 12,
                  border: idx === 0 ? '1.5px solid rgba(16,185,129,0.35)' : '1px solid #e2e8f0',
                  background: idx === 0 ? 'rgba(16,185,129,0.04)' : '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#0f172a' }}>{slot.departure_time}</p>
                  {idx === 0 && <Chip label="Best" color="#16a34a" />}
                </div>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
                  {Number(slot.estimated_eta_minutes).toFixed(0)}
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}> min</span>
                </p>
                <p style={{ margin: '4px 0 8px', fontSize: 11, color: '#94a3b8' }}>
                  buffer {Number(slot.estimated_eta_with_buffer_minutes ?? slot.estimated_eta_minutes).toFixed(0)} min
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Chip label={slot.predicted_congestion} color={congColor(slot.predicted_congestion)} />
                  <Chip label={`${Math.round(slot.confidence_score * 100)}% conf`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Should I leave */}
      <div className="neon-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="icon-glow icon-glow-blue" style={{ width: 32, height: 32 }}>
            <Zap size={15} color="#3b82f6" />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: '#111827' }}>Should I leave?</h3>
            <p className="text-xs" style={{ color: '#94a3b8' }}>Intercity trips get a clear leave-when-ready reason</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Origin
            <input
              value={leaveOrigin}
              onChange={(e) => setLeaveOrigin(e.target.value)}
              list="commute-locations"
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
            />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Destination
            <input
              value={leaveDest}
              onChange={(e) => setLeaveDest(e.target.value)}
              list="commute-locations"
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
            />
          </label>
          <datalist id="commute-locations">
            {LOCATIONS.map((l) => <option key={l} value={l} />)}
          </datalist>
          <button
            onClick={() => void checkShouldLeave()}
            disabled={leaveLoading}
            className="btn-gradient px-4 py-2 rounded-xl text-sm font-semibold self-end"
          >
            {leaveLoading ? 'Checking…' : 'Check'}
          </button>
        </div>

        {shouldLeave && (
          <div style={{
            padding: 16, borderRadius: 14,
            background: shouldLeave.is_intercity || shouldLeave.advice === 'leave_now'
              ? 'rgba(59,130,246,0.06)'
              : 'rgba(16,185,129,0.06)',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <Navigation size={14} color="#3b82f6" />
              <p style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: 14 }}>
                {shouldLeave.origin} → {shouldLeave.destination}
              </p>
              {shouldLeave.is_intercity && <Chip label="Intercity" color="#2563eb" />}
              {shouldLeave.advice && <Chip label={shouldLeave.advice.replace(/_/g, ' ')} color="#0ea5e9" />}
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{shouldLeave.reason}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Chip label={`${shouldLeave.distance_km ?? '—'} km`} />
              <Chip label={`Now ${Number(shouldLeave.current_eta_minutes ?? 0).toFixed(0)} min`} />
              <Chip label={`Optimal ${Number(shouldLeave.optimal_eta_minutes ?? 0).toFixed(0)} min`} />
              <Chip label={`Save ${Number(shouldLeave.savings_minutes ?? 0).toFixed(0)} min`} />
            </div>
          </div>
        )}
      </div>

      {/* Departure alerts */}
      <div className="neon-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
          <div className="flex items-center gap-2">
            <div className="icon-glow icon-glow-blue" style={{ width: 30, height: 30 }}>
              <CalendarDays size={14} color="#3b82f6" />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: '#111827', margin: 0 }}>Departure Alerts</h3>
              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>Asia/Kolkata · WebSocket push before leave time</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="btn-gradient flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <Plus size={13} />
            Add Alert
          </button>
        </div>

        {showForm && (
          <div className="p-5" style={{ borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
            <h4 className="font-semibold text-sm mb-3" style={{ color: '#111827' }}>New Departure Alert</h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Route Name</label>
                <input value={form.route_name} onChange={(e) => setForm({ ...form, route_name: e.target.value })} placeholder="e.g. Morning Commute" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: '#d1d5db' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Departure Time (IST)</label>
                <input type="time" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: '#d1d5db' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>From</label>
                <select value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: '#d1d5db' }}>
                  {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>To</label>
                <select value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: '#d1d5db' }}>
                  {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Notice (minutes)</label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={form.advance_notice_minutes}
                  onChange={(e) => setForm({ ...form, advance_notice_minutes: Number(e.target.value) || 15 })}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ borderColor: '#d1d5db' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Mode</label>
                <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: '#d1d5db' }}>
                  <option value="driving">Driving</option>
                  <option value="transit">Transit</option>
                  <option value="walking">Walking</option>
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Days (Mon–Sun accepted)</label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      days_of_week: f.days_of_week.includes(d) ? f.days_of_week.filter((x) => x !== d) : [...f.days_of_week, d],
                    }))}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${form.days_of_week.includes(d) ? 'btn-gradient' : 'btn-neon'}`}
                    style={{ color: form.days_of_week.includes(d) ? '#fff' : '#3b82f6' }}
                  >
                    {DAY_SHORT[i]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button disabled={alertBusy} onClick={() => void handleAddAlert()} className="btn-gradient px-4 py-2 rounded-lg text-sm font-semibold">
                {alertBusy ? 'Saving…' : 'Save Alert'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-neon px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#3b82f6' }}>Cancel</button>
            </div>
          </div>
        )}

        {alerts.length === 0 && !showForm ? (
          <div className="px-5 py-10 text-center">
            <div className="icon-glow icon-glow-blue mx-auto mb-3" style={{ width: 48, height: 48 }}>
              <CalendarDays size={22} color="#3b82f6" />
            </div>
            <p className="text-sm" style={{ color: '#9ca3af' }}>No departure alerts yet. Add one to get notified before peak hours.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {alerts.map((alert) => {
              const dayLabel = (alert.days?.length ? alert.days : alert.days_of_week.map((d) => d.slice(0, 3))).join(', ');
              const trigger = formatTrigger(alert.next_trigger_at);
              return (
                <div key={alert.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="font-semibold text-sm" style={{ color: '#111827', margin: 0 }}>{alert.route_name}</p>
                      {!alert.is_active && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f3f4f6', color: '#9ca3af' }}>Paused</span>
                      )}
                      {alert.distance_km != null && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#eff6ff', color: '#2563eb' }}>
                          {alert.distance_km} km
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: '#6b7280', margin: '2px 0 0' }}>
                      {alert.origin} → {alert.destination} · {alert.departure_time} IST · {alert.advance_notice_minutes}min notice
                    </p>
                    <p className="text-xs" style={{ color: '#94a3b8', margin: '2px 0 0' }}>
                      {dayLabel}
                      {trigger ? ` · next ${trigger}` : alert.is_active ? '' : ' · no trigger while paused'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={alertBusy}
                      onClick={() => void handleToggle(alert.id)}
                      className="relative w-9 h-5 rounded-full transition-colors"
                      style={{ background: alert.is_active ? '#22c55e' : '#d1d5db', opacity: alertBusy ? 0.6 : 1 }}
                      title={alert.is_active ? 'Disable' : 'Enable'}
                    >
                      <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" style={{ left: alert.is_active ? '18px' : '2px' }} />
                    </button>
                    <button
                      disabled={alertBusy}
                      onClick={() => void handleDeleteAlert(alert.id)}
                      style={{ color: '#d1d5db', background: 'none', border: 'none', cursor: 'pointer' }}
                      title="Delete alert"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Chip({ label, color = '#64748b' }: { label: string; color?: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
      color, background: `${color}14`, border: `1px solid ${color}33`, textTransform: 'capitalize',
    }}>
      {label}
    </span>
  );
}
