// src/render/fx.js — 粒子池：漂移烟 / 氮气尾焰 / 撞车火花。
import * as THREE from 'three';

export function createFX(scene) {
  const PMAX = 320;
  const pPos = new Float32Array(PMAX * 3);
  const pCol = new Float32Array(PMAX * 3);
  const pLife = new Float32Array(PMAX);
  const pVel = new Float32Array(PMAX * 3);
  for (let i = 0; i < PMAX; i++) { pLife[i] = 0; pPos[i * 3 + 1] = -999; }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));

  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.45, 'rgba(255,255,255,.55)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);

  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 2.2, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.NormalBlending, vertexColors: true,
    sizeAttenuation: true, toneMapped: true,
  }));
  points.frustumCulled = false;
  scene.add(points);

  let pIdx = 0;
  function spawn(x, y, z, color, opts = {}) {
    const i = pIdx = (pIdx + 1) % PMAX;
    const { spread = 1.2, life = 0.7, vy = 0.6 } = opts;
    const cc = color instanceof THREE.Color ? color : new THREE.Color(color);
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
    pCol[i * 3] = cc.r; pCol[i * 3 + 1] = cc.g; pCol[i * 3 + 2] = cc.b;
    pVel[i * 3] = (Math.random() - 0.5) * spread;
    pVel[i * 3 + 1] = vy + Math.random() * 1.4;
    pVel[i * 3 + 2] = (Math.random() - 0.5) * spread;
    pLife[i] = life * (0.7 + Math.random() * 0.6);
  }
  function burst(x, y, z, color, n = 18, spread = 5, life = 0.6) {
    for (let k = 0; k < n; k++) spawn(x, y, z, color, { spread, life, vy: 2 + Math.random() * 3 });
  }
  function tick(dt) {
    for (let i = 0; i < PMAX; i++) {
      if (pLife[i] <= 0) continue;
      pLife[i] -= dt;
      pPos[i * 3] += pVel[i * 3] * dt;
      pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
      pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      pVel[i * 3 + 1] -= 1.2 * dt;
      if (pLife[i] <= 0) pPos[i * 3 + 1] = -999;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }
  return { spawn, burst, tick };
}
