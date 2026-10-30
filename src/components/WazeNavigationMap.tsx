import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export type MapLayerStyle = 'street' | 'satellite';

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
  is3DMode = true,
  isFollowing = true,
  isNavigating = false,
  mapStyle = 'street',
  onUserDragMap,
  onMapClickSelect,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const routeBorderLineRef = useRef<L.Polyline | null>(null);
  const routeCoreLineRef = useRef<L.Polyline | null>(null);
  const traveledLineRef = useRef<L.Polyline | null>(null);
  const prevNavigatingRef = useRef<boolean>(false);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [currentLocation.latitude, currentLocation.longitude],
      zoom: isNavigating ? 18 : 15,
      zoomControl: false,
      attributionControl: false,
    });

    const tileUrl =
      mapStyle === 'satellite'
        ? 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=vi'
        : 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=vi';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
    }).addTo(map);

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

  // Switch between Street Map and Hybrid Satellite Map
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

  // Smoothly zoom in to street-level (zoom 18) when entering Google Maps "Bắt đầu" navigation mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.invalidateSize();

    if (isNavigating && !prevNavigatingRef.current) {
      map.setView([currentLocation.latitude, currentLocation.longitude], 18, {
        animate: true,
        duration: 0.9,
      });
    } else if (!isNavigating && routeCoordinates.length >= 2) {
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
    }

    prevNavigatingRef.current = isNavigating;
  }, [isNavigating, routeCoordinates]);

  // Update Google Maps 3D Navigation Chevron Puck & Camera Follow
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Google Maps iconic blue/white 3D Navigation Chevron Arrow
    const vehicleHtml = `
      <div style="position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
        <!-- Outer GPS Accuracy Halo -->
        <div style="position: absolute; width: 56px; height: 56px; border-radius: 9999px; background: rgba(66, 133, 244, 0.22); border: 1.5px solid rgba(66, 133, 244, 0.4); animation: pulse 2s infinite;"></div>
        <!-- White Puck Circle with Google Maps Blue Navigation Chevron -->
        <div style="position: relative; z-index: 10; width: 42px; height: 42px; border-radius: 9999px; background: #ffffff; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.38); display: flex; align-items: center; justify-content: center; transform: rotate(${bearingDeg}deg); transition: transform 0.3s ease-out;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" fill="#1A73E8" stroke="#1557B0" stroke-width="1.2" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    `;

    const icon = L.divIcon({
      html: vehicleHtml,
      className: 'gmaps-nav-puck',
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

    if (isFollowing) {
      if (isNavigating && map.getZoom() < 17) {
        map.setView([currentLocation.latitude, currentLocation.longitude], 18, {
          animate: true,
        });
      } else {
        map.panTo([currentLocation.latitude, currentLocation.longitude], {
          animate: true,
          duration: 0.35,
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

  // Update Destination Marker & Google Maps Royal Blue Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const counterRotation = isNavigating && is3DMode ? bearingDeg : 0;

    // Destination Red Pin (Google Maps style)
    if (destination) {
      const destHtml = `
        <div style="display: flex; flex-direction: column; align-items: center; transform: translateY(-16px) rotate(${counterRotation}deg); transition: transform 0.3s ease-out;">
          <div style="background: #ffffff; color: #1e293b; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 8px; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.28); border: 1.5px solid #ea4335; margin-bottom: 3px;">
            ${destination.name.slice(0, 24)}
          </div>
          <div style="width: 28px; height: 28px; border-radius: 9999px; background: #ea4335; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(234,67,53,0.55); display: flex; align-items: center; justify-content: center;">
            <div style="width: 8px; height: 8px; border-radius: 9999px; background: #ffffff;"></div>
          </div>
        </div>
      `;

      const destIcon = L.divIcon({
        html: destHtml,
        className: 'gmaps-dest-marker',
        iconSize: [140, 54],
        iconAnchor: [70, 44],
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

    // Route Polyline (Google Maps signature Royal Blue #4285F4 with #174EA6 casing)
    if (routeCoordinates && routeCoordinates.length >= 2) {
      if (!routeBorderLineRef.current) {
        routeBorderLineRef.current = L.polyline(routeCoordinates, {
          color: '#174ea6',
          weight: 11,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      } else {
        routeBorderLineRef.current.setLatLngs(routeCoordinates);
      }

      if (!routeCoreLineRef.current) {
        routeCoreLineRef.current = L.polyline(routeCoordinates, {
          color: '#4285f4',
          weight: 7,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      } else {
        routeCoreLineRef.current.setLatLngs(routeCoordinates);
      }
    } else {
      if (routeBorderLineRef.current) {
        routeBorderLineRef.current.remove();
        routeBorderLineRef.current = null;
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
          color: '#9aa0a6',
          weight: 5,
          opacity: 0.75,
        }).addTo(map);
      } else {
        traveledLineRef.current.setLatLngs(latlngs);
      }
    }
  }, [destination, routeCoordinates, traveledPoints, bearingDeg, isNavigating, is3DMode]);

  // In Google Maps Navigation 3D mode, we oversize the map canvas so rotating 360° never clips corners,
  // tilt it forward (rotateX 44deg), rotate the map heading-up (rotateZ -bearingDeg),
  // and offset the center down to the lower-third of the screen!
  const mapTransformStyle: React.CSSProperties =
    isNavigating && is3DMode
      ? {
          position: 'absolute',
          width: '180%',
          height: '180%',
          left: '-40%',
          top: '-28%',
          transform: `perspective(850px) rotateX(44deg) rotateZ(${-bearingDeg}deg)`,
          transformOrigin: '50% 50%',
          transition: 'transform 0.35s ease-out',
        }
      : {
          position: 'relative',
          width: '100%',
          height: '100%',
          transform: 'none',
          transition: 'transform 0.35s ease-out',
        };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#e5e3df] select-none">
      <div style={mapTransformStyle}>
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Subtle Horizon Sky Fade when in 3D Driving Perspective */}
      {isNavigating && is3DMode && (
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-slate-900/35 via-slate-900/10 to-transparent z-[400]" />
      )}
    </div>
  );
};
