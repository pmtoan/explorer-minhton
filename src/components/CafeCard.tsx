import React, { useState } from 'react';
import { Cafe } from '../types/cafe';
import { PhotoGalleryMini } from './PhotoGalleryMini';
import { LightboxModal } from './LightboxModal';
import { Heart, Navigation, ShieldCheck, Trash2, Edit2 } from 'lucide-react';
import { buildCafeDirectionsUrl } from '../services/googleMapsDirectionsService';

interface CafeCardProps {
  cafe: Cafe;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onEdit?: (cafe: Cafe) => void;
  onDelete?: (id: string) => void;
}

export const CafeCard: React.FC<CafeCardProps> = ({
  cafe,
  isFavorite,
  onToggleFavorite,
  onEdit,
  onDelete,
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const directionsUrl =
    cafe.googleMapsUrl || buildCafeDirectionsUrl(cafe.name, cafe.address);

  return (
    <>
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-3 transition-all hover:shadow-md">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                {cafe.district}
              </span>
              {cafe.source === 'google_maps' && (
                <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80 font-bold text-[10px] flex items-center gap-1">
                  <span>🗺️</span>
                  <span>{cafe.sourceInfo?.badgeText || 'Từ Google Maps'}</span>
                </span>
              )}
              {cafe.source === 'community' && (
                <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200/80 font-bold text-[10px] flex items-center gap-1">
                  <span>👥</span>
                  <span>{cafe.sourceInfo?.badgeText || 'Cộng đồng Review'}</span>
                </span>
              )}
              {cafe.isCustom && (
                <span className="px-2 py-0.5 rounded-lg bg-orange-50 text-orange-600 border border-orange-200 font-bold text-[10px]">
                  Quán Ruột của tôi
                </span>
              )}
            </div>
            <h3 className="font-extrabold text-sm text-slate-800 leading-tight">
              {cafe.name}
            </h3>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="px-2 py-0.5 rounded-xl bg-amber-50 text-amber-700 font-bold text-xs flex items-center gap-0.5">
              ★ {cafe.rating ? cafe.rating.toFixed(1) : '4.8'}
            </span>
            <button
              onClick={() => onToggleFavorite(cafe.id)}
              className="p-1.5 rounded-full hover:bg-rose-50 transition-colors"
              title="Thêm vào danh sách yêu thích"
            >
              <Heart
                className={`w-4 h-4 transition-transform active:scale-125 ${
                  isFavorite
                    ? 'fill-rose-500 text-rose-500'
                    : 'text-slate-300 hover:text-rose-400'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Cafe Description */}
        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
          {cafe.description}
        </p>

        {/* 2-4 Real Review Photos Gallery */}
        {cafe.reviewPhotos && cafe.reviewPhotos.length > 0 && (
          <PhotoGalleryMini
            photos={cafe.reviewPhotos}
            cafeName={cafe.name}
            onPhotoClick={(idx) => setLightboxIndex(idx)}
          />
        )}

        {/* Motorbike Parking Info Banner */}
        {cafe.parkingInfo && (
          <div className="flex items-start gap-1.5 p-2 rounded-xl bg-slate-50 text-slate-600 text-[11px] border border-slate-100">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">
              <b>Bãi xe máy:</b> {cafe.parkingInfo}
            </span>
          </div>
        )}

        {/* Vibe Tags & Google Maps Navigation Button */}
        <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {cafe.vibeTags.map((tag, i) => (
              <span
                key={i}
                className="text-[11px] text-slate-400 font-semibold"
              >
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {cafe.isCustom && (
              <>
                {onEdit && (
                  <button
                    onClick={() => onEdit(cafe)}
                    className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                    title="Chỉnh sửa quán"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Xóa quán "${cafe.name}" khỏi Quán Ruột?`)) {
                        onDelete(cafe.id);
                      }
                    }}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Xóa quán"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}

            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Dẫn đường</span>
            </a>
          </div>
        </div>
      </div>

      {/* Lightbox for full size photo review */}
      {lightboxIndex !== null && (
        <LightboxModal
          photos={cafe.reviewPhotos || []}
          activeIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onSelectIndex={(idx) => setLightboxIndex(idx)}
        />
      )}
    </>
  );
};
