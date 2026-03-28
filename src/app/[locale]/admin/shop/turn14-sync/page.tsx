'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Play, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Turn14SyncDashboard() {
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/turn14-sync/status');
      const data = await res.json();
      if (data.success) {
        setBrands(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000); // poll every 3s
    return () => clearInterval(interval);
  }, []);

  const handleStartSync = async () => {
    if (!window.confirm('Are you sure you want to start a full catalog sync? This will take several minutes.')) return;
    
    setStarting(true);
    try {
      // Start in background (don't await completion)
      fetch('/api/admin/turn14-sync', { method: 'POST' });
      alert('Sync started successfully! Watch the progress bars below.');
    } catch (e: any) {
      alert('Failed to start sync: ' + e.message);
    } finally {
      setTimeout(() => setStarting(false), 2000);
    }
  };

  const isAnySyncing = brands.some(b => b.syncStatus === 'syncing');

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 text-white min-h-[80vh]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Turn14 Catalog Sync</h1>
          <p className="text-zinc-400 mt-1 text-sm">Monitor live catalog imports from the Turn14 distribution network.</p>
        </div>
        <button
          onClick={handleStartSync}
          disabled={starting || isAnySyncing}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-6 py-2.5 rounded text-sm font-bold tracking-wide transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          {isAnySyncing ? 'SYNCING IN PROGRESS' : 'START FULL SYNC'}
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-zinc-900 rounded-xl w-full border border-zinc-800"></div>
          </div>
        ) : brands.length === 0 ? (
          <div className="p-12 border border-zinc-800 border-dashed rounded-xl text-center text-zinc-500">
            No tracked brands found. Add brands to tracking first.
          </div>
        ) : (
          brands.map(brand => {
            const isSyncing = brand.syncStatus === 'syncing';
            const isError = brand.syncStatus === 'error';
            const progressPct = brand.syncTotal > 0 
              ? Math.min(100, Math.round((brand.syncProgress / brand.syncTotal) * 100))
              : (isSyncing ? 1 : (brand.syncStatus === 'idle' && brand.syncTotal > 0 ? 100 : 0));

            return (
              <div key={brand.id} className="bg-[#0a0a0c] border border-white/10 rounded-xl p-5 shadow-2xl relative overflow-hidden">
                {isSyncing && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500/20 overflow-hidden">
                    <div className="w-1/3 h-full bg-blue-500 animate-[moveLeftRight_2s_ease-in-out_infinite]"></div>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    {isSyncing ? (
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                        <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                      </div>
                    ) : isError ? (
                      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        {brand.brandName}
                        {!brand.isActive && <span className="text-[9px] font-bold uppercase tracking-widest bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">Inactive</span>}
                      </h3>
                      <p className="text-xs text-zinc-500 font-mono tracking-tight mt-0.5">
                        ID: {brand.brandId} {brand.lastSyncAt && `• LAST SYNC: ${new Date(brand.lastSyncAt).toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="sm:text-right">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-sm ${
                      isSyncing ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      isError ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {brand.syncStatus}
                    </span>
                  </div>
                </div>

                {/* Progress Visuals */}
                <div className="space-y-2.5 bg-[#111] rounded-lg p-3 border border-white/5">
                  <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                    <span className="truncate pr-4 text-white/70">{brand.syncMessage || (isSyncing ? 'FETCHING...' : 'READY')}</span>
                    <span className="shrink-0 font-mono tabular-nums text-white/50">
                      {isSyncing ? `${brand.syncProgress} / ${brand.syncTotal || '?'} PGS (${progressPct}%)` : (brand.syncStatus === 'idle' ? '100%' : '0%')}
                    </span>
                  </div>
                  
                  <div className="h-1.5 w-full bg-[#0a0a0c] rounded-full overflow-hidden border border-black inset-0 shadow-inner">
                    <div 
                      className={`h-full transition-all duration-[2000ms] ease-out ${
                        isSyncing ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 
                        isError ? 'bg-red-500' : 
                        'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes moveLeftRight {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}} />
    </div>
  );
}
