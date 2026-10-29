import React from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface LightboxModalProps {
  photos: string[];
  activeIndex: number;
  onClose: () => void;
  onSelectIndex: (idx: number) => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  photos,
  activeIndex,
  onClose,
  onSelectIndex,
}) => {
  if (photos.length === 0 || activeIndex < 0) return null;

  const currentPhoto = photos[activeIndex];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectIndex((activeIndex - 1 + photos.length) % photos.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectIndex((activeIndex + 1) % photos.length);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Main Image container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-2xl max-h-[85vh] flex flex-col items-center justify-center"
      >
        <img
          src={currentPhoto}
          alt={`Review photo ${activeIndex + 1}`}
          className="max-h-[75vh] w-auto object-contain rounded-2xl shadow-2xl"
        />

        {/* Counter pill */}
        <div className="mt-3 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur">
          Ảnh {activeIndex + 1} / {photos.length}
        </div>

        {/* Prev / Next buttons if > 1 */}
        {photos.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-[-20px] sm:left-[-40px] top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-[-20px] sm:right-[-40px] top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
