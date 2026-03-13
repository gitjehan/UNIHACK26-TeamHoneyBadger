import {
  BLINK_MAX_FRAMES,
  BLINK_MIN_FRAMES,
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

const BLINK_WINDOW_MS = 60_000;
const CLOSURE_WINDOW_MS = 300_000;

/**
 * A blink starts when an eye's EAR drops to this fraction of its own rolling
 * open-eye baseline. Each eye has an independent baseline so head tilts don't
 * corrupt detection — the foreshortened far eye tracks its own (inflated) EAR
 * separately from the near eye.
 */
const DROP_RATIO = 0.65;

/**
 * A blink ends when EAR recovers to this fraction of the baseline.
 * Higher than DROP_RATIO to create hysteresis.
 */
const OPEN_RATIO = 0.80;

/**
 * After one eye registers a blink, ignore additional blink events for this
 * many ms. Prevents double-counting when both eyes close simultaneously
 * (a normal blink) and each eye's tracker fires in the same frame.
 */
const BLINK_COOLDOWN_MS = 250;

const LEFT_EYE_INDICES  = [LEFT_EYE.left,  LEFT_EYE.right,  ...LEFT_EYE.top,  ...LEFT_EYE.bottom];
const RIGHT_EYE_INDICES = [RIGHT_EYE.left, RIGHT_EYE.right, ...RIGHT_EYE.top, ...RIGHT_EYE.bottom];

function isEyeVisible(landmarks: Point[], indices: number[]): boolean {
  for (const idx of indices) {
    const pt = landmarks[idx];
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return false;
    if (pt.x === 0 && pt.y === 0) return false;
  }
  return true;
}

function hasEyeLandmarks(landmarks: Point[]): boolean {
  // Require at least one complete eye to be visible. When the face is turned
  // far to one side, the occluded eye's landmarks will be missing/zeroed —
  // we still want to detect blinks on the visible eye.
  return isEyeVisible(landmarks, LEFT_EYE_INDICES) || isEyeVisible(landmarks, RIGHT_EYE_INDICES);
}

function eyeAspectRatio(landmarks: Point[], eye: typeof LEFT_EYE, aspectRatio: number): number {
  // Eye openness is measured in the Y axis; eye width in the X axis.
  // Face-engine normalizes x by videoWidth and y by videoHeight separately,
  // so we must correct for aspect ratio before comparing vertical and
  // horizontal distances: multiply x-based distances by (width/height) so
  // both axes are in the same physical unit (height-normalised).
  const safeVertical = (aIdx: number, bIdx: number): number => {
    const a = landmarks[aIdx];
    const b = landmarks[bIdx];
    if (!a || !b) return 0;
    return euclideanDist(a, b);
  };

  const safeHorizontal = (aIdx: number, bIdx: number): number => {
    const a = landmarks[aIdx];
    const b = landmarks[bIdx];
    if (!a || !b) return 0;
    const dx = (a.x - b.x) * aspectRatio;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const verticalDists = eye.top.map((topIdx, index) =>
    safeVertical(topIdx, eye.bottom[index]),
  );
  const avgVertical = verticalDists.reduce((acc, d) => acc + d, 0) / verticalDists.length;
  const horizontal = safeHorizontal(eye.left, eye.right);
  if (!horizontal) return 0;
  return avgVertical / horizontal;
}

interface EyeState {
  openBuffer: RollingAverage;
  closing: boolean;
  closedFrames: number;
}

export class BlinkDetector {
  private blinkTimes: number[] = [];

  private closureTimes: number[] = [];

  /** All-frames EAR buffer — used for avgEAR reporting only. */
  private earBuffer = new RollingAverage(30);

  /**
   * Independent per-eye trackers. Each eye maintains its own open-eye baseline
   * so foreshortening from head tilts doesn't affect the other eye's detection.
   */
  private leftEye: EyeState = { openBuffer: new RollingAverage(20), closing: false, closedFrames: 0 };

  private rightEye: EyeState = { openBuffer: new RollingAverage(20), closing: false, closedFrames: 0 };

  private lastBlinkRegisteredMs = 0;

  private lastLogTime = 0;

  private framesSinceLastData = 0;

  private hasReceivedData = false;

  private cachedBlinkRate = 0;

  private cachedClosureCount = 0;

  private lastCacheTime = 0;

  /** Continuously updated open-eye baseline (average of both eyes, for fatigue scoring). */
  private baselineOpenEar = 0;

  update(faceLandmarks: Point[], baselineBlinkRate: number, aspectRatio = 4 / 3): BlinkFrame {
    if (!hasEyeLandmarks(faceLandmarks)) {
      this.framesSinceLastData += 1;
      return this.buildFallbackFrame(baselineBlinkRate);
    }

    this.hasReceivedData = true;
    this.framesSinceLastData = 0;

    const leftVisible  = isEyeVisible(faceLandmarks, LEFT_EYE_INDICES);
    const rightVisible = isEyeVisible(faceLandmarks, RIGHT_EYE_INDICES);

    const left  = leftVisible  ? eyeAspectRatio(faceLandmarks, LEFT_EYE,  aspectRatio) : 0;
    const right = rightVisible ? eyeAspectRatio(faceLandmarks, RIGHT_EYE, aspectRatio) : 0;

    // Use the average of whichever eyes are visible for the all-frames EAR buffer.
    const visibleCount = (leftVisible ? 1 : 0) + (rightVisible ? 1 : 0);
    const ear = visibleCount > 0 ? (left + right) / visibleCount : 0;

    if (ear <= 0) {
      return this.buildFallbackFrame(baselineBlinkRate);
    }

    this.earBuffer.push(ear);

    const now = Date.now();

    // Only run the state machine for eyes that are actually visible this frame.
    const leftResult  = leftVisible  ? this.processEye(this.leftEye,  left,  now) : { blink: false, closure: false };
    const rightResult = rightVisible ? this.processEye(this.rightEye, right, now) : { blink: false, closure: false };

    // Register at most one blink event per BLINK_COOLDOWN_MS window to prevent
    // double-counting when both eyes close in the same frame (a normal blink).
    if ((leftResult.blink || rightResult.blink) && now - this.lastBlinkRegisteredMs > BLINK_COOLDOWN_MS) {
      this.blinkTimes.push(now);
      this.lastBlinkRegisteredMs = now;
    }
    if ((leftResult.closure || rightResult.closure) && now - this.lastBlinkRegisteredMs > BLINK_COOLDOWN_MS) {
      this.closureTimes.push(now);
      this.lastBlinkRegisteredMs = now;
    }

    // Keep baselineOpenEar as the average of both eyes' open-eye baselines.
    const lb = this.leftEye.openBuffer.average;
    const rb = this.rightEye.openBuffer.average;
    if (lb > 0 && rb > 0) this.baselineOpenEar = (lb + rb) / 2;
    else if (lb > 0) this.baselineOpenEar = lb;
    else if (rb > 0) this.baselineOpenEar = rb;

    if (now - this.lastLogTime > 5000) {
      this.lastLogTime = now;
      const leftStr  = leftVisible  ? `L:${left.toFixed(4)}(base:${lb.toFixed(4)},closing:${this.leftEye.closing})` : 'L:hidden';
      const rightStr = rightVisible ? `R:${right.toFixed(4)}(base:${rb.toFixed(4)},closing:${this.rightEye.closing})` : 'R:hidden';
      console.log(
        `[BlinkDetector] ${leftStr} ${rightStr}` +
        ` | blinks/min:${this.cachedBlinkRate} | lm:${faceLandmarks.length}`,
      );
    }

    return this.buildFrame(now, baselineBlinkRate);
  }

  /**
   * Advances one eye's state machine for a single frame.
   * Returns flags indicating if a blink or prolonged closure just completed.
   */
  private processEye(
    eye: EyeState,
    ear: number,
    now: number,
  ): { blink: boolean; closure: boolean } {
    const baseline = eye.openBuffer.average;

    if (baseline > 0 && ear < baseline * DROP_RATIO) {
      // Eye is closing.
      eye.closing = true;
      eye.closedFrames += 1;
      return { blink: false, closure: false };
    }

    if (!eye.closing || ear >= baseline * OPEN_RATIO) {
      // Eye is open (or has recovered above hysteresis threshold).
      if (ear > 0) eye.openBuffer.push(ear);

      if (eye.closing) {
        // Transition: was closing, now open — classify the event.
        const frames = eye.closedFrames;
        eye.closing = false;
        eye.closedFrames = 0;
        if (frames >= BLINK_MIN_FRAMES && frames <= BLINK_MAX_FRAMES) {
          return { blink: true, closure: false };
        }
        if (frames > BLINK_MAX_FRAMES) {
          return { blink: false, closure: true };
        }
      }
    }

    return { blink: false, closure: false };
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

  private computeFatigue(
    currentBlinkRate: number,
    baselineBlinkRate: number,
    avgEAR: number,
    prolongedClosures: number,
  ): number {
    const safeBaseline = Math.max(1, baselineBlinkRate);
    const blinkDeviation = Math.abs(currentBlinkRate - safeBaseline) / safeBaseline;
    const blinkScore = clamp((1 - blinkDeviation) * 100, 0, 100);

    const alertEar = this.baselineOpenEar > 0 ? this.baselineOpenEar : EAR_NORMAL_RANGE.alert;
    const drowsyEar = this.baselineOpenEar > 0
      ? this.baselineOpenEar * 0.55
      : EAR_NORMAL_RANGE.drowsy;

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
