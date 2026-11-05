import React, { useState } from 'react';
import { BOARD_TILES, COLOR_GROUPS, COLOR_HEX_MAP } from '../data/monopolyBoard';
import { BoardTile, GameState, Player } from '../types/game';
import { playSound } from '../utils/sound';

interface PropertyModalProps {
  gameState: GameState;
  currentPlayer: Player;
  selectedTile?: BoardTile | null;
  onClose: () => void;
  onBuildHouse: (tileId: number) => void;
  onSellHouse: (tileId: number) => void;
  onMortgage: (tileId: number) => void;
  onUnmortgage: (tileId: number) => void;
}

export const PropertyModal: React.FC<PropertyModalProps> = ({
  gameState,
  currentPlayer,
  selectedTile: initialTile,
  onClose,
  onBuildHouse,
  onSellHouse,
  onMortgage,
  onUnmortgage,
}) => {
  // If an initial tile was provided (e.g. from clicking on board), focus that; otherwise default to first owned property
  const [activeTileId, setActiveTileId] = useState<number>(
    initialTile ? initialTile.id : 1
  );

  const activeTile = BOARD_TILES[activeTileId];
  const propState = gameState.properties[activeTileId];
  const owner = propState?.ownerId ? gameState.players.find((p) => p.id === propState.ownerId) : null;
  const isMine = propState?.ownerId === currentPlayer.id;

  // Check monopoly for active property
  const color = activeTile?.color;
  const hasMonopoly =
    color &&
    COLOR_GROUPS[color] &&
    COLOR_GROUPS[color].every((id) => gameState.properties[id]?.ownerId === currentPlayer.id);

  // Group all properties owned by currentPlayer
  const myProperties = Object.values(gameState.properties)
    .filter((p) => p.ownerId === currentPlayer.id)
    .map((p) => BOARD_TILES[p.tileId]);

  return (
    <div className="game-dialog-overlay fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-24px)]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏛️</span>
            <div>
              <h2 className="font-bold text-base text-white">Property Management</h2>
              <p className="text-xs text-slate-400">View title deeds, develop houses, and manage mortgages</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content body: Left list of owned properties, Right deed card */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-5 overflow-y-auto">
          {/* Left panel: Your portfolio */}
          <div className="md:col-span-2 border-r border-slate-800 p-3 overflow-y-auto max-h-[60vh] space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
              Your Properties ({myProperties.length})
            </div>
            {myProperties.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 italic">
                You do not own any properties yet. Land on unowned spaces to buy them!
              </div>
            ) : (
              myProperties.map((tile) => {
                const prop = gameState.properties[tile.id];
                const colorInfo = tile.color ? COLOR_HEX_MAP[tile.color] : null;
                const isSelected = activeTileId === tile.id;

                return (
                  <button
                    key={tile.id}
                    onClick={() => {
                      playSound('click');
                      setActiveTileId(tile.id);
                    }}
                    className={`cursor-pointer w-full text-left p-2 rounded-xl border flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-slate-800 border-amber-400 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {colorInfo ? (
                        <div className={`w-3 h-6 rounded-xs ${colorInfo.bg}`} />
                      ) : (
                        <span className="text-sm">
                          {tile.type === 'railroad' ? '🚂' : '💡'}
                        </span>
                      )}
                      <div>
                        <div className="text-xs font-bold text-white truncate max-w-[130px]">
                          {tile.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {prop.mortgaged
                            ? 'Mortgaged'
                            : prop.houses === 5
                            ? '1 Hotel'
                            : prop.houses > 0
                            ? `${prop.houses} Houses`
                            : 'Undeveloped'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-slate-300">${tile.price}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* Right panel: Active Title Deed Card */}
          <div className="md:col-span-3 p-5 overflow-y-auto max-h-[60vh] flex flex-col items-center justify-between">
            {activeTile ? (
              <div className="w-full max-w-xs bg-stone-50 text-slate-900 border-2 border-slate-900 rounded-xl shadow-xl overflow-hidden font-sans">
                {/* Title Deed Header banner */}
                <div
                  className={`p-3 text-center border-b border-slate-900 ${
                    activeTile.color && COLOR_HEX_MAP[activeTile.color]
                      ? `${COLOR_HEX_MAP[activeTile.color].bg} text-white`
                      : 'bg-stone-200 text-slate-900'
                  }`}
                >
                  <div className="text-[10px] uppercase font-bold tracking-widest opacity-80">
                    TITLE DEED
                  </div>
                  <div className="text-sm font-black leading-tight mt-0.5">
                    {activeTile.name}
                  </div>
                </div>

                {/* Deed info table */}
                <div className="p-3 text-xs space-y-1.5">
                  {/* Status */}
                  <div className="flex justify-between border-b pb-1 text-[11px]">
                    <span className="text-slate-500">Owner</span>
                    <span className="font-bold" style={{ color: owner?.color || '#64748b' }}>
                      {owner ? owner.name : 'Unowned'}
                    </span>
                  </div>

                  {activeTile.type === 'street' && activeTile.rent && (
                    <>
                      <div className="flex justify-between font-semibold">
                        <span>Rent</span>
                        <span>${activeTile.rent[0]}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 italic pb-1">
                        With color monopoly: ${activeTile.rent[0] * 2}
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>With 1 House</span>
                        <span>${activeTile.rent[1]}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>With 2 Houses</span>
                        <span>${activeTile.rent[2]}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>With 3 Houses</span>
                        <span>${activeTile.rent[3]}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>With 4 Houses</span>
                        <span>${activeTile.rent[4]}</span>
                      </div>
                      <div className="flex justify-between font-bold text-red-700 pt-1 border-t">
                        <span>With HOTEL</span>
                        <span>${activeTile.rent[5]}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-600 pt-1">
                        <span>House Cost</span>
                        <span>${activeTile.houseCost} each</span>
                      </div>
                    </>
                  )}

                  {activeTile.type === 'railroad' && activeTile.rent && (
                    <div className="space-y-1 py-1">
                      <div className="flex justify-between">
                        <span>Rent (1 Railroad)</span>
                        <span>$25</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rent (2 Railroads)</span>
                        <span>$50</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rent (3 Railroads)</span>
                        <span>$100</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rent (4 Railroads)</span>
                        <span>$200</span>
                      </div>
                    </div>
                  )}

                  {activeTile.type === 'utility' && (
                    <div className="py-2 text-[11px] text-slate-600 space-y-1">
                      <p>If 1 Utility is owned, rent is 4 times amount shown on dice.</p>
                      <p>If both Utilities are owned, rent is 10 times amount shown on dice.</p>
                    </div>
                  )}

                  {/* Mortgage value */}
                  <div className="pt-2 border-t flex justify-between text-[10px] text-slate-500 font-medium">
                    <span>Mortgage Value</span>
                    <span>${Math.floor((activeTile.price || 100) / 2)}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Actions for current player if they own this property */}
            {isMine && propState && activeTile && (
              <div className="w-full mt-4 space-y-2">
                {activeTile.type === 'street' && (
                  <div className="flex gap-2">
                    {/* Build house */}
                    <button
                      onClick={() => {
                        playSound('buy');
                        onBuildHouse(activeTile.id);
                      }}
                      disabled={
                        !hasMonopoly ||
                        propState.houses >= 5 ||
                        propState.mortgaged ||
                        currentPlayer.money < (activeTile.houseCost || 100)
                      }
                      className={`cursor-pointer flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                        hasMonopoly && propState.houses < 5 && !propState.mortgaged
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      {propState.houses === 4
                        ? `Build Hotel ($${activeTile.houseCost})`
                        : `Build House ($${activeTile.houseCost})`}
                    </button>

                    {/* Sell house */}
                    {propState.houses > 0 && (
                      <button
                        onClick={() => {
                          playSound('money');
                          onSellHouse(activeTile.id);
                        }}
                        className="cursor-pointer flex-1 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-md"
                      >
                        Sell House (+${Math.floor((activeTile.houseCost || 100) / 2)})
                      </button>
                    )}
                  </div>
                )}

                {/* Mortgage / Unmortgage */}
                <div className="flex gap-2">
                  {!propState.mortgaged ? (
                    <button
                      onClick={() => {
                        playSound('money');
                        onMortgage(activeTile.id);
                      }}
                      disabled={propState.houses > 0}
                      className="cursor-pointer flex-1 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 transition-colors"
                    >
                      Mortgage (+${Math.floor((activeTile.price || 100) / 2)})
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        playSound('money');
                        onUnmortgage(activeTile.id);
                      }}
                      disabled={
                        currentPlayer.money <
                        Math.floor(((activeTile.price || 100) / 2) * 1.1)
                      }
                      className="cursor-pointer flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white transition-colors"
                    >
                      Unmortgage (-${Math.floor(((activeTile.price || 100) / 2) * 1.1)})
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
