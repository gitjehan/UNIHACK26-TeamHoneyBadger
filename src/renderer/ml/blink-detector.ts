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
  /** True once we have enough elapsed time for the blink rate to be meaningful. */
  warmedUp: boolean;
}
/**
 * Number of most recent blinks to use when computing the blink rate.
 * Using a count-based window makes the rate depend on actual observed
 * blinks rather than an arbitrary time slice.
 */
const BLINK_WINDOW_COUNT = 15;

/**
 * Minimum elapsed tracking time before we consider the blink rate reliable.
 * Before this, the rate is extrapolated but marked as not warmed up so
 * downstream consumers can treat it accordingly (e.g. show "calibrating…").
 */
const WARMUP_MS = 15_000;
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

/**
 * Minimum number of open-eye samples required before the state machine
 * starts detecting blinks. Prevents false blinks from an un-primed baseline.
 */
const MIN_BASELINE_SAMPLES = 8;

/**
 * When an eye's horizontal span drops below this fraction of its baseline
 * horizontal span, consider it too foreshortened to produce reliable EAR
 * values (head is turned away from the camera).
 */
const FORESHORTEN_RATIO = 0.55;

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
  return isEyeVisible(landmarks, LEFT_EYE_INDICES) || isEyeVisible(landmarks, RIGHT_EYE_INDICES);
}

