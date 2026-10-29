import { AdministrativeCheckpoint, RoutePoint } from '../types/trip';

export interface ProjectedPoint {
  x: number;
  y: number;
  latitude: number;
  longitude: number;
}

export interface ProjectedCheckpoint extends ProjectedPoint {
  id: string;
  name: string;
  shortName: string;
  timestamp: string;
  isStart: boolean;
  isFinish: boolean;
}

export interface SvgProjectionResult {
  pathD: string;
  projectedPoints: ProjectedPoint[];
  projectedCheckpoints: ProjectedCheckpoint[];
  width: number;
  height: number;
}

/**
 * Projects GPS coordinates onto an SVG canvas coordinate system.
 */
export function projectCoordinatesToSvg(
  points: RoutePoint[],
  checkpoints: AdministrativeCheckpoint[],
  width = 360,
  height = 160,
  padding = 32
): SvgProjectionResult {
  const allCoords = [
    ...points.map((p) => ({ lat: p.latitude, lon: p.longitude })),
    ...checkpoints.map((c) => ({ lat: c.latitude, lon: c.longitude })),
  ];

  if (allCoords.length === 0) {
    return {
      pathD: '',
      projectedPoints: [],
      projectedCheckpoints: [],
      width,
      height,
    };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const c of allCoords) {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lon < minLon) minLon = c.lon;
    if (c.lon > maxLon) maxLon = c.lon;
  }

  // Handle single point or zero range
  const latRange = Math.max(maxLat - minLat, 0.01);
  const lonRange = Math.max(maxLon - minLon, 0.01);

  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  const project = (lat: number, lon: number): { x: number; y: number } => {
    // lon -> x (left to right)
    const normX = (lon - minLon) / lonRange;
    const x = padding + normX * drawWidth;

    // lat -> y (top to bottom: higher lat is further north, so smaller y in SVG)
    const normY = (lat - minLat) / latRange;
    const y = height - (padding + normY * drawHeight);

    return {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    };
  };

  const ptsToUse = points.length > 0 ? points : checkpoints;
  const projectedPoints: ProjectedPoint[] = ptsToUse.map((p) => {
    const { x, y } = project(p.latitude, p.longitude);
    return { x, y, latitude: p.latitude, longitude: p.longitude };
  });

  const projectedCheckpoints: ProjectedCheckpoint[] = checkpoints.map((cp, idx) => {
    const { x, y } = project(cp.latitude, cp.longitude);
    return {
      x,
      y,
      latitude: cp.latitude,
      longitude: cp.longitude,
      id: cp.id,
      name: cp.name,
      shortName: cp.shortName,
      timestamp: cp.timestamp,
      isStart: idx === 0,
      isFinish: idx === checkpoints.length - 1 && checkpoints.length > 1,
    };
  });

  const pathD = generateSmoothSvgPath(projectedPoints);

  return {
    pathD,
    projectedPoints,
    projectedCheckpoints,
    width,
    height,
  };
}

/**
 * Generates a smooth Catmull-Rom or cubic Bezier SVG path through 2D points.
 */
export function generateSmoothSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    // Catmull-Rom to Cubic Bezier conversion
    const tension = 0.2;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${Math.round(cp1x * 10) / 10} ${Math.round(cp1y * 10) / 10}, ${Math.round(
      cp2x * 10
    ) / 10} ${Math.round(cp2y * 10) / 10}, ${p2.x} ${p2.y}`;
  }

  return d;
}
