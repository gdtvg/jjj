import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Banknote, RotateCw, X } from 'lucide-react';
import type { BoardTile } from '../types/game';
import { createPropertyModel, PROPERTY_COLORS } from '../utils/propertyModel';

function PropertyModel({ tile }: { tile: BoardTile }) {
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
    const model = createPropertyModel(tile);
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
      camera.position.set(7 * framing, 5.2 * framing, 8 * framing); camera.lookAt(0, 0.9, 0);
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
  }, [tile.id]);
  return <div className="purchase-model-area">
    <div ref={hostRef} role="img" aria-label={`Drehbares 3D-Modell: ${tile.name}`} className="purchase-model-canvas" />
    {unavailable ? <p className="purchase-model-note">Die 3D-Vorschau ist auf diesem Gerät nicht verfügbar. Alle Kaufdetails stehen unten.</p> : <span className="purchase-model-hint"><RotateCw size={13} /> Ziehen zum Drehen · Modellvorschau</span>}
  </div>;
}

interface Props {
  tile: BoardTile;
  cash: number;
  onClose: () => void;
  onBuy: () => Promise<boolean>;
  onDecline: () => Promise<boolean>;
}
export function PropertyPurchase({ tile, cash, onClose, onBuy, onDecline }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const affordable = cash >= (tile.price || 0);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  const act = async (action: () => Promise<boolean>) => {
    if (pending) return;
    setPending(true); setError(false);
    try { if (!await action()) setError(true); }
    catch { setError(true); }
    finally { setPending(false); }
  };
  return <div className="purchase-overlay" onKeyDown={event => {
    if (event.key === 'Escape' && !pending) { event.stopPropagation(); onClose(); }
    if (event.key === 'Tab') {
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <div ref={dialogRef} className="purchase-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-title" aria-describedby="purchase-description" tabIndex={-1} style={{ '--property-color': PROPERTY_COLORS[tile.color || 'utility'] } as React.CSSProperties}>
      <header className="purchase-heading"><div><span className="purchase-eyebrow">Zum Verkauf</span><h2 id="purchase-title">{tile.name}</h2></div><button aria-label="Vorschau schließen" disabled={pending} onClick={onClose}><X size={19} /></button></header>
      <PropertyModel tile={tile} />
      <div className="purchase-details">
        <p id="purchase-description">{tile.type === 'street' ? 'Erweitere deinen Besitz mit diesem Grundstück.' : tile.type === 'railroad' ? 'Sichere dir diesen Bahnhof für dein Streckennetz.' : 'Ergänze dein Portfolio um dieses Versorgungswerk.'}</p>
        <dl className="purchase-facts"><div><dt>Kaufpreis</dt><dd>${tile.price?.toLocaleString()}</dd></div><div><dt>Dein Bargeld</dt><dd>${cash.toLocaleString()}</dd></div><div><dt>Nach dem Kauf</dt><dd>{affordable ? `$${(cash - (tile.price || 0)).toLocaleString()}` : 'Nicht ausreichend'}</dd></div></dl>
        {tile.type === 'street' && <p className="purchase-rent">Grundmiete: ${tile.rent?.[0]} · Hausbau: ${tile.houseCost} je Haus</p>}
        {tile.type === 'railroad' && <p className="purchase-rent">Miete mit einem Bahnhof: ${tile.rent?.[0]}. Weitere Bahnhöfe erhöhen die Miete.</p>}
        {tile.type === 'utility' && <p className="purchase-rent">Miete: 4 × Würfelsumme; mit beiden Werken 10 × Würfelsumme.</p>}
        {error && <p role="alert" className="purchase-error">Die Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.</p>}
        {!affordable && <p className="purchase-error">Dir fehlen ${(Math.max(0, (tile.price || 0) - cash)).toLocaleString()} für den Kauf.</p>}
      </div>
      <footer className="purchase-actions"><button disabled={pending} onClick={() => act(onDecline)}>Verzichten</button><button className="purchase-buy" disabled={pending || !affordable} onClick={() => act(onBuy)}><Banknote size={17} />{pending ? 'Wird verarbeitet …' : `Kaufen · $${tile.price}`}</button></footer>
    </div>
  </div>;
}
