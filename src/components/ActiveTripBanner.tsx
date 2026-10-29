import React from 'react';
import { ActiveTrip } from '../types/trip';
import { liveTripService } from '../services/liveTripService';
import { Pause, Play, ChevronRight, Navigation } from 'lucide-react';

interface ActiveTripBannerProps {
  activeTrip: ActiveTrip;
  onOpenDetails: () => void;
}

export const ActiveTripBanner: React.FC<ActiveTripBannerProps> = ({
  activeTrip,
  onOpenDetails,
}) => {
  const isPaused = activeTrip.status === 'paused';
  const checkpointCount = activeTrip.route.checkpoints.length;
  const lastCpName =
    checkpointCount > 0
      ? activeTrip.route.checkpoints[checkpointCount - 1].shortName
      : 'Điểm xuất phát';

  const handleTogglePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPaused) {
      liveTripService.resumeLiveTrip();
    } else {
      liveTripService.pauseLiveTrip();
    }
  };

  return (
    <div
      onClick={onOpenDetails}
      className={`relative overflow-hidden p-4 rounded-3xl shadow-lg cursor-pointer transition-all duration-300 select-none ${
        isPaused
          ? 'bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 text-white border-2 border-orange-300'
          : 'bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-800 text-white border-2 border-emerald-300/80 shadow-emerald-500/20'
      }`}
    >
      {/* Top Status Header */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold backdrop-blur shadow-sm ${
            isPaused
              ? 'bg-white/20 text-white border border-white/30'
              : 'bg-white/25 text-white border border-white/30'
          }`}
        >
          {isPaused ? (
            <>
              <span className="text-amber-200">⏸️</span>
              <span>ĐÃ TẠM DỪNG (TẮT GPS CHỐNG NÓNG)</span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-ping"></span>
              <span className="tracking-wide">ĐANG GHI HÀNH TRÌNH THỰC TẾ</span>
            </>
          )}
        </span>
        <span className="text-xs font-semibold opacity-90 truncate">
          {activeTrip.displayStartTime.split('•')[0]}
        </span>
      </div>

      {/* GPS Permission Warning if Denied */}
      {activeTrip.gpsStatus === 'permission_denied' && (
        <div className="bg-rose-600 text-white p-2.5 rounded-2xl mb-2.5 text-xs font-bold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-1.5">
            <span>⚠️</span>
            <span>Chưa cấp quyền GPS vị trí!</span>
          </div>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              await liveTripService.requestLocationPermission();
            }}
            className="px-2.5 py-1 bg-white text-rose-700 rounded-xl text-[11px] font-black hover:bg-rose-50 transition-colors shadow-xs"
          >
            Cấp quyền ngay
          </button>
        </div>
      )}

      {/* GPS Locked / Searching Badge */}
      {!isPaused && activeTrip.gpsStatus !== 'permission_denied' && (
        <div className="flex items-center gap-2 mb-2 text-[11px] font-medium text-emerald-100">
          {activeTrip.gpsStatus === 'locked' ? (
            <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-lg text-white">
              <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
              <span>GPS đã khóa tọa độ {activeTrip.accuracyMeters ? `(±${activeTrip.accuracyMeters}m)` : ''}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-amber-500/30 px-2 py-0.5 rounded-lg text-amber-100">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping"></span>
              <span>Đang kết nối vệ tinh GPS ngoài trời...</span>
            </span>
          )}
        </div>
      )}

      {/* Main Odometer Area */}
      <div className="bg-white/10 hover:bg-white/15 p-3 rounded-2xl transition-all border border-white/20 mb-3">
        <div className="flex items-center justify-between text-xs font-medium text-white/90">
          <span>Quãng đường đã đi (GPS):</span>
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-lg text-white">
            Xem chi tiết <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
        <div className="text-3xl font-black text-white flex items-baseline gap-1.5 mt-1 tracking-tight">
          <span>{activeTrip.distanceKm.toFixed(1)}</span>
          <span className="text-sm font-bold opacity-90">km</span>
        </div>
        <div className="text-xs text-white/90 flex items-center gap-1.5 mt-1.5 truncate">
          <Navigation className="w-3.5 h-3.5 flex-shrink-0 text-emerald-200" />
          <span className="truncate">
            Đã qua <b>{checkpointCount}</b> mốc • Vị trí gần nhất: <b>{lastCpName}</b>
          </span>
        </div>
      </div>

      {/* Battery-Saving Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleTogglePause}
          className={`flex-1 py-2.5 px-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-sm ${
            isPaused
              ? 'bg-white text-orange-700 hover:bg-orange-50'
              : 'bg-white text-emerald-800 hover:bg-emerald-50'
          }`}
        >
          {isPaused ? (
            <>
              <Play className="w-4 h-4 fill-orange-600 text-orange-600" />
              <span>Tiếp tục di chuyển (Bật lại GPS)</span>
            </>
          ) : (
            <>
              <Pause className="w-4 h-4 fill-emerald-700 text-emerald-700" />
              <span>Tạm dừng (Nghỉ chân / Tiết kiệm pin)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
