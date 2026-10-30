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
  Layers,
  Volume2,
  VolumeX,
  Play,
  Square,
  GitFork,
  Crosshair,
  Gauge,
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
  // Mode 2: 'navigating' (Chế độ dẫn đường 3D BMW GS1250 Adventure Cockpit)
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
  const [recenterTrigger, setRecenterTrigger] = useState(0);
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
        speedKmh: 42 + Math.round(Math.sin(idx * 0.3) * 8),
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

  const handleRecenterToVehicle = () => {
    setIsFollowingVehicle(true);
    setIs3DMode(true);
    setRecenterTrigger((c) => c + 1);
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
    setRecenterTrigger((c) => c + 1);

    const firstStep = calculatedRoute?.steps?.[0];
    if (firstStep) {
      speakVietnamese(
        `Bắt đầu hành trình đến ${selectedPlace.name}. ${firstStep.instruction} vào ${firstStep.roadName}`
      );
    } else {
      speakVietnamese(`Bắt đầu hành trình đến ${selectedPlace.name}`);
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
    setMapStyle(mapStyle === 'vector3d' ? 'satellite' : 'vector3d');
  };

  // Compute live navigation progress
  const liveProgress: LiveNavigationProgress | null =
    calculatedRoute && selectedPlace
      ? navigationRoutingService.getLiveProgress(
          calculatedRoute,
          effectiveLocation,
          selectedPlace,
          activeTrip.route.points
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
        return <CornerUpLeft className="w-8 h-8 text-slate-950 stroke-[3]" />;
      case 'right':
      case 'slight-right':
        return <CornerUpRight className="w-8 h-8 text-slate-950 stroke-[3]" />;
      case 'uturn':
      case 'roundabout':
        return <RotateCcw className="w-8 h-8 text-slate-950 stroke-[3]" />;
      case 'arrive':
        return <Flag className="w-8 h-8 text-slate-950 stroke-[3]" />;
      default:
        return <ArrowUp className="w-8 h-8 text-slate-950 stroke-[3]" />;
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
    <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none">
      {/* ==========================================================================
          PERSISTENT FULLSCREEN 3D MAP (240VMAX CANVAS + BMW R1250GS MOTORCYCLE)
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
          recenterTrigger={recenterTrigger}
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
          MODE 1: OVERVIEW & DESTINATION SEARCH OVERLAY (DARK CARBON ADVENTURE HUD)
         ========================================================================== */}
      {mode === 'overview' && (
        <>
          {/* Top Floating Tactical Search Pod & Suggestions Drawer */}
          <div className="relative z-[500] p-3 max-w-lg w-full mx-auto space-y-2 pointer-events-none">
            <div className="pointer-events-auto bg-slate-950/90 backdrop-blur-2xl rounded-3xl shadow-[0_14px_38px_rgba(0,0,0,0.65)] border border-emerald-500/30 p-3.5 space-y-3">
              {/* Top Row: Back button + GS1250 Odometer Badge + Map Layer Switcher */}
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <ArrowLeft className="w-4 h-4 text-emerald-400" />
                  <span>Đóng</span>
                </button>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-300 bg-emerald-500/15 border border-emerald-500/35 px-3 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>GS1250 • {activeTrip.distanceKm.toFixed(2)} KM</span>
                  </div>

                  <button
                    onClick={cycleMapStyle}
                    className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 text-[11px] font-bold flex items-center gap-1.5 border border-cyan-500/30 transition-all active:scale-95"
                    title="Đổi lớp bản đồ"
                  >
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      {mapStyle === 'vector3d' ? 'Bản đồ phố' : 'Vệ tinh'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Search Input Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => setIsSearchDrawerOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchDrawerOpen(true);
                  }}
                  placeholder="Tìm điểm đến, cung đường, quán cafe hoặc chạm bản đồ..."
                  className="w-full pl-10 pr-12 py-2.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 focus:border-emerald-400 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                />
                {isSearching ? (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                ) : searchQuery ? (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setIsSearchDrawerOpen(true);
                    }}
                    className="p-1 text-slate-400 hover:text-white absolute right-2.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : isSearchDrawerOpen && selectedPlace ? (
                  <button
                    onClick={() => setIsSearchDrawerOpen(false)}
                    className="text-[11px] font-extrabold text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-500/10 absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    Thu gọn
                  </button>
                ) : null}
              </div>
            </div>

            {/* Collapsible Search Results & Quick Cafe Drawer */}
            {isSearchDrawerOpen && (
              <div className="pointer-events-auto bg-slate-950/95 backdrop-blur-2xl rounded-3xl shadow-[0_18px_45px_rgba(0,0,0,0.75)] border border-slate-800 max-h-[50vh] overflow-y-auto p-3.5 space-y-3 animate-in fade-in">
                {searchQuery.trim().length >= 2 ? (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 px-1 flex items-center justify-between">
                      <span>Tọa độ địa điểm thực tế</span>
                      {searchResults.length > 0 && (
                        <span>{searchResults.length} điểm</span>
                      )}
                    </div>

                    {searchResults.length === 0 && !isSearching ? (
                      <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center text-xs text-slate-400">
                        Không tìm thấy "{searchQuery}". Hãy thử từ khóa khác hoặc chạm trực tiếp lên bản đồ.
                      </div>
                    ) : (
                      searchResults.map((place) => (
                        <button
                          key={place.id}
                          onClick={() => handleSelectPlace(place)}
                          className="w-full text-left p-2.5 rounded-2xl bg-slate-900/60 hover:bg-emerald-500/15 border border-slate-800/90 hover:border-emerald-500/40 transition-all flex items-center justify-between gap-2.5"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-white truncate">
                                {place.name}
                              </div>
                              <div className="text-xs text-slate-400 truncate">
                                {place.address}
                              </div>
                            </div>
                          </div>

                          {place.distanceKm !== undefined && (
                            <span className="text-xs font-black text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-xl flex-shrink-0">
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
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Lộ trình gần đây</span>
                        </div>
                        {recentPlaces.slice(0, 3).map((place) => (
                          <button
                            key={place.id}
                            onClick={() => handleSelectPlace(place)}
                            className="w-full text-left p-2.5 rounded-2xl bg-slate-900/60 hover:bg-slate-800/90 border border-slate-800 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-white truncate">
                                {place.name}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {place.address}
                              </div>
                            </div>
                            <span className="text-[11px] font-extrabold text-emerald-400 flex-shrink-0">
                              Chọn →
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-1 flex items-center gap-1.5">
                        <Coffee className="w-3.5 h-3.5 text-amber-400" />
                        <span>Trạm dừng Cafe đề xuất</span>
                      </div>
                      {allCafes.slice(0, 4).map((cafe) => (
                        <button
                          key={cafe.id}
                          onClick={() => handleSelectQuickCafe(cafe)}
                          className="w-full text-left p-2.5 rounded-2xl bg-slate-900/60 hover:bg-slate-800/90 border border-slate-800 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-white truncate">
                              {cafe.name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {cafe.address}
                            </div>
                          </div>
                          <span className="text-[11px] font-extrabold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg flex-shrink-0">
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

          {/* Bottom Route Preview & "Bắt đầu dẫn đường" Tactical Card */}
          {selectedPlace && (
            <div className="mt-auto relative z-[500] p-3 max-w-lg w-full mx-auto">
              <div className="bg-slate-950/92 backdrop-blur-2xl rounded-3xl p-4 shadow-[0_16px_45px_rgba(0,0,0,0.75)] border border-emerald-500/35 space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                      <Flag className="w-3.5 h-3.5" />
                      <span>BMW GS1250 • Toàn cảnh hành trình</span>
                    </div>
                    <h3 className="font-black text-base text-white truncate mt-0.5">
                      {selectedPlace.name}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      {selectedPlace.address}
                    </p>
                  </div>

                  {calculatedRoute && (
                    <div className="text-right flex-shrink-0 bg-emerald-500/15 px-3.5 py-1.5 rounded-2xl border border-emerald-500/40">
                      <div className="text-base font-black text-emerald-300">
                        {calculatedRoute.totalDurationMin} phút
                      </div>
                      <div className="text-xs font-extrabold text-cyan-300">
                        {calculatedRoute.totalDistanceKm} km
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleStartTurnByTurn}
                    disabled={isCalculatingRoute}
                    className="flex-1 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 shadow-[0_8px_25px_rgba(16,185,129,0.4)] transition-all active:scale-95"
                  >
                    <Navigation className="w-5 h-5 fill-slate-950 text-slate-950" />
                    <span>
                      {isCalculatingRoute
                        ? 'Đang tính tọa độ...'
                        : 'Bắt đầu dẫn đường'}
                    </span>
                  </button>

                  <a
                    href={externalNativeMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors flex-shrink-0"
                    title="Mở ứng dụng Google Maps"
                  >
                    <span>GG Maps</span>
                    <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==========================================================================
          MODE 2: BMW R1250GS ADVENTURE 3D TURN-BY-TURN COCKPIT HUD
         ========================================================================== */}
      {mode === 'navigating' && (
        <>
          {/* 1. TOP TACTICAL MOTORRAD TURN-BY-TURN HUD */}
          <div className="relative z-[500] p-3 pointer-events-none">
            <div className="max-w-lg mx-auto">
              <div className="pointer-events-auto bg-slate-950/92 backdrop-blur-2xl rounded-3xl p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.7)] border border-emerald-500/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Glowing Emerald Turn Maneuver Box */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-500 shadow-[0_0_20px_rgba(16,185,129,0.45)] flex flex-col items-center justify-center flex-shrink-0 border border-white/30">
                    {renderManeuverIcon(liveProgress?.nextStep.icon)}
                    <span className="text-[11px] font-black text-slate-950 leading-none mt-0.5">
                      {liveProgress
                        ? liveProgress.distanceToNextTurnMeters >= 1000
                          ? `${(liveProgress.distanceToNextTurnMeters / 1000).toFixed(1)}km`
                          : `${liveProgress.distanceToNextTurnMeters}m`
                        : '...'}
                    </span>
                  </div>

                  {/* Street Name & Maneuver Instruction */}
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider text-emerald-300 mb-1">
                      <span>{liveProgress?.nextStep.instruction || 'Đi thẳng theo'}</span>
                    </div>
                    <div className="text-xl font-black text-white leading-tight truncate">
                      {liveProgress?.nextStep.roadName || selectedPlace?.name}
                    </div>
                  </div>
                </div>

                {/* Tactical Demo Drive Button */}
                <button
                  onClick={() => setIsSimulatingDrive(!isSimulatingDrive)}
                  className={`px-3.5 py-2.5 rounded-2xl text-xs font-black flex flex-col items-center justify-center gap-1 flex-shrink-0 border transition-all active:scale-95 ${
                    isSimulatingDrive
                      ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.5)]'
                      : 'bg-slate-900 hover:bg-slate-800 text-emerald-400 border-emerald-500/35'
                  }`}
                  title="Chạy thử mô phỏng xe BMW GS1250"
                >
                  {isSimulatingDrive ? (
                    <>
                      <Square className="w-4 h-4 fill-slate-950" />
                      <span className="text-[10px] uppercase tracking-wider">Dừng thử</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-emerald-400" />
                      <span className="text-[10px] uppercase tracking-wider">Chạy thử</span>
                    </>
                  )}
                </button>
              </div>

              {/* Sub-pill: Next Turn + BMW R1250GS Badge */}
              <div className="mt-1.5 flex items-center justify-between px-2">
                {secondStep ? (
                  <div className="pointer-events-auto inline-flex items-center gap-2 bg-slate-950/90 backdrop-blur-xl text-slate-200 px-3.5 py-1.5 rounded-2xl border border-slate-800 shadow-lg text-xs font-bold">
                    <span className="text-emerald-400 font-extrabold uppercase text-[10px]">
                      Tiếp theo:
                    </span>
                    <span className="truncate max-w-[180px]">
                      {secondStep.instruction} ({secondStep.roadName})
                    </span>
                  </div>
                ) : (
                  <div />
                )}

                <div className="pointer-events-auto inline-flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-xl px-3 py-1 rounded-full border border-cyan-500/30 text-[10px] font-black text-cyan-300 tracking-wider uppercase shadow-lg">
                  <span>🏍️ BMW R1250GS</span>
                  <span className="text-emerald-400">• {Math.round(effectiveBearing)}°</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. LEFT TFT DIGITAL SPEEDOMETER POD & TACTICAL "VỀ GIỮA" LOCK BUTTON */}
          <div className="absolute bottom-28 left-3.5 z-[500] flex flex-col items-start gap-2.5">
            {/* Tactical Re-Center Button */}
            <button
              onClick={handleRecenterToVehicle}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-[0_10px_25px_rgba(0,0,0,0.65)] border flex items-center gap-2 active:scale-95 transition-all ${
                !isFollowingVehicle
                  ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 border-white animate-bounce shadow-[0_0_25px_rgba(16,185,129,0.6)]'
                  : 'bg-slate-950/90 backdrop-blur-xl text-emerald-400 border-emerald-500/40'
              }`}
            >
              <Crosshair
                className={`w-4 h-4 ${
                  !isFollowingVehicle ? 'text-slate-950 stroke-[2.75]' : 'text-emerald-400'
                }`}
              />
              <span>{!isFollowingVehicle ? 'Về giữa xe' : 'Đã khóa tâm'}</span>
            </button>

            {/* BMW Motorrad TFT Speedometer & Odometer Pod */}
            <div className="bg-slate-950/92 backdrop-blur-2xl p-2.5 rounded-3xl border border-slate-800 shadow-[0_12px_30px_rgba(0,0,0,0.7)] flex items-center gap-3">
              <div
                className={`w-14 h-14 rounded-2xl bg-slate-900 border-2 flex flex-col items-center justify-center shadow-inner ${
                  displaySpeedKmh >= 60
                    ? 'border-rose-500 text-rose-400'
                    : 'border-emerald-500/60 text-white'
                }`}
              >
                <span className="text-xl font-black leading-none tracking-tight">
                  {Math.round(displaySpeedKmh)}
                </span>
                <span className="text-[9px] font-black text-emerald-400 uppercase mt-0.5">
                  KM/H
                </span>
              </div>

              <div className="pr-2">
                <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                  <Gauge className="w-3 h-3 text-cyan-400" />
                  <span>Hành trình</span>
                </div>
                <div className="text-sm font-black text-white mt-0.5">
                  {activeTrip.distanceKm.toFixed(2)}{' '}
                  <span className="text-[10px] text-emerald-400">KM</span>
                </div>
                <div className="text-[10px] font-bold text-cyan-400">
                  {is3DMode ? 'Góc 3D Nghiêng' : 'Góc 2D Phẳng'}
                </div>
              </div>
            </div>
          </div>

          {/* 3. RIGHT TACTICAL COCKPIT CONTROL PODS (CUSTOM HEX/SQUIRCLE CARBON BUTTONS) */}
          <div className="absolute right-3.5 bottom-28 z-[500] flex flex-col gap-2.5">
            {/* 3D / 2D Perspective Toggle */}
            <button
              onClick={() => setIs3DMode(!is3DMode)}
              className={`w-13 h-13 w-[52px] h-[52px] rounded-2xl backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.65)] border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90 ${
                is3DMode
                  ? 'bg-slate-950/90 border-emerald-500/45 text-emerald-400'
                  : 'bg-slate-900/90 border-slate-700 text-slate-300'
              }`}
              title="Đổi góc nhìn 3D / 2D"
            >
              <Compass
                className="w-5 h-5 text-emerald-400 transition-transform duration-150"
                style={{
                  transform: is3DMode
                    ? `rotate(${-effectiveBearing}deg)`
                    : 'none',
                }}
              />
              <span className="text-[9px] font-black uppercase tracking-tighter">
                {is3DMode ? '3D' : '2D'}
              </span>
            </button>

            {/* Satellite / Street Map Layer Toggle */}
            <button
              onClick={cycleMapStyle}
              className="w-[52px] h-[52px] rounded-2xl bg-slate-950/90 backdrop-blur-xl text-cyan-400 shadow-[0_8px_24px_rgba(0,0,0,0.65)] border border-slate-700/80 hover:border-cyan-500/50 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90"
              title="Đổi lớp bản đồ Vệ tinh / Phố"
            >
              <Layers className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-tighter">
                {mapStyle === 'vector3d' ? 'Phố' : 'Vệ tinh'}
              </span>
            </button>

            {/* Search Another Place */}
            <button
              onClick={() => {
                setIsSimulatingDrive(false);
                setMode('overview');
                setIsSearchDrawerOpen(true);
              }}
              className="w-[52px] h-[52px] rounded-2xl bg-slate-950/90 backdrop-blur-xl text-slate-200 shadow-[0_8px_24px_rgba(0,0,0,0.65)] border border-slate-700/80 hover:border-emerald-500/50 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90"
              title="Tìm điểm đến khác"
            >
              <Search className="w-4 h-4 text-emerald-400" />
              <span className="text-[9px] font-black uppercase tracking-tighter">
                Tìm đích
              </span>
            </button>

            {/* Voice Guidance Mute / Unmute */}
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`w-[52px] h-[52px] rounded-2xl bg-slate-950/90 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.65)] border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90 ${
                voiceEnabled
                  ? 'border-slate-700/80 text-emerald-400'
                  : 'border-rose-500/50 text-rose-400'
              }`}
              title="Bật/Tắt giọng nói dẫn đường"
            >
              {voiceEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
              <span className="text-[9px] font-black uppercase tracking-tighter">
                {voiceEnabled ? 'Loa bật' : 'Tắt loa'}
              </span>
            </button>

            {/* Full Route Overview Toggle */}
            <button
              onClick={() => {
                setIsSimulatingDrive(false);
                setMode('overview');
                setIsSearchDrawerOpen(false);
              }}
              className="w-[52px] h-[52px] rounded-2xl bg-slate-950/90 backdrop-blur-xl text-amber-400 shadow-[0_8px_24px_rgba(0,0,0,0.65)] border border-slate-700/80 hover:border-amber-500/50 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90"
              title="Xem toàn cảnh lộ trình"
            >
              <GitFork className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-tighter">
                Toàn cảnh
              </span>
            </button>
          </div>

          {/* 4. BOTTOM MOTORRAD ADVENTURE COCKPIT TELEMETRY BAR */}
          <div className="mt-auto relative z-[500] p-3 pointer-events-none">
            <div className="max-w-lg mx-auto pointer-events-auto bg-slate-950/95 backdrop-blur-2xl rounded-3xl px-5 py-3.5 shadow-[0_-10px_35px_rgba(0,0,0,0.75)] border border-emerald-500/35 flex items-center justify-between gap-3">
              {/* Left: Remaining Minutes + Distance + ETA */}
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-400 leading-none">
                    {liveProgress?.remainingDurationMin ??
                      calculatedRoute?.totalDurationMin ??
                      1}{' '}
                    phút
                  </span>
                  <span className="text-xs font-extrabold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                    {liveProgress?.remainingDistanceKm ??
                      calculatedRoute?.totalDistanceKm ??
                      0}{' '}
                    km
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-400 truncate mt-1 flex items-center gap-1.5">
                  <span>Dự kiến đến:</span>
                  <span className="text-white font-black">
                    {liveProgress?.etaText || calculatedRoute?.etaText || '--:--'}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400 truncate">
                    {selectedPlace?.name}
                  </span>
                </div>
              </div>

              {/* Right: Tactical Red/Rose Exit Button */}
              <button
                onClick={onClose}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs uppercase tracking-wider shadow-[0_6px_20px_rgba(225,29,72,0.45)] border border-rose-400/30 transition-all active:scale-95 flex-shrink-0"
              >
                Kết thúc
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
