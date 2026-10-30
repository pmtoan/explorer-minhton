import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  navigationRoutingService,
  calculateBearingDegrees,
} from '../src/services/navigationRoutingService';
import { geocodingService } from '../src/services/geocodingService';

describe('NavigationRoutingService & GeocodingService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('calculates compass bearing degrees accurately', () => {
    // Due North
    const north = calculateBearingDegrees(10.0, 106.0, 11.0, 106.0);
    expect(north).toBeCloseTo(0, 0);

    // Due East
    const east = calculateBearingDegrees(10.0, 106.0, 10.0, 107.0);
    expect(east).toBeCloseTo(90, 0);
  });

  it('parses OSRM route and computes live turn-by-turn progress', async () => {
    const mockOsrmResponse = {
      code: 'Ok',
      routes: [
        {
          distance: 4200,
          duration: 600,
          geometry: {
            coordinates: [
              [106.7009, 10.7769],
              [106.698, 10.7725],
            ],
          },
          legs: [
            {
              steps: [
                {
                  distance: 250,
                  name: 'Đường Lê Lợi',
                  maneuver: {
                    type: 'turn',
                    modifier: 'right',
                    location: [106.6995, 10.775],
                  },
                },
                {
                  distance: 0,
                  name: 'Chợ Bến Thành',
                  maneuver: {
                    type: 'arrive',
                    location: [106.698, 10.7725],
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockOsrmResponse,
    } as Response);

    const route = await navigationRoutingService.calculateRoute(
      { latitude: 10.7769, longitude: 106.7009 },
      { latitude: 10.7725, longitude: 106.698, name: 'Chợ Bến Thành' }
    );

    expect(route.totalDistanceKm).toBe(4.2);
    expect(route.totalDurationMin).toBe(10);
    expect(route.coordinates.length).toBe(2);
    expect(route.steps[0].instruction).toBe('Rẽ phải');
    expect(route.steps[0].roadName).toBe('Đường Lê Lợi');
    expect(route.steps[0].icon).toBe('right');

    const progress = navigationRoutingService.getLiveProgress(
      route,
      { latitude: 10.7769, longitude: 106.7009 },
      { latitude: 10.7725, longitude: 106.698, name: 'Chợ Bến Thành' }
    );

    expect(progress.nextStep.roadName).toBe('Đường Lê Lợi');
    expect(progress.distanceToNextTurnMeters).toBeGreaterThan(100);
    expect(progress.remainingDistanceKm).toBeGreaterThan(0);
  });

  it('searches real-world places via Photon API and stores recent places', async () => {
    const mockPhoton = {
      features: [
        {
          properties: {
            osm_id: 12345,
            name: 'Chợ Bến Thành',
            street: 'Lê Lợi',
            district: 'Quận 1',
            city: 'TP. Hồ Chí Minh',
          },
          geometry: {
            coordinates: [106.698, 10.7725],
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockPhoton,
    } as Response);

    const results = await geocodingService.searchPlaces('Chợ Bến Thành', {
      latitude: 10.7769,
      longitude: 106.7009,
    });

    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Chợ Bến Thành');
    expect(results[0].latitude).toBeCloseTo(10.7725, 4);
    expect(results[0].distanceKm).toBeGreaterThan(0);

    geocodingService.saveRecentPlace(results[0]);
    const recent = geocodingService.getRecentPlaces();
    expect(recent.length).toBe(1);
    expect(recent[0].name).toBe('Chợ Bến Thành');
  });
});
