import React, { useState, useEffect } from 'react';
import { googleDriveSyncService, DEFAULT_GOOGLE_CLIENT_ID } from '../services/googleDriveSyncService';
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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface GoogleDriveSyncCardProps {
  onSyncComplete?: () => void;
}

export const GoogleDriveSyncCard: React.FC<GoogleDriveSyncCardProps> = ({ onSyncComplete }) => {
  const [config, setConfig] = useState<GoogleDriveConfig>(storageService.getGoogleDriveConfig());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'idle' });
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customClientId, setCustomClientId] = useState(config.clientId || '');

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
    setIsAuthorizing(true);
    try {
      await googleDriveSyncService.requestGoogleAuth(customClientId.trim() || undefined);
      setConfig(storageService.getGoogleDriveConfig());
      // Trigger sync immediately after connecting
      await googleDriveSyncService.syncWithDrive();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối Google';
      alert(`Không thể kết nối Google: ${msg}`);
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleDisconnect = () => {
    if (confirm('Bạn có chắc chắn muốn ngắt kết nối tài khoản Google này?')) {
      googleDriveSyncService.disconnectGoogle();
      setConfig(storageService.getGoogleDriveConfig());
    }
  };

  const handleSyncNow = async () => {
    if (!config.accessToken) {
      await handleSignInGoogle();
      return;
    }

    try {
      await googleDriveSyncService.syncWithDrive();
      setConfig(storageService.getGoogleDriveConfig());
    } catch {
      // Status listener updates error
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
      alert('Khôi phục dữ liệu từ file JSON thành công!');
      if (onSyncComplete) onSyncComplete();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi nhập file';
      alert(`Không thể nhập dữ liệu: ${msg}`);
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
                Gói Google Drive 2TB
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                }`}
              />
            </div>
            <h3 className="font-extrabold text-sm text-slate-800">
              Đồng bộ Đám mây Cá nhân
            </h3>
          </div>
        </div>

        {isConnected && (
          <button
            onClick={handleDisconnect}
            className="text-[11px] text-slate-400 hover:text-rose-500 font-semibold flex items-center gap-1 px-2.5 py-1 rounded-xl hover:bg-rose-50 transition-colors"
            title="Đăng xuất tài khoản Google"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đổi tài khoản</span>
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        Nhấn nút bên dưới để chọn tài khoản Google của bạn và cấp quyền. Dữ liệu chuyến đi và quán ruột sẽ tự động đồng bộ 2 chiều (Two-Way Merge) an toàn.
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

      {/* Account Info Box or One-Click Sign In */}
      {isConnected ? (
        <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80 space-y-1">
          <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Đã kết nối tài khoản Google:</span>
          </div>
          <div className="text-xs font-bold text-slate-800 break-all pl-5">
            {config.userEmail || 'explorer.minhton@gmail.com'}
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
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center space-y-2">
          <div className="text-xs font-bold text-slate-700">
            Chưa liên kết tài khoản Google Drive
          </div>
          <p className="text-[11px] text-slate-400">
            Chỉ cần 1 chạm: Chọn tài khoản Google và cho phép ứng dụng lưu file nhật ký riêng tư.
          </p>
        </div>
      )}

      {/* Primary Action Button */}
      <button
        onClick={isConnected ? handleSyncNow : handleSignInGoogle}
        disabled={isAuthorizing || syncStatus.state === 'syncing'}
        className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
      >
        <RefreshCw
          className={`w-4 h-4 ${
            isAuthorizing || syncStatus.state === 'syncing' ? 'animate-spin' : ''
          }`}
        />
        <span>
          {isAuthorizing
            ? 'Đang mở màn hình Google...'
            : syncStatus.state === 'syncing'
            ? 'Đang đồng bộ dữ liệu...'
            : isConnected
            ? 'Đồng Bộ Ngay Với Google Drive'
            : 'Đăng Nhập Google & Cấp Quyền Đồng Bộ'}
        </span>
      </button>

      {/* Advanced Client ID Setup (Collapsible for developers) */}
      <div className="pt-1">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors mx-auto"
        >
          <span>Tùy chỉnh Google Cloud Client ID (Nâng cao)</span>
          {showAdvanced ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {showAdvanced && (
          <div className="mt-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 animate-in fade-in">
            <label className="text-[11px] font-bold text-slate-600 block">
              Google OAuth Client ID tùy chỉnh:
            </label>
            <input
              type="text"
              value={customClientId}
              onChange={(e) => setCustomClientId(e.target.value)}
              placeholder={DEFAULT_GOOGLE_CLIENT_ID}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-[11px] font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Mặc định ứng dụng đã có sẵn Client ID. Bạn chỉ cần đổi nếu muốn dùng Project Google Cloud Console riêng của bạn.
            </p>
          </div>
        )}
      </div>

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
