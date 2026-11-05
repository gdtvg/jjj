import type { GameState, Player } from '../types/game';
export const ROLL_DURATION = 1000;
export const STEP_DURATION = 180;

export function movementPath(previous: number, player: Player): number[] {
  if (previous === player.position) return [];
  // Jail transfers are direct; a backwards card really moves backwards.
  if (player.inJail) return [previous, player.position];
  const backward = (previous + 37) % 40 === player.position;
  const direction = backward ? -1 : 1;
  const path = [previous];
  while (path[path.length - 1] !== player.position && path.length <= 40) {
    path.push((path[path.length - 1] + direction + 40) % 40);
  }
  return path;
}
export function hasNewRoll(previous: GameState, next: GameState): boolean {
  const known = new Set(previous.logs.map(log => log.id));
  return next.logs.some(log => !known.has(log.id) && log.type === 'roll' && /rolled \d and \d/.test(log.message));
}
export function movementDuration(previous: GameState, next: GameState): number {
  return Math.max(0, ...next.players.map(player => {
    const before = previous.players.find(p => p.id === player.id);
    return before ? Math.max(0, movementPath(before.position, player).length - 1) * STEP_DURATION : 0;
  }));
}
