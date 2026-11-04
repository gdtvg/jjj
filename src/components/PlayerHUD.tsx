import React from 'react';
import { BOARD_TILES } from '../data/monopolyBoard';
import { GameState, Player } from '../types/game';
import { playSound } from '../utils/sound';

interface PlayerScoreboardProps {
  gameState: GameState;
  currentPlayer: Player;
}

export const PlayerScoreboard: React.FC<PlayerScoreboardProps> = ({
  gameState,
  currentPlayer,
}) => {
  const activePlayer = gameState.players[gameState.activePlayerIndex];

  const getPlayerStats = (playerId: string) => {
    const props = Object.values(gameState.properties).filter((p) => p.ownerId === playerId);
    const propCount = props.length;
    const houseCount = props.reduce(
      (acc, p) => acc + (p.houses > 0 ? (p.houses === 5 ? 5 : p.houses) : 0),
      0
    );
    const assetValue = props.reduce((acc, p) => {
      const tile = BOARD_TILES[p.tileId];
      return acc + (tile?.price || 0) + p.houses * (tile?.houseCost || 50);
    }, 0);
    return { propCount, houseCount, assetValue };
  };

  return (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-300 px-1">
        <span>Tycoon Leaderboard</span>
        <span>Net Worth</span>
      </div>
      <div className="space-y-2 overflow-y-auto max-h-56 pr-0.5">
        {gameState.players.map((player) => {
          const isActive = activePlayer?.id === player.id;
          const isMe = player.id === currentPlayer.id;
          const stats = getPlayerStats(player.id);
          const totalWealth = player.money + stats.assetValue;

          return (
            <div
              key={player.id}
              className={`relative rounded-xl p-3 border transition-all flex items-center justify-between backdrop-blur-md ${
                player.bankrupt
                  ? 'bg-slate-950/40 border-slate-900 opacity-40 grayscale'
                  : isActive
                  ? 'bg-white/15 border-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.35)] ring-1 ring-amber-400'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl border-2 flex items-center justify-center text-lg shadow-md shrink-0"
                  style={{
                    backgroundColor: `${player.color}35`,
                    borderColor: player.color,
                  }}
                >
                  {player.token}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white truncate max-w-[110px]">
                      {player.name}
                    </span>
                    {isMe && (
                      <span className="text-[8px] font-black text-amber-300 bg-amber-950/80 border border-amber-500/40 px-1 rounded-xs">
                        YOU
                      </span>
                    )}
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span>{stats.propCount} props</span>
                    {stats.houseCount > 0 && <span>· {stats.houseCount} buildings</span>}
                    {player.inJail && (
                      <span className="text-amber-400 font-bold">· 🔒 Jail</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div
                  className={`font-mono font-black text-xs ${
                    player.money < 0
                      ? 'text-red-400'
                      : player.money < 100
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  ${player.money}
                </div>
                <div className="text-[9px] font-mono text-slate-400">
                  Total: ${totalWealth}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ActionBarProps {
  gameState: GameState;
  currentPlayer: Player;
  onRollDice: () => void;
  onBuyProperty: (tileId: number) => void;
  onDeclineProperty: () => void;
  onPayJailFine: () => void;
  onUseJailCard: () => void;
  onEndTurn: () => void;
  onOpenTradeModal: () => void;
  onOpenPropertyModal: () => void;
  onDeclareBankruptcy: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  gameState,
  currentPlayer,
  onRollDice,
  onBuyProperty,
  onDeclineProperty,
  onPayJailFine,
  onUseJailCard,
  onEndTurn,
  onOpenTradeModal,
  onOpenPropertyModal,
  onDeclareBankruptcy,
}) => {
  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const isMyTurn = activePlayer && activePlayer.id === currentPlayer.id;
  const currentTile = activePlayer ? BOARD_TILES[activePlayer.position] : null;
  const currentTileProp = currentTile ? gameState.properties[currentTile.id] : null;

  return (
    <div className="backdrop-blur-md bg-white/10 border border-white/15 rounded-2xl p-3.5 shadow-2xl flex flex-wrap items-center justify-between gap-3">
      {/* Left: Turn Status Banner */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xl shadow-md shrink-0"
          style={{
            backgroundColor: `${activePlayer?.color}35`,
            borderColor: activePlayer?.color,
          }}
        >
          {activePlayer?.token}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-black tracking-wider text-slate-200">
              {isMyTurn ? 'Your Turn' : `${activePlayer?.name}'s Turn`}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider bg-black/40 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
              Phase: {gameState.phase}
            </span>
          </div>
          <div className="text-xs font-semibold text-slate-100 mt-0.5">
            {gameState.phase === 'ROLL' &&
              (isMyTurn ? 'Roll the dice to move around the board!' : 'Waiting for dice roll...')}
            {gameState.phase === 'ACTION' && currentTile && (
              <span>
                Landed on <b className="text-amber-400">{currentTile.name}</b> (${currentTile.price})
              </span>
            )}
            {gameState.phase === 'RESOLVING_CARD' && 'Drawn card needs resolution...'}
            {gameState.phase === 'END_TURN' &&
              (isMyTurn ? 'Manage assets or pass the dice.' : 'Finishing turn actions...')}
            {gameState.phase === 'GAME_OVER' && 'Champion declared!'}
          </div>
        </div>
      </div>

      {/* Right: Tactical Control Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Quick Modal triggers */}
        <button
          onClick={() => {
            playSound('click');
            onOpenPropertyModal();
          }}
          className="cursor-pointer px-3.5 py-2 bg-white/10 hover:bg-white/20 text-slate-100 border border-white/20 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 active:scale-95"
        >
          <span>🏛️</span> Deeds
        </button>

        <button
          onClick={() => {
            playSound('click');
            onOpenTradeModal();
          }}
          className="cursor-pointer px-3.5 py-2 bg-white/10 hover:bg-white/20 text-slate-100 border border-white/20 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 active:scale-95"
        >
          <span>🤝</span> Trade
        </button>

        {/* Turn-specific Buttons */}
        {isMyTurn && (
          <>
            {gameState.phase === 'ROLL' && (
              <>
                {currentPlayer.inJail && (
                  <>
                    {currentPlayer.money >= 50 && (
                      <button
                        onClick={() => {
                          playSound('tax');
                          onPayJailFine();
                        }}
                        className="cursor-pointer px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black transition-all shadow-md active:scale-95"
                      >
                        Pay $50 Bail
                      </button>
                    )}
                    {currentPlayer.getOutOfJailCards > 0 && (
                      <button
                        onClick={() => {
                          playSound('click');
                          onUseJailCard();
                        }}
                        className="cursor-pointer px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black transition-all shadow-md active:scale-95"
                      >
                        Use Free Card
                      </button>
                    )}
                  </>
                )}

                <button
                  onClick={() => {
                    playSound('roll');
                    onRollDice();
                  }}
                  className="cursor-pointer px-6 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-[0_4px_15px_rgba(245,158,11,0.5)] active:scale-95 transition-all flex items-center gap-1.5 animate-pulse"
                >
                  <span className="text-base">🎲</span> Roll Dice
                </button>
              </>
            )}

            {gameState.phase === 'ACTION' && currentTile && !currentTileProp?.ownerId && (
              <>
                <button
                  onClick={() => {
                    playSound('money');
                    onBuyProperty(currentTile.id);
                  }}
                  disabled={currentPlayer.money < (currentTile.price || 0)}
                  className={`cursor-pointer px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg active:scale-95 ${
                    currentPlayer.money >= (currentTile.price || 0)
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  <span>💰</span> Buy for ${currentTile.price}
                </button>
                <button
                  onClick={() => {
                    playSound('click');
                    onDeclineProperty();
                  }}
                  className="cursor-pointer px-4 py-2.5 bg-white/10 hover:bg-white/20 text-slate-300 border border-white/20 rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                  Decline
                </button>
              </>
            )}

            {gameState.phase === 'END_TURN' && (
              <button
                onClick={() => {
                  playSound('click');
                  onEndTurn();
                }}
                className="cursor-pointer px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex items-center gap-1.5"
              >
                End Turn →
              </button>
            )}

            {currentPlayer.money < 0 && (
              <button
                onClick={() => {
                  playSound('bankrupt');
                  onDeclareBankruptcy();
                }}
                className="cursor-pointer px-4 py-2.5 bg-rose-700 hover:bg-rose-600 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-colors shadow-md"
              >
                Declare Bankruptcy
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
