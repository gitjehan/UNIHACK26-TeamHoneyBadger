import {
  BLINK_MAX_FRAMES,
  BLINK_MIN_FRAMES,
  EAR_BLINK_THRESHOLD,
  EAR_NORMAL_RANGE,
  LEFT_EYE,
  RIGHT_EYE,
} from '@renderer/lib/constants';
import { clamp, euclideanDist } from '@renderer/lib/math';
import { RollingAverage } from '@renderer/lib/rolling-buffer';
import type { BlinkData, Point } from '@renderer/lib/types';

export interface BlinkFrame extends BlinkData {
  fatigueScore: number;
}

/** Highest eye landmark index used is RIGHT_EYE.top[0] = 386 → need >= 387. */
const MIN_EYE_LANDMARKS = 387;

const BLINK_WINDOW_MS = 60_000;
const CLOSURE_WINDOW_MS = 300_000;

/** Frames of open-eye data to collect before computing adaptive threshold. */
const EAR_CALIBRATION_FRAMES = 25;

/**
 * Adaptive threshold = this fraction of the observed open-eye EAR.
 * Accounts for non-uniform normalization (x/width, y/height) that inflates
 * EAR values beyond the standard 0.25–0.35 range.
 */
const ADAPTIVE_THRESHOLD_RATIO = 0.65;

function hasEyeLandmarks(landmarks: Point[]): boolean {
  if (landmarks.length < MIN_EYE_LANDMARKS) return false;
  const corners = [
    landmarks[LEFT_EYE.left],
    landmarks[LEFT_EYE.right],
    landmarks[RIGHT_EYE.left],
    landmarks[RIGHT_EYE.right],
  ];
  return corners.every(
    (pt) => pt && Number.isFinite(pt.x) && Number.isFinite(pt.y) && (pt.x !== 0 || pt.y !== 0),
  );
}

function eyeAspectRatio(landmarks: Point[], eye: typeof LEFT_EYE): number {
  const safeDist = (aIdx: number, bIdx: number): number => {
    const a = landmarks[aIdx];
    const b = landmarks[bIdx];
    if (!a || !b) return 0;
    return euclideanDist(a, b);
  };

  const verticalDists = eye.top.map((topIdx, index) =>
    safeDist(topIdx, eye.bottom[index]),
  );
  const avgVertical = verticalDists.reduce((acc, distance) => acc + distance, 0) / verticalDists.length;
  const horizontal = safeDist(eye.left, eye.right);
  if (!horizontal) return 0;
  return avgVertical / horizontal;
}

export class BlinkDetector {
  private blinkTimes: number[] = [];

  private closureTimes: number[] = [];

  private earBuffer = new RollingAverage(30);

  private closedFrames = 0;

  private lastLogTime = 0;

  private framesSinceLastData = 0;

  private hasReceivedData = false;

  private cachedBlinkRate = 0;

  private cachedClosureCount = 0;

  private lastCacheTime = 0;

  private earCalibrationSamples: number[] = [];

  private adaptiveThreshold: number | null = null;

  /** Observed typical open-eye EAR (set after adaptive calibration). */
  private baselineOpenEar = 0;

  update(faceLandmarks: Point[], baselineBlinkRate: number): BlinkFrame {
    if (!hasEyeLandmarks(faceLandmarks)) {
      this.framesSinceLastData += 1;
      return this.buildFallbackFrame(baselineBlinkRate);
    }

    this.hasReceivedData = true;
    this.framesSinceLastData = 0;

    const left = eyeAspectRatio(faceLandmarks, LEFT_EYE);
    const right = eyeAspectRatio(faceLandmarks, RIGHT_EYE);
    const ear = (left + right) / 2;

    const now = Date.now();
    const threshold = this.getThreshold(ear);

    if (now - this.lastLogTime > 5000) {
      this.lastLogTime = now;
      console.log(
        `[BlinkDetector] EAR: ${ear.toFixed(4)} | L: ${left.toFixed(4)} R: ${right.toFixed(4)}` +
        ` | thresh: ${threshold.toFixed(4)} (${this.adaptiveThreshold !== null ? 'adaptive' : 'static'})` +
        ` | closed: ${this.closedFrames} | blinks: ${this.cachedBlinkRate} bpm` +
        ` | landmarks: ${faceLandmarks.length}`,
      );
    }

    if (ear <= 0) {
      return this.buildFallbackFrame(baselineBlinkRate);
    }

    this.earBuffer.push(ear);

    if (ear < threshold) {
      this.closedFrames += 1;
    } else if (this.closedFrames > 0) {
      if (this.closedFrames >= BLINK_MIN_FRAMES && this.closedFrames <= BLINK_MAX_FRAMES) {
        this.blinkTimes.push(now);
      } else if (this.closedFrames > BLINK_MAX_FRAMES) {
        this.closureTimes.push(now);
      }
      this.closedFrames = 0;
    }

    return this.buildFrame(now, baselineBlinkRate);
  }

