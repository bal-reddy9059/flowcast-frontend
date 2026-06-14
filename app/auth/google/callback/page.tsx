'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap } from 'lucide-react';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = params.get('token');

    if (!token) {
      setError('No authentication token received from Google.');
      setStatus('error');
      return;
    }

    localStorage.setItem('flowcast_token', token);
    router.replace('/dashboard');
  }, [params, router]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #f8faff 0%, #f1f5f9 50%, #f0f4ff 100%)',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '40px 36px',
        boxShadow: '0 8px 40px -8px rgba(59,130,246,0.18)',
        border: '1px solid rgba(59,130,246,0.12)',
        textAlign: 'center', maxWidth: 380, width: '100%',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 28px rgba(59,130,246,0.4)',
        }}>
          <Zap size={24} color="white" />
        </div>

        {status === 'loading' ? (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
              Signing you in…
            </h2>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 24px' }}>
              Completing Google authentication
            </p>
            <div style={{
              width: 36, height: 36, margin: '0 auto',
              border: '3px solid rgba(59,130,246,0.2)',
              borderTopColor: '#3b82f6', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#dc2626', margin: '0 0 8px' }}>
              Sign-in failed
            </h2>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 20px' }}>{error}</p>
            <button
              onClick={() => router.push('/login')}
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                color: '#fff', border: 'none', borderRadius: 10,
                padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Back to Login
            </button>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
