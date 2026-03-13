import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc-channels';

contextBridge.exposeInMainWorld('kinetic', {
  updateAmbient: (data: { brightness: number; warmth: number }) => ipcRenderer.send(IPC.AMBIENT_UPDATE, data),
  sendBiometric: (event: unknown) => ipcRenderer.send(IPC.BIOMETRIC_EVENT, event),
  getLeaderboard: () => ipcRenderer.invoke(IPC.LEADERBOARD_GET),
  upsertLeaderboard: (entry: unknown) => ipcRenderer.invoke(IPC.LEADERBOARD_UPSERT, entry),
  storeGet: (key: string) => ipcRenderer.invoke(IPC.STORE_GET, key),
  storeSet: (key: string, value: unknown) => ipcRenderer.invoke(IPC.STORE_SET, key, value),
  getSessionHistory: () => ipcRenderer.invoke(IPC.SESSION_HISTORY),
  exportRecapPng: (dataUrl: string, filename: string) => ipcRenderer.invoke(IPC.RECAP_EXPORT, dataUrl, filename),
  copyRecapToClipboard: (dataUrl: string) => ipcRenderer.invoke(IPC.RECAP_CLIPBOARD, dataUrl),
});
