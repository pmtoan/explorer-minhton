import { ActiveTrip, FinishTripInput, Trip, AdministrativeCheckpoint } from '../types/trip';
import { storageService } from './storageService';
import {
  calculateDistanceKm,
  calculateRouteDistanceKm,
  createCheckpointFromLocation,
} from './geoService';
import { buildGoogleMapsMultiStopUrl } from './googleMapsDirectionsService';

type TripChangeListener = (trip: ActiveTrip | null) => void;

class LiveTripService {
  private activeTrip: ActiveTrip | null = null;
  private watchId: number | null = null;
  private listeners: Set<TripChangeListener> = new Set();

  constructor() {
    this.activeTrip = storageService.getActiveTrip();
    // If there was an active trip in recording state when page reloaded, resume GPS tracking
    if (this.activeTrip && this.activeTrip.status === 'recording') {
      this.startGpsWatch();
    }
  }

  public subscribe(listener: TripChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.activeTrip);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    storageService.saveActiveTrip(this.activeTrip);
    this.listeners.forEach((listener) => {
      try {
        listener(this.activeTrip ? { ...this.activeTrip } : null);
      } catch (e) {
        console.error('Error notifying trip listener:', e);
      }
    });
  }

  public getActiveTrip(): ActiveTrip | null {
    return this.activeTrip;
  }

  public isTripActive(): boolean {
    return this.activeTrip !== null;
  }

  public isPaused(): boolean {
    return this.activeTrip?.status === 'paused';
  }

  /**
   * Starts a new live motorcycle trip.
   */
  public async startLiveTrip(title?: string): Promise<ActiveTrip> {
    if (this.activeTrip) {
      return this.activeTrip;
    }

    const now = new Date();
    const displayTime = formatDisplayStartTime(now);
    const defaultTitle = title || `Phượt ${formatShortDate(now)}`;

    const newTrip: ActiveTrip = {
      id: `trip-${Date.now()}`,
      title: defaultTitle,
      startTime: now.toISOString(),
      displayStartTime: displayTime,
      status: 'recording',
      distanceKm: 0,
      route: {
        points: [],
        checkpoints: [],
      },
      totalPauseDurationMs: 0,
    };

    this.activeTrip = newTrip;
    this.notify();

    // Start GPS tracking
    this.startGpsWatch();

    // Attempt to acquire initial location immediately
    this.captureCurrentLocation(true);

    return newTrip;
  }

  /**
   * Shuts down GPS watch to save battery & prevent phone overheating during stops.
   */
  public pauseLiveTrip(): void {
    if (!this.activeTrip || this.activeTrip.status !== 'recording') return;

    this.stopGpsWatch();
    this.activeTrip.status = 'paused';
    this.activeTrip.pausedAt = new Date().toISOString();
    this.notify();
  }

  /**
   * Resumes GPS tracking when continuing the ride.
   */
  public resumeLiveTrip(): void {
    if (!this.activeTrip || this.activeTrip.status !== 'paused') return;

    if (this.activeTrip.pausedAt) {
      const pauseDuration = Date.now() - new Date(this.activeTrip.pausedAt).getTime();
      this.activeTrip.totalPauseDurationMs += Math.max(0, pauseDuration);
      this.activeTrip.pausedAt = undefined;
    }

    this.activeTrip.status = 'recording';
    this.notify();
    this.startGpsWatch();
    this.captureCurrentLocation(false);
  }

  /**
   * Manually adds a checkpoint (check-in) during the active trip.
   */
  public async addManualCheckpoint(name?: string): Promise<AdministrativeCheckpoint | null> {
    if (!this.activeTrip) return null;

    const coords = this.activeTrip.currentLocation || {
      latitude: 10.7769,
      longitude: 106.7009,
    };

    const cp = await createCheckpointFromLocation(coords.latitude, coords.longitude);
    if (!this.activeTrip) return null;
    if (name) {
      cp.name = name;
      cp.shortName = name;
    }

    this.activeTrip.route.checkpoints.push(cp);
    this.notify();
    return cp;
  }

  /**
   * Finishes the active trip, prompts/saves fuel and cost, and records to history.
   */
  public finishLiveTrip(input: FinishTripInput): Trip {
    if (!this.activeTrip) {
      throw new Error('Không có chuyến đi nào đang hoạt động để kết thúc!');
    }

    this.stopGpsWatch();

    const active = this.activeTrip;
    const finishDate = new Date();

    // If no checkpoints were recorded, create at least start and end checkpoints
    if (active.route.checkpoints.length === 0) {
      const pts = active.route.points;
      const startPt = pts.length > 0 ? pts[0] : { latitude: 10.7769, longitude: 106.7009 };
      const endPt = pts.length > 1 ? pts[pts.length - 1] : startPt;

      active.route.checkpoints = [
        {
          id: `cp-start-${Date.now()}`,
          name: 'Điểm xuất phát',
          shortName: 'Xuất phát',
          level: 'district',
          latitude: startPt.latitude,
          longitude: startPt.longitude,
          timestamp: formatTimeOnly(new Date(active.startTime)),
        },
        {
          id: `cp-finish-${Date.now()}`,
          name: 'Điểm đích đến',
          shortName: 'Đích đến',
          level: 'district',
          latitude: endPt.latitude,
          longitude: endPt.longitude,
          timestamp: formatTimeOnly(finishDate),
        },
      ];
    }

    // Generate Google Maps multi-stop URL
    const googleMapsUrl = buildGoogleMapsMultiStopUrl(active.route.checkpoints);

    // Calculate final distance
    const finalKm =
      active.distanceKm > 0
        ? active.distanceKm
        : calculateRouteDistanceKm(active.route.points);

    const completedTrip: Trip = {
      id: active.id,
      title: input.title?.trim() || active.title,
      date: active.startTime.split('T')[0],
      startTime: formatTimeOnly(new Date(active.startTime)),
      displayDate: formatFullDisplayDate(new Date(active.startTime)),
      distanceKm: Math.round(finalKm * 10) / 10,
      fuelLiters: Math.max(0, input.fuelLiters || 0),
      costVnd: Math.max(0, input.costVnd || 0),
      notes: input.notes?.trim() || '',
      bikeComfortRating: input.bikeComfortRating || 5,
      route: active.route,
      googleMapsUrl,
      createdAt: active.startTime,
      updatedAt: new Date().toISOString(),
    };

    // Save to completed trips
    storageService.addTrip(completedTrip);

    // Clear active trip
    this.activeTrip = null;
    storageService.clearActiveTrip();
    this.notify();

    return completedTrip;
  }

  /**
   * Discards active trip without saving.
   */
  public discardActiveTrip(): void {
    this.stopGpsWatch();
    this.activeTrip = null;
    storageService.clearActiveTrip();
    this.notify();
  }

  // --- GPS INTERNAL LOGIC ---
  private startGpsWatch(): void {
    if (this.watchId !== null || typeof window === 'undefined') return;

    if (!('geolocation' in navigator)) {
      console.warn('Geolocation not supported in this browser.');
      return;
    }

    try {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          this.handlePositionUpdate(
            position.coords.latitude,
            position.coords.longitude
          );
        },
        (error) => {
          console.warn('Geolocation watch error:', error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
        }
      );
    } catch (e) {
      console.error('Failed to initiate watchPosition:', e);
    }
  }

  private stopGpsWatch(): void {
    if (this.watchId !== null && typeof window !== 'undefined') {
      try {
        navigator.geolocation.clearWatch(this.watchId);
      } catch (e) {
        console.warn('Error clearing watchPosition:', e);
      }
      this.watchId = null;
    }
  }

  private captureCurrentLocation(isStart = false): void {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        this.handlePositionUpdate(lat, lon);

        if (isStart && this.activeTrip && this.activeTrip.route.checkpoints.length === 0) {
          const tripStartTime = this.activeTrip.startTime;
          const startCp = await createCheckpointFromLocation(
            lat,
            lon,
            formatTimeOnly(new Date(tripStartTime))
          );
          if (!this.activeTrip || this.activeTrip.status !== 'recording') return;
          startCp.shortName = `${startCp.shortName} (Xuất phát)`;
          this.activeTrip.route.checkpoints.push(startCp);
          this.notify();
        }
      },
      (err) => {
        console.warn('getCurrentPosition fallback notice:', err.message);
        // Fallback simulated initial point for testing or offline dev
        if (isStart && this.activeTrip && this.activeTrip.route.checkpoints.length === 0) {
          this.handlePositionUpdate(10.7769, 106.7009);
        }
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }

  private async handlePositionUpdate(lat: number, lon: number): Promise<void> {
    if (!this.activeTrip || this.activeTrip.status !== 'recording') return;

    const prevLocation = this.activeTrip.currentLocation;
    this.activeTrip.currentLocation = { latitude: lat, longitude: lon };
    this.activeTrip.lastLocationUpdate = new Date().toISOString();

    // Check distance from previous point
    let deltaKm = 0;
    if (prevLocation) {
      deltaKm = calculateDistanceKm(
        prevLocation.latitude,
        prevLocation.longitude,
        lat,
        lon
      );
    }

    // Only record route point if moved at least 25 meters (0.025 km) or first point
    if (!prevLocation || deltaKm >= 0.025) {
      this.activeTrip.route.points.push({
        latitude: lat,
        longitude: lon,
        timestamp: new Date().toISOString(),
      });

      if (deltaKm > 0) {
        this.activeTrip.distanceKm =
          Math.round((this.activeTrip.distanceKm + deltaKm) * 10) / 10;
      }

      // Check if crossed into a new significant administrative district (e.g. > 5 km from last checkpoint)
      const lastCheckpoint =
        this.activeTrip.route.checkpoints[
          this.activeTrip.route.checkpoints.length - 1
        ];

      if (
        !lastCheckpoint ||
        calculateDistanceKm(lastCheckpoint.latitude, lastCheckpoint.longitude, lat, lon) >= 8.0
      ) {
        const cp = await createCheckpointFromLocation(lat, lon);
        if (!this.activeTrip || this.activeTrip.status !== 'recording') return;
        this.activeTrip.route.checkpoints.push(cp);
      }

      this.notify();
    }
  }
}

// Formatters
function formatDisplayStartTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = date.getHours() < 12 ? 'Sáng' : 'Chiều';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${hours}:${minutes} ${period} • ${day}/${month}/${year}`;
}

function formatShortDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function formatTimeOnly(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatFullDisplayDate(date: Date): string {
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dayName = days[date.getDay()];
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${dayName}, ${day}/${month}/${year}`;
}

export const liveTripService = new LiveTripService();
