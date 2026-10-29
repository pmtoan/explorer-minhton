export type AdminLevel = 'province' | 'district' | 'ward' | 'landmark';

export type TripTrackingStatus = 'recording' | 'paused' | 'finished';

export interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface AdministrativeCheckpoint {
  id: string;
  name: string;
  shortName: string;
  level: AdminLevel;
  latitude: number;
  longitude: number;
  timestamp: string;
  note?: string;
}

export interface RouteData {
  points: RoutePoint[];
  checkpoints: AdministrativeCheckpoint[];
}

export interface ActiveTrip {
  id: string;
  title: string;
  startTime: string; // ISO String
  displayStartTime: string; // e.g., "05:30 Sáng • 28/10/2026"
  status: TripTrackingStatus;
  distanceKm: number;
  route: RouteData;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  lastLocationUpdate?: string;
  pausedAt?: string;
  totalPauseDurationMs: number;
}

export interface Trip {
  id: string;
  title: string;
  date: string; // ISO date YYYY-MM-DD
  startTime: string; // "05:30"
  displayDate: string; // "CN, 25/10/2026"
  distanceKm: number;
  fuelLiters: number;
  costVnd: number;
  notes?: string;
  bikeComfortRating?: number; // 1-5
  route: RouteData;
  googleMapsUrl: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  isDeleted?: boolean;
}

export interface FinishTripInput {
  title?: string;
  fuelLiters: number;
  costVnd: number;
  notes?: string;
  bikeComfortRating?: number;
}
