'use client';

import { useState, useEffect, useCallback } from 'react';
import { Newspaper, RefreshCw, Clock, MapPin, Radio, ChevronRight, Zap, Lightbulb } from 'lucide-react';
import api from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

/* ── API shape (matches GET /traffic/stories exactly) ──────────── */
interface Story {
  id: string;
  headline: string;
  body: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  location: string;
  tip?: string;
  generated_at: string;
  expires_at: string;
}

interface StoriesResponse {
  stories: Story[];
  count: number;
  fetched_at: string;
}

/* ── Stub data (mirrors real API shape) ────────────────────────── */
const STUB_STORIES: Story[] = [
  {
    id: 's1',
    headline: 'Major slowdown on NH48 near Gurgaon Toll',
    body: 'High congestion detected at Gurgaon, Haryana with average speed of 18 km/h. Conditions are being monitored and may affect nearby areas.',
    severity: 'high',
    location: 'Gurgaon, Haryana',
    tip: 'Consider delaying your trip by 30–45 min or take an alternate route.',
    generated_at: new Date(Date.now() - 4 * 60000).toISOString(),
    expires_at: new Date(Date.now() + 90 * 60000).toISOString(),
  },
  {
    id: 's2',
    headline: 'Silk Board Flyover back to normal speeds',
    body: 'Moderate traffic detected at Bengaluru, Karnataka with average speed of 38 km/h. Conditions have improved from the earlier peak.',
    severity: 'low',
    location: 'Bengaluru, Karnataka',
    tip: 'Good time to travel — conditions are clear on most corridors.',
    generated_at: new Date(Date.now() - 18 * 60000).toISOString(),
    expires_at: new Date(Date.now() + 60 * 60000).toISOString(),
  },
  {
    id: 's3',
    headline: 'Traffic at a standstill — Andheri East',
    body: 'High congestion detected at Mumbai, Maharashtra with average speed of 12 km/h. Conditions are being monitored and may affect nearby areas.',
    severity: 'high',
    location: 'Mumbai, Maharashtra',
    tip: 'Consider delaying your trip by 30–45 min or take an alternate route.',
    generated_at: new Date(Date.now() - 7 * 60000).toISOString(),
    expires_at: new Date(Date.now() + 45 * 60000).toISOString(),
  },
  {
    id: 's4',
    headline: 'Delhi Ring Road unusually clear — all zones green',
    body: 'Light traffic detected at New Delhi with average speed of 72 km/h — well above the weekly average for this time slot.',
    severity: 'info',
    location: 'New Delhi, Delhi',
    tip: 'Ideal window for long-distance travel within the city.',
    generated_at: new Date(Date.now() - 31 * 60000).toISOString(),
    expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
  },
  {
    id: 's5',
    headline: 'Severe gridlock — Outer Ring Road Marathahalli',
    body: 'High congestion detected at Bengaluru, Karnataka with average speed of 9 km/h. Conditions are being monitored and may affect nearby areas.',
    severity: 'high',
    location: 'Bengaluru, Karnataka',
    tip: 'Consider delaying your trip by 30–45 min or take an alternate route.',
    generated_at: new Date(Date.now() - 11 * 60000).toISOString(),
    expires_at: new Date(Date.now() + 60 * 60000).toISOString(),
  },
  {
    id: 's6',
    headline: 'Moderate slowdown — Bhopal city centre',
    body: 'Medium congestion detected at Bhopal, Madhya Pradesh with average speed of 26 km/h. Peak hour traffic building up at major intersections.',
    severity: 'medium',
    location: 'Bhopal, Madhya Pradesh',
    tip: 'Allow an extra 10–15 minutes for trips through the city centre.',
    generated_at: new Date(Date.now() - 52 * 60000).toISOString(),
    expires_at: new Date(Date.now() + 120 * 60000).toISOString(),
  },
];

