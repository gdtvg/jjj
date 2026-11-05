import { test } from 'node:test';
import assert from 'node:assert/strict';
import { movementPath, movementDuration, hasNewRoll, STEP_DURATION } from '../src/utils/gamePresentation';
import { GameEngine } from '../src/game/GameEngine';
import type { Player } from '../src/types/game';
const player = (position: number, inJail = false): Player => ({ id: 'a', name: 'a', token: '🎩', color: '#fff', position, inJail, money: 1500, jailTurns: 0, getOutOfJailCards: 0, bankrupt: false, isHost: true, isReady: true, connected: true });
test('movement includes every rolled space, including the first step and GO', () => {
  assert.deepEqual(movementPath(38, player(4)), [38, 39, 0, 1, 2, 3, 4]);
  assert.deepEqual(movementPath(5, player(6)), [5, 6]);
});
test('jail transfers and backwards cards do not animate a whole forward lap', () => {
  assert.deepEqual(movementPath(28, player(10, true)), [28, 10]);
  assert.deepEqual(movementPath(1, player(38)), [1, 0, 39, 38]);
  assert.deepEqual(movementPath(6, player(6)), []);
});
test('identical dice on successive turns still trigger new rolls; chats do not', () => {
  const previous = new GameEngine('TEST', [player(0)]).getState();
  const next = structuredClone(previous);
  next.logs.push({ id: 'new-roll', type: 'roll', timestamp: 1, message: 'a rolled 1 and 1 (2) - Doubles!' });
  assert.equal(hasNewRoll(previous, next), true);
  assert.equal(hasNewRoll(next, structuredClone(next)), false);
  const chat = structuredClone(previous);
  chat.logs.push({ id: 'chat', type: 'chat', timestamp: 2, message: 'rolled 1 and 1' });
  assert.equal(hasNewRoll(previous, chat), false);
});
test('cards wait for the full movement duration', () => {
  const previous = new GameEngine('TEST', [player(0)]).getState();
  const next = structuredClone(previous);
  next.players[0].position = 7;
  assert.equal(movementDuration(previous, next), STEP_DURATION * 7);
});
test('rolling automatically moves the player and opens the card on an event tile', () => {
  const engine = new GameEngine('TEST', [player(0), { ...player(0), id: 'b' }]);
  const original = Math.random;
  try {
    Math.random = () => 0;
    assert.equal(engine.rollDice('a').success, true);
  } finally { Math.random = original; }
  assert.equal(engine.getState().players[0].position, 2);
  assert.deepEqual(engine.getState().dice, [1, 1]);
  assert.equal(engine.getState().phase, 'RESOLVING_CARD');
  assert.ok(engine.getState().pendingCard);
});
