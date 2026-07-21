'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Zap, MapPin, Clock, AlertCircle, Navigation } from 'lucide-react';
import { routeApi } from '@/lib/api';

function apiError(e: unknown) {
  const err = e as { response?: { data?: { error?: string; detail?: string } }; message?: string };
  return err.response?.data?.error
    || err.response?.data?.detail
    || err.message
    || 'Failed to load shared route';
}

export default function PublicSharedRoutePage() {
  const params = useParams();
  const token = String(params.token ?? '');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Missing share token. Open a link created via POST /routes/saved/{id}/share.');
      setLoading(false);
      return;
    }
    setLoading(true);
    routeApi.getShared(token)
      .then((res) => {
        setData(res.data);
        setError('');
      })
      .catch((err) => {
        setData(null);
        setError(apiError(err));
      })
      .finally(() => setLoading(false));
  }, [token]);

  const routeName = String(data?.route_name ?? data?.name ?? 'Shared route');
  const origin = String(data?.origin_name ?? data?.origin ?? '—');
  const destination = String(data?.destination_name ?? data?.destination ?? '—');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 24px rgba(59,130,246,0.45)',
        }}>
          <Zap size={19} color="white" />
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>Flow India</span>
      </div>

      <div style={{
        width: '100%', maxWidth: 560, borderRadius: 18,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
        padding: 28, backdropFilter: 'blur(12px)',
      }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#67e8f9', textTransform: 'uppercase' }}>
          Shared route
        </p>
        <h1 style={{ margin: '8px 0 0', fontSize: 24, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
          {loading ? 'Loading…' : error ? 'Link unavailable' : routeName}
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
          Public link from a share token. Route UUIDs will not work here.
        </p>

        {loading && (
          <p style={{ marginTop: 24, color: '#94a3b8', fontSize: 14 }}>Fetching shared route…</p>
        )}

        {error && (
          <div style={{
            marginTop: 20, padding: 14, borderRadius: 12,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5', fontSize: 13, display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && data && (
          <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Row icon={<MapPin size={14} color="#60a5fa" />} label="Origin" value={origin} />
            <Row icon={<Navigation size={14} color="#f87171" />} label="Destination" value={destination} />
            {data.distance_km != null && (
              <Row icon={<Clock size={14} color="#a78bfa" />} label="Distance" value={`${data.distance_km} km`} />
            )}
            {data.duration_minutes != null && (
              <Row icon={<Clock size={14} color="#34d399" />} label="Duration" value={`${data.duration_minutes} min`} />
            )}
          </div>
        )}

        <div style={{ marginTop: 28, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link
            href="/login"
            style={{
              padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff', textDecoration: 'none',
            }}
          >
            Open Flow India
          </Link>
          <Link
            href="/route-optimizer"
            style={{
              padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: 'rgba(255,255,255,0.06)', color: '#cbd5e1',
              border: '1px solid rgba(255,255,255,0.12)', textDecoration: 'none',
            }}
          >
            Route Optimizer
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {icon}
      <div>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{value}</p>
      </div>
    </div>
  );
}
