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

  // Mode 1: 'overview' (Xem toàn cảnh, tìm kiếm, zoom/pan tự do)
  // Mode 2: 'navigating' (Chế độ dẫn đường 3D bám theo xe như Google Maps)
  const [mode, setMode] = useState<'overview' | 'navigating'>('overview');

  // Search panel open/collapsed state in Overview mode
  const [isSearchDrawerOpen, setIsSearchDrawerOpen] = useState(
    !hasSavedDestination
  );
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
  const [mapStyle, setMapStyle] = useState<MapLayerStyle>('vector3d');
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Demo Drive Simulation state
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

  const speakVietnamese = (text: string) => {
    if (
      !voiceEnabled ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synthesis errors
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

  // Smooth Demo Drive Simulation along the route
  useEffect(() => {
    if (
      !isSimulatingDrive ||
      !calculatedRoute ||
      calculatedRoute.coordinates.length < 2
    ) {
      setSimLocation(null);
      return;
    }

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
    setIsSearchDrawerOpen(false);
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
    setIsSearchDrawerOpen(false);
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
    if (mode !== 'overview') return;
    setSelectedPlace({
      id: `pin-${lat.toFixed(4)}`,
      name: 'Điểm ghim trên bản đồ',
      address: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      latitude: lat,
      longitude: lon,
    });
    setIsSearchDrawerOpen(false);
  };

  const cycleMapStyle = () => {
    if (mapStyle === 'vector3d') setMapStyle('street');
    else if (mapStyle === 'street') setMapStyle('satellite');
    else setMapStyle('vector3d');
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

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-900 flex flex-col overflow-hidden select-none">
      {/* ==========================================================================
          PERSISTENT FULLSCREEN WEBGL 3D MAP (SHARED ACROSS OVERVIEW & DRIVING MODES)
         ========================================================================== */}
      <div className="absolute inset-0 w-full h-full">
        <WazeNavigationMap
          currentLocation={effectiveLocation}
          destination={selectedPlace || undefined}
          routeCoordinates={calculatedRoute?.coordinates}
          traveledPoints={activeTrip.route.points}
          bearingDeg={effectiveBearing}
          is3DMode={is3DMode}
          isFollowing={mode === 'navigating' ? isFollowingVehicle : false}
          isNavigating={mode === 'navigating'}
          mapStyle={mapStyle}
          onUserDragMap={() => {
            if (mode === 'navigating') {
              setIsFollowingVehicle(false);
            }
          }}
          onMapClickSelect={handleMapClickSelect}
        />
      </div>

      {/* ==========================================================================
          MODE 1: OVERVIEW & DESTINATION SEARCH OVERLAY (XEM TOÀN CẢNH & TÌM ĐÍCH)
         ========================================================================== */}
      {mode === 'overview' && (
        <>
          {/* Top Floating Search Bar & Collapsible Suggestions Drawer */}
          <div className="relative z-[500] p-3 max-w-lg w-full mx-auto space-y-2 pointer-events-none">
            <div className="pointer-events-auto bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/90 p-3 space-y-2.5">
              {/* Top Row: Back button + Odometer + Map Style Switcher */}
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-emerald-600" />
                  <span>Quay lại</span>
                </button>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>Đã đi: {activeTrip.distanceKm.toFixed(2)} km</span>
                  </div>

                  <button
                    onClick={cycleMapStyle}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 border border-slate-200"
                    title="Đổi lớp bản đồ"
                  >
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      {mapStyle === 'vector3d'
                        ? '3D Tự nhiên'
                        : mapStyle === 'street'
                        ? 'GG Đường phố'
                        : 'GG Vệ tinh'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Search Input Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => setIsSearchDrawerOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchDrawerOpen(true);
                  }}
                  placeholder="Tìm địa chỉ, tên đường, quán cafe hoặc chạm bản đồ..."
                  className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-100 border border-slate-200 focus:bg-white focus:border-blue-500 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {isSearching ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                ) : searchQuery ? (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setIsSearchDrawerOpen(true);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : isSearchDrawerOpen && selectedPlace ? (
                  <button
                    onClick={() => setIsSearchDrawerOpen(false)}
                    className="text-[11px] font-bold text-blue-600 px-2 py-1 absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    Ẩn
                  </button>
                ) : null}
              </div>
            </div>

            {/* Collapsible Search Results & Quick Cafe Drawer */}
            {isSearchDrawerOpen && (
              <div className="pointer-events-auto bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200 max-h-[52vh] overflow-y-auto p-3 space-y-3 animate-in fade-in">
                {searchQuery.trim().length >= 2 ? (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 px-1 flex items-center justify-between">
                      <span>Kết quả địa điểm thực tế</span>
                      {searchResults.length > 0 && (
                        <span>{searchResults.length} kết quả</span>
                      )}
                    </div>

                    {searchResults.length === 0 && !isSearching ? (
                      <div className="p-3 rounded-2xl bg-slate-50 text-center text-xs text-slate-500">
                        Không tìm thấy "{searchQuery}". Hãy thử từ khóa khác hoặc chạm trực tiếp lên bản đồ.
                      </div>
                    ) : (
                      searchResults.map((place) => (
                        <button
                          key={place.id}
                          onClick={() => handleSelectPlace(place)}
                          className="w-full text-left p-2.5 rounded-2xl hover:bg-blue-50/80 border border-slate-100 transition-all flex items-center justify-between gap-2.5"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-slate-900 truncate">
                                {place.name}
                              </div>
                              <div className="text-xs text-slate-500 truncate">
                                {place.address}
                              </div>
                            </div>
                          </div>

                          {place.distanceKm !== undefined && (
                            <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl flex-shrink-0">
                              {place.distanceKm} km
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  <>
                    {recentPlaces.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                          <span>Điểm đến gần đây</span>
                        </div>
                        {recentPlaces.slice(0, 3).map((place) => (
                          <button
                            key={place.id}
                            onClick={() => handleSelectPlace(place)}
                            className="w-full text-left p-2.5 rounded-2xl hover:bg-slate-100 border border-slate-100 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-slate-800 truncate">
                                {place.name}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {place.address}
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-blue-600 flex-shrink-0">
                              Xem lộ trình →
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 flex items-center gap-1.5">
                        <Coffee className="w-3.5 h-3.5 text-amber-500" />
                        <span>Gợi ý quán cafe ruột</span>
                      </div>
                      {allCafes.slice(0, 4).map((cafe) => (
                        <button
                          key={cafe.id}
                          onClick={() => handleSelectQuickCafe(cafe)}
                          className="w-full text-left p-2.5 rounded-2xl hover:bg-slate-100 border border-slate-100 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-slate-800 truncate">
                              {cafe.name}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {cafe.address}
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg flex-shrink-0">
                            ★ {cafe.rating}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Bottom Route Preview & "Bắt đầu" Card in Overview Mode */}
          {selectedPlace && (
            <div className="mt-auto relative z-[500] p-3 max-w-lg w-full mx-auto">
              <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-4 shadow-2xl border border-slate-200 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-blue-600 uppercase">
                      <Flag className="w-3.5 h-3.5" />
                      <span>Xem trước toàn cảnh lộ trình</span>
                    </div>
                    <h3 className="font-black text-base text-slate-900 truncate mt-0.5">
                      {selectedPlace.name}
                    </h3>
                    <p className="text-xs text-slate-500 truncate">
                      {selectedPlace.address}
                    </p>
                  </div>

                  {calculatedRoute && (
                    <div className="text-right flex-shrink-0 bg-emerald-50 px-3 py-1.5 rounded-2xl border border-emerald-200">
                      <div className="text-base font-black text-emerald-700">
                        {calculatedRoute.totalDurationMin} phút
                      </div>
                      <div className="text-xs font-bold text-emerald-600">
                        {calculatedRoute.totalDistanceKm} km
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleStartTurnByTurn}
                    disabled={isCalculatingRoute}
                    className="flex-1 py-3.5 px-5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all active:scale-95"
                  >
                    <Navigation className="w-5 h-5 fill-white" />
                    <span>
                      {isCalculatingRoute
                        ? 'Đang tính đường...'
                        : 'Bắt đầu dẫn đường'}
                    </span>
                  </button>

                  <a
                    href={externalNativeMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors flex-shrink-0"
                    title="Mở ứng dụng Google Maps"
                  >
                    <span>App GG Maps</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==========================================================================
          MODE 2: GOOGLE MAPS 3D TURN-BY-TURN DRIVING COCKPIT
         ========================================================================== */}
      {mode === 'navigating' && (
        <>
          {/* 1. TOP GOOGLE MAPS HIGHWAY SIGN GREEN TURN BANNER (#0d652d) */}
          <div className="relative z-[500] p-3 pointer-events-none">
            <div className="max-w-lg mx-auto">
              <div className="pointer-events-auto bg-[#0d652d] rounded-t-3xl rounded-br-3xl p-4 shadow-2xl border border-[#1e8e3e]/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
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

                  <div className="h-11 w-[1.5px] bg-white/20 flex-shrink-0" />

                  <div className="min-w-0">
                    <div className="text-xs font-bold text-emerald-200 uppercase tracking-wide">
                      {liveProgress?.nextStep.instruction || 'Đi thẳng theo đường'}
                    </div>
                    <div className="text-xl font-black text-white leading-snug truncate">
                      {liveProgress?.nextStep.roadName || selectedPlace?.name}
                    </div>
                  </div>
                </div>

                {/* Demo Drive Simulation Toggle */}
                <button
                  onClick={() => setIsSimulatingDrive(!isSimulatingDrive)}
                  className={`px-3 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 flex-shrink-0 border transition-all active:scale-95 ${
                    isSimulatingDrive
                      ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-lg'
                      : 'bg-[#094d22] hover:bg-[#073b1a] text-emerald-100 border-white/15'
                  }`}
                  title="Chạy thử mô phỏng trên đường"
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

              {secondStep && (
                <div className="pointer-events-auto inline-flex items-center gap-2 bg-[#094d22] text-white px-4 py-1.5 rounded-b-2xl shadow-lg border-x border-b border-[#1e8e3e]/30 text-xs font-bold">
                  <span className="text-emerald-200">Tiếp theo:</span>
                  <span className="font-extrabold text-white truncate max-w-[210px]">
                    {secondStep.instruction} ({secondStep.roadName})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 2. LEFT FLOATING SPEEDOMETER & RE-CENTER PILL */}
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

          {/* 3. RIGHT FLOATING GOOGLE MAPS CIRCULAR CONTROLS */}
          <div className="absolute right-4 top-36 z-[500] flex flex-col gap-2.5">
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className="w-12 h-12 rounded-full bg-white text-slate-800 shadow-xl border border-slate-200 flex items-center justify-center transition-transform active:scale-90"
              title="Bật/Tắt giọng nói"
            >
              {voiceEnabled ? (
                <Volume2 className="w-5 h-5 text-[#1a73e8]" />
              ) : (
                <VolumeX className="w-5 h-5 text-slate-400" />
              )}
            </button>

            <button
              onClick={() => setIs3DMode(!is3DMode)}
              className="w-12 h-12 rounded-full bg-white text-slate-800 shadow-xl border border-slate-200 flex flex-col items-center justify-center transition-transform active:scale-90"
              title="Đổi góc nhìn 3D Nghiêng / 2D Phẳng"
            >
              <Compass
                className={`w-5 h-5 ${
                  is3DMode ? 'text-[#ea4335]' : 'text-slate-600'
                }`}
                style={{
                  transform: is3DMode
                    ? `rotate(${-effectiveBearing}deg)`
                    : 'none',
                }}
              />
              <span className="text-[9px] font-black text-slate-600 leading-none mt-0.5">
                {is3DMode ? '3D' : '2D'}
              </span>
            </button>

            <button
              onClick={cycleMapStyle}
              className="w-12 h-12 rounded-full bg-white text-slate-800 shadow-xl border border-slate-200 flex flex-col items-center justify-center transition-transform active:scale-90"
              title="Đổi nền bản đồ (3D Tự nhiên / Đường phố / Vệ tinh)"
            >
              <Layers className="w-4 h-4 text-[#1a73e8]" />
              <span className="text-[8px] font-black text-slate-600 leading-none mt-0.5">
                {mapStyle === 'vector3d'
                  ? 'Vector'
                  : mapStyle === 'street'
                  ? 'Phố'
                  : 'Vệ tinh'}
              </span>
            </button>
          </div>

          {/* 4. BOTTOM GOOGLE MAPS DRIVING FOOTER BAR */}
          <div className="mt-auto relative z-[500] bg-white text-slate-900 rounded-t-3xl px-4 py-3.5 pb-5 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] border-t border-slate-200">
            <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
              {/* Left: Exit Navigation (X) */}
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
                  km • Đến lúc{' '}
                  {liveProgress?.etaText || calculatedRoute?.etaText || '--:--'}
                </div>
              </div>

              {/* Right: Switch back to Mode 1 (Route Overview) */}
              <button
                onClick={() => {
                  setIsSimulatingDrive(false);
                  setMode('overview');
                }}
                className="px-3.5 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 flex-shrink-0 transition-colors active:scale-95"
                title="Xem toàn cảnh bản đồ lộ trình"
              >
                <GitFork className="w-4 h-4 stroke-[2.2] text-[#1a73e8]" />
                <span>Toàn cảnh</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
