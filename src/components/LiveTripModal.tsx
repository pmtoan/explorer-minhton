import React, { useState } from 'react';
import { ActiveTrip } from '../types/trip';
import { liveTripService } from '../services/liveTripService';
import { SvgRouteMap } from './SvgRouteMap';
import { LiveNavigationCockpit } from './LiveNavigationCockpit';
import { ArrowLeft, Pause, Play, Flag, Plus, Trash2, MapPin, Gauge, Map as MapIcon } from 'lucide-react';

interface LiveTripModalProps {
  activeTrip: ActiveTrip;
  onClose: () => void;
  onOpenFinishModal: () => void;
}

export const LiveTripModal: React.FC<LiveTripModalProps> = ({
  activeTrip,
  onClose,
  onOpenFinishModal,
}) => {
  const [tab, setTab] = useState<'cockpit' | 'checkpoints'>('cockpit');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const isPaused = activeTrip.status === 'paused';

  const handleTogglePause = () => {
    if (isPaused) {
      liveTripService.resumeLiveTrip();
    } else {
      liveTripService.pauseLiveTrip();
    }
  };

  const handleManualCheckIn = async () => {
    setIsCheckingIn(true);
    try {
      await liveTripService.addManualCheckpoint();
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleDiscard = () => {
    if (window.confirm('Bạn có chắc muốn hủy chuyến đi hiện tại? Dữ liệu GPS này sẽ không được lưu.')) {
      liveTripService.discardActiveTrip();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-[#f8fafc] w-full max-w-lg rounded-t-[32px] sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Top Header */}
        <div className="bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              isPaused
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isPaused
                  ? 'bg-amber-500'
                  : activeTrip.gpsStatus === 'locked'
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-rose-500 animate-ping'
              }`}
            ></span>
            {isPaused
              ? 'GPS Đã tạm dừng'
              : activeTrip.gpsStatus === 'locked'
              ? `GPS Đã khóa (${activeTrip.accuracyMeters ? `±${activeTrip.accuracyMeters}m` : 'chuẩn'})`
              : activeTrip.gpsStatus === 'permission_denied'
              ? 'Chưa cấp quyền GPS'
              : 'GPS đang kết nối...'}
          </span>
        </div>

        {activeTrip.gpsStatus === 'permission_denied' && (
          <div className="mx-4 mt-2 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
            <div>
              <p className="font-bold">⚠️ Chưa được cấp quyền Vị trí!</p>
              <p className="text-[11px] text-rose-600">Vui lòng bấm nút bên cạnh để cấp quyền GPS.</p>
            </div>
            <button
              onClick={() => liveTripService.retryLocationAcquisition()}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-xl font-bold text-xs shadow-xs"
            >
              Cấp quyền
            </button>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="px-4 pt-2">
          <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setTab('cockpit')}
              className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                tab === 'cockpit'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Gauge className="w-4 h-4 text-emerald-600" />
              <span>Dẫn Đường & Tốc Độ</span>
            </button>
            <button
              onClick={() => setTab('checkpoints')}
              className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                tab === 'checkpoints'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <MapIcon className="w-4 h-4 text-emerald-600" />
              <span>Sơ Đồ & Mốc ({activeTrip.route.checkpoints.length})</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {tab === 'cockpit' ? (
            <LiveNavigationCockpit activeTrip={activeTrip} />
          ) : (
            <>
              {/* Main Stats Card */}
              <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-semibold block">Hành trình đang đi</span>
                    <h2 className="text-base font-extrabold text-slate-800 mt-0.5">{activeTrip.title}</h2>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-semibold block">Khởi hành</span>
                    <span className="text-xs font-bold text-emerald-600">
                      {activeTrip.displayStartTime.split('•')[0]}
                    </span>
                  </div>
                </div>

                {/* Live GPS Route Visualizer */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
                    <span>🗺️ Sơ đồ GPS thực tế</span>
                    <span className="text-emerald-600">{activeTrip.distanceKm.toFixed(2)} km</span>
                  </div>
                  <SvgRouteMap route={activeTrip.route} height={145} />
                </div>
              </div>

              {/* Timeline of Checkpoints */}
              <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Các mốc hành chính ({activeTrip.route.checkpoints.length})
                  </h3>
                  <button
                    onClick={handleManualCheckIn}
                    disabled={isCheckingIn}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isCheckingIn ? 'Đang định vị...' : '+ Check-in mốc'}</span>
                  </button>
                </div>

                {activeTrip.route.checkpoints.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                    Đang chờ tín hiệu GPS để ghi nhận mốc hành chính đầu tiên...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeTrip.route.checkpoints.map((cp, idx) => (
                      <div
                        key={cp.id}
                        className={`flex items-center justify-between p-2.5 rounded-2xl text-xs transition-colors ${
                          idx === 0
                            ? 'bg-emerald-50 text-emerald-900 border border-emerald-100'
                            : idx === activeTrip.route.checkpoints.length - 1
                            ? 'bg-slate-100 text-slate-900 font-semibold border border-slate-200'
                            : 'bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center font-bold text-[10px] text-slate-600 shadow-xs flex-shrink-0">
                            {idx + 1}
                          </span>
                          <div className="truncate">
                            <div className="font-bold truncate">{cp.name}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{cp.latitude.toFixed(4)}, {cp.longitude.toFixed(4)}</span>
                            </div>
                          </div>
                        </div>
                        <span className="font-bold text-slate-500 ml-2 flex-shrink-0">
                          {cp.timestamp}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Bottom Actions Sticky Footer */}
        <div className="bg-white p-4 border-t border-slate-100 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleTogglePause}
              className={`py-3 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-transform active:scale-95 shadow-sm ${
                isPaused
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {isPaused ? (
                <>
                  <Play className="w-4 h-4 fill-white text-white" />
                  <span>Tiếp tục đi (Bật GPS)</span>
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 fill-slate-700 text-slate-700" />
                  <span>Tạm dừng (Tiết kiệm pin)</span>
                </>
              )}
            </button>

            <button
              onClick={onOpenFinishModal}
              className="py-3 px-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-transform active:scale-95"
            >
              <Flag className="w-4 h-4" />
              <span>Kết Thúc & Lưu</span>
            </button>
          </div>

          <button
            onClick={handleDiscard}
            className="w-full py-2 text-center text-xs text-rose-500 hover:text-rose-700 font-semibold flex items-center justify-center gap-1 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hủy bỏ chuyến đi này</span>
          </button>
        </div>
      </div>
    </div>
  );
};
