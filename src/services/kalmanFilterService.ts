import { calculateDistanceKm } from './geoService';

export interface KalmanFilteredPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  speedKmh: number;
  timestampMs: number;
}

/**
 * 2D High-Speed GPS Kalman Filter tailored for motorcycle cruising & city riding.
 * Smooths jitter, suppresses stationary drift at stoplights, and estimates real-time speed.
 */
export class KalmanGpsFilter {
  // State: lat, lon, vLat (deg/s), vLon (deg/s)
  private lat: number = 0;
  private lon: number = 0;
  private vLat: number = 0;
  private vLon: number = 0;

  // Covariance matrix P diagonal elements
  private variancePos: number = 100;
  private varianceVel: number = 10;

  private lastTimestampMs: number = 0;
  private isInitialized: boolean = false;

  // Process noise parameter (how rapidly speed changes in moto acceleration)
  // Higher = more responsive to sudden turns/acceleration, Lower = smoother
  private readonly processNoise: number;

  constructor(processNoise = 3.0) {
    this.processNoise = processNoise;
  }

  public reset(): void {
    this.isInitialized = false;
    this.lat = 0;
    this.lon = 0;
    this.vLat = 0;
    this.vLon = 0;
    this.variancePos = 100;
    this.varianceVel = 10;
    this.lastTimestampMs = 0;
  }

  /**
   * Processes a raw GPS measurement and returns the optimal filtered point.
   */
  public process(
    rawLat: number,
    rawLon: number,
    accuracyMeters = 10,
    timestampMs = Date.now()
  ): KalmanFilteredPoint {
    // 1. Initial measurement
    if (!this.isInitialized || this.lastTimestampMs === 0) {
      this.lat = rawLat;
      this.lon = rawLon;
      this.vLat = 0;
      this.vLon = 0;
      this.variancePos = Math.max(5, accuracyMeters * accuracyMeters);
      this.varianceVel = 1;
      this.lastTimestampMs = timestampMs;
      this.isInitialized = true;

      return {
        latitude: rawLat,
        longitude: rawLon,
        accuracy: accuracyMeters,
        speedKmh: 0,
        timestampMs,
      };
    }

    const dt = Math.max(0.1, (timestampMs - this.lastTimestampMs) / 1000);
    this.lastTimestampMs = timestampMs;

    // If gap between points is huge (> 30s pause), reset velocity state to avoid wild extrapolation
    if (dt > 30) {
      this.lat = rawLat;
      this.lon = rawLon;
      this.vLat = 0;
      this.vLon = 0;
      this.variancePos = Math.max(5, accuracyMeters * accuracyMeters);
      return {
        latitude: rawLat,
        longitude: rawLon,
        accuracy: accuracyMeters,
        speedKmh: 0,
        timestampMs,
      };
    }

    // 2. Predict Step
    // Predict position based on previous velocity
    const predLat = this.lat + this.vLat * dt;
    const predLon = this.lon + this.vLon * dt;

    // Predict covariance
    const qPos = 0.5 * this.processNoise * dt * dt;
    const qVel = this.processNoise * dt;
    const predVarPos = this.variancePos + this.varianceVel * dt * dt + qPos;
    const predVarVel = this.varianceVel + qVel;

    // 3. Measurement Update Step
    // Measurement noise R: proportional to GPS accuracy reported by hardware
    // If accuracy is poor (e.g. 50m under tunnel), R is high, so filter trusts physics model
    const measurementNoise = Math.max(4, accuracyMeters * accuracyMeters);

    // Kalman gain K for position
    const kPos = predVarPos / (predVarPos + measurementNoise);
    // Kalman gain K for velocity
    const kVel = predVarVel / (predVarVel + measurementNoise / dt);

    // Update position estimate
    const newLat = predLat + kPos * (rawLat - predLat);
    const newLon = predLon + kPos * (rawLon - predLon);

    // Update velocity estimate (degrees per second)
    const newVLat = this.vLat + kVel * ((rawLat - predLat) / dt);
    const newVLon = this.vLon + kVel * ((rawLon - predLon) / dt);

    // Update variances
    this.variancePos = (1 - kPos) * predVarPos;
    this.varianceVel = (1 - kVel) * predVarVel;

    this.lat = newLat;
    this.lon = newLon;
    this.vLat = newVLat;
    this.vLon = newVLon;

    // Calculate real-time speed in km/h using Haversine between previous and updated position
    const distanceMeters = calculateDistanceKm(predLat, predLon, newLat, newLon) * 1000;
    let speedKmh = Math.round((distanceMeters / dt) * 3.6 * 10) / 10;

    // Clamp micro-jitters at zero speed (e.g. stationary motorcycle at stop light)
    if (speedKmh < 1.5) {
      speedKmh = 0;
    }

    return {
      latitude: Math.round(newLat * 1e6) / 1e6,
      longitude: Math.round(newLon * 1e6) / 1e6,
      accuracy: Math.round(Math.sqrt(this.variancePos)),
      speedKmh,
      timestampMs,
    };
  }
}
