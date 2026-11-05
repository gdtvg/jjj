import React, { useEffect, useState } from 'react';
import { fetchGlobalLeaderboard, LeaderboardRecord } from '../lib/leaderboard';
import { playSound } from '../utils/sound';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onError?: (message: string) => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ isOpen, onClose, onError }) => {
  const [records, setRecords] = useState<LeaderboardRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      fetchGlobalLeaderboard().then((data) => {
        setRecords(data);
      }).catch(() => { const message = 'Rangliste konnte nicht geladen werden. Bitte versuche es erneut.'; setError(message); onError?.(message); }).finally(() => setLoading(false));
    }
  }, [isOpen, onError]);

  if (!isOpen) return null;

  return (
    <div className="game-dialog-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/40 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border-b border-amber-500/30 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div>
              <h2 className="text-xl font-black text-amber-300 tracking-wide uppercase">
                Global High Rollers
              </h2>
              <p className="text-xs text-slate-400">Global Leaderboard</p>
            </div>
          </div>
          <button
            onClick={() => {
              playSound('click');
              onClose();
            }}
            className="cursor-pointer text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400">Loading leaderboard...</span>
            </div>
          ) : error ? (<p role="alert" className="text-sm text-red-300">{error}</p>) : records.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <span className="text-4xl block">🎩</span>
              <p className="text-sm font-bold text-slate-300">No Hall of Fame records yet!</p>
              <p className="text-xs text-slate-500">
                Win your first match to claim the #1 spot in the cloud database!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((entry, idx) => (
                <div
                  key={entry.id || idx}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                    idx === 0
                      ? 'bg-amber-500/15 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                      : idx === 1
                      ? 'bg-slate-800/80 border-slate-600/50'
                      : idx === 2
                      ? 'bg-amber-900/20 border-amber-800/40'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                        idx === 0
                          ? 'bg-amber-400 text-slate-950 font-black'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-950'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-white text-sm block">{entry.username}</span>
                      <span className="text-[11px] text-slate-400">
                        {entry.gamesPlayed} {entry.gamesPlayed === 1 ? 'game' : 'games'} played
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-emerald-400 font-mono font-black text-sm block">
                      ${entry.totalCashEarned?.toLocaleString() || '1,500'}
                    </span>
                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                      {entry.wins} {entry.wins === 1 ? 'Victory' : 'Victories'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Global match results</span>
          </span>
          <button
            onClick={() => {
              playSound('click');
              onClose();
            }}
            className="cursor-pointer px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs uppercase transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
