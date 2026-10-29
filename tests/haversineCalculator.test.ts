import { describe, it, expect } from 'vitest';
import {
  calculateDistanceKm,
  calculateRouteDistanceKm,
  findNearestBoundary,
} from '../src/services/geoService';

describe('Geo & Haversine Distance Services', () => {
  it('calculates accurate distance between Saigon and Vung Tau', () => {
    // Saigon (10.7769, 106.7009) to Vung Tau (10.3460, 107.0843)
    const dist = calculateDistanceKm(10.7769, 106.7009, 10.3460, 107.0843);
    // As the crow flies is approximately 63-65 km
    expect(dist).toBeGreaterThan(60);
    expect(dist).toBeLessThan(70);
  });

  it('calculates total route distance correctly for multiple points', () => {
    const points = [
      { latitude: 10.7769, longitude: 106.7009 },
      { latitude: 10.7631, longitude: 106.7825 },
      { latitude: 10.7258, longitude: 106.8791 },
    ];
    const totalKm = calculateRouteDistanceKm(points);
    expect(totalKm).toBeGreaterThan(15);
    expect(totalKm).toBeLessThan(35);
  });

  it('identifies nearest administrative landmark accurately', () => {
    // Coordinate near Thao Dien, Thu Duc
    const boundary = findNearestBoundary(10.8055, 106.7325);
    expect(boundary).not.toBeNull();
    expect(boundary?.shortName).toContain('Thảo Điền');
  });
});
