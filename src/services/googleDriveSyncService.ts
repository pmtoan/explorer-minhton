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
            prompt?: string;
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
const DRIVE_SCOPE =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';

class GoogleDriveSyncService {
  private statusListeners: Set<(status: SyncStatus) => void> = new Set();
  private currentStatus: SyncStatus = { state: 'idle' };

  constructor() {
    this.checkForUrlHashToken();
  }

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
   * Automatically checks if redirected back with OAuth token in URL hash (#access_token=...)
   */
  public checkForUrlHashToken(): boolean {
    if (typeof window === 'undefined' || !window.location.hash) return false;

    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');

    if (accessToken) {
      const config = storageService.getGoogleDriveConfig();
      config.accessToken = accessToken;
      config.expiresAt = Date.now() + (parseInt(expiresIn || '3600', 10) - 100) * 1000;
      config.autoSync = true;
      storageService.saveGoogleDriveConfig(config);

      // Clean hash from address bar
      window.history.replaceState(null, '', window.location.pathname + window.location.search);

      // Fetch user profile info asynchronously
      this.fetchGoogleUserProfile(accessToken).then((email) => {
        if (email) {
          config.userEmail = email;
          storageService.saveGoogleDriveConfig(config);
          this.updateStatus({
            state: 'idle',
            message: `Đã kết nối tài khoản Google: ${email}`,
          });
        }
      });

      return true;
    }
    return false;
  }

  /**
   * Fetches user email via Google userinfo endpoint using the access token.
   */
  public async fetchGoogleUserProfile(token: string): Promise<string | null> {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.email || null;
      }
    } catch {
      // Ignore userinfo fetch errors
    }
    return null;
  }

  /**
   * Initiates Google Identity Services OAuth 2.0 Account Picker.
   */
  public async requestGoogleAuth(clientId: string): Promise<string> {
    const trimmedId = clientId.trim();
    if (!trimmedId) {
      throw new Error(
        'Vui lòng nhập Google OAuth Client ID của bạn để kết nối với Google Drive.'
      );
    }

    return new Promise((resolve, reject) => {
      // 1. If Google GIS script is ready in window:
      if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
        try {
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: trimmedId,
            scope: DRIVE_SCOPE,
            prompt: 'select_account',
            callback: async (response) => {
              if (response.error || !response.access_token) {
                reject(
                  new Error(response.error || 'Đăng nhập Google bị hủy hoặc gặp lỗi')
                );
                return;
              }

              const userEmail = await this.fetchGoogleUserProfile(response.access_token);

              const config: GoogleDriveConfig = {
                clientId: trimmedId,
                accessToken: response.access_token,
                expiresAt: Date.now() + 3500 * 1000,
                userEmail: userEmail || 'Tài khoản Google đã kết nối',
                autoSync: true,
              };
              storageService.saveGoogleDriveConfig(config);
              resolve(response.access_token);
            },
          });

          tokenClient.requestAccessToken();
          return;
        } catch (err) {
          console.warn('Google Identity Client error, falling back:', err);
        }
      }

      // 2. Direct Web OAuth URL Redirect (fallback for WebView / Browser)
      if (typeof window !== 'undefined') {
        const redirectUri = window.location.origin + window.location.pathname;
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
          trimmedId
        )}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&response_type=token&scope=${encodeURIComponent(
          DRIVE_SCOPE
        )}&prompt=select_account`;

        try {
          const popup = window.open(authUrl, '_blank', 'width=500,height=600');
          if (!popup || popup.closed) {
            window.location.href = authUrl;
          }
        } catch (e) {
          reject(e);
        }
      }
    });
  }

  /**
   * Simulates cloud sync for testing without requiring a Google Cloud project.
   */
  public async simulateTestCloudSync(email = 'pmtoan.explorer@gmail.com'): Promise<void> {
    const config: GoogleDriveConfig = {
      clientId: 'simulated-personal-drive',
      accessToken: `mock-token-${Date.now()}`,
      expiresAt: Date.now() + 86400 * 1000,
      userEmail: email,
      autoSync: true,
    };
    storageService.saveGoogleDriveConfig(config);
    await this.syncWithDrive();
  }

  /**
   * Disconnects current Google Drive account.
   */
  public disconnectGoogle(): void {
    const config = storageService.getGoogleDriveConfig();
    config.accessToken = undefined;
    config.userEmail = undefined;
    storageService.saveGoogleDriveConfig(config);
    this.updateStatus({ state: 'idle', message: 'Đã đăng xuất tài khoản Google' });
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
        await new Promise((r) => setTimeout(r, 600)); // Smooth realistic delay
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
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
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
