import * as THREE from 'three';

/**
 * Shared procedural visuals: glow sprite texture, grid floor texture,
 * cached particle geometries. Everything is generated on a canvas —
 * zero image downloads, zero CORS concerns in the sandbox.
 */

let glowTexture = null;
export function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

export function makeGlowSprite(color, scale, opacity = 0.85) {
  const mat = new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(scale);
  return sprite;
}

export function makeGridTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#05060f';
  g.fillRect(0, 0, S, S);

  // minor grid
  g.strokeStyle = 'rgba(0,240,255,0.10)';
  g.lineWidth = 1.5;
  for (let i = 0; i <= S; i += 64) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke();
  }
  // major grid
  g.strokeStyle = 'rgba(0,240,255,0.28)';
  g.lineWidth = 2.5;
  for (let i = 0; i <= S; i += 256) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke();
  }
  // center emblem glow
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, 220);
  grad.addColorStop(0, 'rgba(255,45,149,0.16)');
  grad.addColorStop(1, 'rgba(255,45,149,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* Cached particle geometries (shared, never disposed per-particle) */
const geoCache = {};

/**
 * Dispose a view's materials (and optionally per-entity geometries).
 * Sprite geometry is shared by three.js — never disposed here.
 */
export function disposeView(obj, geometry = true) {
  if (!obj) return;
  obj.traverse((c) => {
    if (geometry && c.isMesh && c.geometry) c.geometry.dispose();
    if (c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach((m) => m.dispose());
    }
  });
}
export function particleGeometry(kind) {
  if (geoCache[kind]) return geoCache[kind];
  let geo;
  switch (kind) {
    case 'shard': geo = new THREE.TetrahedronGeometry(0.18); break;
    case 'shardBig': geo = new THREE.TetrahedronGeometry(0.3); break;
    case 'spark': geo = new THREE.BoxGeometry(0.07, 0.07, 0.22); break;
    case 'ring': geo = new THREE.TorusGeometry(0.5, 0.045, 6, 40); break;
    case 'ghost': geo = new THREE.ConeGeometry(0.42, 1.15, 4); break;
    default: geo = new THREE.TetrahedronGeometry(0.15);
  }
  geoCache[kind] = geo;
  return geo;
}