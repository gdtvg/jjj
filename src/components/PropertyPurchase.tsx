import React, { useEffect, useRef, useState } from 'react';
import { Banknote, X } from 'lucide-react';
import type { BoardTile } from '../types/game';
import { PROPERTY_COLORS } from '../utils/propertyModel';
import { TurnCountdown } from './TurnCountdown';
import { PropertyModel } from './PropertyModel';

interface Props {
  tile: BoardTile;
  cash: number;
  deadline?: number;
  onClose: () => void;
  onBuy: () => Promise<boolean>;
  onDecline: () => Promise<boolean>;
}
export function PropertyPurchase({ tile, cash, deadline, onClose, onBuy, onDecline }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const affordable = cash >= (tile.price || 0);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  const act = async (action: () => Promise<boolean>) => {
    if (pending) return;
    setPending(true); setError(false);
    try { if (!await action()) setError(true); }
    catch { setError(true); }
    finally { setPending(false); }
  };
  return <div className="purchase-overlay" onKeyDown={event => {
    if (event.key === 'Escape' && !pending) { event.stopPropagation(); onClose(); }
    if (event.key === 'Tab') {
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <div ref={dialogRef} className="purchase-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-title" aria-describedby="purchase-description" tabIndex={-1} style={{ '--property-color': PROPERTY_COLORS[tile.color || 'utility'] } as React.CSSProperties}>
      <header className="purchase-heading"><div><span className="purchase-eyebrow">Zum Verkauf</span><h2 id="purchase-title">{tile.name}</h2></div><button aria-label="Vorschau schließen" disabled={pending} onClick={onClose}><X size={19} /></button></header>
      <div className="purchase-countdown"><TurnCountdown deadline={deadline} phase="ACTION" /></div>
      <PropertyModel tile={tile} />
      <div className="purchase-details">
        <p id="purchase-description">{tile.type === 'street' ? 'Erweitere deinen Besitz mit diesem Grundstück.' : tile.type === 'railroad' ? 'Sichere dir diesen Bahnhof für dein Streckennetz.' : 'Ergänze dein Portfolio um dieses Versorgungswerk.'}</p>
        <dl className="purchase-facts"><div><dt>Kaufpreis</dt><dd>${tile.price?.toLocaleString()}</dd></div><div><dt>Dein Bargeld</dt><dd>${cash.toLocaleString()}</dd></div><div><dt>Nach dem Kauf</dt><dd>{affordable ? `$${(cash - (tile.price || 0)).toLocaleString()}` : 'Nicht ausreichend'}</dd></div></dl>
        {tile.type === 'street' && <p className="purchase-rent">Grundmiete: ${tile.rent?.[0]} · Hausbau: ${tile.houseCost} je Haus</p>}
        {tile.type === 'railroad' && <p className="purchase-rent">Miete mit einem Bahnhof: ${tile.rent?.[0]}. Weitere Bahnhöfe erhöhen die Miete.</p>}
        {tile.type === 'utility' && <p className="purchase-rent">Miete: 4 × Würfelsumme; mit beiden Werken 10 × Würfelsumme.</p>}
        {error && <p role="alert" className="purchase-error">Die Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.</p>}
        {!affordable && <p className="purchase-error">Dir fehlen ${(Math.max(0, (tile.price || 0) - cash)).toLocaleString()} für den Kauf.</p>}
      </div>
      <footer className="purchase-actions"><button disabled={pending} onClick={() => act(onDecline)}>Verzichten</button><button className="purchase-buy" disabled={pending || !affordable} onClick={() => act(onBuy)}><Banknote size={17} />{pending ? 'Wird verarbeitet …' : `Kaufen · $${tile.price}`}</button></footer>
    </div>
  </div>;
}
