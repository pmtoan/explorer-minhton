import React, { useState } from 'react';
import { ActiveTrip, TripDestination } from '../types/trip';
import { liveTripService } from '../services/liveTripService';
import { SEED_CAFES } from '../data/seedCafes';
import { storageService } from '../services/storageService';
import {
  Navigation,
  Compass,
  Gauge,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Zap,
} from 'lucide-react';

interface LiveNavigationCockpitProps {
  activeTrip: ActiveTrip;
  onClose?: () => void;
}

export const LiveNavigationCockpit: React.FC<LiveNavigationCockpitProps> = ({
  activeTrip,
  onClose,
}) => {
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const [customDestinationInput, setCustomDestinationInput] = useState('');

  const telemetry = activeTrip.telemetry || {
    currentSpeedKmh: 0,
    maxSpeedKmh: 0,
    averageSpeedKmh: 0,
    movingDurationMs: 0,
    stationaryDurationMs: 0,
    isAutoPaused: false,
    autoPauseEnabled: true,
    kalmanFiltered: true,
  };

  const allCafes = [...storageService.getCustomCafes(), ...SEED_CAFES];

  const handleSelectCafeDestination = (cafe: (typeof allCafes)[0]) => {
    const destination: TripDestination = {
      name: cafe.name,
      address: cafe.address,
    };
    liveTripService.setDestination(destination);
    setShowDestinationPicker(false);
  };

  const handleSetCustomDestination = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDestinationInput.trim()) return;

    const destination: TripDestination = {
      name: customDestinationInput.trim(),
      address: customDestinationInput.trim(),
    };
    liveTripService.setDestination(destination);
    setCustomDestinationInput('');
    setShowDestinationPicker(false);
  };

  const handleClearDestination = () => {
    liveTripService.setDestination(undefined);
  };

  // Google Maps embed URL
  const originCoord = activeTrip.currentLocation
    ? `${activeTrip.currentLocation.latitude},${activeTrip.currentLocation.longitude}`
    : '10.7769,106.7009';

  const destinationQuery = activeTrip.destination
    ? encodeURIComponent(activeTrip.destination.address || activeTrip.destination.name)
    : encodeURIComponent('Vũng Tàu, Bà Rịa - Vũng Tàu');

  const embedUrl = `https://maps.google.com/maps?saddr=${originCoord}&daddr=${destinationQuery}&hl=vi&output=embed`;

  const externalNativeMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originCoord}&destination=${destinationQuery}&travelmode=two-wheeler`;

  const movingMinutes = Math.floor(telemetry.movingDurationMs / 60000);
  const movingSeconds = Math.floor((telemetry.movingDurationMs % 60000) / 1000);

  return (
    <div className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl text-white space-y-0">
      {/* 1. TOP TELEMETRY HUD (SPEEDOMETER & REAL-TIME ODOMETER) */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              <span>Dẫn đường & Tốc độ</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Auto-Pause Toggle Pill */}
            <button
              onClick={() => liveTripService.toggleAutoPause(!telemetry.autoPauseEnabled)}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all ${
                telemetry.autoPauseEnabled
                  ? telemetry.isAutoPaused
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
              title="Tự động tạm dừng GPS khi dừng đèn đỏ hoặc nghỉ chân để chống nóng máy"
            >
              <span>{telemetry.isAutoPaused ? '⏸️ Auto-Paused' : '⚡ Auto-Pause'}</span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Real-Time Dual Gauges: Speedometer + Live Odometer */}
        <div className="grid grid-cols-2 gap-3">
          {/* Gauge 1: Real-Time Speed (km/h) */}
          <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700/60 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tốc độ</span>
              </span>
              <span className="text-[10px] text-slate-500">
                Max: {telemetry.maxSpeedKmh.toFixed(0)}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-emerald-400 tracking-tight font-mono">
                {telemetry.currentSpeedKmh.toFixed(0)}
              </span>
              <span className="text-xs font-bold text-slate-400">km/h</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
              <span>TB: {telemetry.averageSpeedKmh.toFixed(1)} km/h</span>
              <span className="text-emerald-400/80 font-medium text-[9px]">GPS mượt</span>
            </div>
          </div>

          {/* Gauge 2: Real-Time Odometer (km with 2 decimal precision) */}
          <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700/60 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-blue-400" />
                <span>Quãng đường</span>
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-blue-400 tracking-tight font-mono">
                {activeTrip.distanceKm.toFixed(2)}
              </span>
              <span className="text-xs font-bold text-slate-400">km</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
              <span>
                Thời gian:{' '}
                <b>
                  {movingMinutes}p {movingSeconds}s
                </b>
              </span>
              <span>
                <b>{activeTrip.route.checkpoints.length}</b> mốc
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TARGET DESTINATION BAR & SELECTOR */}
      <div className="p-3 bg-slate-850 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <MapPin className="w-3 h-3 text-rose-400" />
            <span>Điểm đến:</span>
          </div>
          <div className="text-xs font-extrabold text-white truncate mt-0.5">
            {activeTrip.destination ? activeTrip.destination.name : 'Chưa chọn điểm đến'}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {activeTrip.destination ? (
            <button
              onClick={handleClearDestination}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-rose-400 text-xs font-bold"
              title="Xóa điểm đến"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}

          <button
            onClick={() => setShowDestinationPicker(!showDestinationPicker)}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-transform active:scale-95"
          >
            <span>{activeTrip.destination ? 'Đổi điểm đến' : '+ Chọn điểm đến'}</span>
            {showDestinationPicker ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* 3. DESTINATION PICKER DROPDOWN */}
      {showDestinationPicker && (
        <div className="p-3 bg-slate-800/90 border-b border-slate-700 space-y-2.5 animate-in fade-in">
          {/* Custom Search Input */}
          <form onSubmit={handleSetCustomDestination} className="flex gap-1.5">
            <input
              type="text"
              value={customDestinationInput}
              onChange={(e) => setCustomDestinationInput(e.target.value)}
              placeholder="Tìm địa chỉ, địa danh, quán cafe..."
              className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs whitespace-nowrap"
            >
              Dẫn đường
            </button>
          </form>

          {/* Quick Cafe Suggestions */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Gợi ý quán cafe & quán ruột:
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
              {allCafes.slice(0, 8).map((cafe) => (
                <button
                  key={cafe.id}
                  onClick={() => handleSelectCafeDestination(cafe)}
                  className="w-full text-left p-2 rounded-xl bg-slate-900/70 hover:bg-slate-700/70 text-xs flex items-center justify-between gap-2 transition-colors border border-slate-800"
                >
                  <div className="truncate">
                    <span className="font-bold text-white block truncate">{cafe.name}</span>
                    <span className="text-[10px] text-slate-400 block truncate">{cafe.address}</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-400 flex-shrink-0">
                    ★ {cafe.rating}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. EMBEDDED GOOGLE MAPS NAVIGATION VIEW */}
      <div className="relative w-full h-[320px] bg-slate-950">
        <iframe
          title="Google Maps Navigation View"
          src={embedUrl}
          className="w-full h-full border-0 filter contrast-[1.05]"
          loading="lazy"
          allowFullScreen
        />

        {/* Floating Quick Action: Open in Native Google Maps */}
        <div className="absolute bottom-3 right-3 z-10">
          <a
            href={externalNativeMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-transform active:scale-95"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Mở Google Maps</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
          </a>
        </div>
      </div>
    </div>
  );
};
