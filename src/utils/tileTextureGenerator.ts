import * as THREE from 'three';
import { BoardTile } from '../types/game';

const textureCache = new Map<number, THREE.CanvasTexture>();

/**
 * Creates an ultra-crisp, AAA-standard canvas texture for a Monopoly board tile
 */
export function getTileTexture(tile: BoardTile): THREE.CanvasTexture {
  if (textureCache.has(tile.id)) {
    return textureCache.get(tile.id)!;
  }

  const isCorner = tile.id % 10 === 0;
  const isBottom = tile.id > 0 && tile.id < 10;
  const width = isCorner ? 512 : 380;
  const height = isCorner ? 512 : 560;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Parchment / Ivory Tile Surface
  ctx.fillStyle = '#fcfbfa';
  ctx.fillRect(0, 0, width, height);

  // Subtle marble / paper grain texture
  ctx.fillStyle = 'rgba(0, 0, 0, 0.015)';
  for (let i = 0; i < 400; i++) {
    const rx = Math.random() * width;
    const ry = Math.random() * height;
    ctx.fillRect(rx, ry, 2, 2);
  }

  // Double Border Framing
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, width - 8, height - 8);
  ctx.strokeStyle = '#c5a059'; // Gold inner trim
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // 2. Render Tile Specific Contents (with bottom row upright orientation)
  if (tile.type === 'street') {
    renderStreetTile(ctx, tile, width, height, isBottom);
  } else if (tile.type === 'railroad') {
    renderRailroadTile(ctx, tile, width, height, isBottom);
  } else if (tile.type === 'utility') {
    renderUtilityTile(ctx, tile, width, height, isBottom);
  } else if (tile.type === 'chance') {
    renderChanceTile(ctx, tile, width, height, isBottom);
  } else if (tile.type === 'community') {
    renderChestTile(ctx, tile, width, height, isBottom);
  } else if (tile.type === 'tax') {
    renderTaxTile(ctx, tile, width, height, isBottom);
  } else if (isCorner) {
    renderCornerTile(ctx, tile, width, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  textureCache.set(tile.id, texture);
  return texture;
}

const STREET_HEX_COLORS: Record<string, string> = {
  brown: '#78350f',
  lightblue: '#0284c7',
  pink: '#db2777',
  orange: '#ea580c',
  red: '#dc2626',
  yellow: '#eab308',
  green: '#16a34a',
  darkblue: '#1e40af',
  railroad: '#334155',
  utility: '#475569',
};

function renderStreetTile(
  ctx: CanvasRenderingContext2D,
  tile: BoardTile,
  w: number,
  h: number,
  isBottom: boolean
) {
  const colorHex = tile.color ? STREET_HEX_COLORS[tile.color] || '#475569' : '#475569';
  const headerHeight = Math.floor(h * 0.32);

  if (isBottom) {
    // ---------------- Bottom Row: Color bar at outer rim (bottom), text right-side-up ----------------
    // Color bar at bottom of tile
    ctx.fillStyle = colorHex;
    ctx.fillRect(8, h - headerHeight - 8, w - 16, headerHeight);

    // Shiny gold trim line above color bar
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(8, h - headerHeight - 14, w - 16, 6);

    // Black framing border around color header
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, h - headerHeight - 8, w - 16, headerHeight);

    // Price near top (facing center)
    if (tile.price) {
      ctx.fillStyle = '#475569';
      ctx.font = '800 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PRICE', w / 2, 44);

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 38px "Arial Black", sans-serif';
      ctx.fillText(`$${tile.price}`, w / 2, 85);
    }

    // Subtle center filigree
    drawCenterFiligree(ctx, w / 2, h * 0.38, 24);

    // Property Name in center - large bold black font, 100% upright
    ctx.fillStyle = '#000000';
    ctx.font = '900 34px "Arial Black", "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrapText(ctx, tile.name.toUpperCase(), w / 2, h * 0.55, w - 30, 36);

  } else {
    // ---------------- Standard Rows (Top / Left / Right): Color bar at top ----------------
    ctx.fillStyle = colorHex;
    ctx.fillRect(8, 8, w - 16, headerHeight);

    // Shiny gold trim line under color bar
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(8, 8 + headerHeight, w - 16, 6);

    // Black framing border around color header
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, w - 16, headerHeight);

    // Property Name in center - large bold black font
    ctx.fillStyle = '#000000';
    ctx.font = '900 34px "Arial Black", "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrapText(ctx, tile.name.toUpperCase(), w / 2, headerHeight + 65, w - 30, 36);

    // Subtle center filigree
    drawCenterFiligree(ctx, w / 2, h * 0.72, 28);

    // Price at bottom in bold black / emerald accent
    if (tile.price) {
      ctx.fillStyle = '#1e293b';
      ctx.font = '900 36px "Arial Black", sans-serif';
      ctx.fillText(`$${tile.price}`, w / 2, h - 38);

      ctx.fillStyle = '#475569';
      ctx.font = '800 16px sans-serif';
      ctx.fillText('PRICE', w / 2, h - 78);
    }
  }
}

