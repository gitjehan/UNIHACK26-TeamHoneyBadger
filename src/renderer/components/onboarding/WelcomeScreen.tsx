import { useEffect, useRef } from 'react';

interface WelcomeScreenProps {
  onStart: () => void;
}

const FEATURES = [
  {
    title: 'Posture tracking',
    desc: 'Spine & shoulder alignment in real time',
    icon: (
      <svg className="ws-feat-icon" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="6" r="3" stroke="#4e7d5a" strokeWidth="1.5"/>
        <line x1="14" y1="9" x2="14" y2="18" stroke="#4e7d5a" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="8" y1="13" x2="20" y2="13" stroke="#4e7d5a" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="14" y1="18" x2="10" y2="24" stroke="#4e7d5a" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="14" y1="18" x2="18" y2="24" stroke="#4e7d5a" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: 'Blink & fatigue',
    desc: 'Eye aspect ratio detects fatigue early',
    icon: (
      <svg className="ws-feat-icon" viewBox="0 0 28 28" fill="none">
        <path d="M4 14 Q14 4 24 14 Q14 24 4 14 Z" stroke="#4e7d5a" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
        <circle cx="14" cy="14" r="4" fill="#4e7d5a" opacity="0.2"/>
        <circle cx="14" cy="14" r="2.2" fill="#4e7d5a"/>
        <circle cx="15.5" cy="12.5" r="0.8" fill="#ffffff" opacity="0.7"/>
      </svg>
    ),
  },
  {
    title: 'Stress detection',
    desc: 'Facial & fidget signals read your state',
    icon: (
      <svg className="ws-feat-icon" viewBox="0 0 28 28" fill="none">
        <path
          d="M17 3 L10 14 L15 14 L11 25 L21 12 L15.5 12 Z"
          stroke="#4e7d5a" strokeWidth="1.5"
          strokeLinejoin="round" strokeLinecap="round"
          fill="#4e7d5a18"
        />
      </svg>
    ),
  },
  {
    title: 'Bio-pet',
    desc: 'A companion that thrives when you do',
    icon: (
      <svg className="ws-feat-icon" viewBox="0 0 28 28" fill="none">
        <path
          d="M14 23 C14 23 4 17 4 10.5 C4 7.5 6.5 5 9.5 5 C11.5 5 13 6 14 7.5 C15 6 16.5 5 18.5 5 C21.5 5 24 7.5 24 10.5 C24 17 14 23 14 23 Z"
          stroke="#4e7d5a" strokeWidth="1.5" strokeLinejoin="round"
          fill="#4e7d5a18"
        />
      </svg>
    ),
  },
];

export function WelcomeScreen({ onStart }: WelcomeScreenProps): JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const dot = dotRef.current;
    if (!wrap || !dot) return;

    const onMove = (e: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      dot.style.left = (e.clientX - rect.left) + 'px';
      dot.style.top = (e.clientY - rect.top) + 'px';
    };
    const onLeave = () => { dot.style.opacity = '0'; };
    const onEnter = () => { dot.style.opacity = '1'; };

    wrap.addEventListener('mousemove', onMove);
    wrap.addEventListener('mouseleave', onLeave);
    wrap.addEventListener('mouseenter', onEnter);
    return () => {
      wrap.removeEventListener('mousemove', onMove);
      wrap.removeEventListener('mouseleave', onLeave);
      wrap.removeEventListener('mouseenter', onEnter);
    };
  }, []);

  return (
    <div className="onboarding">
      <div className="ws-wrap" ref={wrapRef}>
        <div className="ws-cursor-dot" ref={dotRef} />

        {/* Background grid */}
        <div className="ws-grid-lines">
          <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="wsg" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0H0V40" fill="none" stroke="#3a6645" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="600" height="600" fill="url(#wsg)"/>
          </svg>
        </div>

        {/* Corner brackets */}
        <div className="ws-corner ws-c-tl"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M0 12 L0 0 L12 0" stroke="#3a6645" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
        <div className="ws-corner ws-c-tr"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M0 12 L0 0 L12 0" stroke="#3a6645" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
        <div className="ws-corner ws-c-bl"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M0 12 L0 0 L12 0" stroke="#3a6645" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
        <div className="ws-corner ws-c-br"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M0 12 L0 0 L12 0" stroke="#3a6645" strokeWidth="1.5" strokeLinecap="round"/></svg></div>

        {/* Ambient orbs */}
        <div className="ws-bg-orb ws-orb1" />
        <div className="ws-bg-orb ws-orb2" />

        {/* Logo */}
        <div className="ws-logo">AXIS</div>
        <div className="ws-logo-line" />
        <div className="ws-tagline">Your living workspace</div>

        {/* Feature cards */}
        <div className="ws-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="ws-feat">
              {f.icon}
              <div className="ws-feat-name">{f.title}</div>
              <div className="ws-feat-desc">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Status */}
        <div className="ws-status-bar">
          <div className="ws-status-dot" />
          <span className="ws-status-text">Webcam ready · No data stored · Runs locally</span>
        </div>

        {/* CTA */}
        <div className="ws-btn-wrap">
          <button className="ws-start-btn" type="button" onClick={onStart}>
            Begin session
          </button>
        </div>
      </div>
    </div>
  );
}
