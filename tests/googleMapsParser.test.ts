import { describe, it, expect } from 'vitest';
import { parseGoogleMapsUrl, inferSaigonDistrict } from '../src/services/googleMapsParser';

describe('Google Maps URL Parser & District Inference', () => {
  it('extracts place name and coordinates from standard Google Maps URL', () => {
    const url = 'https://www.google.com/maps/place/Oromia+Coffee/@10.8058,106.7328,17z/data=...';
    const parsed = parseGoogleMapsUrl(url);

    expect(parsed.name).toBe('Oromia Coffee');
    expect(parsed.latitude).toBeCloseTo(10.8058);
    expect(parsed.longitude).toBeCloseTo(106.7328);
  });

  it('infers Saigon districts accurately from text', () => {
    expect(inferSaigonDistrict('12 Hồ Xuân Hương, Võ Thị Sáu, Quận 3')).toBe('Quận 3');
    expect(inferSaigonDistrict('Thảo Điền, Quận 2')).toBe('TP. Thủ Đức');
    expect(inferSaigonDistrict('Phan Xích Long, Phú Nhuận')).toBe('Phú Nhuận');
    expect(inferSaigonDistrict('Bến Nghé, District 1')).toBe('Quận 1');
  });

  it('handles query param coordinate links', () => {
    const url = 'https://maps.google.com/?q=10.7769,106.7009';
    const parsed = parseGoogleMapsUrl(url);

    expect(parsed.latitude).toBeCloseTo(10.7769);
    expect(parsed.longitude).toBeCloseTo(106.7009);
  });
});
