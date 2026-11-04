import React, { useState } from 'react';
import { AVAILABLE_TOKENS, PLAYER_COLORS } from '../data/monopolyBoard';
import { LobbyRoom, Player, PlayerToken } from '../types/game';
import { playSound } from '../utils/sound';

interface LobbyProps {
  lobby: LobbyRoom;
  currentPlayer: Player;
  onReadyToggle: (ready: boolean) => void;
  onUpdateProfile: (token: PlayerToken, color: string, name: string) => void;
  onAddBot: () => void;
  onRemovePlayer: (playerId: string) => void;
  onStartGame: () => void;
  onLeaveLobby: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  lobby,
  currentPlayer,
  onReadyToggle,
  onUpdateProfile,
  onAddBot,
  onRemovePlayer,
  onStartGame,
  onLeaveLobby,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedToken, setSelectedToken] = useState<PlayerToken>(currentPlayer.token);
  const [selectedColor, setSelectedColor] = useState<string>(currentPlayer.color);
  const [nameInput, setNameInput] = useState<string>(currentPlayer.name);

  const isHost = currentPlayer.isHost;
  const canStart =
    isHost &&
    lobby.players.length >= 2 &&
    lobby.players.every((p) => p.isHost || p.isBot || p.isReady);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(lobby.roomId);
    setCopied(true);
    playSound('click');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveProfile = () => {
    onUpdateProfile(selectedToken, selectedColor, nameInput);
    setIsEditing(false);
    playSound('click');
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 flex flex-col gap-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 text-white p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-xl shadow-md">
            🎩
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Game Lobby</h1>
            <p className="text-xs text-slate-400">Waiting for players to prepare...</p>
          </div>
        </div>

        {/* Room Code Badge */}
        <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-4 py-2 rounded-xl">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Room Code</div>
            <div className="text-2xl font-black font-mono tracking-wider text-amber-400">{lobby.roomId}</div>
          </div>
          <button
            onClick={handleCopyCode}
            className="cursor-pointer ml-2 p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            title="Copy room code"
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Player list (2 cols) */}
        <div className="md:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Connected Players ({lobby.players.length}/6)
              </h2>
              {isHost && lobby.players.length < 6 && (
                <button
                  onClick={() => {
                    playSound('click');
                    onAddBot();
                  }}
                  className="cursor-pointer text-xs font-semibold px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <span>🤖</span> Add Bot AI
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {lobby.players.map((player) => {
                const isMe = player.id === currentPlayer.id;
                return (
                  <div
                    key={player.id}
                    className={`relative p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isMe
                        ? 'bg-slate-800/90 border-amber-500/50 shadow-md'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xl shadow-xs"
                        style={{
                          backgroundColor: `${player.color}20`,
                          borderColor: player.color,
                        }}
                      >
                        {player.token}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-white">
                            {player.name}
                          </span>
                          {isMe && (
                            <span className="text-[10px] text-amber-400 font-bold bg-amber-950/60 border border-amber-500/30 px-1 rounded">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs mt-0.5">
                          {player.isHost ? (
                            <span className="text-amber-400 font-medium flex items-center gap-1">
                              👑 Host
                            </span>
                          ) : player.isBot ? (
                            <span className="text-blue-400 font-medium flex items-center gap-1">
                              🤖 Bot AI
                            </span>
                          ) : player.isReady ? (
                            <span className="text-emerald-400 font-medium">✓ Ready</span>
                          ) : (
                            <span className="text-slate-400">Preparing...</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Kick action if host */}
                    {isHost && !player.isHost && (
                      <button
                        onClick={() => {
                          playSound('click');
                          onRemovePlayer(player.id);
                        }}
                        className="cursor-pointer text-slate-500 hover:text-red-400 p-1 text-xs transition-colors"
                        title="Remove player"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action bottom row */}
          <div className="mt-8 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => {
                playSound('click');
                onLeaveLobby();
              }}
              className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              ← Leave Lobby
            </button>

            <div className="flex items-center gap-3">
              {!isHost && (
                <button
                  onClick={() => {
                    playSound('click');
                    onReadyToggle(!currentPlayer.isReady);
                  }}
                  className={`cursor-pointer px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md ${
                    currentPlayer.isReady
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                  }`}
                >
                  {currentPlayer.isReady ? '✓ You Are Ready' : 'Ready Up'}
                </button>
              )}

              {isHost && (
                <button
                  onClick={() => {
                    playSound('click');
                    onStartGame();
                  }}
                  disabled={!canStart}
                  className={`cursor-pointer px-6 py-2.5 rounded-xl font-black text-sm tracking-wide uppercase transition-all shadow-lg ${
                    canStart
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/20 active:scale-95'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  🚀 Start Game
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Customization & Room Settings (1 col) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">
              Your Player Setup
            </h2>

            {/* Current preview */}
            <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 mb-5">
              <div
                className="w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl shadow-inner"
                style={{
                  backgroundColor: `${currentPlayer.color}25`,
                  borderColor: currentPlayer.color,
                }}
              >
                {currentPlayer.token}
              </div>
              <div className="flex-1">
                <div className="font-bold text-white text-base">{currentPlayer.name}</div>
                <div className="text-xs text-slate-400">Balance: $1500 (Standard)</div>
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="cursor-pointer text-xs font-semibold px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
              >
                {isEditing ? 'Cancel' : 'Customize'}
              </button>
            </div>

            {/* Customization Form */}
            {isEditing && (
              <div className="space-y-4 pt-2 border-t border-slate-800">
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-amber-400"
                  />
                </div>

                {/* Token Emoji */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Select Token
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {AVAILABLE_TOKENS.map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => setSelectedToken(token as PlayerToken)}
                        className={`cursor-pointer p-2 rounded-lg text-xl flex items-center justify-center transition-all ${
                          selectedToken === token
                            ? 'bg-amber-500/20 border-2 border-amber-400 scale-105'
                            : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'
                        }`}
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Player Color
                  </label>
                  <div className="flex gap-2">
                    {PLAYER_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        style={{ backgroundColor: color }}
                        className={`cursor-pointer w-7 h-7 rounded-full transition-transform ${
                          selectedColor === color
                            ? 'ring-4 ring-white/50 scale-110'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="cursor-pointer w-full mt-2 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors"
                >
                  Save Profile
                </button>
              </div>
            )}

            {/* Quick Game Info */}
            <div className="mt-6 space-y-2 text-xs text-slate-400">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>Game Mode</span>
                <span className="font-semibold text-slate-300">Classic Monopoly</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>Starting Cash</span>
                <span className="font-semibold text-emerald-400">$1500</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>Pass GO Reward</span>
                <span className="font-semibold text-emerald-400">+$200</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Jackpot</span>
                <span className="font-semibold text-slate-300">Free Parking Pot</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
