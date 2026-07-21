'use client';

import { getCrowdStyle } from '@/lib/crowdHelpers';

interface Props {
  level: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function CrowdBadge({ level, size = 'sm' }: Props) {
  if (!level) return null;
  const s = getCrowdStyle(level);

  const padding = size === 'lg' ? '4px 12px' : size === 'md' ? '3px 10px' : '2px 8px';
  const fontSize = size === 'lg' ? 12 : size === 'md' ? 11 : 10;
  const dotSize = size === 'lg' ? 7 : 5;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding,
        borderRadius: 99,
        fontSize,
        fontWeight: 700,
        letterSpacing: '0.04em',
        background: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
        boxShadow: `0 0 8px ${s.glow}`,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: s.text,
          display: 'inline-block',
          boxShadow: `0 0 6px ${s.text}`,
          animation: 'pulse-dot 2s ease-in-out infinite',
          flexShrink: 0,
        }}
      />
      {level}
    </span>
  );
}
