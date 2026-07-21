'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Zap, Eye, EyeOff, AlertCircle, ArrowRight, Activity, Map, Navigation, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';

function FloatingOrb({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{
      position: 'absolute', borderRadius: '50%',
      filter: 'blur(72px)', pointerEvents: 'none',
      ...style,
    }} />
  );
}

function ParticleDot({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{
      position: 'absolute', width: 3, height: 3,
      borderRadius: '50%', pointerEvents: 'none',
      ...style,
    }} />
  );
}

function PanelStat({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: '14px 16px',
      backdropFilter: 'blur(8px)',
      transition: 'all 0.25s ease',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
        e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)';
        e.currentTarget.style.boxShadow = '0 0 20px rgba(59,130,246,0.1), inset 0 1px 0 rgba(255,255,255,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)';
      }}
    >
      <div className="flex items-center gap-2 mb-1">{icon}
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <p className="gradient-text-neon" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{value}</p>
    </div>
  );
}

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      width: '100%', height: '100dvh', display: 'flex', overflow: 'hidden',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    }}>

      {/* ── Left panel ──────────────────────────────── */}
      <div
        className="hidden lg:flex"
        style={{
          width: '44%', flexShrink: 0,
          minWidth: 0, height: '100%', flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '40px',
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(160deg, #060d1a 0%, #0c1427 40%, #0d0d2b 70%, #060d1a 100%)',
        }}
      >
        {/* Cyber grid */}
        <div className="cyber-grid-dark" style={{ position: 'absolute', inset: 0, opacity: 0.6 }} />

        {/* Floating orbs */}
        <FloatingOrb style={{ width: 500, height: 500, background: 'rgba(59,130,246,0.2)', top: -150, left: -100, animation: 'orb-drift-1 9s ease-in-out infinite' }} />
        <FloatingOrb style={{ width: 350, height: 350, background: 'rgba(139,92,246,0.18)', bottom: -50, right: -80, animation: 'orb-drift-2 11s ease-in-out infinite' }} />
        <FloatingOrb style={{ width: 250, height: 250, background: 'rgba(16,185,129,0.12)', top: '40%', left: '35%', animation: 'orb-drift-3 13s ease-in-out infinite' }} />

        {/* Particles */}
        {mounted && [
          { top: '20%', left: '15%', delay: '0s', color: 'rgba(59,130,246,0.7)' },
          { top: '60%', left: '25%', delay: '1.5s', color: 'rgba(139,92,246,0.7)' },
          { top: '35%', left: '70%', delay: '3s', color: 'rgba(16,185,129,0.7)' },
          { top: '75%', left: '60%', delay: '2s', color: 'rgba(59,130,246,0.5)' },
          { top: '10%', left: '50%', delay: '4s', color: 'rgba(236,72,153,0.5)' },
          { top: '80%', left: '40%', delay: '0.8s', color: 'rgba(139,92,246,0.6)' },
        ].map((p, i) => (
          <ParticleDot
            key={i}
            style={{
              top: p.top, left: p.left,
              background: p.color,
              boxShadow: `0 0 8px ${p.color}`,
              animation: `particle-rise ${4 + i * 0.8}s ease-in-out ${p.delay} infinite`,
            }}
          />
        ))}

        {/* Logo */}
        <div className="flex items-center gap-3" style={{ position: 'relative', zIndex: 1 }}>
          <div
            className="radium-pulse"
            style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              boxShadow: '0 0 28px rgba(59,130,246,0.6), 0 0 56px rgba(139,92,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Zap size={22} color="white" />
          </div>
          <div>
            <p className="gradient-text-neon" style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>Flow India</p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11.5 }}>Mission-Critical Logistics</p>
          </div>
        </div>

        {/* Headline */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', borderRadius: 99, marginBottom: 20,
              background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
              boxShadow: '0 0 16px rgba(59,130,246,0.15)',
            }}
          >
            <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.9)' }} />
            <span style={{ color: '#60a5fa', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.05em' }}>LIVE · 766 districts monitored</span>
          </div>

          <h2
            style={{
              color: '#fff', fontSize: 36,
              fontWeight: 800, letterSpacing: '-0.03em',
              lineHeight: 1.14, marginBottom: 16,
            }}
          >
            Real-time traffic<br />
            intelligence for<br />
            <span className="gradient-text-neon">all of India</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.7, maxWidth: 330 }}>
            Monitor 766 districts, predict congestion, and optimize routes — all in real-time with sub-20ms latency.
          </p>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 28 }}>
            <PanelStat value="766"    label="Districts"  icon={<Map        size={13} color="rgba(255,255,255,0.4)" />} />
            <PanelStat value="50+"    label="Cities"     icon={<Activity   size={13} color="rgba(255,255,255,0.4)" />} />
            <PanelStat value="99.98%" label="Uptime"     icon={<Navigation size={13} color="rgba(255,255,255,0.4)" />} />
          </div>

          {/* Tag strip */}
          <div style={{ marginTop: 22, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['WebSocket Live', 'ML Predictions', 'Route AI', 'Carbon Tracker', 'ETA Engine'].map((tag) => (
              <span key={tag} style={{
                padding: '4px 11px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.45)',
                transition: 'all 0.2s ease',
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(59,130,246,0.12)';
                  e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)';
                  e.currentTarget.style.color = '#60a5fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.45)';
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12, position: 'relative', zIndex: 1 }}>
          © 2026 Flow India Infrastructure Control Framework
        </p>
      </div>

      {/* ── Right panel (form) ────────────────────────── */}
      <div
        style={{
          flex: 1, minWidth: 0, height: '100%', display: 'flex',
          alignItems: 'flex-start', justifyContent: 'center',
          padding: 'clamp(20px, 5vh, 40px) clamp(16px, 4vw, 24px)',
          position: 'relative', overflowX: 'hidden', overflowY: 'auto',
          background: 'linear-gradient(135deg, #f8faff 0%, #f1f5f9 50%, #f0f4ff 100%)',
        }}
      >
        {/* Dot grid bg */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(59,130,246,0.12) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          opacity: 0.7, pointerEvents: 'none',
        }} />

        {/* Subtle orbs */}
        <FloatingOrb style={{ width: 300, height: 300, background: 'rgba(139,92,246,0.07)', top: -60, right: -60 }} />
        <FloatingOrb style={{ width: 200, height: 200, background: 'rgba(59,130,246,0.06)', bottom: -40, left: -40 }} />

        <div style={{ width: '100%', maxWidth: 420, minWidth: 0, position: 'relative', margin: 'auto 0' }}>

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div style={{
              width: 36, height: 36, borderRadius: 11,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(59,130,246,0.4)',
            }}>
              <Zap size={17} color="white" />
            </div>
            <span className="gradient-text" style={{ fontWeight: 800, fontSize: 17 }}>Flow India</span>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 'clamp(24px, 5vw, 28px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 6 }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: '#64748b' }}>Sign in to your Flow India account</p>
          </div>

          {/* Form card */}
          <div
            style={{
              background: 'rgba(255,255,255,0.95)',
              borderRadius: 20,
              border: '1px solid rgba(59,130,246,0.12)',
              padding: 'clamp(20px, 5vw, 30px)',
              width: '100%', boxSizing: 'border-box',
              boxShadow: '0 8px 40px -8px rgba(59,130,246,0.18), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)',
              backdropFilter: 'blur(12px)',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Gradient top bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
              backgroundSize: '200% 100%', animation: 'gradient-rotate 4s linear infinite',
            }} />

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 7 }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@flowcast.in"
                  style={{
                    width: '100%', padding: '11px 15px',
                    fontSize: 14, borderRadius: 11,
                    border: '1.5px solid #e2e8f0',
                    background: '#f8fafc', color: '#0f172a',
                    outline: 'none', boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12), 0 0 16px rgba(59,130,246,0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Password</label>
                  <button type="button" style={{ fontSize: 12, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    style={{
                      width: '100%', padding: '11px 42px 11px 15px',
                      fontSize: 14, borderRadius: 11,
                      border: '1.5px solid #e2e8f0',
                      background: '#f8fafc', color: '#0f172a',
                      outline: 'none', boxSizing: 'border-box',
                      transition: 'all 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.background = '#fff';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12), 0 0 16px rgba(59,130,246,0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#94a3b8', padding: 2, display: 'flex', transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#3b82f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '11px 14px', borderRadius: 10,
                  background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                  fontSize: 13, color: '#dc2626',
                  boxShadow: '0 0 12px rgba(239,68,68,0.1)',
                }}>
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="btn-gradient"
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '13px', borderRadius: 12,
                  fontSize: 14.5, fontWeight: 700,
                  opacity: isLoading ? 0.75 : 1,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {isLoading ? (
                  <>
                    <span style={{
                      width: 16, height: 16, border: '2px solid rgba(255,255,255,0.35)',
                      borderTopColor: '#fff', borderRadius: '50%',
                      animation: 'spin 0.75s linear infinite', display: 'inline-block',
                    }} />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>or</span>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              </div>

              {/* Google sign-in */}
              <a
                href={authApi.googleLoginUrl()}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 10, padding: '12px', borderRadius: 12,
                  fontSize: 14, fontWeight: 600, color: '#374151',
                  background: '#fff', border: '1.5px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  textDecoration: 'none', boxSizing: 'border-box',
                  transition: 'all 0.2s ease', cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)';
                  e.currentTarget.style.background = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
                  e.currentTarget.style.background = '#fff';
                }}
              >
                <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </a>
            </form>
          </div>

          {/* Footer links */}
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748b' }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" style={{ color: '#3b82f6', fontWeight: 700, textDecoration: 'none' }}>
              Create account
            </Link>
          </p>

          {/* Credentials hint */}
          <div style={{
            marginTop: 16, padding: '13px 17px', borderRadius: 12,
            background: 'rgba(59,130,246,0.05)',
            border: '1px solid rgba(59,130,246,0.15)',
            boxShadow: '0 0 16px rgba(59,130,246,0.06)',
          }}>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={13} color="#3b82f6" />
              <p style={{ fontSize: 12.5, fontWeight: 700, color: '#3b82f6' }}>Default admin credentials</p>
            </div>
            <p style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>admin@flowcast.in · Admin@1234</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes gradient-rotate { 0% { background-position: 0% 50%; } 100% { background-position: 300% 50%; } }
        @keyframes orb-drift-1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(40px,-30px) scale(1.08)} 66%{transform:translate(-25px,15px) scale(0.94)} }
        @keyframes orb-drift-2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-35px,25px) scale(1.1)} 66%{transform:translate(20px,-20px) scale(0.95)} }
        @keyframes orb-drift-3 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(25px,20px) scale(1.06)} 66%{transform:translate(-40px,-30px) scale(0.97)} }
        @keyframes particle-rise { 0%{transform:translateY(0) scale(1);opacity:0} 10%{opacity:0.8} 90%{opacity:0.5} 100%{transform:translateY(-100px) scale(0.5);opacity:0} }
      `}</style>
    </div>
  );
}
