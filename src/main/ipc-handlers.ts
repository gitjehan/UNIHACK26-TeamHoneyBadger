import { clipboard, dialog, ipcMain, nativeImage } from 'electron';
import ElectronStore from 'electron-store';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ambientController } from '@main/ambient-controller';
import { elasticClient } from '@main/elastic-client';
import { IPC } from '@shared/ipc-channels';

interface StoreSchema {
  calibration: unknown | null;
  pet: {
    stage: number;
    stageName: string;
    health: 'Thriving' | 'Fading' | 'Wilting';
    totalLockedInMinutes: number;
    eggCrackProgress: number;
    accessories: string[];
    lastEvolutionCheck: number;
    sickSince: number | null;
  };
  nickname: string | null;
  preferences: {
    ambientEnabled: boolean;
    brightnessRange: { min: number; max: number };
    warmthIntensity: number;
  };
  sessions: Array<Record<string, unknown>>;
  recaps: Array<Record<string, unknown>>;
}

const store = new ElectronStore<StoreSchema>({
  defaults: {
    calibration: null,
    pet: {
      stage: 0,
      stageName: 'Egg',
      health: 'Thriving',
      totalLockedInMinutes: 0,
      eggCrackProgress: 0,
      accessories: [],
      lastEvolutionCheck: Date.now(),
      sickSince: null,
    },
    nickname: null,
    preferences: {
      ambientEnabled: true,
      brightnessRange: { min: 0.2, max: 1.0 },
      warmthIntensity: 1,
    },
    sessions: [],
    recaps: [],
  },
});

interface KeyValueStore {
  get: (key: string, defaultValue?: unknown) => unknown;
  set: (key: string, value: unknown) => void;
}

const kvStore = store as unknown as KeyValueStore;
const AUTO_TEST = process.env.KINETIC_AUTOTEST === '1';

let lastAmbientUpdateAt = 0;

export function registerIpcHandlers(): void {
  ipcMain.on(IPC.AMBIENT_UPDATE, (_, payload: { brightness: number; warmth: number }) => {
    const now = Date.now();
    if (now - lastAmbientUpdateAt < 1000) return;
    lastAmbientUpdateAt = now;
    ambientController.setTarget(payload.brightness, payload.warmth);
  });

  ipcMain.on(IPC.BIOMETRIC_EVENT, (_, event) => {
    elasticClient.queueBiometric(event);
  });

  ipcMain.handle(IPC.LEADERBOARD_GET, async () => elasticClient.getLeaderboard());
  ipcMain.handle(IPC.LEADERBOARD_UPSERT, async (_, entry) => elasticClient.upsertLeaderboard(entry));
  ipcMain.handle(IPC.SESSION_HISTORY, async () => kvStore.get('sessions', []));

  ipcMain.handle(IPC.STORE_GET, (_, key: string) => kvStore.get(key));
  ipcMain.handle(IPC.STORE_SET, (_, key: string, value: unknown) => {
    kvStore.set(key, value);
  });

  ipcMain.handle(IPC.RECAP_CLIPBOARD, async (_, dataUrl: string) => {
    if (AUTO_TEST) return { ok: true };
    try {
      const image = nativeImage.createFromDataURL(dataUrl);
      clipboard.writeImage(image);
      return { ok: true };
    } catch (error) {
      console.warn('Failed to copy recap image', error);
      return { ok: false };
    }
  });

  ipcMain.handle(IPC.RECAP_EXPORT, async (_, dataUrl: string, filename: string) => {
    if (AUTO_TEST) {
      try {
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        const target = path.resolve(process.cwd(), 'out', 'kinetic-recap-autotest.png');
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, base64, { encoding: 'base64' });
        return { ok: true, filePath: target };
      } catch (error) {
        console.warn('Failed to export autotest recap image', error);
        return { ok: false };
      }
    }

    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: filename || 'kinetic-recap.png',
      filters: [{ name: 'PNG', extensions: ['png'] }],
    });
    if (canceled || !filePath) return { ok: false };

    try {
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      await fs.writeFile(path.resolve(filePath), base64, { encoding: 'base64' });
      return { ok: true, filePath };
    } catch (error) {
      console.warn('Failed to export recap image', error);
      return { ok: false };
    }
  });
}

export function getStore(): typeof store {
  return store;
}
