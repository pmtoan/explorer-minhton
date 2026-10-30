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
  mapStyle?: MapLayerStyle;
  onUserDragMap?: () => void;
  onMapClickSelect?: (lat: number, lon: number) => void;
}

export const WazeNavigationMap: React.FC<WazeNavigationMapProps> = ({
  currentLocation,
  destination,
  routeCoordinates = [],
  traveledPoints = [],
  bearingDeg = 0,
  isFollowing = true,
  isNavigating = false,
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

  // Keep latest callbacks in refs so Leaflet event listeners never go stale
  const onUserDragRef = useRef(onUserDragMap);
  onUserDragRef.current = onUserDragMap;

  const onMapClickRef = useRef(onMapClickSelect);
  onMapClickRef.current = onMapClickSelect;

  // 1. Initialize Leaflet Map once (Pure native 2D/vector-rendered Google Maps tiles, zero CSS distortion)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [currentLocation.latitude, currentLocation.longitude],
      zoom: isNavigating ? 18 : 14,
      zoomControl: false,
      attributionControl: false,
      // Use SVG renderer with generous padding so polylines never clip while panning
      renderer: L.svg({ padding: 1.0 }),
    });

    const tileUrl =
      mapStyle === 'satellite'
        ? 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=vi'
        : 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=vi';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
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
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Switch between Google Maps Standard Street ('m') and Google Hybrid Satellite ('y')
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
    }).addTo(map);
  }, [mapStyle]);

  // 3. Draw Google Maps Electric Blue Route Line & Destination Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    const routeGroup = routeLayerGroupRef.current;
    if (!map || !routeGroup) return;

    routeGroup.clearLayers();

    // Determine active route points (use OSRM route if ready, or direct line if destination is selected)
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
      // Layer 1: Outer Dark Navy Border Casing (#1e1b4b)
      L.polyline(activeCoords, {
        color: '#1e1b4b',
        weight: 12,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(routeGroup);

      // Layer 2: Inner Google Maps Vibrant Electric Blue (#2962ff)
      L.polyline(activeCoords, {
        color: '#2962ff',
        weight: 8,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(routeGroup);

      // Layer 3: Inner Direction Flow Highlight
      L.polyline(activeCoords, {
        color: '#93c5fd',
        weight: 2.5,
        opacity: 0.85,
        dashArray: '6, 12',
        lineCap: 'round',
        interactive: false,
      }).addTo(routeGroup);

      // Origin White Dot
      L.circleMarker(activeCoords[0], {
        radius: 6,
        fillColor: '#ffffff',
        fillOpacity: 1,
        color: '#1e1b4b',
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
        color: '#64748b',
        weight: 5,
        opacity: 0.75,
        dashArray: '5, 8',
        interactive: false,
      }).addTo(routeGroup);
    }

    // Destination Red Pin Marker
    if (destination) {
      const destHtml = `
        <div style="display: flex; flex-direction: column; align-items: center; transform: translateY(-16px);">
          <div style="background: #ffffff; color: #0f172a; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 8px; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.25); border: 1.5px solid #ea4335; margin-bottom: 3px;">
            🏁 ${destination.name.slice(0, 24)}
          </div>
          <div style="width: 28px; height: 28px; border-radius: 9999px; background: #ea4335; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(234,67,53,0.5); display: flex; align-items: center; justify-content: center;">
            <div style="width: 8px; height: 8px; border-radius: 9999px; background: #ffffff;"></div>
          </div>
        </div>
      `;

      const destIcon = L.divIcon({
        html: destHtml,
        className: 'gmaps-dest-pin',
        iconSize: [150, 54],
        iconAnchor: [75, 44],
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

      // In Mode 1 (Overview Mode), automatically frame the full route when a new destination/route loads
      const destKey = `${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}-${activeCoords.length}`;
      if (!isNavigating && activeCoords.length >= 2 && lastFittedDestKeyRef.current !== destKey) {
        lastFittedDestKeyRef.current = destKey;
        const bounds = L.latLngBounds(activeCoords);
        map.fitBounds(bounds, {
          paddingTopLeft: [35, 130],
          paddingBottomRight: [35, 220],
          maxZoom: 16,
          animate: true,
        });
      }
    } else if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
      lastFittedDestKeyRef.current = '';
    }
  }, [destination, routeCoordinates, traveledPoints, isNavigating]);

  // 4. Transition between Mode 1 (Overview) and Mode 2 (Google Maps Driving Mode)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.invalidateSize();

    if (isNavigating && !prevNavigatingRef.current) {
      // Smoothly zoom in to street-level driving view (zoom 18) centered on the vehicle
      map.flyTo([currentLocation.latitude, currentLocation.longitude], 18, {
        animate: true,
        duration: 0.85,
      });
    } else if (!isNavigating && prevNavigatingRef.current) {
      // Zoom back out to show the entire route overview
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
        const bounds = L.latLngBounds(activeCoords);
        map.fitBounds(bounds, {
          paddingTopLeft: [35, 130],
          paddingBottomRight: [35, 220],
          maxZoom: 16,
          animate: true,
        });
      }
    }

    prevNavigatingRef.current = isNavigating;
  }, [isNavigating]);

  // 5. Update Vehicle Navigation Arrow Puck & Smooth Camera Tracking
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Google Maps iOS translucent white circle with rotating Blue Navigation Arrow
    const vehicleHtml = `
      <div style="position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
        <div style="width: 52px; height: 52px; border-radius: 9999px; background: rgba(255, 255, 255, 0.92); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25); border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; transform: rotate(${bearingDeg}deg); transition: transform 0.25s ease-out;">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" fill="#1A73E8" stroke="#1557B0" stroke-width="1.2" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    `;

    const icon = L.divIcon({
      html: vehicleHtml,
      className: 'gmaps-vehicle-puck',
      iconSize: [64, 64],
      iconAnchor: [32, 32],
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

    if (isFollowing && isNavigating) {
      map.panTo([currentLocation.latitude, currentLocation.longitude], {
        animate: true,
        duration: 0.3,
      });
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
    mapInstanceRef.current?.zoomOut();
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#e5e3df] select-none">
      {/* Native Google Maps Vietnam Tile Canvas (Zero CSS distortion, 100% natural pan & zoom) */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Zoom In / Zoom Out Controls (+ / -) */}
      <div
        className={`absolute left-4 z-[400] flex flex-col bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden ${
          isNavigating ? 'top-36' : 'bottom-56'
        }`}
      >
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors border-b border-slate-200"
          title="Phóng to bản đồ"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors"
          title="Thu nhỏ bản đồ"
        >
          <Minus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
