import { useEffect, useState } from 'react';
import type { GameState } from '../types/game';

export function TurnCountdown({ deadline, phase, total = 25 }: { deadline?: number; phase: GameState['phase']; total?: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  if (!deadline) return null;
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  const action = phase === 'ROLL' ? 'Automatischer Wurf' : phase === 'ACTION' ? 'Verzicht & Zugende' : phase === 'RESOLVING_CARD' ? 'Karte bestätigen' : 'Automatisches Zugende';
  return <div className="turn-countdown" data-urgent={seconds <= 5} role="timer" aria-label={`${action} in ${seconds} Sekunden`}><span>{action}</span><strong>{seconds} s</strong><progress max={total || 25} value={seconds} /></div>;
}

