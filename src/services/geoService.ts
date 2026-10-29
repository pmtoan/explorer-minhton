import { ADMIN_BOUNDARIES_VN, AdministrativeBoundary } from '../data/adminBoundariesVn';
import { AdminLevel, AdministrativeCheckpoint } from '../types/trip';

/**
 * Calculates Haversine distance between two coordinates in kilometers.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculates total route distance from a sequence of coordinate points.
 */
export function calculateRouteDistanceKm(
  points: Array<{ latitude: number; longitude: number }>
): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateDistanceKm(
      points[i].latitude,
      points[i].longitude,
      points[i + 1].latitude,
      points[i + 1].longitude
    );
  }
  return Math.round(total * 10) / 10;
}

/**
 * Finds the nearest administrative boundary landmark from offline VN boundaries.
 */
export function findNearestBoundary(
  lat: number,
  lon: number,
  maxDistanceKm = 35
): AdministrativeBoundary | null {
  let nearest: AdministrativeBoundary | null = null;
  let minDistance = Infinity;

  for (const boundary of ADMIN_BOUNDARIES_VN) {
    const dist = calculateDistanceKm(lat, lon, boundary.latitude, boundary.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = boundary;
    }
  }

  if (minDistance <= maxDistanceKm) {
    return nearest;
  }
  return null;
}

/**
 * Reverse geocodes coordinates via OpenStreetMap Nominatim with offline fallback.
 */
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<{ name: string; shortName: string; level: AdminLevel }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'vi,en',
        'User-Agent': 'MotoTripCafeExplorer/4.0',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const addr = data.address || {};
      const suburb = addr.suburb || addr.quarter || addr.neighbourhood || addr.ward;
      const district = addr.city_district || addr.district || addr.county || addr.town;
      const city = addr.city || addr.state || addr.province;

      const parts = [suburb, district, city].filter(Boolean);
      const name = parts.length > 0 ? parts.join(', ') : data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      const shortName = district || suburb || city || 'Điểm mốc';

      let level: AdminLevel = 'landmark';
      if (addr.state || addr.province) level = 'province';
      if (addr.city_district || addr.district) level = 'district';
      if (suburb) level = 'ward';

      return { name, shortName, level };
    }
  } catch {
    // Network error or timeout: Fallback to offline administrative boundary database
  }

  const fallback = findNearestBoundary(lat, lon);
  if (fallback) {
    return {
      name: fallback.name,
      shortName: fallback.shortName,
      level: fallback.level,
    };
  }

  return {
    name: `Tọa độ: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    shortName: `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
    level: 'landmark',
  };
}

/**
 * Creates an AdministrativeCheckpoint from lat/lon coordinates.
 */
export async function createCheckpointFromLocation(
  lat: number,
  lon: number,
  formattedTime?: string
): Promise<AdministrativeCheckpoint> {
  const geocoded = await reverseGeocode(lat, lon);
  const now = new Date();
  const timeStr =
    formattedTime ||
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return {
    id: `cp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: geocoded.name,
    shortName: geocoded.shortName,
    level: geocoded.level,
    latitude: lat,
    longitude: lon,
    timestamp: timeStr,
  };
}