function renderRailroadTile(
  ctx: CanvasRenderingContext2D,
  tile: BoardTile,
  w: number,
  h: number,
  isBottom: boolean
) {
  if (isBottom) {
    // Reading Railroad (Bottom Row) - upright!
    ctx.fillStyle = '#475569';
    ctx.font = '800 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRICE', w / 2, 42);

    ctx.fillStyle = '#000000';
    ctx.font = '900 38px "Arial Black", sans-serif';
    ctx.fillText(`$${tile.price || 200}`, w / 2, 82);

    ctx.fillStyle = '#000000';
    ctx.font = '900 30px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrapText(ctx, tile.name.toUpperCase(), w / 2, h * 0.36, w - 30, 34);

    // Steam locomotive towards bottom edge (outer rim)
    drawSteamLocomotive(ctx, w / 2, h * 0.68, 1.4);
  } else {
    // Title at top
    ctx.fillStyle = '#000000';
    ctx.font = '900 30px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrapText(ctx, tile.name.toUpperCase(), w / 2, 60, w - 30, 34);

    // Vintage Steam Locomotive Illustration
    drawSteamLocomotive(ctx, w / 2, h * 0.52, 1.4);

    // Price
    ctx.fillStyle = '#000000';
    ctx.font = '900 36px "Arial Black", sans-serif';
    ctx.fillText(`$${tile.price || 200}`, w / 2, h - 38);
  }
}

function renderUtilityTile(
  ctx: CanvasRenderingContext2D,
  tile: BoardTile,
  w: number,
  h: number,
  isBottom: boolean
) {
  if (isBottom) {
    ctx.fillStyle = '#000000';
    ctx.font = '900 38px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`$${tile.price || 150}`, w / 2, 70);

    ctx.font = '900 30px "Arial Black", sans-serif';
    wrapText(ctx, tile.name.toUpperCase(), w / 2, h * 0.36, w - 30, 34);

    if (tile.id === 12) {
      drawLightbulb(ctx, w / 2, h * 0.68, 1.5);
    } else {
      drawFaucet(ctx, w / 2, h * 0.68, 1.5);
    }
  } else {
    ctx.fillStyle = '#000000';
    ctx.font = '900 30px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    wrapText(ctx, tile.name.toUpperCase(), w / 2, 60, w - 30, 34);

    if (tile.id === 12) {
      drawLightbulb(ctx, w / 2, h * 0.52, 1.5);
    } else {
      drawFaucet(ctx, w / 2, h * 0.52, 1.5);
    }

    ctx.fillStyle = '#000000';
    ctx.font = '900 36px "Arial Black", sans-serif';
    ctx.fillText(`$${tile.price || 150}`, w / 2, h - 38);
  }
}

function renderChanceTile(
  ctx: CanvasRenderingContext2D,
  _tile: BoardTile,
  w: number,
  h: number,
  isBottom: boolean
) {
  if (isBottom) {
    ctx.fillStyle = '#ea580c';
    ctx.font = '900 34px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.fillText('CHANCE', w / 2, 65);

    ctx.fillStyle = '#c2410c';
    ctx.font = '900 135px Georgia, serif';
    ctx.fillText('?', w / 2, h * 0.56);

    drawFiligreeRibbon(ctx, w / 2, h * 0.85, w - 60);
  } else {
    ctx.fillStyle = '#ea580c';
    ctx.font = 'bold 32px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.fillText('CHANCE', w / 2, 55);

    ctx.fillStyle = '#c2410c';
    ctx.font = '900 130px Georgia, serif';
    ctx.fillText('?', w / 2, h * 0.52);

    drawFiligreeRibbon(ctx, w / 2, h * 0.8, w - 60);
  }
}

