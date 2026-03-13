interface CalibrationScreenProps {
  secondsLeft: number;
  collecting: boolean;
}

export function CalibrationScreen({ secondsLeft, collecting }: CalibrationScreenProps): JSX.Element {
  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <h2>Calibration</h2>
        <p>Sit upright, keep shoulders level, and look at the screen.</p>
        <p>We are capturing 3 seconds of baseline posture and blink profile.</p>
        <div style={{ fontSize: 42, fontWeight: 700, marginTop: 10 }}>{secondsLeft}</div>
        <div style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
          {collecting ? 'Collecting calibration samples...' : 'Preparing camera...'}
        </div>
      </div>
    </div>
  );
}
