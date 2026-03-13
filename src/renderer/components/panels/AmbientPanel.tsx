import { memo } from 'react';

interface AmbientPanelProps {
  brightness: number;
  warmth: number;
  overallScore: number;
}

function description(score: number): string {
  if (score >= 70) return 'Environment stable. Daylight profile active.';
  if (score >= 40) return 'Mild strain detected. Gentle warmth and dimming active.';
  return 'Elevated strain. Blue light reduced and display dimmed.';
}

export const AmbientPanel = memo(function AmbientPanel({ brightness, warmth, overallScore }: AmbientPanelProps): JSX.Element {
  const level = Math.round(((warmth + (1 - brightness)) / 2) * 100);
  return (
    <div className="card">
      <h3>Ambient Response</h3>
      <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
        {description(overallScore)}
      </p>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>calm</span>
          <span>elevated</span>
        </div>
        <div style={{ height: 8, background: '#e8e2d6', borderRadius: 999, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${level}%`,
              borderRadius: 999,
              background: 'linear-gradient(90deg, #3D6B4F, #C4962C, #B85A4D)',
              transition: 'width 0.6s ease-out',
            }}
          />
        </div>
      </div>
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          gap: 16,
          color: 'var(--text-secondary)',
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>Brightness {Math.round(brightness * 100)}%</span>
        <span>Warmth {Math.round(warmth * 100)}%</span>
      </div>
    </div>
  );
});
