import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { Plus, Minus } from 'lucide-react';

export type MapLayerStyle = 'vector3d' | 'street' | 'satellite';

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

const VECTOR_3D_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

function createGoogleRasterStyle(type: 'm' | 'y'): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      'google-tiles': {
        type: 'raster',
        tiles: [
          `https://mt0.google.com/vt/lyrs=${type}&x={x}&y={y}&z={z}&hl=vi`,
          `https://mt1.google.com/vt/lyrs=${type}&x={x}&y={y}&z={z}&hl=vi`,
          `https://mt2.google.com/vt/lyrs=${type}&x={x}&y={y}&z={z}&hl=vi`,
          `https://mt3.google.com/vt/lyrs=${type}&x={x}&y={y}&z={z}&hl=vi`,
        ],
        tileSize: 256,
        maxzoom: 20,
      },
    },
    layers: [
      {
        id: 'google-raster-layer',
        type: 'raster',
        source: 'google-tiles',
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
  const vehicleArrowElRef = useRef<HTMLDivElement | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const prevNavigatingRef = useRef<boolean>(false);

  // Helper to inject or update GeoJSON route & traveled layers on the WebGL canvas
  const syncRouteLayers = (map: maplibregl.Map) => {
    if (!map.isStyleLoaded()) return;

    const geojsonCoords = routeCoordinates.map(([lat, lon]) => [lon, lat]);
    const routeGeoJson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: geojsonCoords,
      },
    };

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

      // Outer dark blue casing (#174ea6)
      map.addLayer({
        id: 'gmaps-route-casing',
        type: 'line',
        source: 'gmaps-route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#174ea6',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 7, 18, 14],
          'line-opacity': 0.92,
        },
      });

      // Inner Google Maps Royal Blue (#4285f4)
      map.addLayer({
        id: 'gmaps-route-core',
        type: 'line',
        source: 'gmaps-route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#4285f4',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4.5, 18, 9],
          'line-opacity': 1,
        },
      });
    }

    // Traveled GPS Breadcrumb Trail
    const traveledCoords = traveledPoints.map((p) => [p.longitude, p.latitude]);
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
          'line-color': '#9aa0a6',
          'line-width': 5,
          'line-opacity': 0.75,
        },
      });
    }
  };

  // 1. Initialize WebGL MapLibre GL Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialStyle =
      mapStyle === 'vector3d'
        ? VECTOR_3D_STYLE_URL
        : mapStyle === 'satellite'
        ? createGoogleRasterStyle('y')
        : createGoogleRasterStyle('m');

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initialStyle,
      center: [currentLocation.longitude, currentLocation.latitude],
      zoom: isNavigating ? 17.8 : 14.5,
      pitch: isNavigating && is3DMode ? 58 : 0,
      bearing: isNavigating && is3DMode ? bearingDeg : 0,
      maxPitch: 70,
      attributionControl: false,
      dragRotate: true,
      touchPitch: true,
    });

    // Detect manual user pan/drag so we don't fight the user's finger
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
      syncRouteLayers(map);
    });

    map.on('styledata', () => {
      syncRouteLayers(map);
    });

    // Create Google Maps 3D Navigation Chevron Marker
    const el = document.createElement('div');
    el.style.width = '56px';
    el.style.height = '56px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.pointerEvents = 'none';

    const halo = document.createElement('div');
    halo.style.position = 'absolute';
    halo.style.width = '52px';
    halo.style.height = '52px';
    halo.style.borderRadius = '9999px';
    halo.style.background = 'rgba(26, 115, 232, 0.20)';
    halo.style.border = '1.5px solid rgba(26, 115, 232, 0.45)';
    el.appendChild(halo);

    const puck = document.createElement('div');
    puck.style.position = 'relative';
    puck.style.zIndex = '10';
    puck.style.width = '40px';
    puck.style.height = '40px';
    puck.style.borderRadius = '9999px';
    puck.style.background = '#ffffff';
    puck.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.35)';
    puck.style.display = 'flex';
    puck.style.alignItems = 'center';
    puck.style.justifyContent = 'center';
    puck.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" fill="#1A73E8" stroke="#1557B0" stroke-width="1.2" stroke-linejoin="round"/>
      </svg>
    `;
    el.appendChild(puck);
    vehicleArrowElRef.current = puck;

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

  // 2. Switch Map Style (3D Vector vs Google Street vs Google Satellite)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextStyle =
      mapStyle === 'vector3d'
        ? VECTOR_3D_STYLE_URL
        : mapStyle === 'satellite'
        ? createGoogleRasterStyle('y')
        : createGoogleRasterStyle('m');

    map.setStyle(nextStyle);
  }, [mapStyle]);

  // 3. Update Route Polyline & Destination Pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    syncRouteLayers(map);

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
          <div style="width: 28px; height: 28px; border-radius: 9999px; background: #ea4335; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(234,67,53,0.5); display: flex; align-items: center; justify-content: center;">
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

    // In Overview Mode (Mode 1), fit bounds to show the entire route cleanly
    if (!isNavigating && routeCoordinates.length >= 2) {
      const bounds = new maplibregl.LngLatBounds();
      for (const [lat, lon] of routeCoordinates) {
        bounds.extend([lon, lat]);
      }
      map.fitBounds(bounds, {
        padding: { top: 110, bottom: 220, left: 45, right: 45 },
        maxZoom: 16,
        pitch: 0,
        bearing: 0,
        duration: 700,
      });
    }
  }, [destination, routeCoordinates, traveledPoints, isNavigating]);

  // 4. Transition between Mode 1 (Overview) and Mode 2 (Google Maps 3D Driving Mode)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (isNavigating && !prevNavigatingRef.current) {
      // Swoop camera down behind the vehicle just like pressing "Bắt đầu" in Google Maps
      map.easeTo({
        center: [currentLocation.longitude, currentLocation.latitude],
        zoom: 17.8,
        pitch: is3DMode ? 58 : 0,
        bearing: is3DMode ? bearingDeg : 0,
        offset: is3DMode ? [0, 115] : [0, 0],
        duration: 1000,
      });
    } else if (!isNavigating && prevNavigatingRef.current) {
      // Return to overhead route overview
      if (routeCoordinates.length >= 2) {
        const bounds = new maplibregl.LngLatBounds();
        for (const [lat, lon] of routeCoordinates) {
          bounds.extend([lon, lat]);
        }
        map.fitBounds(bounds, {
          padding: { top: 110, bottom: 220, left: 45, right: 45 },
          maxZoom: 16,
          pitch: 0,
          bearing: 0,
          duration: 800,
        });
      } else {
        map.easeTo({
          center: [currentLocation.longitude, currentLocation.latitude],
          zoom: 14.5,
          pitch: 0,
          bearing: 0,
          offset: [0, 0],
          duration: 700,
        });
      }
    }

    prevNavigatingRef.current = isNavigating;
  }, [isNavigating]);

  // 5. Update Vehicle Position, Heading Rotation & Smooth Camera Tracking
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
          zoom: map.getZoom() < 16.5 ? 17.8 : map.getZoom(),
          pitch: is3DMode ? 58 : 0,
          bearing: is3DMode ? bearingDeg : 0,
          offset: is3DMode ? [0, 115] : [0, 0],
          duration: 380,
        });
      } else if (!destination) {
        map.easeTo({
          center: [currentLocation.longitude, currentLocation.latitude],
          pitch: 0,
          bearing: 0,
          offset: [0, 0],
          duration: 380,
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
    mapRef.current?.zoomIn({ duration: 250 });
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut({ duration: 250 });
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#f1f3f4] select-none">
      {/* Native WebGL 3D Map Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Natural Sky Horizon Atmosphere Gradient when in 3D Driving Mode */}
      {isNavigating && is3DMode && (
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 h-28 z-[10]"
          style={{
            background:
              'linear-gradient(180deg, rgba(219, 234, 254, 0.85) 0%, rgba(239, 246, 255, 0.35) 55%, rgba(255, 255, 255, 0) 100%)',
          }}
        />
      )}

      {/* Floating Zoom In / Zoom Out Controls (+ / -) */}
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
