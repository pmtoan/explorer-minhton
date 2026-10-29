import React from 'react';

interface PhotoGalleryMiniProps {
  photos: string[];
  cafeName: string;
  onPhotoClick: (index: number) => void;
}

export const PhotoGalleryMini: React.FC<PhotoGalleryMiniProps> = ({
  photos,
  cafeName,
  onPhotoClick,
}) => {
  if (!photos || photos.length === 0) return null;

  const displayPhotos = photos.slice(0, 4);
  const gridColsClass =
    displayPhotos.length === 2
      ? 'grid-cols-2'
      : displayPhotos.length === 3
      ? 'grid-cols-3'
      : 'grid-cols-4';

  return (
    <div className={`grid ${gridColsClass} gap-2 w-full pt-1`}>
      {displayPhotos.map((photo, index) => (
        <div
          key={index}
          onClick={() => onPhotoClick(index)}
          className="relative h-20 rounded-2xl overflow-hidden cursor-pointer group bg-slate-100 border border-slate-200/60 shadow-xs"
        >
          <img
            src={photo}
            alt={`${cafeName} review ${index + 1}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-108"
            loading="lazy"
            onError={(e) => {
              // fallback placeholder if remote image link is blocked
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 text-white text-[10px] font-bold bg-black/40 px-1.5 py-0.5 rounded-md backdrop-blur-xs">
              🔍 Xem
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
