import {
  AMBIENT_MAP,
  FOCUS_WEIGHTS,
  OVERALL_WEIGHTS,
  PET_EVOLUTION,
  STATE_THRESHOLDS,
} from '@renderer/lib/constants';
import { clamp, lerp } from '@renderer/lib/math';
import { RollingAverage, RollingBuffer } from '@renderer/lib/rolling-buffer';
import type {
  AmbientTarget,
  CalibrationData,
  PetHealthState,
  PetState,
  Point,
  ScoreSnapshot,
  SessionRecap,
  SystemsState,
} from '@renderer/lib/types';
import { BlinkDetector } from './blink-detector';
import { scorePosture } from './posture-scorer';
import { calculateStressScore } from './stress-estimator';

type Listener = (state: EngineState) => void;

export interface EngineState {
  snapshot: ScoreSnapshot;
  systems: SystemsState;
  pet: PetState;
  ambient: AmbientTarget;
  fatigueScore: number;
  poseLandmarks: Point[];
  faceLandmarks: Point[];
  poseFps: number;
  faceFps: number;
}

export interface SessionStats {
  startTime: number;
  durationSeconds: number;
  bestStreakSeconds: number;
  totalUprightSeconds: number;
}

const DEFAULT_SYSTEMS: SystemsState = {
  poseDetection: 'inactive',
  faceMesh: 'inactive',
  affectEngine: 'inactive',
  ambientCtrl: 'inactive',
};

function initialPetState(): PetState {
  return {
    stage: 0,
    stageName: 'Egg',
    health: 'Thriving',
    totalLockedInMinutes: 0,
    eggCrackProgress: 0,
    accessories: [],
    lastEvolutionCheck: Date.now(),
    sickSince: null,
  };
}

function initialSnapshot(): ScoreSnapshot {
  return {
    timestamp: Date.now(),
    posture: {
      score: 80,
      neckAngle: 175,
      shoulderSlant: 1,
      trunkSimilarity: 0.98,
      isSlumping: false,
    },
    blink: {
      rate: 17,
      avgEAR: 0.27,
      prolongedClosures: 0,
    },
    focus: { score: 78 },
    stress: { score: 18, dominantEmotion: 'neutral', emotionConfidence: 0.5 },
    overall: { score: 82, state: 'upright' },
  };
}

class ScoreEngine {
  private listeners = new Set<Listener>();

  private calibration: CalibrationData | null = null;

  private systems: SystemsState = { ...DEFAULT_SYSTEMS };

  private snapshot: ScoreSnapshot = initialSnapshot();

  private lastEmitTime = 0;

  private emitScheduled = false;

  private emitTimer: ReturnType<typeof setTimeout> | null = null;

  private fatigueScore = 15;

  private blinkDetector = new BlinkDetector();

  private postureSmoothing = new RollingAverage(60);

  private postureVariance = new RollingAverage(60);

  private timeline = new RollingBuffer<{ timestamp: number; posture: number; focus: number; stress: number }>(300);

  private poseLandmarks: Point[] = [];

  private faceLandmarks: Point[] = [];

  private poseFps = 0;

  private faceFps = 0;

  private emotionState = 'neutral';

  private emotionConfidence = 0.5;

  private pet: PetState = initialPetState();

  private sessionStartedAt = Date.now();

  private lastTick = Date.now();

  private bestStreakSeconds = 0;

  private currentStreakSeconds = 0;

  private streakGraceSeconds = 0;

  private totalUprightSeconds = 0;

  private sessionScoreCount = 0;

  private postureSum = 0;

  private focusSum = 0;

  private stressSum = 0;

  private overallSum = 0;

  private blinkRateSum = 0;

  private previousPetStage = 0;

  private sessionNewAccessories = new Set<string>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  get state(): EngineState {
    return {
      snapshot: this.snapshot,
      systems: this.systems,
      pet: this.pet,
      ambient: this.getAmbientTarget(),
      fatigueScore: this.fatigueScore,
      poseLandmarks: this.poseLandmarks,
      faceLandmarks: this.faceLandmarks,
      poseFps: this.poseFps,
      faceFps: this.faceFps,
    };
  }

  getCalibration(): CalibrationData | null {
    return this.calibration;
  }

  setCalibration(calibration: CalibrationData): void {
    this.calibration = calibration;
  }

  setPetState(pet: PetState): void {
    this.pet = pet;
    this.previousPetStage = pet.stage;
    this.emit();
  }

  getTimeline(): Array<{ timestamp: number; posture: number; focus: number; stress: number }> {
    return this.timeline.items;
  }

  getSessionStats(): SessionStats {
    return {
      startTime: this.sessionStartedAt,
      durationSeconds: Math.max(1, Math.floor((Date.now() - this.sessionStartedAt) / 1000)),
      bestStreakSeconds: this.bestStreakSeconds,
      totalUprightSeconds: this.totalUprightSeconds,
    };
  }

