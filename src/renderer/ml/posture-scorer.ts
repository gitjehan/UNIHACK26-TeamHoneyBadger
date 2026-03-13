import { LANDMARKS, POSTURE_WEIGHTS, SHOULDER_SLANT_MAX, SLOUCH_THRESHOLD } from '@renderer/lib/constants';
import { calculateAngle, clamp, cosineSimilarity, euclideanDist } from '@renderer/lib/math';
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

function getEar(landmarks: Point[], shoulder: Point): Point {
  const leftEar = isUsable(landmarks[LANDMARKS.LEFT_EAR], 0.01) ? landmarks[LANDMARKS.LEFT_EAR] : undefined;
  const rightEar = isUsable(landmarks[LANDMARKS.RIGHT_EAR], 0.01) ? landmarks[LANDMARKS.RIGHT_EAR] : undefined;
  const nose = isUsable(landmarks[LANDMARKS.NOSE], 0.01) ? landmarks[LANDMARKS.NOSE] : undefined;
  return averageAvailable([leftEar, rightEar, nose], shoulder);
}

function getHip(landmarks: Point[], shoulder: Point, calibration: CalibrationData | null): Point {
  const leftHip = isUsable(landmarks[LANDMARKS.LEFT_HIP], 0.01) ? landmarks[LANDMARKS.LEFT_HIP] : undefined;
  const rightHip = isUsable(landmarks[LANDMARKS.RIGHT_HIP], 0.01) ? landmarks[LANDMARKS.RIGHT_HIP] : undefined;
  const fromLandmarks = averageAvailable([leftHip, rightHip], { x: NaN, y: NaN });
  if (Number.isFinite(fromLandmarks.x) && Number.isFinite(fromLandmarks.y)) return fromLandmarks;

  if (calibration) {
    return {
      x: shoulder.x + calibration.uprightTrunkVector[0],
      y: shoulder.y + calibration.uprightTrunkVector[1],
    };
  }

  return {
    x: shoulder.x,
    y: Math.min(0.98, shoulder.y + 0.22),
  };
}

export function calculatePostureMetrics(
  landmarks: Point[],
  calibration: CalibrationData | null,
): Omit<PostureData, 'score'> {
  const shoulder = getShoulder(landmarks);
  const ear = getEar(landmarks, shoulder);
  const hip = getHip(landmarks, shoulder, calibration);

  const rawNeckAngle = calculateAngle(ear, shoulder, hip);
  const neckAngle = Number.isFinite(rawNeckAngle) ? rawNeckAngle : 170;

  const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];
  const shouldersUsable = isUsable(leftShoulder) && isUsable(rightShoulder);

  const shoulderSlant = Math.abs(
    shouldersUsable
      ? Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x) * (180 / Math.PI)
      : 0,
  );

  const currentVec: [number, number] = [hip.x - shoulder.x, hip.y - shoulder.y];
  let trunkSimilarity = 1;
  if (calibration) {
    const angularSimilarity = cosineSimilarity(currentVec, calibration.uprightTrunkVector);
    const currentMagnitude = euclideanDist(shoulder, hip);
    const baselineMagnitude = Math.max(
      0.0001,
      Math.sqrt(
        calibration.uprightTrunkVector[0] ** 2 + calibration.uprightTrunkVector[1] ** 2,
      ),
    );
    const magnitudeRatio = clamp(currentMagnitude / baselineMagnitude, 0.7, 1.2);
    trunkSimilarity = clamp(angularSimilarity * magnitudeRatio, 0, 1);
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
