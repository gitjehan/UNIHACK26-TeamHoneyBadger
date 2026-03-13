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

export function AmbientPanel({ brightness, warmth, overallScore }: AmbientPanelProps): JSX.Element {
  const level = Math.round(((warmth + (1 - brightness)) / 2) * 100);
  return (
    <div className="card">
      <h3>Ambient Response</h3>
      <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 13 }}>{description(overallScore)}</p>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)', fontSize: 12 }}>
          <span>calm</span>
          <span>elevated</span>
        </div>
        <div style={{ height: 10, background: '#e8e2d6', borderRadius: 999, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${level}%`,
              background: 'linear-gradient(90deg, #4A7C59, #C4962C, #C0392B)',
            }}
          />
        </div>
      </div>
      <div style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 12 }}>
        Brightness {Math.round(brightness * 100)}% · Warmth {Math.round(warmth * 100)}%
      </div>
    </div>
  );
}
