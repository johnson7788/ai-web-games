import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildCarMesh } from './car.js';

/** 对手车：沿赛道跑，橡皮筋微调，负责制造"超车"节奏 */
export class Rival {
  constructor(track, tex, index, specIndex = 0) {
    this.track = track;
    this.index = index;
    this.phase = index * 1.9;
    this.base = CONFIG.car.maxSpeed * CONFIG.ai.baseSpeed;
    this.s = -(16 + index * 11);      // 起跑错位排列，避免挤成一团
    this.t = ((index % 2) ? 1 : -1) * (3.2 + index * 1.6);
    this.speed = 0;
    this.mesh = buildCarMesh(tex, { spec: specIndex });
    this.mesh.scale.setScalar(0.98);
  }

  reset() {
    this.s = -(16 + this.index * 11);
    this.t = ((this.index % 2) ? 1 : -1) * (3.2 + this.index * 1.6);
    this.speed = 0;
  }

  tick(dt, playerS) {
    const L = this.track.length;
    // 橡皮筋：落后加速，领先减速
    const gap = ((playerS - this.s) % L + L) % L;
    let rubber = 0;
    if (gap > 70 && gap < L / 2) rubber = CONFIG.ai.rubber;
    else if (gap < L - 70 && gap > L / 2) rubber = -CONFIG.ai.rubber;

    const target = this.base * (1 + rubber);
    this.speed += (target - this.speed) * Math.min(1, dt * 1.6);
    this.s += this.speed * dt;

    // 走线：围绕中心线做正弦摆动，看起来像在找弯心
    const wig = Math.sin(this.s * 0.012 + this.phase) * (this.track.halfWidth * 0.42);
    this.t += (wig - this.t) * Math.min(1, dt * 2.2);

    this.updateMesh();
  }

  updateMesh() {
    const p = this.track.toWorld(this.s, this.t);
    const f = this.track.at(this.s);
    this.mesh.position.copy(p);
    this.mesh.rotation.y = Math.atan2(f.tan.x, f.tan.z);
  }
}

function makeGhostLabel() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(8,20,34,.55)';
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = 'rgba(127,216,255,.9)';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 253, 61);
  g.font = 'bold 34px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#9fe6ff';
  g.fillText('GHOST', 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: false, depthWrite: false,
  }));
  sp.scale.set(2.6, 0.65, 1);
  sp.position.set(0, 2.35, 0);
  sp.renderOrder = 10;
  return sp;
}

/** 幽灵车：录制玩家每 3 帧的 (s,t)，回放时插值 */
export class Ghost {
  constructor(track, tex, specIndex = 0) {
    this.track = track;
    this.frames = [];
    this.t = 0;
    this.active = false;
    this.mesh = buildCarMesh(tex, { spec: specIndex, ghost: true });
    this.mesh.visible = false;
    this.mesh.add(makeGhostLabel());
  }

  load(frames) {
    this.frames = frames || [];
    this.active = this.frames.length > 4;
    this.mesh.visible = false;
    if (this.active) this.mesh.visible = true;
  }

  start() {
    this.t = 0;
    this.mesh.visible = this.active;
  }

  record(car, tick) {
    this.frames.push([+car.s.toFixed(2), +car.t.toFixed(2)]);
    if (this.frames.length > 60 * 180) this.frames.shift(); // 最多 3 分钟
  }

  tick(dt) {
    if (!this.active) return;
    this.t += dt;
    const fps = 20;
    const f = this.t * fps;
    const i = Math.floor(f) % this.frames.length;
    const j = (i + 1) % this.frames.length;
    const k = f - Math.floor(f);
    if (!this.frames[i]) return;
    const s = this.frames[i][0] + (this.frames[j][0] - this.frames[i][0]) * k;
    const t = this.frames[i][1] + (this.frames[j][1] - this.frames[i][1]) * k;
    const p = this.track.toWorld(s, t);
    const fr = this.track.at(s);
    this.mesh.position.copy(p);
    this.mesh.rotation.y = Math.atan2(fr.tan.x, fr.tan.z);
  }
}
