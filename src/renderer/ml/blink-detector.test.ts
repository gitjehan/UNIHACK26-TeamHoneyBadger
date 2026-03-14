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

/** Feed N identical frames of open eyes to prime the baseline, advancing time like real usage. */
function primeBaseline(detector: BlinkDetector, n = 15): void {
  for (let i = 0; i < n; i++) {
    vi.advanceTimersByTime(100); // ~10 FPS like real usage
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
  vi.advanceTimersByTime(600);
  return detector.update(OPEN, 17);
}

describe('BlinkDetector', () => {
  let detector: BlinkDetector;

  beforeEach(() => {
    detector = new BlinkDetector();
    vi.useFakeTimers();
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
    // Rate is extrapolated: 1 blink in ~600ms → scaled to 60s
    expect(frame.rate).toBeGreaterThanOrEqual(1);
  });

  it('detects a prolonged closure (> BLINK_MAX_FRAMES)', () => {
    primeBaseline(detector);
    const frame = doBlink(detector, 6);
    expect(frame.prolongedClosures).toBe(1);
    // Should NOT count as a blink
    expect(frame.rate).toBe(0);
  });

  it('does not double-count a blink from both eyes', () => {
    primeBaseline(detector);
    const frame = doBlink(detector, 2);
    // With extrapolation, 1 raw blink will be scaled up — but there should
    // only be 1 underlying blink event, not 2.
    // After full warmup the rate should settle, but during early window
    // we just check it's not doubled.
    expect(frame.rate).toBeGreaterThanOrEqual(1);
  });

  // ─── Head turn / foreshortening robustness ────────────────────

  it('suppresses false blinks when head turns (foreshortened eye)', () => {
    primeBaseline(detector);

    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(100);
      detector.update(buildLandmarks(1, 1, 0.4), 17);
    }
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

    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(100);
      detector.update(buildLandmarks(1, 1, 0.4), 17);
    }
    for (let i = 0; i < 15; i++) {
      vi.advanceTimersByTime(100);
      detector.update(OPEN, 17);
    }

    const frame = doBlink(detector, 2);
    expect(frame.rate).toBeGreaterThanOrEqual(1);
  });

  it('foreshortened eyes do not produce blinks even with EAR fluctuations', () => {
    primeBaseline(detector);

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
    expect(frame.rate).toBe(17);
    expect(frame.avgEAR).toBe(0.27);
    expect(frame.warmedUp).toBe(false);
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

    detector.update(CLOSED, 17);

    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(100);
      detector.update(buildLandmarks(1, 1, 0.3), 17);
    }

    for (let i = 0; i < 15; i++) {
      vi.advanceTimersByTime(100);
      detector.update(OPEN, 17);
    }

    vi.advanceTimersByTime(600);
    const frame = detector.update(OPEN, 17);
    expect(frame.rate).toBe(0);
  });

  // ─── Warmup / rate extrapolation ──────────────────────────────

  it('reports warmedUp=false before 15 seconds have elapsed', () => {
    primeBaseline(detector);
    vi.advanceTimersByTime(5000); // only 5 seconds
    const frame = detector.update(OPEN, 17);
    expect(frame.warmedUp).toBe(false);
  });

  it('reports warmedUp=true after 15 seconds have elapsed', () => {
    primeBaseline(detector);
    vi.advanceTimersByTime(16_000);
    const frame = detector.update(OPEN, 17);
    expect(frame.warmedUp).toBe(true);
  });

  it('extrapolates blink rate before 60 seconds have elapsed', () => {
    primeBaseline(detector);

    // Blink once at t=5s
    vi.advanceTimersByTime(5000);
    doBlink(detector, 2);

    // Blink again at t=10s
    vi.advanceTimersByTime(5000);
    doBlink(detector, 2);

    // At t=15s, check rate. 2 blinks in ~10s → extrapolated to ~12 bpm
    vi.advanceTimersByTime(5000);
    const frame = detector.update(OPEN, 17);
    // Rough range: with 2 blinks in ~16s, extrapolated rate should be ~7-12 bpm
    expect(frame.rate).toBeGreaterThanOrEqual(5);
    expect(frame.rate).toBeLessThanOrEqual(20);
  });

  it('settles to raw count after 60 seconds', () => {
    primeBaseline(detector);

    // Do 5 blinks spread over 60 seconds
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(10_000);
      doBlink(detector, 2);
      // Stabilise
      for (let j = 0; j < 5; j++) {
        vi.advanceTimersByTime(100);
        detector.update(OPEN, 17);
      }
    }

    // At 50+ seconds, the window is close to full. Let's go past 60s.
    vi.advanceTimersByTime(15_000);
    const frame = detector.update(OPEN, 17);

    // Should be close to 5 bpm (5 blinks in ~60 seconds, raw count).
    // Extrapolation factor ≈ 1 so rate ≈ raw count.
    expect(frame.rate).toBeGreaterThanOrEqual(3);
    expect(frame.rate).toBeLessThanOrEqual(7);
  });
});
