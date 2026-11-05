import * as THREE from 'three';
import type { BoardTile } from '../types/game';

export const PROPERTY_COLORS: Record<string, string> = {
  brown: '#8b573b', lightblue: '#77b7c5', pink: '#bc6685', orange: '#c88742',
  red: '#b94b47', yellow: '#d4ba57', green: '#4f886b', darkblue: '#42618f',
  railroad: '#687b83', utility: '#819b8b',
};

export function createPropertyModel(tile: BoardTile): THREE.Group {
  const group = new THREE.Group();
  const trim = new THREE.MeshStandardMaterial({ color: PROPERTY_COLORS[tile.color || 'utility'], roughness: 0.6 });
  const stone = new THREE.MeshStandardMaterial({ color: '#ded2b8', roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: '#283d3c', metalness: 0.25, roughness: 0.5 });
  const brass = new THREE.MeshStandardMaterial({ color: '#bfa269', metalness: 0.65, roughness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({ color: '#adc8c2', metalness: 0.45, roughness: 0.2 });
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; group.add(object);
    return object;
  };
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  box(5.2, 0.24, 4.3, dark, 0, 0, 0);
  box(5.1, 0.07, 4.2, brass, 0, 0.15, 0);
  box(4.95, 0.12, 4.05, stone, 0, 0.23, 0);
  box(4.8, 0.03, 0.7, dark, 0, 0.31, 1.58);

  if (tile.type === 'railroad') {
    box(3.1, 1.25, 1.4, stone, 0, 0.94, -0.65);
    box(3.4, 0.18, 1.7, trim, 0, 1.65, -0.65);
    box(0.75, 0.45, 0.8, trim, 0, 1.96, -0.65);
    mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 24), brass, 0, 2, -0.22).rotation.x = Math.PI / 2;
    [-1, -0.5, 0.5, 1].forEach(x => box(0.22, 0.5, 0.04, glass, x, 1.05, 0.07));
    [-0.4, 0.1].forEach(z => box(4.6, 0.08, 0.06, brass, 0, 0.4, z + 0.7));
    for (let x = -2.1; x <= 2.1; x += 0.35) box(0.12, 0.06, 0.85, dark, x, 0.35, 0.55);
    box(1.8, 0.5, 0.5, trim, 0.4, 0.72, 0.55);
    box(0.65, 0.32, 0.48, dark, 0.95, 1.12, 0.55);
    [-0.2, 0.95].forEach(x => [-1, 1].forEach(side => {
      const wheel = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.07, 16), dark, x, 0.47, 0.55 + side * 0.27);
      wheel.rotation.x = Math.PI / 2;
    }));
  } else if (tile.type === 'utility') {
    box(1.8, 1.1, 1.6, stone, -0.95, 0.86, -0.3);
    box(2, 0.15, 1.8, trim, -0.95, 1.48, -0.3);
    [-1.35, -0.65].forEach(x => box(0.28, 0.45, 0.04, glass, x, 0.98, 0.52));
    if (tile.id === 28) {
      [-1, 1].forEach(x => [-1, 1].forEach(z => box(0.1, 1.5, 0.1, dark, 1 + x * 0.44, 1.06, z * 0.44)));
      mesh(new THREE.CylinderGeometry(0.73, 0.73, 0.85, 32), trim, 1, 2.05, 0);
      mesh(new THREE.ConeGeometry(0.8, 0.4, 32), brass, 1, 2.67, 0);
      const pipe = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 12), brass, 1.65, 1.05, 0);
      pipe.castShadow = true;
    } else {
      [0.55, 1.3].forEach((x, i) => {
        mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.8 + i * 0.35, 20), trim, x, 1.2 + i * 0.175, -0.4);
        mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 20), brass, x, 2.15 + i * 0.35, -0.4);
      });
      box(1.2, 0.4, 0.8, dark, 0.8, 0.53, 0.7);
    }
  } else {
    const floors = (tile.price || 0) >= 260 ? 3 : (tile.price || 0) >= 140 ? 2 : 1;
    const height = floors * 0.62 + 0.45;
    box(2.7, height, 1.85, stone, 0, 0.31 + height / 2, -0.22);
    for (let floor = 0; floor < floors; floor++) {
      [-0.86, 0, 0.86].forEach(x => {
        box(0.45, 0.42, 0.06, trim, x, 0.78 + floor * 0.62, 0.74);
        box(0.31, 0.3, 0.075, glass, x, 0.78 + floor * 0.62, 0.78);
      });
      box(2.8, 0.07, 1.96, brass, 0, 0.4 + (floor + 1) * 0.62, -0.22);
    }
    box(0.46, 0.68, 0.08, dark, 0, 0.64, 0.82);
    const roof = mesh(new THREE.ConeGeometry(1, 0.85, 4), trim, 0, height + 0.72, -0.22);
    roof.rotation.y = Math.PI / 4; roof.scale.set(2.15, 1, 1.55);
    box(0.25, 0.6, 0.26, dark, 0.85, height + 0.95, -0.48);
    box(0.75, 0.09, 0.3, stone, 0, 0.36, 1);
  }
  if (tile.type !== 'railroad') {
    [-2, 2].forEach(x => {
      mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.7, 12), dark, x, 0.64, -1.1);
      mesh(new THREE.SphereGeometry(0.35, 16, 12), trim, x, 1.15, -1.1);
    });
  }
  return group;
}
