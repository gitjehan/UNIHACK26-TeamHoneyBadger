import { LANDMARKS, POSTURE_WEIGHTS, SHOULDER_SLANT_MAX, SLOUCH_THRESHOLD } from '@renderer/lib/constants';
import { calculateAngle, clamp, cosineSimilarity } from '@renderer/lib/math';
import type { CalibrationData, Point, PostureData } from '@renderer/lib/types';

function isUsable(point: Point | undefined, minVisibility = 0.04): point is Point {
  if (!point) return false;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  return (point.visibility ?? 1) >= minVisibility;
}

function averageAvailable(points: Array<Point | undefined>, fallback: Point): Point {
  const valid = points.filter((point): point is Point => Boolean(point));
  if (!valid.length) return fallback;
  const sum = valid.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / valid.length, y: sum.y / valid.length };
}

function getShoulder(landmarks: Point[]): Point {
  const left = isUsable(landmarks[LANDMARKS.LEFT_SHOULDER]) ? landmarks[LANDMARKS.LEFT_SHOULDER] : undefined;
  const right = isUsable(landmarks[LANDMARKS.RIGHT_SHOULDER]) ? landmarks[LANDMARKS.RIGHT_SHOULDER] : undefined;
  return averageAvailable([left, right], { x: 0.5, y: 0.45 });
}

function getHead(landmarks: Point[], shoulder: Point): Point {
  const leftEar = isUsable(landmarks[LANDMARKS.LEFT_EAR], 0.01) ? landmarks[LANDMARKS.LEFT_EAR] : undefined;
  const rightEar = isUsable(landmarks[LANDMARKS.RIGHT_EAR], 0.01) ? landmarks[LANDMARKS.RIGHT_EAR] : undefined;
  const nose = isUsable(landmarks[LANDMARKS.NOSE], 0.01) ? landmarks[LANDMARKS.NOSE] : undefined;
  const earOnly = [leftEar, rightEar].filter((point): point is Point => Boolean(point));
  if (earOnly.length >= 2) {
    return averageAvailable(earOnly, { x: shoulder.x, y: Math.max(0, shoulder.y - 0.14) });
  }
  return averageAvailable([leftEar, rightEar, nose], { x: shoulder.x, y: Math.max(0, shoulder.y - 0.14) });
}

function getTorsoReferenceVector(head: Point, shoulder: Point, calibration: CalibrationData | null): [number, number] {
  if (calibration) {
    const [x, y] = calibration.uprightTrunkVector;
    if (Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x, y) > 0.01) {
      return [x, y];
    }
  }
  const inferred: [number, number] = [shoulder.x - head.x, shoulder.y - head.y];
  if (Math.hypot(inferred[0], inferred[1]) > 0.01) return inferred;
  return [0, 0.22];
}

export function calculatePostureMetrics(
  landmarks: Point[],
  calibration: CalibrationData | null,
): Omit<PostureData, 'score'> {
  const shoulder = getShoulder(landmarks);
  const head = getHead(landmarks, shoulder);
  const torsoReference = getTorsoReferenceVector(head, shoulder, calibration);
  const torsoAnchor = {
    x: shoulder.x + torsoReference[0],
    y: shoulder.y + torsoReference[1],
  };

  const rawNeckAngle = calculateAngle(head, shoulder, torsoAnchor);
  const neckAngle = Number.isFinite(rawNeckAngle) ? rawNeckAngle : 170;

  const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];
  const shouldersUsable = isUsable(leftShoulder) && isUsable(rightShoulder);

  const shoulderSlant = Math.abs(
    shouldersUsable
      ? Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x) * (180 / Math.PI)
      : 0,
  );

  const currentVec: [number, number] = [shoulder.x - head.x, shoulder.y - head.y];
  let trunkSimilarity = 1;
  if (calibration) {
    const angularSimilarity = cosineSimilarity(currentVec, torsoReference);
    const currentMagnitude = Math.hypot(currentVec[0], currentVec[1]);
    const baselineMagnitude = Math.max(
      0.0001,
      Math.hypot(torsoReference[0], torsoReference[1]),
    );
    const magnitudeRatio = clamp(currentMagnitude / baselineMagnitude, 0.6, 1.4);
    const magnitudeSimilarity = clamp(1 - Math.abs(1 - magnitudeRatio), 0, 1);
    trunkSimilarity = clamp(angularSimilarity * 0.75 + magnitudeSimilarity * 0.25, 0, 1);
  } else {
    trunkSimilarity = clamp(cosineSimilarity(currentVec, torsoReference), 0, 1);
  }

  return {
    neckAngle,
    shoulderSlant,
    trunkSimilarity,
    isSlumping:
      neckAngle < SLOUCH_THRESHOLD ||
      trunkSimilarity < 0.9 ||
      shoulderSlant > 7,
  };
}

export function calculatePostureScore(
  neckAngle: number,
  shoulderSlant: number,
  trunkSimilarity: number,
): number {
  const neckScore = clamp(((neckAngle - 140) / 40) * 100, 0, 100);
  const shoulderScore = clamp((1 - shoulderSlant / SHOULDER_SLANT_MAX) * 100, 0, 100);
  const trunkScore = clamp(((trunkSimilarity - 0.85) / 0.15) * 100, 0, 100);

  return Math.round(
    neckScore * POSTURE_WEIGHTS.neck +
      shoulderScore * POSTURE_WEIGHTS.shoulder +
      trunkScore * POSTURE_WEIGHTS.trunk,
  );
}

export function scorePosture(landmarks: Point[], calibration: CalibrationData | null): PostureData {
  const metrics = calculatePostureMetrics(landmarks, calibration);
  return {
    ...metrics,
    score: calculatePostureScore(metrics.neckAngle, metrics.shoulderSlant, metrics.trunkSimilarity),
  };
}
