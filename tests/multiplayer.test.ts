import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/game/GameEngine';
import { playerReferences, mentionQuery } from '../src/utils/playerReferences';
import type { Player } from '../src/types/game';
const player = (id: string, name: string): Player => ({ id, name, token: '🎩', color: '#ccb584', money: 1500, position: 0, inJail: false, jailTurns: 0, getOutOfJailCards: 0, bankrupt: false, isHost: id === 'a', isReady: true, connected: true });
const players = [player('a', 'Ann'), player('b', 'Anna'), player('c', 'Jörg + Co')];
const offer = (from = 'a', to = 'b') => ({ fromPlayerId: from, toPlayerId: to, offeredMoney: 42, offeredProperties: [1], requestedMoney: 10, requestedProperties: [3] });

test('mentions match literal complete names, Unicode and spaces without email or prefix matches', () => {
  const message = 'Anna, @Ann, @Anna! mail@Ann.example @Jörg + Co — Annabelle';
  const refs = playerReferences(message, players, true);
  assert.deepEqual(refs.map(ref => ref.playerId), ['a', 'b', 'c']);
  assert.deepEqual(refs.map(ref => message.slice(ref.start, ref.end)), ['@Ann', '@Anna', '@Jörg + Co']);
  assert.deepEqual(playerReferences('Ann paid $42 to Anna', players).map(ref => ref.playerId), ['a', 'b']);
  assert.equal(playerReferences('@Annabelle @Anna2 @@Ann', players, true).length, 0);
});

test('mention query tracks the caret and supports replacement in the middle of a message', () => {
  assert.deepEqual(mentionQuery('Hallo @An später', 9), { start: 6, end: 9, query: 'An' });
  assert.equal(mentionQuery('mail@Anna', 9), null);
  assert.deepEqual(mentionQuery('@', 1), { start: 0, end: 1, query: '' });
});

test('persisted chat records retain all messages and identify every mentioned player once', () => {
  const engine = new GameEngine('TEST', players);
  for (let i = 0; i < 160; i++) engine.addLog(`Message ${i}`, 'chat', players[0]);
  engine.addLog('@Anna @Jörg + Co @Anna', 'chat', players[0]);
  const restored = GameEngine.restore(JSON.parse(JSON.stringify(engine.snapshot())));
  assert.ok(restored.getState().logs.some(log => log.message === 'Message 0'));
  const last = restored.getState().logs.at(-1)!;
  assert.equal(last.playerId, 'a');
  assert.deepEqual(last.mentionIds, ['b', 'c']);
  assert.equal(new Set(restored.getState().logs.map(log => log.id)).size, restored.getState().logs.length);
});

test('multiple saved offers remain independent and acceptance cannot run twice', () => {
  const engine = new GameEngine('TEST', players);
  engine.getState().properties[1].ownerId = 'a';
  engine.getState().properties[3].ownerId = 'b';
  assert.equal(engine.proposeTrade(offer()).success, true);
  assert.equal(engine.proposeTrade(offer()).success, false);
  assert.equal(engine.proposeTrade({ ...offer('c', 'b'), offeredProperties: [], requestedProperties: [] }).success, true);
  const restored = GameEngine.restore(JSON.parse(JSON.stringify(engine.snapshot())));
  assert.equal(restored.pendingTrades().length, 2);
  const [first, second] = restored.pendingTrades();
  assert.equal(restored.respondTrade(first.id, 'c', true).success, false);
  assert.equal(restored.respondTrade(first.id, 'b', true).success, true);
  assert.equal(restored.getState().players[0].money, 1468);
  assert.equal(restored.getState().players[1].money, 1532);
  assert.equal(restored.getState().properties[1].ownerId, 'b');
  assert.equal(restored.getState().properties[3].ownerId, 'a');
  assert.equal(restored.respondTrade(first.id, 'b', true).success, false);
  assert.equal(restored.respondTrade(first.id, 'b', false).success, false);
  assert.equal(restored.getState().players[1].money, 1532);
  assert.equal(restored.pendingTrades().length, 1);
  assert.equal(restored.respondTrade(second.id, 'b', false).success, true);
  assert.equal(restored.pendingTrades().length, 0);
  assert.equal(restored.getState().logs.filter(log => log.tradeId === second.id && log.tradeStatus === 'REJECTED').length, 1);
});

test('changed assets cancel only the affected offer and notify both participants', () => {
  const engine = new GameEngine('TEST', players);
  engine.getState().properties[1].ownerId = 'a'; engine.getState().properties[3].ownerId = 'b';
  engine.proposeTrade(offer());
  const id = engine.pendingTrades()[0].id;
  engine.getState().properties[1].houses = 1;
  assert.equal(engine.respondTrade(id, 'b', true).success, false);
  assert.equal(engine.pendingTrades().length, 0);
  assert.equal(engine.getState().players[0].money, 1500);
  const terminal = engine.getState().logs.at(-1)!;
  assert.equal(terminal.tradeStatus, 'CANCELLED');
  assert.deepEqual(terminal.participantIds, ['a', 'b']);
});

test('old activeTrade snapshots upgrade without losing the pending request', () => {
  const engine = new GameEngine('TEST', players);
  engine.getState().properties[1].ownerId = 'a'; engine.getState().properties[3].ownerId = 'b';
  engine.proposeTrade(offer());
  delete engine.getState().pendingTrades;
  const restored = GameEngine.restore(JSON.parse(JSON.stringify(engine.snapshot())));
  const id = restored.pendingTrades()[0].id;
  assert.equal(restored.respondTrade(id, 'b', false).success, true);
  assert.equal(restored.getState().activeTrade, null);
  assert.deepEqual(restored.pendingTrades(), []);
});
