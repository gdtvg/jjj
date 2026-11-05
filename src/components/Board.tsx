import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { BOARD_TILES, COLOR_HEX_MAP, COLOR_GROUPS } from '../data/monopolyBoard';
import { BoardTile, GameState, Player } from '../types/game';
import { movementPath, STEP_DURATION } from '../utils/gamePresentation';
import { Dice } from './Dice';
import { ASSETS } from '../assets/assetMap';
import { playSound } from '../utils/sound';

interface BoardProps {
  gameState: GameState;
  diceValues?: [number, number];
  localPlayerId: string;
  onTileClick?: (tile: BoardTile) => void;
  onRollClick?: () => void;
  canRoll?: boolean;
  isRolling?: boolean;
}

export const getTilePosition = (
  id: number
): { row: number; col: number; side: 'bottom' | 'left' | 'top' | 'right' | 'corner' } => {
  if (id === 0) return { row: 11, col: 11, side: 'corner' };
  if (id === 10) return { row: 11, col: 1, side: 'corner' };
  if (id === 20) return { row: 1, col: 1, side: 'corner' };
  if (id === 30) return { row: 1, col: 11, side: 'corner' };

  if (id > 0 && id < 10) {
    return { row: 11, col: 11 - id, side: 'bottom' };
  }
  if (id > 10 && id < 20) {
    return { row: 21 - id, col: 1, side: 'left' };
  }
  if (id > 20 && id < 30) {
    return { row: 1, col: id - 19, side: 'top' };
  }
  return { row: id - 29, col: 11, side: 'right' };
};

// Calculate normalized percentage (x%, y%) of tile center on 11x11 grid
export const getTilePercentCenter = (tileId: number): { x: number; y: number } => {
  const { row, col } = getTilePosition(tileId);
  // Grid: 11 cells. cell size = 100 / 11 = ~9.09%
  const cellPercent = 100 / 11;
  const x = (col - 1) * cellPercent + cellPercent / 2;
  const y = (row - 1) * cellPercent + cellPercent / 2;
  return { x, y };
};

