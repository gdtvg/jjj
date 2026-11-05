import { useRef, useState } from 'react';
import type { GameState, TradeOffer } from '../types/game';
import { BOARD_TILES } from '../data/monopolyBoard';
export function TradeRequests({ state, playerId, respond, cancel, onPreview }: { state: GameState; playerId: string; respond: (id: string, accept: boolean) => Promise<boolean>; cancel: (id: string) => Promise<boolean>; onPreview?: (id: number) => void }) {
  const pending = state.pendingTrades ?? (state.activeTrade ? [state.activeTrade] : []);
  const lock = useRef(new Set<string>());
  const [busy, setBusy] = useState<string[]>([]);
  const act = async (id: string, action: () => Promise<boolean>) => {
    if (lock.current.has(id)) return;
    lock.current.add(id); setBusy([...lock.current]);
    try { await action(); } finally { lock.current.delete(id); setBusy([...lock.current]); }
  };
  const assets = (money: number, ids: number[]) => <><strong>${money.toLocaleString()}</strong>{ids.length ? <ul>{ids.map(id => <li key={id}>{onPreview ? <button type="button" className="trade-inline-preview" onClick={() => onPreview(id)}>{BOARD_TILES[id]?.name} · 3D</button> : BOARD_TILES[id]?.name}{state.properties[id]?.mortgaged ? ' · Hypothek' : ''}</li>)}</ul> : <span>Keine Grundstücke</span>}</>;
  return <div className="trade-requests">{pending.filter(t => [t.fromPlayerId, t.toPlayerId].includes(playerId)).map((trade: TradeOffer) => {
    const incoming = trade.toPlayerId === playerId;
    const other = state.players.find(p => p.id === (incoming ? trade.fromPlayerId : trade.toPlayerId));
    return <section className="trade-request" key={trade.id} aria-label={`Handelsanfrage ${other?.name}`}>
      <h3>{incoming ? 'Handelsanfrage von' : 'Angebot an'} {other?.name}</h3><small>Ausstehend · {incoming ? 'Deine Antwort fehlt' : 'Wartet auf Antwort'}</small>
      <div className="trade-request-assets"><div><h4>Du bekommst</h4>{assets(incoming ? trade.offeredMoney : trade.requestedMoney, incoming ? trade.offeredProperties : trade.requestedProperties)}</div><div><h4>Du gibst ab</h4>{assets(incoming ? trade.requestedMoney : trade.offeredMoney, incoming ? trade.requestedProperties : trade.offeredProperties)}</div></div>
      <div className="trade-request-actions">{incoming ? <><button disabled={busy.includes(trade.id)} className="trade-accept" onClick={() => act(trade.id, () => respond(trade.id, true))}>ACCEPT</button><button disabled={busy.includes(trade.id)} className="trade-decline" onClick={() => act(trade.id, () => respond(trade.id, false))}>DECLINE</button></> : <button disabled={busy.includes(trade.id)} onClick={() => act(trade.id, () => cancel(trade.id))}>Angebot zurückziehen</button>}</div>
    </section>;
  })}</div>;
}
