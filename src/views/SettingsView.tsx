import React, { useState, useEffect } from 'react';
import { GoogleDriveSyncCard } from '../components/GoogleDriveSyncCard';
import { storageService } from '../services/storageService';
import { Smartphone, HardDrive, ShieldCheck, Info } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [stats, setStats] = useState({
    tripsCount: 0,
    customCafesCount: 0,
    favoritesCount: 0,
  });

  const loadStats = () => {
    setStats({
      tripsCount: storageService.getTrips().length,
      customCafesCount: storageService.getCustomCafes().length,
      favoritesCount: storageService.getFavoriteCafeIds().length,
    });
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="space-y-4">
      {/* 1. Google Drive Cloud Sync Card */}
      <GoogleDriveSyncCard onSyncComplete={loadStats} />

      {/* 2. Local-First & Storage Diagnostics */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-800">Bộ nhớ Local-First</h3>
            <p className="text-[11px] text-slate-400">Hoạt động độc lập 100% không cần Internet</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-100">
            <div className="text-base font-black text-slate-800">{stats.tripsCount}</div>
            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Chuyến đi</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-100">
            <div className="text-base font-black text-orange-600">{stats.customCafesCount}</div>
            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Quán ruột</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-100">
            <div className="text-base font-black text-rose-500">{stats.favoritesCount}</div>
            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Yêu thích</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-100">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Dữ liệu an toàn trên thiết bị của bạn. Không qua máy chủ bên thứ ba.</span>
        </div>
      </div>

      {/* 3. Android App & PWA Installation Guide */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-800">Trải Nghiệm Android & PWA</h3>
            <p className="text-[11px] text-slate-400">Cài đặt full màn hình không viền trình duyệt</p>
          </div>
        </div>

        <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="font-bold text-slate-800">📱 Cài đặt Web App (PWA):</div>
            <p className="text-[11px] text-slate-500">
              Mở Safari hoặc Chrome trên điện thoại ➔ Chọn <b>Chia sẻ</b> ➔ Chọn{' '}
              <b>"Thêm vào Màn hình chính" (Add to Home Screen)</b>. Ứng dụng sẽ chạy toàn màn hình
              như một ứng dụng độc lập!
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="font-bold text-slate-800">🤖 Android Native App (Capacitor):</div>
            <p className="text-[11px] text-slate-500">
              Đã cấu hình sẵn mã nguồn Android trong thư mục dự án với Package ID{' '}
              <code className="text-[10px] bg-slate-200 px-1 py-0.5 rounded text-slate-800">
                com.minhton.motoexplorer
              </code>
              . Bạn có thể mở Android Studio và build APK trực tiếp bất cứ lúc nào!
            </p>
          </div>
        </div>

        <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-50">
          <span className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            <span>Phiên bản v4.0.0 (Personal Edition)</span>
          </span>
          <span className="font-bold text-emerald-600">Minh Tôn Special</span>
        </div>
      </div>
    </div>
  );
};
