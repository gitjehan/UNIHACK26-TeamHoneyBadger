import { describe, expect, it } from 'vitest';
import { LANDMARKS } from '@renderer/lib/constants';
import type { CalibrationData, Point } from '@renderer/lib/types';
import { calculatePostureScore, scorePosture } from './posture-scorer';

function createLandmarks(): Point[] {
  const points = new Array(33).fill(0).map(() => ({ x: 0.5, y: 0.5, visibility: 1 }));
  points[LANDMARKS.LEFT_EAR] = { x: 0.46, y: 0.3, visibility: 1 };
  points[LANDMARKS.RIGHT_EAR] = { x: 0.54, y: 0.3, visibility: 1 };
  points[LANDMARKS.LEFT_SHOULDER] = { x: 0.44, y: 0.42, visibility: 1 };
  points[LANDMARKS.RIGHT_SHOULDER] = { x: 0.56, y: 0.42, visibility: 1 };
  points[LANDMARKS.LEFT_HIP] = { x: 0.46, y: 0.64, visibility: 1 };
  points[LANDMARKS.RIGHT_HIP] = { x: 0.54, y: 0.64, visibility: 1 };
  return points;
}

describe('posture scorer', () => {
  const calibration: CalibrationData = {
    uprightNeckAngle: 175,
    uprightShoulderSlant: 1,
    uprightTrunkVector: [0, 0.14],
    baselineBlinkRate: 17,
    baselineEAR: 0.27,
    timestamp: Date.now(),
  };

  it('computes high score for upright landmarks', () => {
    const score = scorePosture(createLandmarks(), calibration);
    expect(score.score).toBeGreaterThan(70);
  });

  it('stays stable when hip landmarks are missing', () => {
    const points = createLandmarks();
    points[LANDMARKS.LEFT_HIP] = { x: 0.46, y: 0.64, visibility: 0 };
    points[LANDMARKS.RIGHT_HIP] = { x: 0.54, y: 0.64, visibility: 0 };
    const score = scorePosture(points, calibration);
    expect(score.score).toBeGreaterThan(65);
  });

  it('composite score scales correctly', () => {
    const high = calculatePostureScore(176, 1, 0.98);
    const low = calculatePostureScore(142, 9, 0.85);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(70);
    expect(low).toBeLessThan(40);
  });
});
