export const IPC = {
  AMBIENT_UPDATE: 'ambient:update',
  BIOMETRIC_EVENT: 'biometric:event',
  LEADERBOARD_GET: 'leaderboard:get',
  LEADERBOARD_UPSERT: 'leaderboard:upsert',
  STORE_GET: 'store:get',
  STORE_SET: 'store:set',
  SESSION_HISTORY: 'analytics:session-history',
  RECAP_EXPORT: 'recap:export-png',
  RECAP_CLIPBOARD: 'recap:copy-clipboard',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
