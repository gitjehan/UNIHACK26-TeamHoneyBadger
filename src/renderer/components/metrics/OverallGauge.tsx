import { memo, useEffect, useRef, useState } from 'react';

interface OverallGaugeProps {
  value: number;
}

function gaugeColor(score: number): string {
  if (score >= 70) return '#3D6B4F';
  if (score >= 40) return '#C4962C';
  return '#B85A4D';
}

function gradeLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Strong';
  if (score >= 50) return 'Steady';
  if (score >= 35) return 'Fair';
  return 'Needs Focus';
}

export const OverallGauge = memo(function OverallGauge({ value }: OverallGaugeProps): JSX.Element {
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const targetOffset = circumference - (clamped / 100) * circumference;

  // Animate offset on mount and value changes
  const [offset, setOffset] = useState(circumference);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      // Initial mount: animate from empty to current value
      mounted.current = true;
      requestAnimationFrame(() => setOffset(targetOffset));
    } else {
      setOffset(targetOffset);
    }
  }, [targetOffset]);

  const color = gaugeColor(clamped);
  const grade = gradeLabel(clamped);

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h3>Overall</h3>
      <svg
        width="180"
        height="180"
        viewBox="0 0 180 180"
        role="img"
        aria-label={`Overall score: ${clamped} out of 100`}
        style={{ display: 'block', margin: '0 auto' }}
      >
        {/* Zone indicator (faint background ring) */}
        <circle cx="90" cy="90" r={radius} stroke="#e4dfd5" strokeWidth="14" fill="none" />

        {/* Score arc */}
        <circle
          className="gauge-arc"
          cx="90"
          cy="90"
          r={radius}
          stroke={color}
          strokeWidth="14"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 90 90)"
          style={{ transition: 'stroke-dashoffset 0.6s ease-out, stroke 0.4s ease' }}
        />

        {/* Score number */}
        <text x="90" y="86" textAnchor="middle" fill="var(--text-primary)" fontSize="38" fontWeight={700}>
          {clamped}
        </text>

        {/* /100 label */}
        <text x="90" y="106" textAnchor="middle" fill="var(--text-tertiary)" fontSize="12">
          /100
        </text>

        {/* Grade label */}
        <text x="90" y="126" textAnchor="middle" fill={color} fontSize="13" fontWeight={600}>
          {grade}
        </text>
      </svg>
    </div>
  );
});