  startSession(): void {
    this.sessionStartedAt = Date.now();
    this.lastTick = Date.now();
    this.bestStreakSeconds = 0;
    this.currentStreakSeconds = 0;
    this.streakGraceSeconds = 0;
    this.totalUprightSeconds = 0;
    this.sessionScoreCount = 0;
    this.postureSum = 0;
    this.focusSum = 0;
    this.stressSum = 0;
    this.overallSum = 0;
    this.blinkRateSum = 0;
    this.previousPetStage = this.pet.stage;
    this.sessionNewAccessories.clear();
    this.timeline.clear();
    this.emit();
  }

  endSession(sessionId: string): SessionRecap {
    const durationSeconds = Math.max(1, Math.floor((Date.now() - this.sessionStartedAt) / 1000));
    const durationMinutes = Math.round((durationSeconds / 60) * 10) / 10;
    const divisor = Math.max(1, this.sessionScoreCount);

    if (durationMinutes >= 30 && this.overallSum / divisor >= 60) this.unlockAccessory('scarf');
    if (this.bestStreakSeconds >= 45 * 60) this.unlockAccessory('glasses');
    if (this.pet.stage >= 3) this.unlockAccessory('cape');
    if (this.pet.stage >= 4) this.unlockAccessory('wings');
    if (this.pet.stage >= 5) this.unlockAccessory('halo');

    return {
      sessionId,
      date: new Date().toLocaleDateString(),
      durationMinutes,
      avgPosture: Math.round(this.postureSum / divisor),
      avgFocus: Math.round(this.focusSum / divisor),
      avgStress: Math.round(this.stressSum / divisor),
      avgOverall: Math.round(this.overallSum / divisor),
      bestStreak: Math.round(this.bestStreakSeconds / 60),
      totalUprightMinutes: Math.round(this.totalUprightSeconds / 60),
      avgBlinkRate: Math.round(this.blinkRateSum / divisor),
      percentileRank: null,
      petLevel: this.pet.stage,
      petTitle: this.pet.stageName,
      newAccessories: [...this.sessionNewAccessories],
      evolved: this.pet.stage > this.previousPetStage,
      previousLevel: this.pet.stage > this.previousPetStage ? this.previousPetStage : null,
    };
  }

