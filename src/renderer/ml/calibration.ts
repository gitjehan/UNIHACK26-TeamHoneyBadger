import { LANDMARKS } from '@renderer/lib/constants';
import type { CalibrationData, Point } from '@renderer/lib/types';

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function validPoint(point: Point | undefined): point is Point {
  if (!point) return false;
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function averagePoint(points: Point[], fallback: Point): Point {
  if (!points.length) return fallback;
  const total = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: total.x / points.length, y: total.y / points.length };
}

export function buildCalibration(
  samples: Array<{ landmarks: Point[]; neckAngle: number; shoulderSlant: number; ear?: number }>,
): CalibrationData {
  const rawNeck = avg(samples.map((sample) => sample.neckAngle));
  const rawSlant = avg(samples.map((sample) => sample.shoulderSlant));
  const baselineEAR = avg(samples.map((sample) => sample.ear ?? 0.27));

  const trunkVectors = samples.map((sample) => {
    const leftShoulder = validPoint(sample.landmarks[LANDMARKS.LEFT_SHOULDER])
      ? sample.landmarks[LANDMARKS.LEFT_SHOULDER]
      : { x: 0.45, y: 0.45 };
    const rightShoulder = validPoint(sample.landmarks[LANDMARKS.RIGHT_SHOULDER])
      ? sample.landmarks[LANDMARKS.RIGHT_SHOULDER]
      : { x: 0.55, y: 0.45 };

    const midShoulder = averagePoint([leftShoulder, rightShoulder], { x: 0.5, y: 0.45 });

    const headCandidates = [
      sample.landmarks[LANDMARKS.LEFT_EAR],
      sample.landmarks[LANDMARKS.RIGHT_EAR],
      sample.landmarks[LANDMARKS.NOSE],
    ].filter(validPoint);

    const head = averagePoint(headCandidates, { x: midShoulder.x, y: Math.max(0, midShoulder.y - 0.14) });
    return [midShoulder.x - head.x, midShoulder.y - head.y] as [number, number];
  });

  let uprightTrunkVector: [number, number] = [
    avg(trunkVectors.map((vector) => vector[0])),
    avg(trunkVectors.map((vector) => vector[1])),
  ];

  // Sanity checks: if user calibrated while slouching, clamp to reasonable defaults
  const neck = rawNeck < 150
    ? (console.warn(`Calibration: neck angle ${rawNeck.toFixed(1)}° too low, clamping to 170°`), 170)
    : rawNeck;

  const slant = rawSlant > 8
    ? (console.warn(`Calibration: shoulder slant ${rawSlant.toFixed(1)}° too high, clamping to 2°`), 2)
    : rawSlant;

  const trunkMag = Math.hypot(uprightTrunkVector[0], uprightTrunkVector[1]);
  if (trunkMag < 0.03) {
    console.warn(`Calibration: trunk vector magnitude ${trunkMag.toFixed(4)} too small, using default`);
    uprightTrunkVector = [0, 0.15];
  }

  // The trunk Y component should be positive (shoulder below head in normalized coords)
  if (uprightTrunkVector[1] < 0) {
    console.warn('Calibration: trunk vector Y is negative (head below shoulders?), flipping');
    uprightTrunkVector[1] = Math.abs(uprightTrunkVector[1]);
  }

  return {
    uprightNeckAngle: neck,
    uprightShoulderSlant: slant,
    uprightTrunkVector,
    baselineBlinkRate: 17,
    baselineEAR: baselineEAR || 0.27,
    timestamp: Date.now(),
  };
}
