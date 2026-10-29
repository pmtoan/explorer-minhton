import { describe, it, expect } from 'vitest';
import {
  buildGoogleMapsMultiStopUrl,
  buildCafeDirectionsUrl,
} from '../src/services/googleMapsDirectionsService';
import { AdministrativeCheckpoint } from '../src/types/trip';

describe('Google Maps Directions Service', () => {
  const mockCheckpoints: AdministrativeCheckpoint[] = [
    {
      id: '1',
      name: 'Quận 1',
      shortName: 'Q1',
      level: 'district',
      latitude: 10.7769,
      longitude: 106.7009,
      timestamp: '05:30',
    },
    {
      id: '2',
      name: 'Phà Cát Lái',
      shortName: 'Cát Lái',
      level: 'landmark',
      latitude: 10.7631,
      longitude: 106.7825,
      timestamp: '06:05',
    },
    {
      id: '3',
      name: 'Vũng Tàu',
      shortName: 'Vũng Tàu',
      level: 'province',
      latitude: 10.346,
      longitude: 107.0843,
      timestamp: '08:30',
    },
  ];

  it('generates multi-stop directions URL with two-wheeler travel mode', () => {
    const url = buildGoogleMapsMultiStopUrl(mockCheckpoints);

    expect(url).toContain('travelmode=two-wheeler');
    expect(url).toContain('origin=10.7769%2C106.7009');
    expect(url).toContain('destination=10.346%2C107.0843');
    expect(url).toContain('waypoints=10.7631%2C106.7825');
  });

  it('builds cafe navigation link correctly with coordinates', () => {
    const url = buildCafeDirectionsUrl('Oromia Coffee', 'Thảo Điền', 10.8058, 106.7328);
    expect(url).toContain('destination=10.8058%2C106.7328');
    expect(url).toContain('travelmode=two-wheeler');
  });
});
