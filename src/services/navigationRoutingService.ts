import { calculateDistanceKm as haversineDistanceKm } from './geoService';

export type ManeuverIconType =
  | 'straight'
  | 'left'
  | 'right'
  | 'slight-left'
  | 'slight-right'
  | 'uturn'
  | 'roundabout'
  | 'arrive';

export interface NavigationStep {
  instruction: string;
  roadName: string;
  distanceMeters: number;
  icon: ManeuverIconType;
  latitude: number;
  longitude: number;
}

export interface CalculatedRoute {
  coordinates: [number, number][]; // [lat, lon] pairs for Leaflet
  totalDistanceKm: number;
  totalDurationMin: number;
  etaText: string;
  steps: NavigationStep[];
}

export interface LiveNavigationProgress {
  nextStep: NavigationStep;
  distanceToNextTurnMeters: number;
  remainingDistanceKm: number;
  remainingDurationMin: number;
  etaText: string;
  bearingDeg: number;
}

/**
 * Calculate compass bearing (0-360 degrees) from point 1 to point 2
 */
export function calculateBearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const y = Math.sin(dLon) * Math.cos(rLat2);
  const x =
    Math.cos(rLat1) * Math.sin(rLat2) -
    Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);

  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

function formatEtaFromMinutes(minutesFromNow: number): string {
  const etaDate = new Date(Date.now() + minutesFromNow * 60000);
  const hours = String(etaDate.getHours()).padStart(2, '0');
  const mins = String(etaDate.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

function mapOsrmManeuverToVietnamese(
  type?: string,
  modifier?: string
): { instruction: string; icon: ManeuverIconType } {
  if (type === 'arrive') {
    return { instruction: 'Đến điểm đích', icon: 'arrive' };
  }
  if (type === 'roundabout' || type === 'rotary') {
    return { instruction: 'Vào vòng xuyến', icon: 'roundabout' };
  }
  if (modifier === 'uturn') {
    return { instruction: 'Quay đầu xe', icon: 'uturn' };
  }
  if (modifier === 'left' || modifier === 'sharp left') {
    return { instruction: 'Rẽ trái', icon: 'left' };
  }
  if (modifier === 'right' || modifier === 'sharp right') {
    return { instruction: 'Rẽ phải', icon: 'right' };
  }
  if (modifier === 'slight left') {
    return { instruction: 'Chếch sang trái', icon: 'slight-left' };
  }
  if (modifier === 'slight right') {
    return { instruction: 'Chếch sang phải', icon: 'slight-right' };
  }
  return { instruction: 'Đi thẳng theo đường', icon: 'straight' };
}

class NavigationRoutingService {
  /**
   * Calculate real turn-by-turn route between origin and destination using OSRM
   */
  public async calculateRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number; name?: string }
  ): Promise<CalculatedRoute> {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=true`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`OSRM status ${response.status}`);
      }

      const data = await response.json();
      const route = data?.routes?.[0];
      if (!route || !route.geometry?.coordinates) {
        throw new Error('No OSRM route found');
      }

      const coordinates: [number, number][] = route.geometry.coordinates.map(
        (coord: [number, number]) => [coord[1], coord[0]]
      );

      const totalDistanceKm = Number((route.distance / 1000).toFixed(1));
      const totalDurationMin = Math.max(1, Math.round(route.duration / 60));

      const rawSteps: any[] = route.legs?.[0]?.steps || [];
      const steps: NavigationStep[] = rawSteps.map((s) => {
        const maneuver = s.maneuver || {};
        const loc: [number, number] = maneuver.location || [
          destination.longitude,
          destination.latitude,
        ];
        const { instruction, icon } = mapOsrmManeuverToVietnamese(
          maneuver.type,
          maneuver.modifier
        );
        const roadName =
          s.name && s.name.trim().length > 0
            ? s.name.trim()
            : s.ref
            ? s.ref
            : destination.name || 'Lộ trình chính';

        return {
          instruction,
          roadName,
          distanceMeters: Math.round(s.distance || 0),
          icon,
          latitude: loc[1],
          longitude: loc[0],
        };
      });

      if (steps.length === 0) {
        steps.push({
          instruction: 'Đi thẳng tới điểm đích',
          roadName: destination.name || 'Điểm đến',
          distanceMeters: Math.round(totalDistanceKm * 1000),
          icon: 'straight',
          latitude: destination.latitude,
          longitude: destination.longitude,
        });
      }

      return {
        coordinates,
        totalDistanceKm,
        totalDurationMin,
        etaText: formatEtaFromMinutes(totalDurationMin),
        steps,
      };
    } catch (err) {
      console.warn('OSRM routing fallback to direct vector:', err);
      const directDistKm = Number(
        Math.max(
          0.1,
          haversineDistanceKm(
            origin.latitude,
            origin.longitude,
            destination.latitude,
            destination.longitude
          ) * 1.25
        ).toFixed(1)
      );
      const estMinutes = Math.max(1, Math.round((directDistKm / 32) * 60));

      return {
        coordinates: [
          [origin.latitude, origin.longitude],
          [destination.latitude, destination.longitude],
        ],
        totalDistanceKm: directDistKm,
        totalDurationMin: estMinutes,
        etaText: formatEtaFromMinutes(estMinutes),
        steps: [
          {
            instruction: 'Di chuyển theo lộ trình',
            roadName: destination.name || 'Điểm đích',
            distanceMeters: Math.round(directDistKm * 1000),
            icon: 'straight',
            latitude: destination.latitude,
            longitude: destination.longitude,
          },
          {
            instruction: 'Đến điểm đích',
            roadName: destination.name || 'Điểm đích',
            distanceMeters: 0,
            icon: 'arrive',
            latitude: destination.latitude,
            longitude: destination.longitude,
          },
        ],
      };
    }
  }

  /**
   * Compute live progress along the calculated route based on current GPS coordinates
   */
  public getLiveProgress(
    route: CalculatedRoute,
    currentLocation: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number; name?: string }
  ): LiveNavigationProgress {
    const remainingDirectKm = haversineDistanceKm(
      currentLocation.latitude,
      currentLocation.longitude,
      destination.latitude,
      destination.longitude
    );

    const remainingDistanceKm = Number(
      Math.min(route.totalDistanceKm, Math.max(0.1, remainingDirectKm * 1.15)).toFixed(1)
    );

    const ratio =
      route.totalDistanceKm > 0
        ? Math.min(1, remainingDistanceKm / route.totalDistanceKm)
        : 0;

    const remainingDurationMin = Math.max(
      1,
      Math.round(route.totalDurationMin * ratio)
    );

    // Find closest upcoming step
    let chosenStep = route.steps[0];
    let minStepDistKm = Infinity;

    for (const step of route.steps) {
      const dKm = haversineDistanceKm(
        currentLocation.latitude,
        currentLocation.longitude,
        step.latitude,
        step.longitude
      );
      // Pick the nearest maneuver ahead (> 15m away)
      if (dKm >= 0.015 && dKm < minStepDistKm) {
        minStepDistKm = dKm;
        chosenStep = step;
      }
    }

    const distanceToNextTurnMeters =
      minStepDistKm < Infinity
        ? Math.max(10, Math.round(minStepDistKm * 1000))
        : chosenStep.distanceMeters;

    // Calculate bearing towards next coordinate along route
    let targetLat = chosenStep.latitude;
    let targetLon = chosenStep.longitude;

    if (route.coordinates.length >= 2) {
      let closestIdx = 0;
      let closestDist = Infinity;
      for (let i = 0; i < route.coordinates.length; i++) {
        const [lat, lon] = route.coordinates[i];
        const d = haversineDistanceKm(
          currentLocation.latitude,
          currentLocation.longitude,
          lat,
          lon
        );
        if (d < closestDist) {
          closestDist = d;
          closestIdx = i;
        }
      }
      const nextIdx = Math.min(route.coordinates.length - 1, closestIdx + 2);
      targetLat = route.coordinates[nextIdx][0];
      targetLon = route.coordinates[nextIdx][1];
    }

    const bearingDeg = calculateBearingDegrees(
      currentLocation.latitude,
      currentLocation.longitude,
      targetLat,
      targetLon
    );

    return {
      nextStep: chosenStep,
      distanceToNextTurnMeters,
      remainingDistanceKm,
      remainingDurationMin,
      etaText: formatEtaFromMinutes(remainingDurationMin),
      bearingDeg,
    };
  }
}

export const navigationRoutingService = new NavigationRoutingService();
