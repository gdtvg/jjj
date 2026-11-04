import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { GameEngine } from './src/game/GameEngine.ts';
import { AVAILABLE_TOKENS, PLAYER_COLORS } from './src/data/monopolyBoard.ts';
import { LobbyRoom, Player } from './src/types/game.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = 3000;

interface RoomData {
  lobby: LobbyRoom;
  engine: GameEngine | null;
  botLoopActive?: boolean;
}

const rooms = new Map<string, RoomData>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// Bot turn runner
function checkAndRunBotTurn(roomId: string) {
  const room = rooms.get(roomId);
  if (!room || !room.engine || room.botLoopActive) return;

  const state = room.engine.getState();
  if (state.phase === 'GAME_OVER') return;

  const activePlayer = room.engine.getActivePlayer();
  if (activePlayer && activePlayer.isBot && !activePlayer.bankrupt) {
    room.botLoopActive = true;
    setTimeout(() => {
      if (!room || !room.engine) return;
      const performed = room.engine.botStep();
      room.botLoopActive = false;
      if (performed) {
        io.to(roomId).emit('game:state', room.engine.getState());
        // Check if bot needs next step
        checkAndRunBotTurn(roomId);
      }
    }, 1200);
  }
}

io.on('connection', (socket: Socket) => {
  // 1. Create Room
  socket.on('lobby:create', ({ playerName, token, color }, callback) => {
    try {
      const roomId = generateRoomCode();
      const hostPlayer: Player = {
        id: socket.id,
        name: (playerName || 'Host').trim().substring(0, 16),
        token: token || '🎩',
        color: color || PLAYER_COLORS[0],
        money: 1500,
        position: 0,
        inJail: false,
        jailTurns: 0,
        getOutOfJailCards: 0,
        bankrupt: false,
        isHost: true,
        isReady: true,
        connected: true,
      };

      const lobby: LobbyRoom = {
        roomId,
        hostId: socket.id,
        players: [hostPlayer],
        status: 'WAITING',
        createdAt: Date.now(),
      };

      rooms.set(roomId, {
        lobby,
        engine: null,
      });

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.playerId = socket.id;

      if (typeof callback === 'function') {
        callback({ success: true, roomId, player: hostPlayer, lobby });
      }
      io.to(roomId).emit('lobby:update', lobby);
    } catch (err: any) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 2. Join Room
  socket.on('lobby:join', ({ roomId, playerName, token, color }, callback) => {
    try {
      const targetRoomId = (roomId || '').trim().toUpperCase();
      const room = rooms.get(targetRoomId);

      if (!room) {
        if (typeof callback === 'function') {
          return callback({ success: false, error: `Room ${targetRoomId} not found` });
        }
        return;
      }

      if (room.lobby.status === 'PLAYING') {
        // Check if player is reconnecting
        const existingPlayer = room.lobby.players.find(
          (p) => p.name.toLowerCase() === (playerName || '').toLowerCase()
        );
        if (existingPlayer) {
          existingPlayer.connected = true;
          existingPlayer.id = socket.id;
          socket.join(targetRoomId);
          socket.data.roomId = targetRoomId;
          socket.data.playerId = socket.id;

          if (typeof callback === 'function') {
            callback({
              success: true,
              roomId: targetRoomId,
              player: existingPlayer,
              lobby: room.lobby,
              gameState: room.engine ? room.engine.getState() : null,
            });
          }
          io.to(targetRoomId).emit('lobby:update', room.lobby);
          if (room.engine) {
            io.to(targetRoomId).emit('game:state', room.engine.getState());
          }
          return;
        }

        if (typeof callback === 'function') {
          return callback({ success: false, error: 'Game is already in progress' });
        }
        return;
      }

      if (room.lobby.players.length >= 6) {
        if (typeof callback === 'function') {
          return callback({ success: false, error: 'Room is full (max 6 players)' });
        }
        return;
      }

      // Pick available color & token if collided
      const usedColors = new Set(room.lobby.players.map((p) => p.color));
      const usedTokens = new Set(room.lobby.players.map((p) => p.token));

      const assignedColor =
        color && !usedColors.has(color)
          ? color
          : PLAYER_COLORS.find((c) => !usedColors.has(c)) || PLAYER_COLORS[0];
      const assignedToken =
        token && !usedTokens.has(token)
          ? token
          : AVAILABLE_TOKENS.find((t) => !usedTokens.has(t)) || AVAILABLE_TOKENS[0];

      const newPlayer: Player = {
        id: socket.id,
        name: (playerName || `Player ${room.lobby.players.length + 1}`).trim().substring(0, 16),
        token: assignedToken,
        color: assignedColor,
        money: 1500,
        position: 0,
        inJail: false,
        jailTurns: 0,
        getOutOfJailCards: 0,
        bankrupt: false,
        isHost: false,
        isReady: false,
        connected: true,
      };

      room.lobby.players.push(newPlayer);
      socket.join(targetRoomId);
      socket.data.roomId = targetRoomId;
      socket.data.playerId = socket.id;

      if (typeof callback === 'function') {
        callback({ success: true, roomId: targetRoomId, player: newPlayer, lobby: room.lobby });
      }
      io.to(targetRoomId).emit('lobby:update', room.lobby);
    } catch (err: any) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 3. Update Readiness
  socket.on('lobby:ready', ({ roomId, ready }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.lobby.players.find((p) => p.id === socket.id);
    if (player) {
      player.isReady = Boolean(ready);
      io.to(roomId).emit('lobby:update', room.lobby);
    }
  });

  // 4. Update Profile (Token, Color, Name)
  socket.on('lobby:update_player', ({ roomId, token, color, name }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.lobby.players.find((p) => p.id === socket.id);
    if (player) {
      if (token) player.token = token;
      if (color) player.color = color;
      if (name) player.name = name.trim().substring(0, 16);
      io.to(roomId).emit('lobby:update', room.lobby);
    }
  });

  // 5. Add AI Bot
  socket.on('lobby:add_bot', ({ roomId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.lobby.hostId !== socket.id) {
      if (typeof callback === 'function') callback({ success: false, error: 'Only host can add bots' });
      return;
    }
    if (room.lobby.players.length >= 6) {
      if (typeof callback === 'function') callback({ success: false, error: 'Lobby is full' });
      return;
    }

    const botNames = ['Tycoon Bot', 'Monopoly AI', 'Baron Bot', 'Broker Bot', 'Venture Bot'];
    const usedNames = new Set(room.lobby.players.map((p) => p.name));
    const botName = botNames.find((n) => !usedNames.has(n)) || `Bot ${room.lobby.players.length + 1}`;

    const usedColors = new Set(room.lobby.players.map((p) => p.color));
    const usedTokens = new Set(room.lobby.players.map((p) => p.token));

    const assignedColor = PLAYER_COLORS.find((c) => !usedColors.has(c)) || '#64748b';
    const assignedToken = AVAILABLE_TOKENS.find((t) => !usedTokens.has(t)) || '🤖';

    const botPlayer: Player = {
      id: `bot_${Math.random().toString(36).substring(2, 8)}`,
      name: botName,
      token: assignedToken as any,
      color: assignedColor,
      money: 1500,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      bankrupt: false,
      isHost: false,
      isReady: true,
      isBot: true,
      connected: true,
    };

    room.lobby.players.push(botPlayer);
    if (typeof callback === 'function') callback({ success: true });
    io.to(roomId).emit('lobby:update', room.lobby);
  });

  // 6. Remove Player / Bot
  socket.on('lobby:remove_player', ({ roomId, targetPlayerId }) => {
    const room = rooms.get(roomId);
    if (!room || room.lobby.hostId !== socket.id) return;

    room.lobby.players = room.lobby.players.filter((p) => p.id !== targetPlayerId);
    io.to(roomId).emit('lobby:update', room.lobby);
    io.to(targetPlayerId).emit('lobby:kicked');
  });

  // 7. Start Game
  socket.on('game:start', ({ roomId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }
    if (room.lobby.hostId !== socket.id) {
      if (typeof callback === 'function') callback({ success: false, error: 'Only host can start the game' });
      return;
    }
    if (room.lobby.players.length < 2) {
      if (typeof callback === 'function') callback({ success: false, error: 'Need at least 2 players to start' });
      return;
    }

    room.lobby.status = 'PLAYING';
    room.engine = new GameEngine(roomId, room.lobby.players);

    io.to(roomId).emit('game:started');
    io.to(roomId).emit('game:state', room.engine.getState());

    if (typeof callback === 'function') callback({ success: true });

    // Check if the first player is a bot
    checkAndRunBotTurn(roomId);
  });

  // 8. In-Game Actions
  const handleGameAction = (
    actionName: string,
    roomId: string,
    executor: (engine: GameEngine) => { success: boolean; message?: string } | void,
    callback?: Function
  ) => {
    const room = rooms.get(roomId);
    if (!room || !room.engine) {
      if (typeof callback === 'function') callback({ success: false, error: 'Game not active' });
      return;
    }

    const res = executor(room.engine);
    if (res && !res.success) {
      if (typeof callback === 'function') callback({ success: false, error: res.message });
      return;
    }

    io.to(roomId).emit('game:state', room.engine.getState());
    if (typeof callback === 'function') callback({ success: true });

    // Check if subsequent actions belong to a bot
    checkAndRunBotTurn(roomId);
  };

  socket.on('game:roll', ({ roomId }, callback) => {
    handleGameAction('roll', roomId, (engine) => engine.rollDice(socket.id), callback);
  });

  socket.on('game:buy', ({ roomId, tileId }, callback) => {
    handleGameAction('buy', roomId, (engine) => engine.buyProperty(socket.id, tileId), callback);
  });

  socket.on('game:decline', ({ roomId }, callback) => {
    handleGameAction('decline', roomId, (engine) => engine.declineProperty(socket.id), callback);
  });

  socket.on('game:pay_jail', ({ roomId }, callback) => {
    handleGameAction('pay_jail', roomId, (engine) => engine.payJailFine(socket.id), callback);
  });

  socket.on('game:use_jail_card', ({ roomId }, callback) => {
    handleGameAction('use_jail_card', roomId, (engine) => engine.useJailCard(socket.id), callback);
  });

  socket.on('game:resolve_card', ({ roomId }, callback) => {
    handleGameAction('resolve_card', roomId, (engine) => engine.resolveCard(socket.id), callback);
  });

  socket.on('game:build_house', ({ roomId, tileId }, callback) => {
    handleGameAction('build_house', roomId, (engine) => engine.buildHouse(socket.id, tileId), callback);
  });

  socket.on('game:sell_house', ({ roomId, tileId }, callback) => {
    handleGameAction('sell_house', roomId, (engine) => engine.sellHouse(socket.id, tileId), callback);
  });

  socket.on('game:mortgage', ({ roomId, tileId }, callback) => {
    handleGameAction('mortgage', roomId, (engine) => engine.mortgageProperty(socket.id, tileId), callback);
  });

  socket.on('game:unmortgage', ({ roomId, tileId }, callback) => {
    handleGameAction('unmortgage', roomId, (engine) => engine.unmortgageProperty(socket.id, tileId), callback);
  });

  socket.on('game:trade_propose', ({ roomId, tradeOffer }, callback) => {
    handleGameAction(
      'trade_propose',
      roomId,
      (engine) => engine.proposeTrade({ ...tradeOffer, fromPlayerId: socket.id }),
      callback
    );
  });

  socket.on('game:trade_respond', ({ roomId, tradeId, accept }, callback) => {
    handleGameAction(
      'trade_respond',
      roomId,
      (engine) => engine.respondTrade(tradeId, socket.id, accept),
      callback
    );
  });

  socket.on('game:trade_cancel', ({ roomId }, callback) => {
    handleGameAction('trade_cancel', roomId, (engine) => engine.cancelTrade(socket.id), callback);
  });

  socket.on('game:end_turn', ({ roomId }, callback) => {
    handleGameAction('end_turn', roomId, (engine) => engine.endTurn(socket.id), callback);
  });

  socket.on('game:bankrupt', ({ roomId }, callback) => {
    handleGameAction('bankrupt', roomId, (engine) => engine.declareBankruptcy(socket.id), callback);
  });

  socket.on('game:chat', ({ roomId, message }) => {
    const room = rooms.get(roomId);
    if (!room || !message?.trim()) return;
    const player = room.lobby.players.find((p) => p.id === socket.id);
    const chatText = message.trim().substring(0, 150);

    if (room.engine) {
      room.engine.addLog(chatText, 'chat', player);
      io.to(roomId).emit('game:state', room.engine.getState());
    } else {
      io.to(roomId).emit('lobby:chat', {
        playerName: player?.name || 'Player',
        playerColor: player?.color,
        message: chatText,
        timestamp: Date.now(),
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.lobby.players.find((p) => p.id === socket.id);
    if (player) {
      player.connected = false;
      if (room.engine) {
        room.engine.addLog(`${player.name} disconnected.`, 'system', player);
        io.to(roomId).emit('game:state', room.engine.getState());
      } else {
        // If in lobby and player disconnects, remove them unless host
        room.lobby.players = room.lobby.players.filter((p) => p.id !== socket.id);
        // If host left, pass to next or cleanup
        if (room.lobby.hostId === socket.id) {
          const nextHost = room.lobby.players.find((p) => !p.isBot);
          if (nextHost) {
            nextHost.isHost = true;
            nextHost.isReady = true;
            room.lobby.hostId = nextHost.id;
          } else {
            rooms.delete(roomId);
            return;
          }
        }
        io.to(roomId).emit('lobby:update', room.lobby);
      }
    }
  });
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Monopoly server running on port ${PORT}`);
  });
}

startServer();
