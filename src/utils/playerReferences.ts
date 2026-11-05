import type { Player } from '../types/game';

export interface PlayerReference { start: number; end: number; playerId: string; mention: boolean }
const word = /[\p{L}\p{N}_]/u;
/** Literal, Unicode-aware longest-name matching; never matches Ann in Anna. */
export function playerReferences(message: string, players: Pick<Player, 'id' | 'name'>[], mentionsOnly = false): PlayerReference[] {
  const references: PlayerReference[] = [];
  const sorted = [...players].filter(p => p.name.trim()).sort((a, b) => b.name.length - a.name.length);
  for (let i = 0; i < message.length; i++) {
    const mention = message[i] === '@';
    if (mentionsOnly && !mention) continue;
    const start = i + (mention ? 1 : 0);
    if (i > 0 && (word.test(message[i - 1]) || message[i - 1] === '@')) continue;
    const match = sorted.find(p => message.slice(start, start + p.name.length).toLocaleLowerCase() === p.name.toLocaleLowerCase() &&
      !word.test(message[start + p.name.length] || '') && message[start + p.name.length] !== '@');
    if (!match) continue;
    const end = start + match.name.length;
    references.push({ start: i, end, playerId: match.id, mention });
    i = end - 1;
  }
  return references;
}

export function mentionQuery(value: string, caret: number) {
  const before = value.slice(0, caret);
  const match = before.match(/(?:^|\s)@([^@\n]*)$/u);
  if (!match) return null;
  return { start: caret - match[1].length - 1, end: caret, query: match[1] };
}
