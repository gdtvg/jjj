import React, { useState } from 'react';
import { BOARD_TILES } from '../data/monopolyBoard';
import { GameState, Player } from '../types/game';
import { playSound } from '../utils/sound';

interface TradeModalProps {
  gameState: GameState;
  currentPlayer: Player;
  onClose: () => void;
  onProposeTrade: (trade: {
    toPlayerId: string;
    offeredMoney: number;
    offeredProperties: number[];
    requestedMoney: number;
    requestedProperties: number[];
  }) => void;
  onRespondTrade: (tradeId: string, accept: boolean) => void;
  onCancelTrade: () => void;
}

export const TradeModal: React.FC<TradeModalProps> = ({
  gameState,
  currentPlayer,
  onClose,
  onProposeTrade,
  onRespondTrade,
  onCancelTrade,
}) => {
  const otherPlayers = gameState.players.filter(
    (p) => p.id !== currentPlayer.id && !p.bankrupt
  );
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    otherPlayers[0]?.id || ''
  );

  const [offeredMoney, setOfferedMoney] = useState<number>(0);
  const [offeredProperties, setOfferedProperties] = useState<number[]>([]);
  const [requestedMoney, setRequestedMoney] = useState<number>(0);
  const [requestedProperties, setRequestedProperties] = useState<number[]>([]);

  const partner = gameState.players.find((p) => p.id === selectedPartnerId);

  // Active trade pending?
  const activeTrade = gameState.activeTrade;
  const isIncomingTrade = activeTrade && activeTrade.toPlayerId === currentPlayer.id;
  const isOutgoingTrade = activeTrade && activeTrade.fromPlayerId === currentPlayer.id;

  const myProperties = Object.values(gameState.properties)
    .filter((p) => p.ownerId === currentPlayer.id && p.houses === 0)
    .map((p) => BOARD_TILES[p.tileId]);

  const partnerProperties = partner
    ? Object.values(gameState.properties)
        .filter((p) => p.ownerId === partner.id && p.houses === 0)
        .map((p) => BOARD_TILES[p.tileId])
    : [];

  const toggleOfferedProp = (id: number) => {
    setOfferedProperties((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleRequestedProp = (id: number) => {
    setRequestedProperties((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSendOffer = () => {
    if (!selectedPartnerId) return;
    playSound('money');
    onProposeTrade({
      toPlayerId: selectedPartnerId,
      offeredMoney,
      offeredProperties,
      requestedMoney,
      requestedProperties,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤝</span>
            <div>
              <h2 className="font-bold text-base text-white">Trade Agreement</h2>
              <p className="text-xs text-slate-400">Negotiate property and cash deals with other players</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Incoming Trade Alert View */}
        {isIncomingTrade && activeTrade && (
          <div className="p-6 bg-amber-950/40 border-b border-amber-500/30 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <span>🔔</span> Incoming Trade Offer from{' '}
              {gameState.players.find((p) => p.id === activeTrade.fromPlayerId)?.name}!
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="font-bold text-emerald-400 block mb-1">They Offer You:</span>
                <div>Cash: ${activeTrade.offeredMoney}</div>
                <div>
                  Properties:{' '}
                  {activeTrade.offeredProperties.length === 0
                    ? 'None'
                    : activeTrade.offeredProperties
                        .map((id) => BOARD_TILES[id]?.name)
                        .join(', ')}
                </div>
              </div>
              <div>
                <span className="font-bold text-amber-400 block mb-1">They Request from You:</span>
                <div>Cash: ${activeTrade.requestedMoney}</div>
                <div>
                  Properties:{' '}
                  {activeTrade.requestedProperties.length === 0
                    ? 'None'
                    : activeTrade.requestedProperties
                        .map((id) => BOARD_TILES[id]?.name)
                        .join(', ')}
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => onRespondTrade(activeTrade.id, false)}
                className="cursor-pointer px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Decline Offer
              </button>
              <button
                onClick={() => onRespondTrade(activeTrade.id, true)}
                className="cursor-pointer px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs"
              >
                Accept Trade
              </button>
            </div>
          </div>
        )}

        {/* Outgoing pending notification */}
        {isOutgoingTrade && (
          <div className="p-4 bg-blue-950/40 border-b border-blue-500/30 flex items-center justify-between">
            <span className="text-xs text-blue-300 font-semibold">
              Waiting for trade partner response...
            </span>
            <button
              onClick={onCancelTrade}
              className="cursor-pointer text-xs font-bold text-red-400 hover:text-red-300"
            >
              Cancel Trade Offer
            </button>
          </div>
        )}

        {/* Trade Creator form */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {/* Partner Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Select Trading Partner
            </label>
            <div className="flex flex-wrap gap-2">
              {otherPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPartnerId(p.id);
                    setRequestedProperties([]);
                  }}
                  className={`cursor-pointer px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    selectedPartnerId === p.id
                      ? 'bg-amber-500/20 border-amber-400 text-white'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{p.token}</span>
                  <span>{p.name}</span>
                  <span className="text-emerald-400 font-mono">(${p.money})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Trade columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: You Offer */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
                  You Offer ({currentPlayer.name})
                </h3>

                {/* Cash Input */}
                <div className="mb-4">
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Cash Offer (Max: ${currentPlayer.money})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={currentPlayer.money}
                    value={offeredMoney}
                    onChange={(e) =>
                      setOfferedMoney(
                        Math.max(0, Math.min(currentPlayer.money, parseInt(e.target.value) || 0))
                      )
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-white"
                  />
                </div>

                {/* Properties checkboxes */}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Properties to Offer
                  </label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {myProperties.length === 0 ? (
                      <span className="text-[11px] text-slate-500 italic">No unimproved properties</span>
                    ) : (
                      myProperties.map((tile) => (
                        <label
                          key={tile.id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-900 cursor-pointer text-xs text-white"
                        >
                          <input
                            type="checkbox"
                            checked={offeredProperties.includes(tile.id)}
                            onChange={() => toggleOfferedProp(tile.id)}
                            className="rounded border-slate-700 text-amber-500 focus:ring-0"
                          />
                          <span>{tile.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: You Request */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">
                  You Request ({partner?.name || 'Partner'})
                </h3>

                {/* Cash Input */}
                <div className="mb-4">
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Cash Requested (Partner Cash: ${partner?.money || 0})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={partner?.money || 0}
                    value={requestedMoney}
                    onChange={(e) =>
                      setRequestedMoney(
                        Math.max(0, Math.min(partner?.money || 0, parseInt(e.target.value) || 0))
                      )
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-white"
                  />
                </div>

                {/* Partner Properties checkboxes */}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Properties to Request
                  </label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {partnerProperties.length === 0 ? (
                      <span className="text-[11px] text-slate-500 italic">No unimproved properties</span>
                    ) : (
                      partnerProperties.map((tile) => (
                        <label
                          key={tile.id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-900 cursor-pointer text-xs text-white"
                        >
                          <input
                            type="checkbox"
                            checked={requestedProperties.includes(tile.id)}
                            onChange={() => toggleRequestedProp(tile.id)}
                            className="rounded border-slate-700 text-amber-500 focus:ring-0"
                          />
                          <span>{tile.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="cursor-pointer px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSendOffer}
            disabled={
              !partner ||
              (offeredMoney === 0 &&
                offeredProperties.length === 0 &&
                requestedMoney === 0 &&
                requestedProperties.length === 0)
            }
            className="cursor-pointer px-6 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send Trade Offer
          </button>
        </div>
      </div>
    </div>
  );
};
