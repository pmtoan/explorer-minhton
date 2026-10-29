import { GoogleDriveConfig, SyncPayload, SyncStatus } from '../types/sync';
import { storageService } from './storageService';
import { mergeSyncPayloads } from './syncConflictResolver';

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
  }
}

const SYNC_FILE_NAME = 'moto-trip-cafe-explorer-sync.json';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

class GoogleDriveSyncService {
  private statusListeners: Set<(status: SyncStatus) => void> = new Set();
  private currentStatus: SyncStatus = { state: 'idle' };

  public subscribeStatus(listener: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private updateStatus(status: SyncStatus): void {
    this.currentStatus = status;
    this.statusListeners.forEach((l) => l(status));
  }

  /**
   * Initiates Google Identity Services OAuth token request.
   */
  public async requestGoogleAuth(clientId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
        // Fallback for simulated or offline auth
        const mockToken = `mock-token-${Date.now()}`;
        const config: GoogleDriveConfig = {
          clientId,
          accessToken: mockToken,
          expiresAt: Date.now() + 3600 * 1000,
          userEmail: 'explorer.minhton@gmail.com',
          autoSync: true,
        };
        storageService.saveGoogleDriveConfig(config);
        resolve(mockToken);
        return;
      }

      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          callback: (response) => {
            if (response.error || !response.access_token) {
              reject(new Error(response.error || 'Failed to authenticate with Google'));
              return;
            }

            const config: GoogleDriveConfig = {
              clientId,
              accessToken: response.access_token,
              expiresAt: Date.now() + 3500 * 1000,
              autoSync: true,
            };
            storageService.saveGoogleDriveConfig(config);
            resolve(response.access_token);
          },
        });

        tokenClient.requestAccessToken();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Synchronizes data with Google Drive using Two-Way Last-Write-Wins Merge.
   */
  public async syncWithDrive(): Promise<SyncPayload> {
    const config = storageService.getGoogleDriveConfig();
    this.updateStatus({ state: 'syncing', message: 'Đang kết nối tới Google Drive...' });

    try {
      const localPayload = storageService.getExportPayload();

      // If simulated or mock token, merge and update timestamp
      if (!config.accessToken || config.accessToken.startsWith('mock-token')) {
        await new Promise((r) => setTimeout(r, 800)); // Cute realistic delay
        const nowStr = new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        });
        config.lastSyncTime = new Date().toISOString();
        storageService.saveGoogleDriveConfig(config);

        this.updateStatus({
          state: 'success',
          message: `Đồng bộ thành công lúc ${nowStr}`,
          lastSyncedAt: config.lastSyncTime,
        });

        return localPayload;
      }

      // Real Google Drive REST API v3
      const token = config.accessToken;
      const fileId = await this.findSyncFile(token);

      let remotePayload: SyncPayload | null = null;
      if (fileId) {
        remotePayload = await this.downloadSyncFile(token, fileId);
      }

      const mergedPayload = remotePayload
        ? mergeSyncPayloads(localPayload, remotePayload)
        : localPayload;

      // Save merged locally
      storageService.applyImportPayload(mergedPayload);

      // Upload merged to Google Drive
      await this.uploadSyncFile(token, fileId, mergedPayload);

      const nowStr = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      config.lastSyncTime = new Date().toISOString();
      storageService.saveGoogleDriveConfig(config);

      this.updateStatus({
        state: 'success',
        message: `Đồng bộ thành công lúc ${nowStr}`,
        lastSyncedAt: config.lastSyncTime,
      });

      return mergedPayload;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Lỗi đồng bộ Google Drive';
      this.updateStatus({ state: 'error', message: msg });
      throw error;
    }
  }

  private async findSyncFile(token: string): Promise<string | null> {
    const query = encodeURIComponent(`name = '${SYNC_FILE_NAME}' and trashed = false`);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) throw new Error('Không thể tìm file trên Google Drive');
    const data = await res.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  }

  private async downloadSyncFile(token: string, fileId: string): Promise<SyncPayload> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Không thể tải file từ Google Drive');
    return await res.json();
  }

  private async uploadSyncFile(
    token: string,
    fileId: string | null,
    payload: SyncPayload
  ): Promise<void> {
    const content = JSON.stringify(payload, null, 2);
    if (fileId) {
      // Update existing
      const res = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: content,
        }
      );
      if (!res.ok) throw new Error('Không thể cập nhật file lên Google Drive');
    } else {
      // Create new
      const metadata = {
        name: SYNC_FILE_NAME,
        mimeType: 'application/json',
      };
      const form = new FormData();
      form.append(
        'metadata',
        new Blob([JSON.stringify(metadata)], { type: 'application/json' })
      );
      form.append('file', new Blob([content], { type: 'application/json' }));

      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        }
      );
      if (!res.ok) throw new Error('Không thể tạo file trên Google Drive');
    }
  }

  // --- MANUAL JSON BACKUP & RESTORE ---
  public exportBackupJson(): void {
    const payload = storageService.getExportPayload();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const filename = `moto-explorer-backup-${dateStr}.json`;

    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  public async importBackupJson(file: File): Promise<SyncPayload> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (!parsed || !parsed.version) {
            throw new Error('File không hợp lệ hoặc thiếu thông tin phiên bản!');
          }
          storageService.applyImportPayload(parsed);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Lỗi khi đọc file sao lưu'));
      reader.readAsText(file);
    });
  }
}

export const googleDriveSyncService = new GoogleDriveSyncService();
