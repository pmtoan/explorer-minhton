import React, { useState, useEffect } from 'react';
import { googleDriveSyncService } from '../services/googleDriveSyncService';
import { storageService } from '../services/storageService';
import { GoogleDriveConfig, SyncStatus } from '../types/sync';
import { Cloud, RefreshCw, Download, Upload, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

interface GoogleDriveSyncCardProps {
  onSyncComplete?: () => void;
}

export const GoogleDriveSyncCard: React.FC<GoogleDriveSyncCardProps> = ({ onSyncComplete }) => {
  const [config, setConfig] = useState<GoogleDriveConfig>(storageService.getGoogleDriveConfig());
  const [clientIdInput, setClientIdInput] = useState(config.clientId || '');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'idle' });
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  useEffect(() => {
    const unsubscribe = googleDriveSyncService.subscribeStatus((status) => {
      setSyncStatus(status);
      if (status.state === 'success' && onSyncComplete) {
        onSyncComplete();
      }
    });
    return unsubscribe;
  }, [onSyncComplete]);

  const handleConnectAuth = async () => {
    if (!clientIdInput.trim()) {
      alert('Vui lòng nhập Google OAuth Client ID');
      return;
    }
    setIsAuthorizing(true);
    try {
      await googleDriveSyncService.requestGoogleAuth(clientIdInput.trim());
      setConfig(storageService.getGoogleDriveConfig());
      alert('Đã kết nối thành công với tài khoản Google Drive!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối';
      alert(`Không thể kết nối Google: ${msg}`);
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      await googleDriveSyncService.syncWithDrive();
      setConfig(storageService.getGoogleDriveConfig());
    } catch {
      // status listener handles error update
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
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
          <Cloud className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
              Gói Google One 2TB
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            />
          </div>
          <h3 className="font-extrabold text-sm text-slate-800">
            Đồng bộ Đám mây Google Drive
          </h3>
        </div>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        Tự động gộp 2 chiều (Two-Way Merge) nhật ký phượt và quán cafe ruột giữa Web và
        Android cá nhân của bạn mà không lo thất lạc dữ liệu.
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
          {syncStatus.state === 'syncing' && <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />}
          {syncStatus.state === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          {syncStatus.state === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
          <span>{syncStatus.message}</span>
        </div>
      )}

      {/* Connection & Auth Box */}
      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700">Google OAuth Client ID</span>
          <button
            onClick={() => setShowSetupGuide(!showSetupGuide)}
            className="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Hướng dẫn 3 bước</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={clientIdInput}
            onChange={(e) => setClientIdInput(e.target.value)}
            placeholder="xxxxxx.apps.googleusercontent.com"
            className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={handleConnectAuth}
            disabled={isAuthorizing}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs whitespace-nowrap shadow-sm disabled:opacity-50"
          >
            {isAuthorizing ? 'Đang kết nối...' : isConnected ? 'Kết nối lại' : 'Kết nối'}
          </button>
        </div>

        {config.userEmail && (
          <div className="text-[11px] text-slate-500">
            Tài khoản đã liên kết: <b className="text-slate-700">{config.userEmail}</b>
          </div>
        )}
      </div>

      {/* 3-Step Setup Instructions Collapsible */}
      {showSetupGuide && (
        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1.5 animate-in fade-in">
          <div className="font-bold">⚡ 3 Bước thiết lập Google Drive cá nhân:</div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-amber-800">
            <li>Vào <b>Google Cloud Console</b> ➔ Tạo Project mới (ví dụ: Explorer Minhton).</li>
            <li>Bật <b>Google Drive API</b> trong mục APIs & Services ➔ Enable APIs.</li>
            <li>Tạo <b>OAuth 2.0 Client ID (Web Application)</b> ➔ Thêm URL chạy app vào Authorized JavaScript Origins ➔ Copy Client ID dán vào ô trên!</li>
          </ol>
        </div>
      )}

      {/* Sync Action Button */}
      <button
        onClick={handleSyncNow}
        disabled={syncStatus.state === 'syncing'}
        className="w-full py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95 disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${syncStatus.state === 'syncing' ? 'animate-spin' : ''}`} />
        <span>Đồng Bộ Ngay Với Google Drive</span>
      </button>

      {/* Local JSON Backup / Restore section */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
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
