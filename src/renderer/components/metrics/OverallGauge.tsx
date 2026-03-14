import { memo, useEffect, useRef, useState } from 'react';

interface OverallGaugeProps {
  value: number;
}

function gaugeColor(score: number): string {
  if (score >= 70) return '#4A7C59';
  if (score >= 40) return '#B8860B';
  return '#C0392B';
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

  const [offset, setOffset] = useState(circumference);
  const mounted = useRef(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      rafRef.current = requestAnimationFrame(() => setOffset(targetOffset));
    } else {
      setOffset(targetOffset);
    }
    return () => cancelAnimationFrame(rafRef.current);
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
        <circle cx="90" cy="90" r={radius} stroke="#E8E4DC" strokeWidth="14" fill="none" />
        <circle
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
        <text x="90" y="86" textAnchor="middle" fill="var(--text-primary)" fontFamily="var(--font-display)" fontSize="42" fontWeight={400}>
          {clamped}
        </text>
        <text x="90" y="106" textAnchor="middle" fill="var(--text-tertiary)" fontSize="12">
          /100
        </text>
        <text x="90" y="126" textAnchor="middle" fill={color} fontSize="13" fontWeight={600}>
          {grade}
        </text>
      </svg>
    </div>
  );
});
