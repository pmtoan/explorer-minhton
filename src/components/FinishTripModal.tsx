import React, { useState } from 'react';
import { ActiveTrip, FinishTripInput } from '../types/trip';
import { liveTripService } from '../services/liveTripService';
import { Check, X, Star, Fuel, CircleDollarSign } from 'lucide-react';

interface FinishTripModalProps {
  activeTrip: ActiveTrip;
  onClose: () => void;
  onFinished: () => void;
}

export const FinishTripModal: React.FC<FinishTripModalProps> = ({
  activeTrip,
  onClose,
  onFinished,
}) => {
  const [title, setTitle] = useState(activeTrip.title || '');
  const [fuelLiters, setFuelLiters] = useState<string>('2.5');
  const [costVnd, setCostVnd] = useState<string>('120000');
  const [notes, setNotes] = useState<string>('');
  const [bikeRating, setBikeRating] = useState<number>(5);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    const fuel = parseFloat(fuelLiters);
    const cost = parseFloat(costVnd);

    if (isNaN(fuel) || fuel < 0) {
      setErrorMsg('Vui lòng nhập số lít xăng hợp lệ (>= 0)');
      return;
    }
    if (isNaN(cost) || cost < 0) {
      setErrorMsg('Vui lòng nhập tổng chi phí hợp lệ (>= 0)');
      return;
    }

    const input: FinishTripInput = {
      title: title.trim() || activeTrip.title,
      fuelLiters: fuel,
      costVnd: cost,
      notes: notes.trim(),
      bikeComfortRating: bikeRating,
    };

    try {
      liveTripService.finishLiveTrip(input);
      onFinished();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi lưu hành trình';
      setErrorMsg(msg);
    }
  };

  const formattedCostPreview = () => {
    const val = parseFloat(costVnd);
    if (isNaN(val)) return '0 đ';
    return `${val.toLocaleString('vi-VN')} đ`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-[#f8fafc] w-full max-w-md rounded-t-[32px] sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-base">
              🏁
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Lưu chuyến đi</h2>
              <p className="text-[11px] text-slate-400">Tổng kết quãng đường và chi phí</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFinish} className="p-4 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Odometer Summary Badge */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-3.5 text-white flex items-center justify-between shadow-sm">
            <div>
              <span className="text-xs text-emerald-100 block font-medium">Quãng đường</span>
              <div className="text-2xl font-black">{activeTrip.distanceKm.toFixed(2)} km</div>
            </div>
            <div className="text-right">
              <span className="text-xs text-emerald-100 block font-medium">Điểm mốc</span>
              <div className="text-xl font-bold">{activeTrip.route.checkpoints.length} mốc</div>
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Tên chuyến đi
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Sài Gòn - Vũng Tàu"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Fuel & Single Total Cost Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
                <Fuel className="w-3.5 h-3.5 text-emerald-600" />
                <span>Xăng (lít)</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={fuelLiters}
                onChange={(e) => setFuelLiters(e.target.value)}
                placeholder="2.5"
                className="w-full px-3 py-2.5 rounded-2xl bg-white border-2 border-emerald-200 text-xs font-bold text-emerald-700 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
                <CircleDollarSign className="w-3.5 h-3.5 text-orange-500" />
                <span>Chi phí (đ)</span>
              </label>
              <input
                type="number"
                step="1000"
                min="0"
                value={costVnd}
                onChange={(e) => setCostVnd(e.target.value)}
                placeholder="150000"
                className="w-full px-3 py-2.5 rounded-2xl bg-white border-2 border-orange-200 text-xs font-bold text-orange-600 focus:outline-none focus:border-orange-500"
                required
              />
              <span className="text-[10px] text-orange-600 font-bold block mt-1 truncate">
                ≈ {formattedCostPreview()}
              </span>
            </div>
          </div>

          {/* Bike Comfort Rating */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Đánh giá cung đường
            </label>
            <div className="flex items-center gap-2 bg-white p-2.5 rounded-2xl border border-slate-200">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setBikeRating(star)}
                  className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-amber-400 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-5 h-5 ${
                      star <= bikeRating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-bold text-amber-600 ml-auto">
                {bikeRating === 5 ? 'Tuyệt vời (5/5)' : `${bikeRating} / 5`}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Ghi chú
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Đường thoáng, cảnh đẹp, điểm nghỉ chân êm..."
              className="w-full px-3 py-2 rounded-2xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-transform active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Lưu chuyến đi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
