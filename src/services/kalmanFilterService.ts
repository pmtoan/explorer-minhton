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
 * Smooths jitter, suppresses stationary drift at stoplights, and provides real-time speed.
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
   * Supports hardware-reported GPS Doppler speed (rawSpeedMps) from mobile chipsets.
   */
  public process(
    rawLat: number,
    rawLon: number,
    accuracyMeters = 10,
    timestampMs = Date.now(),
    rawSpeedMps?: number | null
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

      const initialSpeedKmh =
        rawSpeedMps !== undefined && rawSpeedMps !== null && !isNaN(rawSpeedMps) && rawSpeedMps >= 0
          ? Math.round(rawSpeedMps * 3.6 * 10) / 10
          : 0;

      return {
        latitude: rawLat,
        longitude: rawLon,
        accuracy: accuracyMeters,
        speedKmh: initialSpeedKmh < 1.5 ? 0 : initialSpeedKmh,
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
      const resumedSpeedKmh =
        rawSpeedMps !== undefined && rawSpeedMps !== null && !isNaN(rawSpeedMps) && rawSpeedMps >= 0
          ? Math.round(rawSpeedMps * 3.6 * 10) / 10
          : 0;
      return {
        latitude: rawLat,
        longitude: rawLon,
        accuracy: accuracyMeters,
        speedKmh: resumedSpeedKmh < 1.5 ? 0 : resumedSpeedKmh,
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

    // Remember previous estimated position before state transition
    const prevEstimatedLat = this.lat;
    const prevEstimatedLon = this.lon;

    this.lat = newLat;
    this.lon = newLon;
    this.vLat = newVLat;
    this.vLon = newVLon;

    // Calculate real-time speed in km/h
    let speedKmh = 0;
    if (rawSpeedMps !== undefined && rawSpeedMps !== null && !isNaN(rawSpeedMps) && rawSpeedMps >= 0) {
      // Direct hardware-measured GPS Doppler ground speed (native chip on iPhone/Android)
      speedKmh = Math.round(rawSpeedMps * 3.6 * 10) / 10;
    } else {
      // Finite-difference speed between previous estimated position and new estimated position
      const distanceMeters = calculateDistanceKm(prevEstimatedLat, prevEstimatedLon, newLat, newLon) * 1000;
      speedKmh = dt > 0 ? Math.round((distanceMeters / dt) * 3.6 * 10) / 10 : 0;
    }

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
