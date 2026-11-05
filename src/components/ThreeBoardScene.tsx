import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { BOARD_TILES } from '../data/monopolyBoard';
import { BoardTile, GameState, PlayerToken } from '../types/game';
import { getCardDeckMaterials, getFeltTexture } from '../utils/tileTextureGenerator';
import { createBoardTileMesh } from '../utils/propertyModel';
import { ASSETS } from '../assets/assetMap';
import { Camera, LocateFixed, Move, ScanLine, Dices, RotateCcw } from 'lucide-react';
import { tokenRestHeight } from '../utils/boardLayout';
import { movementPath, STEP_DURATION } from '../utils/gamePresentation';
import { playSound } from '../utils/sound';

interface ThreeBoardSceneProps {
  gameState: GameState;
  localPlayerId: string;
  diceValues?: [number, number];
  isDiceCloseup?: boolean;
  onTileClick?: (tile: BoardTile) => void;
  isRolling?: boolean;
}

export const ThreeBoardScene: React.FC<ThreeBoardSceneProps> = ({
  gameState,
  localPlayerId,
  diceValues,
  isDiceCloseup = false,
  onTileClick,
  isRolling,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [cameraMode, setCameraMode] = useState<'angled' | 'top' | 'focus'>('angled');
  const [hoveredTile, setHoveredTile] = useState<BoardTile | null>(null);

  const liveRef = useRef({ rolling: isRolling, closeup: isDiceCloseup, dice: diceValues || gameState.dice, localPlayerId });
  liveRef.current = { rolling: isRolling, closeup: isDiceCloseup, dice: diceValues || gameState.dice, localPlayerId };
  const ownMarkerRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const tokensMapRef = useRef<Map<string, THREE.Group>>(new Map());
  const tokenAnimationRef = useRef<
    Map<
      string,
      {
        path: number[];
        stepIndex: number;
        stepProgress: number;
      }
    >
  >(new Map());
  const previousPositionsRef = useRef<Record<string, number>>({});
  const diceGroupRef = useRef<THREE.Group | null>(null);
  const diceMeshesRef = useRef<THREE.Mesh[]>([]);
  const isDraggingRef = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const lookAtRef = useRef(new THREE.Vector3(0, 0, 0));
  const dragDistanceRef = useRef(0);
  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const cameraPosTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 16, 17));
  const tileMeshesRef = useRef<THREE.Mesh[]>([]);
  const hoverHighlightMeshRef = useRef<THREE.Mesh | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseCoordsRef = useRef(new THREE.Vector2());

  // Helper to map tile index 0-39 to 3D board coordinates (x, z)
  const getTile3DPosition = (tileId: number): { x: number; z: number; rotation: number } => {
    const half = 7.5;

    // Corners
    if (tileId === 0) return { x: half, z: half, rotation: -Math.PI / 4 }; // GO (facing camera and center)
    if (tileId === 10) return { x: -half, z: half, rotation: Math.PI / 4 }; // JAIL
    if (tileId === 20) return { x: -half, z: -half, rotation: -Math.PI / 4 }; // FREE PARKING
    if (tileId === 30) return { x: half, z: -half, rotation: (-3 * Math.PI) / 4 }; // GO TO JAIL

    // Bottom side: 1 to 9 (from GO towards JAIL)
    // Rotation = 0 ensures all text and graphics are 100% upright to the camera!
    if (tileId > 0 && tileId < 10) {
      const x = 6 - (tileId - 1) * 1.5;
      return { x, z: half, rotation: 0 };
    }

    // Left side: 11 to 19 (from JAIL towards FREE PARKING)
    if (tileId > 10 && tileId < 20) {
      const z = 6 - (tileId - 11) * 1.5;
      return { x: -half, z, rotation: -Math.PI / 2 };
    }

    // Top side: 21 to 29 (from FREE PARKING towards GO TO JAIL)
    if (tileId > 20 && tileId < 30) {
      const x = -6 + (tileId - 21) * 1.5;
      return { x, z: -half, rotation: 0 };
    }

    // Right side: 31 to 39 (from GO TO JAIL towards GO)
    const z = -6 + (tileId - 31) * 1.5;
    return { x: half, z, rotation: Math.PI / 2 };
  };

  // Helper to get positions for ownership marker (inner curb) and buildings (color bar)
  const getTileFeaturePositions = (tileId: number) => {
    const { x, z, rotation } = getTile3DPosition(tileId);
    let innerX = x;
    let innerZ = z;
    let outerX = x;
    let outerZ = z;

    if (tileId > 0 && tileId < 10) {
      // Bottom row (rotation = 0)
      innerZ = z - 0.65; // towards center
      outerZ = z + 0.55; // outer color bar
    } else if (tileId > 10 && tileId < 20) {
      // Left row
      innerX = x + 0.65; // towards center
      outerX = x - 0.55; // outer color bar
    } else if (tileId > 20 && tileId < 30) {
      // Top row
      innerZ = z + 0.65; // towards center
      outerZ = z - 0.55; // outer color bar
    } else if (tileId > 30 && tileId < 40) {
      // Right row
      innerX = x - 0.65; // towards center
      outerX = x + 0.55; // outer color bar
    }

    return { innerX, innerZ, outerX, outerZ, rotation };
  };

  // Build a distinct 3D procedural token model
  const createPlayerTokenMesh = (token: PlayerToken, colorHex: string): THREE.Group => {
    const group = new THREE.Group();
    const tokenColor = new THREE.Color(colorHex);

    const metalMaterial = new THREE.MeshStandardMaterial({
      color: tokenColor,
      metalness: 0.92,
      roughness: 0.2,
      envMapIntensity: 1.5,
    });

    const goldAccent = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.95,
      roughness: 0.15,
    });

    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.98,
      roughness: 0.1,
    });

    switch (token) {
      case '🎩': {
        // Luxury Top Hat
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 32), metalMaterial);
        brim.castShadow = true;
        group.add(brim);

        const ribbon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.245, 0.245, 0.09, 32),
          goldAccent
        );
        ribbon.position.y = 0.07;
        group.add(ribbon);

        const crown = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.21, 0.45, 32),
          metalMaterial
        );
        crown.position.y = 0.28;
        crown.castShadow = true;
        group.add(crown);
        break;
      }

      case '🚗': {
        // Classic 1930s Racecar
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.18, 0.28), metalMaterial);
        body.position.y = 0.12;
        body.castShadow = true;
        group.add(body);

        const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.35, 16), metalMaterial);
        hood.rotation.z = Math.PI / 2;
        hood.position.set(0.15, 0.14, 0);
        group.add(hood);

        const grill = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.18), chromeMaterial);
        grill.position.set(0.34, 0.12, 0);
        group.add(grill);

        const wheelGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
        const wheelOffsets = [
          [-0.2, 0.08, 0.16],
          [0.2, 0.08, 0.16],
          [-0.2, 0.08, -0.16],
          [0.2, 0.08, -0.16],
        ];
        wheelOffsets.forEach(([wx, wy, wz]) => {
          const w = new THREE.Mesh(wheelGeo, wheelMat);
          w.rotation.x = Math.PI / 2;
          w.position.set(wx, wy, wz);
          group.add(w);
        });
        break;
      }

      case '🚢': {
        // Battleship
        const hull = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 4), metalMaterial);
        hull.rotation.z = Math.PI / 2;
        hull.position.y = 0.1;
        hull.castShadow = true;
        group.add(hull);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.16), metalMaterial);
        cabin.position.set(-0.05, 0.18, 0);
        group.add(cabin);

        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), chromeMaterial);
        mast.position.set(0, 0.3, 0);
        group.add(mast);
        break;
      }

      case '🐕': {
        // Scottish Terrier
        const dogBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.22), metalMaterial);
        dogBody.position.y = 0.18;
        dogBody.castShadow = true;
        group.add(dogBody);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.18), metalMaterial);
        head.position.set(0.24, 0.28, 0);
        group.add(head);

        const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.12), metalMaterial);
        snout.position.set(0.36, 0.24, 0);
        group.add(snout);

        const collar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.19, 0.19), goldAccent);
        collar.position.set(0.15, 0.24, 0);
        group.add(collar);

        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), metalMaterial);
        tail.rotation.z = -Math.PI / 4;
        tail.position.set(-0.24, 0.3, 0);
        group.add(tail);
        break;
      }

      default: {
        // Luxury Seal / Totem
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.1, 32), metalMaterial);
        base.position.y = 0.05;
        group.add(base);

        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.24, 0.35, 16),
          goldAccent
        );
        pillar.position.y = 0.25;
        group.add(pillar);

        const orb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18), metalMaterial);
        orb.position.y = 0.48;
        orb.castShadow = true;
        group.add(orb);
        break;
      }
    }

    // Glowing base ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.38, 0.46, 32),
      new THREE.MeshBasicMaterial({ color: tokenColor, side: THREE.DoubleSide })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);

    return group;
  };

  // Helper to create 3D dice with pip dots on faces
  const createDiceCube = (size: number): THREE.Mesh => {
    const materials: THREE.MeshStandardMaterial[] = [];
    const pipFaces = [1, 6, 2, 5, 3, 4]; // 6 cube faces

    pipFaces.forEach((pips) => {
      const faceCanvas = document.createElement('canvas');
      faceCanvas.width = 256;
      faceCanvas.height = 256;
      const fCtx = faceCanvas.getContext('2d')!;

      // Ivory face with subtle vignette
      fCtx.fillStyle = '#faf8f5';
      fCtx.fillRect(0, 0, 256, 256);
      fCtx.strokeStyle = '#d6d3d1';
      fCtx.lineWidth = 10;
      fCtx.strokeRect(5, 5, 246, 246);

      const fDrawPip = (px: number, py: number, red = false) => {
        fCtx.beginPath();
        fCtx.arc(px, py, 20, 0, Math.PI * 2);
        fCtx.fillStyle = red ? '#dc2626' : '#0f172a';
        fCtx.fill();
        fCtx.strokeStyle = 'rgba(0,0,0,0.2)';
        fCtx.lineWidth = 3;
        fCtx.stroke();
      };

      if (pips === 1) fDrawPip(128, 128, true);
      if (pips === 2) {
        fDrawPip(70, 70);
        fDrawPip(186, 186);
      }
      if (pips === 3) {
        fDrawPip(70, 70);
        fDrawPip(128, 128);
        fDrawPip(186, 186);
      }
      if (pips === 4) {
        fDrawPip(70, 70);
        fDrawPip(186, 70);
        fDrawPip(70, 186);
        fDrawPip(186, 186);
      }
      if (pips === 5) {
        fDrawPip(70, 70);
        fDrawPip(186, 70);
        fDrawPip(128, 128);
        fDrawPip(70, 186);
        fDrawPip(186, 186);
      }
      if (pips === 6) {
        fDrawPip(70, 60);
        fDrawPip(70, 128);
        fDrawPip(70, 196);
        fDrawPip(186, 60);
        fDrawPip(186, 128);
        fDrawPip(186, 196);
      }

      const matTex = new THREE.CanvasTexture(faceCanvas);
      matTex.colorSpace = THREE.SRGBColorSpace;
      matTex.anisotropy = 8;
      materials.push(
        new THREE.MeshStandardMaterial({
          map: matTex,
          roughness: 0.25,
          metalness: 0.05,
        })
      );
    });

    const cube = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), materials);
    cube.castShadow = true;
    cube.receiveShadow = true;
    return cube;
  };

  // Main Three.js Scene Setup
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 700;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x151e1a);
    scene.fog = new THREE.FogExp2(0x151e1a, 0.015);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 140);
    camera.position.set(0, 16, 18);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xfff8ed, 1.4);
    scene.add(ambientLight);

    const mainSun = new THREE.DirectionalLight(0xfff1dc, 3.0);
    mainSun.position.set(12, 24, 14);
    mainSun.castShadow = true;
    mainSun.shadow.mapSize.width = 2048;
    mainSun.shadow.mapSize.height = 2048;
    mainSun.shadow.camera.near = 1;
    mainSun.shadow.camera.far = 60;
    mainSun.shadow.camera.left = -15;
    mainSun.shadow.camera.right = 15;
    mainSun.shadow.camera.top = 15;
    mainSun.shadow.camera.bottom = -15;
    mainSun.shadow.bias = -0.0005;
    scene.add(mainSun);

    // Warm gold and sapphire rim lights
    const rimGold = new THREE.PointLight(0xf59e0b, 3.5, 35);
    rimGold.position.set(-14, 10, -14);
    scene.add(rimGold);

    const rimCyan = new THREE.PointLight(0x0284c7, 2.5, 35);
    rimCyan.position.set(14, 10, -14);
    scene.add(rimCyan);

    // 5. Board 3D Construction
    const boardGroup = new THREE.Group();

    // Mahogany Wooden Table Base
    const tableBase = new THREE.Mesh(
      new THREE.BoxGeometry(19.8, 0.8, 19.8),
      new THREE.MeshStandardMaterial({
        color: 0x1f0f04,
        roughness: 0.45,
        metalness: 0.1,
      })
    );
    tableBase.position.y = -0.4;
    tableBase.receiveShadow = true;
    boardGroup.add(tableBase);

    // Brass Corner Inlays on Wooden Base
    const cornerBracketGeo = new THREE.BoxGeometry(1.6, 0.85, 1.6);
    const cornerBracketMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.95,
      roughness: 0.2,
    });
    const cOffsets = [
      [9.2, -0.38, 9.2],
      [-9.2, -0.38, 9.2],
      [9.2, -0.38, -9.2],
      [-9.2, -0.38, -9.2],
    ];
    cOffsets.forEach(([cx, cy, cz]) => {
      const b = new THREE.Mesh(cornerBracketGeo, cornerBracketMat);
      b.position.set(cx, cy, cz);
      boardGroup.add(b);
    });

    // Beveled Gold Inlay Frame
    const goldFrame = new THREE.Mesh(
      new THREE.BoxGeometry(18.5, 0.85, 18.5),
      new THREE.MeshStandardMaterial({
        color: 0xd97706,
        metalness: 0.95,
        roughness: 0.15,
      })
    );
    goldFrame.position.y = -0.38;
    boardGroup.add(goldFrame);

    // Dark Emerald Felt Center (with luxury felt texture & vignette)
    const feltTexture = getFeltTexture();
    const feltCenter = new THREE.Mesh(
      new THREE.BoxGeometry(18.0, 0.86, 18.0),
      new THREE.MeshStandardMaterial({
        map: feltTexture,
        roughness: 0.85,
        metalness: 0.05,
      })
    );
    feltCenter.position.y = -0.36;
    feltCenter.receiveShadow = true;
    boardGroup.add(feltCenter);

    const brass = new THREE.MeshStandardMaterial({ color: 0xbda16c, metalness: 0.8, roughness: 0.32 });
    const stone = new THREE.MeshStandardMaterial({ color: 0xd6cbb7, roughness: 0.65 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x30241c, roughness: 0.55 });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(20.2, 0.22, 20.2), darkWood);
    plinth.position.y = -0.88;
    plinth.castShadow = true;
    boardGroup.add(plinth);
    [-1, 1].forEach(side => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.045, 0.045), brass);
      rail.position.set(0, 0.11, side * 9.12);
      boardGroup.add(rail);
      const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 18.4), brass);
      vertical.position.set(side * 9.12, 0.11, 0);
      boardGroup.add(vertical);
    });
    // A miniature Art Deco skyline at the far edge of the central felt.
    [0.65, 1.05, 1.5, 2.0, 1.5, 1.05, 0.65].forEach((height, index) => {
      const tower = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, height, 0.55), stone);
      body.position.y = height / 2;
      body.castShadow = true;
      tower.add(body);
      const crown = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.38), brass);
      crown.position.y = height + 0.08;
      tower.add(crown);
      for (let floor = 0.22; floor < height - 0.1; floor += 0.25) {
        const windowBand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.065, 0.015), darkWood);
        windowBand.position.set(0, floor, 0.283);
        tower.add(windowBand);
      }
      tower.position.set((index - 3) * 0.7, 0.08, -4.8);
      boardGroup.add(tower);
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial({ color: 0x171e1b, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.05;
    ground.receiveShadow = true;
    scene.add(ground);

    // Center Crest Emblem
    const crestTexture = new THREE.TextureLoader().load(ASSETS.luxuryCrest);
    crestTexture.colorSpace = THREE.SRGBColorSpace;
    const medallion = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 2.8, 0.05, 48),
      new THREE.MeshStandardMaterial({
        map: crestTexture,
        metalness: 0.5,
        roughness: 0.3,
      })
    );
    medallion.position.y = 0.08;
    medallion.receiveShadow = true;
    boardGroup.add(medallion);

    // 3D Chance Card Deck in Center (High standard procedural card materials)
    const chanceMaterials = getCardDeckMaterials('chance');
    const cardDeckChance = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.32, 2.3),
      chanceMaterials
    );
    cardDeckChance.position.set(3.2, 0.18, -3.2);
    cardDeckChance.rotation.y = -Math.PI / 4;
    cardDeckChance.castShadow = true;
    cardDeckChance.receiveShadow = true;
    boardGroup.add(cardDeckChance);

    // 3D Community Chest Card Deck in Center
    const chestMaterials = getCardDeckMaterials('community');
    const cardDeckChest = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.32, 2.3),
      chestMaterials
    );
    cardDeckChest.position.set(-3.2, 0.18, 3.2);
    cardDeckChest.rotation.y = -Math.PI / 4;
    cardDeckChest.castShadow = true;
    cardDeckChest.receiveShadow = true;
    boardGroup.add(cardDeckChest);

    // 6. Build ALL 40 Tiles with High-Resolution Canvas Textures
    const tileMeshes: THREE.Mesh[] = [];
    BOARD_TILES.forEach((tile) => {
      const { x, z, rotation } = getTile3DPosition(tile.id);
      const tileSlab = createBoardTileMesh(tile);
      tileSlab.position.set(x, 0.05, z);
      tileSlab.rotation.y = rotation;
      tileSlab.receiveShadow = true;
      tileSlab.castShadow = true;
      (tileSlab as any).tileData = tile;

      boardGroup.add(tileSlab);
      tileMeshes.push(tileSlab);
    });

    tileMeshesRef.current = tileMeshes;

    // Hover Highlight Frame
    const highlightGeo = new THREE.BoxGeometry(1.3, 0.12, 1.8);
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      wireframe: true,
    });
    const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    highlightMesh.visible = false;
    boardGroup.add(highlightMesh);
    hoverHighlightMeshRef.current = highlightMesh;

    scene.add(boardGroup);

    const marker = new THREE.Group();
    const markerMaterial = new THREE.MeshStandardMaterial({ color: 0xf4cd78, metalness: 0.65, roughness: 0.25, emissive: 0x3b2810, depthTest: false });
    const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.42, 4), markerMaterial);
    pointer.rotation.z = Math.PI;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.32, 12), markerMaterial);
    stem.position.y = 0.34;
    marker.add(pointer, stem);
    marker.traverse(obj => { obj.renderOrder = 20; });
    marker.visible = false;
    scene.add(marker);
    ownMarkerRef.current = marker;

    // 7. 3D Dice Group in Center
    const diceGroup = new THREE.Group();
    const die1 = createDiceCube(0.9);
    const die2 = createDiceCube(0.9);
    die1.position.set(-0.75, 0.55, 0);
    die2.position.set(0.75, 0.55, 0);
    diceGroup.add(die1, die2);
    scene.add(diceGroup);
    diceGroupRef.current = diceGroup;
    diceMeshesRef.current = [die1, die2];

    // 8. Mouse Orbit, Raycasting & Click Handlers
    const handleMouseDown = (e: PointerEvent) => {
      if (liveRef.current.closeup || e.button !== 0) return;
      dragDistanceRef.current = 0;
      container.setPointerCapture(e.pointerId);
      isDraggingRef.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: PointerEvent) => {
      if (liveRef.current.closeup) return;
      // 1. Raycast hovered tile
      const rect = container.getBoundingClientRect();
      mouseCoordsRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseCoordsRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (cameraRef.current && tileMeshesRef.current.length > 0) {
        raycasterRef.current.setFromCamera(mouseCoordsRef.current, cameraRef.current);
        const intersects = raycasterRef.current.intersectObjects(tileMeshesRef.current);
        if (intersects.length > 0) {
          const hitMesh = intersects[0].object as any;
          const tile = hitMesh.tileData as BoardTile;
          if (tile) {
            setHoveredTile(tile);
            if (hoverHighlightMeshRef.current) {
              hoverHighlightMeshRef.current.position.copy(hitMesh.position);
              hoverHighlightMeshRef.current.rotation.copy(hitMesh.rotation);
              hoverHighlightMeshRef.current.visible = true;
            }
          }
        } else {
          setHoveredTile(null);
          if (hoverHighlightMeshRef.current) {
            hoverHighlightMeshRef.current.visible = false;
          }
        }
      }

      // 2. Camera Drag Orbit
      if (!isDraggingRef.current || !cameraRef.current) return;
      const deltaX = e.clientX - previousMousePosition.current.x;
      const deltaY = e.clientY - previousMousePosition.current.y;
      dragDistanceRef.current += Math.abs(deltaX) + Math.abs(deltaY);
      previousMousePosition.current = { x: e.clientX, y: e.clientY };

      const cam = cameraRef.current;
      const offset = cam.position.clone().sub(cameraTargetRef.current);
      const radius = offset.length();

      let theta = Math.atan2(offset.x, offset.z);
      let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius)));

      theta -= deltaX * 0.008;
      phi = Math.max(0.2, Math.min(Math.PI / 2.2, phi - deltaY * 0.008));

      cam.position.x = cameraTargetRef.current.x + radius * Math.sin(phi) * Math.sin(theta);
      cam.position.y = cameraTargetRef.current.y + radius * Math.cos(phi);
      cam.position.z = cameraTargetRef.current.z + radius * Math.sin(phi) * Math.cos(theta);
      cameraPosTargetRef.current.copy(cam.position);
      cam.lookAt(cameraTargetRef.current);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleClick = (e: MouseEvent) => {
      if (liveRef.current.closeup || dragDistanceRef.current > 5 || !cameraRef.current || !onTileClick) return;
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycasterRef.current.setFromCamera(mouse, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(tileMeshesRef.current);
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as any;
        const tile = hitMesh.tileData as BoardTile;
        if (tile) {
          playSound('hop');
          onTileClick(tile);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (liveRef.current.closeup || !cameraRef.current) return;
      const cam = cameraRef.current;
      const dir = cam.position.clone().sub(cameraTargetRef.current).normalize();
      const dist = cam.position.distanceTo(cameraTargetRef.current);
      const newDist = Math.max(8, Math.min(28, dist + e.deltaY * 0.02));
      cameraPosTargetRef.current.copy(cameraTargetRef.current).add(dir.multiplyScalar(newDist));
    };

    container.addEventListener('pointerdown', handleMouseDown);
    container.addEventListener('click', handleClick);
    container.addEventListener('pointermove', handleMouseMove);
    container.addEventListener('pointerup', handleMouseUp);
    container.addEventListener('pointercancel', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    // 9. Resize Handler
    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      cameraRef.current.aspect = w / h;
      cameraRef.current.fov = Math.max(46, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(32)) / (w / h))));
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    // 10. Animation Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    const startTime = performance.now();

    const diceNormals = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(-1, 0, 0)];
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const currentTime = performance.now();
      const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
      const elapsed = (currentTime - startTime) / 1000;
      lastTime = currentTime;

      // The dice remain physical objects on the table. Frame them, then return to the
      // current preset or the user's last orbit without overwriting that view.
      if (cameraRef.current) {
        const camera = cameraRef.current;
        const framing = Math.max(1, 0.85 / camera.aspect);
        const closePosition = new THREE.Vector3(0, 6.6 * framing, 5.6 * framing);
        const targetPosition = liveRef.current.closeup ? closePosition : cameraPosTargetRef.current;
        const lookTarget = liveRef.current.closeup ? new THREE.Vector3(0, 0.65, 0) : cameraTargetRef.current;
        const blend = 1 - Math.exp(-delta * 6);
        const overviewFov = Math.max(46, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(32)) / camera.aspect)));
        camera.fov = THREE.MathUtils.lerp(camera.fov, liveRef.current.closeup ? 40 : overviewFov, blend);
        camera.updateProjectionMatrix();
        camera.position.lerp(targetPosition, blend);
        lookAtRef.current.lerp(lookTarget, blend);
        camera.lookAt(lookAtRef.current);
      }

      // Read current props through a ref; the render loop lives for the whole scene.
      diceMeshesRef.current.forEach((die, index) => {
        const homeX = index === 0 ? -0.75 : 0.75;
        if (liveRef.current.rolling) {
          die.rotation.x += delta * (14 + index * 3);
          die.rotation.z += delta * (18 - index * 2);
          die.position.set(homeX + Math.sin(elapsed * 9 + index) * 0.6, 0.65 + Math.abs(Math.sin(elapsed * 11 + index)) * 1.6, Math.cos(elapsed * 8 + index) * 0.5);
        } else {
          const normal = diceNormals[liveRef.current.dice[index] - 1] || diceNormals[0];
          const target = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 1, 0));
          die.quaternion.slerp(target, 1 - Math.exp(-delta * 18));
          die.position.lerp(new THREE.Vector3(homeX, 0.55, 0), 1 - Math.exp(-delta * 18));
        }
      });

      // Each path includes the starting tile. Always finish at the exact destination.
      tokenAnimationRef.current.forEach((anim, playerId) => {
        const tokenGroup = tokensMapRef.current.get(playerId);
        if (!tokenGroup) return;
        anim.stepProgress = Math.min(1, anim.stepProgress + delta * 1000 / STEP_DURATION);
        const fromPos = getTile3DPosition(anim.path[anim.stepIndex]);
        const toPos = getTile3DPosition(anim.path[anim.stepIndex + 1]);
        tokenGroup.position.set(
          THREE.MathUtils.lerp(fromPos.x, toPos.x, anim.stepProgress),
          0.12 + Math.sin(anim.stepProgress * Math.PI) * 0.5 + (anim.stepIndex === anim.path.length - 2 ? ((tokenGroup.userData.restY || 0.12) - 0.12) * anim.stepProgress : 0),
          THREE.MathUtils.lerp(fromPos.z, toPos.z, anim.stepProgress)
        );
        if (anim.stepProgress >= 1) {
          playSound('hop');
          anim.stepProgress = 0;
          anim.stepIndex++;
          if (anim.stepIndex >= anim.path.length - 1) tokenAnimationRef.current.delete(playerId);
        }
      });
      const ownToken = tokensMapRef.current.get(liveRef.current.localPlayerId);
      if (ownMarkerRef.current) {
        ownMarkerRef.current.visible = Boolean(ownToken?.visible);
        if (ownToken) ownMarkerRef.current.position.set(ownToken.position.x, ownToken.position.y + 1.3 + Math.sin(elapsed * 3) * 0.12, ownToken.position.z);
      }

      // Floating ring rotation
      tokensMapRef.current.forEach((group) => {
        const ring = group.children[group.children.length - 1];
        if (ring) {
          ring.rotation.z = elapsed * 0.8;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('pointerdown', handleMouseDown);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('pointermove', handleMouseMove);
      container.removeEventListener('pointerup', handleMouseUp);
      container.removeEventListener('pointercancel', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      scene.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach(material => material.dispose());
        }
      });
      renderer.dispose();
      tokensMapRef.current.clear();
      tokenAnimationRef.current.clear();
      previousPositionsRef.current = {};
      renderer.domElement.remove();
    };
  }, []);

  // Update Player Tokens and 3D Buildings whenever GameState changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // 1. Synchronize player tokens & trigger hopping
    const currentTokens = tokensMapRef.current;

    gameState.players.forEach((player, idx) => {
      let tokenGroup = currentTokens.get(player.id);
      if (!tokenGroup) {
        tokenGroup = createPlayerTokenMesh(player.token, player.color);
        scene.add(tokenGroup);
        currentTokens.set(player.id, tokenGroup);
      }

      tokenGroup.userData.restY = tokenRestHeight(gameState.players, player.id);
      tokenGroup.visible = !player.bankrupt;
      const prevPos = previousPositionsRef.current[player.id];
      const targetPos = player.position;

      if (prevPos !== undefined && prevPos !== targetPos) {
        const path = movementPath(prevPos, player);
        tokenAnimationRef.current.set(player.id, {
          path,
          stepIndex: 0,
          stepProgress: 0,
        });
      } else if (!tokenAnimationRef.current.has(player.id)) {
        const { x, z } = getTile3DPosition(player.position);
        tokenGroup.position.set(x, tokenGroup.userData.restY, z);
      }

      previousPositionsRef.current[player.id] = player.position;
    });

    // 2. Synchronize 3D Houses / Hotels & Ownership markers
    const toRemove: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if ((obj as any).isBuilding || (obj as any).isOwnerBadge) toRemove.push(obj);
    });
    toRemove.forEach(obj => {
      scene.remove(obj);
      obj.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (Array.isArray(child.material) ? child.material : [child.material]).forEach(material => material.dispose());
        }
      });
    });

    Object.values(gameState.properties).forEach((prop) => {
      const { innerX, innerZ, outerX, outerZ, rotation } = getTileFeaturePositions(prop.tileId);
      const owner = gameState.players.find((p) => p.id === prop.ownerId);

      // Ownership badge on inner curb of the tile (clearly visible towards center felt)
      if (owner) {
        const badgeGroup = new THREE.Group();

        // Golden pedestal
        const pedestal = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.26, 0.06, 16),
          new THREE.MeshStandardMaterial({
            color: 0xd97706,
            metalness: 0.95,
            roughness: 0.2,
          })
        );
        badgeGroup.add(pedestal);

        // Glowing gem in player's color
        const gem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.18, 0.08, 16),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(owner.color),
            metalness: 0.8,
            roughness: 0.15,
            emissive: new THREE.Color(owner.color),
            emissiveIntensity: 0.3,
          })
        );
        gem.position.y = 0.06;
        badgeGroup.add(gem);

        badgeGroup.position.set(innerX, 0.08, innerZ);
        badgeGroup.rotation.y = rotation;
        (badgeGroup as any).isOwnerBadge = true;
        scene.add(badgeGroup);
      }

      if (prop.houses <= 0) return;

      // Place houses / hotel on the color bar (outer rim of the tile)
      if (prop.houses === 5) {
        // Red Hotel
        const hotelGroup = new THREE.Group();
        const hotelBody = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.32, 0.32),
          new THREE.MeshStandardMaterial({
            color: 0xdc2626,
            roughness: 0.2,
            metalness: 0.2,
          })
        );
        hotelBody.position.y = 0.2;
        hotelBody.castShadow = true;
        hotelGroup.add(hotelBody);

        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(0.35, 0.18, 4),
          new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.3 })
        );
        roof.rotation.y = Math.PI / 4;
        roof.position.y = 0.44;
        hotelGroup.add(roof);

        hotelGroup.position.set(outerX, 0.06, outerZ);
        hotelGroup.rotation.y = rotation;
        (hotelGroup as any).isBuilding = true;
        scene.add(hotelGroup);
      } else {
        // 1 to 4 Green Houses
        for (let i = 0; i < prop.houses; i++) {
          const houseGroup = new THREE.Group();
          const houseBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.18, 0.2),
            new THREE.MeshStandardMaterial({
              color: 0x16a34a,
              roughness: 0.3,
              metalness: 0.1,
            })
          );
          houseBody.position.y = 0.14;
          houseBody.castShadow = true;
          houseGroup.add(houseBody);

          const roof = new THREE.Mesh(
            new THREE.ConeGeometry(0.16, 0.12, 4),
            new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.3 })
          );
          roof.rotation.y = Math.PI / 4;
          roof.position.y = 0.28;
          houseGroup.add(roof);

          // Spread houses across the tile width
          const offsetSpan = (i - (prop.houses - 1) / 2) * 0.24;
          const isHorizontal = (prop.tileId > 0 && prop.tileId < 10) || (prop.tileId > 20 && prop.tileId < 30);

          const posX = isHorizontal ? outerX + offsetSpan : outerX;
          const posZ = isHorizontal ? outerZ : outerZ + offsetSpan;

          houseGroup.position.set(posX, 0.06, posZ);
          houseGroup.rotation.y = rotation;
          (houseGroup as any).isBuilding = true;
          scene.add(houseGroup);
        }
      }
    });

  }, [gameState]);

  const focusedPosition = gameState.players[gameState.activePlayerIndex]?.position;
  useEffect(() => {
    if (cameraMode === 'angled') {
      cameraPosTargetRef.current.set(0, 16, 17);
      cameraTargetRef.current.set(0, 0, 0);
    } else if (cameraMode === 'top') {
      cameraPosTargetRef.current.set(0, 24, 0.1);
      cameraTargetRef.current.set(0, 0, 0);
    } else if (focusedPosition !== undefined) {
      const { x, z } = getTile3DPosition(focusedPosition);
      cameraTargetRef.current.set(x, 0.5, z);
      cameraPosTargetRef.current.set(x, 7, z + 7);
    }
  }, [cameraMode, cameraMode === 'focus' ? focusedPosition : null]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-stone-950 to-slate-950 shadow-2xl border-2 border-amber-900/40">
      {/* 3D Canvas Mount */}
      <div ref={mountRef} className="w-full h-full touch-none cursor-grab active:cursor-grabbing" />

      <div className="board-toolbar" role="group" aria-label="Kameraansicht">
        {([
          ['angled', Camera, 'Perspektive'],
          ['top', ScanLine, 'Draufsicht'],
          ['focus', LocateFixed, 'Am Zug'],
        ] as const).map(([mode, Icon, label]) => (
          <button key={mode} onClick={() => setCameraMode(mode)} disabled={isDiceCloseup} aria-pressed={cameraMode === mode} title={label}>
            <Icon size={15} strokeWidth={1.6} /><span>{label}</span>
          </button>
        ))}
        <button title="Ansicht zurücksetzen" aria-label="Ansicht zurücksetzen" disabled={isDiceCloseup} onClick={() => {
          if (cameraMode === 'angled') {
            cameraPosTargetRef.current.set(0, 16, 17);
            cameraTargetRef.current.set(0, 0, 0);
          } else if (cameraMode === 'top') {
            cameraPosTargetRef.current.set(0, 24, 0.1);
            cameraTargetRef.current.set(0, 0, 0);
          } else {
            const player = gameState.players[gameState.activePlayerIndex];
            if (player) {
              const { x, z } = getTile3DPosition(player.position);
              cameraTargetRef.current.set(x, 0.5, z);
              cameraPosTargetRef.current.set(x, 7, z + 7);
            }
          }
        }}><RotateCcw size={14} /></button>
      </div>

      {hoveredTile && !isDiceCloseup && (
        <div className="board-inspector pointer-events-none">
          <span className="text-[9px] uppercase tracking-[0.18em] text-stone-400">Grundstück ansehen</span>
          <span className="text-xs text-stone-100">{hoveredTile.name}</span>
          {hoveredTile.price && <span className="text-xs font-mono text-amber-200">${hoveredTile.price}</span>}
        </div>
      )}

      <div className="board-caption pointer-events-none" role="status" aria-live="polite">
        {isDiceCloseup ? <>
          <Dices size={16} className="text-amber-200" />
          <span>{isRolling ? 'Würfel werden geworfen' : `${(diceValues || gameState.dice)[0]} + ${(diceValues || gameState.dice)[1]} · ${(diceValues || gameState.dice).reduce((sum, n) => sum + n, 0)} Felder`}</span>
        </> : <>
          <LocateFixed size={15} className="text-amber-200" />
          <span>Deine Figur <span className="text-stone-500 mx-1">/</span> {BOARD_TILES[gameState.players.find(p => p.id === localPlayerId)?.position ?? 0]?.name}</span>
        </>}
      </div>
      {!isDiceCloseup && <div className="board-navigation-hint pointer-events-none"><Move size={12} /> Ziehen zum Drehen <span>·</span> Scrollen zum Zoomen</div>}
    </div>
  );
};
