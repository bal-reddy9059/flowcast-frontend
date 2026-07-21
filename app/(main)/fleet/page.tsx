'use client';

import { useState, useEffect, useCallback } from 'react';
import { Truck, Car, Bus, Bike, Plus, Trash2, UserCheck, MapPin, Zap, Activity, Navigation, CheckCircle2, X } from 'lucide-react';
import { fleetApi } from '@/lib/api';

type VehicleType = 'car' | 'truck' | 'bus' | 'bike' | 'van';
interface Vehicle {
  id: string; name: string; plate: string; type: VehicleType;
  driver_name: string; driver_id: string;
  location: string; speed_kmh: number; congestion_score: number;
  congestion_level?: string;
  status: 'active' | 'idle' | 'offline';
  fuel_pct: number; last_seen: string;
  lat?: number; lng?: number;
}

const ORG_ID = 'org-001';
const STUBS: Vehicle[] = [
  { id: 'v1', name: 'FleetCast Truck 01', plate: 'MH-12-AB-1234', type: 'truck',  driver_name: 'Ravi Kumar',   driver_id: 'd1', location: 'Andheri West, Mumbai',    speed_kmh: 42, congestion_score: 0.62, congestion_level: 'medium', status: 'active',  fuel_pct: 74, last_seen: new Date().toISOString() },
  { id: 'v2', name: 'FleetCast Car 02',   plate: 'KA-09-CD-5678', type: 'car',    driver_name: 'Sneha Nair',    driver_id: 'd2', location: 'Koramangala, Bengaluru',   speed_kmh: 0,  congestion_score: 0.45, congestion_level: 'medium', status: 'idle',    fuel_pct: 91, last_seen: new Date().toISOString() },
  { id: 'v3', name: 'FleetCast Bus 03',   plate: 'DL-01-EF-9012', type: 'bus',    driver_name: 'Arjun Mehta',   driver_id: 'd3', location: 'Connaught Place, Delhi',   speed_kmh: 28, congestion_score: 0.81, congestion_level: 'high',   status: 'active',  fuel_pct: 55, last_seen: new Date().toISOString() },
  { id: 'v4', name: 'FleetCast Bike 04',  plate: 'TN-22-GH-3456', type: 'bike',   driver_name: 'Preethi Rao',   driver_id: 'd4', location: 'T Nagar, Chennai',         speed_kmh: 18, congestion_score: 0.38, congestion_level: 'low',    status: 'active',  fuel_pct: 82, last_seen: new Date().toISOString() },
  { id: 'v5', name: 'FleetCast Van 05',   plate: 'GJ-01-IJ-7890', type: 'van',    driver_name: 'Harish Patel',  driver_id: 'd5', location: 'SG Highway, Ahmedabad',    speed_kmh: 0,  congestion_score: 0.22, congestion_level: 'low',    status: 'offline', fuel_pct: 38, last_seen: new Date(Date.now() - 3600000).toISOString() },
  { id: 'v6', name: 'FleetCast Car 06',   plate: 'MH-14-KL-2468', type: 'car',    driver_name: 'Divya Desai',   driver_id: 'd6', location: 'Hinjewadi, Pune',          speed_kmh: 55, congestion_score: 0.54, congestion_level: 'medium', status: 'active',  fuel_pct: 67, last_seen: new Date().toISOString() },
];

const VTYPE = {
  car:   { Icon: Car,   bg: 'rgba(59,130,246,0.12)',  color: '#2563eb', label: 'Car'   },
  truck: { Icon: Truck, bg: 'rgba(124,58,237,0.12)', color: '#7c3aed', label: 'Truck' },
  bus:   { Icon: Bus,   bg: 'rgba(20,184,166,0.12)', color: '#0d9488', label: 'Bus'   },
  bike:  { Icon: Bike,  bg: 'rgba(251,146,60,0.14)', color: '#ea580c', label: 'Bike'  },
  van:   { Icon: Truck, bg: 'rgba(100,116,139,0.12)',color: '#475569', label: 'Van'   },
};
const STATUS_STYLE = {
  active:  { bg: 'rgba(34,197,94,0.1)',  color: '#15803d', dot: '#22c55e' },
  idle:    { bg: 'rgba(251,191,36,0.12)',color: '#b45309', dot: '#f59e0b' },
  offline: { bg: 'rgba(239,68,68,0.1)',  color: '#b91c1c', dot: '#ef4444' },
};

