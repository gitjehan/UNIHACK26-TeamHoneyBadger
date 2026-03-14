interface WelcomeScreenProps {
  onStart: () => void;
}

const svgProps = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const FEATURE_ICONS: Record<string, JSX.Element> = {
  posture: <svg {...svgProps}><circle cx="12" cy="5" r="2"/><path d="M12 7v7M9 14l-2 5M15 14l2 5M9 11H7M15 11h2"/></svg>,
  blink:   <svg {...svgProps}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>,
  stress:  <svg {...svgProps}><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/><circle cx="12" cy="12" r="10"/></svg>,
  pet:     <svg {...svgProps}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
};

const FEATURES = [
  { iconKey: 'posture', title: 'Posture Tracking', desc: 'Real-time spine & shoulder alignment via webcam' },
  { iconKey: 'blink',   title: 'Blink & Fatigue', desc: 'Eye aspect ratio analysis detects fatigue early' },
  { iconKey: 'stress',  title: 'Stress Detection', desc: 'Facial emotion + fidget patterns estimate stress' },
  { iconKey: 'pet',     title: 'Bio-Pet', desc: 'A living companion that thrives when you do' },
];

export function WelcomeScreen({ onStart }: WelcomeScreenProps): JSX.Element {
  return (
    <div className="onboarding">
      <div className="onboarding-card onboarding-card--welcome">
        <h2>AXIS</h2>
        <p style={{ margin: '0 auto 24px', textAlign: 'center' }}>
          Your webcam tracks posture, blink fatigue, and stress in real time. Axis adapts your screen
          brightness, color warmth, and your Bio-Pet — all without interrupting your flow.
        </p>

        <div className="welcome-feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="welcome-feature-card">
              <div className="welcome-feature-icon">{FEATURE_ICONS[f.iconKey]}</div>
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
