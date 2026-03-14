import { memo, type RefObject, useEffect, useMemo, useState } from 'react';
import { MetricCard } from '@renderer/components/metrics/MetricCard';
import { OverallGauge } from '@renderer/components/metrics/OverallGauge';
import { AmbientPanel } from '@renderer/components/panels/AmbientPanel';
import { SystemsPanel } from '@renderer/components/panels/SystemsPanel';
import { BioPet } from '@renderer/components/pet/BioPet';
import { PomodoroTimer } from '@renderer/components/pomodoro/PomodoroTimer';
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

interface LayoutMode {
  compact: boolean;
  stacked: boolean;
  short: boolean;
}

function resolveLayoutMode(): LayoutMode {
  if (typeof window === 'undefined') {
    return { compact: false, stacked: false, short: false };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  return {
    compact: width < 1220 || height < 780,
    stacked: width < 980,
    short: height < 720,
  };
}

export const Dashboard = memo(function Dashboard({
  state,
  videoRef,
  timeline,
  visionBackend,
}: DashboardProps): JSX.Element {
  const { snapshot } = state;
  const initialLayout = resolveLayoutMode();
  const enginesInitializing = visionBackend.pose === 'starting' || visionBackend.face === 'starting';
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(initialLayout);
  const [webcamCollapsed, setWebcamCollapsed] = useState(
    () => initialLayout.compact || initialLayout.short,
  );
  const [insightsCollapsed, setInsightsCollapsed] = useState(() => initialLayout.compact);

  const blinkValue = useMemo(
    () => (snapshot.blink.warmedUp === false ? null : snapshot.blink.rate),
    [snapshot.blink.warmedUp, snapshot.blink.rate],
  );

  useEffect(() => {
    const onResize = () => setLayoutMode(resolveLayoutMode());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (layoutMode.compact) {
      setWebcamCollapsed(true);
      setInsightsCollapsed(true);
      return;
    }
    setInsightsCollapsed(false);
    if (layoutMode.short) {
      setWebcamCollapsed(true);
      return;
    }
    setWebcamCollapsed(false);
  }, [layoutMode.compact, layoutMode.short]);

  const dashboardClassName = [
    'dashboard-grid',
    layoutMode.compact ? 'dashboard-grid--compact' : '',
    layoutMode.stacked ? 'dashboard-grid--stacked' : '',
    layoutMode.short ? 'dashboard-grid--short' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={dashboardClassName}>
      {enginesInitializing && (
        <div className="init-banner dashboard-banner">
          <div className="init-spinner" />
          Initializing vision engines — metrics will appear shortly
        </div>
      )}

      {/* Metric pills — full-width horizontal row, first thing to scan */}
      <div className="metric-grid dashboard-metrics">
        <MetricCard label="Posture" value={snapshot.posture.score} unit="/100" kind="posture" />
        <MetricCard
          label="Blink Rate"
          value={blinkValue}
          unit="bpm"
          kind="blinkRate"
        />
        <MetricCard label="Focus" value={snapshot.focus.score} unit="/100" kind="focus" />
        <MetricCard label="Stress" value={snapshot.stress.score} unit="/100" kind="stress" />
      </div>

      <div className="dashboard-column dashboard-column--left">
        <PomodoroTimer postureScore={snapshot.posture.score} />
        <BioPet
          pet={state.pet}
          postureScore={snapshot.posture.score}
          focusScore={snapshot.focus.score}
          stressScore={snapshot.stress.score}
        />
      </div>

      <div
        className={`dashboard-column dashboard-column--center ${
          webcamCollapsed ? 'dashboard-column--center-collapsed' : ''
        }`}
      >
        <WebcamFeed
          videoRef={videoRef}
          landmarks={state.poseLandmarks}
          postureScore={snapshot.posture.score}
          collapsed={webcamCollapsed}
          onToggle={() => setWebcamCollapsed((current) => !current)}
        />
        <SessionTimeline data={timeline} expanded={webcamCollapsed || layoutMode.short} />
      </div>

      <div className="dashboard-column dashboard-column--right">
        <OverallGauge value={snapshot.overall.score} />
        <button
          type="button"
          className="dashboard-collapse-toggle"
          onClick={() => setInsightsCollapsed((current) => !current)}
          aria-expanded={!insightsCollapsed}
        >
          {insightsCollapsed ? 'Show system details' : 'Hide system details'}
        </button>
        {!insightsCollapsed && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
});