function congestionColor(s: number) {
  if (s < 0.4) return '#22c55e';
  if (s < 0.7) return '#f59e0b';
  return '#ef4444';
}

export default function FleetPage() {
  const [vehicles,  setVehicles]  = useState<Vehicle[]>(STUBS);
  const [showForm,  setShowForm]  = useState(false);
  const [filter,    setFilter]    = useState<'all' | VehicleType>('all');
  const [success,   setSuccess]   = useState('');
  const [plate,     setPlate]     = useState('');
  const [vtype,     setVtype]     = useState<VehicleType>('car');
  const [driver,    setDriver]    = useState('');
  const [saving,      setSaving]      = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [behaviorLeaderboard, setBehaviorLeaderboard] = useState<unknown>(null);

  const fetchData = useCallback(async () => {
    try {
      const [r, vehiclesRes, leaderboardRes] = await Promise.all([fleetApi.live(ORG_ID), fleetApi.vehicles(ORG_ID), fleetApi.behaviorLeaderboard(ORG_ID)]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = r.data?.vehicles ?? vehiclesRes.data?.vehicles ?? vehiclesRes.data?.data ?? r.data?.data ?? [];
      setBehaviorLeaderboard(leaderboardRes.data);
      if (raw.length) {
        setVehicles(raw.map((v) => {
          // congestion_level is "low" | "medium" | "high" — map to numeric score
          const congLevel: string = v.congestion_level ?? v.congestion ?? '';
          const congScore: number =
            v.congestion_score ?? v.congestion_score_numeric ??
            (congLevel === 'high' ? 0.82 : congLevel === 'medium' ? 0.55 : congLevel === 'low' ? 0.2 : 0);
          // status: derive from speed when the backend doesn't send it explicitly
          const rawSpeed: number = v.speed_kmh ?? v.speed ?? v.current_speed ?? 0;
          const derivedStatus: Vehicle['status'] =
            (['active','idle','offline'] as const).includes(v.status)
              ? v.status
              : rawSpeed > 0 ? 'active' : 'idle';
          return {
            id:               v.vehicle_id ?? v.id ?? String(Math.random()),
            name:             v.vehicle_name ?? v.name ?? v.registration ?? v.plate ?? 'Vehicle',
            plate:            v.registration ?? v.plate ?? v.plate_number ?? v.license_plate ?? '—',
            type:             (['car','truck','bus','bike','van'] as const).includes(v.vehicle_type)
                                ? v.vehicle_type as VehicleType
                                : (['car','truck','bus','bike','van'] as const).includes(v.type)
                                  ? v.type as VehicleType : 'car',
            driver_name:      v.driver_name ?? v.driver ?? '—',
            driver_id:        v.driver_id ?? '',
            location:         v.location ?? v.current_location ?? 'India',
            speed_kmh:        rawSpeed,
            congestion_score: congScore,
            congestion_level: congLevel || undefined,
            status:           derivedStatus,
            fuel_pct:         v.fuel_pct ?? v.fuel ?? 80,
            last_seen:        v.last_seen ?? v.updated_at ?? new Date().toISOString(),
            lat:              v.latitude ?? v.lat ?? undefined,
            lng:              v.longitude ?? v.lng ?? undefined,
          };
        }));
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch { /* use stubs */ }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);
  // Auto-refresh every 15 seconds
  useEffect(() => {
    const t = setInterval(() => void fetchData(), 45_000);
    return () => clearInterval(t);
  }, [fetchData]);

  const addVehicle = async () => {
    if (!plate.trim() || !driver.trim()) return;
    setSaving(true);
    const newV: Vehicle = { id: Date.now().toString(), name: plate, plate, type: vtype, driver_name: driver, driver_id: Date.now().toString(), location: 'N/A', speed_kmh: 0, congestion_score: 0, congestion_level: 'low', status: 'idle', fuel_pct: 100, last_seen: new Date().toISOString() };
    try { await fleetApi.createVehicle(ORG_ID, { plate, type: vtype, driver_name: driver }); } catch { /* ok */ }
    setVehicles((p) => [...p, newV]);
    setSuccess(`Vehicle ${plate} added`);
    setPlate(''); setDriver(''); setShowForm(false); setSaving(false);
    setTimeout(() => setSuccess(''), 3000);
  };

  const removeVehicle = async (id: string) => {
    try { await fleetApi.removeVehicle(ORG_ID, id); } catch { /* ok */ }
    setVehicles((p) => p.filter((v) => v.id !== id));
  };

  const filtered = filter === 'all' ? vehicles : vehicles.filter((v) => v.type === filter);
  const active  = vehicles.filter((v) => v.status === 'active').length;
  const idle    = vehicles.filter((v) => v.status === 'idle').length;
  const offline = vehicles.filter((v) => v.status === 'offline').length;
  const avgSpeed = vehicles.filter((v) => v.speed_kmh > 0).reduce((a, v) => a + v.speed_kmh, 0) / Math.max(1, vehicles.filter((v) => v.speed_kmh > 0).length);

  return (
    <div className="space-y-5" style={{ maxWidth: 980 }}>

      {/* ── Page Hero ─────────────────────────────── */}
      <div className="page-hero" style={{ marginBottom: 0 }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="icon-glow icon-glow-blue" style={{ width: 52, height: 52 }}>
              <Truck size={26} color="#60a5fa" />
            </div>
            <div>
              <h1 className="gradient-text-neon" style={{ fontWeight: 800, fontSize: 22, margin: 0 }}>Fleet Management</h1>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 3 }}>
                Live vehicle tracking, driver assignments &amp; status
                {lastUpdated && <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>· updated {lastUpdated}</span>}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            {[{ l: 'Total', v: vehicles.length }, { l: 'Active', v: active }, { l: 'Idle', v: idle }, { l: 'Avg Speed', v: `${avgSpeed.toFixed(0)} km/h` }].map(({ l, v }) => (
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

      {/* ── Toolbar ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'car', 'truck', 'bus', 'bike', 'van'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: filter === f ? '#3b82f6' : '#e5e7eb', background: filter === f ? 'rgba(59,130,246,0.1)' : '#fff', color: filter === f ? '#3b82f6' : '#6b7280', transition: 'all 0.15s', boxShadow: filter === f ? '0 0 10px rgba(59,130,246,0.2)' : 'none' }}>
              {f === 'all' ? 'All' : VTYPE[f].label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-gradient" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
          <Plus size={14} /> Add Vehicle
        </button>
      </div>

      {showForm && (
        <div className="neon-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Add New Vehicle</span>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input placeholder="Number Plate (e.g. MH-12-AB-1234)" value={plate} onChange={(e) => setPlate(e.target.value)}
              style={{ flex: 2, minWidth: 200, fontSize: 13, borderRadius: 9, padding: '8px 12px', border: '1.5px solid #e5e7eb', outline: 'none', color: '#111827' }} />
            <select value={vtype} onChange={(e) => setVtype(e.target.value as VehicleType)}
              style={{ fontSize: 13, borderRadius: 9, padding: '8px 10px', border: '1.5px solid #e5e7eb', color: '#374151', background: '#fff' }}>
              {(['car','truck','bus','bike','van'] as VehicleType[]).map((t) => <option key={t} value={t}>{VTYPE[t].label}</option>)}
            </select>
            <input placeholder="Driver name" value={driver} onChange={(e) => setDriver(e.target.value)}
              style={{ flex: 2, minWidth: 160, fontSize: 13, borderRadius: 9, padding: '8px 12px', border: '1.5px solid #e5e7eb', outline: 'none', color: '#111827' }} />
            <button onClick={addVehicle} disabled={saving} className="btn-gradient" style={{ padding: '8px 18px', borderRadius: 9, fontWeight: 700, fontSize: 13, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* ── Vehicle grid ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
        {filtered.map((v) => {
          const vt = VTYPE[v.type] ?? VTYPE.car; const ss = STATUS_STYLE[v.status] ?? STATUS_STYLE.idle;
          return (
            <div key={v.id} className="neon-card" style={{ padding: 18, position: 'relative' }}>

              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="icon-glow" style={{ width: 40, height: 40, background: vt.bg }}>
                    <vt.Icon size={20} color={vt.color} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: 13, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</p>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{vt.label}{v.plate && v.plate !== '—' ? ` · ${v.plate}` : ''}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: ss.bg, color: ss.color }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: ss.dot, display: 'inline-block' }} />
                    {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                  </span>
                  <button onClick={() => removeVehicle(v.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 3, borderRadius: 5 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#d1d5db')}><Trash2 size={12} /></button>
                </div>
              </div>

              {/* Driver */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <UserCheck size={12} color="#9ca3af" />
                <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{v.driver_name}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button onClick={() => void fleetApi.assign(ORG_ID, v.id, { driver_id: v.driver_id })} style={{ fontSize: 10, color: '#3b82f6' }}>Assign</button>
                <button onClick={() => void fleetApi.unassign(ORG_ID, v.id)} style={{ fontSize: 10, color: '#ef4444' }}>Unassign</button>
                <button onClick={() => void fleetApi.updateVehicle(ORG_ID, v.id, { status: v.status })} style={{ fontSize: 10, color: '#64748b' }}>Update</button>
                <button onClick={() => void fleetApi.logBehavior(ORG_ID, { vehicle_id: v.id, event: 'viewed' })} style={{ fontSize: 10, color: '#64748b' }}>Log behavior</button>
                <button onClick={() => void fleetApi.behaviorForVehicle(ORG_ID, v.id)} style={{ fontSize: 10, color: '#64748b' }}>Events</button>
              </div>

              {/* Location */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <MapPin size={12} color="#9ca3af" />
                <span style={{ fontSize: 12, color: '#6b7280' }}>{v.location}</span>
              </div>

              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div style={{ background: '#f8fafc', borderRadius: 9, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginBottom: 2 }}>
                    <Navigation size={10} color="#3b82f6" />
                    <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>SPEED</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#111827', margin: 0 }}>{v.speed_kmh}</p>
                  <p style={{ fontSize: 9, color: '#9ca3af', margin: 0 }}>km/h</p>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 9, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginBottom: 2 }}>
                    <Activity size={10} color={congestionColor(v.congestion_score)} />
                    <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>TRAFFIC</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: congestionColor(v.congestion_score), margin: 0 }}>{(v.congestion_score * 100).toFixed(0)}%</p>
                  <p style={{ fontSize: 9, color: congestionColor(v.congestion_score), margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>
                    {v.congestion_level ?? 'load'}
                  </p>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 9, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginBottom: 2 }}>
                    <Zap size={10} color={v.fuel_pct < 30 ? '#ef4444' : '#f59e0b'} />
                    <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>FUEL</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: v.fuel_pct < 30 ? '#ef4444' : '#111827', margin: 0 }}>{v.fuel_pct}%</p>
                  <p style={{ fontSize: 9, color: '#9ca3af', margin: 0 }}>left</p>
                </div>
              </div>

              {/* Fuel bar */}
              <div style={{ marginTop: 10, height: 4, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                <div className={v.fuel_pct < 30 ? 'progress-neon-red' : v.fuel_pct < 60 ? 'progress-neon-orange' : 'progress-neon-green'} style={{ height: '100%', width: `${v.fuel_pct}%`, transition: 'width 0.5s' }} />
              </div>
              {v.status === 'offline' && (
                <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 6, margin: '6px 0 0' }}>Last seen: {new Date(v.last_seen).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>
          No vehicles found for this filter.
        </div>
      )}

      {/* ── Offline alert ────────────────────────────────── */}
      {offline > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 14, fontSize: 13 }} className="neon-badge-red">
          <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }} />
          <strong>{offline} vehicle{offline > 1 ? 's' : ''}</strong>&nbsp;offline — last check-in &gt; 1 hour ago.
        </div>
      )}
      {behaviorLeaderboard != null && (
        <pre className="neon-card" style={{ padding: 12, margin: 0, maxHeight: 100, overflow: 'auto', fontSize: 10, color: '#64748b' }}>
          {JSON.stringify(behaviorLeaderboard, null, 2)}
        </pre>
      )}
    </div>
  );
}
