'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, Home, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[FlowCast] Page error:', error);
    }
  }, [error]);

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 120px)',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
      }}
    >
      <div style={{ position: 'absolute', top: '10%', left: '15%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
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

      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 22,
          boxShadow: '0 0 28px rgba(239,68,68,0.15)',
        }}
      >
        <AlertTriangle size={30} color="#f87171" />
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: '0 0 10px', letterSpacing: '-0.02em', textAlign: 'center' }}>
        Something went wrong
      </h1>
      <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 28px', textAlign: 'center', maxWidth: 380, lineHeight: 1.65 }}>
        {process.env.NODE_ENV === 'development'
          ? error.message || 'An unexpected error occurred on this page.'
          : 'An unexpected error occurred. Please try again or go back to the dashboard.'}
      </p>

      {process.env.NODE_ENV === 'development' && error.digest && (
        <code
          style={{
            fontSize: 11,
            color: '#94a3b8',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '5px 12px',
            marginBottom: 24,
            display: 'block',
          }}
        >
          digest: {error.digest}
        </code>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => reset()}
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
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
          }}
        >
          <RefreshCw size={15} />
          Try Again
        </button>

        <button
          onClick={() => router.back()}
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
          }}
        >
          <ArrowLeft size={15} />
          Go Back
        </button>

        <Link
          href="/dashboard"
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
            textDecoration: 'none',
          }}
        >
          <Home size={15} />
          Dashboard
        </Link>
      </div>
    </div>
  );
}
