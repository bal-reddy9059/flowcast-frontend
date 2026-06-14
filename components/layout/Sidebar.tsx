'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Map, BarChart2, Navigation, CalendarClock,
  ShieldCheck, Settings, HelpCircle, Zap, LogOut, Bell, Activity,
  TrendingUp, Radio, Flame, Building2, Truck, Hexagon, Webhook,
  GitBranch, FileBarChart, Bot, Clock, Newspaper, HeartPulse,
  Train, BarChart3, CloudRain, AlertTriangle, Code2, Brain,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// ── Section colour palette ────────────────────────────────────────────────────

interface SectionTheme {
  primary:   string;
  light:     string;
  activeBg:  string;
  hoverBg:   string;
  headingFg: string;
  glow:      string;
  dotBg:     string;
}

const SECTION_THEMES: Record<string, SectionTheme> = {
  'Overview':     { primary: '#3b82f6', light: '#60a5fa', activeBg: 'rgba(59,130,246,0.14)',  hoverBg: 'rgba(59,130,246,0.07)',  headingFg: '#2563eb', glow: 'rgba(59,130,246,0.6)',  dotBg: 'rgba(59,130,246,0.2)'  },
  'Planning':     { primary: '#06b6d4', light: '#22d3ee', activeBg: 'rgba(6,182,212,0.14)',   hoverBg: 'rgba(6,182,212,0.07)',   headingFg: '#0891b2', glow: 'rgba(6,182,212,0.6)',   dotBg: 'rgba(6,182,212,0.2)'   },
  'AI Features':  { primary: '#8b5cf6', light: '#a78bfa', activeBg: 'rgba(139,92,246,0.15)',  hoverBg: 'rgba(139,92,246,0.07)', headingFg: '#7c3aed', glow: 'rgba(139,92,246,0.65)', dotBg: 'rgba(139,92,246,0.22)' },
  'Data & Tools': { primary: '#f97316', light: '#fb923c', activeBg: 'rgba(249,115,22,0.14)',  hoverBg: 'rgba(249,115,22,0.07)',  headingFg: '#ea580c', glow: 'rgba(249,115,22,0.6)',  dotBg: 'rgba(249,115,22,0.2)'  },
  'Enterprise':   { primary: '#6366f1', light: '#818cf8', activeBg: 'rgba(99,102,241,0.14)',  hoverBg: 'rgba(99,102,241,0.07)',  headingFg: '#4f46e5', glow: 'rgba(99,102,241,0.6)',  dotBg: 'rgba(99,102,241,0.2)'  },
  'System':       { primary: '#64748b', light: '#94a3b8', activeBg: 'rgba(100,116,139,0.13)', hoverBg: 'rgba(100,116,139,0.06)', headingFg: '#475569', glow: 'rgba(100,116,139,0.5)', dotBg: 'rgba(100,116,139,0.18)'},
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavItem {
  label:        string;
  href:         string;
  icon:         React.ElementType;
  badge?:       string;
  badgeVariant?: 'live' | 'count' | 'new' | 'ai';
  adminOnly?:   boolean;
}

interface NavSection {
  heading: string;
  items:   NavItem[];
}

// ── Nav data ──────────────────────────────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'Overview',
    items: [
      { label: 'Dashboard',    href: '/dashboard',    icon: LayoutDashboard },
      { label: 'India Map',    href: '/india-map',    icon: Map,   badge: 'LIVE', badgeVariant: 'live' },
      { label: 'Live Traffic', href: '/live-traffic', icon: Radio, badge: 'LIVE', badgeVariant: 'live' },
      { label: 'Heatmap',      href: '/heatmap',      icon: Flame, badge: 'NEW',  badgeVariant: 'new'  },
    ],
  },
  {
    heading: 'Planning',
    items: [
      { label: 'Analytics',       href: '/analytics',       icon: BarChart2     },
      { label: 'Route Optimizer', href: '/route-optimizer', icon: Navigation    },
      { label: 'Commute Planner', href: '/commute-planner', icon: CalendarClock },
    ],
  },
  {
    heading: 'AI Features',
    items: [
      { label: 'AI Copilot',         href: '/ai-copilot',      icon: Bot,        badge: 'AI',   badgeVariant: 'ai'   },
      { label: 'Departure Coach',    href: '/departure-coach', icon: Clock,      badge: 'AI',   badgeVariant: 'ai'   },
      { label: 'Traffic Stories',    href: '/traffic-stories', icon: Newspaper,  badge: 'LIVE', badgeVariant: 'live' },
      { label: 'Stress Score',       href: '/stress-score',    icon: HeartPulse, badge: 'AI',   badgeVariant: 'ai'   },
      { label: 'Multimodal Planner', href: '/multimodal',      icon: Train,      badge: 'AI',   badgeVariant: 'ai'   },
      { label: 'Fleet Insights',     href: '/fleet-insights',  icon: BarChart3,  badge: 'AI',   badgeVariant: 'ai'   },
    ],
  },
  {
    heading: 'Data & Tools',
    items: [
      { label: 'Weather Impact',    href: '/weather',    icon: CloudRain,     badge: 'NEW',  badgeVariant: 'new'  },
      { label: 'Incidents',         href: '/incidents',  icon: AlertTriangle, badge: 'LIVE', badgeVariant: 'live' },
      { label: 'ML Prediction',     href: '/ml-predict', icon: Brain,         badge: 'AI',   badgeVariant: 'ai'   },
      { label: 'Developer Portal',  href: '/developer',  icon: Code2,         badge: 'NEW',  badgeVariant: 'new'  },
    ],
  },
  {
    heading: 'Enterprise',
    items: [
      { label: 'Organizations', href: '/org',      icon: Building2,    badge: 'NEW', badgeVariant: 'new' },
      { label: 'Fleet',         href: '/fleet',    icon: Truck,        badge: 'NEW', badgeVariant: 'new' },
      { label: 'Geofences',     href: '/zones',    icon: Hexagon,      badge: 'NEW', badgeVariant: 'new' },
      { label: 'Webhooks',      href: '/webhooks', icon: Webhook,      badge: 'NEW', badgeVariant: 'new' },
      { label: 'Alert Rules',   href: '/rules',    icon: GitBranch,    badge: 'NEW', badgeVariant: 'new' },
      { label: 'Reports',       href: '/reports',  icon: FileBarChart, badge: 'NEW', badgeVariant: 'new' },
    ],
  },
  {
    heading: 'System',
    items: [
      { label: 'Notifications', href: '/notifications', icon: Bell,        badge: '4', badgeVariant: 'count' },
      { label: 'Admin Panel',   href: '/admin',          icon: ShieldCheck, adminOnly: true },
      { label: 'Settings',      href: '/settings',       icon: Settings  },
      { label: 'Support',       href: '/support',        icon: HelpCircle },
    ],
  },
];

