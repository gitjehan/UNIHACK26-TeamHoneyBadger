import { describe, expect, it, beforeEach, vi } from 'vitest';
import { BlinkDetector, type BlinkFrame } from './blink-detector';
import { LEFT_EYE, RIGHT_EYE } from '@renderer/lib/constants';
import type { Point } from '@renderer/lib/types';

/**
 * Build a fake 468-landmark array with realistic eye geometry.
 *
 * @param leftOpenness  - 0 = fully closed, 1 = fully open (left eye)
 * @param rightOpenness - 0 = fully closed, 1 = fully open (right eye)
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
  const eyeWidth = 0.04 * hScale; // shrinks when head turns
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

/** Feed N identical frames of open eyes to prime the baseline. */
function primeBaseline(detector: BlinkDetector, n = 15): void {
  for (let i = 0; i < n; i++) {
    detector.update(buildLandmarks(1, 1), 17, 4 / 3);
  }
}

describe('BlinkDetector', () => {
  let detector: BlinkDetector;

  beforeEach(() => {
    detector = new BlinkDetector();
    vi.useFakeTimers();
  });

  // ─── Basic blink detection ────────────────────────────────────

  it('returns zero blinks when eyes stay open', () => {
    primeBaseline(detector);
    // 30 more frames of open eyes
    let frame: BlinkFrame = detector.update(buildLandmarks(1, 1), 17);
    for (let i = 0; i < 30; i++) {
      frame = detector.update(buildLandmarks(1, 1), 17);
    }
    expect(frame.rate).toBe(0);
  });

  it('detects a normal blink (close for 2 frames then reopen)', () => {
    primeBaseline(detector);

    // Close eyes for 2 frames
    detector.update(buildLandmarks(0, 0), 17);
    detector.update(buildLandmarks(0, 0), 17);
    // Re-open
    const frame = detector.update(buildLandmarks(1, 1), 17);

    expect(frame.rate).toBe(1);
  });

  it('detects a prolonged closure (> BLINK_MAX_FRAMES)', () => {
    primeBaseline(detector);

    // Close eyes for 6 frames (> max of 4)
    for (let i = 0; i < 6; i++) {
      detector.update(buildLandmarks(0, 0), 17);
    }
    // Re-open
    const frame = detector.update(buildLandmarks(1, 1), 17);

    expect(frame.prolongedClosures).toBe(1);
    // Should NOT count as a blink
    expect(frame.rate).toBe(0);
  });

  it('does not double-count a blink from both eyes', () => {
    primeBaseline(detector);

    // Both eyes close and reopen — should be 1 blink, not 2
    detector.update(buildLandmarks(0, 0), 17);
    detector.update(buildLandmarks(0, 0), 17);
    const frame = detector.update(buildLandmarks(1, 1), 17);

    expect(frame.rate).toBe(1);
  });

  // ─── Head turn / foreshortening robustness ────────────────────

  it('suppresses false blinks when head turns (foreshortened eye)', () => {
    primeBaseline(detector);

    // Simulate head turning: far eye shrinks to 40% of normal width.
    // The EAR of the foreshortened eye will drop, but it should NOT
    // be counted as a blink because the eye is unreliable.
    for (let i = 0; i < 10; i++) {
      // hScale=0.4 means eye width shrinks to 40%, well below FORESHORTEN_RATIO of 0.55
      detector.update(buildLandmarks(1, 1, 0.4), 17);
    }
    // Come back to frontal
    for (let i = 0; i < 10; i++) {
      detector.update(buildLandmarks(1, 1, 1), 17);
    }

    const frame = detector.update(buildLandmarks(1, 1, 1), 17);
    expect(frame.rate).toBe(0);
  });

  it('still detects real blinks after head returns to frontal', () => {
    primeBaseline(detector);

    // Turn head away and back
    for (let i = 0; i < 10; i++) {
      detector.update(buildLandmarks(1, 1, 0.4), 17);
    }
    // Stabilise back to frontal for enough frames to re-prime
    for (let i = 0; i < 15; i++) {
      detector.update(buildLandmarks(1, 1, 1), 17);
    }

    // Now do a real blink
    detector.update(buildLandmarks(0, 0), 17);
    detector.update(buildLandmarks(0, 0), 17);
    const frame = detector.update(buildLandmarks(1, 1), 17);

    expect(frame.rate).toBeGreaterThanOrEqual(1);
  });

  // ─── Jitter suppression ───────────────────────────────────────

  it('suppresses blinks during high-jitter EAR signal (head movement)', () => {
    primeBaseline(detector);

    // Simulate jittery EAR by rapidly alternating openness
    for (let i = 0; i < 20; i++) {
      const openness = i % 2 === 0 ? 1 : 0.5;
      detector.update(buildLandmarks(openness, openness), 17);
    }

    const frame = detector.update(buildLandmarks(1, 1), 17);
    // Jitter should have suppressed most/all false blinks
    expect(frame.rate).toBeLessThanOrEqual(1);
  });

  // ─── Baseline priming ────────────────────────────────────────

  it('does not detect blinks before baseline is primed', () => {
    // Feed only 3 frames (< MIN_BASELINE_SAMPLES = 8) then close eyes
    for (let i = 0; i < 3; i++) {
      detector.update(buildLandmarks(1, 1), 17);
    }
    detector.update(buildLandmarks(0, 0), 17);
    detector.update(buildLandmarks(0, 0), 17);
    const frame = detector.update(buildLandmarks(1, 1), 17);

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
    const frame = detector.update(buildLandmarks(1, 1), 17);
    expect(frame.fatigueScore).toBeGreaterThanOrEqual(0);
    expect(frame.fatigueScore).toBeLessThanOrEqual(100);
  });

  // ─── Stale closing state reset ────────────────────────────────

  it('resets closing state when eye becomes unreliable mid-blink', () => {
    primeBaseline(detector);

    // Start closing
    detector.update(buildLandmarks(0, 0), 17);

    // Head turns away mid-blink (eye becomes foreshortened/unreliable)
    for (let i = 0; i < 5; i++) {
      detector.update(buildLandmarks(1, 1, 0.3), 17);
    }

    // Head comes back and eyes are open — should NOT register a stale blink
    for (let i = 0; i < 15; i++) {
      detector.update(buildLandmarks(1, 1, 1), 17);
    }

    const frame = detector.update(buildLandmarks(1, 1, 1), 17);
    expect(frame.rate).toBe(0);
  });

  // ─── Multiple blinks over time ────────────────────────────────

  it('counts multiple blinks over time', () => {
    primeBaseline(detector);

    // Blink 1
    vi.advanceTimersByTime(1000);
    detector.update(buildLandmarks(0, 0), 17);
    detector.update(buildLandmarks(0, 0), 17);
    detector.update(buildLandmarks(1, 1), 17);

    // Stabilise
    for (let i = 0; i < 10; i++) {
      detector.update(buildLandmarks(1, 1), 17);
    }

    // Blink 2
    vi.advanceTimersByTime(2000);
    detector.update(buildLandmarks(0, 0), 17);
    detector.update(buildLandmarks(0, 0), 17);
    detector.update(buildLandmarks(1, 1), 17);

    // Stabilise
    for (let i = 0; i < 10; i++) {
      detector.update(buildLandmarks(1, 1), 17);
    }

    // Blink 3
    vi.advanceTimersByTime(2000);
    detector.update(buildLandmarks(0, 0), 17);
    detector.update(buildLandmarks(0, 0), 17);
    const frame = detector.update(buildLandmarks(1, 1), 17);

    expect(frame.rate).toBe(3);
  });
});
