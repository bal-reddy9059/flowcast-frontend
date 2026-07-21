'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Hexagon, Plus, Trash2, AlertTriangle, CheckCircle2,
  MapPin, Bell, ShieldAlert, X, Activity, RefreshCw, Gauge,
} from 'lucide-react';
import { zonesApi } from '@/lib/api';
import type { GeofenceZone, ZoneAlertItem, ZoneMonitoredLocation } from '@/lib/types';

interface ZoneView {
  id: string;
  name: string;
  type: 'circle' | 'polygon';
  city: string;
  radius_km: number;
  threshold: number;
  threshold_label: string;
  breaches_today: number;
  status: 'active' | 'paused';
  lat: number;
  lng: number;
  created_at: string;
  health_score?: number | null;
  is_breached: boolean;
  dominant_congestion?: string;
  avg_speed_kmh?: number | null;
  has_data?: boolean;
  monitored_locations: ZoneMonitoredLocation[];
  lat_min?: number;
  lat_max?: number;
  lng_min?: number;
  lng_max?: number;
}

interface ZoneAlertView {
  zone_name: string;
  message: string;
  time_label: string;
  severity: 'high' | 'medium' | 'low';
  triggered_at: string;
  avg_speed_kmh?: number | null;
}

const THRESHOLD_NUM: Record<string, number> = { low: 0.3, medium: 0.6, high: 0.85 };
const CONGESTION_LEVEL: Record<string, number> = { low: 0, medium: 1, high: 2, unknown: -1 };

const SEV = {
  high: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.22)', color: '#b91c1c', Icon: ShieldAlert },
  medium: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)', color: '#b45309', Icon: AlertTriangle },
  low: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.22)', color: '#15803d', Icon: CheckCircle2 },
};

/** Worse of stored label vs speed — mirrors backend fix */
function congestionFromSpeed(speed?: number | null): string | null {
  if (speed == null || Number.isNaN(Number(speed))) return null;
  if (speed <= 25) return 'high';
  if (speed <= 60) return 'medium';
  return 'low';
}

function effectiveCongestion(stored?: string | null, speed?: number | null): string {
  const storedLvl = stored && CONGESTION_LEVEL[stored] != null ? stored : null;
  const speedLvl = congestionFromSpeed(speed);
  if (storedLvl && speedLvl) {
    return (CONGESTION_LEVEL[speedLvl] ?? 0) > (CONGESTION_LEVEL[storedLvl] ?? 0) ? speedLvl : storedLvl;
  }
  return storedLvl || speedLvl || 'unknown';
}

const CITY_BOUNDS: Record<string, { lat_min: number; lat_max: number; lng_min: number; lng_max: number }> = {
  Hyderabad: { lat_min: 17.44, lat_max: 17.455, lng_min: 78.385, lng_max: 78.4 },
  Mumbai: { lat_min: 18.92, lat_max: 19.08, lng_min: 72.82, lng_max: 72.92 },
  Bengaluru: { lat_min: 12.93, lat_max: 13.02, lng_min: 77.55, lng_max: 77.65 },
  Delhi: { lat_min: 28.58, lat_max: 28.68, lng_min: 77.15, lng_max: 77.28 },
  Chennai: { lat_min: 13.04, lat_max: 13.12, lng_min: 80.22, lng_max: 80.30 },
  Pune: { lat_min: 18.48, lat_max: 18.56, lng_min: 73.80, lng_max: 73.90 },
};

function apiError(e: unknown) {
  const err = e as { response?: { data?: { error?: string; detail?: string } }; message?: string };
  return err.response?.data?.error || err.response?.data?.detail || err.message || 'Zone request failed';
}