// ── Badge component ───────────────────────────────────────────────────────────

function Badge({ text, variant, theme }: { text: string; variant?: 'live' | 'count' | 'new' | 'ai'; theme?: SectionTheme }) {
  if (variant === 'live') {
    return (
      <span style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
        padding: '2px 7px', borderRadius: 99,
        background: 'rgba(16,185,129,0.12)', color: '#10b981',
        border: '1px solid rgba(16,185,129,0.28)',
        display: 'flex', alignItems: 'center', gap: 4,
        boxShadow: '0 0 8px rgba(16,185,129,0.2)',
        flexShrink: 0,
      }}>
        <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
        {text}
      </span>
    );
  }
  if (variant === 'ai') {
    const c = theme ?? SECTION_THEMES['AI Features'];
    return (
      <span style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
        padding: '2px 7px', borderRadius: 99,
        background: `${c.primary}20`, color: c.light,
        border: `1px solid ${c.primary}40`,
        boxShadow: `0 0 8px ${c.primary}25`,
        flexShrink: 0,
      }}>
        {text}
      </span>
    );
  }
  if (variant === 'count') {
    return (
      <span style={{
        fontSize: 9.5, fontWeight: 800, minWidth: 18, height: 18,
        borderRadius: 99, background: '#ef4444', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 5px', boxShadow: '0 0 10px rgba(239,68,68,0.45)',
        flexShrink: 0,
      }}>
        {text}
      </span>
    );
  }
  // 'new'
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
      padding: '2px 6px', borderRadius: 99,
      background: 'rgba(59,130,246,0.12)', color: '#60a5fa',
      border: '1px solid rgba(59,130,246,0.25)',
      flexShrink: 0,
    }}>
      {text}
    </span>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname  = usePathname();
  const { user, logout } = useAuth();
  const router    = useRouter();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const handleLogout = () => { logout(); router.push('/login'); };

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <aside
      style={{
        width: 248,
        background: 'linear-gradient(180deg, #07101f 0%, #080e1c 55%, #070d1b 100%)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        position: 'relative',
      }}
      className="sidebar-scroll"
    >
      {/* Subtle side glow */}
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 1, background: 'linear-gradient(180deg, transparent, rgba(59,130,246,0.15) 30%, rgba(139,92,246,0.1) 70%, transparent)', pointerEvents: 'none' }} />

      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 16px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
          <div
            className="radium-pulse"
            style={{
              width: 40, height: 40, borderRadius: 13, flexShrink: 0,
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              boxShadow: '0 0 22px rgba(59,130,246,0.5), 0 0 44px rgba(139,92,246,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Zap size={19} color="white" />
          </div>
          <div>
            <p className="gradient-text-animated" style={{ fontWeight: 900, fontSize: 15.5, lineHeight: 1.1, letterSpacing: '-0.03em', margin: 0 }}>Flow India</p>
            <p style={{ color: '#2d4a6a', fontSize: 10.5, marginTop: 2 }}>Traffic Intelligence</p>
          </div>
        </div>

        {/* System status chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)',
          borderRadius: 10, padding: '7px 11px',
          boxShadow: '0 0 14px rgba(16,185,129,0.07)',
        }}>
          <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 7px rgba(16,185,129,0.9)' }} />
          <span style={{ color: '#34d399', fontSize: 11.5, fontWeight: 600, flex: 1 }}>System Operational</span>
          <Activity size={11} color="#10b981" />
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────── */}
      <nav style={{ flex: 1, padding: '2px 10px 8px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {NAV_SECTIONS.map((section) => {
          const theme = SECTION_THEMES[section.heading] ?? SECTION_THEMES['System'];
          return (
            <div key={section.heading} style={{ marginBottom: 6 }}>

              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 8px 5px', marginBottom: 1 }}>
                {/* Colored pill accent */}
                <div style={{
                  width: 16, height: 3, borderRadius: 99,
                  background: `linear-gradient(90deg, ${theme.primary}, ${theme.primary}44)`,
                  boxShadow: `0 0 6px ${theme.glow}`,
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 9.5, fontWeight: 800, letterSpacing: '0.11em',
                  textTransform: 'uppercase', color: theme.headingFg,
                }}>
                  {section.heading}
                </span>
                {/* Trailing line */}
                <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${theme.primary}20, transparent)`, borderRadius: 99 }} />
              </div>

              {/* Section items */}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {section.items.map(({ label, href, icon: Icon, badge, badgeVariant, adminOnly }) => {
                  if (adminOnly && !user?.is_admin) return null;
                  const active = isActive(href);

                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        style={{
                          position: 'relative',
                          display: 'flex', alignItems: 'center', gap: 9,
                          padding: '7px 10px 7px 12px',
                          borderRadius: 10, textDecoration: 'none',
                          fontSize: 13, fontWeight: active ? 700 : 400,
                          color: active ? '#f1f5f9' : '#3d5a80',
                          background: active ? theme.activeBg : 'transparent',
                          transition: 'all 0.16s ease',
                          boxShadow: active ? `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 12px ${theme.primary}12` : 'none',
                        }}
                        onMouseEnter={(e) => {
                          if (!active) {
                            e.currentTarget.style.color = '#94a3b8';
                            e.currentTarget.style.background = theme.hoverBg;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            e.currentTarget.style.color = '#3d5a80';
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        {/* Active left bar */}
                        {active && (
                          <span style={{
                            position: 'absolute', left: 0, top: '50%',
                            transform: 'translateY(-50%)',
                            width: 3, height: 20, borderRadius: '0 3px 3px 0',
                            background: `linear-gradient(180deg, ${theme.light}, ${theme.primary})`,
                            boxShadow: `0 0 10px ${theme.glow}`,
                          }} />
                        )}

                        {/* Icon container */}
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: active ? theme.dotBg : 'transparent',
                          transition: 'all 0.16s ease',
                        }}>
                          <Icon
                            size={15}
                            style={{
                              color: active ? theme.light : '#253552',
                              filter: active ? `drop-shadow(0 0 5px ${theme.glow})` : 'none',
                              transition: 'all 0.16s ease',
                            }}
                          />
                        </div>

                        <span style={{ flex: 1, letterSpacing: '-0.01em', lineHeight: 1 }}>{label}</span>
                        {badge && <Badge text={badge} variant={badgeVariant} theme={theme} />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* ── Live stats ──────────────────────────────────────────────── */}
      <div style={{
        margin: '4px 10px 10px',
        padding: '12px 14px',
        borderRadius: 13,
        background: 'linear-gradient(135deg, rgba(59,130,246,0.07), rgba(139,92,246,0.06))',
        border: '1px solid rgba(59,130,246,0.13)',
        boxShadow: '0 0 20px rgba(59,130,246,0.05)',
        flexShrink: 0,
      }}>
        <p style={{ color: '#1e3a5f', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.11em', textTransform: 'uppercase', marginBottom: 10 }}>Live Stats</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {[
            { label: 'Districts', value: '766',    icon: TrendingUp, vColor: '#60a5fa' },
            { label: 'Cities',    value: '50+',    icon: Activity,   vColor: '#34d399' },
            { label: 'Uptime',    value: '99.98%', icon: Zap,        vColor: '#a78bfa' },
          ].map(({ label, value, icon: Icon, vColor }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
                <Icon size={9} color={vColor} />
                <span style={{ color: '#1e3a5f', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</span>
              </div>
              <p style={{ color: vColor, fontSize: 14, fontWeight: 900, margin: 0, textShadow: `0 0 8px ${vColor}55`, letterSpacing: '-0.03em' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── User profile ────────────────────────────────────────────── */}
      {user && (
        <div style={{ padding: '8px 10px 12px', borderTop: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '10px 12px', borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          }}>
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              boxShadow: '0 0 14px rgba(59,130,246,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: 12,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#cbd5e1', fontSize: 12.5, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.full_name}
              </p>
              <p style={{ color: '#2d4a6a', fontSize: 10, margin: 0, marginTop: 1 }}>
                {user.is_admin ? '⚡ Admin' : 'Member'}
              </p>
            </div>
            {/* Logout */}
            <button
              onClick={handleLogout}
              title="Sign out"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '5px', borderRadius: 7, color: '#253552',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease', flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.14)';
                e.currentTarget.style.color = '#f87171';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#253552';
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