function renderChestTile(
  ctx: CanvasRenderingContext2D,
  _tile: BoardTile,
  w: number,
  h: number,
  isBottom: boolean
) {
  if (isBottom) {
    ctx.fillStyle = '#0284c7';
    ctx.font = '900 28px "Cinzel", serif';
    ctx.textAlign = 'center';
    wrapText(ctx, 'COMMUNITY CHEST', w / 2, 55, w - 40, 30);

    drawTreasureChest(ctx, w / 2, h * 0.56, 1.25);

    drawFiligreeRibbon(ctx, w / 2, h * 0.85, w - 60);
  } else {
    ctx.fillStyle = '#0284c7';
    ctx.font = 'bold 26px "Cinzel", serif';
    ctx.textAlign = 'center';
    wrapText(ctx, 'COMMUNITY CHEST', w / 2, 45, w - 40, 28);

    drawTreasureChest(ctx, w / 2, h * 0.5, 1.2);

    drawFiligreeRibbon(ctx, w / 2, h * 0.8, w - 60);
  }
}

function renderTaxTile(
  ctx: CanvasRenderingContext2D,
  tile: BoardTile,
  w: number,
  h: number,
  isBottom: boolean
) {
  if (isBottom) {
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 30px "Cinzel", serif';
    ctx.textAlign = 'center';
    wrapText(ctx, tile.name.toUpperCase(), w / 2, 55, w - 40, 32);

    drawMoneySack(ctx, w / 2, h * 0.52, 1.3);

    ctx.fillStyle = '#dc2626';
    ctx.font = '900 32px sans-serif';
    ctx.fillText('PAY $200', w / 2, h - 45);
  } else {
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px "Cinzel", serif';
    ctx.textAlign = 'center';
    wrapText(ctx, tile.name.toUpperCase(), w / 2, 55, w - 40, 32);

    if (tile.id === 38) {
      drawDiamondRing(ctx, w / 2, h * 0.48, 1.3);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('PAY $100', w / 2, h - 40);
    } else {
      drawMoneySack(ctx, w / 2, h * 0.48, 1.3);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('PAY $200', w / 2, h - 40);
    }
  }
}

function renderCornerTile(
  ctx: CanvasRenderingContext2D,
  tile: BoardTile,
  w: number,
  h: number
) {
  if (tile.id === 0) {
    // ---------------- Tile 0: GO (Oriented facing viewer, arrow points LEFT towards Tile 1) ----------------
    ctx.fillStyle = '#1e293b';
    ctx.font = '900 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('COLLECT $200 SALARY', w / 2, 50);
    ctx.fillText('AS YOU PASS', w / 2, 85);

    // Huge bold red GO
    ctx.fillStyle = '#dc2626';
    ctx.font = '900 125px Impact, sans-serif';
    ctx.fillText('GO', w / 2, h * 0.55);

    // Big bold red directional arrow POINTING TO THE LEFT (towards Mediterranean Ave, Tile 1)
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(w * 0.85, h * 0.78);
    ctx.lineTo(w * 0.25, h * 0.78);
    ctx.lineTo(w * 0.35, h * 0.7);
    ctx.lineTo(w * 0.15, h * 0.82);
    ctx.lineTo(w * 0.35, h * 0.94);
    ctx.lineTo(w * 0.25, h * 0.86);
    ctx.lineTo(w * 0.85, h * 0.86);
    ctx.closePath();
    ctx.fill();

  } else if (tile.id === 10) {
    // ---------------- Tile 10: JAIL / JUST VISITING ----------------
    // Orange prison block in upper-right corner
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(w * 0.28, 15, w * 0.7, h * 0.7);

    // Black steel prison bars
    ctx.fillStyle = '#0f172a';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(w * 0.35 + i * 28, 25, 8, h * 0.65);
    }

    // Inmate in cell
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('IN JAIL', w * 0.62, h * 0.42);

    // Walkway "JUST VISITING" - upright on the outer strip
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 28px sans-serif';
    ctx.fillText('JUST', w * 0.14, h * 0.4);
    ctx.fillText('VISITING', w * 0.14, h * 0.55);

    ctx.font = '800 22px sans-serif';
    ctx.fillText('VISITING', w * 0.62, h - 35);

  } else if (tile.id === 20) {
    // FREE PARKING
    ctx.fillStyle = '#dc2626';
    ctx.font = '900 38px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.fillText('FREE', w / 2, 70);

    // Vintage sports car
    drawVintageCar(ctx, w / 2, h * 0.5, 1.4);

    ctx.fillText('PARKING', w / 2, h - 50);

  } else if (tile.id === 30) {
    // GO TO JAIL
    ctx.fillStyle = '#1e3a8a';
    ctx.font = '900 36px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.fillText('GO TO', w / 2, 65);

    drawPoliceBadge(ctx, w / 2, h * 0.52, 1.4);

    ctx.fillText('JAIL', w / 2, h - 55);
  }
}