  /**
   * Returns the EAR threshold for blink detection. Uses an adaptive value
   * once enough open-eye samples have been collected, falling back to the
   * static constant during the initial calibration window.
   */
  private getThreshold(currentEar: number): number {
    if (this.adaptiveThreshold !== null) return this.adaptiveThreshold;

    if (currentEar > EAR_BLINK_THRESHOLD) {
      this.earCalibrationSamples.push(currentEar);
    }

    if (this.earCalibrationSamples.length >= EAR_CALIBRATION_FRAMES) {
      const sorted = [...this.earCalibrationSamples].sort((a, b) => a - b);
      const p60 = sorted[Math.floor(sorted.length * 0.6)];
      this.adaptiveThreshold = p60 * ADAPTIVE_THRESHOLD_RATIO;
      this.baselineOpenEar = p60;
      console.log(
        `[BlinkDetector] Adaptive threshold: ${this.adaptiveThreshold.toFixed(4)}` +
        ` (baseline open EAR: ${p60.toFixed(4)}, samples: ${sorted.length})`,
      );
    }

    return EAR_BLINK_THRESHOLD;
  }

  private buildFrame(now: number, baselineBlinkRate: number): BlinkFrame {
    if (now - this.lastCacheTime >= 500) {
      this.lastCacheTime = now;

      const blinkCutoff = now - BLINK_WINDOW_MS;
      const closureCutoff = now - CLOSURE_WINDOW_MS;

      this.pruneOlderThan(this.blinkTimes, blinkCutoff);
      this.pruneOlderThan(this.closureTimes, closureCutoff);

      this.cachedBlinkRate = this.blinkTimes.length;
      this.cachedClosureCount = this.closureTimes.length;
    }

    const fatigueScore = this.computeFatigue(
      this.cachedBlinkRate,
      baselineBlinkRate || 17,
      this.earBuffer.average,
      this.cachedClosureCount,
    );

    return {
      rate: this.cachedBlinkRate,
      avgEAR: this.earBuffer.average,
      prolongedClosures: this.cachedClosureCount,
      fatigueScore,
    };
  }

  private buildFallbackFrame(baselineBlinkRate: number): BlinkFrame {
    if (this.hasReceivedData && this.earBuffer.average > 0) {
      return this.buildFrame(Date.now(), baselineBlinkRate);
    }

    return {
      rate: baselineBlinkRate || 17,
      avgEAR: 0.27,
      prolongedClosures: 0,
      fatigueScore: 15,
    };
  }

  /**
   * Fatigue score using adaptive EAR ranges when calibrated. The face-engine
   * normalizes landmarks per-axis (x/width, y/height), which inflates EAR
   * well above the textbook 0.25–0.35 range. Adaptive ranges fix this.
   */
  private computeFatigue(
    currentBlinkRate: number,
    baselineBlinkRate: number,
    avgEAR: number,
    prolongedClosures: number,
  ): number {
    const safeBaseline = Math.max(1, baselineBlinkRate);
    const blinkDeviation = Math.abs(currentBlinkRate - safeBaseline) / safeBaseline;
    const blinkScore = clamp((1 - blinkDeviation) * 100, 0, 100);

    let alertEar: number;
    let drowsyEar: number;
    if (this.baselineOpenEar > 0) {
      alertEar = this.baselineOpenEar;
      drowsyEar = this.baselineOpenEar * 0.55;
    } else {
      alertEar = EAR_NORMAL_RANGE.alert;
      drowsyEar = EAR_NORMAL_RANGE.drowsy;
    }

    const earScore = clamp(
      ((avgEAR - drowsyEar) / Math.max(0.01, alertEar - drowsyEar)) * 100,
      0,
      100,
    );
    const closurePenalty = clamp(prolongedClosures * 15, 0, 50);
    return 100 - Math.round(
      Math.max(0, blinkScore * 0.4 + earScore * 0.4 + (100 - closurePenalty) * 0.2),
    );
  }

  private pruneOlderThan(arr: number[], cutoff: number): void {
    let pruneCount = 0;
    while (pruneCount < arr.length && arr[pruneCount] < cutoff) {
      pruneCount += 1;
    }
    if (pruneCount > 0) arr.splice(0, pruneCount);
  }
}

export function calculateFatigueScore(
  currentBlinkRate: number,
  baselineBlinkRate: number,
  avgEAR: number,
  prolongedClosures: number,
): number {
  const safeBaseline = Math.max(1, baselineBlinkRate);
  const blinkDeviation = Math.abs(currentBlinkRate - safeBaseline) / safeBaseline;
  const blinkScore = clamp((1 - blinkDeviation) * 100, 0, 100);
  const earScore = clamp(
    ((avgEAR - EAR_NORMAL_RANGE.drowsy) / (EAR_NORMAL_RANGE.alert - EAR_NORMAL_RANGE.drowsy)) * 100,
    0,
    100,
  );
  const closurePenalty = clamp(prolongedClosures * 15, 0, 50);
  return 100 - Math.round(Math.max(0, blinkScore * 0.4 + earScore * 0.4 + (100 - closurePenalty) * 0.2));
}
