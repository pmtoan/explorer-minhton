export type SaigonDistrict =
  | 'Tất cả'
  | 'Quán Ruột ❤️'
  | 'Quận 1'
  | 'Quận 3'
  | 'Quận 4'
  | 'Quận 5'
  | 'Quận 7'
  | 'Quận 10'
  | 'Bình Thạnh'
  | 'Phú Nhuận'
  | 'Tân Bình'
  | 'TP. Thủ Đức'
  | 'Gò Vấp'
  | 'Quận 11'
  | 'Quận 12'
  | 'Bình Tân'
  | 'Nhà Bè'
  | 'Khác';

export type CafeSource = 'google_maps' | 'community';

export interface CafeSourceInfo {
  sourceName?: string; // e.g. "Google Maps Top 1", "Hội Quán Biker Sài Gòn", "Foody / TikTok"
  reviewCount?: number; // e.g. 1450
  badgeText?: string; // e.g. "Google Maps 4.8★ (1.4k đánh giá)" | "Cộng đồng Biker Review"
}

export interface Cafe {
  id: string;
  name: string;
  district: string;
  address: string;
  rating: number; // e.g. 4.8
  vibeTags: string[]; // e.g. ["#NhiềuCây", "#YênTĩnh"]
  description: string;
  reviewPhotos: string[]; // 2-4 real review photos
  googleMapsUrl: string;
  isCustom?: boolean;
  isFavorite?: boolean;
  parkingInfo?: string;
  source?: CafeSource; // 'google_maps' or 'community'
  sourceInfo?: CafeSourceInfo;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
}

export interface CreateCustomCafeInput {
  name: string;
  district: string;
  address: string;
  googleMapsUrl?: string;
  vibeTags: string[];
  description?: string;
  parkingInfo?: string;
  reviewPhotos?: string[];
}