export const Board: React.FC<BoardProps> = ({
  gameState,
  diceValues,
  localPlayerId,
  onTileClick,
  onRollClick,
  canRoll,
  isRolling = false,
}) => {
  const [hoveredTileId, setHoveredTileId] = useState<number | null>(null);
  const [isIsometric, setIsIsometric] = useState(true);
  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const previousPositionsRef = useRef<Record<string, number>>({});
  const tokenElementsRef = useRef<Record<string, HTMLDivElement | null>>({});

  const timelinesRef = useRef<Record<string, gsap.core.Timeline>>({});
  useEffect(() => () => { Object.values(timelinesRef.current).forEach(t => t.kill()); }, []);

  // GSAP Step-by-Step Token Hop Animation
  useEffect(() => {
    gameState.players.forEach((player) => {
      const prevPos = previousPositionsRef.current[player.id];
      const targetPos = player.position;

      if (prevPos !== undefined && prevPos !== targetPos) {
        const tokenEl = tokenElementsRef.current[player.id];
        if (tokenEl) {
          const steps = movementPath(prevPos, player).slice(1);
          timelinesRef.current[player.id]?.kill();
          const start = getTilePercentCenter(prevPos);
          gsap.set(tokenEl, { x: 0, y: 0, xPercent: start.x, yPercent: start.y });
          const tl = gsap.timeline();
          timelinesRef.current[player.id] = tl;
          steps.forEach(stepTile => {
            const { x, y } = getTilePercentCenter(stepTile);
            tl.to(tokenEl, {
              xPercent: x, yPercent: y, duration: STEP_DURATION / 1000,
              ease: 'power1.inOut', onStart: () => playSound('hop'),
            });
            if (tokenEl.firstElementChild) tl.to(tokenEl.firstElementChild, {
              y: -18, duration: STEP_DURATION / 2000, yoyo: true, repeat: 1, ease: 'power2.out',
            }, '<');
          });

          // Check if passed GO
          if (steps.includes(0)) {
            confetti({
              particleCount: 60,
              spread: 60,
              origin: { y: 0.8 },
            });
          }
        }
      }

      previousPositionsRef.current[player.id] = player.position;
    });
  }, [gameState.players]);

  // Check if current active player achieved a monopoly
  useEffect(() => {
    if (activePlayer && gameState.phase === 'ACTION') {
      const tile = BOARD_TILES[activePlayer.position];
      if (tile?.color && COLOR_GROUPS[tile.color]) {
        const group = COLOR_GROUPS[tile.color];
        const ownsAll = group.every(
          (id) => gameState.properties[id]?.ownerId === activePlayer.id
        );
        if (ownsAll) {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.5 },
          });
        }
      }
    }
  }, [gameState.phase, activePlayer]);

  const renderTileContent = (tile: BoardTile) => {
    const prop = gameState.properties[tile.id];
    const owner = prop?.ownerId ? gameState.players.find((p) => p.id === prop.ownerId) : null;
    const { side } = getTilePosition(tile.id);
    const colorInfo = tile.color ? COLOR_HEX_MAP[tile.color] : null;
    const isUnownedStreet =
      (tile.type === 'street' || tile.type === 'railroad' || tile.type === 'utility') &&
      !prop?.ownerId;

    // Corner rendering
    if (tile.id === 0) {
      // GO
      return (
        <div className="w-full h-full p-1.5 flex flex-col justify-between items-center text-center bg-gradient-to-br from-amber-50 to-orange-100 select-none shadow-inner border border-amber-300/40">
          <span className="text-[9px] font-black uppercase text-red-700 tracking-tighter leading-none">
            COLLECT $200 SALARY
          </span>
          <div className="my-auto flex flex-col items-center">
            <span className="text-3xl font-black tracking-tighter text-red-600 drop-shadow-[0_2px_4px_rgba(220,38,38,0.3)]">
              GO
            </span>
            <span className="text-xl leading-none text-red-600 font-black animate-pulse">⇐</span>
          </div>
          <span className="text-[8px] font-black text-slate-700 uppercase tracking-tighter">
            AS YOU PASS
          </span>
        </div>
      );
    }

    if (tile.id === 10) {
      // JAIL
      return (
        <div className="w-full h-full relative p-0.5 select-none bg-stone-200 flex flex-col justify-between">
          <div className="text-[8px] font-black text-slate-800 uppercase tracking-widest text-center">
            JUST
          </div>
          <div className="flex-1 m-0.5 bg-amber-950 rounded border-2 border-stone-800 flex flex-col items-center justify-center p-0.5 text-white shadow-inner">
            <span className="text-base leading-none">⛓️</span>
            <span className="text-[8px] font-black tracking-wider text-orange-400">IN JAIL</span>
          </div>
          <div className="text-[8px] font-black text-slate-800 uppercase tracking-widest text-center">
            VISITING
          </div>
        </div>
      );
    }

    if (tile.id === 20) {
      // FREE PARKING
      return (
        <div className="w-full h-full p-1.5 flex flex-col justify-between items-center text-center bg-gradient-to-br from-amber-50 to-amber-100 select-none">
          <span className="text-[9px] font-black uppercase text-red-700 tracking-wider">FREE</span>
          <div className="my-auto flex flex-col items-center">
            <span className="text-2xl drop-shadow-sm">🏎️</span>
            <span className="text-[8px] font-black text-amber-800 uppercase tracking-tight">
              JACKPOT
            </span>
          </div>
          <span className="text-[9px] font-black uppercase text-red-700 tracking-wider">
            PARKING
          </span>
        </div>
      );
    }

    if (tile.id === 30) {
      // GO TO JAIL
      return (
        <div className="w-full h-full p-1.5 flex flex-col justify-between items-center text-center bg-gradient-to-br from-amber-50 to-sky-100 select-none">
          <span className="text-[9px] font-black uppercase text-blue-900 tracking-wider">GO TO</span>
          <div className="my-auto flex flex-col items-center">
            <span className="text-2xl">👮‍♂️</span>
            <span className="text-xs">🚨</span>
          </div>
          <span className="text-[9px] font-black uppercase text-blue-900 tracking-wider">JAIL</span>
        </div>
      );
    }

    // Special tile icons
    let specialIcon = null;
    if (tile.type === 'chance') specialIcon = '❓';
    else if (tile.type === 'community') specialIcon = '📦';
    else if (tile.type === 'railroad') specialIcon = '🚂';
    else if (tile.type === 'utility') specialIcon = tile.id === 12 ? '💡' : '🚰';
    else if (tile.type === 'tax') specialIcon = tile.id === 4 ? '🪙' : '💎';

    // Banner positioning
    let bannerClasses = 'h-3.5 w-full top-0 left-0 absolute';
    if (side === 'left') bannerClasses = 'w-3.5 h-full right-0 top-0 absolute';
    else if (side === 'right') bannerClasses = 'w-3.5 h-full left-0 top-0 absolute';
    else if (side === 'top') bannerClasses = 'h-3.5 w-full bottom-0 left-0 absolute';

    return (
      <div className="relative w-full h-full flex flex-col justify-between items-center p-0.5 select-none text-center overflow-hidden">
        {/* Color stripe */}
        {tile.type === 'street' && colorInfo && (
          <div
            className={`${bannerClasses} ${colorInfo.bg} flex items-center justify-center shadow-xs border-b border-black/30`}
          >
            {/* 3D Houses / Hotel representation */}
            {prop && prop.houses > 0 && (
              <div className="flex gap-0.5 items-center justify-center">
                {prop.houses === 5 ? (
                  <span className="w-3 h-3 bg-red-600 border border-yellow-300 rounded-xs shadow-md text-[7px] font-black text-white flex items-center justify-center">
                    H
                  </span>
                ) : (
                  Array.from({ length: prop.houses }).map((_, i) => (
                    <span
                      key={i}
                      className="w-2.5 h-2.5 bg-emerald-500 border border-emerald-300 rounded-xs shadow-sm flex items-center justify-center text-[7px] text-white"
                    >
                      ▲
                    </span>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Owner marker ring */}
        {owner && (
          <div
            className="absolute top-1 right-1 w-3 h-3 rounded-full border-2 border-white shadow-md z-10"
            style={{ backgroundColor: owner.color }}
            title={`Owned by ${owner.name}`}
          />
        )}

        {/* Mortgaged stamp */}
        {prop?.mortgaged && (
          <div className="absolute inset-0 bg-red-950/80 backdrop-blur-xs flex items-center justify-center z-15">
            <span className="text-[8px] font-black text-red-200 tracking-wider uppercase rotate-[-22deg] px-1 py-0.5 bg-red-900 border border-red-400 rounded-xs shadow-md">
              MORTGAGED
            </span>
          </div>
        )}

        {/* Tile Content */}
        <div className="flex-1 flex flex-col items-center justify-center w-full z-1 px-0.5 py-0.5">
          {specialIcon && (
            <span className="text-sm md:text-base leading-none mb-0.5 filter drop-shadow-xs">
              {specialIcon}
            </span>
          )}

          <span className="font-bold text-slate-900 leading-tight line-clamp-2 text-[9px] md:text-[10px]">
            {tile.name}
          </span>

          {tile.price && (
            <span className="text-[8px] md:text-[9px] font-mono font-bold text-slate-700 mt-0.5">
              ${tile.price}
            </span>
          )}

          {tile.type === 'tax' && tile.taxAmount && (
            <span className="text-[8px] md:text-[9px] font-mono font-bold text-rose-700 mt-0.5">
              Pay ${tile.taxAmount}
            </span>
          )}
        </div>

        {/* Purchasable Glowing Pulse */}
        {isUnownedStreet && activePlayer?.position === tile.id && (
          <div className="absolute inset-0 border-2 border-amber-400 animate-pulse pointer-events-none rounded" />
        )}

        {/* Miniature hover peek info */}
        {hoveredTileId === tile.id && (tile.price || tile.rent) && (
          <div className="absolute inset-x-0 bottom-4 bg-slate-950/95 text-white text-[8px] p-1.5 rounded z-25 pointer-events-none shadow-2xl border border-amber-400/60">
            {tile.rent && <div className="text-emerald-400 font-bold">Base Rent: ${tile.rent[0]}</div>}
            {tile.price && <div>Cost: ${tile.price}</div>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      {/* 3D Isometric View Perspective Switch */}
      <div className="absolute top-2 right-4 z-30 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-slate-700 text-xs shadow-lg">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Board Style:
        </span>
        <button
          onClick={() => {
            playSound('click');
            setIsIsometric(!isIsometric);
          }}
          className="cursor-pointer text-[11px] font-black text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
        >
          <span>{isIsometric ? '🎲 3D Isometric Tilt' : '📐 Flat Tabletop'}</span>
        </button>
      </div>

      {/* Outer 3D Perspective Wrapper */}
      <div
        className="relative transition-transform duration-700 ease-out flex items-center justify-center"
        style={{
          perspective: '1400px',
          transformStyle: 'preserve-3d',
          transform: isIsometric ? 'rotateX(24deg) rotateZ(-3deg)' : 'rotateX(0deg) rotateZ(0deg)',
        }}
      >
        {/* Physical Board Bezel with 3D Extrusion Shadows */}
        <div
          className="relative w-[540px] sm:w-[620px] md:w-[680px] xl:w-[740px] aspect-square rounded-3xl p-3 select-none transition-all duration-500"
          style={{
            background: 'linear-gradient(135deg, #3b1d09 0%, #1f0f04 50%, #2a1407 100%)',
            boxShadow: isIsometric
              ? '0 40px 80px rgba(0,0,0,0.9), 0 8px 0 #1b0c03, 0 16px 0 #140802, 0 24px 0 #0d0401, 0 32px 30px rgba(0,0,0,0.85)'
              : '0 25px 60px rgba(0,0,0,0.8)',
            border: '4px solid #b45309',
          }}
        >
          {/* Inner Golden Bevel Inlay */}
          <div className="w-full h-full rounded-2xl p-1 bg-gradient-to-br from-amber-500 via-yellow-600 to-amber-700 shadow-inner">
            {/* 11x11 Grid Board Frame */}
            <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-0.5 bg-stone-400 rounded-xl overflow-hidden border border-stone-800 shadow-2xl relative">
              {BOARD_TILES.map((tile) => {
                const { row, col, side } = getTilePosition(tile.id);
                const isCorner = side === 'corner';
                const isActiveTile = activePlayer?.position === tile.id;

                return (
                  <div
                    key={tile.id}
                    onClick={() => onTileClick?.(tile)}
                    onMouseEnter={() => setHoveredTileId(tile.id)}
                    onMouseLeave={() => setHoveredTileId(null)}
                    style={{
                      gridRow: row,
                      gridColumn: col,
                    }}
                    className={`relative cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                      isCorner ? 'bg-amber-100/95' : 'bg-stone-50 hover:bg-amber-100/70'
                    } ${
                      isActiveTile
                        ? 'ring-3 ring-amber-500 ring-inset shadow-xl z-10'
                        : 'hover:scale-[1.03] hover:z-20 hover:shadow-lg'
                    }`}
                  >
                    {renderTileContent(tile)}
                  </div>
                );
              })}

              {/* Central 9x9 Luxury Casino Felt Area */}
              <div className="col-start-2 col-end-11 row-start-2 row-end-11 bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 flex flex-col items-center justify-between p-4 sm:p-6 text-white relative shadow-inner overflow-hidden select-none">
                {/* Filigree cloth pattern overlay */}
                <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:18px_18px]" />
                <div className="absolute inset-2 border-2 border-amber-500/25 rounded-2xl pointer-events-none" />

                {/* Free Parking Vault */}
                <div className="z-10 flex flex-col items-center bg-black/60 border border-amber-500/40 backdrop-blur-md px-4 py-1.5 rounded-xl shadow-2xl">
                  <div className="flex items-center gap-1.5 text-[9px] uppercase font-black tracking-widest text-amber-300">
                    <span>🪙</span> Free Parking Vault
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                    ${gameState.freeParkingPot}
                  </div>
                </div>

                {/* Center Medallion, 3D Dice and Action HUD */}
                <div className="z-10 flex flex-col items-center text-center my-auto w-full max-w-sm">
                  {/* Generated Gold Monopoly Medallion */}
                  <img
                    src={ASSETS.luxuryCrest}
                    alt="Monopoly Gold Crest"
                    className="w-24 h-24 object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.95)] mb-1 transform hover:scale-105 transition-transform"
                  />
                  <div className="text-[10px] uppercase font-black tracking-[0.25em] text-amber-300/80 mb-2">
                    Room #{gameState.roomId}
                  </div>

                  {/* 3D Ivory Dice with Real Dots */}
                  <div className="flex items-center justify-center gap-5 my-1">
                    <Dice value={diceValues?.[0] ?? gameState.dice[0]} size="lg" rolling={isRolling} />
                    <Dice value={diceValues?.[1] ?? gameState.dice[1]} size="lg" rolling={isRolling} />
                  </div>

                  {/* Doubles alert */}
                  {gameState.dice[0] === gameState.dice[1] && gameState.hasRolled && (
                    <div className="text-xs font-black text-amber-300 bg-amber-950/90 border border-amber-500/50 px-3 py-0.5 rounded-full shadow-lg animate-bounce my-1">
                      ⚡ Doubles! Extra Turn ({gameState.doublesCount}/3)
                    </div>
                  )}

                  {/* Tactile Roll Button in Center */}
                  {canRoll && (
                    <button
                      onClick={onRollClick}
                      className="cursor-pointer mt-2 px-8 py-3 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black rounded-2xl text-sm uppercase tracking-wider shadow-[0_8px_25px_rgba(245,158,11,0.55)] active:scale-95 transition-all flex items-center gap-2 animate-pulse"
                    >
                      <span className="text-xl">🎲</span> ROLL DICE
                    </button>
                  )}
                </div>

                {/* Decks Preview */}
                <div className="z-10 flex gap-4 text-xs font-bold">
                  <div className="bg-gradient-to-r from-orange-600 to-amber-700 border border-orange-400/50 text-orange-100 px-3.5 py-1.5 rounded-lg shadow-lg flex items-center gap-2">
                    <span className="text-sm">❓</span> Chance
                  </div>
                  <div className="bg-gradient-to-r from-sky-600 to-blue-700 border border-sky-400/50 text-sky-100 px-3.5 py-1.5 rounded-lg shadow-lg flex items-center gap-2">
                    <span className="text-sm">📦</span> Community
                  </div>
                </div>
              </div>

              {/* GSAP Animated Player Tokens Layer */}
              <div className="absolute inset-0 pointer-events-none z-30">
                {gameState.players.map((player, pIdx) => {
                  const { x, y } = getTilePercentCenter(player.position);
                  // Stagger offset if multiple on same tile
                  const staggerOffset = (pIdx - (gameState.players.length - 1) / 2) * 10;

                  return (
                    <div
                      key={player.id}
                      ref={(el) => {
                        tokenElementsRef.current[player.id] = el;
                      }}
                      style={{ transform: `translate(${x}%, ${y}%)`, display: player.bankrupt ? 'none' : undefined }}
                      className="absolute inset-0 w-full h-full select-none"
                    >
                      <div style={{ transform: `translate(-50%, -50%) translateX(${staggerOffset}px)`, borderColor: player.color }} className="absolute left-0 top-0 w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-lg border-2 shadow-xl">
                        {player.id === localPlayerId && <span className="own-position-arrow" aria-label="Deine Figur"><svg viewBox="0 0 24 32" width="24" height="32" aria-hidden="true"><path d="M8 1h8v15h7L12 31 1 16h7Z" fill="#edca80" stroke="#493818" strokeWidth="1.5" /></svg></span>}
                        <span>{player.token}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
