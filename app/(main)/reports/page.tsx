'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FileBarChart, TrendingUp, TrendingDown, BarChart2, MapPin, Truck, Calendar, Download, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, AreaChart, Area } from 'recharts';
import { reportsApi } from '@/lib/api';
import type { ScheduledReport } from '@/lib/types';

type DailyChartRow = { hour: string; congestion: number; volume: number };
type WeeklyChartRow = { day: string; avg_cong: number; incidents: number; peak_hour: string };
type HotspotChartRow = { area: string; severity: number; city: string; incidents: number };
type FleetChartRow = {
  vehicle: string;
  trips: number;
  distance: number;
  avg_speed: number;
  fuel_used: number;
  efficiency: string;
};

type TabType = 'daily' | 'weekly' | 'hotspots' | 'fleet';

const EFF_COLOR: Record<string, string> = { A: '#22c55e', B: '#f59e0b', C: '#ef4444' };

export default function ReportsPage() {
  const [tab,           setTab]          = useState<TabType>('daily');
  const [location,      setLocation]     = useState('Mumbai');
  const [loading,       setLoading]      = useState(false);
  const [dailyData,     setDailyData]    = useState<DailyChartRow[]>([]);
  const [weeklyData,    setWeeklyData]   = useState<WeeklyChartRow[]>([]);
  const [hotspotData,   setHotspotData]  = useState<HotspotChartRow[]>([]);
  const [fleetData,     setFleetData]    = useState<FleetChartRow[]>([]);
  const [fleetTotals,   setFleetTotals]  = useState<{ trips: number; distance: number; fuel: number } | null>(null);
  const [apiSummary,    setApiSummary]   = useState<{ peakToday: number; avgToday: number; totalVolume: number; weekAvg: number } | null>(null);
  const [apiComparison, setApiComparison] = useState<{ vsYesterday: string; vsLastWeek: string; peakShift: string; incidentsToday: number } | null>(null);
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [reportError, setReportError] = useState('');
  const requestIdRef = useRef(0);

  const loadReport = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setReportError('');
    setApiSummary(null);
    setApiComparison(null);
    try {
      if (tab === 'daily') {
        const r = await reportsApi.daily(location);
        if (requestId !== requestIdRef.current) return;
        // Drop hours with no data (data_points === 0 → all fields null)
        const rows = r.data.hourly_breakdown.filter((d) => d.data_points > 0);
        if (requestId === requestIdRef.current) {
          setDailyData(rows.map((d) => {
            // congestion arrives as string ("low"/"medium"/"high") or number
            const rawCong = d.congestion ?? 0;
            const cong =
              rawCong === 'high'   ? 85 :
              rawCong === 'medium' ? 55 :
              rawCong === 'low'    ? 25 :
              typeof rawCong === 'number' ? Math.round(rawCong * (rawCong > 1 ? 1 : 100)) : 0;
            return {
              hour:       d.time_label,
              congestion: cong,
              volume:     d.avg_vehicles ?? 0,
            };
          }));
        }
      } else if (tab === 'weekly') {
        const r = await reportsApi.weekly(location);
        if (requestId !== requestIdRef.current) return;
        const rows = r.data.days;
        if (requestId === requestIdRef.current) {
          setWeeklyData(rows.map((d) => {
            return {
              day:       d.day_label,
              avg_cong:  Math.round(d.avg_congestion_pct),
              incidents: d.incidents,
              peak_hour: d.peak_hour ?? '--:--',
            };
          }));
        }
        // Extract top-level summary and comparison blocks
        const s = r.data.summary;
        if (s) {
          setApiSummary({
            peakToday:   Math.round(s.peak_today_pct ?? 0),
            avgToday:    Math.round(s.avg_today_pct  ?? 0),
            totalVolume: s.total_volume ?? 0,
            weekAvg:     Math.round(s.week_avg_pct   ?? 0),
          });
        }
        if (r.data.vs_yesterday != null || r.data.vs_last_week != null) {
          const rd = r.data;
          setApiComparison({
            vsYesterday:    String(rd.vs_yesterday   ?? '+0.0%'),
            vsLastWeek:     String(rd.vs_last_week   ?? '-0.0%'),
            peakShift:      String(rd.peak_shift     ?? '--:--'),
            incidentsToday: Number(rd.incidents_today ?? 0),
          });
        }
      } else if (tab === 'hotspots') {
        const r = await reportsApi.hotspots();
        if (requestId !== requestIdRef.current) return;
        const rows = r.data.hotspots;
        if (requestId === requestIdRef.current) {
          setHotspotData(rows.map((h) => ({
            area:      String(h.area ?? h.location ?? h.district ?? h.name ?? ''),
            city:      String(h.city ?? h.state ?? ''),
            // congestion_pct = medium+high combined (bar chart metric)
            severity:  Math.round(Number(h.congestion_pct ?? h.high_congestion_pct ?? h.severity ?? 0)),
            incidents: Number(h.incidents ?? h.incident_count ?? 0),
          })));
        }
      } else if (tab === 'fleet') {
        const r = await reportsApi.fleetOverview();
        if (requestId !== requestIdRef.current) return;
        const rows = r.data.vehicles;
        if (requestId === requestIdRef.current) {
          setFleetData(rows.map((f) => ({
            vehicle:    f.registration,
            trips:      f.trips,
            distance:   Math.round(f.total_distance_km),
            avg_speed:  Math.round(f.avg_speed_kmh),
            fuel_used:  Math.round(f.fuel_used_liters),
            efficiency: f.efficiency_grade,
          })));
        }
        const t = r.data.totals;
        if (t) {
          setFleetTotals({
            trips:    t.trips    ?? 0,
            distance: Math.round(t.distance_km ?? 0),
            fuel:     Math.round(t.fuel_liters ?? 0),
          });
        }
        const s = r.data.summary;
        if (s) {
          setApiSummary({
            peakToday:   Math.round(s.peak_today_pct ?? 0),
            avgToday:    Math.round(s.avg_today_pct  ?? 0),
            totalVolume: s.total_volume ?? 0,
            weekAvg:     Math.round(s.week_avg_pct   ?? 0),
          });
        }
        const rd = r.data;
        if (rd.vs_yesterday != null || rd.vs_last_week != null) {
          setApiComparison({
            vsYesterday:    String(rd.vs_yesterday   ?? '+0.0%'),
            vsLastWeek:     String(rd.vs_last_week   ?? '-0.0%'),
            peakShift:      String(rd.peak_shift     ?? '--:--'),
            incidentsToday: Number(rd.incidents_today ?? 0),
          });
        }
      }
    } catch (error) {
      if (requestId === requestIdRef.current) {
        const timedOut = error instanceof Error && error.message.toLowerCase().includes('timeout');
        setReportError(timedOut ? 'Report request exceeded 4 seconds.' : 'Unable to load this report.');
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [tab, location]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadReport(); }, [loadReport]);
  useEffect(() => {
    // Defer schedule list so it doesn't contend with the main report fetch / Fast Refresh
    const t = window.setTimeout(() => {
      void reportsApi.scheduled().then((res) => {
        setSchedules(res.data.reports);
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, []);

  const peakCong = apiSummary?.peakToday   ?? (dailyData.length ? Math.max(...dailyData.map((d) => d.congestion)) : 0);
  const avgCong  = apiSummary?.avgToday    ?? (dailyData.length ? Math.round(dailyData.reduce((a, d) => a + d.congestion, 0) / dailyData.length) : 0);
  const totalVol = apiSummary?.totalVolume ?? dailyData.reduce((a, d) => a + d.volume, 0);
  const weekAvg  = apiSummary?.weekAvg     ?? (weeklyData.length ? Math.round(weeklyData.reduce((a, d) => a + d.avg_cong, 0) / weeklyData.length) : 0);

  return (
    <div className="space-y-5" style={{ maxWidth: 1020 }}>

      {/* ── Page Hero ─────────────────────────────── */}
      <div className="page-hero" style={{ marginBottom: 0 }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="icon-glow icon-glow-green" style={{ width: 52, height: 52 }}>
              <FileBarChart size={26} color="#34d399" />
            </div>
            <div>
              <h1 className="gradient-text-neon" style={{ fontWeight: 800, fontSize: 22, margin: 0 }}>Traffic Reports</h1>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 3 }}>Daily, weekly, hotspot &amp; fleet performance analytics</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            {[{ l: 'Peak Today', v: `${peakCong}%` }, { l: 'Avg Today', v: `${avgCong}%` }, { l: 'Total Volume', v: totalVol.toLocaleString() }, { l: 'Week Avg', v: `${weekAvg}%` }].map(({ l, v }) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <p className="gradient-text-animated" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{v}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 3 }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Controls ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
          {([
            { key: 'daily',    label: 'Daily',    Icon: Calendar  },
            { key: 'weekly',   label: 'Weekly',   Icon: BarChart2 },
            { key: 'hotspots', label: 'Hotspots', Icon: MapPin    },
            { key: 'fleet',    label: 'Fleet',    Icon: Truck     },
          ] as { key: TabType; label: string; Icon: React.ElementType }[]).map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: 'pointer', border: 'none', transition: 'all 0.15s', background: tab === key ? '#fff' : 'transparent', color: tab === key ? '#059669' : '#64748b', boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(tab === 'daily' || tab === 'weekly') && (
            <select value={location} onChange={(e) => setLocation(e.target.value)}
              style={{ fontSize: 13, borderRadius: 9, padding: '7px 12px', border: '1.5px solid #e5e7eb', color: '#374151', background: '#fff', fontWeight: 600 }}>
              {['Mumbai', 'Bengaluru', 'Delhi', 'Chennai', 'Hyderabad', 'Pune'].map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
          <button onClick={() => void loadReport()} className="btn-gradient"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, fontWeight: 700, fontSize: 13, opacity: loading ? 0.7 : 1 }}>
            {loading ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />} Refresh
          </button>
          <button className="btn-neon" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, fontWeight: 700, fontSize: 13 }}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>
      {reportError && (
        <div role="alert" style={{ padding: '10px 14px', borderRadius: 10, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12 }}>
          {reportError}
        </div>
      )}
      <div className="neon-card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>Scheduled reports: {schedules.length}</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => void reportsApi.schedule({
              name: `${location} daily summary`,
              report_type: 'daily_summary',
              location,
              schedule: 'daily',
            }).then(() => reportsApi.scheduled()).then((res) => setSchedules(res.data.reports))}
            style={{ fontSize: 11, color: '#3b82f6' }}
          >
            Schedule daily
          </button>
          {schedules[0] && <button onClick={() => void reportsApi.deleteSchedule(schedules[0].id).then(() => setSchedules((items) => items.slice(1)))} style={{ fontSize: 11, color: '#ef4444' }}>Delete schedule</button>}
        </span>
      </div>

      {/* ── Daily tab ────────────────────────────────────── */}
      {tab === 'daily' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div className="neon-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <div className="icon-glow icon-glow-green" style={{ width: 26, height: 26 }}>
                <TrendingUp size={13} color="#34d399" />
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Hourly Congestion — {location}</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="congGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} formatter={(v) => [`${v}%`, 'Congestion']} />
                <Area type="monotone" dataKey="congestion" stroke="#059669" strokeWidth={2} fill="url(#congGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="neon-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <div className="icon-glow icon-glow-blue" style={{ width: 26, height: 26 }}>
                <BarChart2 size={13} color="#60a5fa" />
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Hourly Traffic Volume</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} formatter={(v) => [v, 'Vehicles']} />
                <Bar dataKey="volume" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Weekly tab ───────────────────────────────────── */}
      {tab === 'weekly' && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 18 }}>
          <div className="neon-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <div className="icon-glow icon-glow-green" style={{ width: 26, height: 26 }}>
                <BarChart2 size={13} color="#34d399" />
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>7-Day Congestion Trend — {location}</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} formatter={(v) => [`${v}%`, 'Avg Congestion']} />
                <Line type="monotone" dataKey="avg_cong" stroke="#059669" strokeWidth={2.5} dot={{ fill: '#059669', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="neon-card" style={{ padding: '18px 20px' }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 12 }}>Weekly Summary</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Day', 'Avg', 'Incidents', 'Peak'].map((h) => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeklyData.map((d) => (
                  <tr key={d.day} style={{ borderTop: '1px solid #f9fafb' }}>
                    <td style={{ padding: '8px 8px', fontSize: 12, fontWeight: 600, color: '#111827' }}>{d.day}</td>
                    <td style={{ padding: '8px 8px', fontSize: 12 }}>
                      <span style={{ color: d.avg_cong > 75 ? '#ef4444' : d.avg_cong > 60 ? '#f59e0b' : '#22c55e', fontWeight: 700 }}>{d.avg_cong}%</span>
                    </td>
                    <td style={{ padding: '8px 8px', fontSize: 12, color: '#374151' }}>{d.incidents}</td>
                    <td style={{ padding: '8px 8px', fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{d.peak_hour}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Hotspots tab ─────────────────────────────────── */}
      {tab === 'hotspots' && (
        <div className="neon-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="icon-glow icon-glow-red" style={{ width: 28, height: 28 }}>
              <MapPin size={13} color="#f87171" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Top Congestion Hotspots</span>
          </div>
          <div style={{ padding: '18px 20px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hotspotData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} domain={[0, 100]} unit="%" />
                <YAxis type="category" dataKey="area" tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false} width={120} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} formatter={(v) => [`${v}%`, 'Severity']} />
                <Bar dataKey="severity" fill="#ef4444" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, marginTop: 16 }}>
              {hotspotData.map((h, i) => (
                <div key={h.area} className="neon-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `hsl(${Math.round((1-h.severity/100)*120)},70%,90%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: `hsl(${Math.round((1-h.severity/100)*120)},60%,35%)` }}>#{i+1}</div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 12, color: '#111827', margin: 0 }}>{h.area}</p>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{h.city} · {h.incidents} incidents</p>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: h.severity > 80 ? '#ef4444' : h.severity > 65 ? '#f59e0b' : '#22c55e' }}>{h.severity}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Fleet tab ────────────────────────────────────── */}
      {tab === 'fleet' && (
        <div className="neon-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="icon-glow icon-glow-green" style={{ width: 28, height: 28 }}>
              <Truck size={13} color="#34d399" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Fleet Performance Report</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                {['Vehicle', 'Trips', 'Distance', 'Avg Speed', 'Fuel Used', 'Efficiency'].map((h) => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fleetData.map((f) => (
                <tr key={f.vehicle} style={{ borderBottom: '1px solid #f9fafb', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>{f.vehicle}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#374151' }}>{f.trips}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#374151' }}>{f.distance} km</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#374151' }}>{f.avg_speed} km/h</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#374151' }}>{f.fuel_used} L</td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 99, background: `${EFF_COLOR[f.efficiency]}20`, color: EFF_COLOR[f.efficiency], boxShadow: `0 0 8px ${EFF_COLOR[f.efficiency]}40` }}>{f.efficiency}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 20px', background: 'rgba(59,130,246,0.02)', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 24 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Total trips: <strong style={{ color: '#111827' }}>{fleetTotals?.trips    ?? fleetData.reduce((a, f) => a + f.trips,    0)}</strong></span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Total distance: <strong style={{ color: '#111827' }}>{fleetTotals?.distance ?? fleetData.reduce((a, f) => a + f.distance, 0)} km</strong></span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Total fuel: <strong style={{ color: '#111827' }}>{fleetTotals?.fuel     ?? fleetData.reduce((a, f) => a + f.fuel_used, 0)} L</strong></span>
          </div>
        </div>
      )}

      {/* ── Trend indicator row ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {([
          { label: 'vs Yesterday',    val: apiComparison?.vsYesterday   ?? '+4.2%', up: apiComparison ? apiComparison.vsYesterday.startsWith('+')   : true  },
          { label: 'vs Last Week',    val: apiComparison?.vsLastWeek    ?? '-8.1%', up: apiComparison ? apiComparison.vsLastWeek.startsWith('+')    : false },
          { label: 'Peak Shift',      val: apiComparison?.peakShift     ?? '18:00', up: null },
          { label: 'Incidents Today', val: apiComparison ? String(apiComparison.incidentsToday) : '17', up: null },
        ] as { label: string; val: string; up: boolean | null }[]).map(({ label, val, up }) => (
          <div key={label} className="neon-card" style={{ padding: '14px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: up === true ? '#ef4444' : up === false ? '#22c55e' : '#111827', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {up === true && <TrendingUp size={16} color="#ef4444" />}
              {up === false && <TrendingDown size={16} color="#22c55e" />}
              {val}
            </p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>{label}</p>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
