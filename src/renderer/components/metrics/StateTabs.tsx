import { memo } from 'react';
import type { OverallState } from '@renderer/lib/types';

interface StateTabsProps {
  state: OverallState;
}

const svgBase = { width: 9, height: 9, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const STATE_ICONS: Record<OverallState, JSX.Element> = {
  upright:   <svg {...svgBase}><polyline points="20 6 9 17 4 12"/></svg>,
  slouching: <svg {...svgBase}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  fatigued:  <svg {...svgBase}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
};

const states: Array<{ id: OverallState; label: string }> = [
  { id: 'upright',   label: 'Upright'   },
  { id: 'slouching', label: 'Slouching' },
  { id: 'fatigued',  label: 'Fatigued'  },
];

export const StateTabs = memo(function StateTabs({ state }: StateTabsProps): JSX.Element {
  return (
    <div className="state-tabs" role="status" aria-label={`Current state: ${state}`}>
      {states.map((item) => (
        <div key={item.id} className={`state-tab ${item.id === state ? 'active' : ''}`}>
          <span style={{ marginRight: 4, display: 'inline-flex', verticalAlign: 'middle' }}>{STATE_ICONS[item.id]}</span>
          {item.label}
        </div>
      ))}
    </div>
  );
});