  setSystemStatus(partial: Partial<SystemsState>): void {
    let changed = false;
    for (const key of Object.keys(partial) as (keyof SystemsState)[]) {
      if (this.systems[key] !== partial[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.systems = { ...this.systems, ...partial };
    this.emit();
  }

  setAmbientStatus(status: SystemsState['ambientCtrl']): void {
    if (this.systems.ambientCtrl === status) return;
    this.systems = { ...this.systems, ambientCtrl: status };
    this.emit();
  }

  updatePoseFps(fps: number): void {
    this.poseFps = fps;
  }

  updateFaceFps(fps: number): void {
    this.faceFps = fps;
  }

  updatePosture(landmarks: Point[]): void {
    this.poseLandmarks = landmarks;
    const posture = scorePosture(landmarks, this.calibration);
    this.postureSmoothing.push(posture.score);
    const slouchPenalty = posture.isSlumping ? 15 : 0;
    const smoothedPosture = clamp(
      Math.round((this.postureSmoothing.average ?? posture.score) - slouchPenalty),
      0,
      100,
    );
    const adjustedPosture = { ...posture, score: smoothedPosture };
    this.postureVariance.push(smoothedPosture);
    this.recompute(adjustedPosture);
  }

  updateFace(landmarks: Point[], emotionState: string, emotionConfidence: number): void {
    this.faceLandmarks = landmarks;
    this.emotionState = emotionState || 'neutral';
    this.emotionConfidence = emotionConfidence || 0.5;

    const blinkFrame = this.blinkDetector.update(landmarks, this.calibration?.baselineBlinkRate ?? 17);
    this.snapshot = { ...this.snapshot, blink: blinkFrame };
    this.fatigueScore = blinkFrame.fatigueScore;
    this.recompute(this.snapshot.posture, blinkFrame);
  }

  private recompute(
    posture = this.snapshot.posture,
    blink = this.snapshot.blink,
  ): void {
    const baselineBlink = this.calibration?.baselineBlinkRate ?? 17;
    const blinkRateDeviation = Math.abs(blink.rate - baselineBlink) / Math.max(1, baselineBlink);
    const postureVariance = this.postureVariance.deviation;

    const stressScore = calculateStressScore(
      this.emotionState,
      this.emotionConfidence,
      postureVariance,
      blinkRateDeviation,
    );

    const postureStability = clamp(100 - postureVariance * 4, 0, 100);
    const focusScore = Math.round(
      posture.score * FOCUS_WEIGHTS.posture +
        (100 - this.fatigueScore) * FOCUS_WEIGHTS.inverseFatigue +
        (100 - stressScore) * FOCUS_WEIGHTS.inverseStress +
        postureStability * FOCUS_WEIGHTS.stability,
    );

    const overall = Math.round(
      posture.score * OVERALL_WEIGHTS.posture +
        focusScore * OVERALL_WEIGHTS.focus +
        (100 - stressScore) * OVERALL_WEIGHTS.inverseStress,
    );

    const state =
      overall >= STATE_THRESHOLDS.upright
        ? 'upright'
        : overall >= STATE_THRESHOLDS.slouching
          ? 'slouching'
          : 'fatigued';

    this.snapshot = {
      timestamp: Date.now(),
      posture,
      blink,
      focus: { score: focusScore },
      stress: {
        score: stressScore,
        dominantEmotion: this.emotionState,
        emotionConfidence: this.emotionConfidence,
      },
      overall: { score: overall, state },
    };

    this.timeline.push({
      timestamp: this.snapshot.timestamp,
      posture: this.snapshot.posture.score,
      focus: this.snapshot.focus.score,
      stress: this.snapshot.stress.score,
    });

    this.updateSessionStats();
    this.updatePetState();
    this.emit();
  }

  private updateSessionStats(): void {
    const now = Date.now();
    const deltaSeconds = Math.max(0, (now - this.lastTick) / 1000);
    this.lastTick = now;

    this.sessionScoreCount += 1;
    this.postureSum += this.snapshot.posture.score;
    this.focusSum += this.snapshot.focus.score;
    this.stressSum += this.snapshot.stress.score;
    this.overallSum += this.snapshot.overall.score;
    this.blinkRateSum += this.snapshot.blink.rate;

    if (this.snapshot.overall.score >= STATE_THRESHOLDS.upright) {
      this.totalUprightSeconds += deltaSeconds;
      this.currentStreakSeconds += deltaSeconds;
      this.streakGraceSeconds = 30;
      this.pet.totalLockedInMinutes += deltaSeconds / 60;
    } else if (this.streakGraceSeconds > 0) {
      this.streakGraceSeconds -= deltaSeconds;
    } else {
      this.currentStreakSeconds = 0;
    }

    this.bestStreakSeconds = Math.max(this.bestStreakSeconds, this.currentStreakSeconds);
  }

  private updatePetState(): void {
    const health: PetHealthState =
      this.snapshot.overall.score >= 65
        ? 'Thriving'
        : this.snapshot.overall.score >= 30
          ? 'Fading'
          : 'Wilting';

    if (health === 'Wilting' && !this.pet.sickSince) this.pet.sickSince = Date.now();
    if (health !== 'Wilting') this.pet.sickSince = null;
    this.pet.health = health;

    this.pet.eggCrackProgress = clamp((this.pet.totalLockedInMinutes / 10) * 100, 0, 100);

    const stage = [...PET_EVOLUTION]
      .reverse()
      .find((candidate) => this.pet.totalLockedInMinutes >= candidate.minMinutes);

    if (stage && stage.stage > this.pet.stage) {
      this.pet.stage = stage.stage;
      this.pet.stageName = stage.title;
      if (stage.stage >= 3) this.unlockAccessory('cape');
      if (stage.stage >= 4) this.unlockAccessory('wings');
      if (stage.stage >= 5) this.unlockAccessory('halo');
    }

    this.pet.lastEvolutionCheck = Date.now();
  }

  private unlockAccessory(accessory: string): void {
    if (!this.pet.accessories.includes(accessory)) {
      this.pet.accessories.push(accessory);
      this.sessionNewAccessories.add(accessory);
    }
  }

  private getAmbientTarget(): AmbientTarget {
    const overall = this.snapshot.overall.score;
    const bucket = AMBIENT_MAP.find(
      (range) => overall >= range.scoreMin && overall <= range.scoreMax,
    ) ?? AMBIENT_MAP[AMBIENT_MAP.length - 1];
    const span = Math.max(1, bucket.scoreMax - bucket.scoreMin);
    const t = clamp((overall - bucket.scoreMin) / span, 0, 1);
    let brightness = lerp(bucket.brightness[0], bucket.brightness[1], t);
    const warmth = lerp(bucket.warmth[0], bucket.warmth[1], 1 - t);
    brightness = clamp(brightness - (this.fatigueScore / 100) * 0.2, 0.2, 1);
    return {
      brightness: Math.round(brightness * 100) / 100,
      warmth: Math.round(warmth * 100) / 100,
    };
  }

  private emit(): void {
    const now = Date.now();
    const elapsed = now - this.lastEmitTime;

    if (elapsed < 250) {
      if (!this.emitScheduled) {
        this.emitScheduled = true;
        this.emitTimer = setTimeout(() => {
          this.emitScheduled = false;
          this.emitTimer = null;
          this.lastEmitTime = Date.now();
          const current = this.state;
          this.listeners.forEach((listener) => listener(current));
        }, 250 - elapsed);
      }
      return;
    }

    if (this.emitTimer) {
      clearTimeout(this.emitTimer);
      this.emitTimer = null;
      this.emitScheduled = false;
    }

    this.lastEmitTime = now;
    const current = this.state;
    this.listeners.forEach((listener) => listener(current));
  }
}

export const scoreEngine = new ScoreEngine();
