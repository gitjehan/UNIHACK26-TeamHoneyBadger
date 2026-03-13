import { memo } from 'react';
import type { SystemsState, VisionBackend } from '@renderer/lib/types';

type Status = SystemsState[keyof SystemsState];

interface SystemsPanelProps {
  systems: SystemsState;
  poseBackend: VisionBackend;
  faceBackend: VisionBackend;
}

function dotClass(status: Status): string {
  if (status === 'active') return 'systems-dot dot-active';
  if (status === 'degraded') return 'systems-dot dot-degraded';
  return 'systems-dot dot-inactive';
}

function statusText(status: Status): string {
  if (status === 'active') return 'Online';
  if (status === 'degraded') return 'Degraded';
  return 'Offline';
}

function backendLabel(backend: VisionBackend): string {
  if (backend === 'human') return 'Human AI';
  if (backend === 'mediapipe') return 'MediaPipe AI';
  if (backend === 'unavailable') return 'Unavailable';
  return 'Initializing...';
}

interface SystemRowProps {
  label: string;
  status: Status;
  meta?: string;
  description: string;
}

function SystemRow({ label, status, meta, description }: SystemRowProps): JSX.Element {
  return (
    <div className="systems-row" title={description}>
      <div>
        <span>{label}</span>
        <div className="systems-meta">
          {meta ? `${meta} \u00B7 ` : ''}
          {statusText(status)}
        </div>
      </div>
      <span
        className={dotClass(status)}
        role="status"
        aria-label={`${label}: ${statusText(status)}`}
      />
    </div>
  );
}

export const SystemsPanel = memo(function SystemsPanel({
  systems,
  poseBackend,
  faceBackend,
}: SystemsPanelProps): JSX.Element {
  return (
    <div className="card" role="region" aria-label="System status">
      <h3>Systems</h3>
      <div className="systems-list" aria-live="polite">
        <SystemRow
          label="Pose Detection"
          status={systems.poseDetection}
          meta={backendLabel(poseBackend)}
          description="Tracks body posture via 33-point skeleton detection"
        />
        <SystemRow
          label="Face Mesh"
          status={systems.faceMesh}
          meta={backendLabel(faceBackend)}
          description="478-point face mesh for blink and fatigue tracking"
        />
        <SystemRow
          label="Affect Engine"
          status={systems.affectEngine}
          description="Emotion classification from facial expressions"
        />
        <SystemRow
          label="Ambient Control"
          status={systems.ambientCtrl}
          description="Adaptive lighting and audio based on your wellness score"
        />
      </div>
    </div>
  );
});
