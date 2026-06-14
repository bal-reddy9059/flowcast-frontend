'use client';

import { useState, useEffect } from 'react';
import {
  Cloud, Sun, CloudRain, Wind, Thermometer, Droplets,
  Eye, MapPin, AlertTriangle, RefreshCw, Navigation,
} from 'lucide-react';
import api from '@/lib/api';

const CITIES = [
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai',
  'Kolkata', 'Pune', 'Ahmedabad', 'Surat', 'Jaipur',
  'Lucknow', 'Nagpur', 'Indore', 'Bhopal', 'Patna',
  'Visakhapatnam', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra',
];
const CONDITIONS = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Heavy Rain', 'Thunderstorm', 'Foggy', 'Windy'];

function genWeather(city: string) {
  const s = city.charCodeAt(0) * 31 + city.charCodeAt(1) * 7;
  const condition = CONDITIONS[s % CONDITIONS.length];
  const temp = 21 + (s % 19);
  const humidity = 44 + (s % 41);
  const wind = 7 + (s % 23);
  const visibility = condition.includes('Rain') || condition === 'Foggy' ? 2 + (s % 5) : 8 + (s % 7);
  const congestionModifier =
    condition === 'Heavy Rain' || condition === 'Thunderstorm' ? 0.42 + Math.random() * 0.1 :
    condition === 'Light Rain' || condition === 'Foggy' ? 0.18 + Math.random() * 0.1 :
    condition === 'Windy' ? 0.08 : 0;
  return { city, condition, temp, humidity, wind, visibility, congestionModifier };
}

const STUB = CITIES.map(genWeather);

function WeatherIcon({ condition, size = 22 }: { condition: string; size?: number }) {
  if (condition.includes('Rain') || condition === 'Thunderstorm') return <CloudRain size={size} />;
  if (condition.includes('Cloud')) return <Cloud size={size} />;
  if (condition === 'Foggy' || condition === 'Windy') return <Wind size={size} />;
  return <Sun size={size} />;
}

function condColors(cond: string) {
  if (cond === 'Heavy Rain' || cond === 'Thunderstorm')
    return { bg: '#0d2137', accent: '#60a5fa', text: '#dbeafe', glow: 'rgba(96,165,250,0.3)' };
  if (cond === 'Light Rain')
    return { bg: '#0d2137', accent: '#7dd3fc', text: '#e0f2fe', glow: 'rgba(125,211,252,0.25)' };
  if (cond.includes('Cloud'))
    return { bg: '#1e293b', accent: '#94a3b8', text: '#f1f5f9', glow: 'rgba(148,163,184,0.2)' };
  if (cond === 'Foggy')
    return { bg: '#1e293b', accent: '#cbd5e1', text: '#f8fafc', glow: 'rgba(203,213,225,0.2)' };
  return { bg: '#0c1f35', accent: '#fbbf24', text: '#fef3c7', glow: 'rgba(251,191,36,0.3)' };
}

function impactLabel(m: number) {
  if (m >= 0.35) return { label: 'Severe Impact', color: '#ef4444', bg: '#fef2f2', pct: Math.round(m * 100) };
  if (m >= 0.15) return { label: 'Moderate Impact', color: '#f59e0b', bg: '#fffbeb', pct: Math.round(m * 100) };
  if (m >= 0.05) return { label: 'Mild Impact', color: '#3b82f6', bg: '#eff6ff', pct: Math.round(m * 100) };
  return { label: 'No Impact', color: '#10b981', bg: '#ecfdf5', pct: 0 };
}

