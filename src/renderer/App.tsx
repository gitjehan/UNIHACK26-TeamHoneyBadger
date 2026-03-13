import { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Dashboard } from '@renderer/components/layout/Dashboard';
import { Header } from '@renderer/components/layout/Header';
import { CalibrationScreen } from '@renderer/components/onboarding/CalibrationScreen';
import { WelcomeScreen } from '@renderer/components/onboarding/WelcomeScreen';
import { RecapOverlay } from '@renderer/components/recap/RecapOverlay';
import { useScores } from '@renderer/hooks/useScores';
import { useWebcam } from '@renderer/hooks/useWebcam';
import { ambientAudio } from '@renderer/lib/ambient-audio';
import type {
  CalibrationData,
  LeaderboardEntry,
  PetState,
  SessionRecap,
  VisionBackend,
} from '@renderer/lib/types';
import { buildCalibration } from '@renderer/ml/calibration';
import { FaceEngine } from '@renderer/ml/face-engine';
import { PoseEngine } from '@renderer/ml/pose-engine';
import { scoreEngine } from '@renderer/ml/score-engine';

type FlowStage = 'welcome' | 'calibrating' | 'ready';

interface CalibrationSample {
  landmarks: import('@renderer/lib/types').Point[];
  neckAngle: number;
  shoulderSlant: number;
}

function sanitizePet(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null;
  return raw as PetState;
}

