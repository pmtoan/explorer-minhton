import { SaigonDistrict } from '../types/cafe';

export interface ParsedGoogleMapsInfo {
  name: string;
  latitude?: number;
  longitude?: number;
  district: SaigonDistrict | string;
  address?: string;
  originalUrl: string;
}

const DISTRICT_KEYWORDS: { [key: string]: SaigonDistrict } = {
  'quận 1': 'Quận 1',
  'quan 1': 'Quận 1',
  'district 1': 'Quận 1',
  'bến nghé': 'Quận 1',
  'bến thành': 'Quận 1',
  'quận 3': 'Quận 3',
  'quan 3': 'Quận 3',
  'district 3': 'Quận 3',
  'võ thị sáu': 'Quận 3',
  'quận 4': 'Quận 4',
  'quan 4': 'Quận 4',
  'quận 5': 'Quận 5',
  'quan 5': 'Quận 5',
  'quận 7': 'Quận 7',
  'quan 7': 'Quận 7',
  'phú mỹ hưng': 'Quận 7',
  'quận 10': 'Quận 10',
  'quan 10': 'Quận 10',
  'bình thạnh': 'Bình Thạnh',
  'binh thanh': 'Bình Thạnh',
  'phú nhuận': 'Phú Nhuận',
  'phu nhuan': 'Phú Nhuận',
  'tân bình': 'Tân Bình',
  'tan binh': 'Tân Bình',
  'thủ đức': 'TP. Thủ Đức',
  'thu duc': 'TP. Thủ Đức',
  'thảo điền': 'TP. Thủ Đức',
  'quận 2': 'TP. Thủ Đức',
  'quận 9': 'TP. Thủ Đức',
  'gò vấp': 'Gò Vấp',
  'go vap': 'Gò Vấp',
  'quận 11': 'Quận 11',
  'quận 12': 'Quận 12',
  'bình tân': 'Bình Tân',
  'nhà bè': 'Nhà Bè',
};

/**
 * Infers Saigon District from a string (name, address, or url snippet).
 */
export function inferSaigonDistrict(text: string): SaigonDistrict | string {
  const lower = text.toLowerCase();
  for (const [key, district] of Object.entries(DISTRICT_KEYWORDS)) {
    if (lower.includes(key)) {
      return district;
    }
  }
  return 'Khác';
}

/**
 * Parses Google Maps URL and extracts place details.
 */
export function parseGoogleMapsUrl(url: string): ParsedGoogleMapsInfo {
  const trimmed = url.trim();
  let name = '';
  let latitude: number | undefined;
  let longitude: number | undefined;
  let district: SaigonDistrict | string = 'Khác';

  try {
    // 1. Check coordinates @lat,lng,zoom
    const atCoordMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atCoordMatch) {
      latitude = parseFloat(atCoordMatch[1]);
      longitude = parseFloat(atCoordMatch[2]);
    }

    // 2. Check protobuf format !3dLAT!4dLNG
    if (!latitude || !longitude) {
      const protoMatch = trimmed.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      if (protoMatch) {
        latitude = parseFloat(protoMatch[1]);
        longitude = parseFloat(protoMatch[2]);
      }
    }

    // 3. Check query param ?q=LAT,LNG
    if (!latitude || !longitude) {
      const qCoordMatch = trimmed.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qCoordMatch) {
        latitude = parseFloat(qCoordMatch[1]);
        longitude = parseFloat(qCoordMatch[2]);
      }
    }

    // 4. Extract place name from /place/NAME/
    const placeMatch = trimmed.match(/\/place\/([^/@?]+)/);
    if (placeMatch) {
      name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    } else {
      // Check ?q=NAME
      const qMatch = trimmed.match(/[?&]q=([^&]+)/);
      if (qMatch && (!latitude || isNaN(Number(qMatch[1])))) {
        name = decodeURIComponent(qMatch[1].replace(/\+/g, ' '));
      }
    }

    // 5. If it's a short link or simple name
    if (!name && (trimmed.includes('maps.app.goo.gl') || trimmed.includes('goo.gl/maps'))) {
      name = 'Quán Cafe Mới';
    }

    // Clean up name if it has full address appended
    if (name.includes(',')) {
      const parts = name.split(',');
      name = parts[0].trim();
      const addrSnippet = parts.slice(1).join(',').trim();
      district = inferSaigonDistrict(name + ' ' + addrSnippet);
    } else {
      district = inferSaigonDistrict(name + ' ' + trimmed);
    }
  } catch {
    name = name || 'Quán Cafe';
  }

  return {
    name: name || 'Quán Cafe Mới',
    latitude,
    longitude,
    district,
    address: district !== 'Khác' ? `${district}, TP. Hồ Chí Minh` : 'TP. Hồ Chí Minh',
    originalUrl: trimmed,
  };
}
