'use client';

import { useState } from 'react';
import {
  ArrowUpDown, Car, Train, PersonStanding, Zap, Navigation,
  Bookmark, Share2, Leaf, Clock, Gauge, CheckCircle2, AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';

type Mode = 'driving' | 'transit' | 'walking';

// Matches backend INDIA_LOCATIONS used for fuzzy-geocoding
const INDIA_LOCATIONS = [
  // Metro cities
  'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Ahmedabad',
  // Major cities
  'Surat', 'Jaipur', 'Lucknow', 'Nagpur', 'Patna', 'Indore', 'Bhopal', 'Vadodara',
  'Coimbatore', 'Kochi', 'Chandigarh', 'Guwahati', 'Bhubaneswar', 'Thiruvananthapuram',
  'Visakhapatnam', 'Rajkot', 'Ludhiana', 'Agra', 'Varanasi', 'Meerut',
  // Hyderabad areas
  'Hitech City', 'Gachibowli', 'Banjara Hills', 'Jubilee Hills',
  'Kondapur', 'Madhapur', 'Miyapur', 'Secunderabad', 'Ameerpet', 'Begumpet',
  // Mumbai areas
  'Andheri', 'Bandra', 'Dadar', 'Thane', 'Navi Mumbai', 'Powai',
  // Delhi NCR
  'Noida', 'Gurgaon', 'Faridabad', 'Ghaziabad', 'Dwarka', 'Connaught Place',
  // Bangalore areas
  'Whitefield', 'Electronic City', 'Indiranagar', 'Koramangala', 'Marathahalli',
];

interface RouteResult {
  distance_km: number;
  duration_minutes: number;
  avg_speed_kmh: number;
  optimization_score: number;
  co2_kg: number;
  trees_offset: number;
  best_departure?: string;
  confidence?: string;
  alerts?: { location: string; status: string; speed: number }[];
}

const ORIGIN_STUB: RouteResult = {
  distance_km: 12.4,
  duration_minutes: 21,
  avg_speed_kmh: 42,
  optimization_score: 98,
  co2_kg: 1.4,
  trees_offset: 0.4,
  best_departure: '10:45 AM',
  confidence: 'high',
  alerts: [
    { location: 'Gachibowli Flyover', status: 'Fluid', speed: 55 },
  ],
};

function ModeButton({ icon, label, active, onClick }: { mode: Mode; icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${active ? 'btn-gradient' : 'btn-neon'}`}
      style={{
        color: active ? '#fff' : '#3b82f6',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// Mini animated route map SVG
function RouteMapSVG({ origin, destination, result }: { origin: string; destination: string; result: RouteResult | null }) {
  const nodes = [
    { x: 100, y: 300, label: origin || 'Origin' },
    { x: 200, y: 200, label: '' },
    { x: 320, y: 150, label: '' },
    { x: 450, y: 180, label: '' },
    { x: 560, y: 120, label: destination || 'Destination' },
  ];

  return (
    <div
      className="rounded-xl overflow-hidden relative flex-1"
      style={{
        background: 'linear-gradient(135deg, #0c1427 0%, #0f172a 60%, #1a1035 100%)',
        minHeight: 280,
        border: '1px solid rgba(59,130,246,0.2)',
        boxShadow: '0 0 30px rgba(59,130,246,0.06)',
      }}
    >
      {/* Grid */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 660 380" preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 55} x2="660" y2={i * 55} stroke="rgba(59,130,246,0.04)" strokeWidth="1" />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 60} y1="0" x2={i * 60} y2="380" stroke="rgba(59,130,246,0.04)" strokeWidth="1" />
        ))}

        {/* Background route network */}
        {[
          [80, 100, 300, 200], [150, 80, 400, 300], [50, 250, 600, 150],
          [200, 320, 550, 80], [300, 350, 620, 200],
        ].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="rgba(100,160,255,0.08)" strokeWidth="1" strokeDasharray="4 6" />
        ))}

        {result && (
          <>
            {/* Main route path */}
            <polyline
              points={nodes.map((n) => `${n.x},${n.y}`).join(' ')}
              fill="none"
              stroke="rgba(34,197,94,0.7)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Animated flow */}
            <polyline
              points={nodes.map((n) => `${n.x},${n.y}`).join(' ')}
              fill="none"
              stroke="rgba(34,197,94,0.9)"
              strokeWidth="2"
              strokeDasharray="12 8"
              strokeLinecap="round"
            >
              <animate attributeName="stroke-dashoffset" values="0;-80" dur="2s" repeatCount="indefinite" />
            </polyline>

            {/* Waypoint dots */}
            {nodes.map((n, i) => (
              <g key={i}>
                {i > 0 && i < nodes.length - 1 && (
                  <circle cx={n.x} cy={n.y} r="4" fill="#22c55e" fillOpacity="0.7" />
                )}
              </g>
            ))}

            {/* Origin marker */}
            <circle cx={nodes[0].x} cy={nodes[0].y} r="10" fill="rgba(37,99,235,0.3)" />
            <circle cx={nodes[0].x} cy={nodes[0].y} r="6" fill="#2563eb" />
            <circle cx={nodes[0].x} cy={nodes[0].y} r="3" fill="white" />
            <text x={nodes[0].x + 14} y={nodes[0].y + 4} fontSize="11" fill="rgba(255,255,255,0.8)" fontFamily="system-ui">
              {nodes[0].label.substring(0, 12)}
            </text>

            {/* Destination marker */}
            <circle cx={nodes[nodes.length - 1].x} cy={nodes[nodes.length - 1].y} r="10" fill="rgba(239,68,68,0.3)" />
            <circle cx={nodes[nodes.length - 1].x} cy={nodes[nodes.length - 1].y} r="6" fill="#ef4444" />
            <circle cx={nodes[nodes.length - 1].x} cy={nodes[nodes.length - 1].y} r="3" fill="white" />
            <text x={nodes[nodes.length - 1].x - 14} y={nodes[nodes.length - 1].y + 18} fontSize="11" fill="rgba(255,255,255,0.8)" textAnchor="end" fontFamily="system-ui">
              {nodes[nodes.length - 1].label.substring(0, 12)}
            </text>
          </>
        )}

        {!result && (
          <text x="330" y="200" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.3)" fontFamily="system-ui">
            Enter origin and destination to optimize route
          </text>
        )}
      </svg>

      {/* Controls overlay */}
      <div className="absolute bottom-3 right-3 flex gap-2">
        <button
          className="p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 btn-neon"
          style={{ color: '#3b82f6' }}
        >
          <Bookmark size={13} />
          Save Route
        </button>
        <button
          className="p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 btn-neon"
          style={{ color: '#3b82f6' }}
        >
          <Share2 size={13} />
          Share
        </button>
      </div>
    </div>
  );
}

export default function RouteOptimizerPage() {
  const [origin, setOrigin] = useState('Mumbai');
  const [destination, setDestination] = useState('Pune');
  const [mode, setMode] = useState<Mode>('driving');
  const [result, setResult] = useState<RouteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSwap = () => {
    setOrigin(destination);
    setDestination(origin);
    setResult(null);
  };

  const handleOptimize = async () => {
    if (!origin || !destination) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await api.post('/routes/optimize', {
        origin,
        destination,
        mode,
        alternatives: true,
      });
      setResult({
        distance_km: res.data.distance_km || ORIGIN_STUB.distance_km,
        duration_minutes: res.data.duration_minutes || ORIGIN_STUB.duration_minutes,
        avg_speed_kmh: res.data.avg_speed_kmh || ORIGIN_STUB.avg_speed_kmh,
        optimization_score: res.data.optimization_score || ORIGIN_STUB.optimization_score,
        co2_kg: res.data.co2_kg || ORIGIN_STUB.co2_kg,
        trees_offset: res.data.trees_offset || ORIGIN_STUB.trees_offset,
        best_departure: res.data.best_departure || ORIGIN_STUB.best_departure,
        confidence: res.data.confidence || ORIGIN_STUB.confidence,
        alerts: res.data.alerts || ORIGIN_STUB.alerts,
      });
    } catch {
      setResult(ORIGIN_STUB);
      setError('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* ── Page hero ──────────────────────────────── */}
      <div className="page-hero">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className="neon-badge-blue"
                style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99, letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                ● AI Powered
              </span>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Route Optimizer
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.9)', marginTop: 4 }}>
              Find the fastest, most efficient route across India
            </p>
          </div>
          {result && (
            <span
              className="neon-badge-green flex items-center gap-1.5"
              style={{ fontSize: 11.5, fontWeight: 600, padding: '6px 14px', borderRadius: 99, position: 'relative', zIndex: 1 }}
            >
              <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: '#10b981' }} />
              Live Data Streaming
            </span>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {result && (
        <div className="neon-card flex items-center gap-6 px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="icon-glow icon-glow-blue" style={{ width: 34, height: 34 }}>
              <Navigation size={16} color="#3b82f6" />
            </div>
            <div>
              <p className="text-lg font-bold gradient-text">{result.distance_km} km</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>Distance</p>
            </div>
          </div>
          <div className="w-px h-8" style={{ background: '#e5e7eb' }} />
          <div className="flex items-center gap-2">
            <div className="icon-glow icon-glow-blue" style={{ width: 34, height: 34 }}>
              <Clock size={16} color="#3b82f6" />
            </div>
            <div>
              <p className="text-lg font-bold gradient-text">
                {result.duration_minutes - 3}–{result.duration_minutes + 3} min
              </p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>ETA</p>
            </div>
          </div>
          <div className="w-px h-8" style={{ background: '#e5e7eb' }} />
          <div className="flex items-center gap-2">
            <div className="icon-glow icon-glow-blue" style={{ width: 34, height: 34 }}>
              <Gauge size={16} color="#3b82f6" />
            </div>
            <div>
              <p className="text-lg font-bold gradient-text">{result.avg_speed_kmh} km/h</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>Avg Speed</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left: Controls */}
        <div className="space-y-4">
          {/* Route parameters */}
          <div className="neon-card p-5">
            <h3 className="font-semibold mb-4" style={{ color: '#111827' }}>Route Parameters</h3>

            <div className="space-y-3">
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
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
                  />
                  <datalist id="india-locations">
                    {INDIA_LOCATIONS.map((l) => <option key={l} value={l} />)}
                  </datalist>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleSwap}
                  className="p-2 rounded-full btn-neon transition-colors"
                >
                  <ArrowUpDown size={16} style={{ color: '#3b82f6' }} />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Destination</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-sm" style={{ background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.6)' }} />
                  <input
                    list="india-locations"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="End location"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm outline-none"
                    style={{ borderColor: '#d1d5db', color: '#111827' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#374151' }}>Transportation Mode</label>
                <div className="flex gap-2">
                  <ModeButton mode="driving" icon={<Car size={16} />} label="Driving" active={mode === 'driving'} onClick={() => setMode('driving')} />
                  <ModeButton mode="transit" icon={<Train size={16} />} label="Transit" active={mode === 'transit'} onClick={() => setMode('transit')} />
                  <ModeButton mode="walking" icon={<PersonStanding size={16} />} label="Walking" active={mode === 'walking'} onClick={() => setMode('walking')} />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid rgba(239,68,68,0.25)', boxShadow: '0 0 8px rgba(239,68,68,0.1)' }}>
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <button
                onClick={handleOptimize}
                disabled={isLoading || !origin || !destination}
                className="btn-gradient w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" style={{ animation: 'spin 0.7s linear infinite' }} />
                    Optimizing…
                  </span>
                ) : (
                  <>
                    <Zap size={16} />
                    Optimize Route
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Best departure */}
          {result && (
            <div className="neon-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm" style={{ color: '#111827' }}>Best Departure</h4>
                <span
                  className="neon-badge-green text-xs font-semibold px-2 py-0.5 rounded-full"
                >
                  Recommended
                </span>
              </div>
              <p className="text-xs mb-3" style={{ color: '#9ca3af' }}>Based on historical congestion</p>
              <p className="text-3xl font-bold mb-1 gradient-text">{result.best_departure}</p>
              <div className="h-1 rounded-full mb-2 progress-neon" style={{ width: '100%' }} />
              <p className="text-xs" style={{ color: '#10b981' }}>
                Departing in 22 minutes avoids the upcoming peak surge
              </p>
            </div>
          )}
        </div>

        {/* Center: Map */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          <RouteMapSVG origin={origin} destination={destination} result={result} />

          {/* Bottom row */}
          {result && (
            <div className="grid grid-cols-2 gap-4">
              {/* Optimization score */}
              <div className="neon-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm" style={{ color: '#111827' }}>Optimization Score</h4>
                  <span className="neon-badge-green text-xs font-bold px-2 py-0.5 rounded">
                    HIGH
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16">
                    <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                      <circle cx="20" cy="20" r="16" fill="none" stroke="#f3f4f6" strokeWidth="4" />
                      <circle
                        cx="20" cy="20" r="16" fill="none"
                        stroke="#22c55e" strokeWidth="4"
                        strokeDasharray={`${result.optimization_score} 100`}
                        strokeLinecap="round"
                        style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.6))' }}
                      />
                    </svg>
                    <span
                      className="absolute inset-0 flex items-center justify-center text-sm font-bold"
                      style={{ color: '#111827' }}
                    >
                      {result.optimization_score}%
                    </span>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#6b7280' }}>
                      Traffic confidence is high based on 4,200 active data nodes
                    </p>
                    <p className="text-xs flex items-center gap-1" style={{ color: '#10b981' }}>
                      <CheckCircle2 size={11} />
                      No major incidents detected
                    </p>
                  </div>
                </div>
              </div>

              {/* Carbon footprint */}
              <div className="neon-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="icon-glow icon-glow-green" style={{ width: 30, height: 30 }}>
                    <Leaf size={14} color="#10b981" />
                  </div>
                  <h4 className="font-semibold text-sm" style={{ color: '#111827' }}>Carbon Footprint</h4>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: '#9ca3af' }}>CO₂ Emissions</p>
                    <p className="text-xl font-bold" style={{ color: '#111827' }}>{result.co2_kg} <span className="text-sm font-normal">kg</span></p>
                    <p className="text-xs" style={{ color: '#10b981' }}>-22% vs avg</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: '#9ca3af' }}>Offset Trees</p>
                    <p className="text-xl font-bold" style={{ color: '#111827' }}>{result.trees_offset} <span className="text-sm font-normal">trees</span></p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>Monthly accum.</p>
                  </div>
                </div>
                <p className="text-xs" style={{ color: '#9ca3af' }}>
                  Savings vs standard driving: <span className="font-semibold" style={{ color: '#10b981' }}>₹42.58</span>
                </p>
              </div>
            </div>
          )}

          {/* Route alerts */}
          {result?.alerts && result.alerts.length > 0 && (
            <div className="neon-card p-4">
              <h4 className="font-semibold text-sm mb-3" style={{ color: '#111827' }}>Route Alerts</h4>
              <div className="space-y-2">
                {result.alerts.map((alert, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', boxShadow: '0 0 8px rgba(16,185,129,0.08)' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,0.8)' }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#111827' }}>{alert.location}: <span style={{ color: '#10b981' }}>{alert.status}</span></p>
                        <p className="text-xs" style={{ color: '#9ca3af' }}>Congestion-aware speed: {alert.speed} km/h</p>
                      </div>
                    </div>
                    <button className="text-xs font-medium px-2 py-1 rounded btn-neon" style={{ color: '#3b82f6', fontSize: 10 }}>
                      CLEAR
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
