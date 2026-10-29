import React, { useState, useEffect } from 'react';
import { googleDriveSyncService } from '../services/googleDriveSyncService';
import { storageService } from '../services/storageService';
import { GoogleDriveConfig, SyncStatus } from '../types/sync';
import {
  Cloud,
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  LogOut,
  HelpCircle,
} from 'lucide-react';

interface GoogleDriveSyncCardProps {
  onSyncComplete?: () => void;
}

export const GoogleDriveSyncCard: React.FC<GoogleDriveSyncCardProps> = ({ onSyncComplete }) => {
  const [config, setConfig] = useState<GoogleDriveConfig>(storageService.getGoogleDriveConfig());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'idle' });
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [clientIdInput, setClientIdInput] = useState(config.clientId || '');

  useEffect(() => {
    const unsubscribe = googleDriveSyncService.subscribeStatus((status) => {
      setSyncStatus(status);
      if (status.state === 'success') {
        setConfig(storageService.getGoogleDriveConfig());
        if (onSyncComplete) onSyncComplete();
      }
    });
    return unsubscribe;
  }, [onSyncComplete]);

  const handleSignInGoogle = async () => {
    if (!clientIdInput.trim()) {
      setShowSetupGuide(true);
      alert('⚠️ Bạn chưa nhập Google OAuth Client ID! Vui lòng làm theo hướng dẫn 3 bước để lấy Client ID từ Google Cloud Console.');
      return;
    }

    setIsAuthorizing(true);
    try {
      await googleDriveSyncService.requestGoogleAuth(clientIdInput.trim());
      setConfig(storageService.getGoogleDriveConfig());
      // Trigger sync immediately upon successful auth
      await googleDriveSyncService.syncWithDrive();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối Google Drive';
      alert(`❌ Không thể kết nối: ${msg}`);
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleDisconnect = () => {
    if (confirm('Bạn có chắc chắn muốn ngắt kết nối tài khoản Google Drive này?')) {
      googleDriveSyncService.disconnectGoogle();
      setConfig(storageService.getGoogleDriveConfig());
    }
  };

  const handleSyncNow = async () => {
    if (!config.accessToken) {
      alert('❌ Chưa kết nối tài khoản Google Drive! Vui lòng nhập Client ID và bấm Đăng nhập để cấp quyền trước khi đồng bộ.');
      return;
    }

    try {
      await googleDriveSyncService.syncWithDrive();
      setConfig(storageService.getGoogleDriveConfig());
    } catch {
      // Status listener updates error message
    }
  };

  const handleExportJson = () => {
    googleDriveSyncService.exportBackupJson();
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await googleDriveSyncService.importBackupJson(file);
      alert('✅ Khôi phục dữ liệu từ file JSON thành công!');
      if (onSyncComplete) onSyncComplete();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi nhập file';
      alert(`❌ Không thể nhập dữ liệu: ${msg}`);
    } finally {
      e.target.value = '';
    }
  };

  const isConnected = !!config.accessToken;

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 shadow-xs">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                Google Drive REST API v3
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                }`}
              />
            </div>
            <h3 className="font-extrabold text-sm text-slate-800">
              Đồng bộ Đám mây Google Drive
            </h3>
          </div>
        </div>

        {isConnected && (
          <button
            onClick={handleDisconnect}
            className="text-[11px] text-slate-400 hover:text-rose-500 font-semibold flex items-center gap-1 px-2.5 py-1 rounded-xl hover:bg-rose-50 transition-colors"
            title="Đăng xuất tài khoản"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đổi tài khoản</span>
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        Tự động gộp 2 chiều (Two-Way Merge) nhật ký phượt và quán ruột giữa các thiết bị thông qua tài khoản Google Drive cá nhân của bạn.
      </p>

      {/* Sync Status Banner */}
      {syncStatus.state !== 'idle' && (
        <div
          className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
            syncStatus.state === 'syncing'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : syncStatus.state === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {syncStatus.state === 'syncing' && (
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
          )}
          {syncStatus.state === 'success' && (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          )}
          {syncStatus.state === 'error' && (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span>{syncStatus.message}</span>
        </div>
      )}

      {/* Account Info Box or Client ID Input */}
      {isConnected ? (
        <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80 space-y-1">
          <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Đã kết nối tài khoản Google Drive:</span>
          </div>
          <div className="text-xs font-bold text-slate-800 break-all pl-5">
            {config.userEmail || 'Tài khoản Google đã xác thực'}
          </div>
          {config.lastSyncTime && (
            <div className="text-[10px] text-slate-500 pl-5 pt-0.5">
              Lần đồng bộ gần nhất:{' '}
              {new Date(config.lastSyncTime).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              • {new Date(config.lastSyncTime).toLocaleDateString('vi-VN')}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Google OAuth 2.0 Client ID</span>
            <button
              onClick={() => setShowSetupGuide(!showSetupGuide)}
              className="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 text-[11px]"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Cách lấy Client ID</span>
            </button>
          </div>

          <input
            type="text"
            value={clientIdInput}
            onChange={(e) => setClientIdInput(e.target.value)}
            placeholder="Dán mã Client ID (ví dụ: xxxxx.apps.googleusercontent.com)"
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
          />

          {showSetupGuide && (
            <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 space-y-1.5 animate-in fade-in">
              <div className="font-bold text-amber-900">
                ⚡ 3 Bước lấy Client ID chính thức từ Google (Miễn phí):
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                Google yêu cầu ứng dụng phải có Client ID thật đã đăng ký trong tài khoản Google của bạn (để tránh lỗi <i>401: invalid_client</i>):
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-amber-900 font-medium">
                <li>Truy cập <b>console.cloud.google.com</b> ➔ Tạo Project mới (ví dụ: <i>Explorer Minton</i>).</li>
                <li>Vào <b>APIs & Services</b> ➔ Bật <b>Google Drive API</b>.</li>
                <li>Vào mục <b>Credentials</b> ➔ Tạo <b>OAuth Client ID (Web Application)</b> ➔ Copy mã Client ID dán vào ô bên trên!</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      {isConnected ? (
        <button
          onClick={handleSyncNow}
          disabled={syncStatus.state === 'syncing'}
          className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${syncStatus.state === 'syncing' ? 'animate-spin' : ''}`}
          />
          <span>
            {syncStatus.state === 'syncing'
              ? 'Đang kết nối & đồng bộ dữ liệu...'
              : 'Đồng Bộ Ngay Với Google Drive'}
          </span>
        </button>
      ) : (
        <button
          onClick={handleSignInGoogle}
          disabled={isAuthorizing}
          className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
        >
          <Cloud className="w-4 h-4" />
          <span>
            {isAuthorizing ? 'Đang mở màn hình đăng nhập Google...' : 'Đăng Nhập Google & Cấp Quyền Đồng Bộ'}
          </span>
        </button>
      )}

      {/* Local JSON Backup / Restore section */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
          Sao lưu dự phòng cục bộ (Offline JSON)
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportJson}
            className="py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Xuất file JSON</span>
          </button>

          <label className="py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center">
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Nhập file JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJson}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
