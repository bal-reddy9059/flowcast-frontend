'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Hexagon, Plus, Trash2, AlertTriangle, CheckCircle2,
  MapPin, Bell, ShieldAlert, X, Activity, RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Zone {
  id: string; name: string; type: 'circle' | 'polygon'; city: string;
  radius_km: number;
  threshold: number;          // numeric 0–1 derived from threshold_label
  threshold_label: string;    // raw backend value: low | medium | high
  breaches_today: number;
  status: 'active' | 'paused';
  lat: number; lng: number;
  created_at: string;
  health_score?: number;
  is_breached?: boolean;
  dominant_congestion?: string;
}

interface ZoneAlert {
  zone_name: string;
  message: string;
  time_label: string;
  severity: 'high' | 'medium' | 'low';
  triggered_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const THRESHOLD_NUM: Record<string, number> = { low: 0.3, medium: 0.6, high: 0.85 };

const SEV = {
  high:   { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.22)',  color: '#b91c1c', Icon: ShieldAlert    },
  medium: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)', color: '#b45309', Icon: AlertTriangle  },
  low:    { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.22)',  color: '#15803d', Icon: CheckCircle2   },
};

// city name patterns → city label (checked against zone name first, then coordinates)
const CITY_PATTERNS: [RegExp, string][] = [
  [/mumbai|bandra|andheri|dadar|worli/i,                   'Mumbai'   ],
  [/bengaluru|bangalore|silk board|koramangala|whitefield/i,'Bengaluru'],
  [/delhi|connaught|gurgaon|noida|dwarka/i,                'Delhi'    ],
  [/chennai|anna salai|t nagar|velachery/i,                'Chennai'  ],
  [/hyderabad|hitech|hitec|banjara|ameerpet/i,             'Hyderabad'],
  [/pune|hinjewadi|kothrud/i,                              'Pune'     ],
  [/kolkata|howrah|saltlake/i,                             'Kolkata'  ],
  [/ahmedabad|sg highway|navrangpura/i,                    'Ahmedabad'],
  [/surat/i,                                               'Surat'    ],
  [/jaipur|mi road/i,                                      'Jaipur'   ],
];

// City preset coordinates for the "New Zone" form
const CITY_COORDS: Record<string, { lat: number; lng: number; delta: number }> = {
  Mumbai:    { lat: 19.076, lng: 72.877, delta: 0.05 },
  Bengaluru: { lat: 12.972, lng: 77.594, delta: 0.05 },
  Delhi:     { lat: 28.614, lng: 77.209, delta: 0.06 },
  Chennai:   { lat: 13.082, lng: 80.270, delta: 0.05 },
  Hyderabad: { lat: 17.385, lng: 78.486, delta: 0.05 },
  Pune:      { lat: 18.524, lng: 73.856, delta: 0.05 },
  Kolkata:   { lat: 22.573, lng: 88.363, delta: 0.05 },
  Ahmedabad: { lat: 23.033, lng: 72.586, delta: 0.05 },
};

// ── Stub fallbacks ────────────────────────────────────────────────────────────

const STUBS: Zone[] = [
  { id: 'z1', name: 'Mumbai CBD Alert Zone',  type: 'circle',  city: 'Mumbai',    radius_km: 5,  threshold: 0.85, threshold_label: 'high',   breaches_today: 3,  status: 'active', lat: 18.940, lng: 72.835, created_at: '2024-03-01' },
  { id: 'z2', name: 'Bengaluru Tech Corridor',type: 'polygon', city: 'Bengaluru', radius_km: 8,  threshold: 0.60, threshold_label: 'medium', breaches_today: 7,  status: 'active', lat: 12.971, lng: 77.594, created_at: '2024-03-10' },
  { id: 'z3', name: 'Delhi Ring Road Monitor',type: 'circle',  city: 'Delhi',     radius_km: 12, threshold: 0.85, threshold_label: 'high',   breaches_today: 0,  status: 'paused', lat: 28.613, lng: 77.209, created_at: '2024-04-05' },
  { id: 'z4', name: 'Chennai Port Entry',     type: 'circle',  city: 'Chennai',   radius_km: 3,  threshold: 0.60, threshold_label: 'medium', breaches_today: 12, status: 'active', lat: 13.082, lng: 80.270, created_at: '2024-04-15' },
  { id: 'z5', name: 'Hyderabad HITEC Zone',   type: 'polygon', city: 'Hyderabad', radius_km: 6,  threshold: 0.85, threshold_label: 'high',   breaches_today: 2,  status: 'active', lat: 17.385, lng: 78.486, created_at: '2024-05-01' },
];