function normaliseZone(raw: GeofenceZone | Record<string, unknown>): ZoneView {
  const r = raw as GeofenceZone & Record<string, unknown>;
  const isCircle = r.zone_type === 'circle' || r.shape_label === 'circle';
  let lat: number;
  let lng: number;
  let radius_km: number;

  if (r.radius_km != null) {
    radius_km = Number(r.radius_km);
    lat = Number(r.center_lat ?? ((Number(r.lat_min ?? 20) + Number(r.lat_max ?? 21)) / 2));
    lng = Number(r.center_lng ?? ((Number(r.lng_min ?? 78) + Number(r.lng_max ?? 79)) / 2));
  } else if (isCircle) {
    lat = Number(r.center_lat ?? 20.5);
    lng = Number(r.center_lng ?? 78.9);
    radius_km = 5;
  } else {
    lat = (Number(r.lat_min ?? 20) + Number(r.lat_max ?? 21)) / 2;
    lng = (Number(r.lng_min ?? 78) + Number(r.lng_max ?? 79)) / 2;
    const latKm = (Number(r.lat_max ?? 21) - Number(r.lat_min ?? 20)) * 111;
    const lngKm = (Number(r.lng_max ?? 79) - Number(r.lng_min ?? 78)) * 111 * Math.cos((lat * Math.PI) / 180);
    radius_km = Math.max(0.1, Math.round((Math.sqrt(latKm * latKm + lngKm * lngKm) / 2) * 10) / 10);
  }

  const threshLabel = String(r.congestion_threshold ?? r.threshold ?? 'medium');
  const threshold = r.threshold_pct != null ? Number(r.threshold_pct) / 100 : (THRESHOLD_NUM[threshLabel] ?? 0.6);
  const avgSpeed = r.avg_speed_kmh != null ? Number(r.avg_speed_kmh) : null;
  const apiCongestion = String(r.current_congestion ?? r.dominant_congestion ?? '');
  const dominant = effectiveCongestion(apiCongestion || null, avgSpeed);
  const breached = typeof r.threshold_breached === 'boolean'
    ? r.threshold_breached
    : (dominant !== 'unknown' && (CONGESTION_LEVEL[dominant] ?? 0) >= (CONGESTION_LEVEL[threshLabel] ?? 1));

  const locations = (r.monitored_locations ?? []).map((loc) => ({
    ...loc,
    congestion: effectiveCongestion(loc.congestion ?? loc.stored_congestion, loc.speed_kmh),
  }));

  return {
    id: String(r.id ?? r.zone_id),
    name: String(r.name ?? r.zone_name ?? 'Zone'),
    type: r.shape_label === 'polygon' || !isCircle ? 'polygon' : 'circle',
    city: String(r.city || 'India'),
    radius_km,
    threshold,
    threshold_label: threshLabel,
    breaches_today: Number(r.breaches_today ?? 0),
    status: r.is_active === false ? 'paused' : 'active',
    lat,
    lng,
    created_at: String(r.created_at ?? new Date().toISOString()),
    health_score: r.health_score ?? undefined,
    dominant_congestion: dominant === 'unknown' ? undefined : dominant,
    is_breached: breached,
    avg_speed_kmh: avgSpeed,
    has_data: r.has_data,
    monitored_locations: locations,
    lat_min: r.lat_min != null ? Number(r.lat_min) : undefined,
    lat_max: r.lat_max != null ? Number(r.lat_max) : undefined,
    lng_min: r.lng_min != null ? Number(r.lng_min) : undefined,
    lng_max: r.lng_max != null ? Number(r.lng_max) : undefined,
  };
}

