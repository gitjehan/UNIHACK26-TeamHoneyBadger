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
  if (score >= 70) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
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
        <circle cx="90" cy="90" r={radius} stroke="#E8E4DC" strokeWidth="4" fill="none" />
        <circle
          cx="90"
          cy="90"
          r={radius}
          stroke={color}
          strokeWidth="4"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 90 90)"
          style={{ transition: 'stroke-dasharray 1s ease, stroke 1s ease, stroke-dashoffset 1s ease' }}
        />
        <text x="90" y="83" textAnchor="middle" fill={color} fontFamily="'Cormorant Garamond', 'Instrument Serif', Georgia, serif" fontSize="38" fontWeight={500} letterSpacing="-0.02em">{clamped}</text>
        <text x="90" y="100" textAnchor="middle" fill="#A89B8C" fontFamily="'DM Sans', sans-serif" fontSize="11" fontWeight={500}>/100</text>
        <text x="90" y="115" textAnchor="middle" fill={color} fontFamily="'DM Sans', sans-serif" fontSize="10" fontWeight={600} letterSpacing="0.08em">{grade.toUpperCase()}</text>
      </svg>
    </div>
  );
});
