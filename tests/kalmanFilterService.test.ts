import { describe, it, expect, beforeEach } from 'vitest';
import { KalmanGpsFilter } from '../src/services/kalmanFilterService';

describe('High-Speed GPS Kalman Filter (v1.1.0)', () => {
  let filter: KalmanGpsFilter;

  beforeEach(() => {
    filter = new KalmanGpsFilter();
  });

  it('initializes with the first GPS fix accurately', () => {
    const point = filter.process(10.7769, 106.7009, 5, 1000);
    expect(point.latitude).toBeCloseTo(10.7769, 4);
    expect(point.longitude).toBeCloseTo(106.7009, 4);
    expect(point.speedKmh).toBe(0);
  });

  it('smooths out sudden GPS outlier spike under bridge/trees', () => {
    filter.process(10.7769, 106.7009, 5, 1000);
    filter.process(10.7770, 106.7010, 5, 2000);

    // Sudden noise spike of 100m with degraded accuracy (45m)
    const spike = filter.process(10.7800, 106.7040, 45, 3000);

    // Filter should reject or heavily damp the jump towards the true trajectory
    expect(spike.latitude).toBeLessThan(10.7800);
    expect(spike.longitude).toBeLessThan(106.7040);
  });

  it('clamps stationary drift to zero speed when bike stops at traffic light', () => {
    filter.process(10.7769, 106.7009, 5, 1000);

    // Micro-jitter of 0.5 meters while stopped
    const stoppedPoint = filter.process(10.7769002, 106.7009001, 8, 2000);
    expect(stoppedPoint.speedKmh).toBe(0);
  });

  it('tracks real-time cruising speed continuously over multi-step trajectory', () => {
    // 1 second interval moving ~13.88 meters/sec (~50 km/h)
    // 1 degree latitude is ~111,320m, so 13.88m is ~0.0001246 degrees
    filter.process(10.776900, 106.7009, 5, 1000);
    const step1 = filter.process(10.777025, 106.7009, 5, 2000);
    expect(step1.speedKmh).toBeGreaterThan(30);
    expect(step1.speedKmh).toBeLessThan(70);

    // Step 2 continuous movement: speed must NOT decay to zero
    const step2 = filter.process(10.777150, 106.7009, 5, 3000);
    expect(step2.speedKmh).toBeGreaterThan(30);
    expect(step2.speedKmh).toBeLessThan(70);
  });

  it('uses hardware Doppler GPS speed when reported by mobile chip', () => {
    filter.process(10.7769, 106.7009, 5, 1000);

    // Hardware GPS chip on iPhone/Android reports 12.5 m/s (45 km/h)
    const fix = filter.process(10.7770, 106.7009, 5, 2000, 12.5);
    expect(fix.speedKmh).toBe(45);
  });
});
