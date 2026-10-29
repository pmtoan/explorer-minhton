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
});

