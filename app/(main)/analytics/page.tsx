'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Activity, TrendingUp, MapPin, Zap, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import api from '@/lib/api';
import { generateTrendData } from '@/lib/utils';

/* ─── Stubs ──────────────────────────────────────────────────────── */
const CITY_HEALTH_STUB = [
  { city: 'Bengaluru', score: 92, trend: 3  },
  { city: 'Chennai',   score: 87, trend: -1 },
  { city: 'Pune',      score: 84, trend: 2  },
  { city: 'Hyderabad', score: 79, trend: -2 },
  { city: 'Ahmedabad', score: 76, trend: 1  },
  { city: 'Mumbai',    score: 68, trend: -4 },
  { city: 'Delhi',     score: 61, trend: -3 },
  { city: 'Kolkata',   score: 73, trend: 2  },
];

const HOURLY_STUB = Array.from({ length: 24 }, (_, h) => ({
  hour: `${String(h).padStart(2, '0')}:00`,
  weekday: Math.round(30 + (h >= 8 && h <= 10 ? 45 : h >= 17 && h <= 20 ? 50 : 0) + Math.random() * 10),
  weekend: Math.round(20 + (h >= 11 && h <= 14 ? 30 : 0) + Math.random() * 10),
}));

/* ─── Helpers ───────────────────────────────────────────────────── */
function healthPalette(score: number) {
  if (score >= 80) return { bar: '#10b981', bg: 'rgba(16,185,129,0.08)', text: '#10b981', border: 'rgba(16,185,129,0.2)', progressClass: 'progress-neon-green', iconClass: 'icon-glow-green' };
  if (score >= 60) return { bar: '#f59e0b', bg: 'rgba(245,158,11,0.08)', text: '#f59e0b', border: 'rgba(245,158,11,0.2)',  progressClass: 'progress-neon-orange', iconClass: 'icon-glow-orange' };
  return              { bar: '#ef4444', bg: 'rgba(239,68,68,0.08)',  text: '#ef4444', border: 'rgba(239,68,68,0.2)',   progressClass: 'progress-neon-red',    iconClass: 'icon-glow-red'    };
}

