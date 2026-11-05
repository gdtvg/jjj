import type { Player } from '../types/game';

// Figures share a field's exact horizontal center. A vertical stack keeps shared fields legible.
export function tokenRestHeight(players: Player[], playerId: string): number {
  const player = players.find(p => p.id === playerId);
  if (!player) return 0.12;
  const occupants = players.filter(p => !p.bankrupt && p.position === player.position);
  return 0.12 + Math.max(0, occupants.findIndex(p => p.id === playerId)) * 0.48;
}