/* ── Severity config ────────────────────────────────────────────── */
const SEV: Record<string, { bg: string; color: string; border: string; label: string; glowColor: string }> = {
  high:   { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', border: 'rgba(239,68,68,0.3)',   label: 'High',   glowColor: 'rgba(239,68,68,0.3)'   },
  medium: { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b', border: 'rgba(245,158,11,0.3)',  label: 'Medium', glowColor: 'rgba(245,158,11,0.3)'  },
  low:    { bg: 'rgba(16,185,129,0.1)',  color: '#10b981', border: 'rgba(16,185,129,0.3)',  label: 'Low',    glowColor: 'rgba(16,185,129,0.3)'  },
  info:   { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6', border: 'rgba(59,130,246,0.3)',  label: 'Info',   glowColor: 'rgba(59,130,246,0.3)'  },
};

/* ── Card ───────────────────────────────────────────────────────── */
function StoryCard({ story }: { story: Story }) {
  const sev = SEV[story.severity] ?? SEV.info;
  const isExpired = new Date(story.expires_at) < new Date();

  return (
    <div
      className="neon-card"
      style={{
        borderLeft: `3px solid ${sev.color}`,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: isExpired ? 0.55 : 1,
        boxShadow: `0 0 0 0 transparent`,
      }}
    >
      {/* Severity badge */}
      <div>
        <span
          style={{
            padding: '3px 10px',
            borderRadius: 99,
            fontSize: 10.5,
            fontWeight: 700,
            background: sev.bg,
            color: sev.color,
            border: `1px solid ${sev.border}`,
            boxShadow: `0 0 8px ${sev.glowColor}`,
          }}
        >
          {sev.label}
        </span>
      </div>

      {/* Headline */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.4, margin: 0 }}>
        {story.headline}
      </h3>

      {/* Body */}
      <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.65, margin: 0 }}>
        {story.body}
      </p>

      {/* Tip */}
      {story.tip && (
        <div
          className="flex items-start gap-2"
          style={{
            padding: '9px 12px',
            borderRadius: 8,
            background: 'rgba(245,158,11,0.07)',
            border: '1px solid rgba(245,158,11,0.2)',
            boxShadow: '0 0 10px rgba(245,158,11,0.08)',
          }}
        >
          <Lightbulb size={13} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5, margin: 0 }}>
            {story.tip}
          </p>
        </div>
      )}

      {/* Footer: location + time */}
      <div className="flex items-center justify-between" style={{ marginTop: 2 }}>
        <div className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: '#64748b' }}>
          <MapPin size={11} color="#94a3b8" />
          <span>{story.location}</span>
        </div>
        <div className="flex items-center gap-1" style={{ fontSize: 11, color: '#94a3b8' }}>
          <Clock size={11} />
          {formatRelativeTime(story.generated_at)}
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────── */
export default function TrafficStoriesPage() {
  const [stories, setStories] = useState<Story[]>(STUB_STORIES);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'info'>('all');

  const fetchStories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<StoriesResponse>('/traffic/stories');
      if (res.data?.stories?.length) {
        setStories(res.data.stories);
        setLastFetched(res.data.fetched_at ?? null);
      } else {
        setStories(STUB_STORIES);
        setLastFetched(null);
      }
    } catch {
      setStories(STUB_STORIES);
      setLastFetched(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStories();
    const interval = setInterval(() => void fetchStories(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStories]);

  const filtered = filter === 'all' ? stories : stories.filter((s) => s.severity === filter);
  const counts = {
    all:    stories.length,
    high:   stories.filter((s) => s.severity === 'high').length,
    medium: stories.filter((s) => s.severity === 'medium').length,
    low:    stories.filter((s) => s.severity === 'low').length,
    info:   stories.filter((s) => s.severity === 'info').length,
  };

  const lastUpdatedLabel = lastFetched
    ? new Date(lastFetched).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'just now';

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page Hero ───────────────────────────── */}
      <div className="page-hero">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  background: 'rgba(139,92,246,0.2)',
                  border: '1px solid rgba(139,92,246,0.4)',
                  color: '#c4b5fd',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  boxShadow: '0 0 12px rgba(139,92,246,0.3)',
                }}
              >
                <Zap size={10} style={{ display: 'inline', marginRight: 4 }} />
                AI Generated
              </span>
              <div
                className="flex items-center gap-1.5"
                style={{
                  padding: '4px 10px', borderRadius: 8,
                  fontSize: 11.5, fontWeight: 600,
                  background: 'rgba(16,185,129,0.15)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  color: '#34d399',
                  boxShadow: '0 0 10px rgba(16,185,129,0.2)',
                }}
              >
                <Radio size={11} />
                <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                Live Feed
              </div>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
              Traffic Stories
            </h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
              AI-generated human-readable traffic events, updated every 5 minutes
            </p>
          </div>
          <button
            onClick={fetchStories}
            disabled={loading}
            className="btn-gradient"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 8,
              fontSize: 12.5, fontWeight: 600,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={12} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Summary strip ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {([
          { key: 'high',   label: 'High Severity',  color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  glowColor: 'rgba(239,68,68,0.2)',   iconClass: 'icon-glow-red'    },
          { key: 'medium', label: 'Medium Severity', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', glowColor: 'rgba(245,158,11,0.2)',  iconClass: 'icon-glow-yellow' },
          { key: 'low',    label: 'Clear / Good',    color: '#10b981', bg: 'rgba(16,185,129,0.08)', glowColor: 'rgba(16,185,129,0.2)',  iconClass: 'icon-glow-green'  },
          { key: 'info',   label: 'Informational',   color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', glowColor: 'rgba(59,130,246,0.2)',  iconClass: 'icon-glow-blue'   },
        ] as const).map(({ key, label, color, bg, glowColor }) => (
          <div
            key={key}
            className="neon-card"
            onClick={() => setFilter(filter === key ? 'all' : key)}
            style={{
              padding: '14px 16px', cursor: 'pointer',
              background: filter === key ? bg : '#fff',
              border: `1px solid ${filter === key ? color : '#e2e8f0'}`,
              boxShadow: filter === key ? `0 0 16px ${glowColor}` : undefined,
              transition: 'all 0.15s',
            }}
          >
            <p style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: '-0.03em', lineHeight: 1, textShadow: filter === key ? `0 0 12px ${color}80` : 'none' }}>
              {counts[key]}
            </p>
            <p style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b', marginTop: 4 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filter bar ────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(['all', 'high', 'medium', 'low', 'info'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 14px', borderRadius: 99,
                fontSize: 12, fontWeight: 600,
                border: '1px solid',
                borderColor: filter === f ? '#8b5cf6' : '#e2e8f0',
                background: filter === f ? 'rgba(139,92,246,0.12)' : '#fff',
                color: filter === f ? '#8b5cf6' : '#64748b',
                cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s',
                boxShadow: filter === f ? '0 0 12px rgba(139,92,246,0.25)' : 'none',
              }}
            >
              {f === 'all'
                ? `All (${counts.all})`
                : `${f.charAt(0).toUpperCase() + f.slice(1)} (${counts[f]})`}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11.5, color: '#94a3b8' }}>
          Last updated {lastUpdatedLabel}
        </p>
      </div>

      {/* ── Stories grid ──────────────────────── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="skeleton-neon"
              style={{
                height: 210, borderRadius: 14,
                animation: `shimmer 1.4s ease ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {filtered.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      ) : (
        <div className="neon-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div className="icon-glow icon-glow-blue" style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 12px' }}>
            <Newspaper size={26} color="#3b82f6" />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>No stories for this filter</p>
          <button
            onClick={() => setFilter('all')}
            className="flex items-center gap-1.5 btn-neon"
            style={{
              margin: '12px auto 0', padding: '7px 16px', borderRadius: 8,
              fontSize: 12.5, fontWeight: 600,
            }}
          >
            <ChevronRight size={12} />
            Show all stories
          </button>
        </div>
      )}

      {/* ── Info footer ───────────────────────── */}
      <div
        className="flex items-center gap-2 glass-neon"
        style={{
          padding: '12px 16px', borderRadius: 10,
          fontSize: 12, color: '#94a3b8',
        }}
      >
        <div className="icon-glow icon-glow-blue" style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0 }}>
          <Zap size={12} color="#60a5fa" />
        </div>
        Stories are generated by AI using live traffic data from 766 monitored districts. They refresh automatically every 5 minutes.
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
      `}</style>
    </div>
  );
}