function tips(cond: string) {
  const base = [
    { e: '🚦', t: 'Check Live Traffic', d: 'Open the Live Traffic page for real-time congestion before you leave.' },
    { e: '⏰', t: 'Adjust Departure', d: 'Leaving 15–30 min earlier or later often avoids peak congestion.' },
  ];
  if (cond === 'Heavy Rain' || cond === 'Thunderstorm') return [
    { e: '🌧️', t: 'Rain Alert — Slow Down', d: 'Wet roads reduce braking distance by up to 50%. Allow extra following distance.' },
    { e: '💡', t: 'Use Headlights', d: 'Mandatory during heavy rain in India. Improves your visibility and others\'.' },
    { e: '🚧', t: 'Avoid Low Underpasses', d: 'Urban underpasses flood quickly. Monitor NDRF alerts for your city.' },
    ...base,
  ];
  if (cond === 'Light Rain') return [
    { e: '🌦️', t: 'Light Rain — Stay Alert', d: 'Initial rain washes oil off roads, making them slippery. Drive slowly for the first 20 min.' },
    ...base,
  ];
  if (cond === 'Foggy') return [
    { e: '🌫️', t: 'Fog Alert — Low Visibility', d: 'Use fog lights only (not high-beam). Keep 100+ m distance from vehicles ahead.' },
    { e: '📍', t: 'Use Familiar Routes', d: 'Avoid unfamiliar roads in fog. Stick to well-known, marked roads.' },
    ...base,
  ];
  return [
    { e: '☀️', t: 'Clear Conditions', d: 'Good visibility today. Normal commute expected — watch for peak-hour density.' },
    { e: '🚗', t: 'Peak Hours Still Apply', d: 'Even in clear weather, 8–10 am and 5–8 pm remain heavy across major cities.' },
    ...base,
  ];
}

type FilterKey = 'all' | 'rain' | 'clear' | 'impact';

