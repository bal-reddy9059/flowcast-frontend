'use client';

import { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

export function ApiPageShell({
  title,
  subtitle,
  badge,
  badgeColor = '#3b82f6',
  onRefresh,
  loading,
  children,
  actions,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  onRefresh?: () => void;
  loading?: boolean;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="page-hero">
        <div className="stack-mobile" style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              {badge && (
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                  padding: '3px 8px', borderRadius: 99,
                  background: `${badgeColor}18`, color: badgeColor,
                  border: `1px solid ${badgeColor}40`,
                }}>
                  {badge}
                </span>
              )}
            </div>
            <h1 className="text-white sm:text-[26px]" style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: '-0.03em' }}>{title}</h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginTop: 6, marginBottom: 0 }}>{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {actions}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="flex items-center gap-2"
                style={{
                  padding: '8px 14px', borderRadius: 10, border: '1px solid #e2e8f0',
                  background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export function JsonCard({ title, data, empty = 'No data' }: { title: string; data: unknown; empty?: string }) {
  const hasData = data !== null && data !== undefined && !(Array.isArray(data) && data.length === 0);
  return (
    <div className="neon-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 12px' }}>{title}</h3>
      {!hasData ? (
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{empty}</p>
      ) : (
        <pre style={{
          margin: 0, fontSize: 12, lineHeight: 1.5, color: '#334155',
          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
          padding: 14, overflow: 'auto', maxHeight: 420, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function StatPill({ label, value, color = '#3b82f6' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="neon-card" style={{ padding: '16px 18px' }}>
      <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color, margin: '6px 0 0', letterSpacing: '-0.03em' }}>{value}</p>
    </div>
  );
}

export function Field({
  label, value, onChange, type = 'text', options, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  options?: string[];
  placeholder?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: '#64748b' }}>
      {label}
      {options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a', background: '#fff' }}
        >
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a' }}
        />
      )}
    </label>
  );
}
