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

  const onUserDragRef = useRef(onUserDragMap);
  onUserDragRef.current = onUserDragMap;

  const onMapClickRef = useRef(onMapClickSelect);
  onMapClickRef.current = onMapClickSelect;

  /**
   * Compute the camera center AHEAD of the vehicle along its travel bearing (`bearingDeg`),
   * so that the vehicle sits in the lower-third of the screen and 70% of the screen ahead
   * shows the upcoming blue route (works for North, South, East, West, or any angle!).
   */
  const getDrivingCameraCenter = (
    map: L.Map,
    lat: number,
    lon: number,
    bearing: number,
    targetZoom: number
  ): L.LatLng => {
    const size = map.getSize();
    const offsetPx = size.y > 0 ? Math.min(140, size.y * 0.2) : 110;
    const rad = (bearing * Math.PI) / 180;
    // Unit vector pointing ahead along compass bearing in screen pixels (x: East, y: South)
    const dx = Math.sin(rad) * offsetPx;
    const dy = -Math.cos(rad) * offsetPx;

    const projected = map.project([lat, lon], targetZoom);
    const shifted = L.point(projected.x + dx, projected.y + dy);
    return map.unproject(shifted, targetZoom);
  };

  /**
   * Force-snap the camera to street-level driving view (zoom 18) locked onto the vehicle.
   * Uses `map.stop()` + `animate: false` to bypass Leaflet's `_animatingZoom` guard that drops zoom changes.
   */
  const snapCameraToVehicleStreetView = (
    map: L.Map,
    lat: number,
    lon: number,
    bearing: number,
    targetZoom = 18
  ) => {
    map.stop();
    map.invalidateSize({ animate: false });
    const targetCenter = getDrivingCameraCenter(map, lat, lon, bearing, targetZoom);
    map.setView(targetCenter, targetZoom, { animate: false });
  };

  // 1. Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [currentLocation.latitude, currentLocation.longitude],
      zoom: isNavigating ? 18 : 14,
      zoomControl: false,
      attributionControl: false,
      renderer: L.svg({ padding: 1.5 }),
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
    }).addTo(map);
  }, [mapStyle]);

  // 3. Draw Google Maps Electric Blue Route Line & Destination Marker
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
      // Outer Dark Navy Border Casing (#1e1b4b)
      L.polyline(activeCoords, {
        color: '#1e1b4b',
        weight: isNavigating ? 16 : 11,
        opacity: 0.92,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(routeGroup);

      // Inner Google Maps Vibrant Electric Blue (#3742fa)
      L.polyline(activeCoords, {
        color: '#3742fa',
        weight: isNavigating ? 11 : 7,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(routeGroup);

      // Direction Flow Arrows Highlight
      L.polyline(activeCoords, {
        color: '#93c5fd',
        weight: isNavigating ? 3.5 : 2,
        opacity: 0.85,
        dashArray: '6, 14',
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

      // ONLY fitBounds when in Mode 1 (Overview Mode, isNavigating === false)
      const destKey = `${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}-${activeCoords.length}`;
      if (
        !isNavigating &&
        activeCoords.length >= 2 &&
        lastFittedDestKeyRef.current !== destKey
      ) {
        lastFittedDestKeyRef.current = destKey;
        map.stop();
        const bounds = L.latLngBounds(activeCoords);
        map.fitBounds(bounds, {
          paddingTopLeft: [35, 130],
          paddingBottomRight: [35, 220],
          maxZoom: 15,
          animate: false,
        });
      }
    } else if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
      lastFittedDestKeyRef.current = '';
    }
  }, [destination, routeCoordinates, traveledPoints, isNavigating]);

  // 4. Explicit "Về giữa" (Re-center) Trigger Effect
  useEffect(() => {
    if (recenterTrigger === 0) return;
    const map = mapInstanceRef.current;
    if (!map) return;

    snapCameraToVehicleStreetView(
      map,
      currentLocation.latitude,
      currentLocation.longitude,
      bearingDeg,
      18
    );
  }, [recenterTrigger]);

  // 5. Unified Camera Controller: Mode 1 (Overview) vs Mode 2 (Close-up Street Driving View)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Update Google Maps Blue Navigation Arrow Puck
    const puckSize = isNavigating ? 68 : 54;
    const innerSize = isNavigating ? 56 : 44;
    const svgSize = isNavigating ? 34 : 26;

    const vehicleHtml = `
      <div style="position: relative; width: ${puckSize}px; height: ${puckSize}px; display: flex; align-items: center; justify-content: center;">
        <div style="width: ${innerSize}px; height: ${innerSize}px; border-radius: 9999px; background: rgba(255, 255, 255, 0.95); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.30); border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; transform: rotate(${bearingDeg}deg); transition: transform 0.25s ease-out;">
          <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" fill="#1A73E8" stroke="#1557B0" stroke-width="1.2" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    `;

    const icon = L.divIcon({
      html: vehicleHtml,
      className: 'gmaps-vehicle-puck',
      iconSize: [puckSize, puckSize],
      iconAnchor: [puckSize / 2, puckSize / 2],
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
        bearingDeg,
        18
      );
      const timer = setTimeout(() => {
        if (mapInstanceRef.current) {
          snapCameraToVehicleStreetView(
            mapInstanceRef.current,
            currentLocation.latitude,
            currentLocation.longitude,
            bearingDeg,
            18
          );
        }
      }, 120);
      return () => clearTimeout(timer);
    }

    // Transition from Driving Mode (Mode 2) -> Overview (Mode 1)
    if (!isNavigating && prevNavigatingRef.current) {
      prevNavigatingRef.current = false;
      map.stop();
      map.invalidateSize({ animate: false });
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
          maxZoom: 15,
          animate: false,
        });
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
          bearingDeg,
          18
        );
      } else {
        const targetCenter = getDrivingCameraCenter(
          map,
          currentLocation.latitude,
          currentLocation.longitude,
          bearingDeg,
          currentZoom
        );
        map.panTo(targetCenter, {
          animate: true,
          duration: 0.28,
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

  // Gentle 26° perspective tilt in 3D Driving Mode
  const drivingPerspectiveStyle: React.CSSProperties =
    isNavigating && is3DMode
      ? {
          width: '100%',
          height: '100%',
          transform: 'perspective(1100px) rotateX(26deg) scale(1.10)',
          transformOrigin: '50% 68%',
          transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
        }
      : {
          width: '100%',
          height: '100%',
          transform: 'none',
          transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
        };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#e5e3df] select-none">
      <div style={drivingPerspectiveStyle}>
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

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
