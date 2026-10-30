import React from 'react';
import { ActiveTrip } from '../types/trip';
import { liveTripService } from '../services/liveTripService';
import { Pause, Play, ChevronRight, Navigation } from 'lucide-react';

interface ActiveTripBannerProps {
  activeTrip: ActiveTrip;
  onOpenDetails: () => void;
  onOpenNavigation?: () => void;
}

export const ActiveTripBanner: React.FC<ActiveTripBannerProps> = ({
  activeTrip,
  onOpenDetails,
  onOpenNavigation,
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
              <span className="tracking-wide uppercase">Tạm dừng</span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-ping"></span>
              <span className="tracking-wide uppercase">Đang ghi trực tiếp</span>
            </>
          )}
        </span>
        <span className="text-xs font-semibold opacity-90 truncate">
          {activeTrip.displayStartTime.split('•')[0]}
        </span>
      </div>

      {/* GPS Warning or Error Badge */}
      {activeTrip.gpsStatus === 'permission_denied' && (
        <div className="bg-rose-600 text-white p-2.5 rounded-2xl mb-2.5 text-xs font-bold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-1.5">
            <span>⚠️</span>
            <span>Chưa cấp quyền vị trí!</span>
          </div>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              await liveTripService.retryLocationAcquisition();
            }}
            className="px-2.5 py-1 bg-white text-rose-700 rounded-xl text-[11px] font-black hover:bg-rose-50 transition-colors shadow-xs"
          >
            Cấp quyền
          </button>
        </div>
      )}

      {activeTrip.gpsStatus === 'error' && (
        <div className="bg-amber-600 text-white p-2.5 rounded-2xl mb-2.5 text-xs font-bold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-1.5 flex-1 pr-2">
            <span>⚠️</span>
            <span>{activeTrip.gpsErrorMessage || 'Chưa nhận được tín hiệu GPS.'}</span>
          </div>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              await liveTripService.retryLocationAcquisition();
            }}
            className="px-2.5 py-1 bg-white text-amber-800 rounded-xl text-[11px] font-black hover:bg-amber-50 transition-colors shadow-xs flex-shrink-0"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* GPS Status Indicator */}
      {isPaused ? (
        <div className="flex items-center gap-2 mb-2 text-[11px] font-medium text-amber-100">
          <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-lg text-white">
            <span>⏸️</span>
            <span>GPS tạm dừng</span>
          </span>
        </div>
      ) : activeTrip.gpsStatus === 'locked' ? (
        <div className="flex items-center gap-2 mb-2 text-[11px] font-medium text-emerald-100">
          <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-lg text-white">
            <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
            <span>GPS sẵn sàng {activeTrip.accuracyMeters ? `(±${activeTrip.accuracyMeters}m)` : ''}</span>
          </span>
        </div>
      ) : activeTrip.gpsStatus === 'searching' ? (
        <div className="flex items-center gap-2 mb-2 text-[11px] font-medium text-emerald-100">
          <span className="inline-flex items-center gap-1 bg-amber-500/30 px-2 py-0.5 rounded-lg text-amber-100">
            <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping"></span>
            <span>Đang tìm GPS...</span>
          </span>
        </div>
      ) : null}

      {/* Main Odometer & Telemetry Area */}
      <div className="bg-white/10 hover:bg-white/15 p-3.5 rounded-2xl transition-all border border-white/20 mb-3">
        <div className="flex items-center justify-between text-xs font-medium text-white/90">
          <span className="flex items-center gap-1 font-bold">
            <span>Quãng đường</span>
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenNavigation) {
                onOpenNavigation();
              } else {
                onOpenDetails();
              }
            }}
            className="inline-flex items-center gap-1 text-xs font-extrabold bg-white/25 hover:bg-white/35 px-2.5 py-1 rounded-xl text-white transition-colors shadow-xs"
          >
            <span>Bản đồ & Dẫn đường</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <div className="text-3xl font-black text-white flex items-baseline gap-1.5 tracking-tight font-mono">
            <span>{activeTrip.distanceKm.toFixed(2)}</span>
            <span className="text-sm font-bold opacity-90">km</span>
          </div>

          {/* Real-Time Speed Badge */}
          <div className="bg-white/20 px-3 py-1 rounded-xl text-right">
            <div className="text-[10px] text-white/80 font-bold uppercase">Tốc độ</div>
            <div className="text-lg font-black text-white font-mono leading-none">
              {(activeTrip.telemetry?.currentSpeedKmh || 0).toFixed(0)}{' '}
              <span className="text-[10px] font-normal opacity-90">km/h</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-white/90 flex items-center justify-between gap-1.5 mt-2 pt-2 border-t border-white/10 truncate">
          <div className="flex items-center gap-1.5 truncate">
            <Navigation className="w-3.5 h-3.5 flex-shrink-0 text-emerald-200" />
            <span className="truncate">
              <b>{checkpointCount}</b> mốc • <b>{lastCpName}</b>
            </span>
          </div>
          {activeTrip.destination && (
            <span className="text-[10px] bg-rose-500/80 text-white font-bold px-2 py-0.5 rounded-lg flex-shrink-0 truncate max-w-[120px]">
              Đích: {activeTrip.destination.name}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
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
              <span>Tiếp tục</span>
            </>
          ) : (
            <>
              <Pause className="w-4 h-4 fill-emerald-700 text-emerald-700" />
              <span>Tạm dừng</span>
            </>
          )}
        </button>

        {onOpenNavigation && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenNavigation();
            }}
            className="flex-1 py-2.5 px-3.5 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-1.5 bg-slate-900/90 hover:bg-slate-950 text-emerald-300 border border-white/20 transition-transform active:scale-95 shadow-sm"
          >
            <Navigation className="w-4 h-4" />
            <span>Bản đồ & Dẫn đường</span>
          </button>
        )}
      </div>
    </div>
  );
};