export default function App(): JSX.Element {
  const [stage, setStage] = useState<FlowStage>('welcome');
  const [secondsLeft, setSecondsLeft] = useState(3);
  const [nickname, setNickname] = useState('HoneyBadger');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [timeline, setTimeline] = useState<Array<{ timestamp: number; posture: number; focus: number; stress: number }>>([]);
  const [recap, setRecap] = useState<SessionRecap | null>(null);
  const [visionBackend, setVisionBackend] = useState<{ pose: VisionBackend; face: VisionBackend }>({
    pose: 'starting',
    face: 'starting',
  });

  const sessionIdRef = useRef(uuidv4());
  const calibrationSamplesRef = useRef<CalibrationSample[]>([]);
  const poseEngineRef = useRef<PoseEngine | null>(null);
  const faceEngineRef = useRef<FaceEngine | null>(null);
  const latestPoseLandmarksRef = useRef<import('@renderer/lib/types').Point[]>([]);
  const latestPostureMetricsRef = useRef<{ neckAngle: number; shoulderSlant: number }>({
    neckAngle: 175,
    shoulderSlant: 1,
  });

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
      const [storedCalibration, storedPet, storedNick] = await Promise.all([
        window.kinetic.storeGet('calibration'),
        window.kinetic.storeGet('pet'),
        window.kinetic.storeGet('nickname'),
      ]);
      if (!mounted) return;

      if (storedCalibration) {
        scoreEngine.setCalibration(storedCalibration as CalibrationData);
        scoreEngine.startSession();
        setStage('ready');
      }
      const pet = sanitizePet(storedPet);
      if (pet) scoreEngine.setPetState(pet);
      if (typeof storedNick === 'string' && storedNick.trim()) setNickname(storedNick);
    };
    bootstrap().catch((error) => console.warn('Bootstrap failed', error));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!webcam.ready) return;
    const sourceVideo = webcam.processingVideoRef.current ?? webcam.videoRef.current;
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
      (landmarks, emotionState, emotionConfidence, fps) => {
        scoreEngine.updateFaceFps(fps);
        // Human returns 478 mesh points (MediaPipe-compatible). We need index
        // 386 (RIGHT_EYE.top[0]) at minimum for blink detection → require 387.
        const hasFaceMesh = landmarks.length >= 387;
        if (hasFaceMesh) {
          scoreEngine.updateFace(landmarks, emotionState, emotionConfidence);
        }
        scoreEngine.setSystemStatus({
          faceMesh: hasFaceMesh ? 'active' : 'degraded',
          affectEngine: hasFaceMesh && emotionState ? 'active' : 'degraded',
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
  }, [webcam.ready, webcam.processingVideoRef, webcam.videoRef]);

  useEffect(() => {
    latestPoseLandmarksRef.current = state.poseLandmarks;
    latestPostureMetricsRef.current = {
      neckAngle: state.snapshot.posture.neckAngle,
      shoulderSlant: state.snapshot.posture.shoulderSlant,
    };
  }, [state.poseLandmarks, state.snapshot.posture.neckAngle, state.snapshot.posture.shoulderSlant]);

  useEffect(() => {
    if (stage === 'welcome') return;
    const timer = setInterval(() => {
      setTimeline(scoreEngine.getTimeline());
    }, 1000);
    return () => clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'ready') return;
    scoreEngine.setAmbientStatus('active');
    window.kinetic.updateAmbient(stateRef.current.ambient);
    const interval = setInterval(() => {
      window.kinetic.updateAmbient(stateRef.current.ambient);
    }, 1000);
    return () => clearInterval(interval);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'ready') return;
    const s = stateRef.current;
    ambientAudio.update(s.snapshot.overall.score, s.snapshot.stress.score);
    const interval = setInterval(() => {
      const latest = stateRef.current;
      ambientAudio.update(latest.snapshot.overall.score, latest.snapshot.stress.score);
    }, 2000);
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

  useEffect(() => {
    if (stage !== 'calibrating') return;
    if (!webcam.ready) {
      calibrationSamplesRef.current = [];
      setSecondsLeft(3);
      return;
    }
    calibrationSamplesRef.current = [];
    setSecondsLeft(3);

    const sampleInterval = setInterval(() => {
      const landmarks = latestPoseLandmarksRef.current;
      if (!landmarks.length) return;
      calibrationSamplesRef.current.push({
        landmarks,
        neckAngle: latestPostureMetricsRef.current.neckAngle,
        shoulderSlant: latestPostureMetricsRef.current.shoulderSlant,
      });
    }, 70);

    const countdown = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    const done = setTimeout(async () => {
      clearInterval(sampleInterval);
      clearInterval(countdown);
      const samples = calibrationSamplesRef.current;
      if (samples.length >= 8) {
        const calibration = buildCalibration(samples);
        scoreEngine.setCalibration(calibration);
        await window.kinetic.storeSet('calibration', calibration);
      } else {
        const fallback: CalibrationData = {
          uprightNeckAngle: latestPostureMetricsRef.current.neckAngle || 170,
          uprightShoulderSlant: latestPostureMetricsRef.current.shoulderSlant || 2,
          uprightTrunkVector: [0, 0.14],
          baselineBlinkRate: 17,
          baselineEAR: 0.27,
          timestamp: Date.now(),
        };
        scoreEngine.setCalibration(fallback);
        await window.kinetic.storeSet('calibration', fallback);
      }
      scoreEngine.startSession();
      setStage('ready');
    }, 3100);

    return () => {
      clearInterval(sampleInterval);
      clearInterval(countdown);
      clearTimeout(done);
    };
  }, [stage, webcam.ready]);

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

  const startCalibration = () => {
    ambientAudio.ensureStarted().catch((error) => console.warn('Ambient audio start failed', error));
    setStage('calibrating');
  };

  if (stage === 'welcome') return <WelcomeScreen onStart={startCalibration} />;
  if (stage === 'calibrating') {
    return (
      <CalibrationScreen
        secondsLeft={secondsLeft}
        collecting={webcam.ready}
        videoRef={webcam.videoRef}
        error={webcam.error}
      />
    );
  }

  return (
    <div className="app-shell">
      <Header state={state.snapshot.overall.state} onEndSession={() => void endSession()} />
      {webcam.error ? (
        <div className="onboarding">
          <div className="onboarding-card">
            <h2>Webcam access needed</h2>
            <p>{webcam.error}</p>
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
        onRecalibrate={() => {
          setRecap(null);
          void window.kinetic.storeSet('calibration', null);
          setStage('calibrating');
        }}
      />
    </div>
  );
}
