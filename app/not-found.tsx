'use client';

import Link from 'next/link';
import { Zap, Home, ArrowLeft, MapPin } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background orbs */}
      <div style={{ position: 'absolute', top: '10%', left: '15%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 11,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            boxShadow: '0 0 24px rgba(59,130,246,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Zap size={19} color="white" />
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
          Flow India
        </span>
      </div>

      {/* 404 number */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <p
          style={{
            fontSize: 140,
            fontWeight: 900,
            letterSpacing: '-0.06em',
            lineHeight: 1,
            margin: 0,
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            userSelect: 'none',
          }}
        >
          404
        </p>
        {/* Map pin decoration */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)' }}>
          <MapPin size={32} color="rgba(255,255,255,0.07)" />
        </div>
      </div>

      {/* Title + subtitle */}
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: '0 0 10px', letterSpacing: '-0.02em', textAlign: 'center' }}>
        Route not found
      </h1>
      <p style={{ fontSize: 14, color: '#475569', margin: '0 0 40px', textAlign: 'center', maxWidth: 380, lineHeight: 1.65 }}>
        Looks like this road doesn&apos;t exist on our map. The page you&apos;re looking for may have moved or never existed.
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          href="/dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 24px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: '#fff',
            textDecoration: 'none',
            boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
            transition: 'opacity 0.15s, transform 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <Home size={15} />
          Go to Dashboard
        </Link>

        <button
          onClick={() => window.history.back()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 24px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            background: 'rgba(255,255,255,0.05)',
            color: '#94a3b8',
            border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#e2e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          <ArrowLeft size={15} />
          Go Back
        </button>
      </div>

      {/* Quick nav links */}
      <div style={{ marginTop: 52, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { label: 'India Map',  href: '/india-map' },
          { label: 'Analytics', href: '/analytics' },
          { label: 'Incidents', href: '/incidents' },
          { label: 'ML Predict', href: '/ml-predict' },
        ].map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            style={{
              fontSize: 12,
              color: '#334155',
              textDecoration: 'none',
              padding: '5px 14px',
              borderRadius: 99,
              border: '1px solid rgba(255,255,255,0.07)',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#334155'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
