import { memo, useEffect, useRef, useState } from 'react';
import { STATUS_THRESHOLDS } from '@renderer/lib/constants';

type MetricKind = 'posture' | 'blinkRate' | 'focus' | 'stress';

interface MetricCardProps {
  label: string;
  value: number | null;
  unit?: string;
  kind: MetricKind;
}

const KIND_ICON: Record<MetricKind, string> = {
  posture: '\u{1F9CD}',
  blinkRate: '\u{1F441}',
  focus: '\u{1F3AF}',
  stress: '\u{1F9E0}',
};

function resolveStatus(kind: MetricKind, value: number | null): 'good' | 'fair' | 'poor' {
  if (value === null) return 'fair';
  if (kind === 'posture') {
    if (value >= STATUS_THRESHOLDS.posture.good) return 'good';
    if (value >= STATUS_THRESHOLDS.posture.fair) return 'fair';
    return 'poor';
  }
  if (kind === 'focus') {
    if (value >= STATUS_THRESHOLDS.focus.good) return 'good';
    if (value >= STATUS_THRESHOLDS.focus.fair) return 'fair';
    return 'poor';
  }
  if (kind === 'stress') {
    if (value < STATUS_THRESHOLDS.stress.good) return 'good';
    if (value <= STATUS_THRESHOLDS.stress.fair) return 'fair';
    return 'poor';
  }
  if (value >= STATUS_THRESHOLDS.blinkRate.goodMin && value <= STATUS_THRESHOLDS.blinkRate.goodMax) return 'good';
  if (value >= STATUS_THRESHOLDS.blinkRate.fairMin && value <= STATUS_THRESHOLDS.blinkRate.fairMax) return 'fair';
  return 'poor';
}

function statusColor(status: 'good' | 'fair' | 'poor'): string {
  if (status === 'good') return 'var(--green-primary)';
  if (status === 'fair') return 'var(--amber-primary)';
  return 'var(--red-primary)';
}

export const MetricCard = memo(function MetricCard({ label, value, unit, kind }: MetricCardProps): JSX.Element {
  const status = resolveStatus(kind, value);
  const statusLabel = status === 'good' ? 'Good' : status === 'fair' ? 'Fair' : 'Poor';
  const prevValueRef = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 350);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <div className="card">
      <h3>
        <span style={{ marginRight: 4 }}>{KIND_ICON[kind]}</span>
        {label}
      </h3>
      <div
        className="metric-value"
        style={{
          color: statusColor(status),
          transform: flash ? 'scale(1.03)' : 'scale(1)',
          transition: 'color 0.25s ease, transform 0.2s ease-out',
        }}
      >
        {value === null ? '--' : value}
        {unit ? <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-tertiary)' }}> {unit}</span> : null}
      </div>
      <span className={`status-badge status-${status}`}>{statusLabel}</span>
    </div>
  );
});
