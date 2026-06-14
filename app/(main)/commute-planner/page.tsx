'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Clock, Star, TrendingUp, CalendarDays, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';

const LOCATIONS = [
  'Hitech City', 'Gachibowli', 'Banjara Hills', 'Jubilee Hills', 'Kondapur',
  'Madhapur', 'Miyapur', 'LB Nagar', 'Kukatpally', 'Secunderabad', 'Ameerpet',
];

const FORECAST_STUB = Array.from({ length: 24 }, (_, h) => ({
  hour: `${String(h).padStart(2, '0')}:00`,
  score: Math.round(30 + (h >= 8 && h <= 10 ? 55 : h >= 17 && h <= 20 ? 60 : h >= 22 || h <= 5 ? 0 : 15) + Math.random() * 10),
}));

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

interface DepartureAlert {
  id: string;
  route_name: string;
  origin: string;
  destination: string;
  departure_time: string;
  advance_notice_minutes: number;
  days_of_week: string[];
  is_active: boolean;
}

function barColor(score: number) {
  if (score >= 70) return '#ef4444';
  if (score >= 40) return '#f59e0b';
  return '#22c55e';
}

export default function CommutePlannerPage() {
  const [location, setLocation] = useState('Hitech City');
  const [forecast, setForecast] = useState(FORECAST_STUB);
  const [commuter, setCommuter] = useState({ score: 78, best_window: '07:15 – 07:45 AM', worst_window: '08:30 – 09:30 AM', avg_time: 24 });
  const [alerts, setAlerts] = useState<DepartureAlert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ route_name: '', origin: 'Miyapur', destination: 'Hitech City', departure_time: '08:30', advance_notice_minutes: 15, days_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] });

  const fetchData = useCallback(async () => {
    try {
      const [forecastRes, alertsRes, scoreRes] = await Promise.all([
        api.get(`/commute/forecast?location=${encodeURIComponent(location)}`),
        api.get('/alerts/departure'),
        api.get(`/commute/score?location=${encodeURIComponent(location)}`),
      ]);
      if (forecastRes.data?.hourly) setForecast(forecastRes.data.hourly);
      if (alertsRes.data?.alerts) setAlerts(alertsRes.data.alerts);
      if (scoreRes.data) setCommuter({
        score: scoreRes.data.score || 78,
        best_window: scoreRes.data.best_window || '07:15 – 07:45 AM',
        worst_window: scoreRes.data.worst_window || '08:30 – 09:30 AM',
        avg_time: scoreRes.data.avg_commute_minutes || 24,
      });
    } catch { /* use stubs */ }
  }, [location]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleAddAlert = async () => {
    try {
      const res = await api.post('/alerts/departure', form);
      setAlerts((prev) => [...prev, res.data]);
    } catch {
      setAlerts((prev) => [...prev, { ...form, id: Date.now().toString(), is_active: true }]);
    }
    setShowForm(false);
  };

  const handleDeleteAlert = async (id: string) => {
    try { await api.delete(`/alerts/departure/${id}`); } catch { /* ignore */ }
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleToggle = async (id: string) => {
    try { await api.put(`/alerts/departure/${id}/toggle`); } catch { /* ignore */ }
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, is_active: !a.is_active } : a));
  };

  const scoreColor = (s: number) => s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : '#ef4444';
  const scoreGlow  = (s: number) => s >= 80 ? 'rgba(16,185,129,0.4)' : s >= 60 ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)';
  const scoreIconClass = (s: number) => s >= 80 ? 'icon-glow-green' : s >= 60 ? 'icon-glow-orange' : 'icon-glow-red';

  return (
    <div className="space-y-6">

      {/* ── Page hero ──────────────────────────────── */}
      <div className="page-hero">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className="neon-badge-blue"
                style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99, letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                ● Smart Planner
              </span>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Commute Planner
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.9)', marginTop: 4 }}>
              Plan your daily commute and set departure alerts
            </p>
          </div>
          <div className="flex items-center gap-2" style={{ position: 'relative', zIndex: 1 }}>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg outline-none glass-neon"
              style={{ color: '#e2e8f0', background: 'rgba(15,23,42,0.6)' }}
            >
              {LOCATIONS.map((l) => <option key={l} style={{ background: '#0f172a' }}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Commute score + best departure */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger">
        {/* Score card */}
        <div className="neon-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className={`icon-glow ${scoreIconClass(commuter.score)}`} style={{ width: 32, height: 32 }}>
              <Star size={15} style={{ color: '#f59e0b' }} />
            </div>
            <h3 className="font-semibold text-sm" style={{ color: '#111827' }}>Commute Score</h3>
          </div>
          <p
            className="text-4xl font-bold mb-1"
            style={{ color: scoreColor(commuter.score), textShadow: `0 0 20px ${scoreGlow(commuter.score)}` }}
          >
            {commuter.score}
          </p>
          <p className="text-sm" style={{ color: '#9ca3af' }}>/100 for {location}</p>
          <div style={{ marginTop: 10, height: 4, borderRadius: 99, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div
              className={commuter.score >= 80 ? 'progress-neon-green' : commuter.score >= 60 ? 'progress-neon-orange' : 'progress-neon-red'}
              style={{ height: '100%', width: `${commuter.score}%`, transition: 'width 0.8s ease' }}
            />
          </div>
        </div>

        {/* Best departure window */}
        <div className="neon-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="icon-glow icon-glow-green" style={{ width: 32, height: 32 }}>
              <Clock size={15} style={{ color: '#10b981' }} />
            </div>
            <h3 className="font-semibold text-sm" style={{ color: '#111827' }}>Best Departure Window</h3>
          </div>
          <p className="text-xl font-bold mb-1" style={{ color: '#10b981', textShadow: '0 0 16px rgba(16,185,129,0.4)' }}>
            {commuter.best_window}
          </p>
          <p className="text-sm" style={{ color: '#9ca3af' }}>Lowest congestion window</p>
          <div style={{ marginTop: 10, height: 4, borderRadius: 99, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div className="progress-neon-green" style={{ height: '100%', width: '30%' }} />
          </div>
        </div>

        {/* Peak hours */}
        <div className="neon-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="icon-glow icon-glow-red" style={{ width: 32, height: 32 }}>
              <TrendingUp size={15} style={{ color: '#ef4444' }} />
            </div>
            <h3 className="font-semibold text-sm" style={{ color: '#111827' }}>Peak Hours</h3>
          </div>
          <p className="text-xl font-bold mb-1" style={{ color: '#ef4444', textShadow: '0 0 16px rgba(239,68,68,0.4)' }}>
            {commuter.worst_window}
          </p>
          <p className="text-sm" style={{ color: '#9ca3af' }}>Avg delay: +{commuter.avg_time} min</p>
          <div style={{ marginTop: 10, height: 4, borderRadius: 99, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div className="progress-neon-red" style={{ height: '100%', width: '85%' }} />
          </div>
        </div>
      </div>

      {/* 24h forecast */}
      <div className="neon-card p-5">
        <h3 className="font-semibold mb-1" style={{ color: '#111827' }}>
          24-Hour Rush Forecast — <span className="gradient-text">{location}</span>
        </h3>
        <p className="text-sm mb-4" style={{ color: '#9ca3af' }}>Congestion score by hour (higher = worse)</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={forecast} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={3} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: 8,
                fontSize: 12,
                color: '#f1f5f9',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              }}
              formatter={(v) => [`${v}`, 'Congestion Score'] as [string, string]}
            />
            <Bar dataKey="score" radius={[3, 3, 0, 0]}>
              {forecast.map((entry, i) => (
                <Cell key={i} fill={barColor(entry.score)} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Departure alerts */}
      <div className="neon-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
          <div className="flex items-center gap-2">
            <div className="icon-glow icon-glow-blue" style={{ width: 30, height: 30 }}>
              <CalendarDays size={14} color="#3b82f6" />
            </div>
            <h3 className="font-semibold text-sm" style={{ color: '#111827' }}>Departure Alerts</h3>
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
                <input
                  value={form.route_name}
                  onChange={(e) => setForm({ ...form, route_name: e.target.value })}
                  placeholder="e.g. Morning Commute"
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ borderColor: '#d1d5db' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Departure Time</label>
                <input
                  type="time"
                  value={form.departure_time}
                  onChange={(e) => setForm({ ...form, departure_time: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ borderColor: '#d1d5db' }}
                />
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
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Days of Week</label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setForm((f) => ({
                      ...f,
                      days_of_week: f.days_of_week.includes(d) ? f.days_of_week.filter((x) => x !== d) : [...f.days_of_week, d],
                    }))}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-colors ${form.days_of_week.includes(d) ? 'btn-gradient' : 'btn-neon'}`}
                    style={{ color: form.days_of_week.includes(d) ? '#fff' : '#3b82f6' }}
                  >
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddAlert} className="btn-gradient px-4 py-2 rounded-lg text-sm font-semibold">
                Save Alert
              </button>
              <button onClick={() => setShowForm(false)} className="btn-neon px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#3b82f6' }}>
                Cancel
              </button>
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
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm" style={{ color: '#111827' }}>{alert.route_name}</p>
                    {!alert.is_active && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: '#f3f4f6', color: '#9ca3af' }}
                      >
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: '#6b7280' }}>
                    {alert.origin} → {alert.destination} · {alert.departure_time} · {alert.advance_notice_minutes}min notice
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {alert.days_of_week?.map((d) => (
                      <span
                        key={d}
                        className="neon-badge-blue text-xs px-1.5 py-0.5 rounded capitalize"
                      >
                        {d.slice(0, 3)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(alert.id)}
                    className="relative w-9 h-5 rounded-full transition-colors"
                    style={{
                      background: alert.is_active ? '#22c55e' : '#d1d5db',
                      boxShadow: alert.is_active ? '0 0 8px rgba(34,197,94,0.5)' : 'none',
                    }}
                  >
                    <span
                      className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                      style={{ left: alert.is_active ? '18px' : '2px' }}
                    />
                  </button>
                  <button
                    onClick={() => handleDeleteAlert(alert.id)}
                    className="transition-colors"
                    style={{ color: '#d1d5db' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#d1d5db')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
