/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

import { app, BrowserWindow, systemPreferences } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import dotenv from 'dotenv';
import { ambientController } from '@main/ambient-controller';
import { elasticClient } from '@main/elastic-client';
import { registerIpcHandlers } from '@main/ipc-handlers';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

if (started) app.quit();

let flushTimer: NodeJS.Timeout | null = null;
const AUTO_TEST = process.env.KINETIC_AUTOTEST === '1';

async function requestPermissions(): Promise<void> {
  if (AUTO_TEST) return;
  if (process.platform !== 'darwin') return;
  try {
    await systemPreferences.askForMediaAccess('camera');
  } catch (error) {
    console.warn('Camera permission prompt failed', error);
  }
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#f6f2ea',
    title: 'KINETIC',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const search = AUTO_TEST ? 'autotest=1' : undefined;

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const suffix = search ? (MAIN_WINDOW_VITE_DEV_SERVER_URL.includes('?') ? `&${search}` : `?${search}`) : '';
    mainWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}${suffix}`);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), search ? { search } : undefined);
  }

  return mainWindow;
}

function registerCleanupHandlers(): void {
  const cleanup = async () => {
    await ambientController.reset();
    if (flushTimer) clearInterval(flushTimer);
    await elasticClient.flushBiometrics();
  };

  app.on('before-quit', cleanup);
  app.on('will-quit', cleanup);
  process.on('SIGTERM', async () => { await cleanup(); process.exit(0); });
  process.on('SIGINT', async () => { await cleanup(); process.exit(0); });
  process.on('uncaughtException', async (error) => {
    console.error('uncaughtException', error);
    await cleanup();
    process.exit(1);
  });
}

app.on('ready', async () => {
  await requestPermissions();
  registerIpcHandlers();
  registerCleanupHandlers();
  createWindow();
  flushTimer = setInterval(() => {
    elasticClient.flushBiometrics().catch((error) => console.warn('flushBiometrics failed', error));
  }, 5000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
