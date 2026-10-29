import React, { useMemo } from 'react';
import { RouteData } from '../types/trip';
import { projectCoordinatesToSvg } from '../services/svgProjectionService';

interface SvgRouteMapProps {
  route: RouteData;
  height?: number;
  width?: number;
  interactive?: boolean;
  className?: string;
}

export const SvgRouteMap: React.FC<SvgRouteMapProps> = ({
  route,
  height = 130,
  width = 340,
  className = '',
}) => {
  const projection = useMemo(() => {
    return projectCoordinatesToSvg(
      route.points || [],
      route.checkpoints || [],
      width,
      height,
      28
    );
  }, [route, width, height]);

  if (!route || (!route.points?.length && !route.checkpoints?.length)) {
    return (
      <div
        style={{ height }}
        className={`w-full bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-xs text-slate-400 font-medium ${className}`}
      >
        <span>Chưa có dữ liệu tọa độ lộ trình</span>
      </div>
    );
  }

  return (
    <div
      style={{ height }}
      className={`relative w-full rounded-2xl overflow-hidden bg-gradient-to-b from-[#f0f9ff] to-[#e0f2fe] border border-blue-100 ${className}`}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodOpacity="0.2" />
          </filter>
        </defs>

        {/* Background grid dots */}
        <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.75" fill="#cbd5e1" />
        </pattern>
        <rect width={width} height={height} fill="url(#grid)" opacity="0.6" />

        {/* Route Line Shadow */}
        {projection.pathD && (
          <path
            d={projection.pathD}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.3"
          />
        )}

        {/* Main Route Line */}
        {projection.pathD && (
          <path
            d={projection.pathD}
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Checkpoint Pins */}
        {projection.projectedCheckpoints.map((cp) => {
          if (cp.isStart) {
            return (
              <g key={cp.id} transform={`translate(${cp.x}, ${cp.y})`}>
                <circle r="7" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" filter="url(#shadow)" />
                <circle r="2.5" fill="#ffffff" />
                <text
                  x="0"
                  y="-11"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                  fill="#047857"
                  className="select-none"
                >
                  {cp.shortName}
                </text>
              </g>
            );
          }

          if (cp.isFinish) {
            return (
              <g key={cp.id} transform={`translate(${cp.x}, ${cp.y})`}>
                <circle r="7" fill="#ea580c" stroke="#ffffff" strokeWidth="2.5" filter="url(#shadow)" />
                <circle r="2.5" fill="#ffffff" />
                <text
                  x="0"
                  y="18"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                  fill="#c2410c"
                  className="select-none"
                >
                  {cp.shortName}
                </text>
              </g>
            );
          }

          return (
            <g key={cp.id} transform={`translate(${cp.x}, ${cp.y})`}>
              <circle r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" filter="url(#shadow)" />
              <text
                x="0"
                y="-8"
                fontSize="7.5"
                fontWeight="600"
                textAnchor="middle"
                fill="#475569"
                className="select-none opacity-85"
              >
                {cp.shortName}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
