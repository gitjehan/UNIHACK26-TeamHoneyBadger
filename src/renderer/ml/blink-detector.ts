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

/** Minimum number of face-mesh points required for reliable EAR computation. */
const MIN_EYE_LANDMARKS = 387; // max index used is RIGHT_EYE.top[0] = 386

/** How far back (ms) to count blinks for the per-minute rate. */
const BLINK_WINDOW_MS = 60_000;

/** How far back (ms) to count prolonged closures. */
const CLOSURE_WINDOW_MS = 300_000;

function hasEyeLandmarks(landmarks: Point[]): boolean {
  if (landmarks.length < MIN_EYE_LANDMARKS) return false;
  // Spot-check the corner indices actually contain data
  const ll = landmarks[LEFT_EYE.left];
  const lr = landmarks[LEFT_EYE.right];
  const rl = landmarks[RIGHT_EYE.left];
  const rr = landmarks[RIGHT_EYE.right];
  return !!(ll && lr && rl && rr);
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
  /** Raw timestamps of recent blinks (ring buffer). */
  private blinkTimes: number[] = [];

  /** Raw timestamps of recent prolonged closures. */
  private closureTimes: number[] = [];

  private earBuffer = new RollingAverage(30);

  private closedFrames = 0;

  private lastLogTime = 0;

  private framesSinceLastData = 0;

  /** Track whether we've ever received valid EAR data */
  private hasReceivedData = false;

  /** Cached blink rate — recomputed at most every 500 ms. */
  private cachedBlinkRate = 0;

  private cachedClosureCount = 0;

  private lastCacheTime = 0;

  update(faceLandmarks: Point[], baselineBlinkRate: number): BlinkFrame {
    // Guard: verify we have the eye landmarks we need
    if (!hasEyeLandmarks(faceLandmarks)) {
      this.framesSinceLastData += 1;
      return this.buildFallbackFrame(baselineBlinkRate);
    }

    this.hasReceivedData = true;
    this.framesSinceLastData = 0;

    const left = eyeAspectRatio(faceLandmarks, LEFT_EYE);
    const right = eyeAspectRatio(faceLandmarks, RIGHT_EYE);
    const ear = (left + right) / 2;

    // Diagnostic logging every 5 seconds
    const now = Date.now();
    if (now - this.lastLogTime > 5000) {
      this.lastLogTime = now;
      console.log(
        `[BlinkDetector] EAR: ${ear.toFixed(4)} | L: ${left.toFixed(4)} R: ${right.toFixed(4)} | closed: ${this.closedFrames} | landmarks: ${faceLandmarks.length}`,
      );
    }

    // If EAR is exactly 0, the landmarks exist but have degenerate positions — skip
    if (ear <= 0) {
      return this.buildFallbackFrame(baselineBlinkRate);
    }

    this.earBuffer.push(ear);

    if (ear < EAR_BLINK_THRESHOLD) {
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

  /** Build a result frame from actual tracked data */
  private buildFrame(now: number, baselineBlinkRate: number): BlinkFrame {
    // Recompute window counts at most every 500 ms to avoid work on every frame
    if (now - this.lastCacheTime >= 500) {
      this.lastCacheTime = now;

      const blinkCutoff = now - BLINK_WINDOW_MS;
      const closureCutoff = now - CLOSURE_WINDOW_MS;

      // Prune old entries from the front (they're in chronological order)
      this.pruneOlderThan(this.blinkTimes, blinkCutoff);
      this.pruneOlderThan(this.closureTimes, closureCutoff);

      this.cachedBlinkRate = this.blinkTimes.length;
      this.cachedClosureCount = this.closureTimes.length;
    }

    const fatigueScore = calculateFatigueScore(
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

  /**
   * When face mesh data is unavailable or degenerate, return a sensible
   * fallback so downstream scores (fatigue, stress) don't zero out.
   */
  private buildFallbackFrame(baselineBlinkRate: number): BlinkFrame {
    // If we've previously accumulated real data, use what we have
    if (this.hasReceivedData && this.earBuffer.average > 0) {
      return this.buildFrame(Date.now(), baselineBlinkRate);
    }

    // Otherwise return a neutral baseline so scores stay reasonable
    return {
      rate: baselineBlinkRate || 17,
      avgEAR: 0.27,
      prolongedClosures: 0,
      fatigueScore: 15,
    };
  }

  /** Remove all entries older than cutoff from a sorted timestamp array. */
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