function mapAlert(a: ZoneAlertItem, fallbackName = ''): ZoneAlertView {
  const level = String(a.severity ?? a.congestion_level ?? 'medium');
  const severity: ZoneAlertView['severity'] = level === 'high' ? 'high' : level === 'medium' ? 'medium' : 'low';
  let time_label = a.time_label || '';
  if (!time_label && a.triggered_at) {
    try {
      time_label = new Date(a.triggered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    } catch { time_label = ''; }
  }
  const locs = a.affected_locations?.slice(0, 2).join(', ');
  const message = a.message
    || (a.congestion_level === 'high'
      ? `High congestion${locs ? ` at ${locs}` : ''} — threshold ${a.threshold ?? 'high'}`
      : `Zone alert${locs ? ` · ${locs}` : ''}`);
  return {
    zone_name: a.zone_name || fallbackName,
    message,
    time_label,
    severity,
    triggered_at: a.triggered_at || '',
    avg_speed_kmh: a.avg_speed_kmh,
  };
}

function congColor(level?: string) {
  if (level === 'high') return '#ef4444';
  if (level === 'medium') return '#f59e0b';
  if (level === 'low') return '#22c55e';
  return '#94a3b8';
}

export default function ZonesPage() {
  const [zones, setZones] = useState<ZoneView[]>([]);
  const [alerts, setAlerts] = useState<ZoneAlertView[]>([]);
  const [zoneSummary, setZoneSummary] = useState<{ totalZones: number; activeZones: number; breachesToday: number; cities: number } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<ZoneView | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [zName, setZName] = useState('Hitech City Traffic Zone');
  const [zCity, setZCity] = useState('Hyderabad');
  const [zThresh, setZThresh] = useState('high');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [zonesRes, summaryRes, alertsRes] = await Promise.allSettled([
        zonesApi.list(),
        zonesApi.summary(),
        zonesApi.recentAlerts(),
      ]);

      if (zonesRes.status === 'fulfilled') {
        setZones(zonesRes.value.data.zones.map(normaliseZone));
      } else {
        setError(apiError(zonesRes.reason));
      }

      if (summaryRes.status === 'fulfilled') {
        const s = summaryRes.value.data;
        setZoneSummary({
          totalZones: s.total_zones ?? 0,
          activeZones: s.active_zones ?? 0,
          breachesToday: s.breaches_today ?? 0,
          cities: s.cities ?? 0,
        });
      }

      if (alertsRes.status === 'fulfilled') {
        setAlerts(alertsRes.value.data.alerts.map((a) => mapAlert(a)));
      }

      setLastUpdated(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));
    } catch (e) {
      setError(apiError(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => {
    const t = setInterval(() => void fetchData(), 60_000);
    return () => clearInterval(t);
  }, [fetchData]);

  const openZone = async (z: ZoneView) => {
    if (selected?.id === z.id) {
      setSelected(null);
      return;
    }
    setSelected(z);
    try {
      const [detail, status, alertRes] = await Promise.all([
        zonesApi.get(z.id),
        zonesApi.status(z.id),
        zonesApi.alerts(z.id),
      ]);
      setSelected(normaliseZone({
        ...z,
        ...detail.data,
        current_congestion: status.data.dominant_congestion ?? detail.data.current_congestion,
        dominant_congestion: status.data.dominant_congestion,
        health_score: status.data.health_score ?? detail.data.health_score,
        avg_speed_kmh: status.data.avg_speed_kmh ?? detail.data.avg_speed_kmh,
        monitored_locations: status.data.monitored_locations ?? detail.data.monitored_locations,
        threshold_breached: status.data.threshold_breached ?? detail.data.threshold_breached,
        has_data: status.data.has_data ?? detail.data.has_data,
      }));
      setAlerts(alertRes.data.alerts.map((a) => mapAlert(a, z.name)));
      // Also refresh list row with live status
      setZones((rows) => rows.map((row) => (
        row.id === z.id
          ? normaliseZone({ ...row, ...detail.data, ...status.data, current_congestion: status.data.dominant_congestion })
          : row
      )));
    } catch (e) {
      setError(apiError(e));
    }
  };

  const createZone = async () => {
    if (!zName.trim()) return;
    setSaving(true);
    setError('');
    const bounds = CITY_BOUNDS[zCity] ?? CITY_BOUNDS.Hyderabad;
    try {
      const res = await zonesApi.create({
        name: zName.trim(),
        city: zCity,
        zone_type: 'rectangle',
        lat_min: bounds.lat_min,
        lat_max: bounds.lat_max,
        lng_min: bounds.lng_min,
        lng_max: bounds.lng_max,
        congestion_threshold: zThresh,
      });
      const created = normaliseZone(res.data);
      setZones((p) => [created, ...p.filter((z) => z.id !== created.id)]);
      setSuccess(`Zone "${created.name}" created`);
      setShowForm(false);
      setTimeout(() => setSuccess(''), 3000);
      await fetchData();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const removeZone = async (id: string) => {
    try {
      await zonesApi.delete(id);
      setZones((p) => p.filter((z) => z.id !== id));
      if (selected?.id === id) setSelected(null);
      setSuccess('Zone deleted');
      setTimeout(() => setSuccess(''), 2500);
    } catch (e) {
      setError(apiError(e));
    }
  };

  return (
    <div className="space-y-5" style={{ maxWidth: 980 }}>
      <div className="page-hero" style={{ marginBottom: 0 }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="icon-glow icon-glow-green" style={{ width: 52, height: 52 }}>
              <Hexagon size={26} color="#34d399" />
            </div>
            <div>
              <h1 className="gradient-text-neon" style={{ fontWeight: 800, fontSize: 22, margin: 0 }}>Geofence Zones</h1>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 3 }}>
                Congestion = worse of label vs speed (≤25 km/h → high)
                {lastUpdated && <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>· {lastUpdated}</span>}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            {[
              { l: 'Total Zones', v: zoneSummary?.totalZones ?? zones.length },
              { l: 'Active', v: zoneSummary?.activeZones ?? zones.filter((z) => z.status === 'active').length },
              { l: 'Breaches Today', v: zoneSummary?.breachesToday ?? 0 },
              { l: 'Cities', v: zoneSummary?.cities ?? new Set(zones.map((z) => z.city)).size },
            ].map(({ l, v }) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <p className="gradient-text-animated" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{v}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 3 }}>{l}</p>
              </div>
            ))}
            <button
              onClick={() => void fetchData()}
              disabled={isLoading}
              className="btn-neon"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}
            >
              <RefreshCw size={12} style={{ animation: isLoading ? 'spin 0.8s linear infinite' : 'none' }} />
              {isLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600 }} className="neon-badge-green">
          <CheckCircle2 size={15} /> {success}
        </div>
      )}
      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Monitored Zones</span>
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn-gradient"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, fontWeight: 700, fontSize: 13 }}
            >
              <Plus size={13} /> New Zone
            </button>
          </div>

          {showForm && (
            <div className="neon-card" style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>Create Geofence Zone</span>
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={15} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input
                  placeholder="Zone name"
                  value={zName}
                  onChange={(e) => setZName(e.target.value)}
                  style={{ gridColumn: '1/-1', fontSize: 13, borderRadius: 8, padding: '8px 12px', border: '1.5px solid #e5e7eb', outline: 'none', color: '#111827' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>City</label>
                  <select value={zCity} onChange={(e) => setZCity(e.target.value)} style={{ fontSize: 13, borderRadius: 8, padding: '8px 12px', border: '1.5px solid #e5e7eb', color: '#111827', background: '#fff' }}>
                    {Object.keys(CITY_BOUNDS).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>Alert threshold</label>
                  <select value={zThresh} onChange={(e) => setZThresh(e.target.value)} style={{ fontSize: 13, borderRadius: 8, padding: '8px 12px', border: '1.5px solid #e5e7eb', color: '#111827', background: '#fff' }}>
                    <option value="low">Low (30%)</option>
                    <option value="medium">Medium (60%)</option>
                    <option value="high">High (85%)</option>
                  </select>
                </div>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 11, color: '#94a3b8' }}>
                Hyderabad uses Hitech City bounds (17.44–17.455, 78.385–78.4)
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => void createZone()}
                  disabled={saving || !zName.trim()}
                  className="btn-gradient"
                  style={{ padding: '8px 18px', borderRadius: 9, fontWeight: 700, fontSize: 13, opacity: (saving || !zName.trim()) ? 0.6 : 1 }}
                >
                  {saving ? 'Creating…' : 'Create Zone'}
                </button>
                <button onClick={() => setShowForm(false)} style={{ padding: '8px 14px', borderRadius: 9, fontSize: 13, color: '#9ca3af', background: 'none', border: '1px solid #e5e7eb', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isLoading && !zones.length && [1, 2, 3].map((n) => (
              <div key={n} className="skeleton" style={{ height: 88, borderRadius: 14 }} />
            ))}
            {!isLoading && !zones.length && (
              <div className="neon-card" style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                No zones yet. Create “Hitech City Traffic Zone” for Hyderabad.
              </div>
            )}
            {zones.map((z) => {
              const isSelected = selected?.id === z.id;
              return (
                <div
                  key={z.id}
                  onClick={() => void openZone(z)}
                  className="neon-card"
                  style={{
                    cursor: 'pointer', padding: '14px 16px',
                    border: `1.5px solid ${isSelected ? '#3b82f6' : z.is_breached ? 'rgba(239,68,68,0.4)' : '#e2e8f0'}`,
                    boxShadow: isSelected ? '0 0 0 3px rgba(59,130,246,0.12)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className={`icon-glow ${z.is_breached ? 'icon-glow-red' : z.status === 'active' ? 'icon-glow-blue' : ''}`} style={{ width: 36, height: 36, background: z.is_breached ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)' }}>
                        <Hexagon size={17} color={z.is_breached ? '#ef4444' : '#3b82f6'} />
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 13, color: '#111827', margin: 0 }}>{z.name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <MapPin size={10} color="#9ca3af" />
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>{z.city} · {z.type} · r={z.radius_km}km</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {z.is_breached && (
                        <span className="neon-badge-red" style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>Breached</span>
                      )}
                      <span className={z.status === 'active' ? 'neon-badge-green' : ''} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, ...(z.status !== 'active' ? { background: '#f1f5f9', color: '#9ca3af' } : {}) }}>
                        {z.status === 'active' ? 'Active' : 'Paused'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); void removeZone(z.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 3 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Activity size={11} color="#64748b" />
                      <span style={{ fontSize: 11, color: '#6b7280' }}>
                        Threshold: <strong style={{ color: '#111827' }}>{(z.threshold * 100).toFixed(0)}%</strong>
                        <span style={{ marginLeft: 4, fontSize: 10, color: '#9ca3af', textTransform: 'capitalize' }}>({z.threshold_label})</span>
                      </span>
                    </div>
                    {z.dominant_congestion && (
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'capitalize', color: congColor(z.dominant_congestion) }}>
                        ● {z.dominant_congestion}
                      </span>
                    )}
                    {z.avg_speed_kmh != null && (
                      <span style={{ fontSize: 11, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Gauge size={11} /> {z.avg_speed_kmh} km/h
                      </span>
                    )}
                    {z.health_score != null && (
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        Health: <strong style={{ color: z.health_score > 70 ? '#16a34a' : z.health_score > 40 ? '#d97706' : '#dc2626' }}>{z.health_score}</strong>
                      </span>
                    )}
                    {z.breaches_today > 0 && (
                      <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Bell size={11} /> {z.breaches_today} today
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="neon-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="icon-glow icon-glow-red" style={{ width: 28, height: 28 }}>
                <Bell size={13} color="#f87171" />
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Recent Alerts</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99, marginLeft: 'auto' }} className="neon-badge-red">
                {alerts.length}
              </span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {alerts.length === 0 ? (
                <p style={{ padding: '24px 18px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                  No alerts yet — breaches appear after status evaluates past threshold
                </p>
              ) : (
                alerts.map((a, i) => {
                  const s = SEV[a.severity];
                  return (
                    <div key={`${a.zone_name}-${i}`} style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: i < alerts.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: s.bg, border: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <s.Icon size={13} color={s.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: 0 }}>{a.zone_name}</p>
                        <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0', lineHeight: 1.4 }}>{a.message}</p>
                        <p style={{ fontSize: 10, color: '#94a3b8', margin: '3px 0 0' }}>
                          {a.time_label}{a.avg_speed_kmh != null ? ` · ${a.avg_speed_kmh} km/h` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {selected && (
            <div className="neon-card" style={{ marginTop: 14, border: '1.5px solid rgba(59,130,246,0.4)', padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>Zone Details</span>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={14} /></button>
              </div>
              {[
                ['Name', selected.name],
                ['City', selected.city],
                ['Type', selected.type],
                ['Radius', `${selected.radius_km} km`],
                ['Threshold', `${(selected.threshold * 100).toFixed(0)}% (${selected.threshold_label})`],
                ['Current traffic', selected.dominant_congestion ?? '—'],
                ['Avg speed', selected.avg_speed_kmh != null ? `${selected.avg_speed_kmh} km/h` : '—'],
                ['Health score', selected.health_score != null ? `${selected.health_score} / 100` : '—'],
                ['Threshold breached', selected.is_breached ? 'Yes' : 'No'],
                ['Has data', selected.has_data == null ? '—' : selected.has_data ? 'Yes' : 'No'],
                ['Breaches today', String(selected.breaches_today)],
                ['Created', new Date(selected.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{k}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', textTransform: k === 'Name' ? 'none' : 'capitalize' }}>{v}</span>
                </div>
              ))}
              {selected.monitored_locations.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#374151' }}>Monitored locations</p>
                  {selected.monitored_locations.map((loc) => (
                    <div key={loc.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', color: '#475569' }}>
                      <span>{loc.name}</span>
                      <span style={{ color: congColor(loc.congestion), fontWeight: 700, textTransform: 'capitalize' }}>
                        {loc.congestion}{loc.speed_kmh != null ? ` · ${loc.speed_kmh} km/h` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
