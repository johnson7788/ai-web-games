import * as THREE from 'three';
import { buildDecor } from './env.js';

/**
 * 赛道：Catmull-Rom 闭合样条 → 等弧长采样 → 路面/护栏/霓虹/装饰网格。
 * 对外只暴露 (s, t) 空间：s 为沿中心线弧长，t 为横向偏移。
 */
function buildingWindowTexture(theme) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0b1224'; g.fillRect(0, 0, 128, 256);
  const warm = ['#ffcf8a', '#ffe3b0', '#ffb45e'];
  const cool = ['#8fe9ff', '#b9f2ff', '#5fc6ff'];
  for (let y = 6; y < 250; y += 12) {
    for (let x = 6; x < 122; x += 11) {
      if (Math.random() < 0.42) continue;
      const palette = Math.random() < 0.55 ? warm : cool;
      g.fillStyle = palette[(Math.random() * palette.length) | 0];
      g.globalAlpha = 0.55 + Math.random() * 0.45;
      g.fillRect(x, y, 7, 7);
    }
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Track {
  constructor(def, tex) {
    this.def = def;
    this.tex = tex;
    this.halfWidth = def.width / 2;

    const pts = def.points.map(([x, z]) => new THREE.Vector3(x * def.scale, 0, z * def.scale));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    this.length = this.curve.getLength();

    // 每 2m 一个采样点，闭合
    const n = Math.max(64, Math.min(2000, Math.round(this.length / 2)));
    this.n = n;
    this.ds = this.length / n;
    this.samples = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const p = this.curve.getPointAt(u);
      const tan = this.curve.getTangentAt(u).setY(0).normalize();
      const side = new THREE.Vector3().crossVectors(tan, up).normalize();
      this.samples.push({ p, tan, side, s: i * this.ds });
    }

    // 有符号曲率（rad/m）：切线转角 / 弧长，用于把车"甩"出弯外
    this.kappa = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = this.samples[i].tan;
      const b = this.samples[(i + 1) % n].tan;
      const cr = a.x * b.z - a.z * b.x;
      const dot = Math.max(-1, Math.min(1, a.dot(b)));
      const dAng = Math.atan2(cr, dot);
      this.kappa[i] = dAng / this.ds;
    }
  }

  curvatureAt(s) {
    const L = this.length;
    s = ((s % L) + L) % L;
    const f = s / this.ds;
    const i = Math.floor(f) % this.n;
    const j = (i + 1) % this.n;
    const k = f - Math.floor(f);
    return this.kappa[i] * (1 - k) + this.kappa[j] * k;
  }

  /** 弧长 s → 插值后的位置/切线/侧向 */
  at(s) {
    const L = this.length;
    s = ((s % L) + L) % L;
    const f = s / this.ds;
    const i = Math.floor(f) % this.n;
    const j = (i + 1) % this.n;
    const k = f - Math.floor(f);
    const a = this.samples[i], b = this.samples[j];
    return {
      pos: a.p.clone().lerp(b.p, k),
      tan: a.tan.clone().lerp(b.tan, k).normalize(),
      side: a.side.clone().lerp(b.side, k).normalize(),
    };
  }

  /** (s,t) → 世界坐标 */
  toWorld(s, t, out = new THREE.Vector3()) {
    const f = this.at(s);
    return out.copy(f.pos).addScaledVector(f.side, t);
  }

  /** 世界坐标 → 最近的 s（用于初始定位/重置） */
  projectS(world) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < this.n; i += 2) {
      const d = this.samples[i].p.distanceToSquared(world);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best * this.ds;
  }

  build(scene) {
    const { n, ds, halfWidth, tex, def } = this;
    const theme = def.theme;

    // ---------- 路面 ----------
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const a = this.samples[i % n];
      const v = (i * ds) / 9;          // 沿赛道每 9m 重复一次
      for (const [k, off] of [[0, -halfWidth], [1, halfWidth]]) {
        const p = a.p.clone().addScaledVector(a.side, off);
        pos.push(p.x, 0.02, p.z);
        uv.push(k, v);
      }
      if (i < n) {
        const b = i * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    roadGeo.setIndex(idx);
    roadGeo.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({
      map: tex.road, normalMap: tex.roadN, normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.86, metalness: 0.04, color: 0xffffff,
    });
    roadMat.map.wrapS = roadMat.map.wrapT = THREE.RepeatWrapping;
    roadMat.normalMap.wrapS = roadMat.normalMap.wrapT = THREE.RepeatWrapping;
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.receiveShadow = true;
    scene.add(road);

    // ---------- 护栏（竖面）----------
    const railPos = [], railUv = [], railIdx = [];
    let vi = 0;
    for (const sign of [-1, 1]) {
      const start = vi;
      for (let i = 0; i <= n; i++) {
        const a = this.samples[i % n];
        const p = a.p.clone().addScaledVector(a.side, sign * (halfWidth + 0.55));
        railPos.push(p.x, 0.0, p.z, p.x, 0.95, p.z);
        railUv.push(0, (i * ds) / 6, 1, (i * ds) / 6);
        vi += 2;
      }
      for (let i = 0; i < n; i++) {
        const b = start + i * 2;
        railIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const railGeo = new THREE.BufferGeometry();
    railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPos, 3));
    railGeo.setAttribute('uv', new THREE.Float32BufferAttribute(railUv, 2));
    railGeo.setIndex(railIdx);
    railGeo.computeVertexNormals();
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x141c2c, roughness: 0.98, metalness: 0.02,
      emissive: theme.neon, emissiveIntensity: 0.03, side: THREE.DoubleSide,
    });
    scene.add(new THREE.Mesh(railGeo, railMat));

    // ---------- 霓虹边条 ----------
    for (const [sign, color] of [[-1, theme.neon], [1, theme.neon2]]) {
      if (theme.edge === 'none') break;
      const np = [], ni = [];
      for (let i = 0; i <= n; i++) {
        const a = this.samples[i % n];
        const inner = a.p.clone().addScaledVector(a.side, sign * (halfWidth - 0.25));
        const outer = a.p.clone().addScaledVector(a.side, sign * (halfWidth + 0.12));
        np.push(inner.x, 0.05, inner.z, outer.x, 0.05, outer.z);
        if (i < n) {
          const b = i * 2;
          ni.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(np, 3));
      g.setIndex(ni);
      scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, toneMapped: false })));
    }

    // ---------- 主题装饰交给 env.js ----------
    buildDecor(scene, this, def.theme);

    return { road };
  }

  /** 起跑线：s=0 处的一块发光板 */
  addStartLine(scene) {
    const a = this.at(0);
    const geo = new THREE.PlaneGeometry(this.halfWidth * 2, 3);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, toneMapped: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(a.tan.x, a.tan.z);
    m.position.copy(a.pos).setY(0.03);
    scene.add(m);
  }
}
