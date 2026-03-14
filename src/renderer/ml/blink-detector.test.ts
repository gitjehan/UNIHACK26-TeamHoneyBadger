import { describe, expect, it, beforeEach, vi } from 'vitest';
import { BlinkDetector, type BlinkFrame } from './blink-detector';
import { LEFT_EYE, RIGHT_EYE } from '@renderer/lib/constants';
import type { Point } from '@renderer/lib/types';

/**
 * Build a fake 468-landmark array with realistic eye geometry.
 *
 * @param leftOpenness  - 0.1 = nearly closed, 1 = fully open (left eye)
 * @param rightOpenness - 0.1 = nearly closed, 1 = fully open (right eye)
 * @param hScale        - horizontal compression factor (1 = frontal, <1 = turned away)
 */
function buildLandmarks(
  leftOpenness = 1,
  rightOpenness = 1,
  hScale = 1,
): Point[] {
  const lm: Point[] = new Array(468).fill(null).map(() => ({ x: 0.5, y: 0.5 }));

  // Left eye — centred at (0.35, 0.4)
  const lCx = 0.35;
  const lCy = 0.4;
  const eyeWidth = 0.04 * hScale;
  const eyeHeight = 0.015;

  lm[LEFT_EYE.left]  = { x: lCx - eyeWidth, y: lCy };
  lm[LEFT_EYE.right] = { x: lCx + eyeWidth, y: lCy };
  LEFT_EYE.top.forEach((idx, i) => {
    lm[idx] = { x: lCx + (i - 1) * eyeWidth * 0.3, y: lCy - eyeHeight * leftOpenness };
  });
  LEFT_EYE.bottom.forEach((idx, i) => {
    lm[idx] = { x: lCx + (i - 1) * eyeWidth * 0.3, y: lCy + eyeHeight * leftOpenness };
  });

  // Right eye — centred at (0.65, 0.4)
  const rCx = 0.65;
  const rCy = 0.4;
  lm[RIGHT_EYE.left]  = { x: rCx - eyeWidth, y: rCy };
  lm[RIGHT_EYE.right] = { x: rCx + eyeWidth, y: rCy };
  RIGHT_EYE.top.forEach((idx, i) => {
    lm[idx] = { x: rCx + (i - 1) * eyeWidth * 0.3, y: rCy - eyeHeight * rightOpenness };
  });
  RIGHT_EYE.bottom.forEach((idx, i) => {
    lm[idx] = { x: rCx + (i - 1) * eyeWidth * 0.3, y: rCy + eyeHeight * rightOpenness };
  });

  return lm;
}

const OPEN = buildLandmarks(1, 1);
const CLOSED = buildLandmarks(0.1, 0.1);

/** Feed N identical frames of open eyes to prime the baseline. */
function primeBaseline(detector: BlinkDetector, n = 15): void {
  for (let i = 0; i < n; i++) {
    detector.update(OPEN, 17, 4 / 3);
  }
}

/**
 * Perform a blink: close for `closeFrames` then reopen.
 * Advances fake timers so the cache refreshes.
 */
function doBlink(detector: BlinkDetector, closeFrames = 2): BlinkFrame {
  for (let i = 0; i < closeFrames; i++) {
    detector.update(CLOSED, 17);
  }
  // Advance time so the 500ms cache window refreshes before we read the result.
  vi.advanceTimersByTime(600);
  return detector.update(OPEN, 17);
}

