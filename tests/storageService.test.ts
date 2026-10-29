import { describe, it, expect, beforeEach } from 'vitest';
import { storageService } from '../src/services/storageService';
import { Cafe } from '../src/types/cafe';

describe('Storage Service & Local-First Repository', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('manages custom cafes correctly (add, update, delete)', () => {
    const customCafe: Cafe = {
      id: 'custom-1',
      name: 'Rêu Cafe',
      district: 'Quận 1',
      address: '10 Hai Bà Trưng',
      rating: 4.8,
      vibeTags: ['#CâyXanh'],
      description: 'Quán quen',
      reviewPhotos: ['https://example.com/photo.jpg'],
      googleMapsUrl: 'https://maps.google.com',
      isCustom: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storageService.addCustomCafe(customCafe);
    let list = storageService.getCustomCafes();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Rêu Cafe');

    // Update
    storageService.updateCustomCafe('custom-1', { name: 'Rêu Cafe Acoustic' });
    list = storageService.getCustomCafes();
    expect(list[0].name).toBe('Rêu Cafe Acoustic');

    // Delete
    storageService.deleteCustomCafe('custom-1');
    list = storageService.getCustomCafes();
    expect(list).toHaveLength(0);

    // Verify tombstone is retained in storage for cloud sync
    const rawCafes = storageService.getCustomCafes(true);
    expect(rawCafes).toHaveLength(1);
    expect(rawCafes[0].isDeleted).toBe(true);
  });

  it('toggles favorite cafes', () => {
    const isFavNow = storageService.toggleFavoriteCafe('cafe-123');
    expect(isFavNow).toBe(true);
    expect(storageService.getFavoriteCafeIds()).toContain('cafe-123');

    const isFavAfter = storageService.toggleFavoriteCafe('cafe-123');
    expect(isFavAfter).toBe(false);
    expect(storageService.getFavoriteCafeIds()).not.toContain('cafe-123');
  });

  it('generates export JSON payload correctly', () => {
    const payload = storageService.getExportPayload();
    expect(payload.version).toBe('4.0.0');
    expect(payload.exportedAt).toBeDefined();
    expect(Array.isArray(payload.trips)).toBe(true);
    expect(Array.isArray(payload.customCafes)).toBe(true);
  });

  it('manages trips in history (add, update, delete) (AC-8, AC-10, AC-12)', () => {
    const testTrip = {
      id: 'trip-history-1',
      title: 'Tour Núi Bà Đen',
      date: '2026-10-25',
      startTime: '05:30',
      displayDate: 'CN, 25/10/2026',
      distanceKm: 98.5,
      fuelLiters: 2.5,
      costVnd: 85000,
      notes: 'Đường thông thoáng',
      bikeComfortRating: 5,
      route: { points: [], checkpoints: [] },
      googleMapsUrl: 'https://maps.google.com',
      createdAt: '2026-10-25T05:30:00Z',
      updatedAt: '2026-10-25T11:00:00Z',
    };

    storageService.addTrip(testTrip);
    let trips = storageService.getTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].title).toBe('Tour Núi Bà Đen');

    // Update
    storageService.updateTrip('trip-history-1', {
      costVnd: 95000,
      notes: 'Đường thông thoáng, có ghé ăn bánh tráng',
    });
    trips = storageService.getTrips();
    expect(trips[0].costVnd).toBe(95000);
    expect(trips[0].notes).toContain('bánh tráng');

    // Delete
    storageService.deleteTrip('trip-history-1');
    trips = storageService.getTrips();
    expect(trips).toHaveLength(0);

    // Verify tombstone is retained in storage for two-way cloud sync
    const rawTrips = storageService.getTrips(true);
    expect(rawTrips).toHaveLength(1);
    expect(rawTrips[0].isDeleted).toBe(true);

    const exportPayload = storageService.getExportPayload();
    expect(exportPayload.trips.some((t) => t.id === 'trip-history-1' && t.isDeleted)).toBe(true);
  });
});

