import React, { useState } from 'react';
import { Trip } from '../types/trip';
import { SvgRouteMap } from './SvgRouteMap';
import { ExternalLink, Star, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

interface TripHistoryCardProps {
  trip: Trip;
  onDelete: (id: string) => void;
}

export const TripHistoryCard: React.FC<TripHistoryCardProps> = ({ trip, onDelete }) => {
  const [showNotes, setShowNotes] = useState(false);

  const formatVnd = (amount: number) => {
    return `${amount.toLocaleString('vi-VN')} đ`;
  };

  const checkpointNames = trip.route.checkpoints.map((c) => c.shortName).join(' ➔ ');

  return (
    <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-3 transition-all hover:shadow-md">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold mb-1">
            <span>{trip.startTime} • {trip.displayDate}</span>
          </div>
          <h3 className="font-extrabold text-sm text-slate-800 leading-snug">{trip.title}</h3>
        </div>

        <button
          onClick={() => {
            if (window.confirm(`Bạn có chắc muốn xóa chuyến đi "${trip.title}"?`)) {
              onDelete(trip.id);
            }
          }}
          className="p-1.5 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
          title="Xóa chuyến đi"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Embedded Route Map with Direct Google Maps Link */}
      <a
        href={trip.googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative rounded-2xl overflow-hidden border border-emerald-100 group cursor-pointer"
        title="Mở lộ trình trên Google Maps"
      >
        <SvgRouteMap route={trip.route} height={130} />
        <div className="absolute top-2.5 right-2.5 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-xl text-[11px] font-bold text-blue-600 shadow-sm border border-blue-100 flex items-center gap-1 group-hover:bg-blue-600 group-hover:text-white transition-all">
          <span>Google Maps</span>
          <ExternalLink className="w-3 h-3" />
        </div>
      </a>

      {/* Checkpoints summary */}
      {checkpointNames && (
        <div className="text-[11px] text-slate-400 font-medium truncate">
          📍 {checkpointNames}
        </div>
      )}

      {/* Bottom Metrics Bar */}
      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-50">
        <div className="flex items-center gap-1 text-amber-500">
          {Array.from({ length: trip.bikeComfortRating || 5 }).map((_, i) => (
            <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          ))}
        </div>

        <div className="flex items-center gap-2 text-slate-700 font-extrabold">
          <span>{trip.distanceKm.toFixed(1)} km</span>
          <span className="text-slate-300">•</span>
          <span>{trip.fuelLiters} L</span>
          <span className="text-slate-300">•</span>
          <span className="text-emerald-600">{formatVnd(trip.costVnd)}</span>
        </div>
      </div>

      {/* Expandable Notes */}
      {trip.notes && (
        <div className="pt-1">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 flex items-center gap-1"
          >
            <span>{showNotes ? 'Thu gọn' : 'Xem ghi chú'}</span>
            {showNotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showNotes && (
            <div className="mt-1.5 p-2.5 rounded-xl bg-slate-50 text-slate-600 text-xs italic border border-slate-100 animate-in fade-in">
              "{trip.notes}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
