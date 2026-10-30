import React, { useState } from 'react';
import { Cafe, SaigonDistrict } from '../types/cafe';
import { parseGoogleMapsUrl } from '../services/googleMapsParser';
import { X, Sparkles, MapPin, ShieldCheck, Image, Tag } from 'lucide-react';

interface CustomCafeModalProps {
  initialCafe?: Cafe | null;
  onClose: () => void;
  onSaved: (cafe: Cafe) => void;
}

const DISTRICT_OPTIONS: SaigonDistrict[] = [
  'Quận 1',
  'Quận 3',
  'Quận 4',
  'Quận 5',
  'Quận 7',
  'Quận 10',
  'Bình Thạnh',
  'Phú Nhuận',
  'Tân Bình',
  'TP. Thủ Đức',
  'Gò Vấp',
  'Quận 11',
  'Quận 12',
  'Bình Tân',
  'Nhà Bè',
  'Khác',
];

export const CustomCafeModal: React.FC<CustomCafeModalProps> = ({
  initialCafe,
  onClose,
  onSaved,
}) => {
  const [googleMapsUrl, setGoogleMapsUrl] = useState(initialCafe?.googleMapsUrl || '');
  const [name, setName] = useState(initialCafe?.name || '');
  const [district, setDistrict] = useState<string>(initialCafe?.district || 'Quận 1');
  const [address, setAddress] = useState(initialCafe?.address || '');
  const [parkingInfo, setParkingInfo] = useState(
    initialCafe?.parkingInfo || 'Sân trước rộng, có bảo vệ trông coi xe miễn phí'
  );
  const [vibeTagsStr, setVibeTagsStr] = useState(
    initialCafe?.vibeTags?.join(', ') || '#QuánRuột, #CàPhêNgon, #YênTĩnh'
  );
  const [description, setDescription] = useState(
    initialCafe?.description || 'Quán quen gu của mình, không gian thoáng đãng ngồi làm việc rất thích.'
  );
  const [photosStr, setPhotosStr] = useState(
    initialCafe?.reviewPhotos?.join('\n') ||
      'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80\nhttps://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80'
  );
  const [parseNotice, setParseNotice] = useState<string | null>(null);

  const handleUrlPaste = (url: string) => {
    setGoogleMapsUrl(url);
    if (url.includes('google.com/maps') || url.includes('goo.gl')) {
      const parsed = parseGoogleMapsUrl(url);
      if (parsed.name && parsed.name !== 'Quán Cafe Mới') {
        setName(parsed.name);
      }
      if (parsed.district && parsed.district !== 'Khác') {
        setDistrict(parsed.district);
      }
      if (parsed.address) {
        setAddress(parsed.address);
      }
      setParseNotice(`✨ Đã tự động nhận diện: "${parsed.name}" (${parsed.district})`);
      setTimeout(() => setParseNotice(null), 4000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const tags = vibeTagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));

    const photos = photosStr
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.startsWith('http'));

    const now = new Date().toISOString();
    const savedCafe: Cafe = {
      id: initialCafe?.id || `cafe-custom-${Date.now()}`,
      name: name.trim(),
      district,
      address: address.trim() || `${district}, TP. Hồ Chí Minh`,
      rating: initialCafe?.rating || 4.9,
      vibeTags: tags.length > 0 ? tags : ['#QuánRuột'],
      description: description.trim(),
      reviewPhotos:
        photos.length > 0
          ? photos
          : [
              'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80',
            ],
      googleMapsUrl: googleMapsUrl.trim(),
      parkingInfo: parkingInfo.trim(),
      isCustom: true,
      isFavorite: true,
      createdAt: initialCafe?.createdAt || now,
      updatedAt: now,
    };

    onSaved(savedCafe);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-[#f8fafc] w-full max-w-lg rounded-t-[32px] sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-base">
              ❤️
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                {initialCafe ? 'Chỉnh sửa quán' : 'Thêm quán mới'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Dán link Google Maps hoặc tự nhập thông tin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto">
          {/* Smart Google Maps URL Paste Box */}
          <div className="bg-orange-50/60 p-3 rounded-2xl border border-orange-200/80 space-y-1.5">
            <label className="text-xs font-bold text-orange-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              <span>Link Google Maps (tự động nhận diện)</span>
            </label>
            <input
              type="url"
              value={googleMapsUrl}
              onChange={(e) => handleUrlPaste(e.target.value)}
              placeholder="https://maps.app.goo.gl/... hoặc google.com/maps/place/..."
              className="w-full px-3 py-2 rounded-xl bg-white border border-orange-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            {parseNotice && (
              <p className="text-[11px] font-bold text-emerald-700 animate-in fade-in">
                {parseNotice}
              </p>
            )}
          </div>

          {/* Name & District */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Tên quán <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Rêu Cafe"
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div className="sm:col-span-4">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Khu vực
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {DISTRICT_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>Địa chỉ</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Nguyễn Văn Thủ, Đa Kao, Quận 1"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Motorbike Parking Info */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Chỗ gửi xe</span>
            </label>
            <input
              type="text"
              value={parkingInfo}
              onChange={(e) => setParkingInfo(e.target.value)}
              placeholder="Sân rộng, có bảo vệ, miễn phí"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Vibe Tags */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span>Thẻ phong cách (cách nhau dấu phẩy)</span>
            </label>
            <input
              type="text"
              value={vibeTagsStr}
              onChange={(e) => setVibeTagsStr(e.target.value)}
              placeholder="#NhiềuCây, #YênTĩnh, #LàmViệc"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Mô tả quán
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Vườn xanh thoáng mát, cafe thơm..."
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Review Photos (URLs) */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
              <Image className="w-3.5 h-3.5 text-slate-400" />
              <span>Link ảnh (mỗi dòng 1 link)</span>
            </label>
            <textarea
              rows={2}
              value={photosStr}
              onChange={(e) => setPhotosStr(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md transition-transform active:scale-95"
            >
              Lưu quán
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
