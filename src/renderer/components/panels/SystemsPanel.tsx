import type { SystemsState } from '@renderer/lib/types';

interface SystemsPanelProps {
  systems: SystemsState;
}

function dotClass(status: SystemsState[keyof SystemsState]): string {
  if (status === 'active') return 'systems-dot dot-active';
  if (status === 'degraded') return 'systems-dot dot-degraded';
  return 'systems-dot dot-inactive';
}

export function SystemsPanel({ systems }: SystemsPanelProps): JSX.Element {
  return (
    <div className="card">
      <h3>Systems</h3>
      <div className="systems-list">
        <div className="systems-row">
          <span>Pose Detection</span>
          <span className={dotClass(systems.poseDetection)} />
        </div>
        <div className="systems-row">
          <span>Face Mesh</span>
          <span className={dotClass(systems.faceMesh)} />
        </div>
        <div className="systems-row">
          <span>Affect Engine</span>
          <span className={dotClass(systems.affectEngine)} />
        </div>
        <div className="systems-row">
          <span>Ambient Ctrl</span>
          <span className={dotClass(systems.ambientCtrl)} />
        </div>
      </div>
    </div>
  );
}
