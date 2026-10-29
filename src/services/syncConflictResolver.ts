import { Trip } from '../types/trip';
import { Cafe } from '../types/cafe';
import { SyncPayload } from '../types/sync';

interface IdentifiableWithTimestamp {
  id: string;
  updatedAt: string;
  isDeleted?: boolean;
}

/**
 * Resolves conflict between two items using Last-Write-Wins (LWW) based on updatedAt timestamp.
 */
export function resolveItemConflict<T extends IdentifiableWithTimestamp>(
  local: T,
  remote: T
): T {
  const localTime = new Date(local.updatedAt || 0).getTime();
  const remoteTime = new Date(remote.updatedAt || 0).getTime();

  return remoteTime > localTime ? remote : local;
}

/**
 * Merges two arrays of identifiable items using Last-Write-Wins and handles soft deletes.
 */
export function mergeEntityArrays<T extends IdentifiableWithTimestamp>(
  localList: T[],
  remoteList: T[],
  retainTombstones = false
): T[] {
  const map = new Map<string, T>();

  // Insert local items
  for (const item of localList) {
    map.set(item.id, item);
  }

  // Merge remote items
  for (const remoteItem of remoteList) {
    const existing = map.get(remoteItem.id);
    if (!existing) {
      map.set(remoteItem.id, remoteItem);
    } else {
      map.set(remoteItem.id, resolveItemConflict(existing, remoteItem));
    }
  }

  // Filter out permanently deleted items if desired, or retain tombstones
  const allItems = Array.from(map.values());
  return retainTombstones ? allItems : allItems.filter((item) => !item.isDeleted);
}

/**
 * Merges Trips using Last-Write-Wins and sorts descending by date.
 */
export function mergeTrips(
  localTrips: Trip[],
  remoteTrips: Trip[],
  retainTombstones = false
): Trip[] {
  const merged = mergeEntityArrays(localTrips, remoteTrips, retainTombstones);
  return merged.sort((a, b) => {
    const timeA = new Date(`${a.date}T${a.startTime || '00:00'}:00`).getTime();
    const timeB = new Date(`${b.date}T${b.startTime || '00:00'}:00`).getTime();
    return timeB - timeA;
  });
}

/**
 * Merges Custom Cafes using Last-Write-Wins.
 */
export function mergeCustomCafes(
  localCafes: Cafe[],
  remoteCafes: Cafe[],
  retainTombstones = false
): Cafe[] {
  return mergeEntityArrays(localCafes, remoteCafes, retainTombstones);
}

/**
 * Merges Favorite Cafe IDs via set union.
 */
export function mergeFavoriteIds(
  localFavorites: string[],
  remoteFavorites: string[]
): string[] {
  return Array.from(new Set([...(localFavorites || []), ...(remoteFavorites || [])]));
}

/**
 * Merges full sync payloads deterministically.
 */
export function mergeSyncPayloads(
  local: SyncPayload,
  remote: SyncPayload
): SyncPayload {
  return {
    version: '4.0.0',
    exportedAt: new Date().toISOString(),
    trips: mergeTrips(local.trips || [], remote.trips || [], true),
    customCafes: mergeCustomCafes(local.customCafes || [], remote.customCafes || [], true),
    favoriteCafeIds: mergeFavoriteIds(
      local.favoriteCafeIds || [],
      remote.favoriteCafeIds || []
    ),
  };
}
