import React from 'react';
import { SaigonDistrict } from '../types/cafe';

const DISTRICT_LIST: SaigonDistrict[] = [
  'Tất cả',
  'Quán Ruột ❤️',
  'Quận 1',
  'Quận 3',
  'TP. Thủ Đức',
  'Bình Thạnh',
  'Phú Nhuận',
  'Quận 7',
  'Quận 10',
  'Tân Bình',
  'Gò Vấp',
  'Quận 4',
  'Quận 5',
  'Khác',
];

interface DistrictFilterTabsProps {
  selectedDistrict: string;
  onSelectDistrict: (district: string) => void;
}

export const DistrictFilterTabs: React.FC<DistrictFilterTabsProps> = ({
  selectedDistrict,
  onSelectDistrict,
}) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar scroll-smooth">
      {DISTRICT_LIST.map((dist) => {
        const isSelected = selectedDistrict === dist;
        const isRuot = dist === 'Quán Ruột ❤️';

        return (
          <button
            key={dist}
            onClick={() => onSelectDistrict(dist)}
            className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 shadow-2xs ${
              isSelected
                ? isRuot
                  ? 'bg-orange-500 text-white shadow-orange-500/20 shadow-sm'
                  : 'bg-emerald-500 text-white shadow-emerald-500/20 shadow-sm'
                : isRuot
                ? 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {dist}
          </button>
        );
      })}
    </div>
  );
};
