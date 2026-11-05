import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/game/GameEngine';
import type { Player } from '../src/types/game';
const player = (id: string, bot = false): Player => ({ id, name: id, token: '🎩', color: '#fff', money: 1500, position: 0, inJail: false, jailTurns: 0, getOutOfJailCards: 0, bankrupt: false, isHost: id === 'a', isReady: true, connected: true, isBot: bot });
const game = () => new GameEngine('TEST', [player('a'), player('b')]);
test('saving and restoring preserves ownership, players, turn and card decks', () => {
  const engine = game();
  engine.getState().properties[1].ownerId = 'a';
  engine.rollDice('a');
  const snapshot = JSON.parse(JSON.stringify(engine.snapshot()));
  const restored = GameEngine.restore(snapshot);
  assert.deepEqual(restored.snapshot(), snapshot);
  assert.equal(restored.rollDice('b').success, false);
});
test('a player cannot skip rolling or leave unresolved debt behind', () => {
  const engine = game();
  assert.equal(engine.endTurn('a').success, false);
  assert.equal(engine.declineProperty('a').success, false);
  engine.getState().phase = 'END_TURN';
  engine.getState().players[0].money = -50;
  assert.equal(engine.endTurn('a').success, false);
});
test('negative trades and changed ownership cannot transfer cash or assets', () => {
  const engine = game();
  const offer = { fromPlayerId: 'a', toPlayerId: 'b', offeredMoney: -100, requestedMoney: 0, offeredProperties: [1], requestedProperties: [] };
  engine.getState().properties[1].ownerId = 'a';
  assert.equal(engine.proposeTrade(offer).success, false);
  assert.equal(engine.proposeTrade({ ...offer, offeredMoney: 10 }).success, true);
  const trade = engine.getState().activeTrade!;
  engine.getState().properties[1].ownerId = null;
  assert.equal(engine.respondTrade(trade.id, 'b', true).success, false);
  assert.equal(engine.getState().players[0].money, 1500);
});
test('insolvent bots mortgage property and then go bankrupt instead of looping', () => {
  const engine = new GameEngine('TEST', [player('a', true), player('b')]);
  engine.getState().players[0].money = -1000;
  engine.getState().properties[1].ownerId = 'a';
  engine.getState().phase = 'END_TURN';
  assert.equal(engine.botStep(), true);
  assert.equal(engine.getState().properties[1].mortgaged, true);
  assert.equal(engine.botStep(), true);
  assert.equal(engine.getState().phase, 'GAME_OVER');
  assert.equal(engine.getState().winnerId, 'b');
});
test('bankruptcy clears the eliminated player’s doubles and pending card', () => {
  const engine = new GameEngine('TEST', [player('a'), player('b'), player('c')]);
  engine.getState().doublesCount = 2;
  engine.getState().hasRolled = true;
  engine.declareBankruptcy('a');
  assert.equal(engine.getActivePlayer()?.id, 'b');
  assert.equal(engine.getState().doublesCount, 0);
  assert.equal(engine.getState().hasRolled, false);
});
test('bots can complete repeated turns across restored server requests', (context) => {
  let seed = 42;
  context.mock.method(Math, 'random', () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; });
  let sawPurchase = false;
  let engine = new GameEngine('TEST', [player('a', true), player('b', true)]);
  for (let i = 0; i < 300 && engine.getState().phase !== 'GAME_OVER'; i++) {
    assert.equal(engine.botStep(), true);
    sawPurchase ||= engine.getState().logs.some(entry => entry.type === 'purchase');
    engine = GameEngine.restore(JSON.parse(JSON.stringify(engine.snapshot())));
  }
  assert.ok(sawPurchase);
});