/**
 * Creates luxury textured materials for 3D Chance and Community Chest card decks
 */
export function getCardDeckMaterials(type: 'chance' | 'community'): THREE.MeshStandardMaterial[] {
  // 1. Top Card Face Texture
  const topCanvas = document.createElement('canvas');
  topCanvas.width = 512;
  topCanvas.height = 720;
  const tCtx = topCanvas.getContext('2d')!;

  const isChance = type === 'chance';
  const bgGrad = tCtx.createRadialGradient(256, 360, 50, 256, 360, 360);
  if (isChance) {
    bgGrad.addColorStop(0, '#f97316');
    bgGrad.addColorStop(1, '#9a3412');
  } else {
    bgGrad.addColorStop(0, '#0284c7');
    bgGrad.addColorStop(1, '#0c4a6e');
  }
  tCtx.fillStyle = bgGrad;
  tCtx.fillRect(0, 0, 512, 720);

  // Ornate Bold Double Gold Framing
  tCtx.strokeStyle = '#ffd700';
  tCtx.lineWidth = 26;
  tCtx.strokeRect(18, 18, 476, 684);
  tCtx.strokeStyle = '#fef08a';
  tCtx.lineWidth = 6;
  tCtx.strokeRect(36, 36, 440, 648);

  // Ornate Corner Flourishes
  const corners = [
    [48, 48],
    [464, 48],
    [48, 672],
    [464, 672],
  ];
  tCtx.fillStyle = '#ffd700';
  corners.forEach(([cx, cy]) => {
    tCtx.beginPath();
    tCtx.arc(cx, cy, 22, 0, Math.PI * 2);
    tCtx.fill();
    tCtx.strokeStyle = '#b45309';
    tCtx.lineWidth = 4;
    tCtx.stroke();
  });

  // Typography
  tCtx.textAlign = 'center';
  tCtx.textBaseline = 'middle';
  tCtx.fillStyle = '#ffffff';
  tCtx.shadowColor = 'rgba(0,0,0,0.9)';
  tCtx.shadowBlur = 14;

  if (isChance) {
    tCtx.font = '900 58px "Arial Black", sans-serif';
    tCtx.fillText('CHANCE', 256, 125);

    // Big central gold mystery question mark
    tCtx.fillStyle = '#fef08a';
    tCtx.font = '900 290px Georgia, serif';
    tCtx.shadowColor = 'rgba(0,0,0,0.95)';
    tCtx.shadowBlur = 20;
    tCtx.fillText('?', 256, 390);

    tCtx.fillStyle = '#ffd700';
    tCtx.font = '900 34px "Arial Black", sans-serif';
    tCtx.shadowBlur = 8;
    tCtx.fillText('★ CHANCE ★', 256, 615);
  } else {
    tCtx.font = '900 48px "Arial Black", sans-serif';
    tCtx.fillText('COMMUNITY', 256, 105);
    tCtx.fillText('CHEST', 256, 160);

    // Treasure chest illustration
    tCtx.shadowBlur = 0;
    drawTreasureChest(tCtx, 256, 390, 3.2);

    tCtx.fillStyle = '#ffd700';
    tCtx.font = '900 34px "Arial Black", sans-serif';
    tCtx.shadowBlur = 8;
    tCtx.fillText('★ TREASURY ★', 256, 615);
  }

  const topTex = new THREE.CanvasTexture(topCanvas);
  topTex.colorSpace = THREE.SRGBColorSpace;
  topTex.anisotropy = 16;
  topTex.needsUpdate = true;

  // 2. Paper Edge Texture (Stacked cards look)
  const edgeCanvas = document.createElement('canvas');
  edgeCanvas.width = 128;
  edgeCanvas.height = 128;
  const eCtx = edgeCanvas.getContext('2d')!;
  eCtx.fillStyle = '#f8fafc';
  eCtx.fillRect(0, 0, 128, 128);

  // Stacked page line layers
  eCtx.fillStyle = 'rgba(148, 163, 184, 0.35)';
  for (let y = 0; y < 128; y += 4) {
    eCtx.fillRect(0, y, 128, 1.5);
  }

  const edgeTex = new THREE.CanvasTexture(edgeCanvas);
  edgeTex.colorSpace = THREE.SRGBColorSpace;
  edgeTex.wrapS = THREE.RepeatWrapping;
  edgeTex.wrapT = THREE.RepeatWrapping;
  edgeTex.repeat.set(4, 1);

  const edgeMat = new THREE.MeshStandardMaterial({
    map: edgeTex,
    roughness: 0.8,
    metalness: 0.05,
  });

  const topMat = new THREE.MeshStandardMaterial({
    map: topTex,
    roughness: 0.3,
    metalness: 0.15,
  });

  const bottomMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.9,
  });

  // Box faces: [+x, -x, +y (top), -y (bottom), +z, -z]
  return [edgeMat, edgeMat, topMat, bottomMat, edgeMat, edgeMat];
}

