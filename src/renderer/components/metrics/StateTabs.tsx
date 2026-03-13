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
    <div className="state-tabs">
      {states.map((item) => (
        <button key={item.id} className={`state-tab ${item.id === state ? 'active' : ''}`} type="button">
          <span style={{ marginRight: 4, fontSize: 10 }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
});
