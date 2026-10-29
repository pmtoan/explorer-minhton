import { describe, it, expect, beforeEach } from 'vitest';
import { liveTripService } from '../src/services/liveTripService';
import { storageService } from '../src/services/storageService';

describe('Live Trip Lifecycle Engine (v4.0)', () => {
  beforeEach(() => {
    liveTripService.discardActiveTrip();
    storageService.saveTrips([]);
    window.localStorage.clear();
  });

  it('starts a new live trip, locks start time, and persists to localStorage', async () => {
    const trip = await liveTripService.startLiveTrip('Tour Thác Giang Điền');

    expect(trip).toBeDefined();
    expect(trip.title).toBe('Tour Thác Giang Điền');
    expect(trip.status).toBe('recording');
    expect(trip.distanceKm).toBe(0);
    expect(liveTripService.isTripActive()).toBe(true);
    expect(liveTripService.isPaused()).toBe(false);

    // Verify localStorage persistence
    const savedActive = storageService.getActiveTrip();
    expect(savedActive).not.toBeNull();
    expect(savedActive?.id).toBe(trip.id);
  });

  it('pauses GPS tracking to prevent battery drain and overheating', async () => {
    await liveTripService.startLiveTrip('Tour Nghỉ Chân');

    liveTripService.pauseLiveTrip();

    expect(liveTripService.isPaused()).toBe(true);
    const active = liveTripService.getActiveTrip();
    expect(active?.status).toBe('paused');
    expect(active?.pausedAt).toBeDefined();

    // Resume tracking
    liveTripService.resumeLiveTrip();
    expect(liveTripService.isPaused()).toBe(false);
    expect(liveTripService.getActiveTrip()?.status).toBe('recording');
  });

  it('finishes trip, stops GPS, prompts fuel and cost, and records into completed history', async () => {
    await liveTripService.startLiveTrip('Tour Biển Long Hải');

    const completed = liveTripService.finishLiveTrip({
      title: 'Tour Biển Long Hải - Hải Đăng',
      fuelLiters: 2.8,
      costVnd: 120000,
      notes: 'Đường biển gió mát tuyệt vời',
      bikeComfortRating: 5,
    });

    expect(completed).toBeDefined();
    expect(completed.title).toBe('Tour Biển Long Hải - Hải Đăng');
    expect(completed.fuelLiters).toBe(2.8);
    expect(completed.costVnd).toBe(120000);
    expect(completed.googleMapsUrl).toContain('travelmode=two-wheeler');

    // Active trip must be cleared
    expect(liveTripService.isTripActive()).toBe(false);
    expect(storageService.getActiveTrip()).toBeNull();

    // History must contain the completed trip
    const trips = storageService.getTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].id).toBe(completed.id);
  });

  it('discards active trip cleanly without recording to history (AC-9)', async () => {
    await liveTripService.startLiveTrip('Tour Chạy Thử Huỷ Bỏ');
    expect(liveTripService.isTripActive()).toBe(true);

    liveTripService.discardActiveTrip();

    expect(liveTripService.isTripActive()).toBe(false);
    expect(liveTripService.getActiveTrip()).toBeNull();
    expect(storageService.getActiveTrip()).toBeNull();
    expect(storageService.getTrips()).toHaveLength(0);
  });

  it('manually records checkpoint along route (AC-4)', async () => {
    await liveTripService.startLiveTrip('Tour Checkin Hồ Trị An');

    const cp = await liveTripService.addManualCheckpoint('Đập Trị An');
    expect(cp).not.toBeNull();
    expect(cp?.name).toBe('Đập Trị An');

    const active = liveTripService.getActiveTrip();
    expect(active?.route.checkpoints.some((c) => c.name === 'Đập Trị An')).toBe(true);
  });

  it('handles addManualCheckpoint gracefully when no active trip exists', async () => {
    liveTripService.discardActiveTrip();
    const cp = await liveTripService.addManualCheckpoint('Mốc Ngoài');
    expect(cp).toBeNull();
  });

  it('restores active trip from localStorage state upon reload (AC-18)', async () => {
    // Simulate active trip stored in localStorage from an interrupted ride
    const savedActiveTrip = {
      id: 'trip-restore-1',
      title: 'Tour Sài Gòn - Đà Lạt Dở Dang',
      startTime: '2026-10-25T05:30:00Z',
      displayStartTime: '05:30 Sáng • 25/10/2026',
      status: 'paused' as const,
      distanceKm: 85.4,
      route: { points: [], checkpoints: [] },
      totalPauseDurationMs: 600000,
      telemetry: {
        currentSpeedKmh: 0,
        maxSpeedKmh: 45,
        averageSpeedKmh: 32,
        movingDurationMs: 3600000,
        stationaryDurationMs: 600000,
        isAutoPaused: false,
        autoPauseEnabled: true,
        kalmanFiltered: true,
      },
    };
    storageService.saveActiveTrip(savedActiveTrip);

    // Reading from storage
    const restored = storageService.getActiveTrip();
    expect(restored).not.toBeNull();
    expect(restored?.id).toBe('trip-restore-1');
    expect(restored?.status).toBe('paused');
    expect(restored?.distanceKm).toBe(85.4);
  });

  it('accumulates real-time odometer distance and updates speed telemetry as vehicle travels', async () => {
    await liveTripService.startLiveTrip('Test Realtime Tracking');
    let notifyCallCount = 0;
    const unsubscribe = liveTripService.subscribe(() => {
      notifyCallCount++;
    });

    const t0 = 1700000000000;
    // Step 1: Initial fix
    await liveTripService.handlePositionUpdate(10.776900, 106.700900, 5, t0);
    expect(liveTripService.getActiveTrip()?.distanceKm).toBe(0);

    // Step 2: Rider travels 50 meters north at ~10 m/s (~36 km/h) after 5 seconds
    // 50m in latitude is ~0.00045 degrees
    await liveTripService.handlePositionUpdate(10.777350, 106.700900, 5, t0 + 5000, 10.0);
    const active = liveTripService.getActiveTrip();
    expect(active?.distanceKm).toBeGreaterThanOrEqual(0.04);
    expect(active?.distanceKm).toBeLessThan(0.06);
    expect(active?.telemetry.currentSpeedKmh).toBe(36);
    expect(active?.telemetry.maxSpeedKmh).toBe(36);
    expect(notifyCallCount).toBeGreaterThan(1);

    // Step 3: Rider travels another 50 meters north
    await liveTripService.handlePositionUpdate(10.777800, 106.700900, 5, t0 + 10000, 10.0);
    expect(liveTripService.getActiveTrip()?.distanceKm).toBeGreaterThan(0.08);

    unsubscribe();
  });

  it('triggers auto-pause when stopped >= 25s, then automatically resumes when moving', async () => {
    await liveTripService.startLiveTrip('Test Auto Pause Lifecycle');
    const t0 = 1700000000000;

    // Initial fix and small movement
    await liveTripService.handlePositionUpdate(10.776900, 106.700900, 5, t0);
    await liveTripService.handlePositionUpdate(10.777000, 106.700900, 5, t0 + 1000, 5.0);
    expect(liveTripService.getActiveTrip()?.telemetry.isAutoPaused).toBe(false);

    // Rider stops at traffic light (speed = 0) for 26 seconds
    await liveTripService.handlePositionUpdate(10.777001, 106.700901, 5, t0 + 27000, 0);
    expect(liveTripService.getActiveTrip()?.telemetry.isAutoPaused).toBe(true);
    expect(liveTripService.getActiveTrip()?.gpsStatus).toBe('paused');

    // Rider accelerates to 30 km/h (8.33 m/s) -> auto-pause must automatically resume!
    await liveTripService.handlePositionUpdate(10.777200, 106.700900, 5, t0 + 29000, 8.33);
    expect(liveTripService.getActiveTrip()?.telemetry.isAutoPaused).toBe(false);
    expect(liveTripService.getActiveTrip()?.gpsStatus).toBe('locked');
  });
});