/* ─── KPI card ─────────────────────────────────────────────────── */
interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  iconClass: string;
  change?: string;
  changeUp?: boolean;
}
function KpiCard({ label, value, sub, icon, iconClass, change, changeUp }: KpiCardProps) {
  return (
    <div className="neon-card" style={{ padding: '18px 20px' }}>
      <div className="flex items-start justify-between mb-4">
        <div className={`icon-glow ${iconClass}`} style={{ width: 42, height: 42 }}>
          {icon}
        </div>
        {change && (
          <div
            className="flex items-center gap-0.5"
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: changeUp ? '#10b981' : '#ef4444',
              padding: '3px 8px',
              borderRadius: 99,
              background: changeUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${changeUp ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              boxShadow: changeUp ? '0 0 8px rgba(16,185,129,0.2)' : '0 0 8px rgba(239,68,68,0.2)',
            }}
          >
            {changeUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {change}
          </div>
        )}
      </div>
      <p className="gradient-text" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b', marginTop: 4 }}>{sub}</p>
      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{label}</p>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const [trendData, setTrendData] = useState(generateTrendData());
  const [cityHealth, setCityHealth] = useState(CITY_HEALTH_STUB);
  const [snapshot, setSnapshot] = useState({
    total_records: 48200,
    avg_congestion: 0.42,
    high_congestion_count: 127,
    active_incidents: 24,
    city_health_score: 78,
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [snapRes, trendRes, healthRes] = await Promise.all([
        api.get('/analytics/snapshot'),
        api.get('/analytics/trends'),
        api.get('/analytics/city-health'),
      ]);
      if (snapRes.data) setSnapshot(prev => ({ ...prev, ...snapRes.data }));
      if (trendRes.data?.data_points) {
        setTrendData(trendRes.data.data_points.map((p: { hour: number; congestion_level: number; vehicle_count: number }) => ({
          time:       `${String(p.hour).padStart(2, '0')}:00`,
          congestion: Math.round((p.congestion_level ?? 0) * 100),
          vehicles:   p.vehicle_count ?? 0,
        })));
      }
      if (healthRes.data?.cities) setCityHealth(healthRes.data.cities);
    } catch {
      setTrendData(generateTrendData());
    } finally {
      setIsLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  const kpis: KpiCardProps[] = [
    {
      label: 'Last 24 hours',
      value: snapshot.total_records.toLocaleString(),
      sub: 'Traffic Records',
      icon: <Activity size={18} color="#3b82f6" />,
      iconClass: 'icon-glow-blue',
      change: '+12%',
      changeUp: true,
    },
    {
      label: 'Network-wide average',
      value: `${(snapshot.avg_congestion * 100).toFixed(0)}%`,
      sub: 'Avg Congestion',
      icon: <TrendingUp size={18} color="#f59e0b" />,
      iconClass: 'icon-glow-orange',
      change: '+3%',
      changeUp: false,
    },
    {
      label: 'Active right now',
      value: snapshot.high_congestion_count.toString(),
      sub: 'High Congestion Zones',
      icon: <MapPin size={18} color="#ef4444" />,
      iconClass: 'icon-glow-red',
      change: '−8',
      changeUp: true,
    },
    {
      label: 'All cities combined',
      value: `${snapshot.city_health_score}`,
      sub: 'City Health Score',
      icon: <Zap size={18} color="#10b981" />,
      iconClass: 'icon-glow-green',
      change: '+2 pts',
      changeUp: true,
    },
  ];

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page hero ──────────────────────────────── */}
      <div className="page-hero">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className="neon-badge-blue"
                style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99, letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                ● Live
              </span>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Analytics
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.9)', marginTop: 4 }}>
              Network-wide traffic intelligence and trends
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="btn-neon flex items-center gap-2"
            style={{
              padding: '8px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            <RefreshCw
              size={13}
              style={{ animation: isLoading ? 'spin 0.8s linear infinite' : 'none' }}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI grid ─────────────────────────────────── */}
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {kpis.map((kpi) => <KpiCard key={kpi.sub} {...kpi} />)}
      </div>

      {/* ── Charts row ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* 24h Trend */}
        <div className="neon-card" style={{ padding: '20px 22px' }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em', marginBottom: 4 }}>
            24-Hour Congestion Trend
          </h3>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>
            Average congestion level across all monitored nodes
          </p>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="vehiclesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#10b981" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 10.5, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={3} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10.5, fill: '#94a3b8' }}
                tickLine={false} axisLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickLine={false} axisLine={false}
                tickFormatter={(v) => `${v}`}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: 10,
                  fontSize: 12,
                  color: '#f1f5f9',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3), 0 0 20px rgba(59,130,246,0.1)',
                }}
                labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                formatter={(v, name) =>
                  name === 'congestion'
                    ? [`${v}%`, 'Congestion']
                    : [`${v}`, 'Vehicles']
                }
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                formatter={(value) => <span style={{ color: '#64748b', fontSize: 11 }}>{value === 'congestion' ? 'Congestion %' : 'Vehicle Count'}</span>}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="congestion"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#analyticsGrad)"
                dot={false}
                activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="vehicles"
                stroke="#10b981"
                strokeWidth={1.5}
                fill="url(#vehiclesGrad)"
                dot={false}
                strokeDasharray="4 2"
                activeDot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Weekday vs Weekend */}
        <div className="neon-card" style={{ padding: '20px 22px' }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em', marginBottom: 4 }}>
            Weekday vs Weekend
          </h3>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>Average congestion by hour of day</p>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={HOURLY_STUB} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fontSize: 10.5, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: 10,
                  fontSize: 12,
                  color: '#f1f5f9',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3), 0 0 20px rgba(59,130,246,0.1)',
                }}
                labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(value) => (
                  <span style={{ color: '#64748b', fontSize: 12 }}>{value}</span>
                )}
              />
              <Bar dataKey="weekday" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Weekday" maxBarSize={14} />
              <Bar dataKey="weekend" fill="#a5b4fc" radius={[3, 3, 0, 0]} name="Weekend" maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── City health grid ──────────────────────────── */}
      <div className="neon-card" style={{ padding: '20px 22px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
              City Health Scores
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              Real-time liveability index for major metros
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: '#94a3b8', fontSize: 11.5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px rgba(16,185,129,0.6)' }} /> Healthy ≥80
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b', display: 'inline-block', boxShadow: '0 0 6px rgba(245,158,11,0.6)' }} /> Fair 60–79
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', display: 'inline-block', boxShadow: '0 0 6px rgba(239,68,68,0.6)' }} /> Poor &lt;60
            </span>
          </div>
        </div>

        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {cityHealth.map(({ city, score, trend }) => {
            const p = healthPalette(score);
            return (
              <div
                key={city}
                className="card-hover"
                style={{
                  borderRadius: 14,
                  padding: '16px',
                  background: p.bg,
                  border: `1px solid ${p.border}`,
                  boxShadow: `0 0 12px ${p.bg}`,
                }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{city}</p>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      fontSize: 11,
                      fontWeight: 700,
                      color: trend > 0 ? '#10b981' : '#ef4444',
                      padding: '2px 7px',
                      borderRadius: 99,
                      background: trend > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                      border: `1px solid ${trend > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      boxShadow: trend > 0 ? '0 0 6px rgba(16,185,129,0.2)' : '0 0 6px rgba(239,68,68,0.2)',
                    }}
                  >
                    {trend > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    {Math.abs(trend)}
                  </span>
                </div>

                <p style={{ fontSize: 32, fontWeight: 800, color: p.text, letterSpacing: '-0.03em', lineHeight: 1, textShadow: `0 0 20px ${p.text}40` }}>
                  {Math.round(score)}
                </p>
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>/ 100 health index</p>

                <div
                  style={{
                    marginTop: 12,
                    height: 6,
                    borderRadius: 99,
                    background: 'rgba(0,0,0,0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    className={p.progressClass}
                    style={{
                      height: '100%',
                      width: `${Math.min(100, score)}%`,
                      transition: 'width 0.8s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
