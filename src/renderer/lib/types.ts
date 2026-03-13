export interface Point {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PostureData {
  score: number;
  neckAngle: number;
  shoulderSlant: number;
  trunkSimilarity: number;
  isSlumping: boolean;
}

export interface BlinkData {
  rate: number;
  avgEAR: number;
  prolongedClosures: number;
}

export interface StressData {
  score: number;
  dominantEmotion: string;
  emotionConfidence: number;
}

export type OverallState = 'upright' | 'slouching' | 'fatigued';

export interface ScoreSnapshot {
  timestamp: number;
  posture: PostureData;
  blink: BlinkData;
  focus: { score: number };
  stress: StressData;
  overall: { score: number; state: OverallState };
}

export type PetHealthState = 'Thriving' | 'Fading' | 'Wilting';

export interface PetState {
  stage: number;
  stageName: string;
  health: PetHealthState;
  totalLockedInMinutes: number;
  eggCrackProgress: number;
  accessories: string[];
  lastEvolutionCheck: number;
  sickSince: number | null;
}

export interface CalibrationData {
  uprightNeckAngle: number;
  uprightShoulderSlant: number;
  uprightTrunkVector: [number, number];
  baselineBlinkRate: number;
  baselineEAR: number;
  timestamp: number;
}

export interface LeaderboardEntry {
  nickname: string;
  sessionId: string;
  avgOverallScore: number;
  bestStreak: number;
  totalLockedInMinutes: number;
  level: number;
  levelTitle: string;
  timestamp: string;
}

export type SystemStatus = 'active' | 'degraded' | 'inactive';

export interface SystemsState {
  poseDetection: SystemStatus;
  faceMesh: SystemStatus;
  affectEngine: SystemStatus;
  ambientCtrl: SystemStatus;
}

export interface SessionRecap {
  sessionId: string;
  date: string;
  durationMinutes: number;
  avgPosture: number;
  avgFocus: number;
  avgStress: number;
  avgOverall: number;
  bestStreak: number;
  totalUprightMinutes: number;
  avgBlinkRate: number;
  percentileRank: number | null;
  petLevel: number;
  petTitle: string;
  newAccessories: string[];
  evolved: boolean;
  previousLevel: number | null;
}

export interface AmbientTarget {
  brightness: number;
  warmth: number;
}

export interface BiometricEvent {
  timestamp: string;
  sessionId: string;
  posture: PostureData;
  blink: BlinkData;
  focus: { score: number };
  stress: StressData;
  overall: { score: number; state: OverallState };
  ambient: { brightness: number; warmth: number; petState: string };
}
