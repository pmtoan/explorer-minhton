import React, { useState, useEffect } from 'react';
import { TripsView } from './views/TripsView';
import { CafesView } from './views/CafesView';
import { SettingsView } from './views/SettingsView';
import { storageService } from './services/storageService';
import { Compass, Coffee, Cloud } from 'lucide-react';

type TabType = 'trips' | 'cafes' | 'settings';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('trips');
  const [isDriveConnected, setIsDriveConnected] = useState(false);

  useEffect(() => {
    // Initialise local-first storage
    storageService.initStorage();
    const config = storageService.getGoogleDriveConfig();
    setIsDriveConnected(!!config.accessToken);
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-800 flex justify-center selection:bg-emerald-500 selection:text-white">
      {/* Mobile-first centered frame container */}
      <div className="w-full max-w-lg bg-[#f8fafc] min-h-screen flex flex-col shadow-xl sm:border-x border-slate-200 relative pb-20">
        {/* App Top Header */}
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md px-5 py-3.5 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/20 text-xl">
              🛵
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-sm text-slate-800 tracking-tight leading-tight">
                  Explorer Minton
                </h1>
                <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                  v1.1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Tác giả: Minton • Nhật ký phượt & Cafe
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('settings')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              isDriveConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isDriveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
              }`}
            />
            <span className="text-[11px]">Drive Sync</span>
          </button>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 overflow-y-auto">
          {activeTab === 'trips' && <TripsView />}
          {activeTab === 'cafes' && <CafesView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>

        {/* Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 py-2.5 flex items-center justify-around pointer-events-auto shadow-lg">
            {/* Tab 1: Chuyến Đi */}
            <button
              onClick={() => setActiveTab('trips')}
              className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all duration-200 ${
                activeTab === 'trips'
                  ? 'bg-emerald-50 text-emerald-600 font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <Compass className={`w-5 h-5 ${activeTab === 'trips' ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[11px]">Chuyến Đi</span>
            </button>

            {/* Tab 2: Quán Cafe */}
            <button
              onClick={() => setActiveTab('cafes')}
              className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all duration-200 ${
                activeTab === 'cafes'
                  ? 'bg-emerald-50 text-emerald-600 font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <Coffee className={`w-5 h-5 ${activeTab === 'cafes' ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[11px]">Quán Cafe</span>
            </button>

            {/* Tab 3: Google Drive */}
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all duration-200 ${
                activeTab === 'settings'
                  ? 'bg-emerald-50 text-emerald-600 font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <Cloud className={`w-5 h-5 ${activeTab === 'settings' ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[11px]">Google Drive</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
};

export default App;
