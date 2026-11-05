import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCw } from 'lucide-react';
import type { BoardTile, PropertyState } from '../types/game';
import { createPropertyModel } from '../utils/propertyModel';

export function PropertyModel({ tile, property }: { tile: BoardTile; property?: PropertyState }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setUnavailable(true); return; }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
    const model = createPropertyModel(tile, property);
    model.rotation.y = -0.35;
    scene.add(model);
    scene.add(new THREE.HemisphereLight(0xfff5dc, 0x334f45, 2.8));
    const sun = new THREE.DirectionalLight(0xffe4b5, 4);
    sun.position.set(4, 8, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -5; sun.shadow.camera.right = 5;
    sun.shadow.camera.top = 5; sun.shadow.camera.bottom = -5;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xb9dfd3, 2); fill.position.set(-4, 3, -3); scene.add(fill);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.22 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.15; ground.receiveShadow = true; scene.add(ground);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);
    const resize = () => {
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      const framing = Math.max(1, 0.95 / camera.aspect);
      camera.position.set(1.9 * framing, 3.4 * framing, 3.2 * framing); camera.lookAt(0, 0.05, 0);
      camera.updateProjectionMatrix(); renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    let dragging = false, lastX = 0, frame = 0, lastTime = performance.now();
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const down = (event: PointerEvent) => { dragging = true; lastX = event.clientX; host.setPointerCapture(event.pointerId); };
    const move = (event: PointerEvent) => { if (dragging) { model.rotation.y += (event.clientX - lastX) * 0.012; lastX = event.clientX; } };
    const up = () => { dragging = false; };
    const lost = (event: Event) => { event.preventDefault(); setUnavailable(true); };
    host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
    renderer.domElement.addEventListener('webglcontextlost', lost);
    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min((now - lastTime) / 1000, 0.05); lastTime = now;
      if (!dragging && !reducedMotion) model.rotation.y += delta * 0.12;
      if (!document.hidden) renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', up);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      const materials = new Set<THREE.Material>();
      scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material)); } });
      materials.forEach(material => material.dispose()); sun.shadow.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, [tile.id, property?.houses]);
  return <div className="purchase-model-area">
    <div ref={hostRef} role="img" aria-label={`Drehbares 3D-Modell: ${tile.name}`} className="purchase-model-canvas" />
    {unavailable ? <p className="purchase-model-note">Die 3D-Vorschau ist auf diesem Gerät nicht verfügbar. Die Grundstücksdetails bleiben verfügbar.</p> : <span className="purchase-model-hint"><RotateCw size={13} /> Ziehen zum Drehen · Originales Brettfeld</span>}
  </div>;
}

