import { describe, it, expect } from 'vitest';
import {
  projectCoordinatesToSvg,
  generateSmoothSvgPath,
} from '../src/services/svgProjectionService';

describe('SVG Route Projection Service', () => {
  it('normalizes GPS coordinates into positive SVG viewport boundaries', () => {
    const points = [
      { latitude: 10.7769, longitude: 106.7009, timestamp: '1' },
      { latitude: 10.7631, longitude: 106.7825, timestamp: '2' },
      { latitude: 10.3460, longitude: 107.0843, timestamp: '3' },
    ];
    const checkpoints = [
      {
        id: 'cp1',
        name: 'Start',
        shortName: 'Start',
        level: 'district' as const,
        latitude: 10.7769,
        longitude: 106.7009,
        timestamp: '05:30',
      },
      {
        id: 'cp2',
        name: 'Finish',
        shortName: 'Finish',
        level: 'province' as const,
        latitude: 10.3460,
        longitude: 107.0843,
        timestamp: '08:30',
      },
    ];

    const result = projectCoordinatesToSvg(points, checkpoints, 360, 160, 24);

    expect(result.pathD).toBeTruthy();
    expect(result.pathD.startsWith('M')).toBe(true);
    expect(result.projectedCheckpoints).toHaveLength(2);
    expect(result.projectedCheckpoints[0].isStart).toBe(true);
    expect(result.projectedCheckpoints[1].isFinish).toBe(true);

    result.projectedPoints.forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(360);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(160);
    });
  });

  it('generates smooth cubic bezier path for multiple points', () => {
    const coords = [
      { x: 20, y: 30 },
      { x: 80, y: 60 },
      { x: 150, y: 40 },
      { x: 250, y: 90 },
    ];
    const path = generateSmoothSvgPath(coords);
    expect(path).toContain('M 20 30');
    expect(path).toContain('C');
  });
});
