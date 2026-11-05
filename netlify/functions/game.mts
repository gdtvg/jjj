import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { eq, desc, sql } from 'drizzle-orm';
import { database } from '../../db/index.js';
import { rooms, scores } from '../../db/schema.js';
import { GameEngine } from '../../src/game/GameEngine.js';
import { AVAILABLE_TOKENS, PLAYER_COLORS, BOARD_TILES, MAX_PLAYERS, TURN_LIMIT_OPTIONS } from '../../src/data/monopolyBoard.js';
import type { Player, LobbyRoom } from '../../src/types/game.js';

export default async (req: Request) => {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  let session = req.headers.get('cookie')?.match(/(?:^|; )monopoly_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!session) {
    session = randomBytes(32).toString('hex');
    headers.set('Set-Cookie', `monopoly_session=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`);
  }
  const playerId = createHash('sha256').update(session).digest('hex');
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers });
  try {
    if (req.method === 'GET') {
      return respond(await database().select().from(scores).orderBy(desc(scores.wins), desc(scores.totalCashEarned)).limit(10));
    }
    if (req.method !== 'POST') return respond({ success: false, error: 'Method not allowed' }, 405);
    if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return respond({ success: false, error: 'Invalid origin' }, 403);
    if (Number(req.headers.get('content-length')) > 16000) return respond({ success: false, error: 'Request too large' }, 413);
    const { event, data = {} } = await req.json();
    if (event === 'session') return respond({ success: true, playerId });
    const db = database();
    const makePlayer = (lobbyPlayers: Player[], bot = false): Player => ({
      id: bot ? `bot_${randomUUID()}` : playerId,
      name: bot ? `Bot ${lobbyPlayers.filter(p => p.isBot).length + 1}` : String(data.playerName || data.name || 'Tycoon').trim().slice(0, 16) || 'Tycoon',
      token: AVAILABLE_TOKENS.find(t => t === data.token && !lobbyPlayers.some(p => p.token === t)) || AVAILABLE_TOKENS.find(t => !lobbyPlayers.some(p => p.token === t))!,
      color: PLAYER_COLORS.find(c => c === data.color && !lobbyPlayers.some(p => p.color === c)) || PLAYER_COLORS.find(c => !lobbyPlayers.some(p => p.color === c))!,
      money: 1500, position: 0, inJail: false, jailTurns: 0, getOutOfJailCards: 0, bankrupt: false,
      isHost: !lobbyPlayers.length, isReady: bot || !lobbyPlayers.length, isBot: bot, connected: true,
    });
    if (event === 'lobby:create') {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let roomId = '';
      for (const byte of randomBytes(4)) roomId += alphabet[byte % alphabet.length];
      const player = makePlayer([]);
      const lobby: LobbyRoom = { roomId, hostId: playerId, players: [player], status: 'WAITING', createdAt: Date.now(), settings: { maxPlayers: MAX_PLAYERS, turnSeconds: 25 } };
      await db.insert(rooms).values({ id: roomId, lobby });
      return respond({ success: true, roomId, player, lobby });
    }
    const roomId = String(data.roomId || '').trim().toUpperCase();
    const result = await db.transaction(async tx => {
      const [row] = await tx.select().from(rooms).where(eq(rooms.id, roomId)).for('update');
      if (!row) throw new Error('Room not found');
      const lobby = row.lobby;
      lobby.settings = { maxPlayers: MAX_PLAYERS, turnSeconds: 25, ...lobby.settings };
      const capacity = Math.min(MAX_PLAYERS, Math.max(2, lobby.settings.maxPlayers));
      let engine = row.engine ? GameEngine.restore(row.engine) : null;
      let me = lobby.players.find(p => p.id === playerId);
      let changed = event !== 'room:poll';
      const requireHost = () => { if (lobby.hostId !== playerId) throw new Error('Only the host can do this'); };
      const requireLobby = () => { if (engine) throw new Error('Game already started'); };
      if (event === 'lobby:join') {
        if (!me) {
          requireLobby();
          if (lobby.players.length >= capacity) throw new Error('Room is full');
          me = makePlayer(lobby.players);
          lobby.players.push(me);
        }
      } else if (!me) throw new Error('You are no longer in this room');
      if (event === 'lobby:ready') { requireLobby(); me!.isReady = Boolean(data.ready); }
      else if (event === 'lobby:update_player') {
        requireLobby();
        const profile = makePlayer(lobby.players.filter(p => p.id !== playerId));
        Object.assign(me!, { name: profile.name, color: profile.color, token: profile.token });
      } else if (event === 'lobby:add_bot') {
        requireHost(); requireLobby();
        if (lobby.players.length >= capacity) throw new Error('Room is full');
        lobby.players.push(makePlayer(lobby.players, true));
      } else if (event === 'lobby:settings') {
        requireHost(); requireLobby();
        const maxPlayers = Math.round(Number(data.maxPlayers));
        const turnSeconds = Number(data.turnSeconds);
        if (!Number.isFinite(maxPlayers) || maxPlayers < Math.max(2, lobby.players.length) || maxPlayers > MAX_PLAYERS) throw new Error('Invalid player limit');
        if (!(TURN_LIMIT_OPTIONS as readonly number[]).includes(turnSeconds)) throw new Error('Invalid turn limit');
        lobby.settings = { maxPlayers, turnSeconds };
      } else if (event === 'lobby:remove_player') {
        requireHost(); requireLobby();
        if (data.targetPlayerId === playerId) throw new Error('Use leave to exit the room');
        lobby.players = lobby.players.filter(p => p.id !== data.targetPlayerId);
      } else if (event === 'lobby:leave') {
        if (engine && !engine.getState().players.find(p => p.id === playerId)?.bankrupt && engine.getState().phase !== 'GAME_OVER') engine.declareBankruptcy(playerId);
        lobby.players = lobby.players.filter(p => p.id !== playerId);
        if (lobby.hostId === playerId) {
          const host = lobby.players.find(p => !p.isBot);
          if (host) { host.isHost = true; host.isReady = true; lobby.hostId = host.id; }
        }
      } else if (event === 'game:start') {
        requireHost(); requireLobby();
        if (lobby.players.length < 2 || lobby.players.some(p => !p.isReady)) throw new Error('At least two players must be ready');
        engine = new GameEngine(roomId, lobby.players, { turnSeconds: lobby.settings.turnSeconds });
        lobby.status = 'PLAYING';
      } else if (event.startsWith('game:')) {
        if (!engine || engine.getState().phase === 'GAME_OVER') throw new Error('Game is not active');
        const player = engine.getState().players.find(p => p.id === playerId);
        if (!player || player.bankrupt) throw new Error('Player is eliminated');
        const actions: Record<string, () => { success: boolean; message?: string } | void> = {
          'game:roll': () => engine!.rollDice(playerId),
          'game:buy': () => engine!.buyProperty(playerId, data.tileId),
          'game:decline': () => engine!.declineProperty(playerId),
          'game:pay_jail': () => engine!.payJailFine(playerId),
          'game:use_jail_card': () => engine!.useJailCard(playerId),
          'game:resolve_card': () => engine!.resolveCard(playerId),
          'game:build_house': () => engine!.buildHouse(playerId, data.tileId),
          'game:sell_house': () => engine!.sellHouse(playerId, data.tileId),
          'game:mortgage': () => engine!.mortgageProperty(playerId, data.tileId),
          'game:unmortgage': () => engine!.unmortgageProperty(playerId, data.tileId),
          'game:end_turn': () => engine!.endTurn(playerId),
          'game:bankrupt': () => engine!.declareBankruptcy(playerId),
          'game:trade_propose': () => engine!.proposeTrade({ ...data.tradeOffer, fromPlayerId: playerId }),
          'game:trade_respond': () => engine!.respondTrade(data.tradeId, playerId, Boolean(data.accept)),
          'game:trade_cancel': () => engine!.cancelTrade(playerId, data.tradeId),
          'game:chat': () => { const message = String(data.message || '').trim().slice(0, 150); if (message) engine!.addLog(message, 'chat', player); },
        };
        if (!actions[event]) throw new Error('Unknown action');
        const logCountBeforeAction = engine.getState().logs.length;
        const action = actions[event]();
        if (action && !action.success) {
          // A failed acceptance can intentionally cancel an invalid offer. Commit
          // that terminal event so both traders see it rather than rolling it back.
          const terminal = engine.getState().logs.at(-1);
          const cancelled = engine.getState().logs.length > logCountBeforeAction && event === 'game:trade_respond' && terminal?.tradeId === data.tradeId && terminal?.tradeStatus === 'CANCELLED';
          if (!cancelled) throw new Error(action.message || 'Action is unavailable');
        }
      } else if (!['room:poll', 'lobby:join', 'lobby:ready'].includes(event)) throw new Error('Unknown action');
      // One step per poll keeps bots progressing without a background server or timers.
      if (engine && engine.getState().phase !== 'GAME_OVER') {
        if (engine.timeoutStep()) changed = true;
        if (engine.botStep()) changed = true;
        if (engine.syncTurnClock()) changed = true;
        for (const trade of engine.pendingTrades()) {
          if (engine.getState().players.find(p => p.id === trade.toPlayerId)?.isBot) {
            engine.respondTrade(trade.id, trade.toPlayerId, false);
            changed = true;
          }
        }
      }
      if (changed) {
        if (engine?.getState().phase === 'GAME_OVER' && row.engine?.state.phase !== 'GAME_OVER') {
          const state = engine.getState();
          for (const p of state.players.filter(p => !p.isBot)) {
            const won = p.id === state.winnerId;
            const worth = p.money + Object.values(state.properties).filter(prop => prop.ownerId === p.id).reduce((sum, prop) => sum + (BOARD_TILES[prop.tileId]?.price || 0) + prop.houses * (BOARD_TILES[prop.tileId]?.houseCost || 0), 0);
            await tx.insert(scores).values({ id: p.id, username: p.name, wins: won ? 1 : 0, gamesPlayed: 1, totalCashEarned: won ? Math.max(0, worth) : 0 }).onConflictDoUpdate({ target: scores.id, set: {
              username: p.name, wins: sql`${scores.wins} + ${won ? 1 : 0}`, gamesPlayed: sql`${scores.gamesPlayed} + 1`, totalCashEarned: sql`${scores.totalCashEarned} + ${won ? Math.max(0, worth) : 0}`, updatedAt: new Date(),
            } });
          }
        }
        await tx.update(rooms).set({ lobby, engine: engine?.snapshot() || null, revision: row.revision + 1, updatedAt: new Date() }).where(eq(rooms.id, roomId));
      }
      return { success: true, roomId, lobby, player: me, gameState: engine?.getState() || null, revision: row.revision + (changed ? 1 : 0) };
    });
    return respond(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    // Database errors can contain connection details; only expose known game errors.
    const safe = /^(Room |Only the host|Game |You are |Use leave|At least |Player |Unknown action|Invalid |Insufficient |Properties |Trade |Not |Cannot |Must |You |No |It's |Action )/.test(message);
    return respond({ success: false, error: safe ? message : 'The request failed. Please try again.' }, 400);
  }
};
