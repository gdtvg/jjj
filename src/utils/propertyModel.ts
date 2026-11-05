import * as THREE from 'three';
import type { BoardTile, PropertyState } from '../types/game';
import { getTileTexture } from './tileTextureGenerator';

export const PROPERTY_COLORS: Record<string, string> = {
  brown: '#8b573b', lightblue: '#77b7c5', pink: '#bc6685', orange: '#c88742',
  red: '#b94b47', yellow: '#d4ba57', green: '#4f886b', darkblue: '#42618f',
  railroad: '#687b83', utility: '#819b8b',
};

/** Shared geometry and materials for the board and all property previews.
 * Tile textures are cached and owned by tileTextureGenerator, not the viewer. */
export function createBoardTileMesh(tile: BoardTile): THREE.Mesh {
  const corner = tile.id % 10 === 0;
  const side = new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.35, metalness: 0.05 });
  const top = new THREE.MeshStandardMaterial({ map: getTileTexture(tile), roughness: 0.3, metalness: 0.05 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(corner ? 1.85 : 1.25, 0.1, corner ? 1.85 : 1.75), [side, side, top, side, side, side]);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.tileData = tile;
  return mesh;
}

export function createPropertyModel(tile: BoardTile, property?: PropertyState): THREE.Group {
  const group = new THREE.Group();
  const slab = createBoardTileMesh(tile);
  slab.position.y = 0.05;
  group.add(slab);
  const houses = property?.houses || 0;
  for (let i = 0; i < (houses === 5 ? 1 : houses); i++) {
    const hotel = houses === 5;
    const building = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(hotel ? 0.55 : 0.2, hotel ? 0.32 : 0.18, hotel ? 0.32 : 0.2), new THREE.MeshStandardMaterial({ color: hotel ? 0xdc2626 : 0x16a34a, roughness: hotel ? 0.2 : 0.3, metalness: hotel ? 0.2 : 0.1 }));
    body.position.y = hotel ? 0.2 : 0.14;
    body.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(hotel ? 0.35 : 0.16, hotel ? 0.18 : 0.12, 4), new THREE.MeshStandardMaterial({ color: hotel ? 0x991b1b : 0x14532d, roughness: 0.3 }));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = hotel ? 0.44 : 0.28;
    building.add(body, roof);
    building.position.set(hotel ? 0 : (i - (houses - 1) / 2) * 0.24, 0.06, 0.55);
    group.add(building);
  }
  return group;
}
