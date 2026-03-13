import type { RefObject } from 'react';
import { MetricCard } from '@renderer/components/metrics/MetricCard';
import { OverallGauge } from '@renderer/components/metrics/OverallGauge';
import { AmbientPanel } from '@renderer/components/panels/AmbientPanel';
import { SystemsPanel } from '@renderer/components/panels/SystemsPanel';
import { BioPet } from '@renderer/components/pet/BioPet';
import { DigitalTwin } from '@renderer/components/visualisation/DigitalTwin';
import { SessionTimeline } from '@renderer/components/visualisation/SessionTimeline';
import { WebcamFeed } from '@renderer/components/visualisation/WebcamFeed';
import type { VisionBackend } from '@renderer/lib/types';
import type { EngineState } from '@renderer/ml/score-engine';

interface DashboardProps {
  state: EngineState;
  videoRef: RefObject<HTMLVideoElement | null>;
  timeline: Array<{ timestamp: number; posture: number; focus: number; stress: number }>;
  visionBackend: { pose: VisionBackend; face: VisionBackend };
}

export function Dashboard({
  state,
  videoRef,
  timeline,
  visionBackend,
}: DashboardProps): JSX.Element {
  const { snapshot } = state;

  return (
    <div className="dashboard-grid">
      <div className="column" style={{ gridTemplateRows: '1fr 1fr' }}>
        <DigitalTwin
          landmarks={state.poseLandmarks}
          postureScore={snapshot.posture.score}
          shoulderSlant={snapshot.posture.shoulderSlant}
        />
        <BioPet
          pet={state.pet}
          postureTilt={snapshot.posture.shoulderSlant}
          postureScore={snapshot.posture.score}
          focusScore={snapshot.focus.score}
          stressScore={snapshot.stress.score}
        />
      </div>

      <div className="column" style={{ gridTemplateRows: 'auto auto 1fr' }}>
        <div className="metric-grid">
          <MetricCard label="Posture" value={snapshot.posture.score} unit="/100" kind="posture" />
          <MetricCard label="Blink Rate" value={snapshot.blink.rate} unit="bpm" kind="blinkRate" />
          <MetricCard label="Focus" value={snapshot.focus.score} unit="/100" kind="focus" />
          <MetricCard label="Stress" value={snapshot.stress.score} unit="/100" kind="stress" />
        </div>
        <WebcamFeed
          videoRef={videoRef}
          landmarks={state.poseLandmarks}
          faceLandmarks={state.faceLandmarks}
          postureScore={snapshot.posture.score}
          neckAngle={snapshot.posture.neckAngle}
          shoulderSlant={snapshot.posture.shoulderSlant}
          emotionState={snapshot.stress.dominantEmotion}
          blinkRate={snapshot.blink.rate}
          avgEAR={snapshot.blink.avgEAR}
          poseFps={state.poseFps}
          faceFps={state.faceFps}
        />
        <SessionTimeline data={timeline} />
      </div>

      <div className="column" style={{ gridTemplateRows: 'auto auto auto' }}>
        <OverallGauge value={snapshot.overall.score} />
        <SystemsPanel
          systems={state.systems}
          poseBackend={visionBackend.pose}
          faceBackend={visionBackend.face}
        />
        <AmbientPanel
          brightness={state.ambient.brightness}
          warmth={state.ambient.warmth}
          overallScore={snapshot.overall.score}
        />
      </div>
    </div>
  );
}
