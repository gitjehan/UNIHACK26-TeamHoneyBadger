import type { RefObject } from 'react';

interface CalibrationScreenProps {
  secondsLeft: number;
  collecting: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  error: string | null;
}

export function CalibrationScreen({
  secondsLeft,
  collecting,
  videoRef,
  error,
}: CalibrationScreenProps): JSX.Element {
  return (
    <div className="onboarding">
      <div className="onboarding-card" style={{ textAlign: 'center' }}>
        <h2>Calibrating</h2>
        <p style={{ margin: '0 auto 16px', textAlign: 'center' }}>
          Sit upright, keep shoulders level, and look at the screen.
        </p>

        <div
          style={{
            marginTop: 10,
            borderRadius: 14,
            overflow: 'hidden',
            border: '1px solid var(--border-card)',
            background: 'var(--bg-card-muted)',
            maxWidth: 480,
            margin: '0 auto',
          }}
        >
          <video
            ref={videoRef}
            style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }}
            muted
            playsInline
            autoPlay
          />
        </div>

        {/* Countdown ring */}
        <div style={{ position: 'relative', width: 80, height: 80, margin: '20px auto 0' }}>
          <svg width="80" height="80" viewBox="0 0 80 80" style={{ display: 'block' }}>
            <circle cx="40" cy="40" r="34" stroke="var(--border-card)" strokeWidth="5" fill="none" />
            <circle
              cx="40"
              cy="40"
              r="34"
              stroke="var(--accent)"
              strokeWidth="5"
              fill="none"
              strokeDasharray={2 * Math.PI * 34}
              strokeDashoffset={2 * Math.PI * 34 * (secondsLeft / 3)}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            {secondsLeft}
          </div>
        </div>

        <div style={{ color: 'var(--text-secondary)', marginTop: 10, fontSize: 13 }}>
          {collecting ? 'Capturing baseline posture...' : 'Preparing camera...'}
        </div>
        {error ? <div style={{ marginTop: 8, color: 'var(--red-primary)', fontSize: 13 }}>{error}</div> : null}
      </div>
    </div>
  );
}