const STUB_ALERTS: ZoneAlert[] = [
  { zone_name: 'Mumbai CBD Alert Zone',   message: 'Congestion exceeded 80% threshold',           time_label: '09:42 am', severity: 'high',   triggered_at: '' },
  { zone_name: 'Chennai Port Entry',      message: 'Repeated breach — 12 events today',            time_label: '08:15 am', severity: 'high',   triggered_at: '' },
  { zone_name: 'Bengaluru Tech Corridor', message: 'Congestion at 74% — approaching threshold',    time_label: '07:30 am', severity: 'medium', triggered_at: '' },
  { zone_name: 'Hyderabad HITEC Zone',    message: 'Congestion cleared — back to normal',           time_label: '06:55 am', severity: 'low',    triggered_at: '' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveCity(name: string, lat: number, lng: number): string {
  for (const [re, city] of CITY_PATTERNS) {
    if (re.test(name)) return city;
  }
  if (lat > 18.5 && lat < 19.5 && lng > 72.0 && lng < 73.5) return 'Mumbai';
  if (lat > 12.5 && lat < 13.5 && lng > 77.0 && lng < 78.5) return 'Bengaluru';
  if (lat > 28.0 && lat < 29.0 && lng > 76.5 && lng < 77.5) return 'Delhi';
  if (lat > 12.8 && lat < 13.5 && lng > 80.0 && lng < 80.5) return 'Chennai';
  if (lat > 17.0 && lat < 18.0 && lng > 78.0 && lng < 79.0) return 'Hyderabad';
  return 'India';
}

const CONGESTION_LEVEL: Record<string, number> = { low: 0, medium: 1, high: 2 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseZone(raw: any): Zone {
  const isCircle = raw.zone_type === 'circle' || raw.shape_label === 'circle';
  let lat: number, lng: number, radius_km: number;

  // Backend now provides radius_km directly (computed from bounding box for rectangles)
  if (raw.radius_km != null) {
    radius_km = Math.round(raw.radius_km);
    lat = raw.center_lat ?? ((raw.lat_min ?? 20) + (raw.lat_max ?? 21)) / 2;
    lng = raw.center_lng ?? ((raw.lng_min ?? 78) + (raw.lng_max ?? 79)) / 2;
  } else if (isCircle) {
    lat = raw.center_lat ?? 20.5;
    lng = raw.center_lng ?? 78.9;
    radius_km = 5;
  } else {
    lat = ((raw.lat_min ?? 20) + (raw.lat_max ?? 21)) / 2;
    lng = ((raw.lng_min ?? 78) + (raw.lng_max ?? 79)) / 2;
    const latKm = ((raw.lat_max ?? 21) - (raw.lat_min ?? 20)) * 111;
    const lngKm = ((raw.lng_max ?? 79) - (raw.lng_min ?? 78)) * 111 * Math.cos((lat * Math.PI) / 180);
    radius_km = Math.max(1, Math.round(Math.sqrt(latKm * latKm + lngKm * lngKm) / 2));
  }

  const threshLabel: string = raw.congestion_threshold ?? 'medium';
  // threshold_pct now provided directly (85 / 60 / 40)
  const threshold = raw.threshold_pct != null ? raw.threshold_pct / 100 : (THRESHOLD_NUM[threshLabel] ?? 0.6);
  const dominant  = raw.current_congestion ?? undefined;

  return {
    id:                  raw.id,
    name:                raw.name,
    type:                raw.shape_label === 'polygon' || !isCircle ? 'polygon' : 'circle',
    city:                raw.city ?? deriveCity(raw.name, lat, lng),
    radius_km,
    threshold,
    threshold_label:     threshLabel,
    breaches_today:      raw.breaches_today  ?? 0,
    status:              raw.is_active ? 'active' : 'paused',
    lat,
    lng,
    created_at:          raw.created_at ?? new Date().toISOString(),
    health_score:        raw.health_score    ?? undefined,
    dominant_congestion: dominant,
    is_breached:         dominant != null
      ? (CONGESTION_LEVEL[dominant] ?? 0) >= (CONGESTION_LEVEL[threshLabel] ?? 1)
      : false,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAlertMsg(congestion: string, threshold: string, locations: any[]): string {
  const loc = (locations ?? []).slice(0, 2).join(', ');
  if (congestion === 'high')   return `High congestion detected${loc ? ` at ${loc}` : ''} — exceeds ${threshold} threshold`;
  if (congestion === 'medium') return `Moderate congestion${loc ? ` at ${loc}` : ''} — approaching threshold`;
  return `Congestion cleared${loc ? ` at ${loc}` : ''} — back to normal`;
}

function toSeverity(level: string): 'high' | 'medium' | 'low' {
  if (level === 'high')   return 'high';
  if (level === 'medium') return 'medium';
  return 'low';
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ZonesPage() {
  const [zones,       setZones]       = useState<Zone[]>(STUBS);
  const [alerts,      setAlerts]      = useState<ZoneAlert[]>(STUB_ALERTS);
  const [zoneSummary, setZoneSummary] = useState<{ totalZones: number; activeZones: number; breachesToday: number; cities: number } | null>(null);
  const [showForm,    setShowForm]    = useState(false);
  const [success,     setSuccess]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [selected,    setSelected]    = useState<Zone | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  // Form state
  const [zName,  setZName]  = useState('');
  const [zCity,  setZCity]  = useState('Mumbai');
  const [zThresh, setZThresh] = useState('high');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // All three calls in parallel — live status + breaches_today now embedded in list
      const [zonesRes, summaryRes, alertsRes] = await Promise.allSettled([
        api.get('/zones'),
        api.get('/zones/summary'),
        api.get('/zones/alerts/recent'),
      ]);

      if (zonesRes.status === 'fulfilled') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw: any[] = zonesRes.value.data?.zones ?? (Array.isArray(zonesRes.value.data) ? zonesRes.value.data : []);
        if (raw.length) setZones(raw.map(normaliseZone));
      }

      if (summaryRes.status === 'fulfilled') {
        const s = summaryRes.value.data;
        setZoneSummary({
          totalZones:    s.total_zones    ?? 0,
          activeZones:   s.active_zones   ?? 0,
          breachesToday: s.breaches_today ?? 0,
          cities:        s.cities         ?? 0,
        });
      }

      if (alertsRes.status === 'fulfilled') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw: any[] = alertsRes.value.data?.alerts ?? (Array.isArray(alertsRes.value.data) ? alertsRes.value.data : []);
        if (raw.length) {
          setAlerts(raw.map((a) => ({
            zone_name:    a.zone_name ?? a.name ?? '',
            message:      a.message   ?? buildAlertMsg(a.congestion_level, a.threshold ?? 'medium', a.affected_locations ?? []),
            time_label:   a.time_label ?? new Date(a.triggered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            severity:     toSeverity(a.severity ?? a.congestion_level ?? 'medium'),
            triggered_at: a.triggered_at ?? '',
          })));
        }
      }

      setLastUpdated(new Date().toLocaleTimeString());
    } catch { /* use stubs */ }
    finally { setIsLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);
  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => void fetchData(), 30_000);
    return () => clearInterval(t);
  }, [fetchData]);

  const createZone = async () => {
    if (!zName.trim()) return;
    setSaving(true);
    const coords = CITY_COORDS[zCity] ?? { lat: 20.5, lng: 78.9, delta: 0.05 };
    const payload = {
      name: zName,
      zone_type: 'rectangle',
      lat_min: +(coords.lat - coords.delta).toFixed(4),
      lat_max: +(coords.lat + coords.delta).toFixed(4),
      lng_min: +(coords.lng - coords.delta).toFixed(4),
      lng_max: +(coords.lng + coords.delta).toFixed(4),
      congestion_threshold: zThresh,
    };
    try {
      const res = await api.post('/zones', payload);
      setZones((p) => [...p, normaliseZone(res.data)]);
    } catch {
      const newZ: Zone = {
        id: Date.now().toString(), name: zName, type: 'polygon', city: zCity,
        radius_km: Math.round(coords.delta * 111),
        threshold: THRESHOLD_NUM[zThresh] ?? 0.6, threshold_label: zThresh,
        breaches_today: 0, status: 'active',
        lat: coords.lat, lng: coords.lng, created_at: new Date().toISOString(),
      };
      setZones((p) => [...p, newZ]);
    }
    setSuccess(`Zone "${zName}" created`);
    setZName(''); setShowForm(false); setSaving(false);
    setTimeout(() => setSuccess(''), 3000);
  };

  const removeZone = async (id: string) => {
    try { await api.delete(`/zones/${id}`); } catch { /* ok */ }
    setZones((p) => p.filter((z) => z.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const toggleStatus = (id: string) => {
    setZones((p) => p.map((z) => z.id === id ? { ...z, status: z.status === 'active' ? 'paused' : 'active' } : z));
  };

  const totalBreaches = zones.reduce((a, z) => a + z.breaches_today, 0);
  const activeCount   = zones.filter((z) => z.status === 'active').length;

  return (
    <div className="space-y-5" style={{ maxWidth: 980 }}>

      {/* ── Page Hero ─────────────────────────────────────────────── */}
      <div className="page-hero" style={{ marginBottom: 0 }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="icon-glow icon-glow-green" style={{ width: 52, height: 52 }}>
              <Hexagon size={26} color="#34d399" />
            </div>
            <div>
              <h1 className="gradient-text-neon" style={{ fontWeight: 800, fontSize: 22, margin: 0 }}>Geofence Zones</h1>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 3 }}>
                Smart zone monitoring with breach alerts &amp; thresholds
                {lastUpdated && <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>· updated {lastUpdated}</span>}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            {[
              { l: 'Total Zones',    v: zoneSummary?.totalZones    ?? zones.length    },
              { l: 'Active',         v: zoneSummary?.activeZones   ?? activeCount     },
              { l: 'Breaches Today', v: zoneSummary?.breachesToday ?? totalBreaches   },
              { l: 'Cities',         v: zoneSummary?.cities        ?? new Set(zones.map((z) => z.city)).size },
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18 }}>

        {/* ── Left: zone list ──────────────────────────────────── */}
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
                  <select
                    value={zCity}
                    onChange={(e) => setZCity(e.target.value)}
                    style={{ fontSize: 13, borderRadius: 8, padding: '8px 12px', border: '1.5px solid #e5e7eb', color: '#111827', background: '#fff' }}
                  >
                    {Object.keys(CITY_COORDS).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>Alert threshold</label>
                  <select
                    value={zThresh}
                    onChange={(e) => setZThresh(e.target.value)}
                    style={{ fontSize: 13, borderRadius: 8, padding: '8px 12px', border: '1.5px solid #e5e7eb', color: '#111827', background: '#fff' }}
                  >
                    <option value="low">Low (30%)</option>
                    <option value="medium">Medium (60%)</option>
                    <option value="high">High (85%)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={createZone}
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
            {zones.map((z) => {
              const isSelected = selected?.id === z.id;
              return (
                <div
                  key={z.id}
                  onClick={() => setSelected(isSelected ? null : z)}
                  className="neon-card"
                  style={{
                    cursor: 'pointer', padding: '14px 16px',
                    border:     `1.5px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                    boxShadow:  isSelected ? '0 0 0 3px rgba(59,130,246,0.12), 0 0 20px rgba(59,130,246,0.15)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className={`icon-glow ${z.is_breached ? 'icon-glow-red' : z.status === 'active' ? 'icon-glow-blue' : ''}`} style={{ width: 36, height: 36, background: z.is_breached ? 'rgba(239,68,68,0.1)' : z.status === 'active' ? 'rgba(59,130,246,0.1)' : '#f1f5f9' }}>
                        <Hexagon size={17} color={z.is_breached ? '#ef4444' : z.status === 'active' ? '#3b82f6' : '#94a3b8'} />
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 13, color: '#111827', margin: 0 }}>{z.name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <MapPin size={10} color="#9ca3af" />
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>
                            {z.city} · {z.type} · r={z.radius_km}km
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        className={z.status === 'active' ? 'neon-badge-green' : ''}
                        style={z.status === 'active'
                          ? { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }
                          : { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#f1f5f9', color: '#9ca3af' }
                        }>
                        {z.status === 'active' ? 'Active' : 'Paused'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleStatus(z.id); }}
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600 }}
                      >
                        {z.status === 'active' ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); void removeZone(z.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 3 }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#d1d5db')}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Activity size={11} color="#64748b" />
                      <span style={{ fontSize: 11, color: '#6b7280' }}>
                        Threshold: <strong style={{ color: '#111827' }}>{(z.threshold * 100).toFixed(0)}%</strong>
                        <span style={{ marginLeft: 4, fontSize: 10, color: '#9ca3af', textTransform: 'capitalize' }}>({z.threshold_label})</span>
                      </span>
                    </div>
                    {z.dominant_congestion && (
                      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'capitalize', color: z.dominant_congestion === 'high' ? '#ef4444' : z.dominant_congestion === 'medium' ? '#f59e0b' : '#22c55e' }}>
                        ● {z.dominant_congestion} now
                      </span>
                    )}
                    {z.health_score != null && (
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        Health: <strong style={{ color: z.health_score > 70 ? '#16a34a' : z.health_score > 40 ? '#d97706' : '#dc2626' }}>{z.health_score}</strong>
                      </span>
                    )}
                    {z.breaches_today > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Bell size={11} color="#ef4444" />
                        <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>
                          {z.breaches_today} breach{z.breaches_today > 1 ? 'es' : ''} today
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: alerts + detail ───────────────────────────── */}
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
                  No alerts yet — all zones are healthy
                </p>
              ) : (
                alerts.map((a, i) => {
                  const s = SEV[a.severity];
                  return (
                    <div
                      key={i}
                      style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: i < alerts.length - 1 ? '1px solid #f9fafb' : 'none' }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: s.bg, border: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <s.Icon size={13} color={s.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.zone_name}</p>
                        <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0', lineHeight: 1.4 }}>{a.message}</p>
                        <p style={{ fontSize: 10, color: '#94a3b8', margin: '3px 0 0' }}>{a.time_label}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Zone detail card */}
          {selected && (
            <div className="neon-card" style={{ marginTop: 14, border: '1.5px solid rgba(59,130,246,0.4)', padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>Zone Details</span>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={14} /></button>
              </div>
              {[
                ['Name',             selected.name],
                ['City',             selected.city],
                ['Type',             selected.type],
                ['Radius',           `${selected.radius_km} km`],
                ['Threshold',        `${(selected.threshold * 100).toFixed(0)}% (${selected.threshold_label})`],
                ['Current traffic',  selected.dominant_congestion ?? '—'],
                ['Health score',     selected.health_score != null ? `${selected.health_score} / 100` : '—'],
                ['Breaches today',   selected.breaches_today.toString()],
                ['Status',           selected.status],
                ['Created',          new Date(selected.created_at).toLocaleDateString('en-IN')],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{k}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', textTransform: 'capitalize' }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
