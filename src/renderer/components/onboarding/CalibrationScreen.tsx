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
      <div className="onboarding-card">
        <h2>Calibration</h2>
        <p>Sit upright, keep shoulders level, and look at the screen.</p>
        <p>We are capturing 3 seconds of baseline posture and blink profile.</p>
        <div
          style={{
            marginTop: 14,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid #253040',
            background: '#0d1117',
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
        <div style={{ fontSize: 42, fontWeight: 700, marginTop: 10 }}>{secondsLeft}</div>
        <div style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
          {collecting ? 'Collecting calibration samples...' : 'Preparing camera...'}
        </div>
        {error ? <div style={{ marginTop: 8, color: '#f2a39b' }}>{error}</div> : null}
      </div>
    </div>
  );
}
