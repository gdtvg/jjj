import React, { useState, useRef, useEffect } from 'react';
import { playerReferences, mentionQuery } from '../utils/playerReferences';
import { GameLogEntry, Player } from '../types/game';

interface GameLogProps {
  logs: GameLogEntry[];
  players: Player[];
  currentPlayerId: string;
  onSendMessage: (message: string) => Promise<boolean>;
}

export const GameLog: React.FC<GameLogProps> = ({ logs, players, currentPlayerId, onSendMessage }) => {
  const [sending, setSending] = useState(false);
  const sendLock = useRef(false);
  const [chatInput, setChatInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [caret, setCaret] = useState(0);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [optionIndex, setOptionIndex] = useState(0);
  const query = mentionOpen ? mentionQuery(chatInput, caret) : null;
  const candidates = query ? players.filter(p => p.name.toLocaleLowerCase().startsWith(query.query.toLocaleLowerCase())) : [];
  const insertMention = (player: Player) => {
    if (!query) return;
    const text = `@${player.name} `;
    const next = chatInput.slice(0, query.start) + text + chatInput.slice(query.end);
    if (next.length > 150) return;
    setChatInput(next); setMentionOpen(false);
    const nextCaret = query.start + text.length; setCaret(nextCaret);
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(nextCaret, nextCaret); });
  };
  const renderMessage = (entry: GameLogEntry) => {
    const refs = playerReferences(entry.message, players, entry.type === 'chat');
    const parts: React.ReactNode[] = []; let cursor = 0;
    for (const ref of refs) {
      parts.push(entry.message.slice(cursor, ref.start));
      const player = players.find(p => p.id === ref.playerId);
      parts.push(<mark key={ref.start} className="chat-player-reference" style={{ color: player?.color }}>{entry.message.slice(ref.start, ref.end)}</mark>);
      cursor = ref.end;
    }
    parts.push(entry.message.slice(cursor)); return parts;
  };
  const [filter, setFilter] = useState<'all' | 'chat' | 'events'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || sendLock.current) return;
    const message = chatInput.trim();
    sendLock.current = true; setSending(true);
    try { if (await onSendMessage(message)) { setChatInput(''); setMentionOpen(false); setCaret(0); } }
    finally { sendLock.current = false; setSending(false); }
  };

  const filteredLogs = logs.filter((entry) => {
    if (filter === 'chat') return entry.type === 'chat';
    if (filter === 'events') return entry.type !== 'chat';
    return true;
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col flex-1 min-w-0 min-h-0 shadow-xl overflow-hidden">
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

            const highlighted = entry.type === 'chat' ? Boolean(entry.mentionIds?.length || playerReferences(entry.message, players, true).length) : (entry.participantIds?.length || 0) > 1;
            const age = Math.max(0, Date.now() - entry.timestamp);
            return (
              <div
                key={entry.id}
                data-mentioned={entry.mentionIds?.includes(currentPlayerId)}
                style={highlighted ? { animationDelay: `-${Math.min(age, 4500)}ms` } : undefined}
                className={`${highlighted ? 'chat-highlight' : ''} py-1 px-1.5 rounded transition-colors ${
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
                    <span className={`${textColor} chat-message-text`}>{renderMessage(entry)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Chat input */}
      <form onSubmit={handleSubmit} className="chat-compose p-2 border-t border-slate-800 bg-slate-950/90 flex gap-2 shrink-0">
        {query && candidates.length > 0 && <div id="chat-mention-list" role="listbox" aria-label="Spieler erwähnen" className="chat-mention-list">{candidates.map((player, index) => <button key={player.id} id={`mention-${index}`} type="button" role="option" aria-selected={index === optionIndex % candidates.length} onPointerDown={e => e.preventDefault()} onClick={() => insertMention(player)}><span style={{ color: player.color }}>{player.token}</span><span>{player.name}</span><small>@mention</small></button>)}</div>}
        <input
          disabled={sending}
          ref={inputRef}
          role="combobox" aria-autocomplete="list" aria-expanded={Boolean(query && candidates.length)} aria-controls="chat-mention-list" aria-activedescendant={query && candidates.length ? `mention-${optionIndex % candidates.length}` : undefined}
          aria-label="Chatnachricht"
          onBlur={() => setMentionOpen(false)}
          onSelect={e => { setCaret(e.currentTarget.selectionStart || 0); }}
          onKeyDown={e => {
            if (e.key === 'Escape') { setMentionOpen(false); return; }
            if (!query || !candidates.length) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOptionIndex(i => (i + (e.key === 'ArrowDown' ? 1 : candidates.length - 1)) % candidates.length); }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(candidates[optionIndex % candidates.length]); }
          }}
          type="text"
          value={chatInput}
          onChange={e => { setChatInput(e.target.value); setCaret(e.target.selectionStart || 0); setMentionOpen(true); setOptionIndex(0); }}
          placeholder="Nachricht … @Spieler erwähnen"
          maxLength={150}
          className="flex-1 min-w-0 bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-hidden focus:border-amber-400"
        />
        <button
          type="submit"
          disabled={sending || !chatInput.trim()}
          className="cursor-pointer px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs disabled:opacity-40 transition-colors"
        >
          {sending ? '…' : 'Senden'}
        </button>
      </form>
    </div>
  );
};
