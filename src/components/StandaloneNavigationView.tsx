import React, { useState, useEffect } from 'react';
import { ActiveTrip, TripDestination } from '../types/trip';
import { liveTripService } from '../services/liveTripService';
import { geocodingService, GeocodingPlace } from '../services/geocodingService';
import {
  navigationRoutingService,
  CalculatedRoute,
  LiveNavigationProgress,
  ManeuverIconType,
} from '../services/navigationRoutingService';
import { WazeNavigationMap } from './WazeNavigationMap';
import { SEED_CAFES } from '../data/seedCafes';
import { storageService } from '../services/storageService';
import {
  ArrowLeft,
  Search,
  X,
  MapPin,
  Navigation,
  Compass,
  Clock,
  Coffee,
  ExternalLink,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  RotateCcw,
  Flag,
  Loader2,
  LocateFixed,
} from 'lucide-react';

interface StandaloneNavigationViewProps {
  activeTrip: ActiveTrip;
  onClose: () => void;
}

const DISTRICT_FALLBACK_COORDS: Record<string, { lat: number; lon: number }> = {
  'Quận 1': { lat: 10.7756, lon: 106.7004 },
  'Quận 3': { lat: 10.7843, lon: 106.6844 },
  'Bình Thạnh': { lat: 10.8106, lon: 106.7091 },
  'TP. Thủ Đức': { lat: 10.8022, lon: 106.7418 },
  'Phú Nhuận': { lat: 10.7992, lon: 106.6803 },
};

