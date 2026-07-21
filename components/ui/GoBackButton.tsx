'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function GoBackButton() {
  const router = useRouter();
  return (
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
  );
}
