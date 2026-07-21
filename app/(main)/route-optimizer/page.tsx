'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  ArrowUpDown, Car, Train, PersonStanding, Zap, Navigation,
  Bookmark, Share2, Leaf, Clock, Gauge, CheckCircle2, AlertCircle, Trash2,
} from 'lucide-react';
import { routeApi } from '@/lib/api';
import type { RouteNarrativeData, RouteResult, SavedRoute } from '@/lib/types';

type Mode = 'driving' | 'transit' | 'walking';

const INDIA_LOCATIONS = [
  'Mumbai', 'Delhi', 'Bangalore', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Ahmedabad',
  'Surat', 'Jaipur', 'Lucknow', 'Nagpur', 'Patna', 'Indore', 'Bhopal', 'Vadodara',
  'Coimbatore', 'Kochi', 'Chandigarh', 'Guwahati', 'Bhubaneswar', 'Thiruvananthapuram',
  'Visakhapatnam', 'Rajkot', 'Ludhiana', 'Agra', 'Varanasi', 'Meerut',
  'Hitech City', 'Gachibowli', 'Banjara Hills', 'Jubilee Hills',
  'Kondapur', 'Madhapur', 'Miyapur', 'Secunderabad', 'Ameerpet', 'Begumpet',
  'Rajiv Gandhi International Airport', 'Rajiv Gandhi International Airport, Hyderabad', 'RGIA', 'Hyderabad Airport',
  'Kempegowda International Airport', 'Chhatrapati Shivaji Maharaj International Airport',
  'Indira Gandhi International Airport', 'Chennai Airport',
  'Andheri', 'Bandra', 'Dadar', 'Thane', 'Navi Mumbai', 'Powai',
  'Noida', 'Gurgaon', 'Faridabad', 'Ghaziabad', 'Dwarka', 'Connaught Place',
  'Whitefield', 'Electronic City', 'Indiranagar', 'Koramangala', 'Marathahalli', 'MG Road, Bengaluru',
];

function apiError(e: unknown) {
  const err = e as { response?: { data?: { error?: string; detail?: string } }; message?: string };
  return err.response?.data?.error
    || err.response?.data?.detail
    || err.message
    || 'Route request failed';
}

function alertColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes('accident') || s.includes('closure') || s.includes('blocked')) return '#ef4444';
  if (s.includes('event') || s.includes('delay') || s.includes('congest')) return '#f59e0b';
  return '#22c55e';
}

function congColor(level?: string) {
  const l = (level || '').toLowerCase();
  if (l === 'high') return '#ef4444';
  if (l === 'medium') return '#f59e0b';
  return '#22c55e';
}

function ModeButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${active ? 'btn-gradient' : 'btn-neon'}`}
      style={{ color: active ? '#fff' : '#3b82f6' }}
    >
      {icon}
      {label}
    </button>
  );
}

function RouteMapSVG({ origin, destination, result }: { origin: string; destination: string; result: RouteResult | null }) {
  const nodes = [
    { x: 100, y: 300 },
    { x: 200, y: 200 },
    { x: 320, y: 150 },
    { x: 450, y: 180 },
    { x: 560, y: 120 },
  ];

  return (
    <div
      className="rounded-xl overflow-hidden relative flex-1"
      style={{
        background: 'linear-gradient(135deg, #0c1427 0%, #0f172a 60%, #1a1035 100%)',
        minHeight: 280,
        border: '1px solid rgba(59,130,246,0.2)',
      }}
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 660 380" preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 55} x2="660" y2={i * 55} stroke="rgba(59,130,246,0.04)" strokeWidth="1" />
        ))}
        {result && (
          <>
            <polyline
              points={nodes.map((n) => `${n.x},${n.y}`).join(' ')}
              fill="none"
              stroke="rgba(34,197,94,0.7)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={nodes[0].x} cy={nodes[0].y} r="8" fill="#3b82f6" />
            <circle cx={nodes[nodes.length - 1].x} cy={nodes[nodes.length - 1].y} r="8" fill="#ef4444" />
          </>
        )}
      </svg>
      <div style={{ position: 'absolute', left: 16, bottom: 16, color: '#94a3b8', fontSize: 12 }}>
        <p style={{ margin: 0, fontWeight: 700, color: '#e2e8f0' }}>{origin || 'Origin'}</p>
        <p style={{ margin: '2px 0 0' }}>→ {destination || 'Destination'}</p>
        {result && (
          <p style={{ margin: '6px 0 0', color: '#86efac' }}>
            {result.distance_km} km · {result.duration_minutes} min · {result.congestion_summary || '—'}
          </p>
        )}
      </div>
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

export default function RouteOptimizerPage() {
  const [origin, setOrigin] = useState('Gachibowli');
  const [destination, setDestination] = useState('Rajiv Gandhi International Airport');
  const [routeName, setRouteName] = useState('Home to Airport');
  const [mode, setMode] = useState<Mode>('driving');
  const [result, setResult] = useState<RouteResult | null>(null);
  const [narrative, setNarrative] = useState<RouteNarrativeData | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [shareMsg, setShareMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadSaved = useCallback(async () => {
    try {
      const res = await routeApi.saved();
      setSavedRoutes(res.data);
    } catch { /* optional */ }
  }, []);

  useEffect(() => { void loadSaved(); }, [loadSaved]);

  const handleSwap = () => {
    setOrigin(destination);
    setDestination(origin);
    setResult(null);
    setNarrative(null);
  };

  const handleOptimize = async () => {
    if (!origin.trim() || !destination.trim()) return;
    setIsLoading(true);
    setError('');
    setShareMsg('');
    try {
      const res = await routeApi.optimize({
        origin: origin.trim(),
        destination: destination.trim(),
        mode,
      });
      setResult(res.data);
      try {
        const n = await routeApi.narrative({
          origin: res.data.origin || origin.trim(),
          destination: res.data.destination || destination.trim(),
          ...(res.data.distance_km != null ? { distance_km: res.data.distance_km } : {}),
        });
        setNarrative(n.data);
      } catch {
        setNarrative(null);
      }
    } catch (e) {
      setResult(null);
      setNarrative(null);
      setError(apiError(e));
    } finally {
      setIsLoading(false);
    }
  };

  const saveRoute = async () => {
    if (!origin.trim() || !destination.trim()) {
      setError('Origin and destination names are required to save.');
      return;
    }
    setError('');
    try {
      await routeApi.save({
        route_name: routeName.trim() || `${origin} → ${destination}`,
        origin_name: (result?.origin || origin).trim(),
        destination_name: (result?.destination || destination).trim(),
        mode,
      });
      await loadSaved();
      setShareMsg('Route saved (names only — backend geocodes lat/lng).');
    } catch (e) {
      setError(apiError(e));
    }
  };

  const deleteSavedRoute = async (id: string) => {
    try { await routeApi.deleteSaved(id); } catch { /* optimistic */ }
    setSavedRoutes((routes) => routes.filter((route) => route.id !== id));
  };

  const shareSavedRoute = async (id: string) => {
    setShareMsg('');
    setError('');
    try {
      const res = await routeApi.share(id);
      const token = res.data.token || res.data.share_token;
      if (!token) {
        setError('Share succeeded but no token was returned.');
        return;
      }
      const link = `${window.location.origin}/shared/${token}`;
      try { await navigator.clipboard.writeText(link); } catch { /* ignore */ }
      setShareMsg(`Share link copied: ${link}`);
    } catch (e) {
      setError(apiError(e));
    }
  };

  const loadSavedIntoForm = (route: SavedRoute) => {
    setOrigin(route.origin_name);
    setDestination(route.destination_name);
    setRouteName(route.route_name);
    setResult(null);
    setNarrative(null);
  };

  const score = result?.optimization_score ?? 0;
  const delay = narrative?.traffic?.delay_minutes;
  const congestion = result?.congestion_summary || narrative?.traffic?.congestion_level;

  return (
    <div className="space-y-4">
      <div className="page-hero">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="neon-badge-blue" style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                ● AI Powered
              </span>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Route Optimizer
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.9)', marginTop: 4 }}>
              Google Maps + live traffic · India coords only · save, share &amp; narrative
            </p>
          </div>
          {result && (
            <span className="neon-badge-green flex items-center gap-1.5" style={{ fontSize: 11.5, fontWeight: 600, padding: '6px 14px', borderRadius: 99 }}>
              <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: '#10b981' }} />
              {result.confidence || 'live'} confidence
            </span>
          )}
        </div>
      </div>

      {result && (
        <div className="neon-card flex items-center gap-6 px-5 py-3" style={{ flexWrap: 'wrap' }}>
          <div className="flex items-center gap-2">
            <div className="icon-glow icon-glow-blue" style={{ width: 34, height: 34 }}><Navigation size={16} color="#3b82f6" /></div>
            <div>
              <p className="text-lg font-bold gradient-text">{result.distance_km} km</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>Distance</p>
            </div>
          </div>
          <div className="w-px h-8" style={{ background: '#e5e7eb' }} />
          <div className="flex items-center gap-2">
            <div className="icon-glow icon-glow-blue" style={{ width: 34, height: 34 }}><Clock size={16} color="#3b82f6" /></div>
            <div>
              <p className="text-lg font-bold gradient-text">{result.duration_minutes} min</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>ETA</p>
            </div>
          </div>
          <div className="w-px h-8" style={{ background: '#e5e7eb' }} />
          <div className="flex items-center gap-2">
            <div className="icon-glow icon-glow-blue" style={{ width: 34, height: 34 }}><Gauge size={16} color="#3b82f6" /></div>
            <div>
              <p className="text-lg font-bold gradient-text">{result.avg_speed_kmh} km/h</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>Avg Speed</p>
            </div>
          </div>
          {congestion && (
            <>
              <div className="w-px h-8" style={{ background: '#e5e7eb' }} />
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, textTransform: 'capitalize',
                color: congColor(congestion), background: `${congColor(congestion)}14`, border: `1px solid ${congColor(congestion)}33`,
              }}>
                {congestion} congestion
              </span>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="space-y-4">
          <div className="neon-card p-5">
            <h3 className="font-semibold mb-4" style={{ color: '#111827' }}>Route Parameters</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Route name (for save)</label>
                <input
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                  style={{ borderColor: '#d1d5db', color: '#111827' }}
                  placeholder="Home to Office"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Origin</label>
                <div className="relative">
                  <Navigation size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#2563eb' }} />
                  <input
                    list="india-locations"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="Start location"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm outline-none"
                    style={{ borderColor: '#d1d5db', color: '#111827' }}
                  />
                  <datalist id="india-locations">
                    {INDIA_LOCATIONS.map((l) => <option key={l} value={l} />)}
                  </datalist>
                </div>
              </div>

              <div className="flex justify-center">
                <button onClick={handleSwap} className="p-2 rounded-full btn-neon transition-colors">
                  <ArrowUpDown size={16} style={{ color: '#3b82f6' }} />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Destination</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-sm" style={{ background: '#ef4444' }} />
                  <input
                    list="india-locations"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="End location / airport"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm outline-none"
                    style={{ borderColor: '#d1d5db', color: '#111827' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#374151' }}>Mode</label>
                <div className="flex gap-2">
                  <ModeButton icon={<Car size={16} />} label="Driving" active={mode === 'driving'} onClick={() => setMode('driving')} />
                  <ModeButton icon={<Train size={16} />} label="Transit" active={mode === 'transit'} onClick={() => setMode('transit')} />
                  <ModeButton icon={<PersonStanding size={16} />} label="Walking" active={mode === 'walking'} onClick={() => setMode('walking')} />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg text-sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}
              {shareMsg && (
                <div className="flex items-start gap-2 p-3 rounded-lg text-sm" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', wordBreak: 'break-all' }}>
                  <CheckCircle2 size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>{shareMsg}</span>
                </div>
              )}

              <button
                onClick={() => void handleOptimize()}
                disabled={isLoading || !origin || !destination}
                className="btn-gradient w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
              >
                {isLoading ? 'Optimizing…' : (<><Zap size={16} /> Optimize Route</>)}
              </button>
              <button
                onClick={() => void saveRoute()}
                disabled={!origin.trim() || !destination.trim()}
                className="btn-neon w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
                style={{ color: '#2563eb' }}
              >
                <Bookmark size={15} />
                Save by name
              </button>
            </div>
          </div>

          {result?.best_departure && (
            <div className="neon-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm" style={{ color: '#111827' }}>Best Departure</h4>
                <span className="neon-badge-green text-xs font-semibold px-2 py-0.5 rounded-full">Recommended</span>
              </div>
              <p className="text-3xl font-bold mb-1 gradient-text">{result.best_departure}</p>
              <p className="text-xs" style={{ color: '#64748b' }}>Based on live corridor congestion</p>
            </div>
          )}
        </div>

        <div className="xl:col-span-2 flex flex-col gap-4">
          <RouteMapSVG origin={origin} destination={destination} result={result} />

          {result && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="neon-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm" style={{ color: '#111827' }}>Optimization Score</h4>
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{
                    background: score >= 80 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                    color: score >= 80 ? '#10b981' : '#f59e0b',
                  }}>
                    {score >= 80 ? 'HIGH' : 'MEDIUM'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16">
                    <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                      <circle cx="20" cy="20" r="16" fill="none" stroke="#f3f4f6" strokeWidth="4" />
                      <circle
                        cx="20" cy="20" r="16" fill="none"
                        stroke={score >= 80 ? '#22c55e' : '#f59e0b'} strokeWidth="4"
                        strokeDasharray={`${score} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color: '#111827' }}>
                      {score}%
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: '#6b7280' }}>
                    Mode: <strong style={{ textTransform: 'capitalize' }}>{result.mode || mode}</strong>
                    {(result.alerts?.length ?? 0) === 0
                      ? ' · No corridor alerts'
                      : ` · ${result.alerts!.length} alert${result.alerts!.length === 1 ? '' : 's'}`}
                  </p>
                </div>
              </div>

              <div className="neon-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="icon-glow icon-glow-green" style={{ width: 30, height: 30 }}>
                    <Leaf size={14} color="#10b981" />
                  </div>
                  <h4 className="font-semibold text-sm" style={{ color: '#111827' }}>Carbon Footprint</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: '#9ca3af' }}>CO₂</p>
                    <p className="text-xl font-bold" style={{ color: '#111827' }}>{result.co2_kg ?? '—'} <span className="text-sm font-normal">kg</span></p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: '#9ca3af' }}>Trees offset</p>
                    <p className="text-xl font-bold" style={{ color: '#111827' }}>{result.trees_offset ?? '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {result?.alerts && result.alerts.length > 0 && (
            <div className="neon-card p-4">
              <h4 className="font-semibold text-sm mb-3" style={{ color: '#111827' }}>Route Alerts</h4>
              <p className="text-xs mb-3" style={{ color: '#94a3b8' }}>Deduped corridor incidents from the last hour</p>
              <div className="space-y-2">
                {result.alerts.map((alert, i) => {
                  const color = alertColor(alert.status);
                  return (
                    <div
                      key={`${alert.location}-${alert.status}-${i}`}
                      className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ background: `${color}10`, border: `1px solid ${color}33` }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#111827' }}>
                            {alert.location}: <span style={{ color }}>{alert.status}</span>
                          </p>
                          <p className="text-xs" style={{ color: '#9ca3af' }}>Speed near incident: {alert.speed} km/h</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {result && (
            <div className="neon-card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div style={{ flex: 1, minWidth: 220 }}>
                  <h4 className="font-semibold text-sm" style={{ color: '#111827' }}>Route narrative</h4>
                  <p className="text-sm mt-2" style={{ color: '#334155', lineHeight: 1.5 }}>
                    {narrative?.narrative || 'Generate an optimize result to load the narrative.'}
                  </p>
                  {narrative?.traffic && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                      <Chip label={`ETA ${narrative.traffic.eta_minutes ?? '—'} min`} />
                      <Chip label={`Expected ${narrative.traffic.expected_eta_minutes ?? '—'} min`} />
                      <Chip
                        label={delay != null ? `Delay ${Number(delay).toFixed(1)} min` : 'Delay —'}
                        color={delay != null && delay > 20 ? '#ef4444' : '#f59e0b'}
                      />
                      <Chip
                        label={narrative.traffic.congestion_level || '—'}
                        color={congColor(narrative.traffic.congestion_level)}
                      />
                      <Chip label={`${narrative.active_incidents ?? 0} incidents`} />
                    </div>
                  )}
                </div>
                <button onClick={() => void saveRoute()} className="btn-gradient px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <Bookmark size={13} /> Save route
                </button>
              </div>
            </div>
          )}

          <div className="neon-card p-4">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div>
                <h4 className="font-semibold text-sm" style={{ color: '#111827' }}>Saved routes</h4>
                <p className="text-xs" style={{ color: '#94a3b8' }}>
                  Share copies /shared/&#123;token&#125; from POST share — not the route UUID
                </p>
              </div>
              <button onClick={() => void loadSaved()} className="btn-neon px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ color: '#2563eb' }}>
                Refresh
              </button>
            </div>
            {savedRoutes.length === 0 ? (
              <p className="text-sm" style={{ color: '#94a3b8', margin: 0 }}>No saved routes yet.</p>
            ) : (
              <div className="space-y-2">
                {savedRoutes.map((route) => (
                  <div
                    key={route.id}
                    className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg"
                    style={{ border: '1px solid #e2e8f0', background: '#fff', flexWrap: 'wrap' }}
                  >
                    <button type="button" onClick={() => loadSavedIntoForm(route)} style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', flex: 1, minWidth: 160 }}>
                      <p className="text-sm font-semibold" style={{ color: '#0f172a', margin: 0 }}>{route.route_name}</p>
                      <p className="text-xs" style={{ color: '#64748b', margin: '2px 0 0' }}>
                        {route.origin_name} → {route.destination_name}
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      <button onClick={() => void shareSavedRoute(route.id)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Share2 size={12} /> Share
                      </button>
                      <button onClick={() => void deleteSavedRoute(route.id)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
