import React, { useState, useEffect } from 'react';
import { ActiveTrip, Trip } from '../types/trip';
import { liveTripService } from '../services/liveTripService';
import { storageService } from '../services/storageService';
import { ActiveTripBanner } from '../components/ActiveTripBanner';
import { LiveTripModal } from '../components/LiveTripModal';
import { FinishTripModal } from '../components/FinishTripModal';
import { TripHistoryCard } from '../components/TripHistoryCard';
import { Compass, Sparkles } from 'lucide-react';

export const TripsView: React.FC = () => {
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(liveTripService.getActiveTrip());
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

  useEffect(() => {
    // Load historical trips
    setTrips(storageService.getTrips());

    // Subscribe to live trip updates
    const unsubscribe = liveTripService.subscribe((trip) => {
      setActiveTrip(trip);
    });

    return unsubscribe;
  }, []);

  const handleStartNewTrip = async () => {
    await liveTripService.startLiveTrip();
  };

  const handleDeleteTrip = (id: string) => {
    storageService.deleteTrip(id);
    setTrips(storageService.getTrips());
  };

  const handleTripFinished = () => {
    setShowFinishModal(false);
    setShowLiveModal(false);
    setTrips(storageService.getTrips());
  };

  return (
    <div className="space-y-4">
      {/* STATE A: NO TRIP ACTIVE -> HERO "BẮT ĐẦU" CTA */}
      {!activeTrip && (
        <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-sm space-y-3.5 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 mb-0.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ghi lộ trình GPS</span>
              </div>
              <h2 className="font-extrabold text-base text-slate-800">
                Bắt đầu chuyến đi mới
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Tự động đo tốc độ, số km và vẽ bản đồ trực tiếp
              </p>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl flex-shrink-0 shadow-xs">
              🛵
            </div>
          </div>

          <button
            onClick={handleStartNewTrip}
            className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-md shadow-emerald-500/25 transition-all active:scale-95"
          >
            <Compass className="w-5 h-5 animate-spin-slow" />
            <span>Bắt đầu chuyến đi</span>
          </button>
        </div>
      )}

      {/* STATE B: ACTIVE TRIP RUNNING -> STICKY LIVE COCKPIT BANNER */}
      {activeTrip && (
        <ActiveTripBanner
          activeTrip={activeTrip}
          onOpenDetails={() => setShowLiveModal(true)}
        />
      )}

      {/* Completed Trips History Section */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Chuyến đi gần đây ({trips.length})
          </h2>
        </div>

        {trips.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center space-y-2 border border-slate-100">
            <span className="text-3xl block">🛣️</span>
            <div className="font-bold text-sm text-slate-700">Chưa có chuyến đi nào</div>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Bấm <b>"Bắt đầu chuyến đi"</b> để ghi lại lộ trình đầu tiên của bạn!
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {trips.map((trip) => (
              <TripHistoryCard
                key={trip.id}
                trip={trip}
                onDelete={handleDeleteTrip}
              />
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: LIVE TRIP COCKPIT */}
      {showLiveModal && activeTrip && (
        <LiveTripModal
          activeTrip={activeTrip}
          onClose={() => setShowLiveModal(false)}
          onOpenFinishModal={() => {
            setShowLiveModal(false);
            setShowFinishModal(true);
          }}
        />
      )}

      {/* MODAL 2: FINISH & SAVE TRIP */}
      {showFinishModal && activeTrip && (
        <FinishTripModal
          activeTrip={activeTrip}
          onClose={() => {
            setShowFinishModal(false);
            setShowLiveModal(true);
          }}
          onFinished={handleTripFinished}
        />
      )}
    </div>
  );
};
