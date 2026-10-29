import { STORAGE_KEYS } from '../types/storage';
import { Trip, ActiveTrip } from '../types/trip';
import { Cafe } from '../types/cafe';
import { GoogleDriveConfig, SyncPayload } from '../types/sync';
import { SEED_TRIPS } from '../data/seedTrips';
import { mergeTrips, mergeCustomCafes, mergeFavoriteIds } from './syncConflictResolver';

class StorageService {
  constructor() {
    this.initStorage();
  }

  public initStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const isSeeded = localStorage.getItem(STORAGE_KEYS.SEEDED);
      if (!isSeeded) {
        // Seed initial trips if none exist
        const existingTrips = this.getTrips();
        if (existingTrips.length === 0) {
          this.saveTrips(SEED_TRIPS);
        }

        // Seed initial favorites
        const existingFavs = this.getFavoriteCafeIds();
        if (existingFavs.length === 0) {
          localStorage.setItem(
            STORAGE_KEYS.FAVORITE_CAFES,
            JSON.stringify(['cafe-oromia-thao-dien', 'cafe-okkiyo-q1'])
          );
        }

        localStorage.setItem(STORAGE_KEYS.SEEDED, 'true');
      }
    } catch (e) {
      console.warn('Failed to initialize local storage seeds:', e);
    }
  }

  // --- TRIPS ---
  public getTrips(includeDeleted = false): Trip[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRIPS);
      if (!data) return [];
      const parsed: Trip[] = JSON.parse(data);
      return parsed.filter((t) => includeDeleted || !t.isDeleted);
    } catch {
      return [];
    }
  }

  public saveTrips(trips: Trip[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(trips));
    } catch (e) {
      console.error('Failed to save trips:', e);
    }
  }

  public addTrip(trip: Trip): void {
    const trips = this.getTrips(true);
    trips.unshift(trip);
    this.saveTrips(trips);
  }

  public updateTrip(id: string, updates: Partial<Trip>): void {
    const trips = this.getTrips(true).map((t) =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );
    this.saveTrips(trips);
  }

  public deleteTrip(id: string): void {
    // Soft delete with tombstone for reliable cloud merge
    const trips = this.getTrips(true).map((t) =>
      t.id === id ? { ...t, isDeleted: true, updatedAt: new Date().toISOString() } : t
    );
    this.saveTrips(trips);
  }

  // --- ACTIVE TRIP (v4.0 Live LifeCycle) ---
  public getActiveTrip(): ActiveTrip | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_TRIP);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  public saveActiveTrip(activeTrip: ActiveTrip | null): void {
    try {
      if (activeTrip) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_TRIP, JSON.stringify(activeTrip));
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_TRIP);
      }
    } catch (e) {
      console.error('Failed to save active trip:', e);
    }
  }

  public clearActiveTrip(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_TRIP);
    } catch (e) {
      console.error('Failed to clear active trip:', e);
    }
  }

  // --- CUSTOM CAFES ---
  public getCustomCafes(includeDeleted = false): Cafe[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_CAFES);
      if (!data) return [];
      const parsed: Cafe[] = JSON.parse(data);
      return parsed.filter((c) => includeDeleted || !c.isDeleted);
    } catch {
      return [];
    }
  }

  public saveCustomCafes(cafes: Cafe[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_CAFES, JSON.stringify(cafes));
    } catch (e) {
      console.error('Failed to save custom cafes:', e);
    }
  }

  public addCustomCafe(cafe: Cafe): void {
    const list = this.getCustomCafes(true);
    list.unshift(cafe);
    this.saveCustomCafes(list);
  }

  public updateCustomCafe(id: string, updates: Partial<Cafe>): void {
    const list = this.getCustomCafes(true).map((c) =>
      c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
    );
    this.saveCustomCafes(list);
  }

  public deleteCustomCafe(id: string): void {
    // Soft delete with tombstone for reliable cloud merge
    const list = this.getCustomCafes(true).map((c) =>
      c.id === id ? { ...c, isDeleted: true, updatedAt: new Date().toISOString() } : c
    );
    this.saveCustomCafes(list);
  }

  // --- FAVORITES ---
  public getFavoriteCafeIds(): string[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FAVORITE_CAFES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public toggleFavoriteCafe(cafeId: string): boolean {
    const favs = new Set(this.getFavoriteCafeIds());
    let isFav = false;
    if (favs.has(cafeId)) {
      favs.delete(cafeId);
      isFav = false;
    } else {
      favs.add(cafeId);
      isFav = true;
    }
    localStorage.setItem(STORAGE_KEYS.FAVORITE_CAFES, JSON.stringify(Array.from(favs)));
    return isFav;
  }

  // --- GOOGLE DRIVE CONFIG ---
  public getGoogleDriveConfig(): GoogleDriveConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GDRIVE_CONFIG);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // fallback
    }
    return {
      clientId: '',
      autoSync: false,
    };
  }

  public saveGoogleDriveConfig(config: GoogleDriveConfig): void {
    try {
      localStorage.setItem(STORAGE_KEYS.GDRIVE_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save Google Drive config:', e);
    }
  }

  // --- EXPORT & IMPORT ---
  public getExportPayload(): SyncPayload {
    return {
      version: '4.0.0',
      exportedAt: new Date().toISOString(),
      trips: this.getTrips(true),
      customCafes: this.getCustomCafes(true),
      favoriteCafeIds: this.getFavoriteCafeIds(),
    };
  }

  public applyImportPayload(payload: SyncPayload): void {
    if (!payload || !payload.version) {
      throw new Error('Dữ liệu sao lưu không đúng định dạng!');
    }

    const mergedTrips = mergeTrips(this.getTrips(true), payload.trips || [], true);
    const mergedCafes = mergeCustomCafes(
      this.getCustomCafes(true),
      payload.customCafes || [],
      true
    );
    const mergedFavs = mergeFavoriteIds(
      this.getFavoriteCafeIds(),
      payload.favoriteCafeIds || []
    );

    this.saveTrips(mergedTrips);
    this.saveCustomCafes(mergedCafes);
    localStorage.setItem(STORAGE_KEYS.FAVORITE_CAFES, JSON.stringify(mergedFavs));
  }
}

export const storageService = new StorageService();
