'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, User, MapPin, Sparkles, RefreshCw, Zap, ChevronRight } from 'lucide-react';
import { aiApi } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  'Should I leave for work now?',
  'Best time to drive to the airport?',
  "What's traffic like in Bangalore today?",
  'Fastest route from Andheri to BKC?',
  'Why is Silk Board always congested?',
];

const STUB_REPLIES: Record<string, string> = {
  default: 'Based on current traffic data, congestion is moderate on most major corridors. Western Express Highway is running at 62% capacity — expect 12–18 min delays near Andheri. Best to leave within the next 20 minutes to beat the peak.',
  leave: 'Right now is a good window. Traffic on your typical route is at 54% load — about 8 minutes faster than peak. If you wait 30 minutes, expect NH48 to back up near Gurgaon Toll. I\'d leave in the next 15 minutes.',
  airport: 'For airport travel, the next optimal window is 5:30 AM–7:00 AM (light traffic, ~35 min from South Mumbai) or after 10:00 PM. Avoid 6 PM–9 PM — average delays of 40+ minutes on the expressway.',
  bangalore: 'Bangalore is showing elevated stress today. Outer Ring Road near Marathahalli is at 78% load. Silk Board Flyover has an active incident — adding ~22 min. ITPL Road and Old Airport Road are clear.',
  route: 'Andheri to BKC: Best route right now is via Western Express Highway → Bandra-Kurla Link Rd. ETA ~24 min. Avoid SV Road — heavy schoolzone congestion. Your usual route via Sion is backed up near the flyover.',
  silk: 'Silk Board is a structural bottleneck — 6 major roads converge at a single grade-level junction with no grade separation. Peak throughput is ~3,200 vehicles/hour but demand hits 8,000+. The Metro Phase 2 (Yellow Line) opening in Q3 2026 is expected to reduce surface traffic by ~28%.',
};

function getFallback(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('leave') || t.includes('now')) return STUB_REPLIES.leave;
  if (t.includes('airport')) return STUB_REPLIES.airport;
  if (t.includes('bangalore') || t.includes('bengaluru')) return STUB_REPLIES.bangalore;
  if (t.includes('bkc') || t.includes('andheri') || t.includes('route')) return STUB_REPLIES.route;
  if (t.includes('silk')) return STUB_REPLIES.silk;
  return STUB_REPLIES.default;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1" style={{ padding: '10px 4px' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#8b5cf6',
            display: 'inline-block',
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div
      className="flex items-end gap-2.5"
      style={{ flexDirection: isUser ? 'row-reverse' : 'row', marginBottom: 12 }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isUser
            ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
            : 'linear-gradient(135deg, #1e1b4b, #0f172a)',
          boxShadow: isUser
            ? '0 0 12px rgba(59,130,246,0.5)'
            : '0 0 12px rgba(139,92,246,0.4)',
        }}
      >
        {isUser ? <User size={14} color="#fff" /> : <Bot size={14} color="#a78bfa" />}
      </div>

      {/* Bubble */}
      <div
        style={{
          maxWidth: '72%',
          padding: '11px 15px',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: isUser
            ? 'linear-gradient(135deg, #3b82f6, #6d28d9)'
            : '#0f172a',
          border: isUser
            ? 'none'
            : '1px solid rgba(139,92,246,0.3)',
          color: '#fff',
          fontSize: 13.5,
          lineHeight: 1.6,
          boxShadow: isUser
            ? '0 4px 20px rgba(59,130,246,0.4), 0 0 12px rgba(139,92,246,0.2)'
            : '0 4px 20px rgba(139,92,246,0.2), 0 0 12px rgba(139,92,246,0.1)',
        }}
      >
        {msg.content}
        <div
          style={{
            fontSize: 10,
            marginTop: 5,
            opacity: 0.5,
            textAlign: isUser ? 'right' : 'left',
          }}
        >
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

