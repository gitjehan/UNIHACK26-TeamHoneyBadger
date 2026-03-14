import { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Dashboard } from '@renderer/components/layout/Dashboard';
import { Header } from '@renderer/components/layout/Header';
import { WelcomeScreen } from '@renderer/components/onboarding/WelcomeScreen';
import { RecapOverlay } from '@renderer/components/recap/RecapOverlay';
import { useScores } from '@renderer/hooks/useScores';
import { useWebcam } from '@renderer/hooks/useWebcam';
import { ambientAudio } from '@renderer/lib/ambient-audio';
import type {
  LeaderboardEntry,
  PetState,
  SessionRecap,
  VisionBackend,
} from '@renderer/lib/types';
import { FaceEngine } from '@renderer/ml/face-engine';
import { PoseEngine } from '@renderer/ml/pose-engine';
import { scoreEngine } from '@renderer/ml/score-engine';

type FlowStage = 'welcome' | 'ready';

function sanitizePet(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null;
  return raw as PetState;
}

export default function App(): JSX.Element {
  const [stage, setStage] = useState<FlowStage>('welcome');
  const [nickname, setNickname] = useState('HoneyBadger');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [timeline, setTimeline] = useState<Array<{ timestamp: number; posture: number; focus: number; stress: number }>>([]);
  const [recap, setRecap] = useState<SessionRecap | null>(null);
  const [visionBackend, setVisionBackend] = useState<{ pose: VisionBackend; face: VisionBackend }>({
    pose: 'starting',
    face: 'starting',
  });

  const sessionIdRef = useRef(uuidv4());
  const brightnessRangeRef = useRef<[number, number]>([0.2, 1.0]);
  const warmthIntensityRef = useRef<number>(1.0);
  const poseEngineRef = useRef<PoseEngine | null>(null);
  const faceEngineRef = useRef<FaceEngine | null>(null);

  const enabled = stage !== 'welcome';
  const webcam = useWebcam(enabled);
  const state = useScores();

  const stateRef = useRef(state);
  stateRef.current = state;

  const sessionEntry = useMemo(
    () => ({
      nickname,
      sessionId: sessionIdRef.current,
      avgOverallScore: state.snapshot.overall.score,
      bestStreak: Math.round(scoreEngine.getSessionStats().bestStreakSeconds / 60),
      totalLockedInMinutes: Math.round(state.pet.totalLockedInMinutes),
      level: state.pet.stage,
      levelTitle: state.pet.stageName,
      timestamp: new Date().toISOString(),
    }),
    [nickname, state.pet.stage, state.pet.stageName, state.pet.totalLockedInMinutes, state.snapshot.overall.score],
  );

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      const [, storedPet, storedNick, storedBrightnessRange, storedWarmthIntensity] = await Promise.all([
        window.kinetic.storeGet('calibration'),
        window.kinetic.storeGet('pet'),
        window.kinetic.storeGet('nickname'),
        window.kinetic.storeGet('brightnessRange'),
        window.kinetic.storeGet('warmthIntensity'),
      ]);
      if (!mounted) return;
      const pet = sanitizePet(storedPet);
      if (pet) scoreEngine.setPetState(pet);
      if (typeof storedNick === 'string' && storedNick.trim()) setNickname(storedNick);
      if (Array.isArray(storedBrightnessRange) && storedBrightnessRange.length === 2) {
        brightnessRangeRef.current = storedBrightnessRange as [number, number];
      }
      if (typeof storedWarmthIntensity === 'number') {
        warmthIntensityRef.current = storedWarmthIntensity;
      }
    };
    bootstrap().catch((error) => console.warn('Bootstrap failed', error));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!webcam.ready) return;
    const sourceVideo = webcam.videoRef.current;
    if (!sourceVideo) return;
    if (poseEngineRef.current || faceEngineRef.current) return;

    const pose = new PoseEngine();
    const face = new FaceEngine();
    poseEngineRef.current = pose;
    faceEngineRef.current = face;

    pose.setCallbacks(
      (landmarks, fps) => {
        scoreEngine.updatePoseFps(fps);
        if (landmarks.length >= 25) {
          scoreEngine.updatePosture(landmarks);
        }
      },
      (status) => scoreEngine.setSystemStatus({ poseDetection: status }),
      (backend) =>
        setVisionBackend((current) =>
          current.pose === backend ? current : { ...current, pose: backend },
        ),
    );

    face.setCallbacks(
      (landmarks, emotionState, emotionConfidence, fps, aspectRatio) => {
        scoreEngine.updateFaceFps(fps);
        // Always feed face data through — the blink detector has its own
        // internal check for specific eye-landmark indices and returns
        // graceful fallback values when they're insufficient.
        if (landmarks.length > 0) {
          scoreEngine.updateFace(landmarks, emotionState, emotionConfidence, aspectRatio);
        }
        const hasFaceMesh = landmarks.length >= 200;
        scoreEngine.setSystemStatus({
          faceMesh: hasFaceMesh ? 'active' : landmarks.length > 0 ? 'degraded' : 'inactive',
          affectEngine: emotionState && emotionState !== 'neutral' ? 'active' : 'degraded',
        });
      },
      (status) => scoreEngine.setSystemStatus({ faceMesh: status, affectEngine: status }),
      (backend) =>
        setVisionBackend((current) =>
          current.face === backend ? current : { ...current, face: backend },
        ),
    );

    (async () => {
      try {
        await pose.init(sourceVideo);
      } catch (error) {
        console.warn('Pose engine init failed', error);
      }
      try {
        // Sequential: face reuses the same Human instance that pose already loaded
        await face.init(sourceVideo);
      } catch (error) {
        console.warn('Face engine init failed', error);
      }
    })();

    return () => {
      pose.stop();
      face.stop();
      poseEngineRef.current = null;
      faceEngineRef.current = null;
    };
  }, [webcam.ready, webcam.videoRef]);

  useEffect(() => {
    if (stage !== 'ready') return;

    const applyAmbient = () => {
      const { brightness, warmth } = stateRef.current.ambient;
      const [minB, maxB] = brightnessRangeRef.current;
      const adjustedBrightness = Math.min(maxB, Math.max(minB, brightness));
      const adjustedWarmth = Math.min(1, Math.max(0, warmth * warmthIntensityRef.current));
      window.kinetic.updateAmbient({ brightness: adjustedBrightness, warmth: adjustedWarmth });
    };

    scoreEngine.setAmbientStatus('active');
    applyAmbient();
    ambientAudio.update(stateRef.current.snapshot.overall.score, stateRef.current.snapshot.stress.score);

    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      // Ambient light every 1s (every tick)
      applyAmbient();
      // Audio + timeline every 2s (every other tick)
      if (tick % 2 === 0) {
        const latest = stateRef.current;
        ambientAudio.update(latest.snapshot.overall.score, latest.snapshot.stress.score);
        setTimeline(scoreEngine.getTimeline());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [stage]);

  useEffect(
    () => () => {
      ambientAudio.stop();
    },
    [],
  );

  useEffect(() => {
    if (stage !== 'ready') return;
    const interval = setInterval(() => {
      const s = stateRef.current;
      window.kinetic.sendBiometric({
        timestamp: new Date().toISOString(),
        sessionId: sessionIdRef.current,
        posture: s.snapshot.posture,
        blink: s.snapshot.blink,
        focus: s.snapshot.focus,
        stress: s.snapshot.stress,
        overall: s.snapshot.overall,
        ambient: {
          brightness: s.ambient.brightness,
          warmth: s.ambient.warmth,
          petState: s.pet.health,
        },
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [stage]);

  useEffect(() => {
    let mounted = true;
    const loadLeaderboard = async () => {
      const board = await window.kinetic.getLeaderboard();
      if (mounted) setLeaderboard(board);
    };
    loadLeaderboard().catch((error) => console.warn('Failed to load leaderboard', error));

    const refresh = setInterval(() => {
      loadLeaderboard().catch((error) => console.warn('Failed to refresh leaderboard', error));
    }, 20_000);
    return () => {
      mounted = false;
      clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    if (stage !== 'ready') return;
    const upsert = async () => {
      await window.kinetic.upsertLeaderboard(sessionEntry);
    };
    upsert().catch((error) => console.warn('Leaderboard upsert failed', error));
    const interval = setInterval(() => {
      upsert().catch((error) => console.warn('Leaderboard upsert failed', error));
    }, 60_000);
    return () => clearInterval(interval);
  }, [stage, sessionEntry]);

  const endSession = async () => {
    const sessionRecap = scoreEngine.endSession(sessionIdRef.current);
    if (leaderboard.length >= 3) {
      const below = leaderboard.filter((entry) => entry.avgOverallScore < sessionRecap.avgOverall).length;
      sessionRecap.percentileRank = Math.round((below / leaderboard.length) * 100);
    }
    setRecap(sessionRecap);

    const sessions = ((await window.kinetic.storeGet('sessions')) as Array<Record<string, unknown>>) ?? [];
    sessions.unshift({
      id: sessionRecap.sessionId,
      startTime: scoreEngine.getSessionStats().startTime,
      endTime: Date.now(),
      avgPosture: sessionRecap.avgPosture,
      avgFocus: sessionRecap.avgFocus,
      avgStress: sessionRecap.avgStress,
      avgOverall: sessionRecap.avgOverall,
      bestStreak: sessionRecap.bestStreak,
      totalMinutes: sessionRecap.durationMinutes,
    });
    await window.kinetic.storeSet('sessions', sessions.slice(0, 30));

    const recaps = ((await window.kinetic.storeGet('recaps')) as SessionRecap[]) ?? [];
    recaps.unshift(sessionRecap);
    await window.kinetic.storeSet('recaps', recaps.slice(0, 30));
    await window.kinetic.storeSet('pet', state.pet);

    await window.kinetic.upsertLeaderboard({
      ...sessionEntry,
      avgOverallScore: sessionRecap.avgOverall,
      bestStreak: sessionRecap.bestStreak,
      totalLockedInMinutes: Math.round(state.pet.totalLockedInMinutes),
      level: state.pet.stage,
      levelTitle: state.pet.stageName,
    });

    sessionIdRef.current = uuidv4();
    scoreEngine.startSession();
  };

  useEffect(() => {
    const s = stateRef.current;
    (window as Window & { __kineticDebug?: Record<string, unknown> }).__kineticDebug = {
      stage,
      posture: s.snapshot.posture.score,
      overall: s.snapshot.overall.score,
      petHealth: s.pet.health,
      timelinePoints: timeline.length,
      recapVisible: Boolean(recap),
      systems: s.systems,
      backend: visionBackend,
    };
  }, [stage, timeline.length, recap, visionBackend]);

  const startSession = () => {
    ambientAudio.ensureStarted().catch((error) => console.warn('Ambient audio start failed', error));
    scoreEngine.startSession();
    setStage('ready');
  };

  if (stage === 'welcome') return <WelcomeScreen onStart={startSession} />;

  return (
    <div className="app-shell">
      <Header state={state.snapshot.overall.state} onEndSession={() => void endSession()} />
      {webcam.error ? (
        <div className="onboarding">
          <div className="onboarding-card">
            <h2>Webcam access needed</h2>
            <p>{webcam.error}</p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: '8px 0 0' }}>
              Make sure your camera is connected and permissions are enabled in System Settings &gt; Privacy &amp; Security &gt; Camera.
            </p>
            <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        </div>
      ) : (
        <Dashboard
          state={state}
          videoRef={webcam.videoRef}
          timeline={timeline}
          visionBackend={visionBackend}
        />
      )}
      <RecapOverlay
        recap={recap}
        onClose={() => setRecap(null)}
      />
    </div>
  );
}
