import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface WazeNavigationMapProps {
  currentLocation: { latitude: number; longitude: number };
  destination?: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  routeCoordinates?: [number, number][];
  traveledPoints?: { latitude: number; longitude: number }[];
  bearingDeg?: number;
  is3DMode?: boolean;
  isFollowing?: boolean;
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
  onUserDragMap,
  onMapClickSelect,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const routeGlowLineRef = useRef<L.Polyline | null>(null);
  const routeCoreLineRef = useRef<L.Polyline | null>(null);
  const traveledLineRef = useRef<L.Polyline | null>(null);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [currentLocation.latitude, currentLocation.longitude],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    // High-contrast dark cockpit map tiles (CartoDB Dark Matter / Voyager fallback)
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        subdomains: 'abcd',
      }
    ).addTo(map);

    map.on('dragstart', () => {
      if (onUserDragMap) {
        onUserDragMap();
      }
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClickSelect) {
        onMapClickSelect(e.latlng.lat, e.latlng.lng);
      }
    });

    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Vehicle Marker & Camera Follow
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const vehicleHtml = `
      <div style="position: relative; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center;">
        <!-- Pulsing GPS Halo -->
        <div style="position: absolute; inset: 2px; border-radius: 9999px; background: rgba(16, 185, 129, 0.25); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <!-- Direction Cone -->
        <div style="position: absolute; width: 48px; height: 48px; transform: rotate(${bearingDeg}deg); transition: transform 0.35s ease-out; display: flex; justify-content: center;">
          <div style="width: 0; height: 0; border-left: 12px solid transparent; border-right: 12px solid transparent; border-bottom: 22px solid rgba(16, 185, 129, 0.45); margin-top: -10px; filter: blur(1px);"></div>
        </div>
        <!-- Waze Moto Avatar Puck -->
        <div style="position: relative; z-index: 10; width: 38px; height: 38px; border-radius: 9999px; background: linear-gradient(135deg, #10b981, #047857); border: 3px solid #ffffff; box-shadow: 0 6px 16px rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; font-size: 19px;">
          🛵
        </div>
      </div>
    `;

    const icon = L.divIcon({
      html: vehicleHtml,
      className: 'waze-vehicle-marker',
      iconSize: [52, 52],
      iconAnchor: [26, 26],
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

    if (isFollowing) {
      map.panTo([currentLocation.latitude, currentLocation.longitude], {
        animate: true,
        duration: 0.45,
      });
    }
  }, [currentLocation.latitude, currentLocation.longitude, bearingDeg, isFollowing]);

  // Update Destination Marker & Route Polylines
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Destination Pin
    if (destination) {
      const destHtml = `
        <div style="display: flex; flex-direction: column; align-items: center; transform: translateY(-14px);">
          <div style="background: #0f172a; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 8px; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.35); border: 1px solid #10b981; margin-bottom: 2px;">
            🏁 ${destination.name.slice(0, 22)}
          </div>
          <div style="width: 30px; height: 30px; border-radius: 9999px; background: #ef4444; border: 3px solid #fff; box-shadow: 0 4px 12px rgba(239,68,68,0.5); display: flex; align-items: center; justify-content: center; font-size: 14px;">
            📍
          </div>
        </div>
      `;

      const destIcon = L.divIcon({
        html: destHtml,
        className: 'waze-dest-marker',
        iconSize: [120, 50],
        iconAnchor: [60, 42],
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
    } else if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
    }

    // Route Polyline (Glowing Waze Neon Line)
    if (routeCoordinates && routeCoordinates.length >= 2) {
      if (!routeGlowLineRef.current) {
        routeGlowLineRef.current = L.polyline(routeCoordinates, {
          color: '#06b6d4',
          weight: 12,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      } else {
        routeGlowLineRef.current.setLatLngs(routeCoordinates);
      }

      if (!routeCoreLineRef.current) {
        routeCoreLineRef.current = L.polyline(routeCoordinates, {
          color: '#10b981',
          weight: 6,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      } else {
        routeCoreLineRef.current.setLatLngs(routeCoordinates);
      }
    } else {
      if (routeGlowLineRef.current) {
        routeGlowLineRef.current.remove();
        routeGlowLineRef.current = null;
      }
      if (routeCoreLineRef.current) {
        routeCoreLineRef.current.remove();
        routeCoreLineRef.current = null;
      }
    }

    // Traveled GPS Breadcrumb Line
    if (traveledPoints && traveledPoints.length >= 2) {
      const latlngs: [number, number][] = traveledPoints.map((p) => [
        p.latitude,
        p.longitude,
      ]);
      if (!traveledLineRef.current) {
        traveledLineRef.current = L.polyline(latlngs, {
          color: '#6366f1',
          weight: 4,
          opacity: 0.75,
          dashArray: '6, 8',
        }).addTo(map);
      } else {
        traveledLineRef.current.setLatLngs(latlngs);
      }
    }
  }, [destination, routeCoordinates, traveledPoints]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-900 select-none">
      {/* 2.5D Tilted Map Wrapper */}
      <div
        className="w-full h-full transition-transform duration-500 ease-out"
        style={{
          transform: is3DMode
            ? 'perspective(900px) rotateX(22deg) scale(1.12)'
            : 'none',
          transformOrigin: 'center 70%',
        }}
      >
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Top Subtle Horizon Gradient for 2.5D Depth */}
      {is3DMode && (
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-slate-950/60 via-slate-900/20 to-transparent z-[400]" />
      )}
    </div>
  );
};
