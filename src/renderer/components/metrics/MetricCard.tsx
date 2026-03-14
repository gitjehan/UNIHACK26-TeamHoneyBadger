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

/** Normalise value to 0-100 for the progress bar. */
function progressPercent(kind: MetricKind, value: number | null): number {
  if (value === null) return 0;
  if (kind === 'stress') return Math.max(0, Math.min(100, 100 - value));
  if (kind === 'blinkRate') {
    const mid = (STATUS_THRESHOLDS.blinkRate.goodMin + STATUS_THRESHOLDS.blinkRate.goodMax) / 2;
    const maxDev = STATUS_THRESHOLDS.blinkRate.fairMax - mid;
    const dev = Math.abs(value - mid);
    return Math.max(0, Math.min(100, ((maxDev - dev) / maxDev) * 100));
  }
  return Math.max(0, Math.min(100, value));
}

export const MetricCard = memo(function MetricCard({ label, value, unit, kind }: MetricCardProps): JSX.Element {
  const status = resolveStatus(kind, value);
  const statusLabel = status === 'good' ? 'Good' : status === 'fair' ? 'Fair' : 'Poor';
  const prevValueRef = useRef(value);
  const [flash, setFlash] = useState(false);
  const [blinkPulse, setBlinkPulse] = useState(false);
  const pct = progressPercent(kind, value);
  const isBlinkRate = kind === 'blinkRate';

  useEffect(() => {
    if (prevValueRef.current !== value) {
      const prev = prevValueRef.current;
      prevValueRef.current = value;

      setFlash(true);
      const flashTimeout = setTimeout(() => setFlash(false), 350);

      let blinkTimeout: ReturnType<typeof setTimeout> | undefined;
      if (isBlinkRate && prev !== null && value !== null && value > prev) {
        setBlinkPulse(true);
        blinkTimeout = setTimeout(() => setBlinkPulse(false), 450);
      } else {
        setBlinkPulse(false);
      }

      return () => {
        clearTimeout(flashTimeout);
        if (blinkTimeout) clearTimeout(blinkTimeout);
      };
    }
  }, [value, isBlinkRate]);

  return (
    <div className="card">
      {value === null ? (
        <div className="metric-pill-body">
          <div className="metric-pill-left">
            <div className="skeleton skeleton-value" />
            <div className="skeleton skeleton-badge" />
          </div>
        </div>
      ) : (
        <>
          <div className="metric-pill-body">
            <div className="metric-pill-left">
              <h3>
                <span style={{ marginRight: 4, fontSize: 12, lineHeight: 1 }}>{KIND_ICON[kind]}</span>
                {label}
              </h3>
              <div
                className={`metric-value ${isBlinkRate && blinkPulse ? 'metric-value--blink-pulse' : ''}`}
                style={{
                  color: statusColor(status),
                  transform: flash ? 'scale(1.03)' : 'scale(1)',
                  transition: 'color 0.25s ease, transform 0.2s ease-out',
                }}
              >
                <span>{value}</span>
                {unit ? <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: '#A89B8C' }}>{unit}</span> : null}
              </div>
            </div>
            <span className={`status-badge status-${status}`}>{statusLabel}</span>
          </div>
          <div className="metric-progress-track">
            <div
              className="metric-progress-fill"
              style={{
                width: `${pct}%`,
                backgroundColor: statusColor(status),
              }}
            />
          </div>
        </>
      )}
    </div>
  );
});