/**
 * Creates luxury green poker-felt texture for the board center
 */
export function getFeltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Radial luxury vignette
  const grad = ctx.createRadialGradient(512, 512, 120, 512, 512, 700);
  grad.addColorStop(0, '#065f46');
  grad.addColorStop(0.7, '#044e38');
  grad.addColorStop(1, '#022c22');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Fine fabric weave noise
  ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
  for (let i = 0; i < 4000; i++) {
    const rx = Math.random() * 1024;
    const ry = Math.random() * 1024;
    ctx.fillRect(rx, ry, 2, 2);
  }

  // Subtle gold corner filigree
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.25)';
  ctx.lineWidth = 4;
  const corners = [
    [60, 60],
    [964, 60],
    [60, 964],
    [964, 964],
  ];
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 35, 0, Math.PI * 2);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ----------------- Procedural Vector Draw Helpers -----------------

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  let line = '';
  const lines: string[] = [];

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      lines.push(line.trim());
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());

  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => {
    ctx.fillText(l, x, startY + i * lineHeight);
  });
}

function drawSteamLocomotive(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  ctx.fillStyle = '#0f172a';

  // Boiler & cabin
  ctx.fillRect(-65, -15, 75, 40); // Boiler
  ctx.fillRect(10, -35, 45, 60); // Cabin
  ctx.fillRect(-75, -5, 15, 30); // Front dome

  // Smokestack & headlight
  ctx.fillRect(-50, -35, 16, 20);
  ctx.fillRect(-85, 0, 10, 15);

  // Cabin roof
  ctx.beginPath();
  ctx.arc(32, -35, 25, Math.PI, 0);
  ctx.fill();

  // Wheels
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 4;
  [-45, -15, 25].forEach((wx) => {
    ctx.beginPath();
    ctx.arc(wx, 35, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Track cowcatcher
  ctx.beginPath();
  ctx.moveTo(-75, 25);
  ctx.lineTo(-95, 45);
  ctx.lineTo(-70, 45);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawLightbulb(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Glowing halo
  const grad = ctx.createRadialGradient(0, -10, 5, 0, -10, 45);
  grad.addColorStop(0, '#fef08a');
  grad.addColorStop(0.6, '#facc15');
  grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, -10, 45, 0, Math.PI * 2);
  ctx.fill();

  // Glass bulb
  ctx.fillStyle = '#fde047';
  ctx.strokeStyle = '#854d0e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -10, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Metal screw base
  ctx.fillStyle = '#64748b';
  ctx.fillRect(-12, 16, 24, 18);
  ctx.strokeStyle = '#334155';
  ctx.strokeRect(-12, 16, 24, 18);

  ctx.restore();
}

function drawFaucet(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  ctx.fillStyle = '#0284c7';
  ctx.strokeStyle = '#0369a1';
  ctx.lineWidth = 3;

  // Spigot pipe
  ctx.fillRect(-35, -15, 45, 20);
  ctx.fillRect(0, -15, 20, 35);

  // Valve handle
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-20, -32, 40, 10);

  // Water drop
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(10, 30);
  ctx.quadraticCurveTo(20, 50, 10, 55);
  ctx.quadraticCurveTo(0, 50, 10, 30);
  ctx.fill();

  ctx.restore();
}

function drawTreasureChest(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Chest body (wood)
  ctx.fillStyle = '#78350f';
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 4;
  ctx.fillRect(-45, -5, 90, 50);
  ctx.strokeRect(-45, -5, 90, 50);

  // Chest arched lid
  ctx.beginPath();
  ctx.ellipse(0, -5, 46, 22, 0, Math.PI, 0);
  ctx.fillStyle = '#92400e';
  ctx.fill();
  ctx.stroke();

  // Gold iron straps & lock
  ctx.fillStyle = '#eab308';
  ctx.fillRect(-35, -20, 12, 65);
  ctx.fillRect(23, -20, 12, 65);

  // Padlock plate
  ctx.beginPath();
  ctx.arc(0, 12, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.fillRect(-2, 10, 4, 8);

  ctx.restore();
}

function drawDiamondRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Gold ring band
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 15, 26, 0, Math.PI * 2);
  ctx.stroke();

  // Diamond Gem
  ctx.fillStyle = '#38bdf8';
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-22, -10);
  ctx.lineTo(22, -10);
  ctx.lineTo(0, -32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Sparkle stars
  ctx.fillStyle = '#ffffff';
  ctx.fillText('✦', -26, -26);
  ctx.fillText('✦', 20, -28);

  ctx.restore();
}

function drawMoneySack(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Burlap Sack
  ctx.fillStyle = '#d97706';
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, 10, 36, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Tied neck
  ctx.fillStyle = '#b45309';
  ctx.fillRect(-15, -28, 30, 12);

  // Big Dollar Sign
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 38px Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('$', 0, 24);

  ctx.restore();
}

function drawVintageCar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-50, 0, 100, 24);

  // Cabin
  ctx.beginPath();
  ctx.arc(-5, 0, 26, Math.PI, 0);
  ctx.fill();

  // Wheels
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 4;
  [-30, 30].forEach((wx) => {
    ctx.beginPath();
    ctx.arc(wx, 24, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.restore();
}

function drawPoliceBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Gold 7-point badge star
  ctx.fillStyle = '#eab308';
  ctx.strokeStyle = '#854d0e';
  ctx.lineWidth = 4;

  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const angle = (i * Math.PI * 2) / 7 - Math.PI / 2;
    const rOuter = 40;
    const rInner = 20;
    const xOuter = Math.cos(angle) * rOuter;
    const yOuter = Math.sin(angle) * rOuter;
    const nextAngle = angle + Math.PI / 7;
    const xInner = Math.cos(nextAngle) * rInner;
    const yInner = Math.sin(nextAngle) * rInner;

    if (i === 0) ctx.moveTo(xOuter, yOuter);
    else ctx.lineTo(xOuter, yOuter);
    ctx.lineTo(xInner, yInner);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Whistle / Star center
  ctx.fillStyle = '#1e3a8a';
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawCenterFiligree(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
) {
  ctx.save();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.65, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawFiligreeRibbon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number
) {
  ctx.save();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy);
  ctx.lineTo(cx + w / 2, cy);
  ctx.stroke();
  ctx.restore();
}
