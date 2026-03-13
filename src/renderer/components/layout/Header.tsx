import { StateTabs } from '@renderer/components/metrics/StateTabs';
import type { OverallState } from '@renderer/lib/types';

interface HeaderProps {
  state: OverallState;
  onEndSession: () => void;
}

export function Header({ state, onEndSession }: HeaderProps): JSX.Element {
  return (
    <header className="top-header">
      <div className="brand">
        <h1>Kinetic</h1>
        <span>bio-responsive workspace</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <StateTabs state={state} />
        <button className="btn btn-secondary" type="button" onClick={onEndSession}>
          End Session
        </button>
      </div>
    </header>
  );
}
