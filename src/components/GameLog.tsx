import React, { useState, useRef, useEffect } from 'react';
import { GameLogEntry } from '../types/game';

interface GameLogProps {
  logs: GameLogEntry[];
  onSendMessage: (message: string) => void;
}

export const GameLog: React.FC<GameLogProps> = ({ logs, onSendMessage }) => {
  const [chatInput, setChatInput] = useState('');
  const [filter, setFilter] = useState<'all' | 'chat' | 'events'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  const filteredLogs = logs.filter((entry) => {
    if (filter === 'chat') return entry.type === 'chat';
    if (filter === 'events') return entry.type !== 'chat';
    return true;
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col flex-1 min-h-0 shadow-xl overflow-hidden">
      {/* Header with filter tabs */}
      <div className="p-2.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
          Live Arena Ticker
        </span>
        <div className="flex gap-1 p-0.5 bg-slate-900 rounded-lg border border-slate-800 text-[10px]">
          <button
            onClick={() => setFilter('all')}
            className={`cursor-pointer px-2 py-0.5 rounded font-semibold transition-colors ${
              filter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('events')}
            className={`cursor-pointer px-2 py-0.5 rounded font-semibold transition-colors ${
              filter === 'events' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Events
          </button>
          <button
            onClick={() => setFilter('chat')}
            className={`cursor-pointer px-2 py-0.5 rounded font-semibold transition-colors ${
              filter === 'chat' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Chat
          </button>
        </div>
      </div>

      {/* Log scroll area */}
      <div ref={scrollRef} className="flex-1 min-h-0 p-2.5 overflow-y-auto space-y-1.5 text-xs font-sans">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-slate-500 py-6 italic text-[11px]">
            No activity yet.
          </div>
        ) : (
          filteredLogs.map((entry) => {
            let icon = '•';
            let textColor = 'text-slate-300';

            switch (entry.type) {
              case 'roll':
                icon = '🎲';
                textColor = 'text-amber-300';
                break;
              case 'purchase':
                icon = '💰';
                textColor = 'text-emerald-400';
                break;
              case 'rent':
                icon = '💸';
                textColor = 'text-orange-300';
                break;
              case 'jail':
                icon = '🔒';
                textColor = 'text-rose-400';
                break;
              case 'card':
                icon = '📇';
                textColor = 'text-sky-300';
                break;
              case 'bankrupt':
                icon = '💀';
                textColor = 'text-red-500 font-bold';
                break;
              case 'trade':
                icon = '🤝';
                textColor = 'text-purple-300';
                break;
              case 'chat':
                icon = '💬';
                textColor = 'text-white';
                break;
            }

            return (
              <div
                key={entry.id}
                className={`py-1 px-1.5 rounded transition-colors ${
                  entry.type === 'chat' ? 'bg-slate-950/70 border border-slate-800/40' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-start gap-1.5 leading-tight">
                  <span className="text-xs shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    {entry.playerName && (
                      <span
                        className="font-bold mr-1.5"
                        style={{ color: entry.playerColor || '#94a3b8' }}
                      >
                        {entry.playerName}:
                      </span>
                    )}
                    <span className={textColor}>{entry.message}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Chat input */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-slate-800 bg-slate-950/90 flex gap-2 shrink-0">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Send a chat message..."
          maxLength={150}
          className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-hidden focus:border-amber-400"
        />
        <button
          type="submit"
          disabled={!chatInput.trim()}
          className="cursor-pointer px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs disabled:opacity-40 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
};
