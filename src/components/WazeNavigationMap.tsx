import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Plus, Minus } from 'lucide-react';

export type MapLayerStyle = 'vector3d' | 'satellite';

interface WazeNavigationMapProps {
  currentLocation: { latitude: number; longitude: number };
  destination?: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  routeCoordinates?: [number, number][]; // [lat, lon] pairs
  traveledPoints?: { latitude: number; longitude: number }[];
  bearingDeg?: number;
  is3DMode?: boolean;
  isFollowing?: boolean;
  isNavigating?: boolean;
  recenterTrigger?: number;
  mapStyle?: MapLayerStyle;
  onUserDragMap?: () => void;
  onMapClickSelect?: (lat: number, lon: number) => void;
}

/**
 * Custom Top-Down 2.5D SVG Illustration of a BMW R1250GS Adventure (Trophy Livery)
 * Includes: Dual LED headlight beam, GS front beak, wide handlebars + white handguards,
 * iconic protruding Boxer twin cylinder heads, TFT dash, BMW roundel tank, and aluminum panniers.
 */
function buildBmwGs1250Svg(size: number): string {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">
      <defs>
        <linearGradient id="gsHeadlightBeam" x1="50" y1="22" x2="50" y2="-28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.65"/>
          <stop offset="60%" stop-color="#38bdf8" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
        </linearGradient>
        <radialGradient id="gsPuckGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#0f172a" stop-opacity="0.92"/>
          <stop offset="75%" stop-color="#0f172a" stop-opacity="0.82"/>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.95"/>
        </radialGradient>
      </defs>

      <!-- Dual LED Headlight Forward Cone -->
      <path d="M40 20 L18 -24 L82 -24 L60 20 Z" fill="url(#gsHeadlightBeam)" />

      <!-- Outer Tactical Telemetry Ring -->
      <circle cx="50" cy="52" r="36" fill="url(#gsPuckGlow)" stroke="#10b981" stroke-width="2.5" />
      <circle cx="50" cy="52" r="32" fill="none" stroke="#38bdf8" stroke-width="1" stroke-dasharray="6 4" opacity="0.7" />

      <!-- Forward Direction Chevron Indicator at Front of Ring -->
      <path d="M50 11 L43 19 L50 16 L57 19 Z" fill="#38bdf8" />

      <!-- 1. Front Knobby Adventure Tire -->
      <rect x="46" y="16" width="8" height="15" rx="4" fill="#1e293b" stroke="#475569" stroke-width="1.2" />

      <!-- 2. Iconic BMW GS Front Beak Fender (Mỏ vịt GS) -->
      <path d="M44 25 L47 18 L53 18 L56 25 L54 32 L46 32 Z" fill="#ffffff" stroke="#1d4ed8" stroke-width="1.2" />
      <path d="M47 20 L53 20 L54 24 L46 24 Z" fill="#1d4ed8" />

      <!-- 3. Iconic Protruding BMW Boxer Twin Cylinder Heads (2 cục máy Boxer nhô ngang) -->
      <rect x="24" y="39" width="14" height="11" rx="3" fill="#cbd5e1" stroke="#475569" stroke-width="1.5" />
      <line x1="26" y1="42" x2="36" y2="42" stroke="#64748b" stroke-width="1.2" />
      <line x1="26" y1="45" x2="36" y2="45" stroke="#64748b" stroke-width="1.2" />
      <line x1="26" y1="48" x2="36" y2="48" stroke="#64748b" stroke-width="1.2" />

      <rect x="62" y="39" width="14" height="11" rx="3" fill="#cbd5e1" stroke="#475569" stroke-width="1.5" />
      <line x1="64" y1="42" x2="74" y2="42" stroke="#64748b" stroke-width="1.2" />
      <line x1="64" y1="45" x2="74" y2="45" stroke="#64748b" stroke-width="1.2" />
      <line x1="64" y1="48" x2="74" y2="48" stroke="#64748b" stroke-width="1.2" />

      <!-- Engine Crash Bars (Khung chống đổ inox) -->
      <path d="M23 38 C21 43, 21 47, 23 51" stroke="#94a3b8" stroke-width="2" fill="none" stroke-linecap="round" />
      <path d="M77 38 C79 43, 79 47, 77 51" stroke="#94a3b8" stroke-width="2" fill="none" stroke-linecap="round" />

      <!-- 4. Adventure Touring Windshield (Kính chắn gió trong suốt) -->
      <path d="M41 29 C45 25, 55 25, 59 29 L57 35 C53 33, 47 33, 43 35 Z" fill="#bae6fd" fill-opacity="0.65" stroke="#38bdf8" stroke-width="1" />

      <!-- 5. Glowing BMW Connectivity TFT Screen -->
      <rect x="45" y="32" width="10" height="5" rx="1.2" fill="#0284c7" stroke="#e0f2fe" stroke-width="0.8" />

      <!-- 6. Wide GS Handlebars, Gold Forks & White Rallye Handguards -->
      <path d="M22 33 L42 36 L58 36 L78 33" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round" />
      <!-- Left & Right Handguards -->
      <path d="M20 31 L29 31 L28 35 L20 35 Z" fill="#ffffff" stroke="#0f172a" stroke-width="1" />
      <path d="M71 31 L80 31 L80 35 L72 35 Z" fill="#ffffff" stroke="#0f172a" stroke-width="1" />
      <!-- Gold Telelever Fork Caps -->
      <circle cx="44" cy="35" r="2.2" fill="#f59e0b" stroke="#78350f" stroke-width="0.8" />
      <circle cx="56" cy="35" r="2.2" fill="#f59e0b" stroke="#78350f" stroke-width="0.8" />

      <!-- 7. Sculpted 30L Adventure Fuel Tank (BMW Motorsport White / Blue / Red) -->
      <path d="M38 38 C36 45, 39 54, 42 57 L58 57 C61 54, 64 45, 62 38 Z" fill="#ffffff" stroke="#1e293b" stroke-width="1.5" />
      <!-- Motorsport Blue & Red Tank Stripes -->
      <path d="M40 39 L45 39 L43 55 L39 52 Z" fill="#1d4ed8" />
      <path d="M60 39 L55 39 L57 55 L61 52 Z" fill="#ef4444" />
      <!-- Center Tank Filler Cap & BMW Roundel -->
      <circle cx="50" cy="46" r="4" fill="#ffffff" stroke="#0f172a" stroke-width="1.2" />
      <path d="M50 42 A4 4 0 0 1 54 46 L50 46 Z" fill="#0284c7" />
      <path d="M50 50 A4 4 0 0 1 46 46 L50 46 Z" fill="#0284c7" />

      <!-- 8. Dual Aluminum Adventure Side Panniers (Thùng nhôm hông GS) -->
      <rect x="25" y="60" width="12" height="19" rx="2.5" fill="#e2e8f0" stroke="#334155" stroke-width="1.6" />
      <rect x="25" y="60" width="12" height="4" rx="1" fill="#1e293b" />
      <rect x="25" y="75" width="12" height="4" rx="1" fill="#1e293b" />

      <rect x="63" y="60" width="12" height="19" rx="2.5" fill="#e2e8f0" stroke="#334155" stroke-width="1.6" />
      <rect x="63" y="60" width="12" height="4" rx="1" fill="#1e293b" />
      <rect x="63" y="75" width="12" height="4" rx="1" fill="#1e293b" />

      <!-- 9. Rider Seat & Rear Pillion Seat -->
      <path d="M42 56 L58 56 L56 75 L44 75 Z" fill="#1e293b" stroke="#475569" stroke-width="1.2" />
      <path d="M44 58 L56 58 L55 66 L45 66 Z" fill="#334155" />

      <!-- 10. Aluminum Top Box / Rear Rack & LED Tail Light -->
      <rect x="41" y="74" width="18" height="11" rx="2.5" fill="#cbd5e1" stroke="#1e293b" stroke-width="1.5" />
      <rect x="45" y="84" width="10" height="2.5" rx="1" fill="#ef4444" />
    </svg>
  `;
}

export const WazeNavigationMap: React.FC<WazeNavigationMapProps> = ({
  currentLocation,
  destination,
  routeCoordinates = [],
  traveledPoints = [],
  bearingDeg = 0,
  is3DMode = true,
  isFollowing = true,
  isNavigating = false,
  recenterTrigger = 0,
  mapStyle = 'vector3d',
  onUserDragMap,
  onMapClickSelect,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const routeLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const prevNavigatingRef = useRef<boolean>(false);
  const lastFittedDestKeyRef = useRef<string>('');

  const activeRotationDegRef = useRef<number>(0);
  activeRotationDegRef.current = isNavigating && is3DMode ? bearingDeg : 0;

  const onUserDragRef = useRef(onUserDragMap);
  onUserDragRef.current = onUserDragMap;

  const onMapClickRef = useRef(onMapClickSelect);
  onMapClickRef.current = onMapClickSelect;

  const snapCameraToVehicleStreetView = (
    map: L.Map,
    lat: number,
    lon: number,
    targetZoom = 18
  ) => {
    map.stop();
    map.invalidateSize({ animate: false });
    map.setView([lat, lon], targetZoom, { animate: false });
  };

  // Fit bounds helper that accounts for the oversized 240vmax square canvas margins
  const fitRouteInVisibleViewport = (
    map: L.Map,
    coords: [number, number][]
  ) => {
    if (coords.length < 2) return;
    map.stop();
    map.invalidateSize({ animate: false });

    const containerSize = map.getSize();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

    const marginX = Math.max(0, (containerSize.x - vw) / 2);
    const marginY = Math.max(0, (containerSize.y - vh) / 2);

    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, {
      paddingTopLeft: [marginX + 36, marginY + 135],
      paddingBottomRight: [marginX + 36, marginY + 230],
      maxZoom: 15,
      animate: false,
    });
  };

  // 1. Initialize Leaflet Map once inside the 240vmax square canvas (zero missing corners at any rotation!)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [currentLocation.latitude, currentLocation.longitude],
      zoom: isNavigating ? 18 : 14,
      zoomControl: false,
      attributionControl: false,
      renderer: L.svg({ padding: 1.5 }),
    });

    // Counter-rotate touch/mouse drag vectors so dragging is NEVER inverted when map rotates
    const draggable = (map.dragging as any)?._draggable;
    if (draggable) {
      draggable.on('predrag', () => {
        const deg = activeRotationDegRef.current;
        if (!deg) return;
        const rad = (deg * Math.PI) / 180;
        const offset = draggable._newPos.subtract(draggable._startPos);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rotatedOffset = L.point(
          offset.x * cos - offset.y * sin,
          offset.x * sin + offset.y * cos
        );
        draggable._newPos = draggable._startPos.add(rotatedOffset);
      });
    }

    const tileUrl =
      mapStyle === 'satellite'
        ? 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=vi'
        : 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=vi';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      keepBuffer: 6,
    }).addTo(map);

    routeLayerGroupRef.current = L.layerGroup().addTo(map);

    map.on('dragstart', () => {
      if (onUserDragRef.current) {
        onUserDragRef.current();
      }
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.latlng.lat, e.latlng.lng);
      }
    });

    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Switch between Google Maps Street ('m') and Google Hybrid Satellite ('y')
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    const tileUrl =
      mapStyle === 'satellite'
        ? 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=vi'
        : 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=vi';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      keepBuffer: 6,
    }).addTo(map);
  }, [mapStyle]);

  // 3. Draw Route Line & Destination Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    const routeGroup = routeLayerGroupRef.current;
    if (!map || !routeGroup) return;

    routeGroup.clearLayers();

    const activeCoords: [number, number][] =
      routeCoordinates && routeCoordinates.length >= 2
        ? routeCoordinates
        : destination
        ? [
            [currentLocation.latitude, currentLocation.longitude],
            [destination.latitude, destination.longitude],
          ]
        : [];

    if (activeCoords.length >= 2) {
      // Outer Dark Carbon Casing
      L.polyline(activeCoords, {
        color: '#0f172a',
        weight: isNavigating ? 16 : 11,
        opacity: 0.92,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(routeGroup);

      // Inner Vibrant Adventure Blue/Cyan Route Core
      L.polyline(activeCoords, {
        color: '#2563eb',
        weight: isNavigating ? 11 : 7,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(routeGroup);

      // Inner Neon Cyan Chevrons / Flow Dash
      L.polyline(activeCoords, {
        color: '#38bdf8',
        weight: isNavigating ? 3.5 : 2,
        opacity: 0.9,
        dashArray: '6, 14',
        lineCap: 'round',
        interactive: false,
      }).addTo(routeGroup);

      // Origin Point
      L.circleMarker(activeCoords[0], {
        radius: 6,
        fillColor: '#10b981',
        fillOpacity: 1,
        color: '#0f172a',
        weight: 3,
        interactive: false,
      }).addTo(routeGroup);
    }

    // Traveled GPS Breadcrumb Trail
    if (traveledPoints && traveledPoints.length >= 2) {
      const traveledLatLngs: [number, number][] = traveledPoints.map((p) => [
        p.latitude,
        p.longitude,
      ]);
      L.polyline(traveledLatLngs, {
        color: '#10b981',
        weight: 5,
        opacity: 0.8,
        dashArray: '5, 8',
        interactive: false,
      }).addTo(routeGroup);
    }

    // Destination Checkered Flag Marker (counter-rotated so label is always upright)
    if (destination) {
      const counterRot = isNavigating && is3DMode ? bearingDeg : 0;
      const destHtml = `
        <div style="display: flex; flex-direction: column; align-items: center; transform: translateY(-16px) rotate(${counterRot}deg); transition: transform 0.25s ease-out;">
          <div style="background: #0f172a; color: #f8fafc; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 10px; white-space: nowrap; box-shadow: 0 6px 16px rgba(0,0,0,0.35); border: 1.5px solid #10b981; margin-bottom: 4px;">
            🏁 ${destination.name.slice(0, 24)}
          </div>
          <div style="width: 28px; height: 28px; border-radius: 9999px; background: linear-gradient(135deg, #10b981, #059669); border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(16,185,129,0.55); display: flex; align-items: center; justify-content: center;">
            <div style="width: 8px; height: 8px; border-radius: 9999px; background: #ffffff;"></div>
          </div>
        </div>
      `;

      const destIcon = L.divIcon({
        html: destHtml,
        className: 'gs-dest-pin',
        iconSize: [160, 56],
        iconAnchor: [80, 46],
      });

      if (!destinationMarkerRef.current) {
        destinationMarkerRef.current = L.marker(
          [destination.latitude, destination.longitude],
          { icon: destIcon, zIndexOffset: 900 }
        ).addTo(map);
      } else {
        destinationMarkerRef.current.setLatLng([
          destination.latitude,
          destination.longitude,
        ]);
        destinationMarkerRef.current.setIcon(destIcon);
      }

      const destKey = `${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}-${activeCoords.length}`;
      if (
        !isNavigating &&
        activeCoords.length >= 2 &&
        lastFittedDestKeyRef.current !== destKey
      ) {
        lastFittedDestKeyRef.current = destKey;
        fitRouteInVisibleViewport(map, activeCoords);
      }
    } else if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
      lastFittedDestKeyRef.current = '';
    }
  }, [destination, routeCoordinates, traveledPoints, isNavigating, bearingDeg, is3DMode]);

  // 4. Explicit "Về giữa" (Re-center) Trigger Effect
  useEffect(() => {
    if (recenterTrigger === 0) return;
    const map = mapInstanceRef.current;
    if (!map) return;

    snapCameraToVehicleStreetView(
      map,
      currentLocation.latitude,
      currentLocation.longitude,
      18
    );
  }, [recenterTrigger]);

  // 5. Unified Camera Controller & BMW R1250GS Marker Updater
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const iconSize = isNavigating ? 86 : 66;
    const gsBikeSvg = buildBmwGs1250Svg(iconSize);

    const vehicleHtml = `
      <div style="position: relative; width: ${iconSize}px; height: ${iconSize}px; display: flex; align-items: center; justify-content: center; transform: rotate(${bearingDeg}deg); transition: transform 0.25s ease-out; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.45));">
        ${gsBikeSvg}
      </div>
    `;

    const icon = L.divIcon({
      html: vehicleHtml,
      className: 'bmw-gs1250-marker',
      iconSize: [iconSize, iconSize],
      iconAnchor: [iconSize / 2, iconSize / 2],
    });

    if (!vehicleMarkerRef.current) {
      vehicleMarkerRef.current = L.marker(
        [currentLocation.latitude, currentLocation.longitude],
        { icon, zIndexOffset: 1000 }
      ).addTo(map);
    } else {
      vehicleMarkerRef.current.setLatLng([
        currentLocation.latitude,
        currentLocation.longitude,
      ]);
      vehicleMarkerRef.current.setIcon(icon);
    }

    // Transition from Overview (Mode 1) -> Driving Mode (Mode 2)
    if (isNavigating && !prevNavigatingRef.current) {
      prevNavigatingRef.current = true;
      snapCameraToVehicleStreetView(
        map,
        currentLocation.latitude,
        currentLocation.longitude,
        18
      );
      const timer = setTimeout(() => {
        if (mapInstanceRef.current) {
          snapCameraToVehicleStreetView(
            mapInstanceRef.current,
            currentLocation.latitude,
            currentLocation.longitude,
            18
          );
        }
      }, 150);
      return () => clearTimeout(timer);
    }

    // Transition from Driving Mode (Mode 2) -> Overview (Mode 1)
    if (!isNavigating && prevNavigatingRef.current) {
      prevNavigatingRef.current = false;
      const activeCoords: [number, number][] =
        routeCoordinates && routeCoordinates.length >= 2
          ? routeCoordinates
          : destination
          ? [
              [currentLocation.latitude, currentLocation.longitude],
              [destination.latitude, destination.longitude],
            ]
          : [];

      if (activeCoords.length >= 2) {
        fitRouteInVisibleViewport(map, activeCoords);
      }
      return;
    }

    // Continuous street-level camera tracking while driving (Mode 2)
    if (isNavigating && isFollowing) {
      const currentZoom = map.getZoom();
      if (currentZoom < 17) {
        snapCameraToVehicleStreetView(
          map,
          currentLocation.latitude,
          currentLocation.longitude,
          18
        );
      } else {
        map.panTo([currentLocation.latitude, currentLocation.longitude], {
          animate: true,
          duration: 0.25,
        });
      }
    }
  }, [
    currentLocation.latitude,
    currentLocation.longitude,
    bearingDeg,
    isFollowing,
    isNavigating,
  ]);

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    if (onUserDragRef.current) {
      onUserDragRef.current();
    }
    mapInstanceRef.current?.zoomOut();
  };

  // Constant 240vmax x 240vmax square canvas centered at (50%, 50%)!
  // Because 240vmax is 2.4x larger than the tallest dimension of the phone screen,
  // rotating 360° (`rotateZ(-bearingDeg)`) NEVER exposes a blank corner!
  const mapCanvasTransformStyle: React.CSSProperties =
    isNavigating && is3DMode
      ? {
          position: 'absolute',
          width: '240vmax',
          height: '240vmax',
          left: 'calc(50% - 120vmax)',
          top: 'calc(50% - 120vmax)',
          transform: `translateY(14vh) perspective(950px) rotateX(24deg) rotateZ(${-bearingDeg}deg)`,
          transformOrigin: '50% 50%',
          transition: 'transform 0.35s ease-out',
        }
      : {
          position: 'absolute',
          width: '240vmax',
          height: '240vmax',
          left: 'calc(50% - 120vmax)',
          top: 'calc(50% - 120vmax)',
          transform: 'none',
          transformOrigin: '50% 50%',
          transition: 'transform 0.35s ease-out',
        };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-900 select-none">
      <div style={mapCanvasTransformStyle}>
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Tactical Carbon Zoom Rocker Switch (+ / -) */}
      <div
        className={`absolute left-3.5 z-[400] flex flex-col bg-slate-950/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-emerald-500/30 overflow-hidden ${
          isNavigating ? 'top-40' : 'bottom-56'
        }`}
      >
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-10 h-10 flex items-center justify-center text-emerald-400 hover:bg-slate-800 active:bg-slate-700 transition-colors border-b border-slate-800"
          title="Phóng to bản đồ"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-10 h-10 flex items-center justify-center text-emerald-400 hover:bg-slate-800 active:bg-slate-700 transition-colors"
          title="Thu nhỏ bản đồ"
        >
          <Minus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
