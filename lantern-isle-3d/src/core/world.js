// runtime/world.js — 世界层：高度场地形（顶点色，零贴图外链）、光照与昼夜、分区、实例化散布。
// 脚手架复制到 src/core/world.js。观感来自「地形起伏 + 光照 + 雾 + 构图」，不是面数堆料。
import * as THREE from '../../lib/three.module.js';

const hex = (h) => new THREE.Color(h);
/** 稳定的小随机（同一 seed 同一世界，验收可复现） */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a ^= a << 13; a >>>= 0; a ^= a >> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; };
}

/** 高度场：fn(x,z)->y（米）。提供双线性采样、法线、坡度，供角色落地与碰撞用。 */
export class HeightField {
  constructor({ half = 60, seg = 160, fn }) {
    this.half = half;
    this.seg = seg;
    this.step = (half * 2) / seg;
    this.n = seg + 1;
    this.data = new Float32Array(this.n * this.n);
    for (let j = 0; j < this.n; j++) {
      for (let i = 0; i < this.n; i++) {
        const x = -half + i * this.step, z = -half + j * this.step;
        this.data[j * this.n + i] = fn(x, z);
      }
    }
  }
  at(x, z) {
    const { half, step, n, data } = this;
    let gx = (x + half) / step, gz = (z + half) / step;
    gx = Math.max(0, Math.min(n - 1.001, gx));
    gz = Math.max(0, Math.min(n - 1.001, gz));
    const i = Math.floor(gx), j = Math.floor(gz);
    const fx = gx - i, fz = gz - j;
    const h00 = data[j * n + i], h10 = data[j * n + i + 1], h01 = data[(j + 1) * n + i], h11 = data[(j + 1) * n + i + 1];
    return h00 * (1 - fx) * (1 - fz) + h10 * fx * (1 - fz) + h01 * (1 - fx) * fz + h11 * fx * fz;
  }
  slopeDeg(x, z) {
    const d = Math.max(0.5, this.step * 2);
    const hx = (this.at(x + d, z) - this.at(x - d, z)) / (2 * d);
    const hz = (this.at(x, z + d) - this.at(x, z - d)) / (2 * d);
    return Math.atan(Math.hypot(hx, hz)) * 180 / Math.PI;
  }
  /** 顶点色地形：不占贴图、不分材质，1 个 DrawCall */
  mesh({ colors, blend = 0.35 }) {
    const { half, seg, n } = this;
    const geo = new THREE.PlaneGeometry(half * 2, half * 2, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let idx = 0; idx < pos.count; idx++) {
      const x = pos.getX(idx), z = pos.getZ(idx);
      const y = this.at(x, z);
      pos.setY(idx, y);
      const t = Math.max(0, Math.min(1, (y + blend) / (2 * blend)));
      const pick = colors.stopFor ? colors.stopFor(y, this.slopeDeg(x, z)) : colors(t, this.slopeDeg(x, z));
      c.set(pick);
      // 轻微每顶点亮度抖动，避免大平面死板
      const j = 0.94 + ((idx * 2654435761 % 1000) / 1000) * 0.12;
      col[idx * 3] = c.r * j; col[idx * 3 + 1] = c.g * j; col[idx * 3 + 2] = c.b * j;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    m.name = 'terrain';
    return m;
  }
}

/** 光照：全部参数来自 Art Bible，保证换游戏不换「光语言」 */
export function createLighting(scene, bible, { shadows = true } = {}) {
  const L = bible.lighting;
  const hemi = new THREE.HemisphereLight(hex(L.hemiSky), hex(L.hemiGround), L.hemiIntensity ?? 0.85);
  const sun = new THREE.DirectionalLight(hex(L.sunColor), L.sunIntensity ?? 2.2);
  const dir = L.sunDir.slice();
  sun.position.set(dir[0], dir[1], dir[2]);
  sun.target.position.set(0, 0, 0);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = L.shadowSpan ?? 60;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = s * 6;
    sun.shadow.bias = L.shadowBias ?? -0.0006;
    sun.shadow.normalBias = 0.02;
  }
  const amb = new THREE.AmbientLight(0xffffff, L.ambient ?? 0.22);
  scene.add(hemi, sun, sun.target, amb);
  scene.fog = new THREE.Fog(hex(L.fogColor), L.fogNear ?? 40, L.fogFar ?? 260);
  return { hemi, sun, amb, scene, bible, base: { sunI: sun.intensity, hemiI: hemi.intensity, ambI: amb.intensity, fog: L.fogColor } };
}
/** 昼夜推进：t=0 黄昏 → 0.5 深夜 → 1 黎明。只改强度/颜色，不改结构（可被 probe 观测） */
export function setTimeOfDay(lights, t) {
  const { base, sun, hemi, amb, scene } = lights;
  const amt = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  sun.intensity = base.sunI * (1 - 0.86 * amt);
  hemi.intensity = base.hemiI * (1 - 0.55 * amt);
  amb.intensity = base.ambI + amt * 0.1;
  const day = hex('#ffd9a0'), nightc = hex('#4a5f96');
  sun.color.copy(day).lerp(nightc, amt);
  if (scene.fog) scene.fog.color.copy(hex(base.fog)).lerp(nightc, amt * 0.75);
  if (scene.fog) scene.background = scene.fog.color;
  return +amt.toFixed(3);
}

