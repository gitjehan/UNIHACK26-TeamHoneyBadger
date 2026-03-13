import { STATUS_THRESHOLDS } from '@renderer/lib/constants';

type MetricKind = 'posture' | 'blinkRate' | 'focus' | 'stress';

interface MetricCardProps {
  label: string;
  value: number | null;
  unit?: string;
  kind: MetricKind;
}

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

export function MetricCard({ label, value, unit, kind }: MetricCardProps): JSX.Element {
  const status = resolveStatus(kind, value);
  const statusLabel = status === 'good' ? 'Good' : status === 'fair' ? 'Fair' : 'Poor';

  return (
    <div className="card">
      <h3>{label}</h3>
      <div className="metric-value">
        {value === null ? '--' : value}
        {unit ? <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}> {unit}</span> : null}
      </div>
      <span className={`status-badge status-${status}`}>{statusLabel}</span>
    </div>
  );
}
