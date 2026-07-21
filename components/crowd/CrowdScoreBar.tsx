'use client';

import { useEffect, useState } from 'react';
import { getCrowdColor, getCrowdStyle } from '@/lib/crowdHelpers';

interface Props {
  score: number;
  level: string;
  showLabel?: boolean;
  height?: number;
}

export default function CrowdScoreBar({ score, level, showLabel = true, height = 8 }: Props) {
  const [width, setWidth] = useState(0);
  const color = getCrowdColor(level);
  const s = getCrowdStyle(level);

  useEffect(() => {
    const t = setTimeout(() => setWidth(score), 80);
    return () => clearTimeout(t);
  }, [score]);

  return (
    <div>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Crowd Score
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, color, tabularNums: true } as React.CSSProperties}>
            {score}<span style={{ color: '#cbd5e1', fontWeight: 400 }}>/100</span>
          </span>
        </div>
      )}
      <div
        style={{
          height,
          background: '#f1f5f9',
          borderRadius: 99,
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        <div
          className={s.progressClass}
          style={{
            height: '100%',
            width: `${width}%`,
            transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      </div>
    </div>
  );
}
