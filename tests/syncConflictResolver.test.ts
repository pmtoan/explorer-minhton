import { describe, it, expect } from 'vitest';
import {
  mergeTrips,
  mergeFavoriteIds,
  resolveItemConflict,
} from '../src/services/syncConflictResolver';
import { Trip } from '../src/types/trip';

describe('Deterministic Two-Way Merge Conflict Resolver', () => {
  it('resolves item conflict via Last-Write-Wins (LWW)', () => {
    const olderItem = {
      id: '1',
      updatedAt: '2026-10-25T10:00:00Z',
      title: 'Old Title',
    };
    const newerItem = {
      id: '1',
      updatedAt: '2026-10-25T12:00:00Z',
      title: 'Newer Title',
    };

    const resolved = resolveItemConflict(olderItem, newerItem);
    expect(resolved.title).toBe('Newer Title');
  });

  it('merges trips list and filters out tombstones', () => {
    const localTrips: Trip[] = [
      {
        id: 'trip-1',
        title: 'Chuyến Vũng Tàu',
        date: '2026-10-20',
        startTime: '05:30',
        displayDate: 'CN, 20/10/2026',
        distanceKm: 120,
        fuelLiters: 3,
        costVnd: 100000,
        route: { points: [], checkpoints: [] },
        googleMapsUrl: '',
        createdAt: '2026-10-20T05:30:00Z',
        updatedAt: '2026-10-20T09:00:00Z',
      },
    ];

    const remoteTrips: Trip[] = [
      {
        id: 'trip-2',
        title: 'Chuyến Trị An',
        date: '2026-10-22',
        startTime: '06:00',
        displayDate: 'T3, 22/10/2026',
        distanceKm: 80,
        fuelLiters: 2,
        costVnd: 60000,
        route: { points: [], checkpoints: [] },
        googleMapsUrl: '',
        createdAt: '2026-10-22T06:00:00Z',
        updatedAt: '2026-10-22T10:00:00Z',
      },
      {
        id: 'trip-1',
        title: 'Chuyến Vũng Tàu (Đã xóa)',
        date: '2026-10-20',
        startTime: '05:30',
        displayDate: 'CN, 20/10/2026',
        distanceKm: 120,
        fuelLiters: 3,
        costVnd: 100000,
        route: { points: [], checkpoints: [] },
        googleMapsUrl: '',
        createdAt: '2026-10-20T05:30:00Z',
        updatedAt: '2026-10-25T10:00:00Z', // newer tombstone
        isDeleted: true,
      },
    ];

    const merged = mergeTrips(localTrips, remoteTrips);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('trip-2');
  });

  it('unions favorite cafe IDs without duplicates', () => {
    const local = ['cafe-1', 'cafe-2'];
    const remote = ['cafe-2', 'cafe-3'];
    const merged = mergeFavoriteIds(local, remote);
    expect(merged).toEqual(['cafe-1', 'cafe-2', 'cafe-3']);
  });
});
