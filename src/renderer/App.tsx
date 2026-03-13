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
import { createSyntheticFace, createSyntheticPose } from '@renderer/lib/synthetic-signals';
import type { CalibrationData, LeaderboardEntry, PetState, SessionRecap } from '@renderer/lib/types';
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
  const autoMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autotest') === '1';

  const [stage, setStage] = useState<FlowStage>(autoMode ? 'ready' : 'welcome');
  const [secondsLeft, setSecondsLeft] = useState(3);
  const [nickname, setNickname] = useState('HoneyBadger');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [timeline, setTimeline] = useState<Array<{ timestamp: number; posture: number; focus: number; stress: number }>>([]);
  const [recap, setRecap] = useState<SessionRecap | null>(null);

  const sessionIdRef = useRef(uuidv4());
  const calibrationSamplesRef = useRef<CalibrationSample[]>([]);
  const poseEngineRef = useRef<PoseEngine | null>(null);
  const faceEngineRef = useRef<FaceEngine | null>(null);
  const latestPoseLandmarksRef = useRef<import('@renderer/lib/types').Point[]>([]);
  const latestPostureMetricsRef = useRef<{ neckAngle: number; shoulderSlant: number }>({
    neckAngle: 175,
    shoulderSlant: 1,
  });

  const enabled = !autoMode && stage !== 'welcome';
  const webcam = useWebcam(enabled);
  const state = useScores();

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
    if (autoMode) return;
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
  }, [autoMode]);

  useEffect(() => {
    if (autoMode) return;
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
        scoreEngine.updatePosture(landmarks);
      },
      (status) => scoreEngine.setSystemStatus({ poseDetection: status }),
    );

    face.setCallbacks(
      (landmarks, emotionState, emotionConfidence, fps) => {
        scoreEngine.updateFaceFps(fps);
        scoreEngine.updateFace(landmarks, emotionState, emotionConfidence);
        scoreEngine.setSystemStatus({
          faceMesh: landmarks.length ? 'active' : 'degraded',
          affectEngine: emotionState ? 'active' : 'degraded',
        });
      },
      (status) => scoreEngine.setSystemStatus({ faceMesh: status, affectEngine: status }),
    );

    pose.init(sourceVideo).catch((error) => console.warn('Pose engine init failed', error));
    face.init(sourceVideo).catch((error) => console.warn('Face engine init failed', error));

    return () => {
      pose.stop();
      face.stop();
      poseEngineRef.current = null;
      faceEngineRef.current = null;
    };
  }, [autoMode, webcam.ready, webcam.processingVideoRef, webcam.videoRef]);

  useEffect(() => {
    latestPoseLandmarksRef.current = state.poseLandmarks;
    latestPostureMetricsRef.current = {
      neckAngle: state.snapshot.posture.neckAngle,
      shoulderSlant: state.snapshot.posture.shoulderSlant,
    };
  }, [state.poseLandmarks, state.snapshot.posture.neckAngle, state.snapshot.posture.shoulderSlant]);

  useEffect(() => {
    if (!autoMode) return;

    const syntheticCalibration: CalibrationData = {
      uprightNeckAngle: 175,
      uprightShoulderSlant: 1,
      uprightTrunkVector: [0, 0.22],
      baselineBlinkRate: 17,
      baselineEAR: 0.27,
      timestamp: Date.now(),
    };

    scoreEngine.setCalibration(syntheticCalibration);
    scoreEngine.startSession();
    scoreEngine.setSystemStatus({
      poseDetection: 'active',
      faceMesh: 'active',
      affectEngine: 'active',
    });
    setStage('ready');

    let tick = 0;
    const interval = setInterval(() => {
      tick += 1;
      const slouchPhase = tick % 140 >= 70;
      const postureState = slouchPhase ? 'slouch' : 'upright';
      const pose = createSyntheticPose(postureState, tick);
      const face = createSyntheticFace(slouchPhase ? tick % 6 <= 4 : false);

      scoreEngine.updatePoseFps(15);
      scoreEngine.updatePosture(pose);
      scoreEngine.updateFaceFps(5);
      scoreEngine.updateFace(face, slouchPhase ? 'angry' : 'happy', slouchPhase ? 0.95 : 0.95);
    }, 120);

    return () => clearInterval(interval);
  }, [autoMode]);

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
    window.kinetic.updateAmbient(state.ambient);
  }, [stage, state.ambient]);

  useEffect(() => {
    if (stage !== 'ready') return;
    ambientAudio.update(state.snapshot.overall.score, state.snapshot.stress.score);
  }, [stage, state.snapshot.overall.score, state.snapshot.stress.score]);

  useEffect(
    () => () => {
      ambientAudio.stop();
    },
    [],
  );

  useEffect(() => {
    if (stage !== 'ready') return;
    const interval = setInterval(() => {
      window.kinetic.sendBiometric({
        timestamp: new Date().toISOString(),
        sessionId: sessionIdRef.current,
        posture: state.snapshot.posture,
        blink: state.snapshot.blink,
        focus: state.snapshot.focus,
        stress: state.snapshot.stress,
        overall: state.snapshot.overall,
        ambient: {
          brightness: state.ambient.brightness,
          warmth: state.ambient.warmth,
          petState: state.pet.health,
        },
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [stage, state]);

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
    if (autoMode) return;
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
          uprightTrunkVector: [0, 0.22],
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
  }, [autoMode, stage, webcam.ready]);

  const saveNickname = async () => {
    if (!nickname.trim()) return;
    await window.kinetic.storeSet('nickname', nickname.trim());
    setNickname(nickname.trim());
    await window.kinetic.upsertLeaderboard({ ...sessionEntry, nickname: nickname.trim() });
    const board = await window.kinetic.getLeaderboard();
    setLeaderboard(board);
  };

  const endSession = async () => {
    const sessionRecap = scoreEngine.endSession(sessionIdRef.current);
    if (leaderboard.length >= 3) {
      const below = leaderboard.filter((entry) => entry.avgOverallScore < sessionRecap.avgPosture).length;
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
    (window as Window & { __kineticDebug?: Record<string, unknown> }).__kineticDebug = {
      stage,
      posture: state.snapshot.posture.score,
      overall: state.snapshot.overall.score,
      petHealth: state.pet.health,
      timelinePoints: timeline.length,
      recapVisible: Boolean(recap),
      systems: state.systems,
    };
  }, [stage, state, timeline.length, recap]);

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
          nickname={nickname}
          leaderboard={leaderboard}
          onNicknameChange={setNickname}
          onSaveNickname={saveNickname}
        />
      )}
      <RecapOverlay recap={recap} onClose={() => setRecap(null)} />
    </div>
  );
}
