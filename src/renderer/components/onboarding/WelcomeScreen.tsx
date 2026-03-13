interface WelcomeScreenProps {
  onStart: () => void;
}

export function WelcomeScreen({ onStart }: WelcomeScreenProps): JSX.Element {
  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <h2>KINETIC</h2>
        <p>
          Your webcam tracks posture, blink fatigue, and stress in real time. KINETIC adapts your screen
          brightness, color warmth, and your Bio-Pet state without interrupting your flow.
        </p>
        <p>
          First run takes ~3 seconds to calibrate your upright baseline. Keep your shoulders level and look at
          the screen.
        </p>
        <div className="actions">
          <button className="btn btn-primary" type="button" onClick={onStart}>
            Start Calibration
          </button>
        </div>
      </div>
    </div>
  );
}
