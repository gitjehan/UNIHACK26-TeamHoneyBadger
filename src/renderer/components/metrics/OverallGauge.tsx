interface OverallGaugeProps {
  value: number;
}

function gaugeColor(score: number): string {
  if (score >= 70) return '#4A7C59';
  if (score >= 40) return '#C4962C';
  return '#C0392B';
}

export function OverallGauge({ value }: OverallGaugeProps): JSX.Element {
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="card">
      <h3>Overall</h3>
      <svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label="Overall score gauge">
        <circle cx="90" cy="90" r={radius} stroke="#273445" strokeWidth="14" fill="none" />
        <circle
          cx="90"
          cy="90"
          r={radius}
          stroke={gaugeColor(clamped)}
          strokeWidth="14"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 90 90)"
        />
        <text x="90" y="92" textAnchor="middle" fill="var(--text-primary)" fontSize="34" fontWeight={700}>
          {clamped}
        </text>
        <text x="90" y="112" textAnchor="middle" fill="var(--text-secondary)" fontSize="12">
          /100
        </text>
      </svg>
    </div>
  );
}
