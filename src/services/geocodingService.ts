import { calculateDistanceKm as haversineDistanceKm } from './geoService';

export interface GeocodingPlace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  category?: string;
}

const RECENT_PLACES_KEY = 'explorer_minton_recent_destinations_v1';

interface PhotonFeature {
  properties: {
    osm_id?: number;
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
    osm_value?: string;
  };
  geometry: {
    coordinates: [number, number]; // [lon, lat]
  };
}

class GeocodingService {
  /**
   * Search real-world places using Photon OpenStreetMap Geocoding API
   * Biased towards the user's current location (or Ho Chi Minh City by default).
   */
  public async searchPlaces(
    query: string,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<GeocodingPlace[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      return [];
    }

    const biasLat = userLocation?.latitude ?? 10.7769;
    const biasLon = userLocation?.longitude ?? 106.7009;

    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        trimmed
      )}&lat=${biasLat}&lon=${biasLon}&limit=8`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Geocoding HTTP status ${response.status}`);
      }

      const data = await response.json();
      const features: PhotonFeature[] = Array.isArray(data?.features) ? data.features : [];

      const places: GeocodingPlace[] = features
        .filter(
          (f) =>
            f.geometry &&
            Array.isArray(f.geometry.coordinates) &&
            f.geometry.coordinates.length >= 2
        )
        .map((f, index) => {
          const [lon, lat] = f.geometry.coordinates;
          const props = f.properties || {};

          const primaryName =
            props.name ||
            [props.housenumber, props.street].filter(Boolean).join(' ') ||
            props.district ||
            trimmed;

          const addressParts = [
            props.housenumber && props.street
              ? `${props.housenumber} ${props.street}`
              : props.street,
            props.district,
            props.city || props.state,
            props.country,
          ].filter((part) => Boolean(part) && part !== primaryName);

          const formattedAddress =
            addressParts.length > 0 ? addressParts.join(', ') : 'Việt Nam';

          const distanceKm = userLocation
            ? Number(
                haversineDistanceKm(
                  userLocation.latitude,
                  userLocation.longitude,
                  lat,
                  lon
                ).toFixed(1)
              )
            : undefined;

          return {
            id: `photon-${props.osm_id || index}-${lat.toFixed(4)}`,
            name: primaryName,
            address: formattedAddress,
            latitude: lat,
            longitude: lon,
            distanceKm,
            category: props.osm_value,
          };
        });

      return places;
    } catch (err) {
      console.warn('Photon geocoding fallback triggered:', err);
      return this.searchNominatimFallback(trimmed, userLocation);
    }
  }

  private async searchNominatimFallback(
    query: string,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<GeocodingPlace[]> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&countrycodes=vn&limit=6`;

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });
      if (!response.ok) return [];

      const items = await response.json();
      if (!Array.isArray(items)) return [];

      return items.map((item: any, idx: number) => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const parts = String(item.display_name || query).split(',').map((s) => s.trim());
        const name = parts[0] || query;
        const address = parts.slice(1, 4).join(', ') || item.display_name;

        const distanceKm = userLocation
          ? Number(
              haversineDistanceKm(
                userLocation.latitude,
                userLocation.longitude,
                lat,
                lon
              ).toFixed(1)
            )
          : undefined;

        return {
          id: `nom-${item.place_id || idx}`,
          name,
          address,
          latitude: lat,
          longitude: lon,
          distanceKm,
        };
      });
    } catch {
      return [];
    }
  }

  public getRecentPlaces(): GeocodingPlace[] {
    try {
      const raw = localStorage.getItem(RECENT_PLACES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public saveRecentPlace(place: GeocodingPlace): void {
    try {
      const existing = this.getRecentPlaces().filter(
        (p) =>
          p.name.toLowerCase() !== place.name.toLowerCase() ||
          Math.abs(p.latitude - place.latitude) > 0.001
      );
      const updated = [place, ...existing].slice(0, 6);
      localStorage.setItem(RECENT_PLACES_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage quota errors
    }
  }
}

export const geocodingService = new GeocodingService();
