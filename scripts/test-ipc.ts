import fs from 'node:fs';
import path from 'node:path';

const preloadPath = path.resolve(process.cwd(), 'src/preload/preload.ts');
const channelsPath = path.resolve(process.cwd(), 'src/shared/ipc-channels.ts');

const preload = fs.readFileSync(preloadPath, 'utf8');
const channels = fs.readFileSync(channelsPath, 'utf8');

const requiredChannels = [
  'AMBIENT_UPDATE',
  'BIOMETRIC_EVENT',
  'LEADERBOARD_GET',
  'LEADERBOARD_UPSERT',
  'STORE_GET',
  'STORE_SET',
  'SESSION_HISTORY',
  'RECAP_EXPORT',
  'RECAP_CLIPBOARD',
];

const requiredBridgeMethods = [
  'updateAmbient',
  'sendBiometric',
  'getLeaderboard',
  'upsertLeaderboard',
  'storeGet',
  'storeSet',
  'getSessionHistory',
  'exportRecapPng',
  'copyRecapToClipboard',
];

for (const channel of requiredChannels) {
  if (!channels.includes(channel)) {
    throw new Error(`Missing IPC channel constant: ${channel}`);
  }
}

for (const method of requiredBridgeMethods) {
  if (!preload.includes(`${method}:`)) {
    throw new Error(`Missing preload bridge method: ${method}`);
  }
}

console.log('PASS IPC contract static verification');
