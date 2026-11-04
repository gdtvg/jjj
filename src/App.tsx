import React, { useState, useEffect } from 'react';
import { GameClient } from './lib/gameClient';
import confetti from 'canvas-confetti';
import { Board } from './components/Board';
import { ThreeBoardScene } from './components/ThreeBoardScene';
import { ASSETS } from './assets/assetMap';
import { Lobby } from './components/Lobby';
import { PlayerScoreboard, ActionBar } from './components/PlayerHUD';
import { PropertyModal } from './components/PropertyModal';
import { TradeModal } from './components/TradeModal';
import { CardModal } from './components/CardModal';
import { GameLog } from './components/GameLog';
import { AVAILABLE_TOKENS, PLAYER_COLORS, BOARD_TILES } from './data/monopolyBoard';
import { BoardTile, GameState, LobbyRoom, Player, PlayerToken } from './types/game';
import { playSound, toggleSound, isSoundMuted } from './utils/sound';
import { LeaderboardModal } from './components/LeaderboardModal';

export default function App() {
  const [socket, setSocket] = useState<GameClient | null>(null);
  const [view, setView] = useState<'MENU' | 'LOBBY' | 'GAME'>('MENU');

  // Player identity setup in Menu
  const [playerName, setPlayerName] = useState<string>('Tycoon');
  const [playerToken, setPlayerToken] = useState<PlayerToken>('🎩');
  const [playerColor, setPlayerColor] = useState<string>(PLAYER_COLORS[0]);
  const [joinRoomCode, setJoinRoomCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [soundMuted, setSoundMutedState] = useState(isSoundMuted());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRollingDice, setIsRollingDice] = useState(false);
  const [boardMode, setBoardMode] = useState<'3D' | '2D'>('3D');
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  // Active room data
  const [lobbyData, setLobbyData] = useState<LobbyRoom | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  // Modals
  const [inspectedTile, setInspectedTile] = useState<BoardTile | null>(null);
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);

  // Connect to the game API
  useEffect(() => {
    const s = new GameClient();
    let gameStarted = false;
    let victoryShown = false;
    s.on('error', (message: string) => { setErrorMessage(message); setIsRollingDice(false); });
    s.on('lobby:joined', () => setView('LOBBY'));

    s.on('lobby:update', (updatedLobby: LobbyRoom) => {
      setLobbyData(updatedLobby);
      const me = updatedLobby.players.find((p) => p.id === s.id);
      if (me) setCurrentPlayer(me);
    });

    s.on('game:started', () => {
      setView('GAME');
      if (!gameStarted) playSound('money');
      gameStarted = true;
    });

    s.on('game:state', (state: GameState) => {
      setGameState(state);
      setIsRollingDice(false);
      const me = state.players.find(p => p.id === s.id);
      if (me) setCurrentPlayer(me);
      if (state.phase !== 'GAME_OVER') victoryShown = false;
      if (state.phase === 'GAME_OVER' && !victoryShown) {
        victoryShown = true;
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
        });
        playSound('victory');
      }
    });

    s.on('lobby:kicked', () => {
      setView('MENU');
      setLobbyData(null);
      setCurrentPlayer(null);
      setGameState(null);
      setErrorMessage('You were removed from the lobby');
    });

    setSocket(s);

    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);

    return () => {
      s.disconnect();
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4000);
  };

  const handleToggleFullscreen = () => {
    playSound('click');
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleToggleSound = () => {
    const muted = toggleSound();
    setSoundMutedState(muted);
    if (!muted) playSound('click');
  };

  // 1. Create Room
  const handleCreateRoom = () => {
    if (!socket) return;
    playSound('click');
    socket.emit(
      'lobby:create',
      {
        playerName: playerName.trim() || 'Host',
        token: playerToken,
        color: playerColor,
      },
      (res: any) => {
        if (res.success) {
          setLobbyData(res.lobby);
          setCurrentPlayer(res.player);
          setView('LOBBY');
        } else {
          triggerError(res.error || 'Failed to create room');
        }
      }
    );
  };

  // 2. Join Room
  const handleJoinRoom = () => {
    if (!socket) return;
    if (!joinRoomCode.trim()) {
      triggerError('Please enter a 4-letter Room Code');
      return;
    }
    playSound('click');
    socket.emit(
      'lobby:join',
      {
        roomId: joinRoomCode.trim().toUpperCase(),
        playerName: playerName.trim() || 'Player',
        token: playerToken,
        color: playerColor,
      },
      (res: any) => {
        if (res.success) {
          setLobbyData(res.lobby);
          setCurrentPlayer(res.player);
          if (res.gameState) {
            setGameState(res.gameState);
            setView('GAME');
          } else {
            setView('LOBBY');
          }
        } else {
          triggerError(res.error || 'Failed to join room');
        }
      }
    );
  };

  // 3. Quick Play (Create room + 3 bots + start)
  const handleQuickPlay = () => {
    if (!socket) return;
    playSound('click');
    socket.emit(
      'lobby:create',
      {
        playerName: playerName.trim() || 'Tycoon',
        token: playerToken,
        color: playerColor,
      },
      (res: any) => {
        if (res.success) {
          const roomId = res.roomId;
          setLobbyData(res.lobby);
          setCurrentPlayer(res.player);

          // Add 3 bots sequentially then start
          socket.emit('lobby:add_bot', { roomId }, (result: any) => {
            if (!result.success) return;
            socket.emit('lobby:add_bot', { roomId }, (result: any) => {
              if (!result.success) return;
              socket.emit('lobby:add_bot', { roomId }, (result: any) => {
              if (!result.success) return;
                socket.emit('game:start', { roomId });
              });
            });
          });
        } else {
          triggerError(res.error || 'Could not start quick match');
        }
      }
    );
  };

  // Lobby operations
  const handleReadyToggle = (ready: boolean) => {
    if (!socket || !lobbyData) return;
    socket.emit('lobby:ready', { roomId: lobbyData.roomId, ready });
  };

  const handleUpdateProfile = (token: PlayerToken, color: string, name: string) => {
    if (!socket || !lobbyData) return;
    socket.emit('lobby:update_player', { roomId: lobbyData.roomId, token, color, name });
  };

  const handleAddBot = () => {
    if (!socket || !lobbyData) return;
    socket.emit('lobby:add_bot', { roomId: lobbyData.roomId });
  };

  const handleRemovePlayer = (targetPlayerId: string) => {
    if (!socket || !lobbyData) return;
    socket.emit('lobby:remove_player', { roomId: lobbyData.roomId, targetPlayerId });
  };

  const handleStartGame = () => {
    if (!socket || !lobbyData) return;
    socket.emit('game:start', { roomId: lobbyData.roomId }, (res: any) => {
      if (res && !res.success) {
        triggerError(res.error || 'Failed to start game');
      }
    });
  };

  const handleLeaveLobby = () => {
    if (lobbyData) socket?.emit('lobby:leave', { roomId: lobbyData.roomId });
    setView('MENU');
    setLobbyData(null);
    setCurrentPlayer(null);
    setGameState(null);
  };

  // In-Game Socket Operations
  const handleRollDice = () => {
    if (!socket || !gameState) return;
    setIsRollingDice(true);
    socket.emit('game:roll', { roomId: gameState.roomId });
  };

  const handleBuyProperty = (tileId: number) => {
    if (!socket || !gameState) return;
    socket.emit('game:buy', { roomId: gameState.roomId, tileId });
  };

  const handleDeclineProperty = () => {
    if (!socket || !gameState) return;
    socket.emit('game:decline', { roomId: gameState.roomId });
  };

  const handlePayJailFine = () => {
    if (!socket || !gameState) return;
    socket.emit('game:pay_jail', { roomId: gameState.roomId });
  };

  const handleUseJailCard = () => {
    if (!socket || !gameState) return;
    socket.emit('game:use_jail_card', { roomId: gameState.roomId });
  };

  const handleResolveCard = () => {
    if (!socket || !gameState) return;
    socket.emit('game:resolve_card', { roomId: gameState.roomId });
  };

  const handleBuildHouse = (tileId: number) => {
    if (!socket || !gameState) return;
    socket.emit('game:build_house', { roomId: gameState.roomId, tileId });
  };

  const handleSellHouse = (tileId: number) => {
    if (!socket || !gameState) return;
    socket.emit('game:sell_house', { roomId: gameState.roomId, tileId });
  };

  const handleMortgage = (tileId: number) => {
    if (!socket || !gameState) return;
    socket.emit('game:mortgage', { roomId: gameState.roomId, tileId });
  };

  const handleUnmortgage = (tileId: number) => {
    if (!socket || !gameState) return;
    socket.emit('game:unmortgage', { roomId: gameState.roomId, tileId });
  };

  const handleProposeTrade = (tradeOffer: any) => {
    if (!socket || !gameState) return;
    socket.emit('game:trade_propose', { roomId: gameState.roomId, tradeOffer });
    setIsTradeModalOpen(false);
  };

  const handleRespondTrade = (tradeId: string, accept: boolean) => {
    if (!socket || !gameState) return;
    socket.emit('game:trade_respond', { roomId: gameState.roomId, tradeId, accept });
    setIsTradeModalOpen(false);
  };

  const handleCancelTrade = () => {
    if (!socket || !gameState) return;
    socket.emit('game:trade_cancel', { roomId: gameState.roomId });
    setIsTradeModalOpen(false);
  };

  const handleEndTurn = () => {
    if (!socket || !gameState) return;
    socket.emit('game:end_turn', { roomId: gameState.roomId });
  };

  const handleDeclareBankruptcy = () => {
    if (!socket || !gameState) return;
    if (confirm('Are you sure you want to declare bankruptcy? You will be eliminated.')) {
      socket.emit('game:bankrupt', { roomId: gameState.roomId });
    }
  };

  const handleSendMessage = (message: string) => {
    if (!socket || !gameState) return;
    socket.emit('game:chat', { roomId: gameState.roomId, message });
  };

  const canRollNow = Boolean(
    gameState?.phase === 'ROLL' &&
      currentPlayer &&
      gameState.players[gameState.activePlayerIndex]?.id === currentPlayer.id
  );

  return (
    <div
      className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans select-none selection:bg-amber-500 selection:text-slate-950 relative"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(6, 9, 18, 0.88), rgba(6, 9, 18, 0.95)), url(${ASSETS.penthouseBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Toast Error Alert */}
      {errorMessage && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-2.5 rounded-xl shadow-2xl font-bold text-xs flex items-center gap-2 animate-bounce">
          <span>⚠️</span> {errorMessage}
        </div>
      )}

      {/* Screen 1: MAIN MENU (Maximized Visual Presentation) */}
      {view === 'MENU' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
            {/* Top Luxury Gold Medallion */}
            <div className="flex justify-center mb-3">
              <img
                src={ASSETS.luxuryCrest}
                alt="Monopoly Gold Emblem"
                className="w-28 h-28 object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)] transform hover:scale-105 transition-transform duration-300"
              />
            </div>

            {/* Top Badge */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3.5 py-1 rounded-full text-xs font-black tracking-widest uppercase mb-2">
                <span>👑</span> High-Stakes 3D Realtime Arena
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-md">
                MONOPOLY
              </h1>
              <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                Authoritative online board game with 3D models, real-time lobbies, and trading
              </p>
            </div>

            {/* Profile Setup */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Your Nickname
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-hidden focus:border-amber-400 font-semibold"
                  placeholder="Enter name"
                />
              </div>

              {/* Token selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Choose Token
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {AVAILABLE_TOKENS.map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => {
                        playSound('click');
                        setPlayerToken(token as PlayerToken);
                      }}
                      className={`cursor-pointer p-2.5 rounded-xl text-xl flex items-center justify-center transition-all ${
                        playerToken === token
                          ? 'bg-amber-500/20 border-2 border-amber-400 scale-110 shadow-lg shadow-amber-500/20'
                          : 'bg-slate-950 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Player Color
                </label>
                <div className="flex gap-2.5 justify-center">
                  {PLAYER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        playSound('click');
                        setPlayerColor(c);
                      }}
                      style={{ backgroundColor: c }}
                      className={`cursor-pointer w-8 h-8 rounded-full transition-transform ${
                        playerColor === c
                          ? 'ring-4 ring-white/60 scale-110'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {/* Host button */}
              <button
                onClick={handleCreateRoom}
                className="cursor-pointer w-full py-3 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>👑</span> Create Game Room
              </button>

              {/* Join form */}
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={4}
                  value={joinRoomCode}
                  onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  className="flex-1 bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-center font-mono font-black tracking-widest text-sm uppercase focus:outline-hidden focus:border-amber-400"
                />
                <button
                  onClick={handleJoinRoom}
                  className="cursor-pointer px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors border border-slate-700 active:scale-95"
                >
                  Join
                </button>
              </div>

              {/* Quick Play Against AI Bots */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <button
                  onClick={handleQuickPlay}
                  className="cursor-pointer w-full py-2.5 bg-slate-800/60 hover:bg-slate-800 text-amber-300 hover:text-amber-200 font-bold rounded-xl text-xs border border-amber-500/30 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <span>⚡</span> Instant Match vs 3 AI Bots
                </button>

                <button
                  onClick={() => {
                    playSound('click');
                    setIsLeaderboardOpen(true);
                  }}
                  className="cursor-pointer w-full py-2 bg-slate-900/80 hover:bg-slate-850 text-slate-300 hover:text-white font-bold rounded-xl text-xs border border-slate-700/60 transition-all flex items-center justify-center gap-2"
                >
                  <span>🏆</span> Cloud Leaderboard & High Scores
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screen 2: LOBBY */}
      {view === 'LOBBY' && lobbyData && currentPlayer && (
        <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
          <Lobby
            lobby={lobbyData}
            currentPlayer={currentPlayer}
            onReadyToggle={handleReadyToggle}
            onUpdateProfile={handleUpdateProfile}
            onAddBot={handleAddBot}
            onRemovePlayer={handleRemovePlayer}
            onStartGame={handleStartGame}
            onLeaveLobby={handleLeaveLobby}
          />
        </div>
      )}

      {/* Screen 3: IN GAME (Maximized Full-Viewport Grid) */}
      {view === 'GAME' && gameState && currentPlayer && (
        <div className="h-full w-full flex flex-col overflow-hidden">
          {/* Top Sleek Header Bar */}
          <header className="min-h-12 py-1 bg-slate-900/95 border-b border-slate-800 px-4 pl-16 sm:pl-4 md:px-6 flex items-center justify-between shrink-0 shadow-md backdrop-blur-md">
            {/* Left: Brand & Room Tag */}
            <div className="flex items-center gap-3">
              <span className="text-xl">🎩</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-tight text-white">MONOPOLY</span>
                <span className="text-slate-600">·</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(gameState.roomId);
                    setCopiedLink(true);
                    playSound('click');
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="cursor-pointer text-[11px] font-mono font-bold bg-slate-950 border border-slate-700 px-2 py-0.5 rounded text-amber-400 hover:bg-slate-800 transition-colors flex items-center gap-1"
                  title="Click to copy room code"
                >
                  <span>Room:</span>
                  <b>#{gameState.roomId}</b>
                  <span className="text-[9px] text-slate-400">{copiedLink ? '✓' : '📋'}</span>
                </button>
              </div>
            </div>

            {/* Center: Quick Turn Ticker */}
            <div className="hidden md:flex items-center gap-2 text-xs">
              <span className="text-slate-400">Current Turn:</span>
              <span
                className="font-black flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-800"
                style={{ color: gameState.players[gameState.activePlayerIndex]?.color }}
              >
                <span>{gameState.players[gameState.activePlayerIndex]?.token}</span>
                <span>{gameState.players[gameState.activePlayerIndex]?.name}</span>
              </span>
            </div>

            {/* Right: Quick Controls & Cash Indicator */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  playSound('click');
                  setIsLeaderboardOpen(true);
                }}
                className="cursor-pointer text-xs bg-slate-950 hover:bg-slate-800 border border-amber-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 text-amber-300 font-bold transition-colors"
                title="View Cloud Leaderboard"
              >
                <span>🏆</span>
                <span className="hidden lg:inline">Leaderboard</span>
              </button>

              <div className="text-xs bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg flex items-center gap-1.5">
                <span className="text-slate-400">Your Cash:</span>
                <span className="font-mono font-black text-emerald-400">
                  ${currentPlayer.money}
                </span>
              </div>

              {/* 3D / 2D View Mode Toggle */}
              <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-700 text-xs shadow-inner">
                <button
                  onClick={() => {
                    playSound('click');
                    setBoardMode('3D');
                  }}
                  className={`cursor-pointer px-2.5 py-1 rounded-md font-black transition-all ${
                    boardMode === '3D'
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  3D Arena
                </button>
                <button
                  onClick={() => {
                    playSound('click');
                    setBoardMode('2D');
                  }}
                  className={`cursor-pointer px-2.5 py-1 rounded-md font-black transition-all ${
                    boardMode === '2D'
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  2D Board
                </button>
              </div>

              {/* Sound Toggle */}
              <button
                onClick={handleToggleSound}
                className="cursor-pointer p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-xs"
                title={soundMuted ? 'Unmute Sound' : 'Mute Sound'}
              >
                {soundMuted ? '🔇' : '🔊'}
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={handleToggleFullscreen}
                className="cursor-pointer p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-xs"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? '⤦' : '⛶'}
              </button>

              {/* Leave Game */}
              <button
                onClick={() => {
                  if (confirm('Leave current game?')) {
                    handleLeaveLobby();
                  }
                }}
                className="cursor-pointer text-xs font-bold text-slate-400 hover:text-rose-400 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
              >
                Quit
              </button>
            </div>
          </header>

          {/* Main Maximized Game View (Board Left, Sidebar Right) */}
          <main className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 p-2 sm:p-3 overflow-hidden">
            {/* Center / Board Stage */}
            <section className="flex-1 min-h-0 flex flex-col items-center justify-between gap-2 overflow-hidden">
              {/* Maximized Board Container (3D or 2D) */}
              <div className="flex-1 min-h-0 w-full flex items-center justify-center">
                {boardMode === '3D' ? (
                  <ThreeBoardScene
                    gameState={gameState}
                    canRoll={canRollNow}
                    isRolling={isRollingDice}
                    onRollClick={handleRollDice}
                    onTileClick={(tile) => {
                      setInspectedTile(tile);
                      setIsPropertyModalOpen(true);
                    }}
                  />
                ) : (
                  <Board
                    gameState={gameState}
                    canRoll={canRollNow}
                    isRolling={isRollingDice}
                    onRollClick={handleRollDice}
                    onTileClick={(tile) => {
                      setInspectedTile(tile);
                      setIsPropertyModalOpen(true);
                    }}
                  />
                )}
              </div>

              {/* Tactical Action Bar */}
              <div className="w-full max-w-[calc(100vh-130px)] shrink-0">
                <ActionBar
                  gameState={gameState}
                  currentPlayer={currentPlayer}
                  onRollDice={handleRollDice}
                  onBuyProperty={handleBuyProperty}
                  onDeclineProperty={handleDeclineProperty}
                  onPayJailFine={handlePayJailFine}
                  onUseJailCard={handleUseJailCard}
                  onEndTurn={handleEndTurn}
                  onOpenTradeModal={() => setIsTradeModalOpen(true)}
                  onOpenPropertyModal={() => setIsPropertyModalOpen(true)}
                  onDeclareBankruptcy={handleDeclareBankruptcy}
                />
              </div>
            </section>

            {/* Right Maximized Sidebar (Scoreboard + Live Ticker) */}
            <aside className="w-full lg:w-84 xl:w-96 flex flex-col gap-2.5 shrink-0 h-full overflow-hidden">
              {/* Tycoon Leaderboard Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-xl backdrop-blur-xs shrink-0">
                <PlayerScoreboard gameState={gameState} currentPlayer={currentPlayer} />
              </div>

              {/* Live Ticker & Chat Box */}
              <GameLog logs={gameState.logs} onSendMessage={handleSendMessage} />
            </aside>
          </main>

          {/* Property Management Deed Modal */}
          {isPropertyModalOpen && (
            <PropertyModal
              gameState={gameState}
              currentPlayer={currentPlayer}
              selectedTile={inspectedTile}
              onClose={() => {
                setIsPropertyModalOpen(false);
                setInspectedTile(null);
              }}
              onBuildHouse={handleBuildHouse}
              onSellHouse={handleSellHouse}
              onMortgage={handleMortgage}
              onUnmortgage={handleUnmortgage}
            />
          )}

          {/* Trade Agreement Modal */}
          {isTradeModalOpen && (
            <TradeModal
              gameState={gameState}
              currentPlayer={currentPlayer}
              onClose={() => setIsTradeModalOpen(false)}
              onProposeTrade={handleProposeTrade}
              onRespondTrade={handleRespondTrade}
              onCancelTrade={handleCancelTrade}
            />
          )}

          {/* Card Draw Modal (Chance / Community Chest) */}
          {gameState.pendingCard && (
            <CardModal
              card={gameState.pendingCard}
              isMyTurn={
                gameState.players[gameState.activePlayerIndex]?.id === currentPlayer.id
              }
              onResolve={handleResolveCard}
            />
          )}

          {/* Game Over Celebration Modal */}
          {gameState.phase === 'GAME_OVER' && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-4">
                <div className="text-6xl animate-bounce">🏆</div>
                <h2 className="text-3xl font-black text-white tracking-tight">GAME OVER!</h2>
                <p className="text-base text-amber-300 font-bold">
                  {gameState.winnerId
                    ? `${
                        gameState.players.find((p) => p.id === gameState.winnerId)?.name
                      } is the Monopoly Champion!`
                    : 'A tycoon has claimed victory!'}
                </p>
                <button
                  onClick={handleLeaveLobby}
                  className="cursor-pointer px-6 py-3 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-sm uppercase tracking-wider shadow-lg"
                >
                  Return to Main Menu
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Global Cloud Leaderboard Modal */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />
    </div>
  );
}
