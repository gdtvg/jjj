import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { BOARD_TILES } from '../data/monopolyBoard';
import { BoardTile, GameState, PlayerToken } from '../types/game';
import { getTileTexture, getCardDeckMaterials, getFeltTexture } from '../utils/tileTextureGenerator';
import { ASSETS } from '../assets/assetMap';
import { playSound } from '../utils/sound';

interface ThreeBoardSceneProps {
  gameState: GameState;
  onTileClick?: (tile: BoardTile) => void;
  canRoll?: boolean;
  onRollClick?: () => void;
  isRolling?: boolean;
}

export const ThreeBoardScene: React.FC<ThreeBoardSceneProps> = ({
  gameState,
  onTileClick,
  canRoll,
  onRollClick,
  isRolling,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [cameraMode, setCameraMode] = useState<'angled' | 'top' | 'focus'>('angled');
  const [hoveredTile, setHoveredTile] = useState<BoardTile | null>(null);

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
  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const cameraPosTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 16, 17));
  const tileMeshesRef = useRef<THREE.Mesh[]>([]);
  const hoverHighlightMeshRef = useRef<THREE.Mesh | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseCoordsRef = useRef(new THREE.Vector2());

  // Helper to map tile index 0-39 to 3D board coordinates (x, z)
  const getTile3DPosition = (tileId: number): { x: number; z: number; rotation: number } => {
    const half = 7.5;
    const cornerSize = 1.9;
    const step = 1.35;

    // Corners
    if (tileId === 0) return { x: half, z: half, rotation: -Math.PI / 4 }; // GO (facing camera and center)
    if (tileId === 10) return { x: -half, z: half, rotation: Math.PI / 4 }; // JAIL
    if (tileId === 20) return { x: -half, z: -half, rotation: -Math.PI / 4 }; // FREE PARKING
    if (tileId === 30) return { x: half, z: -half, rotation: (-3 * Math.PI) / 4 }; // GO TO JAIL

    // Bottom side: 1 to 9 (from GO towards JAIL)
    // Rotation = 0 ensures all text and graphics are 100% upright to the camera!
    if (tileId > 0 && tileId < 10) {
      const x = half - cornerSize - (tileId - 0.5) * step;
      return { x, z: half, rotation: 0 };
    }

    // Left side: 11 to 19 (from JAIL towards FREE PARKING)
    if (tileId > 10 && tileId < 20) {
      const z = half - cornerSize - (tileId - 10 - 0.5) * step;
      return { x: -half, z, rotation: -Math.PI / 2 };
    }

    // Top side: 21 to 29 (from FREE PARKING towards GO TO JAIL)
    if (tileId > 20 && tileId < 30) {
      const x = -half + cornerSize + (tileId - 20 - 0.5) * step;
      return { x, z: -half, rotation: 0 };
    }

    // Right side: 31 to 39 (from GO TO JAIL towards GO)
    const z = -half + cornerSize + (tileId - 30 - 0.5) * step;
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
    scene.background = new THREE.Color(0x060912);
    scene.fog = new THREE.FogExp2(0x060912, 0.015);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
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
    const sideTileMat = new THREE.MeshStandardMaterial({
      color: 0xf5f5f4,
      roughness: 0.35,
      metalness: 0.05,
    });

    BOARD_TILES.forEach((tile) => {
      const { x, z, rotation } = getTile3DPosition(tile.id);
      const isCorner = tile.id % 10 === 0;
      const tileWidth = isCorner ? 1.85 : 1.25;
      const tileDepth = isCorner ? 1.85 : 1.75;

      const topTexture = getTileTexture(tile);
      const topTileMat = new THREE.MeshStandardMaterial({
        map: topTexture,
        roughness: 0.3,
        metalness: 0.05,
      });

      // Materials array for BoxGeometry faces: [+x, -x, +y (top), -y (bottom), +z, -z]
      const tileMaterials = [
        sideTileMat,
        sideTileMat,
        topTileMat,
        sideTileMat,
        sideTileMat,
        sideTileMat,
      ];

      const tileSlab = new THREE.Mesh(
        new THREE.BoxGeometry(tileWidth, 0.1, tileDepth),
        tileMaterials
      );
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
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
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
      cam.lookAt(cameraTargetRef.current);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleClick = (e: MouseEvent) => {
      if (!cameraRef.current || !onTileClick) return;
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
      if (!cameraRef.current) return;
      const cam = cameraRef.current;
      const dir = cam.position.clone().sub(cameraTargetRef.current).normalize();
      const dist = cam.position.distanceTo(cameraTargetRef.current);
      const newDist = Math.max(8, Math.min(28, dist + e.deltaY * 0.02));
      cam.position.copy(cameraTargetRef.current).add(dir.multiplyScalar(newDist));
    };

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('click', handleClick);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    // 9. Resize Handler
    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 10. Animation Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    const startTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const currentTime = performance.now();
      const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
      const elapsed = (currentTime - startTime) / 1000;
      lastTime = currentTime;

      // Smooth camera interpolation
      if (cameraRef.current) {
        cameraRef.current.position.lerp(cameraPosTargetRef.current, 0.04);
        cameraRef.current.lookAt(cameraTargetRef.current);
      }

      // Dice rolling animation
      if (diceMeshesRef.current.length === 2) {
        if (isRolling) {
          diceMeshesRef.current[0].rotation.x += delta * 15;
          diceMeshesRef.current[0].rotation.y += delta * 18;
          diceMeshesRef.current[0].position.y = 0.55 + Math.abs(Math.sin(elapsed * 12)) * 0.8;

          diceMeshesRef.current[1].rotation.x += delta * 14;
          diceMeshesRef.current[1].rotation.z += delta * 19;
          diceMeshesRef.current[1].position.y = 0.55 + Math.abs(Math.cos(elapsed * 12)) * 0.8;
        } else {
          diceMeshesRef.current[0].position.y = THREE.MathUtils.lerp(
            diceMeshesRef.current[0].position.y,
            0.55,
            0.15
          );
          diceMeshesRef.current[1].position.y = THREE.MathUtils.lerp(
            diceMeshesRef.current[1].position.y,
            0.55,
            0.15
          );
        }
      }

      // Animate player token hopping sequences
      tokenAnimationRef.current.forEach((anim, playerId) => {
        const tokenGroup = tokensMapRef.current.get(playerId);
        if (!tokenGroup) return;

        anim.stepProgress += delta * 6; // Speed of each hop
        if (anim.stepProgress >= 1) {
          anim.stepProgress = 0;
          anim.stepIndex++;
          playSound('hop');
          if (anim.stepIndex >= anim.path.length) {
            tokenAnimationRef.current.delete(playerId);
            return;
          }
        }

        const fromTileId = anim.stepIndex === 0 ? anim.path[0] : anim.path[anim.stepIndex - 1];
        const toTileId = anim.path[anim.stepIndex];

        const fromPos = getTile3DPosition(fromTileId);
        const toPos = getTile3DPosition(toTileId);

        const curX = THREE.MathUtils.lerp(fromPos.x, toPos.x, anim.stepProgress);
        const curZ = THREE.MathUtils.lerp(fromPos.z, toPos.z, anim.stepProgress);
        const curY = 0.12 + Math.sin(anim.stepProgress * Math.PI) * 0.6; // parabolic bounce

        tokenGroup.position.set(curX, curY, curZ);
      });

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
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('click', handleClick);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
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

      const prevPos = previousPositionsRef.current[player.id];
      const targetPos = player.position;

      if (prevPos !== undefined && prevPos !== targetPos) {
        // Calculate stepping path
        const path: number[] = [];
        let curr = prevPos;
        while (curr !== targetPos) {
          curr = (curr + 1) % 40;
          path.push(curr);
          if (path.length > 40) break;
        }
        tokenAnimationRef.current.set(player.id, {
          path,
          stepIndex: 0,
          stepProgress: 0,
        });
      } else if (!tokenAnimationRef.current.has(player.id)) {
        const { x, z } = getTile3DPosition(player.position);
        const offsetAngle = (idx * Math.PI * 2) / Math.max(1, gameState.players.length);
        const offsetX = Math.cos(offsetAngle) * 0.35;
        const offsetZ = Math.sin(offsetAngle) * 0.35;

        tokenGroup.position.x = x + offsetX;
        tokenGroup.position.z = z + offsetZ;
        tokenGroup.position.y = player.bankrupt ? -5 : 0.12;
      }

      previousPositionsRef.current[player.id] = player.position;
    });

    // 2. Synchronize 3D Houses / Hotels & Ownership markers
    const toRemove: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if ((obj as any).isBuilding || (obj as any).isOwnerBadge) toRemove.push(obj);
    });
    toRemove.forEach((obj) => scene.remove(obj));

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

    // 3. Camera Focus presets
    if (cameraMode === 'angled') {
      cameraPosTargetRef.current.set(0, 16, 17);
      cameraTargetRef.current.set(0, 0, 0);
    } else if (cameraMode === 'top') {
      cameraPosTargetRef.current.set(0, 24, 0.1);
      cameraTargetRef.current.set(0, 0, 0);
    } else if (cameraMode === 'focus') {
      const activePlayer = gameState.players[gameState.activePlayerIndex];
      if (activePlayer) {
        const { x, z } = getTile3DPosition(activePlayer.position);
        cameraTargetRef.current.set(x, 0.5, z);
        cameraPosTargetRef.current.set(x, 7, z + 7);
      }
    }
  }, [gameState, cameraMode]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-stone-950 to-slate-950 shadow-2xl border-2 border-amber-900/40">
      {/* 3D Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D Camera Controls */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/70 backdrop-blur-md p-1 rounded-xl border border-amber-500/30 text-xs">
        <button
          onClick={() => setCameraMode('angled')}
          className={`cursor-pointer px-3 py-1.5 rounded-lg font-bold transition-all ${
            cameraMode === 'angled'
              ? 'bg-amber-400 text-slate-950 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          🎥 3D Orbit
        </button>
        <button
          onClick={() => setCameraMode('top')}
          className={`cursor-pointer px-3 py-1.5 rounded-lg font-bold transition-all ${
            cameraMode === 'top'
              ? 'bg-amber-400 text-slate-950 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          📐 Top-Down
        </button>
        <button
          onClick={() => setCameraMode('focus')}
          className={`cursor-pointer px-3 py-1.5 rounded-lg font-bold transition-all ${
            cameraMode === 'focus'
              ? 'bg-amber-400 text-slate-950 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          🎯 Focus Player
        </button>
      </div>

      {/* Hovered Tile Preview Pill */}
      {hoveredTile && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-amber-500/40 shadow-lg pointer-events-none">
          <span className="font-bold text-white text-xs">{hoveredTile.name}</span>
          {hoveredTile.price && (
            <span className="text-amber-400 font-mono font-bold text-xs">${hoveredTile.price}</span>
          )}
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
            (Click to inspect deed)
          </span>
        </div>
      )}

      {/* Floating 3D Roll Dice Trigger button (top center, unobtrusive) */}
      {canRoll && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={onRollClick}
            disabled={isRolling}
            className="cursor-pointer px-6 py-2 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.7)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-amber-300/40"
          >
            <span className="text-base">🎲</span>
            <span>{isRolling ? 'ROLLING...' : 'ROLL 3D DICE'}</span>
          </button>
        </div>
      )}

      {/* Quick Navigation Help Note */}
      <div className="absolute bottom-2 right-3 text-[10px] text-slate-400/80 bg-black/50 backdrop-blur-xs px-2.5 py-1 rounded-lg pointer-events-none border border-white/5">
        🖱️ Click & drag to rotate 3D view · Scroll to zoom · Click any tile to inspect
      </div>
    </div>
  );
};