export const StandaloneNavigationView: React.FC<StandaloneNavigationViewProps> = ({
  activeTrip,
  onClose,
}) => {
  // Determine initial mode: if destination already has lat/lon, allow immediate navigation or search
  const hasSavedDestination = Boolean(
    activeTrip.destination?.latitude && activeTrip.destination?.longitude
  );

  const [mode, setMode] = useState<'search' | 'navigating'>(
    hasSavedDestination ? 'navigating' : 'search'
  );

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodingPlace[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<GeocodingPlace[]>(
    geocodingService.getRecentPlaces()
  );

  // Selected candidate before pressing "Bắt đầu dẫn đường"
  const [selectedPlace, setSelectedPlace] = useState<GeocodingPlace | null>(
    activeTrip.destination &&
      activeTrip.destination.latitude &&
      activeTrip.destination.longitude
      ? {
          id: 'active-dest',
          name: activeTrip.destination.name,
          address: activeTrip.destination.address,
          latitude: activeTrip.destination.latitude,
          longitude: activeTrip.destination.longitude,
        }
      : null
  );

  // Route & Navigation state
  const [calculatedRoute, setCalculatedRoute] = useState<CalculatedRoute | null>(
    null
  );
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [is3DMode, setIs3DMode] = useState(true);
  const [isFollowingVehicle, setIsFollowingVehicle] = useState(true);

  const currentLocation = activeTrip.currentLocation || {
    latitude: 10.7769,
    longitude: 106.7009,
  };

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

  // Debounced live API search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const results = await geocodingService.searchPlaces(trimmed, currentLocation);
      setSearchResults(results);
      setIsSearching(false);
    }, 320);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Calculate route whenever selectedPlace changes
  useEffect(() => {
    if (!selectedPlace) {
      setCalculatedRoute(null);
      return;
    }

    let cancelled = false;
    setIsCalculatingRoute(true);

    navigationRoutingService
      .calculateRoute(currentLocation, {
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
        name: selectedPlace.name,
      })
      .then((route) => {
        if (!cancelled) {
          setCalculatedRoute(route);
          setIsCalculatingRoute(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPlace?.latitude, selectedPlace?.longitude]);

  const handleSelectPlace = (place: GeocodingPlace) => {
    setSelectedPlace(place);
    geocodingService.saveRecentPlace(place);
    setRecentPlaces(geocodingService.getRecentPlaces());
  };

  const handleSelectQuickCafe = async (cafe: (typeof allCafes)[0]) => {
    setIsSearching(true);
    const found = await geocodingService.searchPlaces(
      `${cafe.name} ${cafe.district}`,
      currentLocation
    );
    setIsSearching(false);

    if (found.length > 0) {
      handleSelectPlace({
        ...found[0],
        name: cafe.name,
        address: cafe.address,
      });
    } else {
      const fallback = DISTRICT_FALLBACK_COORDS[cafe.district] || {
        lat: 10.7825,
        lon: 106.6952,
      };
      handleSelectPlace({
        id: cafe.id,
        name: cafe.name,
        address: cafe.address,
        latitude: fallback.lat,
        longitude: fallback.lon,
      });
    }
  };

  const handleStartTurnByTurn = () => {
    if (!selectedPlace) return;

    const destination: TripDestination = {
      name: selectedPlace.name,
      address: selectedPlace.address,
      latitude: selectedPlace.latitude,
      longitude: selectedPlace.longitude,
    };
    liveTripService.setDestination(destination);
    setIsFollowingVehicle(true);
    setIs3DMode(true);
    setMode('navigating');
  };

  const handleMapClickSelect = (lat: number, lon: number) => {
    if (mode !== 'search') return;
    setSelectedPlace({
      id: `pin-${lat.toFixed(4)}`,
      name: 'Điểm ghim trên bản đồ',
      address: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      latitude: lat,
      longitude: lon,
    });
  };

  // Compute live navigation progress
  const liveProgress: LiveNavigationProgress | null =
    calculatedRoute && selectedPlace
      ? navigationRoutingService.getLiveProgress(
          calculatedRoute,
          currentLocation,
          selectedPlace
        )
      : null;

  const renderManeuverIcon = (iconType?: ManeuverIconType) => {
    switch (iconType) {
      case 'left':
      case 'slight-left':
        return <CornerUpLeft className="w-8 h-8 text-white stroke-[2.75]" />;
      case 'right':
      case 'slight-right':
        return <CornerUpRight className="w-8 h-8 text-white stroke-[2.75]" />;
      case 'uturn':
      case 'roundabout':
        return <RotateCcw className="w-8 h-8 text-white stroke-[2.75]" />;
      case 'arrive':
        return <Flag className="w-8 h-8 text-emerald-300 stroke-[2.75]" />;
      default:
        return <ArrowUp className="w-8 h-8 text-white stroke-[2.75]" />;
    }
  };

  const externalNativeMapsUrl = selectedPlace
    ? `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.latitude},${currentLocation.longitude}&destination=${selectedPlace.latitude},${selectedPlace.longitude}&travelmode=two-wheeler`
    : '#';

  // ============================================================================
  // VIEW 1: DESTINATION SEARCH & PICKER SCREEN
  // ============================================================================
  if (mode === 'search') {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col overflow-hidden animate-in fade-in">
        {/* Top Header & Live Search Input */}
        <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 p-3.5 space-y-3 z-20">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
              <span>Quay lại chuyến đi</span>
            </button>

            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Đã đi: {activeTrip.distanceKm.toFixed(2)} km</span>
            </div>
          </div>

          {/* Search Input Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nhập địa chỉ, tên đường, quán cafe, điểm đến..."
              autoFocus
              className="w-full pl-10 pr-10 py-3 rounded-2xl bg-slate-950 border border-slate-700 focus:border-emerald-500 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            {isSearching ? (
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
            ) : searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-white absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Search Results or Quick Suggestions */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          {/* A. Live API Search Results */}
          {searchQuery.trim().length >= 2 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 px-1 flex items-center justify-between">
                <span>Kết quả tìm kiếm thực tế</span>
                {searchResults.length > 0 && (
                  <span>{searchResults.length} địa điểm</span>
                )}
              </div>

              {searchResults.length === 0 && !isSearching ? (
                <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 text-center text-xs text-slate-400">
                  Không tìm thấy địa điểm khớp với "{searchQuery}". Bạn có thể thử từ khóa ngắn gọn hơn.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {searchResults.map((place) => {
                    const isSelected = selectedPlace?.id === place.id;
                    return (
                      <button
                        key={place.id}
                        onClick={() => handleSelectPlace(place)}
                        className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-emerald-950/60 border-emerald-500 shadow-md'
                            : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-white truncate">
                              {place.name}
                            </div>
                            <div className="text-xs text-slate-400 truncate mt-0.5">
                              {place.address}
                            </div>
                          </div>
                        </div>

                        {place.distanceKm !== undefined && (
                          <span className="text-xs font-extrabold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-xl flex-shrink-0 border border-emerald-500/20">
                            {place.distanceKm} km
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* B. Recent Searches & Saved Cafes when not typing */}
          {searchQuery.trim().length < 2 && (
            <>
              {recentPlaces.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Điểm đến gần đây</span>
                  </div>
                  <div className="space-y-1.5">
                    {recentPlaces.map((place) => (
                      <button
                        key={place.id}
                        onClick={() => handleSelectPlace(place)}
                        className={`w-full text-left p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          selectedPlace?.name === place.name
                            ? 'bg-emerald-950/60 border-emerald-500'
                            : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800/90'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-white truncate">
                            {place.name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {place.address}
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-400 flex-shrink-0">
                          Chọn →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Cafe Shortcuts */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5 text-amber-400" />
                  <span>Gợi ý quán cafe ruột</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {allCafes.slice(0, 5).map((cafe) => (
                    <button
                      key={cafe.id}
                      onClick={() => handleSelectQuickCafe(cafe)}
                      className="w-full text-left p-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-white truncate">
                          {cafe.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {cafe.address}
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded-lg flex-shrink-0">
                        ★ {cafe.rating}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Interactive Map Preview */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Xem trước lộ trình (Chạm bản đồ để ghim đích)
            </div>
            <div className="w-full h-52 rounded-3xl overflow-hidden border border-slate-800 relative">
              <WazeNavigationMap
                currentLocation={currentLocation}
                destination={selectedPlace || undefined}
                routeCoordinates={calculatedRoute?.coordinates}
                is3DMode={false}
                isFollowing={!selectedPlace}
                onMapClickSelect={handleMapClickSelect}
              />
            </div>
          </div>
        </div>

        {/* Bottom Selected Destination Confirmation Card */}
        {selectedPlace && (
          <div className="bg-slate-900 border-t border-slate-800 p-4 space-y-3 shadow-2xl z-30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 uppercase">
                  <Flag className="w-3.5 h-3.5" />
                  <span>Điểm đến đã chọn</span>
                </div>
                <h3 className="font-black text-base text-white truncate mt-0.5">
                  {selectedPlace.name}
                </h3>
                <p className="text-xs text-slate-400 truncate">
                  {selectedPlace.address}
                </p>
              </div>

              {calculatedRoute && (
                <div className="text-right flex-shrink-0 bg-slate-950 px-3 py-1.5 rounded-2xl border border-slate-800">
                  <div className="text-sm font-black text-emerald-400">
                    {calculatedRoute.totalDistanceKm} km
                  </div>
                  <div className="text-[11px] font-bold text-slate-400">
                    ~{calculatedRoute.totalDurationMin} phút
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleStartTurnByTurn}
              disabled={isCalculatingRoute}
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all active:scale-95"
            >
              <Navigation className="w-5 h-5 fill-white" />
              <span>
                {isCalculatingRoute ? 'Đang tính lộ trình...' : 'Bắt đầu dẫn đường'}
              </span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: WAZE 2.5D TURN-BY-TURN NAVIGATION COCKPIT
  // ============================================================================
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col overflow-hidden select-none">
      {/* 1. TOP FLOATING WAZE TURN-BY-TURN BANNER */}
      <div className="absolute top-3 left-3 right-3 z-[500] space-y-2 pointer-events-none">
        {/* Main Emerald Turn Card */}
        <div className="pointer-events-auto bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 rounded-3xl p-3.5 shadow-2xl border border-emerald-300/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Turn Direction Box */}
            <div className="w-14 h-14 rounded-2xl bg-slate-950/30 backdrop-blur-md flex items-center justify-center border border-white/25 flex-shrink-0 shadow-inner">
              {renderManeuverIcon(liveProgress?.nextStep.icon)}
            </div>

            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black tracking-tight text-white">
                  {liveProgress
                    ? liveProgress.distanceToNextTurnMeters >= 1000
                      ? `${(liveProgress.distanceToNextTurnMeters / 1000).toFixed(1)} km`
                      : `${liveProgress.distanceToNextTurnMeters} m`
                    : '...'}
                </span>
                <span className="text-xs font-extrabold uppercase tracking-wider bg-black/25 px-2 py-0.5 rounded-lg text-emerald-100">
                  {liveProgress?.nextStep.instruction || 'Đi thẳng'}
                </span>
              </div>
              <div className="text-sm font-bold text-emerald-50 truncate mt-0.5">
                {liveProgress?.nextStep.roadName || selectedPlace?.name}
              </div>
            </div>
          </div>

          {/* Change Destination Button */}
          <button
            onClick={() => setMode('search')}
            className="px-3 py-2 rounded-2xl bg-slate-950/35 hover:bg-slate-950/55 text-white text-xs font-bold border border-white/20 flex items-center gap-1 flex-shrink-0 transition-colors"
            title="Đổi điểm đến"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Đổi đích</span>
          </button>
        </div>

        {/* Sub-Banner: Back Button + Odometer + GPS Status */}
        <div className="flex items-center justify-between gap-2 px-1">
          <button
            onClick={onClose}
            className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold text-slate-200 shadow-lg hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
            <span>Quay lại</span>
          </button>

          <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3.5 py-1.5 rounded-full flex items-center gap-2 text-xs font-extrabold text-emerald-400 shadow-lg">
            <span>Đã đi: {activeTrip.distanceKm.toFixed(2)} km</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300">
              GPS {activeTrip.accuracyMeters ? `±${activeTrip.accuracyMeters}m` : 'Chuẩn'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. FULLSCREEN INTERACTIVE 2.5D VECTOR MAP */}
      <div className="flex-1 w-full h-full relative">
        <WazeNavigationMap
          currentLocation={currentLocation}
          destination={selectedPlace || undefined}
          routeCoordinates={calculatedRoute?.coordinates}
          traveledPoints={activeTrip.route.points}
          bearingDeg={liveProgress?.bearingDeg || 0}
          is3DMode={is3DMode}
          isFollowing={isFollowingVehicle}
          onUserDragMap={() => setIsFollowingVehicle(false)}
        />
      </div>

      {/* 3. LEFT FLOATING SPEEDOMETER CIRCLE */}
      <div className="absolute bottom-28 left-4 z-[500] flex flex-col items-center gap-1.5 pointer-events-none">
        <div
          className={`w-20 h-20 rounded-full bg-slate-900/95 backdrop-blur-md border-4 shadow-2xl flex flex-col items-center justify-center transition-colors ${
            telemetry.isAutoPaused
              ? 'border-amber-500'
              : telemetry.currentSpeedKmh >= 60
              ? 'border-rose-500'
              : 'border-emerald-500'
          }`}
        >
          <span className="text-2xl font-black text-white leading-none tracking-tighter">
            {Math.round(telemetry.currentSpeedKmh)}
          </span>
          <span className="text-[10px] font-extrabold text-slate-400 uppercase mt-0.5">
            km/h
          </span>
        </div>

        <div className="bg-slate-900/90 backdrop-blur px-2.5 py-0.5 rounded-full border border-slate-800 text-[10px] font-bold text-slate-300 shadow">
          {telemetry.isAutoPaused
            ? '⏸ Tự dừng'
            : `TB: ${telemetry.averageSpeedKmh.toFixed(0)} km/h`}
        </div>
      </div>

      {/* 4. RIGHT FLOATING MAP CONTROLS (RECENTER & 2D/3D) */}
      <div className="absolute bottom-28 right-4 z-[500] flex flex-col gap-2.5">
        <button
          onClick={() => setIsFollowingVehicle(true)}
          className={`w-11 h-11 rounded-2xl backdrop-blur-md border shadow-xl flex items-center justify-center transition-all active:scale-90 ${
            isFollowingVehicle
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400'
              : 'bg-slate-900/95 border-slate-700 text-white animate-bounce'
          }`}
          title="Tái định vị theo xe"
        >
          <LocateFixed className="w-5 h-5" />
        </button>

        <button
          onClick={() => setIs3DMode(!is3DMode)}
          className="w-11 h-11 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-xl flex items-center justify-center text-xs font-black text-emerald-400 transition-all active:scale-90"
          title="Đổi góc nhìn 2D/3D"
        >
          {is3DMode ? '3D' : '2D'}
        </button>
      </div>

      {/* 5. BOTTOM WAZE ETA & TRIP PROGRESS HUD */}
      <div className="bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-4 py-3.5 pb-5 z-[500] shadow-2xl">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          {/* ETA, Remaining Time & Distance */}
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Dự kiến đến
              </div>
              <div className="text-xl font-black text-emerald-400 leading-tight">
                {liveProgress?.etaText || calculatedRoute?.etaText || '--:--'}
              </div>
            </div>

            <div className="h-7 w-[1px] bg-slate-800" />

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Còn lại
              </div>
              <div className="text-sm font-extrabold text-white leading-tight">
                {liveProgress?.remainingDurationMin ??
                  calculatedRoute?.totalDurationMin ??
                  0}{' '}
                phút{' '}
                <span className="text-slate-400 font-semibold">
                  ({liveProgress?.remainingDistanceKm ??
                    calculatedRoute?.totalDistanceKm ??
                    0}{' '}
                  km)
                </span>
              </div>
            </div>
          </div>

          {/* Native Google Maps Voice Fallback Button */}
          <a
            href={externalNativeMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-transform active:scale-95 flex-shrink-0"
          >
            <Compass className="w-4 h-4" />
            <span>Mở Google Maps</span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </a>
        </div>
      </div>
    </div>
  );
};
