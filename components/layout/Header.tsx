'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Search, Wifi, WifiOff, ChevronDown, LogOut, User, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard':        { title: 'Dashboard',              subtitle: 'Real-time network overview' },
  '/india-map':        { title: 'India Live Map',          subtitle: '766 districts — WebSocket feed' },
  '/analytics':        { title: 'Analytics',              subtitle: 'Network intelligence & trends' },
  '/route-optimizer':  { title: 'Route Optimizer',        subtitle: 'AI-powered route planning' },
  '/commute-planner':  { title: 'Commute Planner',        subtitle: 'Rush-hour forecasts & alerts' },
  '/org':              { title: 'Organizations',           subtitle: 'Teams, roles & member management' },
  '/fleet':            { title: 'Fleet Management',        subtitle: 'Vehicles, drivers & live tracking' },
  '/zones':            { title: 'Geofence Zones',          subtitle: 'Smart zone monitoring & breach alerts' },
  '/webhooks':         { title: 'Webhooks',                subtitle: 'Push integrations with HMAC signing' },
  '/rules':            { title: 'Alert Rules',             subtitle: 'Custom rule engine & trigger history' },
  '/reports':          { title: 'Traffic Reports',         subtitle: 'Daily, weekly & fleet analytics' },
  '/live-traffic':     { title: 'Live Traffic Control',    subtitle: 'Car stream · Pulse events · ML live feed · Real-time ETA tracker' },
  '/heatmap':          { title: 'Traffic Heatmap',         subtitle: 'Congestion intensity across India' },
  '/ai-copilot':       { title: 'AI Traffic Copilot',     subtitle: 'Ask anything about traffic in plain English' },
  '/departure-coach':  { title: 'Departure Coach',         subtitle: 'Personalized AI departure timing' },
  '/traffic-stories':  { title: 'Traffic Stories',         subtitle: 'AI-generated live traffic news feed' },
  '/stress-score':     { title: 'Commute Stress Score',   subtitle: 'Wellness metric for your daily drive' },
  '/multimodal':       { title: 'Multimodal Planner',     subtitle: 'Optimal mix of drive, metro & auto' },
  '/fleet-insights':   { title: 'Fleet AI Insights',      subtitle: 'AI patterns your fleet manager will miss' },
  '/weather':          { title: 'Weather Impact',          subtitle: 'Live weather & traffic modifiers across 20 cities' },
  '/incidents':        { title: 'Incident Reports',        subtitle: 'Community-reported traffic events with live voting' },
  '/ml-predict':       { title: 'ML Prediction',           subtitle: 'RandomForest congestion forecast — auto-retrains every 6h' },
  '/developer':        { title: 'Developer Portal',        subtitle: 'API key management, usage quotas & endpoints' },
  '/notifications':    { title: 'Notifications',           subtitle: 'Alerts & system events' },
  '/admin':            { title: 'Admin Panel',             subtitle: 'System management' },
  '/settings':         { title: 'Settings',                subtitle: 'Account & preferences' },
  '/support':          { title: 'Support',                 subtitle: 'Help & documentation' },
};

