import React, { useEffect, useRef, useState } from 'react';
import { BOARD_TILES } from '../data/monopolyBoard';
import { GameState, Player } from '../types/game';
import { PropertyModel } from './PropertyModel';
import { PROPERTY_COLORS } from '../utils/propertyModel';
import { Box, X } from 'lucide-react';
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

  const [previewId, setPreviewId] = useState<number | null>(null);
  const previewRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (previewId !== null) previewRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [previewId]);
  const previewTile = previewId === null ? undefined : BOARD_TILES[previewId];
  const previewProperty = previewId === null ? undefined : gameState.properties[previewId];
  const previewOwner = gameState.players.find(p => p.id === previewProperty?.ownerId);

  const partner = gameState.players.find((p) => p.id === selectedPartnerId);

  // Active trade pending?
  const activeTrade = gameState.activeTrade;
  const isIncomingTrade = activeTrade && activeTrade.toPlayerId === currentPlayer.id;
  const isOutgoingTrade = activeTrade && activeTrade.fromPlayerId === currentPlayer.id;

  const myProperties = Object.values(gameState.properties)
    .filter((p) => p.ownerId === currentPlayer.id)
    .map((p) => BOARD_TILES[p.tileId]);

  const partnerProperties = partner
    ? Object.values(gameState.properties)
        .filter((p) => p.ownerId === partner.id)
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

  const propertyRow = (id: number, selected: boolean, toggle: () => void) => {
    const tile = BOARD_TILES[id];
    const improved = gameState.properties[id]?.houses > 0;
    return <div key={id} className="trade-property-row" data-previewed={previewId === id}>
      <input type="checkbox" aria-label={`${tile.name} zum Handel auswählen`} checked={selected} disabled={improved} onChange={toggle} />
      <button type="button" className="trade-property-preview" aria-label={`${tile.name} in 3D ansehen`} aria-pressed={previewId === id} onClick={() => setPreviewId(id)}>
        <span className="trade-property-color" style={{ background: PROPERTY_COLORS[tile.color || tile.type] }} />
        <span>{tile.name}{improved && <small>Vor dem Handel Gebäude verkaufen</small>}</span><Box size={16} aria-hidden="true" />
      </button>
    </div>;
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
    <div className="game-dialog-overlay fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div role="dialog" aria-modal="true" aria-labelledby="trade-title" className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-24px)]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤝</span>
            <div>
              <h2 id="trade-title" className="font-bold text-base text-white">Grundstückshandel</h2>
              <p className="text-xs text-slate-400">Grundstücke in 3D ansehen und Angebote zusammenstellen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Handel schließen"
            className="cursor-pointer text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <div className="trade-scroll-region">
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
                    : activeTrade.offeredProperties.map(id => <button key={id} type="button" className="trade-inline-preview" onClick={() => setPreviewId(id)}>{BOARD_TILES[id]?.name} <Box size={12} aria-hidden="true" /></button>)}
                </div>
              </div>
              <div>
                <span className="font-bold text-amber-400 block mb-1">They Request from You:</span>
                <div>Cash: ${activeTrade.requestedMoney}</div>
                <div>
                  Properties:{' '}
                  {activeTrade.requestedProperties.length === 0
                    ? 'None'
                    : activeTrade.requestedProperties.map(id => <button key={id} type="button" className="trade-inline-preview" onClick={() => setPreviewId(id)}>{BOARD_TILES[id]?.name} <Box size={12} aria-hidden="true" /></button>)}
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
        <div className="p-5 space-y-5">
          {previewTile && <section ref={previewRef} className="trade-model-panel" aria-label="Grundstücksvorschau">
            <header><div><span className="purchase-eyebrow">Grundstück ansehen · {previewOwner?.name || 'Bank'}</span><h3>{previewTile.name}</h3></div><button type="button" aria-label="Grundstücksvorschau schließen" onClick={() => setPreviewId(null)}><X size={18} /></button></header>
            <PropertyModel key={previewTile.id} tile={previewTile} property={previewProperty} />
            <p>Kaufwert: ${previewTile.price} · {previewProperty?.mortgaged ? 'Mit Hypothek belastet' : 'Ohne Hypothek'} · {previewProperty?.houses === 5 ? 'Hotel' : `${previewProperty?.houses || 0} Häuser`}</p>
          </section>}
          <p className="text-xs text-slate-400">Klicke auf den Grundstücksnamen für das 3D-Brettfeld. Mit dem Häkchen wählst du es für den Handel aus.</p>
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
                    setRequestedMoney(0);
                    setPreviewId(null);
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
                      <span className="text-[11px] text-slate-500 italic">Keine Grundstücke vorhanden</span>
                    ) : (
                      myProperties.map(tile => propertyRow(tile.id, offeredProperties.includes(tile.id), () => toggleOfferedProp(tile.id)))
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
                      <span className="text-[11px] text-slate-500 italic">Keine Grundstücke vorhanden</span>
                    ) : (
                      partnerProperties.map(tile => propertyRow(tile.id, requestedProperties.includes(tile.id), () => toggleRequestedProp(tile.id)))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3 shrink-0">
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
