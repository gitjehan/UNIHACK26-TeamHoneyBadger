interface WelcomeScreenProps {
  onStart: () => void;
}

const FEATURES = [
  { icon: '\u{1F9CD}', title: 'Posture Tracking', desc: 'Real-time spine & shoulder alignment via webcam' },
  { icon: '\u{1F441}', title: 'Blink & Fatigue', desc: 'Eye aspect ratio analysis detects fatigue early' },
  { icon: '\u{1F9E0}', title: 'Stress Detection', desc: 'Facial emotion + fidget patterns estimate stress' },
  { icon: '\u{1F423}', title: 'Bio-Pet', desc: 'A living companion that thrives when you do' },
];

export function WelcomeScreen({ onStart }: WelcomeScreenProps): JSX.Element {
  return (
    <div className="onboarding">
      <div className="onboarding-card onboarding-card--welcome">
        <h2>KINETIC</h2>
        <p style={{ margin: '0 auto 24px', textAlign: 'center' }}>
          Your webcam tracks posture, blink fatigue, and stress in real time. KINETIC adapts your screen
          brightness, color warmth, and your Bio-Pet — all without interrupting your flow.
        </p>

        <div className="welcome-feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="welcome-feature-card">
              <div className="welcome-feature-icon">{f.icon}</div>
              <div className="welcome-feature-title">{f.title}</div>
              <div className="welcome-feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="actions" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" type="button" onClick={onStart} style={{ padding: '12px 28px', fontSize: 14 }}>
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