/** Compute the horizontal span of an eye in aspect-ratio-corrected coordinates. */
function eyeHorizontalSpan(landmarks: Point[], eye: typeof LEFT_EYE, aspectRatio: number): number {
  const a = landmarks[eye.left];
  const b = landmarks[eye.right];
  if (!a || !b) return 0;
  const dx = (a.x - b.x) * aspectRatio;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function eyeAspectRatio(landmarks: Point[], eye: typeof LEFT_EYE, aspectRatio: number): number {
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
  /** Rolling baseline for the eye's horizontal span (used to detect foreshortening). */
  hSpanBuffer: RollingAverage;
  closing: boolean;
  closedFrames: number;
}

function makeEyeState(): EyeState {
  return {
    openBuffer: new RollingAverage(20),
    hSpanBuffer: new RollingAverage(20),
    closing: false,
    closedFrames: 0,
  };
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
  private leftEye: EyeState = makeEyeState();

  private rightEye: EyeState = makeEyeState();

  private lastBlinkRegisteredMs = 0;

  private lastLogTime = 0;

  private framesSinceLastData = 0;

  private hasReceivedData = false;

  private cachedBlinkRate = 0;

  private cachedClosureCount = 0;

  private lastCacheTime = 0;

  /** Timestamp of the first frame that actually processed eye data. */
  private firstFrameMs = 0;
  /** Continuously updated open-eye baseline (average of both eyes, for fatigue scoring). */
  private baselineOpenEar = 0;

  update(faceLandmarks: Point[], baselineBlinkRate: number, aspectRatio = 4 / 3): BlinkFrame {
    if (!hasEyeLandmarks(faceLandmarks)) {
      this.framesSinceLastData += 1;
      return this.buildFallbackFrame(baselineBlinkRate);
    }

    this.hasReceivedData = true;
    this.framesSinceLastData = 0;
    if (!this.firstFrameMs) this.firstFrameMs = Date.now();

    const leftVisible  = isEyeVisible(faceLandmarks, LEFT_EYE_INDICES);
    const rightVisible = isEyeVisible(faceLandmarks, RIGHT_EYE_INDICES);

    const leftEar  = leftVisible  ? eyeAspectRatio(faceLandmarks, LEFT_EYE,  aspectRatio) : 0;
    const rightEar = rightVisible ? eyeAspectRatio(faceLandmarks, RIGHT_EYE, aspectRatio) : 0;

    const leftHSpan  = leftVisible  ? eyeHorizontalSpan(faceLandmarks, LEFT_EYE,  aspectRatio) : 0;
    const rightHSpan = rightVisible ? eyeHorizontalSpan(faceLandmarks, RIGHT_EYE, aspectRatio) : 0;

    // --- Foreshortening gate ---
    // If an eye's horizontal span has shrunk significantly relative to its own
    // baseline, the landmarks are unreliable due to perspective distortion.
    const leftReliable  = leftVisible  && this.isEyeReliable(this.leftEye,  leftHSpan);
    const rightReliable = rightVisible && this.isEyeReliable(this.rightEye, rightHSpan);

    // Only update horizontal span baselines when the eye is reliable.
    // Foreshortened values would corrupt the baseline and weaken the gate.
    if (leftReliable  && leftHSpan  > 0) this.leftEye.hSpanBuffer.push(leftHSpan);
    if (rightReliable && rightHSpan > 0) this.rightEye.hSpanBuffer.push(rightHSpan);

    // If an eye became unreliable (head turned mid-blink), reset its closing
    // state to avoid registering a stale partial blink when it becomes visible again.
    // This MUST happen before the ear <= 0 early return below.
    if (!leftReliable  && this.leftEye.closing)  { this.leftEye.closing = false;  this.leftEye.closedFrames = 0; }
    if (!rightReliable && this.rightEye.closing) { this.rightEye.closing = false; this.rightEye.closedFrames = 0; }

    // Use the average of reliable eyes for the all-frames EAR buffer.
    const reliableCount = (leftReliable ? 1 : 0) + (rightReliable ? 1 : 0);
    const ear = reliableCount > 0
      ? ((leftReliable ? leftEar : 0) + (rightReliable ? rightEar : 0)) / reliableCount
      : 0;

    if (ear <= 0) {
      return this.buildFallbackFrame(baselineBlinkRate);
    }

    this.earBuffer.push(ear);

    const now = Date.now();

    // Only run the state machine for eyes that are reliable (not foreshortened).
    const leftResult  = leftReliable  ? this.processEye(this.leftEye,  leftEar,  now) : { blink: false, closure: false };
    const rightResult = rightReliable ? this.processEye(this.rightEye, rightEar, now) : { blink: false, closure: false };

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
      const leftStr  = leftVisible
        ? `L:${leftEar.toFixed(4)}(base:${lb.toFixed(4)},closing:${this.leftEye.closing},rel:${leftReliable})`
        : 'L:hidden';
      const rightStr = rightVisible
        ? `R:${rightEar.toFixed(4)}(base:${rb.toFixed(4)},closing:${this.rightEye.closing},rel:${rightReliable})`
        : 'R:hidden';
      console.log(
        `[BlinkDetector] ${leftStr} ${rightStr}` +
        ` | blinks/min:${this.cachedBlinkRate} | lm:${faceLandmarks.length}`,
      );
    }

    return this.buildFrame(now, baselineBlinkRate);
  }

  /**
   * Returns true if the eye's horizontal span is large enough relative to its
   * own baseline to be considered un-foreshortened. An eye turned away from the
   * camera will have a much narrower horizontal span.
   */
  private isEyeReliable(eye: EyeState, currentHSpan: number): boolean {
    const baselineHSpan = eye.hSpanBuffer.average;
    // Not enough data yet — allow it through so the baseline can build up.
    if (eye.hSpanBuffer.filledCount < 5 || baselineHSpan <= 0) return true;
    return currentHSpan >= baselineHSpan * FORESHORTEN_RATIO;
  }

  /**
   * Advances one eye's state machine for a single frame.
   * Returns flags indicating if a blink or prolonged closure just completed.
   */
  private processEye(
    eye: EyeState,
    ear: number,
    _now: number,
  ): { blink: boolean; closure: boolean } {
    const baseline = eye.openBuffer.average;

    // Don't run detection until we have a reliable baseline.
    if (eye.openBuffer.filledCount < MIN_BASELINE_SAMPLES) {
      if (ear > 0) eye.openBuffer.push(ear);
      return { blink: false, closure: false };
    }

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

      const closureCutoff = now - CLOSURE_WINDOW_MS;
      this.pruneOlderThan(this.closureTimes, closureCutoff);

      // Trim blinkTimes to avoid unbounded growth now that time-based pruning is removed.
      if (this.blinkTimes.length > BLINK_WINDOW_COUNT) {
        this.blinkTimes.splice(0, this.blinkTimes.length - BLINK_WINDOW_COUNT);
      }

      // Compute blink rate from the last N blinks (count-based window).
      const blinkCount = this.blinkTimes.length;
      if (blinkCount > 0) {
        const recent = this.blinkTimes.slice(-BLINK_WINDOW_COUNT);
        if (recent.length === 1) {
          // With only a single observed blink, fall back to the user's
          // baseline rate rather than deriving an unstable estimate from
          // a sub-second span.
          this.cachedBlinkRate = baselineBlinkRate || this.cachedBlinkRate || 0;
        } else {
          const first = recent[0]!;
          const last = recent[recent.length - 1]!;
          const windowMs = Math.max(1, last - first);
          // Require at least 1s of span to avoid huge rates from nearly-coincident timestamps.
          if (windowMs >= 1000) {
            this.cachedBlinkRate = Math.round((recent.length - 1) * (60_000 / windowMs));
          } else {
            this.cachedBlinkRate = 0;
          }
        }
      } else {
        this.cachedBlinkRate = 0;
      }
      this.cachedClosureCount = this.closureTimes.length;
      this.cachedClosureCount = this.closureTimes.length;
    }

    // Warmup is still based on elapsed tracking time: until 15s of activity
    // have passed, downstream consumers can treat the rate as less reliable.
    const warmedUp = this.firstFrameMs > 0 && (now - this.firstFrameMs) >= WARMUP_MS;

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
      warmedUp,
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
      warmedUp: false,
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