export default function Header() {
  const { user, logout } = useAuth();
  const { unreadCount, isConnected } = useNotifications();
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [latency, setLatency] = useState(17);
  const [searchQuery, setSearchQuery] = useState('');

  const pageMeta = PAGE_META[pathname] ?? { title: 'Flow India', subtitle: '' };

  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(Math.floor(Math.random() * 18 + 8));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <header
      className="flex items-center gap-4 shrink-0"
      style={{
        height: 60,
        background: 'rgba(255,255,255,0.98)',
        borderBottom: '1px solid rgba(59,130,246,0.1)',
        padding: '0 24px',
        boxShadow: '0 1px 12px rgba(59,130,246,0.05), 0 1px 3px rgba(0,0,0,0.04)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Animated top border */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 2,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #f97316, #3b82f6)',
          backgroundSize: '300% 100%',
          animation: 'gradient-rotate 6s linear infinite',
        }}
      />

      {/* Page title */}
      <div className="shrink-0 mr-2 hidden lg:block">
        <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
          {pageMeta.title}
        </p>
        {pageMeta.subtitle && (
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{pageMeta.subtitle}</p>
        )}
      </div>

      {/* Divider */}
      <div className="hidden lg:block shrink-0" style={{ width: 1, height: 28, background: 'linear-gradient(180deg, transparent, rgba(59,130,246,0.2), transparent)' }} />

      {/* Search */}
      <div style={{ flex: 1, maxWidth: 340 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cities, districts…"
            style={{
              width: '100%',
              paddingLeft: 34, paddingRight: 14,
              paddingTop: 7, paddingBottom: 7,
              fontSize: 13, borderRadius: 9,
              border: '1px solid #e2e8f0',
              background: '#f8fafc', color: '#334155',
              outline: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12), 0 0 12px rgba(59,130,246,0.08)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* Right-side controls */}
      <div className="flex items-center gap-2 ml-auto">
        {/* WS Status */}
        <div
          className="hidden sm:flex items-center gap-1.5"
          style={{
            padding: '5px 11px', borderRadius: 99,
            fontSize: 11.5, fontWeight: 600,
            background: isConnected ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            color: isConnected ? '#10b981' : '#ef4444',
            border: `1px solid ${isConnected ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
            boxShadow: isConnected ? '0 0 10px rgba(16,185,129,0.12)' : '0 0 10px rgba(239,68,68,0.12)',
          }}
        >
          <span
            className="pulse-dot"
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isConnected ? '#10b981' : '#ef4444',
              display: 'inline-block',
              boxShadow: isConnected ? '0 0 6px rgba(16,185,129,0.8)' : '0 0 6px rgba(239,68,68,0.8)',
            }}
          />
          {isConnected ? 'Live' : 'Offline'}
        </div>

        {/* Latency badge */}
        <div className="hidden md:flex items-center gap-1.5" style={{ fontSize: 11.5, color: '#64748b' }}>
          {isConnected ? <Wifi size={12} color="#3b82f6" /> : <WifiOff size={12} color="#ef4444" />}
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6', textShadow: '0 0 8px rgba(59,130,246,0.4)' }}>
            {latency}ms
          </span>
        </div>

        <div style={{ width: 1, height: 22, background: 'linear-gradient(180deg, transparent, rgba(59,130,246,0.15), transparent)', margin: '0 2px' }} />

        {/* Notifications */}
        <Link
          href="/notifications"
          style={{ position: 'relative', padding: 7, borderRadius: 8, display: 'flex', color: '#64748b', transition: 'all 0.2s ease' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(59,130,246,0.06)';
            e.currentTarget.style.color = '#3b82f6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#64748b';
          }}
        >
          <Bell size={17} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute', top: 3, right: 3,
                minWidth: unreadCount > 9 ? 16 : 14, height: 14,
                borderRadius: 99,
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                border: '1.5px solid #fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 800, color: '#fff',
                padding: '0 3px', lineHeight: 1,
                boxShadow: '0 0 8px rgba(239,68,68,0.5)',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Settings */}
        <Link
          href="/settings"
          style={{ padding: 7, borderRadius: 8, display: 'flex', color: '#64748b', transition: 'all 0.2s ease' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(59,130,246,0.06)';
            e.currentTarget.style.color = '#3b82f6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#64748b';
          }}
        >
          <Settings size={17} />
        </Link>

        {/* User menu */}
        <div style={{ position: 'relative' }}>
          <button
            className="flex items-center gap-2"
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '5px 8px', borderRadius: 9,
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div
              style={{
                width: 29, height: 29, borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                color: 'white', fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 10px rgba(59,130,246,0.45)',
              }}
            >
              {initials}
            </div>
            <span className="hidden sm:block" style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
              {user?.full_name?.split(' ')[0] || 'User'}
            </span>
            <ChevronDown size={13} color="#94a3b8" />
          </button>

          {showUserMenu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setShowUserMenu(false)} />
              <div
                className="scale-in"
                style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                  width: 210, borderRadius: 14,
                  background: '#fff',
                  border: '1px solid rgba(59,130,246,0.12)',
                  boxShadow: '0 8px 32px -6px rgba(0,0,0,0.16), 0 0 24px rgba(59,130,246,0.08)',
                  zIndex: 20, overflow: 'hidden',
                }}
              >
                {/* Gradient top strip */}
                <div style={{ height: 3, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)', backgroundSize: '200% 100%', animation: 'gradient-rotate 4s linear infinite' }} />

                {/* User info */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      color: 'white', fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 0 10px rgba(59,130,246,0.4)',
                    }}>
                      {initials}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{user?.full_name}</p>
                      <p style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{user?.email}</p>
                    </div>
                  </div>
                  {user?.is_admin && (
                    <span style={{
                      display: 'inline-block', fontSize: 10, fontWeight: 700,
                      padding: '2px 8px', borderRadius: 99,
                      background: 'rgba(59,130,246,0.1)', color: '#3b82f6',
                      border: '1px solid rgba(59,130,246,0.2)',
                      boxShadow: '0 0 8px rgba(59,130,246,0.15)',
                    }}>
                      ⚡ Admin
                    </span>
                  )}
                </div>

                <div style={{ padding: '4px 0' }}>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2.5"
                    style={{ padding: '9px 16px', fontSize: 13, color: '#334155', textDecoration: 'none', transition: 'background 0.12s' }}
                    onClick={() => setShowUserMenu(false)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <User size={14} color="#64748b" />
                    Profile &amp; Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full"
                    style={{
                      padding: '9px 16px', fontSize: 13, color: '#ef4444',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      textAlign: 'left', transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fff5f5')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes gradient-rotate { 0% { background-position: 0% 50%; } 100% { background-position: 300% 50%; } }`}</style>
    </header>
  );
}
