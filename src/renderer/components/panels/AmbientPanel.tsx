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
    <div className="card ambient-panel">
      <h3>Ambient Response</h3>
      <p style={{ margin: '0 0 12px', color: '#6B5D4F', fontSize: 12, lineHeight: 1.5 }}>
        {description(overallScore)}
      </p>
      <div className="ambient-scale">
        <div className="ambient-scale-labels">
          <span>calm</span>
          <span>elevated</span>
        </div>
        <div className="ambient-scale-track">
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
      <div className="ambient-stats">
        <span>
          Brightness{' '}
          <span className="ambient-stat-value">{Math.round(brightness * 100)}%</span>
        </span>
        <span>
          Warmth{' '}
          <span className="ambient-stat-value">{Math.round(warmth * 100)}%</span>
        </span>
      </div>
    </div>
  );
});
