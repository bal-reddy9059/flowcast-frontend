'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Zap, Eye, EyeOff, AlertCircle, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function FloatingOrb({ style }: { style: React.CSSProperties }) {
  return <div style={{ position: 'absolute', borderRadius: '50%', filter: 'blur(72px)', pointerEvents: 'none', ...style }} />;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focus, setFocus] = useState({ fullName: false, email: false, password: false, confirm: false });
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const pwdChecks = [
    { label: '8+ characters',   ok: form.password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(form.password) },
    { label: 'Number',           ok: /\d/.test(form.password) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setIsLoading(true);
    try {
      await register(form.email, form.fullName, form.password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const setF = (field: keyof typeof focus, val: boolean) => setFocus((p) => ({ ...p, [field]: val }));

  const inputStyle = (f: boolean): React.CSSProperties => ({
    width: '100%', padding: '11px 15px', fontSize: 14, borderRadius: 11,
    border: `1.5px solid ${f ? '#3b82f6' : '#e2e8f0'}`,
    background: f ? '#fff' : '#f8fafc', color: '#0f172a', outline: 'none',
    boxShadow: f ? '0 0 0 3px rgba(59,130,246,0.12), 0 0 16px rgba(59,130,246,0.1)' : 'none',
    transition: 'all 0.2s ease', boxSizing: 'border-box',
  });

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', position: 'relative',
      background: 'linear-gradient(135deg, #f8faff 0%, #f1f5f9 50%, #f0f4ff 100%)',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    }}>
      {/* Dot grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle, rgba(59,130,246,0.12) 1px, transparent 1px)',
        backgroundSize: '26px 26px', opacity: 0.7, pointerEvents: 'none',
      }} />

      {/* Orbs */}
      <FloatingOrb style={{ width: 400, height: 400, background: 'rgba(139,92,246,0.08)', top: -100, right: -100 }} />
      <FloatingOrb style={{ width: 300, height: 300, background: 'rgba(59,130,246,0.07)', bottom: -60, left: -60 }} />
      <FloatingOrb style={{ width: 200, height: 200, background: 'rgba(16,185,129,0.06)', top: '50%', left: '45%' }} />

      <div style={{ width: '100%', maxWidth: 480, position: 'relative' }} className={mounted ? 'slide-up' : ''}>

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div style={{
            width: 42, height: 42, borderRadius: 13,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            boxShadow: '0 0 24px rgba(59,130,246,0.5), 0 0 48px rgba(139,92,246,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={20} color="white" />
          </div>
          <div>
            <p className="gradient-text-animated" style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>Flow India</p>
            <p style={{ fontSize: 11.5, color: '#94a3b8' }}>Traffic Intelligence Platform</p>
          </div>
        </div>

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 6 }}>
            Create your account
          </h1>
          <p style={{ fontSize: 14, color: '#64748b' }}>Join India&apos;s leading traffic intelligence platform</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.95)', borderRadius: 22,
          border: '1px solid rgba(59,130,246,0.12)', padding: '32px',
          boxShadow: '0 8px 40px -8px rgba(59,130,246,0.18), 0 2px 8px rgba(0,0,0,0.04)',
          backdropFilter: 'blur(12px)', position: 'relative', overflow: 'hidden',
        }}>
          {/* Gradient top bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 3,
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #10b981)',
            backgroundSize: '300% 100%', animation: 'gradient-rotate 5s linear infinite',
          }} />

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Full Name */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 7 }}>Full name</label>
              <input
                type="text" value={form.fullName} required placeholder="Arjun Sharma"
                style={inputStyle(focus.fullName)}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                onFocus={() => setF('fullName', true)} onBlur={() => setF('fullName', false)}
              />
            </div>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 7 }}>Email address</label>
              <input
                type="email" value={form.email} required placeholder="arjun@company.in"
                style={inputStyle(focus.email)}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                onFocus={() => setF('email', true)} onBlur={() => setF('email', false)}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 7 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password} required placeholder="Min 8 chars, 1 uppercase, 1 number"
                  style={inputStyle(focus.password)}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  onFocus={() => setF('password', true)} onBlur={() => setF('password', false)}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 2 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#3b82f6')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password strength */}
              {form.password && (
                <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                  {pwdChecks.map(({ label, ok }) => (
                    <div key={label} className="flex items-center gap-1.5" style={{ flex: 1 }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
                        border: `1.5px solid ${ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.3)'}`,
                        boxShadow: ok ? '0 0 6px rgba(16,185,129,0.3)' : 'none',
                        transition: 'all 0.25s ease',
                      }}>
                        {ok && <Check size={9} color="#10b981" strokeWidth={3} />}
                      </span>
                      <span style={{ fontSize: 11, color: ok ? '#10b981' : '#94a3b8', fontWeight: 500 }}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 7 }}>Confirm password</label>
              <input
                type="password" value={form.confirm} required placeholder="Re-enter your password"
                style={{
                  ...inputStyle(focus.confirm),
                  borderColor: form.confirm && form.confirm !== form.password ? '#ef4444' : focus.confirm ? '#3b82f6' : '#e2e8f0',
                  boxShadow: form.confirm && form.confirm !== form.password ? '0 0 0 3px rgba(239,68,68,0.12)' : focus.confirm ? '0 0 0 3px rgba(59,130,246,0.12)' : 'none',
                }}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                onFocus={() => setF('confirm', true)} onBlur={() => setF('confirm', false)}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '11px 14px', borderRadius: 10,
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                fontSize: 13, color: '#dc2626', boxShadow: '0 0 12px rgba(239,68,68,0.1)',
              }}>
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit" disabled={isLoading}
              className="btn-gradient"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '13px', borderRadius: 12,
                fontSize: 14.5, fontWeight: 700,
                opacity: isLoading ? 0.75 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                marginTop: 4,
              }}
            >
              {isLoading ? (
                <>
                  <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.75s linear infinite', display: 'inline-block' }} />
                  Creating account…
                </>
              ) : (
                <>Create Account <ArrowRight size={16} /></>
              )}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748b' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#3b82f6', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes gradient-rotate { 0% { background-position: 0% 50%; } 100% { background-position: 300% 50%; } }
      `}</style>
    </div>
  );
}
