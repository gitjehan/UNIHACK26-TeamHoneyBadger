import type { SystemsState, VisionBackend } from '@renderer/lib/types';

interface SystemsPanelProps {
  systems: SystemsState;
  poseBackend: VisionBackend;
  faceBackend: VisionBackend;
}

function dotClass(status: SystemsState[keyof SystemsState]): string {
  if (status === 'active') return 'systems-dot dot-active';
  if (status === 'degraded') return 'systems-dot dot-degraded';
  return 'systems-dot dot-inactive';
}

function backendLabel(backend: VisionBackend): string {
  if (backend === 'human') return 'Human AI';
  if (backend === 'mediapipe') return 'MediaPipe AI';
  if (backend === 'synthetic') return 'Simulated fallback';
  return 'Initializing';
}

export function SystemsPanel({ systems, poseBackend, faceBackend }: SystemsPanelProps): JSX.Element {
  return (
    <div className="card">
      <h3>Systems</h3>
      <div className="systems-list">
        <div className="systems-row">
          <div>
            <span>Pose Detection</span>
            <div className="systems-meta">{backendLabel(poseBackend)}</div>
          </div>
          <span className={dotClass(systems.poseDetection)} />
        </div>
        <div className="systems-row">
          <div>
            <span>Face Mesh</span>
            <div className="systems-meta">{backendLabel(faceBackend)}</div>
          </div>
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
