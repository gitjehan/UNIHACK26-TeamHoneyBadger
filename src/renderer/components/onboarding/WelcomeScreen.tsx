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
      <div className="onboarding-card" style={{ textAlign: 'center' }}>
        <h2>KINETIC</h2>
        <p style={{ margin: '0 auto 24px', textAlign: 'center' }}>
          Your webcam tracks posture, blink fatigue, and stress in real time. KINETIC adapts your screen
          brightness, color warmth, and your Bio-Pet — all without interrupting your flow.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
            margin: '0 auto 28px',
            maxWidth: 520,
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                background: 'var(--bg-card-muted)',
                borderRadius: 12,
                padding: '14px 16px',
                textAlign: 'left',
                border: '1px solid var(--border-card)',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>{f.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>
                {f.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{f.desc}</div>
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
