import { memo, useEffect, useRef, useState } from 'react';
import { StateTabs } from '@renderer/components/metrics/StateTabs';
import { scoreEngine } from '@renderer/ml/score-engine';
import type { OverallState } from '@renderer/lib/types';

interface HeaderProps {
  state: OverallState;
  onEndSession: () => void;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 1) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export const Header = memo(function Header({ state, onEndSession }: HeaderProps): JSX.Element {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = () => {
      const stats = scoreEngine.getSessionStats();
      setElapsed(stats.durationSeconds);
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <header className="top-header">
      <div className="brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="brand-logo">
          <circle cx="12" cy="12" r="11" stroke="#4A7C59" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="7" stroke="#6B9E7A" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="3" fill="#4A7C59" />
        </svg>
        <div className="brand-text">
          <h1>Kinetic</h1>
          <span>bio-responsive workspace</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--text-tertiary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatElapsed(elapsed)}
        </span>
        <StateTabs state={state} />
        <button className="btn btn-secondary" type="button" onClick={onEndSession}>
          End Session
        </button>
      </div>
    </header>
  );
});
