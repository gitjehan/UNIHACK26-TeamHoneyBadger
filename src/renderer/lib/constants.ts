import type { PetHealthState } from './types';

export const POSTURE_WEIGHTS = { neck: 0.45, shoulder: 0.2, trunk: 0.35 };
export const NECK_ANGLE_RANGE = { perfect: 180, terrible: 140 };
export const SHOULDER_SLANT_MAX = 10;
export const TRUNK_SIMILARITY_RANGE = { perfect: 1, terrible: 0.85 };
export const SLOUCH_THRESHOLD = 150;

export const EAR_BLINK_THRESHOLD = 0.2;
export const BLINK_MIN_FRAMES = 1;
export const BLINK_MAX_FRAMES = 4;
export const NORMAL_BLINK_RATE = { min: 15, max: 20 };
export const EAR_NORMAL_RANGE = { drowsy: 0.18, alert: 0.33 };

export const EMOTION_STRESS_MAP: Record<string, number> = {
  angry: 85,
  fearful: 80,
  sad: 70,
  disgusted: 65,
  surprised: 40,
  neutral: 15,
  happy: 10,
};

export const STRESS_WEIGHTS = { emotion: 0.4, fidget: 0.35, blink: 0.25 };
export const FOCUS_WEIGHTS = {
  posture: 0.3,
  inverseFatigue: 0.25,
  inverseStress: 0.2,
  stability: 0.25,
};
export const OVERALL_WEIGHTS = { posture: 0.4, focus: 0.35, inverseStress: 0.25 };
export const STATE_THRESHOLDS = { upright: 65, slouching: 30 };

export const STATUS_THRESHOLDS = {
  posture: { good: 70, fair: 40 },
  blinkRate: { goodMin: 12, goodMax: 22, fairMin: 8, fairMax: 28 },
  focus: { good: 70, fair: 40 },
  stress: { good: 30, fair: 60 },
};

export const AMBIENT_UPDATE_INTERVAL = 1000;
export const AMBIENT_TRANSITION_DURATION = 2000;
export const AMBIENT_MAP = [
  { scoreMin: 75, scoreMax: 100, brightness: [0.7, 1.0], warmth: [0.0, 0.0] },
  { scoreMin: 45, scoreMax: 80, brightness: [0.5, 0.7], warmth: [0.2, 0.4] },
  { scoreMin: 15, scoreMax: 50, brightness: [0.3, 0.5], warmth: [0.4, 0.7] },
  { scoreMin: 0, scoreMax: 20, brightness: [0.2, 0.3], warmth: [0.7, 0.9] },
] as const;

export const POSE_FPS = 8;
export const FACE_FPS = 5;
export const POSE_LOOP_INTERVAL = Math.round(1000 / POSE_FPS);
export const FACE_LOOP_INTERVAL = Math.round(1000 / FACE_FPS);

export const LANDMARKS = {
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

export const POSE_CONNECTIONS: [number, number][] = [
  [0, 7],
  [0, 8],
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

export const LEFT_EYE = {
  top: [159, 158, 157],
  bottom: [145, 144, 153],
  left: 33,
  right: 133,
};

export const RIGHT_EYE = {
  top: [386, 385, 384],
  bottom: [374, 373, 380],
  left: 362,
  right: 263,
};

export const PET_HEALTH: Record<PetHealthState, { minScore: number; color: string; label: PetHealthState }> = {
  Thriving: { minScore: 65, color: '#4A7C59', label: 'Thriving' },
  Fading: { minScore: 30, color: '#B8860B', label: 'Fading' },
  Wilting: { minScore: 0, color: '#C0392B', label: 'Wilting' },
};

export const PET_EVOLUTION = [
  { stage: 0, title: 'Egg', minMinutes: 0 },
  { stage: 1, title: 'Hatchling', minMinutes: 10 },
  { stage: 2, title: 'Fledgling', minMinutes: 30 },
  { stage: 3, title: 'Companion', minMinutes: 120 },
  { stage: 4, title: 'Guardian', minMinutes: 300 },
  { stage: 5, title: 'Ascended', minMinutes: 600 },
] as const;

export const PET_ACCESSORIES = [
  { id: 'scarf', label: 'Scarf' },
  { id: 'hat', label: 'Hat' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'cape', label: 'Cape' },
  { id: 'wings', label: 'Wings' },
  { id: 'halo', label: 'Halo' },
  { id: 'crown', label: 'Crown' },
] as const;

export const ELASTIC_BATCH_INTERVAL = 5000;
export const LEADERBOARD_UPSERT_INTERVAL = 60000;
