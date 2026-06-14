'use client';

import { HelpCircle, Mail, MessageSquare, BookOpen, ExternalLink } from 'lucide-react';

const FAQ = [
  { q: 'How do I set up departure alerts?', a: 'Go to Commute Planner → click "Add Alert" → fill in your route details and select the days.' },
  { q: 'What does the congestion score mean?', a: 'Score 0.0–0.3 is Fluid, 0.4–0.7 is Moderate, 0.8–1.0 is Critical. Scores are computed from vehicle count and speed differentials.' },
  { q: 'How often is traffic data updated?', a: 'India district data is refreshed every 60 seconds via live TomTom API. WebSocket clients receive updates in real-time.' },
  { q: 'Can I export my trip history?', a: 'Yes — go to the Admin panel → Export CSV button to download traffic records and user data.' },
];

const CONTACT_CARDS = [
  { icon: <Mail size={22} color="#3b82f6" />, title: 'Email Support', desc: 'support@flowcast.in', action: 'Send Email', glowClass: 'icon-glow-blue' },
  { icon: <MessageSquare size={22} color="#8b5cf6" />, title: 'Live Chat', desc: 'Available 9 AM – 6 PM IST', action: 'Start Chat', glowClass: 'icon-glow-purple' },
  { icon: <BookOpen size={22} color="#10b981" />, title: 'Documentation', desc: 'API docs and guides', action: 'View Docs', glowClass: 'icon-glow-green' },
];

export default function SupportPage() {
  return (
    <div className="slide-up" style={{ maxWidth: 768, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero ── */}
      <div className="page-hero" style={{ padding: '24px 28px' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 className="gradient-text-neon" style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Support</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Help resources for Flow India platform</p>
        </div>
      </div>

      {/* Contact cards */}
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {CONTACT_CARDS.map(({ icon, title, desc, action, glowClass }) => (
          <div key={title} className="neon-card" style={{ padding: '22px' }}>
            <div className={`icon-glow ${glowClass}`} style={{ width: 46, height: 46, borderRadius: 13, marginBottom: 14 }}>
              {icon}
            </div>
            <p style={{ fontWeight: 700, fontSize: 14, color: '#111827', margin: '0 0 4px' }}>{title}</p>
            <p style={{ fontSize: 12.5, color: '#9ca3af', margin: '0 0 14px' }}>{desc}</p>
            <button className="btn-gradient" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              {action} <ExternalLink size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="neon-card" style={{ padding: '22px 26px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 18 }}>
          <div className="icon-glow icon-glow-blue" style={{ width: 32, height: 32, borderRadius: 9 }}>
            <HelpCircle size={16} color="#3b82f6" />
          </div>
          <h2 style={{ fontWeight: 700, fontSize: 15, color: '#111827', margin: 0 }}>Frequently Asked Questions</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {FAQ.map(({ q, a }, i) => (
            <div
              key={q}
              className="glass-neon"
              style={{
                padding: '14px 16px', borderRadius: 11, marginBottom: i < FAQ.length - 1 ? 8 : 0,
                animation: `slideUp 0.4s ease both`,
                animationDelay: `${i * 0.07}s`,
              }}
            >
              <p style={{ fontWeight: 700, fontSize: 13.5, color: '#111827', margin: '0 0 5px' }}>{q}</p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