describe('BlinkDetector', () => {
  let detector: BlinkDetector;

  beforeEach(() => {
    detector = new BlinkDetector();
    vi.useFakeTimers();
    // Start at a reasonable timestamp
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  // ─── Basic blink detection ────────────────────────────────────

  it('returns zero blinks when eyes stay open', () => {
    primeBaseline(detector);
    vi.advanceTimersByTime(600);
    let frame: BlinkFrame = detector.update(OPEN, 17);
    for (let i = 0; i < 30; i++) {
      frame = detector.update(OPEN, 17);
    }
    expect(frame.rate).toBe(0);
  });

  it('detects a normal blink (close for 2 frames then reopen)', () => {
    primeBaseline(detector);
    const frame = doBlink(detector, 2);
    expect(frame.rate).toBe(1);
  });

  it('detects a prolonged closure (> BLINK_MAX_FRAMES)', () => {
    primeBaseline(detector);
    // Close eyes for 6 frames (> max of 4)
    const frame = doBlink(detector, 6);
    expect(frame.prolongedClosures).toBe(1);
    // Should NOT count as a blink
    expect(frame.rate).toBe(0);
  });

  it('does not double-count a blink from both eyes', () => {
    primeBaseline(detector);
    // Both eyes close and reopen — should be 1 blink, not 2
    const frame = doBlink(detector, 2);
    expect(frame.rate).toBe(1);
  });

  // ─── Head turn / foreshortening robustness ────────────────────

  it('suppresses false blinks when head turns (foreshortened eye)', () => {
    primeBaseline(detector);

    // Simulate head turning: far eye shrinks to 40% of normal width.
    // EAR of the foreshortened eye will drop, but should NOT be a blink.
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(100);
      detector.update(buildLandmarks(1, 1, 0.4), 17);
    }
    // Come back to frontal
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(100);
      detector.update(OPEN, 17);
    }

    vi.advanceTimersByTime(600);
    const frame = detector.update(OPEN, 17);
    expect(frame.rate).toBe(0);
  });

  it('still detects real blinks after head returns to frontal', () => {
    primeBaseline(detector);

    // Turn head away and back
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(100);
      detector.update(buildLandmarks(1, 1, 0.4), 17);
    }
    // Stabilise back to frontal
    for (let i = 0; i < 15; i++) {
      vi.advanceTimersByTime(100);
      detector.update(OPEN, 17);
    }

    // Now do a real blink
    const frame = doBlink(detector, 2);
    expect(frame.rate).toBeGreaterThanOrEqual(1);
  });

  // ─── Jitter suppression ───────────────────────────────────────

  it('foreshortened eyes do not produce blinks even with EAR fluctuations', () => {
    primeBaseline(detector);

    // When the head turns, the foreshortened eye produces fluctuating EAR.
    // The foreshortening gate should suppress these regardless.
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(100);
      detector.update(buildLandmarks(1, 1, 0.3), 17);
    }

    vi.advanceTimersByTime(600);
    const frame = detector.update(OPEN, 17);
    expect(frame.rate).toBe(0);
  });

  // ─── Baseline priming ────────────────────────────────────────

  it('does not detect blinks before baseline is primed', () => {
    // Feed only 3 frames (< MIN_BASELINE_SAMPLES = 8) then close eyes
    for (let i = 0; i < 3; i++) {
      detector.update(OPEN, 17);
    }
    vi.advanceTimersByTime(600);
    detector.update(CLOSED, 17);
    detector.update(CLOSED, 17);
    const frame = detector.update(OPEN, 17);

    expect(frame.rate).toBe(0);
  });

  // ─── Fallback behaviour ──────────────────────────────────────

  it('returns fallback frame when no landmarks are visible', () => {
    const emptyLandmarks: Point[] = new Array(468).fill(null).map(() => ({ x: 0, y: 0 }));
    const frame = detector.update(emptyLandmarks, 17);
    expect(frame.rate).toBe(17); // baseline default
    expect(frame.avgEAR).toBe(0.27);
  });

  // ─── Fatigue scoring ─────────────────────────────────────────

  it('produces a fatigue score between 0 and 100', () => {
    primeBaseline(detector);
    vi.advanceTimersByTime(600);
    const frame = detector.update(OPEN, 17);
    expect(frame.fatigueScore).toBeGreaterThanOrEqual(0);
    expect(frame.fatigueScore).toBeLessThanOrEqual(100);
  });

  // ─── Stale closing state reset ────────────────────────────────

  it('resets closing state when eye becomes unreliable mid-blink', () => {
    primeBaseline(detector);

    // Start closing
    detector.update(CLOSED, 17);

    // Head turns away mid-blink (eye becomes foreshortened/unreliable)
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(100);
      detector.update(buildLandmarks(1, 1, 0.3), 17);
    }

    // Head comes back and eyes are open — should NOT register a stale blink
    for (let i = 0; i < 15; i++) {
      vi.advanceTimersByTime(100);
      detector.update(OPEN, 17);
    }

    vi.advanceTimersByTime(600);
    const frame = detector.update(OPEN, 17);
    expect(frame.rate).toBe(0);
  });

  // ─── Multiple blinks over time ────────────────────────────────

  it('counts multiple blinks over time', () => {
    primeBaseline(detector);

    // Blink 1
    vi.advanceTimersByTime(1000);
    doBlink(detector, 2);

    // Stabilise
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(100);
      detector.update(OPEN, 17);
    }

    // Blink 2
    vi.advanceTimersByTime(2000);
    doBlink(detector, 2);

    // Stabilise
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(100);
      detector.update(OPEN, 17);
    }

    // Blink 3
    vi.advanceTimersByTime(2000);
    const frame = doBlink(detector, 2);

    expect(frame.rate).toBe(3);
  });
});
