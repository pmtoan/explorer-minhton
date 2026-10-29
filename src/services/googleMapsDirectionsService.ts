import { AdministrativeCheckpoint } from '../types/trip';

/**
 * Builds a multi-stop Google Maps directions link for two-wheeler travel mode.
 * Format:
 * https://www.google.com/maps/dir/?api=1&origin=LAT,LNG&destination=LAT,LNG&waypoints=LAT,LNG%7CLAT,LNG&travelmode=two-wheeler
 */
export function buildGoogleMapsMultiStopUrl(
  checkpoints: AdministrativeCheckpoint[]
): string {
  if (!checkpoints || checkpoints.length === 0) {
    return 'https://www.google.com/maps';
  }

  if (checkpoints.length === 1) {
    const cp = checkpoints[0];
    return `https://www.google.com/maps/search/?api=1&query=${cp.latitude},${cp.longitude}`;
  }

  const origin = `${checkpoints[0].latitude},${checkpoints[0].longitude}`;
  const destination = `${checkpoints[checkpoints.length - 1].latitude},${checkpoints[checkpoints.length - 1].longitude}`;

  if (checkpoints.length === 2) {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      origin
    )}&destination=${encodeURIComponent(destination)}&travelmode=two-wheeler`;
  }

  const middlePoints = checkpoints
    .slice(1, -1)
    .map((cp) => `${cp.latitude},${cp.longitude}`)
    .join('|');

  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    origin
  )}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(
    middlePoints
  )}&travelmode=two-wheeler`;
}

/**
 * Builds a Google Maps navigation link to a cafe.
 */
export function buildCafeDirectionsUrl(
  name: string,
  address?: string,
  lat?: number,
  lon?: number
): string {
  if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lon}`)}&travelmode=two-wheeler`;
  }
  const query = [name, address].filter(Boolean).join(' ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    query
  )}&travelmode=two-wheeler`;
}
