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
      <p style={{ margin: '0 0 12px', color: '#6B5D4F', fontSize: 12, lineHeight: 1.5 }}>
        {description(overallScore)}
      </p>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#A89B8C', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          <span>calm</span>
          <span>elevated</span>
        </div>
        <div style={{ height: 8, background: 'var(--border-card)', borderRadius: 999, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${level}%`,
              borderRadius: 999,
              background: 'linear-gradient(90deg, #4A7C59, #B8860B, #C0392B)',
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
          color: '#A89B8C',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.04em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>Brightness <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{Math.round(brightness * 100)}%</span></span>
        <span>Warmth <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{Math.round(warmth * 100)}%</span></span>
      </div>
    </div>
  );
});