/** 实例化散布：树/草/石/栅栏用这个，否则 DrawCall 爆炸 */
export function scatter(scene, { proto, points, name = 'scatter', castShadow = false, seed = 7, scaleRange = [0.85, 1.15], yRotJitter = Math.PI * 2 }) {
  if (!points || !points.length) return null;
  const geo = proto.geometry || (proto.children[0] && proto.children[0].geometry);
  const mat = proto.material || (proto.children[0] && proto.children[0].material);
  const im = new THREE.InstancedMesh(geo, mat, points.length);
  im.name = name;
  im.castShadow = castShadow;
  im.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const r = rng(seed);
  points.forEach((pt, i) => {
    p.set(pt.x, pt.y ?? 0, pt.z);
    e.set(pt.rx || 0, (pt.ry || 0) + (r() - 0.5) * yRotJitter, pt.rz || 0);
    q.setFromEuler(e);
    const k = pt.scale != null ? pt.scale : scaleRange[0] + r() * (scaleRange[1] - scaleRange[0]);
    s.set(k, k, k);
    m.compose(p, q, s);
    im.setMatrixAt(i, m);
  });
  im.instanceMatrix.needsUpdate = true;
  im.userData = { kind: 'instanced', count: points.length, name };
  scene.add(im);
  return im;
}

/** 分区：按玩家位置激活/休眠，控 DrawCall 与更新成本 */
export class Zones {
  constructor() { this.list = []; }
  add(name, { center, radius = 30, objects = [], onEnter, onLeave }) {
    this.list.push({ name, center, radius, objects, onEnter, onLeave, active: false });
    return this;
  }
  update(pos) {
    for (const z of this.list) {
      const d = Math.hypot(pos.x - z.center[0], pos.z - z.center[1]);
      const want = d <= z.radius;
      if (want !== z.active) {
        z.active = want;
        for (const o of z.objects) o.visible = want;
        if (want && z.onEnter) z.onEnter(z);
        if (!want && z.onLeave) z.onLeave(z);
      }
    }
    return this.list.map((z) => ({ name: z.name, active: z.active, dist: +Math.hypot(pos.x - z.center[0], pos.z - z.center[1]).toFixed(1), objects: z.objects.length }));
  }
}

/** 简易天空：渐变大球壳（不要外部 hdr/贴图，断网可玩） */
export function gradientSky(scene, { top = '#20304f', bottom = '#f2b06b', radius = 900 } = {}) {
  const geo = new THREE.SphereGeometry(radius, 24, 16);
  const colors = [];
  const cTop = hex(top), cBot = hex(bottom), tmp = new THREE.Color();
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, Math.min(1, (p.getY(i) / radius + 0.25) / 1.25));
    tmp.copy(cBot).lerp(cTop, t);
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  mesh.name = 'sky';
  scene.add(mesh);
  return mesh;
}