export default function WeatherPage() {
  const [cities, setCities] = useState(STUB);
  const [selected, setSelected] = useState('Mumbai');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);

  const sel = cities.find(c => c.city === selected) ?? cities[0];
  const cc = condColors(sel.condition);
  const imp = impactLabel(sel.congestionModifier);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const r = await api.get('/weather/cities');
      if (r.data?.cities?.length) setCities(r.data.cities);
    } catch { /* stub */ }
    setRefreshing(false);
  };

  useEffect(() => { void fetchData(); }, []);

  const shown = cities.filter(c => {
    if (filter === 'rain') return c.condition.toLowerCase().includes('rain') || c.condition === 'Thunderstorm';
    if (filter === 'clear') return c.condition === 'Sunny' || c.condition === 'Partly Cloudy';
    if (filter === 'impact') return c.congestionModifier > 0.05;
    return true;
  });

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero ── */}
      <div className="page-hero" style={{ padding: '30px 36px', minHeight: 220 }}>
        {/* animated glow orb */}
        <div style={{ position: 'absolute', top: -50, right: -50, width: 240, height: 240, borderRadius: '50%', background: `radial-gradient(circle, ${cc.glow} 0%, transparent 70%)`, animation: 'glow-pulse 4s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: -60, left: '30%', width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${cc.glow} 0%, transparent 70%)`, animation: 'glow-pulse 6s ease-in-out infinite reverse' }} />

        <div className="flex items-start justify-between" style={{ position: 'relative', zIndex: 1 }}>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="icon-glow icon-glow-blue" style={{ width: 26, height: 26, borderRadius: 7 }}>
                <MapPin size={13} style={{ color: '#60a5fa' }} />
              </div>
              <span style={{ fontSize: 12.5, color: '#60a5fa', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Weather Impact
              </span>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em', margin: 0, lineHeight: 1 }}>
              {sel.city}
            </h1>
            <p style={{ fontSize: 16, color: '#94a3b8', marginTop: 6 }}>{sel.condition}</p>

            {/* metric row */}
            <div className="flex items-center gap-6 mt-5 flex-wrap">
              {[
                { icon: <Droplets size={13} />, label: 'Humidity', value: `${sel.humidity}%`, glowClass: 'icon-glow-blue' },
                { icon: <Wind size={13} />, label: 'Wind', value: `${sel.wind} km/h`, glowClass: 'icon-glow-purple' },
                { icon: <Eye size={13} />, label: 'Visibility', value: `${sel.visibility} km`, glowClass: 'icon-glow-green' },
                { icon: <AlertTriangle size={13} />, label: 'Traffic Impact', value: imp.label, glowClass: 'icon-glow-orange' },
              ].map(({ icon, label, value, glowClass }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`icon-glow ${glowClass}`} style={{ width: 26, height: 26, borderRadius: 7 }}>
                    {icon}
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ color: cc.accent, opacity: 0.9, float: 'right', animation: 'float 4s ease-in-out infinite' }}>
              <WeatherIcon condition={sel.condition} size={52} />
            </div>
            <p style={{ fontSize: 56, fontWeight: 900, color: '#f1f5f9', lineHeight: 1, letterSpacing: '-0.05em', marginTop: 12 }}>
              {sel.temp}°
            </p>
          </div>
        </div>

        {/* congestion impact bar */}
        {sel.congestionModifier > 0 && (
          <div style={{ position: 'relative', zIndex: 1, marginTop: 18 }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Congestion modifier</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: imp.color }}>+{imp.pct}%</span>
            </div>
            <div className={`progress-neon${imp.color === '#ef4444' ? '-red' : imp.color === '#f59e0b' ? '-orange' : ''}`}>
              <div style={{ width: `${imp.pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Filters + refresh ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'rain', 'clear', 'impact'] as FilterKey[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={filter === f ? 'btn-gradient' : 'btn-neon'}
              style={{
                padding: '7px 15px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {f === 'impact' ? 'Has Impact' : f === 'all' ? 'All Cities' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={fetchData}
          disabled={refreshing}
          className="btn-neon"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', opacity: refreshing ? 0.6 : 1 }}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* ── City grid ── */}
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))', gap: 12 }}>
        {shown.map((city) => {
          const c = condColors(city.condition);
          const im = impactLabel(city.congestionModifier);
          const isActive = city.city === selected;
          return (
            <div
              key={city.city}
              onClick={() => setSelected(city.city)}
              className="neon-card"
              style={{
                cursor: 'pointer',
                border: isActive ? '2px solid #3b82f6' : undefined,
                boxShadow: isActive ? '0 0 20px rgba(59,130,246,0.35)' : undefined,
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', margin: 0 }}>{city.city}</p>
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{city.condition}</p>
                </div>
                <div className="icon-glow icon-glow-blue" style={{ width: 32, height: 32, borderRadius: 9 }}>
                  <span style={{ color: c.accent }}>
                    <WeatherIcon condition={city.condition} size={16} />
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em' }}>
                  {city.temp}°C
                </span>
                <span
                  className={im.color === '#ef4444' ? 'neon-badge-red' : im.color === '#10b981' ? 'neon-badge-green' : 'neon-badge-blue'}
                  style={{ fontSize: 10.5 }}
                >
                  {im.label}
                </span>
              </div>

              {city.congestionModifier > 0.05 && (
                <div style={{ marginTop: 10 }}>
                  <div className="progress-neon" style={{ height: 4 }}>
                    <div style={{ width: `${im.pct}%` }} />
                  </div>
                  <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, margin: '4px 0 0' }}>
                    +{im.pct}% congestion
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Travel tips ── */}
      <div className="neon-card" style={{ padding: '22px 26px' }}>
        <h2 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>
          Travel Tips for <span className="gradient-text">{sel.city}</span>
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
          {tips(sel.condition).map((tip, i) => (
            <div
              key={i}
              className="glass-neon"
              style={{ display: 'flex', gap: 12, padding: '13px 15px', borderRadius: 11, animation: `slideUp 0.4s ease both`, animationDelay: `${i * 0.06}s` }}
            >
              <span style={{ fontSize: 22 }}>{tip.e}</span>
              <div>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', margin: '0 0 3px' }}>{tip.t}</p>
                <p style={{ fontSize: 11.5, color: '#64748b', margin: 0 }}>{tip.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
