import type { AmbientTarget, BiometricEvent, LeaderboardEntry } from './lib/types';

declare global {
  interface Window {
    kinetic: {
      updateAmbient: (data: AmbientTarget) => void;
      sendBiometric: (event: BiometricEvent) => void;
      getLeaderboard: () => Promise<LeaderboardEntry[]>;
      upsertLeaderboard: (entry: LeaderboardEntry) => Promise<void>;
      storeGet: (key: string) => Promise<unknown>;
      storeSet: (key: string, value: unknown) => Promise<void>;
      getSessionHistory: () => Promise<unknown>;
      exportRecapPng: (dataUrl: string, filename: string) => Promise<{ ok: boolean; filePath?: string }>;
      copyRecapToClipboard: (dataUrl: string) => Promise<{ ok: boolean }>;
    };
  }
}

export {};
