// src/render/fx.js — 粒子池：球火尾 / boost 尾焰 / 撞球火花 / 进球爆点。
import * as THREE from 'three';

export function createFX(scene) {
  const PMAX = 480;
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
  rg.addColorStop(0.45, 'rgba(255,255,255,.5)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);

  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 1.6, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    sizeAttenuation: true, toneMapped: false,
  }));
  points.frustumCulled = false;
  scene.add(points);

  let pIdx = 0;
  function spawn(x, y, z, color, opts = {}) {
    const i = pIdx = (pIdx + 1) % PMAX;
    const { spread = 1.0, life = 0.55, vy = 0.6, vx = 0, vz = 0 } = opts;
    const cc = color instanceof THREE.Color ? color : new THREE.Color(color);
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
    pCol[i * 3] = cc.r; pCol[i * 3 + 1] = cc.g; pCol[i * 3 + 2] = cc.b;
    pVel[i * 3] = vx + (Math.random() - 0.5) * spread;
    pVel[i * 3 + 1] = vy + Math.random() * 1.2;
    pVel[i * 3 + 2] = vz + (Math.random() - 0.5) * spread;
    pLife[i] = life * (0.6 + Math.random() * 0.7);
  }
  function burst(x, y, z, color, n = 20, spread = 5, life = 0.6) {
    for (let k = 0; k < n; k++) spawn(x, y, z, color, { spread, life, vy: 2 + Math.random() * 4 });
  }
  function trail(x, y, z, color, speed) {
    // 球火尾：速度越快尾越长
    const n = speed > 26 ? 3 : speed > 14 ? 1 : 0;
    for (let k = 0; k < n; k++) {
      spawn(x + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.5,
        color, { spread: 0.4, life: 0.4, vy: 0.4 });
    }
  }
  function tick(dt) {
    for (let i = 0; i < PMAX; i++) {
      if (pLife[i] <= 0) continue;
      pLife[i] -= dt;
      pPos[i * 3] += pVel[i * 3] * dt;
      pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
      pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      pVel[i * 3 + 1] -= 1.4 * dt;
      if (pLife[i] <= 0) pPos[i * 3 + 1] = -999;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }
  return { spawn, burst, trail, tick };
}
