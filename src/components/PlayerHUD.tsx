import React from 'react';
import { Landmark, Handshake, Dices, Banknote, ArrowRight } from 'lucide-react';
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
        <span>Spieler am Tisch</span>
        <span>Vermögen</span>
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
                  ? 'bg-amber-200/5 border-amber-200/40'
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
                        DU
                      </span>
                    )}
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-amber-200" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span>{stats.propCount} Grundstücke</span>
                    {stats.houseCount > 0 && <span>· {stats.houseCount} Gebäude</span>}
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
                  Gesamt: ${totalWealth}
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
  activity?: 'rolling' | 'result' | 'moving' | null;
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
  activity,
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
    <div className="game-actionbar backdrop-blur-md bg-white/10 border border-white/15 rounded-2xl p-3.5 shadow-2xl flex flex-wrap items-center justify-between gap-3">
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
              {isMyTurn ? 'Du bist am Zug' : `${activePlayer?.name} ist am Zug`}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider bg-black/40 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
              {activity === 'rolling' ? 'Würfelwurf' : activity === 'result' ? 'Ergebnis' : activity === 'moving' ? 'Bewegung' : ({ LOBBY: 'Warteraum', ROLL: 'Würfeln', ACTION: 'Grundstück', RESOLVING_CARD: 'Ereignis', END_TURN: 'Zug abschließen', GAME_OVER: 'Spielende' }[gameState.phase])}
            </span>
          </div>
          <div className="text-xs font-semibold text-slate-100 mt-0.5" role="status">
            {activity && (activity === 'rolling' ? 'Die Kamera zeigt den Wurf auf dem Tisch.' : activity === 'result' ? 'Die Würfel sind gefallen.' : 'Die Figur zieht zum nächsten Feld.')}
            {!activity && gameState.phase === 'ROLL' &&
              (isMyTurn ? 'Würfle, um deine Figur zu bewegen.' : 'Wartet auf den Würfelwurf …')}
            {!activity && gameState.phase === 'ACTION' && currentTile && (
              <span>
                Gelandet auf <b className="text-amber-400">{currentTile.name}</b> (${currentTile.price})
              </span>
            )}
            {!activity && gameState.phase === 'RESOLVING_CARD' && 'Bestätige die gezogene Ereigniskarte.'}
            {!activity && gameState.phase === 'END_TURN' &&
              (isMyTurn ? 'Verwalte deinen Besitz oder beende deinen Zug.' : 'Der Zug wird abgeschlossen …')}
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
          <Landmark size={15} /> Besitz
        </button>

        <button
          onClick={() => {
            playSound('click');
            onOpenTradeModal();
          }}
          className="cursor-pointer px-3.5 py-2 bg-white/10 hover:bg-white/20 text-slate-100 border border-white/20 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 active:scale-95"
        >
          <Handshake size={15} /> Handeln
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
                        Kaution · $50
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
                        Freikarte nutzen
                      </button>
                    )}
                  </>
                )}

                <button
                  onClick={() => {
                    playSound('roll');
                    onRollDice();
                  }}
                  className="cursor-pointer px-6 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-[0_4px_15px_rgba(245,158,11,0.5)] active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Dices size={17} /> Würfeln
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
                  <Banknote size={15} /> Kaufen · ${currentTile.price}
                </button>
                <button
                  onClick={() => {
                    playSound('click');
                    onDeclineProperty();
                  }}
                  className="cursor-pointer px-4 py-2.5 bg-white/10 hover:bg-white/20 text-slate-300 border border-white/20 rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                  Verzichten
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
                Zug beenden <ArrowRight size={15} />
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
                Bankrott erklären
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
