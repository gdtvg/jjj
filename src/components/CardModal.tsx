import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../types/game';
import { playSound } from '../utils/sound';
import { ASSETS } from '../assets/assetMap';

interface CardModalProps {
  card: Card;
  isMyTurn: boolean;
  onResolve: () => void;
}

export const CardModal: React.FC<CardModalProps> = ({ card, isMyTurn, onResolve }) => {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const isChance = card.type === 'chance';
  const cardArt = isChance ? ASSETS.chanceArt : ASSETS.chestArt;
  const [submitting, setSubmitting] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  useEffect(() => {
    if (isFlipped && isMyTurn) confirmRef.current?.focus();
  }, [isFlipped, isMyTurn]);

  useEffect(() => {
    setIsFlipped(false);
    setSubmitting(false);
    // 3D card flip animation after short delay
    const timer = setTimeout(() => {
      setIsFlipped(true);
      playSound('card');
    }, 250);
    return () => clearTimeout(timer);
  }, [card.id]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="event-card-title" className="event-card-overlay fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div
        className="w-full max-w-sm"
        style={{ perspective: '1200px' }}
      >
        {/* Flipping 3D Card Container */}
        <div
          className="relative w-full aspect-[3/4] max-h-[min(580px,85dvh)] transition-transform duration-700 ease-out shadow-2xl rounded-3xl"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(0deg)' : 'rotateY(180deg)',
          }}
        >
          {/* Card Back (Starts visible, flips away) */}
          <div
            className="absolute inset-0 w-full h-full rounded-3xl border-4 border-amber-500/80 bg-gradient-to-br from-amber-950 via-slate-900 to-amber-950 p-6 flex flex-col items-center justify-between text-white shadow-2xl overflow-hidden"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="text-xs uppercase font-black tracking-widest text-amber-300">
              OFFICIAL MONOPOLY DECK
            </div>
            <div className="flex flex-col items-center my-auto">
              <img
                src={ASSETS.luxuryCrest}
                alt="Card Back Crest"
                className="w-32 h-32 object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)]"
              />
              <span className="text-lg font-black tracking-widest text-amber-200 mt-2">
                {isChance ? 'CHANCE' : 'COMMUNITY CHEST'}
              </span>
            </div>
            <div className="text-[10px] text-amber-400/60 uppercase tracking-widest">
              Dein Ereignis wird aufgedeckt
            </div>
          </div>

          {/* Card Front (Revealed after flip) */}
          <div
            className="absolute inset-0 w-full h-full rounded-3xl border-4 border-amber-600/70 bg-gradient-to-b from-amber-50 via-stone-100 to-amber-100 font-sans shadow-2xl flex flex-col justify-between overflow-hidden"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(0deg)',
            }}
          >
            {/* Card Artwork Image Banner */}
            <div className="relative w-full h-36 sm:h-44 shrink-0 overflow-hidden border-b-2 border-amber-700/50 bg-stone-900">
              <img
                src={cardArt}
                alt={card.title}
                className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent flex items-end p-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                    {isChance ? 'EREIGNISKARTE' : 'GEMEINSCHAFTSKARTE'}
                  </span>
                  <h2 id="event-card-title" className="text-xl font-black text-white leading-tight drop-shadow-md">
                    {card.title}
                  </h2>
                </div>
              </div>
            </div>

            {/* Card Body & Instructions */}
            <div className="p-5 overflow-y-auto flex-1 flex flex-col justify-between text-center text-slate-900">
              <p className="text-sm md:text-base text-stone-800 leading-relaxed font-serif px-2 font-medium my-auto">
                {card.description}
              </p>

              {card.amount && (
                <div className="inline-block mx-auto px-4 py-1 rounded-xl bg-emerald-950/15 border border-emerald-600/30 text-lg font-mono font-black text-emerald-800 shadow-inner">
                  ${card.amount}
                </div>
              )}

              {/* Action button */}
              <div className="pt-3">
                {isMyTurn ? (
                  <button
                    ref={confirmRef}
                    disabled={!isFlipped || submitting}
                    onClick={() => {
                      if (submitting) return;
                      setSubmitting(true);
                      setTimeout(() => setSubmitting(false), 1500);
                      playSound('click');
                      onResolve();
                    }}
                    className="cursor-pointer w-full py-2.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_6px_20px_rgba(245,158,11,0.4)] active:scale-95"
                  >
                    {submitting ? 'Wird ausgeführt …' : 'Ereignis ausführen'}
                  </button>
                ) : (
                  <div className="text-xs text-stone-600 italic font-medium">
                    Der aktive Spieler bestätigt das Ereignis …
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
