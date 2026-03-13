import { LANDMARKS, POSTURE_WEIGHTS, SHOULDER_SLANT_MAX, SLOUCH_THRESHOLD } from '@renderer/lib/constants';
import { calculateAngle, clamp, cosineSimilarity, euclideanDist } from '@renderer/lib/math';
import type { CalibrationData, Point, PostureData } from '@renderer/lib/types';

function averagePoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function getEar(landmarks: Point[]): Point {
  return averagePoint(landmarks[LANDMARKS.LEFT_EAR], landmarks[LANDMARKS.RIGHT_EAR]);
}

function getShoulder(landmarks: Point[]): Point {
  return averagePoint(landmarks[LANDMARKS.LEFT_SHOULDER], landmarks[LANDMARKS.RIGHT_SHOULDER]);
}

function getHip(landmarks: Point[]): Point {
  return averagePoint(landmarks[LANDMARKS.LEFT_HIP], landmarks[LANDMARKS.RIGHT_HIP]);
}

export function calculatePostureMetrics(
  landmarks: Point[],
  calibration: CalibrationData | null,
): Omit<PostureData, 'score'> {
  const ear = getEar(landmarks);
  const shoulder = getShoulder(landmarks);
  const hip = getHip(landmarks);

  const neckAngle = calculateAngle(ear, shoulder, hip);

  const shoulderSlant = Math.abs(
    Math.atan2(
      landmarks[LANDMARKS.RIGHT_SHOULDER].y - landmarks[LANDMARKS.LEFT_SHOULDER].y,
      landmarks[LANDMARKS.RIGHT_SHOULDER].x - landmarks[LANDMARKS.LEFT_SHOULDER].x,
    ) *
      (180 / Math.PI),
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
