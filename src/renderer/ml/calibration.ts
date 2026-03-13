import { LANDMARKS } from '@renderer/lib/constants';
import type { CalibrationData, Point } from '@renderer/lib/types';

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildCalibration(
  samples: Array<{ landmarks: Point[]; neckAngle: number; shoulderSlant: number; ear?: number }>,
): CalibrationData {
  const neck = avg(samples.map((sample) => sample.neckAngle));
  const slant = avg(samples.map((sample) => sample.shoulderSlant));
  const baselineEAR = avg(samples.map((sample) => sample.ear ?? 0.27));

  const trunkVectors = samples.map((sample) => {
    const leftShoulder = sample.landmarks[LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = sample.landmarks[LANDMARKS.RIGHT_SHOULDER];
    const leftHip = sample.landmarks[LANDMARKS.LEFT_HIP];
    const rightHip = sample.landmarks[LANDMARKS.RIGHT_HIP];

    const midShoulder = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
    };
    const midHip = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
    };

    return [midHip.x - midShoulder.x, midHip.y - midShoulder.y] as [number, number];
  });

  const uprightTrunkVector: [number, number] = [
    avg(trunkVectors.map((vector) => vector[0])),
    avg(trunkVectors.map((vector) => vector[1])),
  ];

  return {
    uprightNeckAngle: neck,
    uprightShoulderSlant: slant,
    uprightTrunkVector,
    baselineBlinkRate: 17,
    baselineEAR: baselineEAR || 0.27,
    timestamp: Date.now(),
  };
}
