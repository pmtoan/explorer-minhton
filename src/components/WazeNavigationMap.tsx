import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
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

// OpenFreeMap Bright Vector Style: Crisp roads, upright labels at any rotation/pitch, natural Google Maps palette
const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';

function createGoogleSatelliteStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      'google-sat': {
        type: 'raster',
        tiles: [
          'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=vi',
          'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=vi',
          'https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=vi',
          'https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=vi',
        ],
        tileSize: 256,
        maxzoom: 20,
      },
    },
    layers: [
      {
        id: 'google-sat-layer',
        type: 'raster',
        source: 'google-sat',
        minzoom: 0,
        maxzoom: 20,
      },
    ],
  };
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
  mapStyle = 'vector3d',
  onUserDragMap,
  onMapClickSelect,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const prevNavigatingRef = useRef<boolean>(false);
  const prevStyleRef = useRef<MapLayerStyle>(mapStyle);

  // Store latest route & traveled coordinates in refs so WebGL event callbacks never use stale closures!
  const routeCoordsRef = useRef<[number, number][]>(routeCoordinates);
  routeCoordsRef.current = routeCoordinates;

  const traveledPtsRef = useRef<{ latitude: number; longitude: number }[]>(
    traveledPoints
  );
  traveledPtsRef.current = traveledPoints;

  // Draw or update the Google Maps Electric Blue Route Line on the WebGL map
  const drawRouteOnMap = () => {
    const map = mapRef.current;
    if (!map) return;

    if (!map.isStyleLoaded()) {
      map.once('idle', () => drawRouteOnMap());
      return;
    }

    const latestRoute = routeCoordsRef.current;
    const geojsonCoords = latestRoute.map(([lat, lon]) => [lon, lat]);

    const routeGeoJson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: geojsonCoords,
      },
    };

    try {
      const existingRouteSource = map.getSource(
        'gmaps-route-source'
      ) as maplibregl.GeoJSONSource | undefined;

      if (existingRouteSource) {
        existingRouteSource.setData(routeGeoJson);
      } else {
        map.addSource('gmaps-route-source', {
          type: 'geojson',
          data: routeGeoJson,
        });

        // 1. Outer Road Casing Shadow (#1e1b4b / Dark Navy)
        map.addLayer({
          id: 'gmaps-route-casing',
          type: 'line',
          source: 'gmaps-route-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#1e1b4b',
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 9, 18, 16],
            'line-opacity': 0.95,
          },
        });

        // 2. Inner Google Maps Vibrant Electric Blue (#3b3eff / #2962ff)
        map.addLayer({
          id: 'gmaps-route-core',
          type: 'line',
          source: 'gmaps-route-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#3742fa',
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 5.5, 18, 10.5],
            'line-opacity': 1,
          },
        });
      }

      // Traveled GPS Breadcrumb Trail
      const latestTraveled = traveledPtsRef.current;
      const traveledCoords = latestTraveled.map((p) => [
        p.longitude,
        p.latitude,
      ]);
      const traveledGeoJson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: traveledCoords,
        },
      };

      const existingTraveledSource = map.getSource(
        'gmaps-traveled-source'
      ) as maplibregl.GeoJSONSource | undefined;

      if (existingTraveledSource) {
        existingTraveledSource.setData(traveledGeoJson);
      } else {
        map.addSource('gmaps-traveled-source', {
          type: 'geojson',
          data: traveledGeoJson,
        });

        map.addLayer({
          id: 'gmaps-traveled-line',
          type: 'line',
          source: 'gmaps-traveled-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#64748b',
            'line-width': 6,
            'line-opacity': 0.8,
          },
        });
      }
    } catch {
      // If style is mid-transition, retry on next idle frame
      map.once('idle', () => drawRouteOnMap());
    }
  };

  // 1. Initialize WebGL MapLibre GL Map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialStyle =
      mapStyle === 'satellite' ? createGoogleSatelliteStyle() : VECTOR_STYLE_URL;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initialStyle,
      center: [currentLocation.longitude, currentLocation.latitude],
      zoom: isNavigating ? 16.8 : 14,
      pitch: isNavigating && is3DMode ? 32 : 0,
      bearing: isNavigating && is3DMode ? bearingDeg : 0,
      maxPitch: 55,
      attributionControl: false,
      dragRotate: true,
      touchPitch: true,
    });

    map.on('dragstart', (e: any) => {
      if (e.originalEvent && onUserDragMap) {
        onUserDragMap();
      }
    });

    map.on('click', (e: maplibregl.MapMouseEvent) => {
      if (onMapClickSelect) {
        onMapClickSelect(e.lngLat.lat, e.lngLat.lng);
      }
    });

    map.on('load', () => {
      drawRouteOnMap();
    });

    map.on('styledata', () => {
      drawRouteOnMap();
    });

    // Create Google Maps iOS Navigation Puck (Large translucent white circle + Blue Navigation Arrow)
    const el = document.createElement('div');
    el.style.width = '64px';
    el.style.height = '64px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.pointerEvents = 'none';

    const puck = document.createElement('div');
    puck.style.width = '54px';
    puck.style.height = '54px';
    puck.style.borderRadius = '9999px';
    puck.style.background = 'rgba(255, 255, 255, 0.92)';
    puck.style.boxShadow = '0 4px 18px rgba(0, 0, 0, 0.22)';
    puck.style.border = '1.5px solid rgba(255, 255, 255, 0.95)';
    puck.style.display = 'flex';
    puck.style.alignItems = 'center';
    puck.style.justifyContent = 'center';
    puck.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" fill="#1A73E8" stroke="#1557B0" stroke-width="1.2" stroke-linejoin="round"/>
      </svg>
    `;
    el.appendChild(puck);

    vehicleMarkerRef.current = new maplibregl.Marker({
      element: el,
      rotationAlignment: 'map',
      pitchAlignment: 'map',
    })
      .setLngLat([currentLocation.longitude, currentLocation.latitude])
      .addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Switch Map Style ONLY when user explicitly changes mapStyle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || prevStyleRef.current === mapStyle) return;
    prevStyleRef.current = mapStyle;

    const nextStyle =
      mapStyle === 'satellite' ? createGoogleSatelliteStyle() : VECTOR_STYLE_URL;

    map.setStyle(nextStyle);
    map.once('idle', () => drawRouteOnMap());
  }, [mapStyle]);

  // 3. Update Route Polyline & Destination Pin whenever routeCoordinates changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    drawRouteOnMap();

    if (destination) {
      if (!destMarkerRef.current) {
        const destEl = document.createElement('div');
        destEl.style.display = 'flex';
        destEl.style.flexDirection = 'column';
        destEl.style.alignItems = 'center';
        destEl.style.transform = 'translateY(-14px)';
        destEl.innerHTML = `
          <div class="dest-label" style="background: #ffffff; color: #0f172a; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 8px; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.25); border: 1.5px solid #ea4335; margin-bottom: 3px;">
            🏁 ${destination.name.slice(0, 24)}
          </div>
          <div style="width: 26px; height: 26px; border-radius: 9999px; background: #ea4335; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(234,67,53,0.5); display: flex; align-items: center; justify-content: center;">
            <div style="width: 8px; height: 8px; border-radius: 9999px; background: #ffffff;"></div>
          </div>
        `;
        destMarkerRef.current = new maplibregl.Marker({ element: destEl })
          .setLngLat([destination.longitude, destination.latitude])
          .addTo(map);
      } else {
        destMarkerRef.current.setLngLat([
          destination.longitude,
          destination.latitude,
        ]);
        const labelEl = destMarkerRef.current
          .getElement()
          .querySelector('.dest-label');
        if (labelEl) {
          labelEl.textContent = `🏁 ${destination.name.slice(0, 24)}`;
        }
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }

    // In Overview Mode (Mode 1), fit bounds to show the entire blue route line
    if (!isNavigating && routeCoordinates.length >= 2) {
      const bounds = new maplibregl.LngLatBounds();
      for (const [lat, lon] of routeCoordinates) {
        bounds.extend([lon, lat]);
      }
      map.fitBounds(bounds, {
        padding: { top: 120, bottom: 230, left: 50, right: 50 },
        maxZoom: 15.5,
        pitch: 0,
        bearing: 0,
        duration: 650,
      });
    }
  }, [destination, routeCoordinates, traveledPoints, isNavigating]);

  // 4. Transition between Mode 1 (Overview) and Mode 2 (Google Maps Driving Mode)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    drawRouteOnMap();

    if (isNavigating && !prevNavigatingRef.current) {
      // Natural Google Maps driving perspective (gentle 32° tilt, upright vector labels, zoom 16.8)
      map.easeTo({
        center: [currentLocation.longitude, currentLocation.latitude],
        zoom: 16.8,
        pitch: is3DMode ? 32 : 0,
        bearing: is3DMode ? bearingDeg : 0,
        offset: [0, 95],
        duration: 850,
      });
    } else if (!isNavigating && prevNavigatingRef.current) {
      if (routeCoordinates.length >= 2) {
        const bounds = new maplibregl.LngLatBounds();
        for (const [lat, lon] of routeCoordinates) {
          bounds.extend([lon, lat]);
        }
        map.fitBounds(bounds, {
          padding: { top: 120, bottom: 230, left: 50, right: 50 },
          maxZoom: 15.5,
          pitch: 0,
          bearing: 0,
          duration: 750,
        });
      } else {
        map.easeTo({
          center: [currentLocation.longitude, currentLocation.latitude],
          zoom: 14,
          pitch: 0,
          bearing: 0,
          offset: [0, 0],
          duration: 650,
        });
      }
    }

    prevNavigatingRef.current = isNavigating;
  }, [isNavigating]);

  // 5. Update Vehicle Position, Heading Rotation & Camera Follow
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLngLat([
        currentLocation.longitude,
        currentLocation.latitude,
      ]);
      vehicleMarkerRef.current.setRotation(bearingDeg);
    }

    if (isFollowing) {
      if (isNavigating) {
        map.easeTo({
          center: [currentLocation.longitude, currentLocation.latitude],
          zoom: map.getZoom() < 15.8 ? 16.8 : map.getZoom(),
          pitch: is3DMode ? 32 : 0,
          bearing: is3DMode ? bearingDeg : 0,
          offset: [0, 95],
          duration: 350,
        });
      } else if (!destination) {
        map.easeTo({
          center: [currentLocation.longitude, currentLocation.latitude],
          pitch: 0,
          bearing: 0,
          offset: [0, 0],
          duration: 350,
        });
      }
    }
  }, [
    currentLocation.latitude,
    currentLocation.longitude,
    bearingDeg,
    isFollowing,
    isNavigating,
    is3DMode,
  ]);

  const handleZoomIn = () => {
    mapRef.current?.zoomIn({ duration: 220 });
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut({ duration: 220 });
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#f8f9fa] select-none">
      <div ref={containerRef} className="w-full h-full" />

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
