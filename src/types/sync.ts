import { Trip } from './trip';
import { Cafe } from './cafe';

export interface GoogleDriveConfig {
  clientId: string;
  accessToken?: string;
  expiresAt?: number;
  userEmail?: string;
  lastSyncTime?: string;
  autoSync: boolean;
}

export interface SyncPayload {
  version: string;
  exportedAt: string;
  trips: Trip[];
  customCafes: Cafe[];
  favoriteCafeIds: string[];
}

export type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncStatus {
  state: SyncState;
  message?: string;
  lastSyncedAt?: string;
}