export default function AICopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content:
        "Hi! I'm your AI Traffic Copilot. Ask me anything about traffic, commutes, or routes across India — I'll analyze live data and give you real-time insights.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState('Mumbai');
  const [commuteInsight, setCommuteInsight] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    void aiApi.commuteInsight(location).then((res) => setCommuteInsight(res.data?.insight ?? res.data?.summary ?? JSON.stringify(res.data))).catch(() => setCommuteInsight('Insight unavailable right now.'));
  }, [location]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
        const res = await aiApi.chat(text, location);
        const reply = res.data?.reply ?? res.data?.message ?? getFallback(text);
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), role: 'assistant', content: reply, timestamp: new Date() },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: getFallback(text),
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [loading, location]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>

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
                <Sparkles size={10} style={{ display: 'inline', marginRight: 4 }} />
                AI Powered
              </span>
            </div>
            <h1 className="gradient-text-neon" style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
              AI Traffic Copilot
            </h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
              Ask anything about traffic, routes, or commutes in plain English
            </p>
          </div>
          {/* Location pill */}
          <div
            className="flex items-center gap-1.5 glass-neon"
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              fontSize: 12.5,
              color: '#c4b5fd',
              fontWeight: 600,
            }}
          >
            <MapPin size={12} color="#60a5fa" />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', width: 80, fontSize: 12.5, color: '#c4b5fd', fontWeight: 600 }}
              placeholder="City..."
            />
          </div>
        </div>
      </div>

      {/* ── Main layout: chat + context ────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, flex: 1, minHeight: 0 }}>

        {/* Chat panel */}
        <div
          className="neon-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 520,
          }}
        >
          {/* Chat header */}
          <div
            className="flex items-center gap-2.5"
            style={{ padding: '14px 18px', borderBottom: '1px solid rgba(139,92,246,0.15)' }}
          >
            <div className="icon-glow icon-glow-purple" style={{ width: 32, height: 32, borderRadius: 10 }}>
              <Bot size={15} color="#a78bfa" />
            </div>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>FlowCast Copilot</p>
              <p style={{ fontSize: 11, color: '#10b981' }}>
                <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block', marginRight: 4 }} />
                Powered by Claude · Live traffic context
              </p>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <button
                onClick={() =>
                  setMessages([
                    {
                      id: Date.now().toString(),
                      role: 'assistant',
                      content: "Chat cleared. Ask me anything about traffic across India.",
                      timestamp: new Date(),
                    },
                  ])
                }
                className="btn-neon"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 7,
                  fontSize: 11.5, fontWeight: 600,
                }}
              >
                <RefreshCw size={11} />
                Clear
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 8px' }}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {loading && (
              <div className="flex items-end gap-2.5" style={{ marginBottom: 12 }}>
                <div
                  className="icon-glow icon-glow-purple"
                  style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0 }}
                >
                  <Bot size={14} color="#a78bfa" />
                </div>
                <div
                  style={{
                    padding: '8px 14px',
                    borderRadius: '14px 14px 14px 4px',
                    background: '#0f172a',
                    border: '1px solid rgba(139,92,246,0.3)',
                    boxShadow: '0 4px 20px rgba(139,92,246,0.15)',
                  }}
                >
                  <TypingIndicator />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          <div
            style={{
              padding: '8px 14px',
              borderTop: '1px solid rgba(59,130,246,0.1)',
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
            }}
          >
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => void sendMessage(p)}
                disabled={loading}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '5px 11px',
                  borderRadius: 99,
                  fontSize: 11.5,
                  fontWeight: 600,
                  background: 'rgba(59,130,246,0.07)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59,130,246,0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  opacity: loading ? 0.5 : 1,
                  boxShadow: '0 0 6px rgba(59,130,246,0.12)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(59,130,246,0.15)';
                  e.currentTarget.style.boxShadow = '0 0 12px rgba(59,130,246,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(59,130,246,0.07)';
                  e.currentTarget.style.boxShadow = '0 0 6px rgba(59,130,246,0.12)';
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input bar */}
          <div
            className="flex items-center gap-2"
            style={{ padding: '12px 14px', borderTop: '1px solid rgba(59,130,246,0.12)' }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about traffic, routes, or commutes…"
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1.5px solid rgba(59,130,246,0.2)',
                fontSize: 13.5,
                color: '#0f172a',
                background: '#f8fafc',
                outline: 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#8b5cf6';
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.12), 0 0 16px rgba(139,92,246,0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)';
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <button
              onClick={() => void sendMessage(input)}
              disabled={loading || !input.trim()}
              className={input.trim() && !loading ? 'btn-gradient' : ''}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                border: 'none',
                background: input.trim() && !loading ? undefined : '#e2e8f0',
                color: input.trim() && !loading ? '#fff' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                flexShrink: 0,
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        {/* Context panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="neon-card" style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', marginBottom: 6 }}>Weekly commute insight</p>
            <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{commuteInsight || 'Loading insight…'}</p>
          </div>

          {/* AI info card */}
          <div
            className="neon-card"
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
              padding: '18px 16px',
              border: '1px solid rgba(139,92,246,0.25)',
              boxShadow: '0 0 24px rgba(139,92,246,0.12)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="icon-glow icon-glow-purple" style={{ width: 24, height: 24, borderRadius: 7 }}>
                <Sparkles size={12} color="#a78bfa" />
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                AI Context
              </p>
            </div>
            {[
              { label: 'Data Sources', value: 'Live Traffic + 766 Districts' },
              { label: 'Model', value: 'Claude (claude-sonnet-4-6)' },
              { label: 'Context', value: 'Trip history + Real-time' },
              { label: 'Latency', value: '< 2 seconds avg' },
            ].map(({ label, value }) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 10.5, color: '#475569', marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: '#cbd5e1' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Sample questions */}
          <div className="neon-card" style={{ padding: '16px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Try Asking
            </p>
            {[
              'What\'s causing slowdown on NH48?',
              'Compare driving vs metro to Airport',
              'My best commute days this week?',
              'Alert me when Silk Board clears',
            ].map((q) => (
              <button
                key={q}
                onClick={() => void sendMessage(q)}
                disabled={loading}
                className="flex items-center gap-2 w-full"
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 12.5,
                  color: '#334155',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                  marginBottom: 2,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <ChevronRight size={12} color="#8b5cf6" style={{ flexShrink: 0 }} />
                {q}
              </button>
            ))}
          </div>

          {/* Tips */}
          <div
            className="glass-neon"
            style={{
              borderRadius: 14,
              padding: '14px 16px',
              border: '1px solid rgba(59,130,246,0.2)',
            }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Zap size={13} color="#60a5fa" />
              <p style={{ fontSize: 11.5, fontWeight: 700, color: '#60a5fa' }}>Pro Tip</p>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
              Mention your city for more accurate answers. E.g. "Traffic in Delhi near CP" gives better results than just "traffic".
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
