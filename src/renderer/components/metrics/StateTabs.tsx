import { memo } from 'react';
import type { OverallState } from '@renderer/lib/types';

interface StateTabsProps {
  state: OverallState;
}

const states: Array<{ id: OverallState; label: string; icon: string }> = [
  { id: 'upright', label: 'Upright', icon: '\u2713' },
  { id: 'slouching', label: 'Slouching', icon: '\u26A0' },
  { id: 'fatigued', label: 'Fatigued', icon: '\u23F3' },
];

export const StateTabs = memo(function StateTabs({ state }: StateTabsProps): JSX.Element {
  return (
    <div className="state-tabs" role="status" aria-label={`Current state: ${state}`}>
      {states.map((item) => (
        <div key={item.id} className={`state-tab ${item.id === state ? 'active' : ''}`}>
          <span style={{ marginRight: 4, fontSize: 10 }}>{item.icon}</span>
          {item.label}
        </div>
      ))}
    </div>
  );
});
