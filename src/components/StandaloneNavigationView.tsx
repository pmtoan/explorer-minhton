import React, { useState, useEffect, useRef } from 'react';
import { ActiveTrip, TripDestination } from '../types/trip';
import { liveTripService } from '../services/liveTripService';
import { geocodingService, GeocodingPlace } from '../services/geocodingService';
import {
  navigationRoutingService,
  CalculatedRoute,
  LiveNavigationProgress,
  ManeuverIconType,
  calculateBearingDegrees,
} from '../services/navigationRoutingService';
import { WazeNavigationMap, MapLayerStyle } from './WazeNavigationMap';
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
  Layers,
  Volume2,
  VolumeX,
  Play,
  Square,
  GitFork,
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

  // Selected destination
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
  const [mapStyle, setMapStyle] = useState<MapLayerStyle>('street');
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Simulated Driving state (so user can preview Google Maps movement even when stationary)
  const [isSimulatingDrive, setIsSimulatingDrive] = useState(false);
  const [simLocation, setSimLocation] = useState<{
    latitude: number;
    longitude: number;
    speedKmh: number;
    bearingDeg: number;
  } | null>(null);
  const lastSpokenStepRef = useRef<string>('');

  const realGpsLocation = activeTrip.currentLocation || {
    latitude: 10.7769,
    longitude: 106.7009,
  };

  const effectiveLocation =
    isSimulatingDrive && simLocation
      ? { latitude: simLocation.latitude, longitude: simLocation.longitude }
      : realGpsLocation;

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

  const displaySpeedKmh =
    isSimulatingDrive && simLocation
      ? simLocation.speedKmh
      : telemetry.currentSpeedKmh;

  const allCafes = [...storageService.getCustomCafes(), ...SEED_CAFES];

  // Speak Vietnamese voice instruction (like Google Maps voice)
  const speakVietnamese = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synthesis errors on unsupported browsers
    }
  };

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
      const results = await geocodingService.searchPlaces(
        trimmed,
        realGpsLocation
      );
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
      .calculateRoute(realGpsLocation, {
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

  // Smooth Demo Drive Simulation along the Google Maps route
  useEffect(() => {
    if (
      !isSimulatingDrive ||
      !calculatedRoute ||
      calculatedRoute.coordinates.length < 2
    ) {
      setSimLocation(null);
      return;
    }

    // Interpolate dense points along route coordinates so movement is 60fps-smooth
    const densePoints: [number, number][] = [];
    const coords = calculatedRoute.coordinates;
    for (let i = 0; i < coords.length - 1; i++) {
      const [lat1, lon1] = coords[i];
      const [lat2, lon2] = coords[i + 1];
      const steps = 6;
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        densePoints.push([lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t]);
      }
    }
    densePoints.push(coords[coords.length - 1]);

    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= densePoints.length - 1) {
        setIsSimulatingDrive(false);
        speakVietnamese('Bạn đã đến điểm đích.');
        return;
      }

      const [curLat, curLon] = densePoints[idx];
      const [nextLat, nextLon] =
        densePoints[Math.min(densePoints.length - 1, idx + 2)];
      const brng = calculateBearingDegrees(curLat, curLon, nextLat, nextLon);

      setSimLocation({
        latitude: curLat,
        longitude: curLon,
        speedKmh: 38 + Math.round(Math.sin(idx * 0.3) * 6),
        bearingDeg: brng,
      });

      idx += 1;
    }, 350);

    return () => clearInterval(interval);
  }, [isSimulatingDrive, calculatedRoute]);

  const handleSelectPlace = (place: GeocodingPlace) => {
    setSelectedPlace(place);
    geocodingService.saveRecentPlace(place);
    setRecentPlaces(geocodingService.getRecentPlaces());
  };

  const handleSelectQuickCafe = async (cafe: (typeof allCafes)[0]) => {
    setIsSearching(true);
    const found = await geocodingService.searchPlaces(
      `${cafe.name} ${cafe.district}`,
      realGpsLocation
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

    const firstStep = calculatedRoute?.steps?.[0];
    if (firstStep) {
      speakVietnamese(
        `Bắt đầu dẫn đường đến ${selectedPlace.name}. ${firstStep.instruction} vào ${firstStep.roadName}`
      );
    } else {
      speakVietnamese(`Bắt đầu dẫn đường đến ${selectedPlace.name}`);
    }
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
          effectiveLocation,
          selectedPlace
        )
      : null;

  const effectiveBearing =
    isSimulatingDrive && simLocation
      ? simLocation.bearingDeg
      : liveProgress?.bearingDeg || 0;

  // Announce upcoming turn when step changes
  useEffect(() => {
    if (mode !== 'navigating' || !liveProgress) return;
    const stepKey = `${liveProgress.nextStep.instruction}-${liveProgress.nextStep.roadName}`;
    if (
      lastSpokenStepRef.current &&
      lastSpokenStepRef.current !== stepKey &&
      liveProgress.distanceToNextTurnMeters <= 300
    ) {
      speakVietnamese(
        `Sau ${liveProgress.distanceToNextTurnMeters} mét, ${liveProgress.nextStep.instruction} vào ${liveProgress.nextStep.roadName}`
      );
    }
    lastSpokenStepRef.current = stepKey;
  }, [
    mode,
    liveProgress?.nextStep.instruction,
    liveProgress?.nextStep.roadName,
  ]);

  const renderManeuverIcon = (iconType?: ManeuverIconType) => {
    switch (iconType) {
      case 'left':
      case 'slight-left':
        return <CornerUpLeft className="w-9 h-9 text-white stroke-[3]" />;
      case 'right':
      case 'slight-right':
        return <CornerUpRight className="w-9 h-9 text-white stroke-[3]" />;
      case 'uturn':
      case 'roundabout':
        return <RotateCcw className="w-9 h-9 text-white stroke-[3]" />;
      case 'arrive':
        return <Flag className="w-9 h-9 text-white stroke-[3]" />;
      default:
        return <ArrowUp className="w-9 h-9 text-white stroke-[3]" />;
    }
  };

  const secondStep =
    calculatedRoute && calculatedRoute.steps.length > 1
      ? calculatedRoute.steps[1]
      : null;

  const externalNativeMapsUrl = selectedPlace
    ? `https://www.google.com/maps/dir/?api=1&origin=${effectiveLocation.latitude},${effectiveLocation.longitude}&destination=${selectedPlace.latitude},${selectedPlace.longitude}&travelmode=two-wheeler`
    : '#';

  // ============================================================================
  // VIEW 1: DESTINATION SEARCH & ROUTE OVERVIEW SCREEN
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
            <div className="w-full h-56 rounded-3xl overflow-hidden border border-slate-800 relative">
              <WazeNavigationMap
                currentLocation={realGpsLocation}
                destination={selectedPlace || undefined}
                routeCoordinates={calculatedRoute?.coordinates}
                is3DMode={false}
                isNavigating={false}
                isFollowing={!selectedPlace}
                onMapClickSelect={handleMapClickSelect}
              />
            </div>
          </div>
        </div>

        {/* Bottom Selected Destination Confirmation Card (Google Maps "Bắt đầu" style) */}
        {selectedPlace && (
          <div className="bg-slate-900 border-t border-slate-800 p-4 space-y-3 shadow-2xl z-30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-400 uppercase">
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
                    {calculatedRoute.totalDurationMin} phút
                  </div>
                  <div className="text-[11px] font-bold text-slate-400">
                    {calculatedRoute.totalDistanceKm} km
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleStartTurnByTurn}
              disabled={isCalculatingRoute}
              className="w-full py-3.5 px-5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all active:scale-95"
            >
              <Navigation className="w-5 h-5 fill-white" />
              <span>
                {isCalculatingRoute ? 'Đang tính lộ trình...' : 'Bắt đầu'}
              </span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: GOOGLE MAPS "BẮT ĐẦU DẪN ĐƯỜNG" 3D DRIVING MODE
  // ============================================================================
  return (
    <div className="fixed inset-0 z-[100] bg-[#e5e3df] text-white flex flex-col overflow-hidden select-none">
      {/* 1. TOP GOOGLE MAPS HIGHWAY SIGN GREEN TURN BANNER (#0d652d) */}
      <div className="absolute top-3 left-3 right-3 z-[500] pointer-events-none">
        <div className="max-w-lg mx-auto">
          {/* Primary Green Highway Sign */}
          <div className="pointer-events-auto bg-[#0d652d] rounded-t-3xl rounded-br-3xl p-4 shadow-2xl border border-[#1e8e3e]/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Left Turn Arrow & Distance Column */}
              <div className="flex flex-col items-center justify-center flex-shrink-0 min-w-[56px]">
                {renderManeuverIcon(liveProgress?.nextStep.icon)}
                <span className="text-xs font-black text-white mt-1 tracking-tight">
                  {liveProgress
                    ? liveProgress.distanceToNextTurnMeters >= 1000
                      ? `${(liveProgress.distanceToNextTurnMeters / 1000).toFixed(1)} km`
                      : `${liveProgress.distanceToNextTurnMeters} m`
                    : '...'}
                </span>
              </div>

              {/* Divider */}
              <div className="h-11 w-[1.5px] bg-white/20 flex-shrink-0" />

              {/* Street Name & Action */}
              <div className="min-w-0">
                <div className="text-xs font-bold text-emerald-200 uppercase tracking-wide">
                  {liveProgress?.nextStep.instruction || 'Đi thẳng theo đường'}
                </div>
                <div className="text-xl font-black text-white leading-snug truncate">
                  {liveProgress?.nextStep.roadName || selectedPlace?.name}
                </div>
              </div>
            </div>

            {/* Demo Drive Simulation Button (for testing movement anytime) */}
            <button
              onClick={() => setIsSimulatingDrive(!isSimulatingDrive)}
              className={`px-3 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 flex-shrink-0 border transition-all active:scale-95 ${
                isSimulatingDrive
                  ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg'
                  : 'bg-[#094d22] hover:bg-[#073b1a] text-emerald-100 border-white/15'
              }`}
              title="Mô phỏng xe di chuyển trên lộ trình"
            >
              {isSimulatingDrive ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Dừng thử</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-emerald-200" />
                  <span>Chạy thử</span>
                </>
              )}
            </button>
          </div>

          {/* Attached Secondary "Tiếp theo" Sign Pill (Signature Google Maps Sub-banner) */}
          {secondStep && (
            <div className="pointer-events-auto inline-flex items-center gap-2 bg-[#094d22] text-white px-4 py-1.5 rounded-b-2xl shadow-lg border-x border-b border-[#1e8e3e]/30 text-xs font-bold">
              <span className="text-emerald-200">Tiếp theo:</span>
              <span className="font-extrabold text-white truncate max-w-[200px]">
                {secondStep.instruction} ({secondStep.roadName})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. FULLSCREEN 3D HEADING-UP GOOGLE MAPS DRIVING VIEWPORT */}
      <div className="flex-1 w-full h-full relative">
        <WazeNavigationMap
          currentLocation={effectiveLocation}
          destination={selectedPlace || undefined}
          routeCoordinates={calculatedRoute?.coordinates}
          traveledPoints={activeTrip.route.points}
          bearingDeg={effectiveBearing}
          is3DMode={is3DMode}
          isFollowing={isFollowingVehicle}
          isNavigating={true}
          mapStyle={mapStyle}
          onUserDragMap={() => setIsFollowingVehicle(false)}
        />
      </div>

      {/* 3. LEFT FLOATING GOOGLE MAPS SPEEDOMETER & RE-CENTER PILL */}
      <div className="absolute bottom-28 left-4 z-[500] flex flex-col items-start gap-2.5">
        {!isFollowingVehicle && (
          <button
            onClick={() => setIsFollowingVehicle(true)}
            className="px-4 py-2.5 rounded-full bg-white text-[#1a73e8] font-extrabold text-xs shadow-2xl border border-slate-200 flex items-center gap-2 animate-bounce"
          >
            <LocateFixed className="w-4 h-4 text-[#1a73e8]" />
            <span>Định vị lại</span>
          </button>
        )}

        {/* Speedometer Circle (Google Maps clean white/dark badge) */}
        <div className="flex items-center gap-2">
          <div
            className={`w-16 h-16 rounded-full bg-white text-slate-900 shadow-2xl border-4 flex flex-col items-center justify-center ${
              displaySpeedKmh >= 60 ? 'border-rose-500' : 'border-[#1a73e8]'
            }`}
          >
            <span className="text-xl font-black leading-none tracking-tight">
              {Math.round(displaySpeedKmh)}
            </span>
            <span className="text-[10px] font-bold text-slate-500 mt-0.5">
              km/h
            </span>
          </div>

          {/* Live Trip Odometer Pill */}
          <div className="bg-slate-900/90 backdrop-blur-md text-white px-3 py-2 rounded-2xl shadow-xl border border-slate-700/80">
            <div className="text-[10px] font-bold text-slate-400 uppercase">
              Đã đi được
            </div>
            <div className="text-sm font-black text-emerald-400">
              {activeTrip.distanceKm.toFixed(2)} km
            </div>
          </div>
        </div>
      </div>

      {/* 4. RIGHT FLOATING GOOGLE MAPS CIRCULAR ACTION PILLS */}
      <div className="absolute right-4 top-36 z-[500] flex flex-col gap-2.5">
        {/* Voice Guidance Mute/Unmute */}
        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          className="w-12 h-12 rounded-full bg-white text-slate-800 shadow-xl border border-slate-200 flex items-center justify-center transition-transform active:scale-90"
          title={voiceEnabled ? 'Tắt giọng nói chỉ đường' : 'Bật giọng nói chỉ đường'}
        >
          {voiceEnabled ? (
            <Volume2 className="w-5 h-5 text-[#1a73e8]" />
          ) : (
            <VolumeX className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {/* Compass / 3D Heading-Up vs 2D North-Up */}
        <button
          onClick={() => setIs3DMode(!is3DMode)}
          className="w-12 h-12 rounded-full bg-white text-slate-800 shadow-xl border border-slate-200 flex flex-col items-center justify-center transition-transform active:scale-90"
          title="Đổi góc nhìn 3D xoay theo hướng chạy / 2D toàn cảnh"
        >
          <Compass
            className={`w-5 h-5 ${
              is3DMode ? 'text-[#ea4335]' : 'text-slate-600'
            }`}
            style={{
              transform: is3DMode ? `rotate(${-effectiveBearing}deg)` : 'none',
            }}
          />
          <span className="text-[9px] font-black text-slate-600 leading-none mt-0.5">
            {is3DMode ? '3D' : '2D'}
          </span>
        </button>

        {/* Satellite / Street Map Layer Toggle */}
        <button
          onClick={() =>
            setMapStyle(mapStyle === 'street' ? 'satellite' : 'street')
          }
          className={`w-12 h-12 rounded-full shadow-xl border flex items-center justify-center transition-transform active:scale-90 ${
            mapStyle === 'satellite'
              ? 'bg-[#1a73e8] text-white border-blue-400'
              : 'bg-white text-slate-800 border-slate-200'
          }`}
          title="Chuyển đổi Bản đồ / Vệ tinh"
        >
          <Layers className="w-5 h-5" />
        </button>

        {/* Open Native Google Maps App */}
        <a
          href={externalNativeMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-12 h-12 rounded-full bg-white text-[#1a73e8] shadow-xl border border-slate-200 flex items-center justify-center transition-transform active:scale-90"
          title="Mở trong ứng dụng Google Maps"
        >
          <ExternalLink className="w-5 h-5" />
        </a>
      </div>

      {/* 5. BOTTOM GOOGLE MAPS DRIVING FOOTER BAR */}
      <div className="bg-white text-slate-900 rounded-t-3xl px-4 py-3.5 pb-5 z-[500] shadow-[0_-8px_30px_rgba(0,0,0,0.18)] border-t border-slate-200">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          {/* Left: Exit Navigation (X) Button */}
          <button
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center flex-shrink-0 transition-colors active:scale-95"
            title="Thoát màn hình dẫn đường"
          >
            <X className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* Center: Big Green Minutes + Distance & ETA */}
          <div className="text-center flex-1 min-w-0">
            <div className="text-2xl font-black text-[#188038] leading-tight">
              {liveProgress?.remainingDurationMin ??
                calculatedRoute?.totalDurationMin ??
                1}{' '}
              phút
            </div>
            <div className="text-xs font-bold text-slate-500 truncate mt-0.5">
              {liveProgress?.remainingDistanceKm ??
                calculatedRoute?.totalDistanceKm ??
                0}{' '}
              km • Dự kiến đến{' '}
              {liveProgress?.etaText || calculatedRoute?.etaText || '--:--'}
            </div>
          </div>

          {/* Right: Route Overview / Change Destination Button */}
          <button
            onClick={() => {
              setIsSimulatingDrive(false);
              setMode('search');
            }}
            className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center flex-shrink-0 transition-colors active:scale-95"
            title="Đổi điểm đến / Xem toàn tuyến"
          >
            <GitFork className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>
      </div>
    </div>
  );
};
