import type { Player } from '../types/game';

// Figures share a field's exact horizontal center. A vertical stack keeps shared fields legible.
export function tokenRestHeight(players: Player[], playerId: string): number {
  const player = players.find(p => p.id === playerId);
  if (!player) return 0.12;
  const occupants = players.filter(p => !p.bankrupt && p.position === player.position);
  return 0.12 + Math.max(0, occupants.findIndex(p => p.id === playerId)) * 0.48;
}

// With large lobbies, figures on one field fan out in a small grid instead of a tall tower.
export function tokenSpreadOffset(players: Player[], playerId: string): { dx: number; dz: number; scale: number } {
  const player = players.find(p => p.id === playerId);
  if (!player) return { dx: 0, dz: 0, scale: 1 };
  const occupants = players.filter(p => !p.bankrupt && p.position === player.position);
  const index = Math.max(0, occupants.findIndex(p => p.id === playerId));
  const scale = players.length > 8 ? 0.62 : players.length > 6 ? 0.8 : 1;
  if (occupants.length <= 3) return { dx: 0, dz: 0, scale };
  const cols = Math.ceil(Math.sqrt(occupants.length));
  const gap = 0.42 * scale + 0.08;
  const rows = Math.ceil(occupants.length / cols);
  return { dx: ((index % cols) - (cols - 1) / 2) * gap, dz: (Math.floor(index / cols) - (rows - 1) / 2) * gap, scale };
}

export function tokenRestY(players: Player[], playerId: string): number {
  const player = players.find(p => p.id === playerId);
  const occupants = player ? players.filter(p => !p.bankrupt && p.position === player.position).length : 0;
  return occupants > 3 ? 0.12 : tokenRestHeight(players, playerId);
}
