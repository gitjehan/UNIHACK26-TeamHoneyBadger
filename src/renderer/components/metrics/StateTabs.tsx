import type { OverallState } from '@renderer/lib/types';

interface StateTabsProps {
  state: OverallState;
}

const states: Array<{ id: OverallState; label: string }> = [
  { id: 'upright', label: 'Upright' },
  { id: 'slouching', label: 'Slouching' },
  { id: 'fatigued', label: 'Fatigued' },
];

export function StateTabs({ state }: StateTabsProps): JSX.Element {
  return (
    <div className="state-tabs">
      {states.map((item) => (
        <button key={item.id} className={`state-tab ${item.id === state ? 'active' : ''}`} type="button">
          {item.label}
        </button>
      ))}
    </div>
  );
}
