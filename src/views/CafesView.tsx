import React, { useState, useEffect, useMemo } from 'react';
import { Cafe } from '../types/cafe';
import { SEED_CAFES } from '../data/seedCafes';
import { storageService } from '../services/storageService';
import { CafeCard } from '../components/CafeCard';
import { DistrictFilterTabs } from '../components/DistrictFilterTabs';
import { CustomCafeModal } from '../components/CustomCafeModal';
import { Search, Plus } from 'lucide-react';

export const CafesView: React.FC = () => {
  const [customCafes, setCustomCafes] = useState<Cafe[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('Tất cả');
  const [modalCafe, setModalCafe] = useState<Cafe | null | 'new'>(null);

  useEffect(() => {
    setCustomCafes(storageService.getCustomCafes());
    setFavoriteIds(storageService.getFavoriteCafeIds());
  }, []);

  const allCafes = useMemo(() => {
    // Combine custom cafes and seed cafes (custom cafes first)
    return [...customCafes, ...SEED_CAFES];
  }, [customCafes]);

  const filteredCafes = useMemo(() => {
    return allCafes.filter((cafe) => {
      // 1. District filter
      if (selectedDistrict === 'Quán Ruột ❤️') {
        const isFav = favoriteIds.includes(cafe.id);
        const isCustom = cafe.isCustom === true;
        if (!isFav && !isCustom) return false;
      } else if (selectedDistrict !== 'Tất cả') {
        if (!cafe.district.toLowerCase().includes(selectedDistrict.toLowerCase())) {
          return false;
        }
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = cafe.name.toLowerCase().includes(query);
        const matchesDistrict = cafe.district.toLowerCase().includes(query);
        const matchesAddress = cafe.address.toLowerCase().includes(query);
        const matchesTags = cafe.vibeTags.some((tag) => tag.toLowerCase().includes(query));
        const matchesDesc = cafe.description.toLowerCase().includes(query);

        if (!matchesName && !matchesDistrict && !matchesAddress && !matchesTags && !matchesDesc) {
          return false;
        }
      }

      return true;
    });
  }, [allCafes, selectedDistrict, searchQuery, favoriteIds]);

  const handleToggleFavorite = (cafeId: string) => {
    storageService.toggleFavoriteCafe(cafeId);
    setFavoriteIds(storageService.getFavoriteCafeIds());
  };

  const handleSaveCustomCafe = (cafe: Cafe) => {
    const existingIndex = customCafes.findIndex((c) => c.id === cafe.id);
    if (existingIndex >= 0) {
      storageService.updateCustomCafe(cafe.id, cafe);
    } else {
      storageService.addCustomCafe(cafe);
    }
    setCustomCafes(storageService.getCustomCafes());
    setModalCafe(null);
  };

  const handleDeleteCustomCafe = (id: string) => {
    storageService.deleteCustomCafe(id);
    setCustomCafes(storageService.getCustomCafes());
  };

  return (
    <div className="space-y-4">
      {/* Search Bar + "+ Quán Ruột" Button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm quán cafe có gu, hashtag..."
            className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs placeholder:text-slate-400"
          />
        </div>

        <button
          onClick={() => setModalCafe('new')}
          className="px-3.5 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm whitespace-nowrap transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>+ Quán Ruột</span>
        </button>
      </div>

      {/* District Filter Pills */}
      <DistrictFilterTabs
        selectedDistrict={selectedDistrict}
        onSelectDistrict={setSelectedDistrict}
      />

      {/* Cafe Cards List */}
      {filteredCafes.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center space-y-2.5 border border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center text-xl mx-auto">
            ☕
          </div>
          <div className="font-bold text-sm text-slate-700">Không tìm thấy quán cafe phù hợp</div>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Thử tìm kiếm với từ khóa khác hoặc nhấn vào nút bên dưới để xem lại tất cả các quán.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedDistrict('Tất cả');
            }}
            className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-100 transition-colors"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredCafes.map((cafe) => (
            <CafeCard
              key={cafe.id}
              cafe={cafe}
              isFavorite={favoriteIds.includes(cafe.id)}
              onToggleFavorite={handleToggleFavorite}
              onEdit={(c) => setModalCafe(c)}
              onDelete={handleDeleteCustomCafe}
            />
          ))}
        </div>
      )}

      {/* CUSTOM CAFE MODAL (ADD / EDIT) */}
      {modalCafe && (
        <CustomCafeModal
          initialCafe={modalCafe === 'new' ? null : modalCafe}
          onClose={() => setModalCafe(null)}
          onSaved={handleSaveCustomCafe}
        />
      )}
    </div>
  );
};
