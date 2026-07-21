'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  /** Override the destination instead of browser history */
  href?: string;
  label?: string;
}

export default function BackButton({ href, label = 'Back' }: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        background: '#fff',
        color: '#64748b',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        marginBottom: 4,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = '#f1f5f9';
        e.currentTarget.style.color = '#0f172a';
        e.currentTarget.style.borderColor = '#cbd5e1';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = '#fff';
        e.currentTarget.style.color = '#64748b';
        e.currentTarget.style.borderColor = '#e2e8f0';
      }}
    >
      <ArrowLeft size={14} />
      {label}
    </button>
  );
}
