import * as THREE from 'three';
import { CONFIG } from './config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * 车辆物理：只维护 (s, t, angle, speed)。
 * 抓地时 angle 快速回正；漂移时回正变慢，车尾外甩并攒氮气。
 */
export class Car {
  constructor(cfg = CONFIG.car) {
    this.cfg = cfg;
    this.reset(0, 0);
  }

  reset(s = 0, t = 0) {
    this.s = s;
    this.t = t;
    this.angle = 0;
    this.steerSmooth = 0;
    this.speed = 0;
    this.nitro = 0;
    this.boostT = 0;
    this.drifting = false;
    this.offTrack = false;
    this.events = [];
  }

  get maxSpeed() {
    return this.cfg.maxSpeed * (this.boostT > 0 ? this.cfg.boostMul : 1);
  }

  tick(dt, input, track) {
    const c = this.cfg;
    this.events.length = 0;

    // —— 速度 ——
    if (input.brake) {
      this.speed = Math.max(0, this.speed - c.brake * dt);
    } else {
      const target = this.maxSpeed;
      if (this.speed < target) {
        this.speed += c.accel * dt * (1 - 0.55 * (this.speed / target));
      } else {
        this.speed -= 14 * dt;
      }
    }
    this.speed = clamp(this.speed, 0, this.maxSpeed * 1.05);

    // —— 氮气 ——
    if (this.boostT > 0) {
      this.boostT -= dt;
      if (this.boostT <= 0) this.events.push('boostEnd');
    }
    if (input.nitro && this.nitro >= c.nitroMax && this.boostT <= 0) {
      this.boostT = c.boostTime;
      this.nitro = 0;
      this.speed = Math.min(this.maxSpeed, this.speed * 1.12);
      this.events.push('boostStart');
    }

    // —— 转向 ——
    const wantDrift = input.drift && this.speed > c.driftMinSpeed;
    const steerRate = wantDrift ? c.driftSteer : c.steer;
    const spdFactor = 1 - 0.5 * (this.speed / c.maxSpeed);
    // 输入平滑：模拟方向盘不是瞬间打死
    this.steerSmooth += (input.steer - this.steerSmooth) * Math.min(1, (wantDrift ? 9 : 12) * dt);
    this.angle += this.steerSmooth * steerRate * spdFactor * dt;

    const grip = wantDrift ? c.driftGrip : c.grip;
    this.angle -= this.angle * Math.min(1, grip * dt);
    this.angle = clamp(this.angle, -0.55, 0.55);

    const wasDrifting = this.drifting;
    this.drifting = wantDrift && Math.abs(this.angle) > 0.10;
    if (this.drifting && !wasDrifting) this.events.push('driftStart');
    if (!this.drifting && wasDrifting) this.events.push('driftEnd');

    // —— 弯道把车甩出去：赛道切线在转，车头保持世界朝向，相对角就变了 ——
    const kappa = track.curvatureAt(this.s);
    this.angle -= kappa * CONFIG.curveForce * this.speed * dt;

    // —— 位移（s,t 空间）——
    this.s += this.speed * Math.cos(this.angle) * dt;
    this.t += this.speed * Math.sin(this.angle) * dt;

    // —— 出界 ——
    const hw = track.halfWidth;
    const outside = Math.abs(this.t) > hw;
    if (outside) {
      this.t = clamp(this.t, -hw, hw);
      this.speed *= Math.max(0.55, 1 - 1.6 * dt);
      this.angle *= Math.max(0.4, 1 - 3.0 * dt);
      if (!this.offTrack) this.events.push('offTrack');
    }
    this.offTrack = outside;

    // —— 漂移攒氮气 ——
    if (this.drifting) {
      this.nitro = Math.min(c.nitroMax, this.nitro + Math.abs(this.angle) * this.speed * c.nitroPerSlip * dt);
    } else if (!outside) {
      this.nitro = Math.max(0, this.nitro - 0.02 * dt);
    }

    return this;
  }

  /** 世界坐标（供渲染/相机使用） */
  world(track, out = new THREE.Vector3()) {
    return track.toWorld(this.s, this.t, out);
  }

  /** 车头朝向（世界 yaw） */
  yaw(track) {
    const f = track.at(this.s);
    return Math.atan2(f.tan.x, f.tan.z) - this.angle;
  }
}

// ---------------------------------------------------------------- 车型
/**
 * 三款跑车：比例、座舱、尾翼、轮距都不同。
 * 轮廓点用归一化坐标（x: -1..1，y: 0..1），构建时按 len/hgt 缩放。
 */
export const CAR_SPECS = [
  {
    id: 'vector', name: 'VECTOR', cn: '矢量', en: 'HYPERCAR',
    len: 4.60, wid: 1.96, hgt: 1.02, wheelR: 0.40, wheelBase: 2.82, tint: 0xffffff,
    body: [[-1.00, 0.10], [-0.97, 0.34], [-0.55, 0.40], [-0.05, 0.52], [0.50, 0.50],
           [0.88, 0.34], [1.00, 0.28], [0.96, 0.10], [0.55, 0.05], [-0.85, 0.05]],
    cabin: [[-0.55, 0.50], [-0.30, 0.92], [0.15, 0.95], [0.45, 0.55]],
    wing: { w: 1.98, d: 0.44, y: 0.80, z: -2.05, plate: 0.30 },
    splitter: 0.10, diffuser: true, exposed: false, livery: 0, accent: 0x28e0ff,
  },
  {
    id: 'vortex', name: 'VORTEX', cn: '涡流', en: 'GT COUPÉ',
    len: 4.92, wid: 1.90, hgt: 1.26, wheelR: 0.42, wheelBase: 3.02, tint: 0xffffff,
    body: [[-1.00, 0.12], [-0.95, 0.40], [-0.45, 0.46], [0.10, 0.56], [0.55, 0.54],
           [0.90, 0.38], [1.00, 0.32], [0.95, 0.12], [0.50, 0.06], [-0.90, 0.06]],
    cabin: [[-0.35, 0.54], [-0.10, 0.95], [0.30, 0.95], [0.50, 0.56]],
    wing: { w: 1.62, d: 0.34, y: 0.92, z: -2.18, plate: 0.22 },
    splitter: 0.07, diffuser: true, exposed: false, livery: 1, accent: 0xff9a3c,
  },
  {
    id: 'arrow', name: 'ARROW', cn: '箭', en: 'TRACK SPECIAL',
    len: 4.24, wid: 1.58, hgt: 0.98, wheelR: 0.38, wheelBase: 2.58, tint: 0xffffff,
    body: [[-1.00, 0.14], [-0.90, 0.42], [-0.30, 0.50], [0.30, 0.50], [0.85, 0.40],
           [1.00, 0.30], [0.92, 0.12], [0.40, 0.06], [-0.80, 0.06]],
    cabin: [[-0.25, 0.50], [0.00, 0.86], [0.22, 0.86], [0.35, 0.52]],
    wing: { w: 1.86, d: 0.50, y: 0.86, z: -1.94, plate: 0.34 },
    splitter: 0.09, diffuser: true, exposed: true, livery: 2, accent: 0x8aff5a,
  },
];

// ---------------------------------------------------------------- 几何工具
function mergeParts(parts) {
  const geos = parts.map(({ g, m }) => {
    const gg = g.index ? g.toNonIndexed() : g.clone();
    if (m) gg.applyMatrix4(m);
    return gg;
  });
  const total = geos.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let o = 0;
  for (const g of geos) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    pos.set(p.array, o * 3);
    if (n) nor.set(n.array, o * 3);
    if (u) uv.set(u.array, o * 2);
    o += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const V = new THREE.Vector3();
const S = new THREE.Vector3();
function TRS(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  E.set(rx, ry, rz);
  Q.setFromEuler(E);
  S.set(sx, sy, sz);
  return new THREE.Matrix4().compose(V.set(x, y, z), Q, S);
}

function taperBody(geo, amount = 0.30) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const p = geo.attributes.position;
  const minY = bb.min.y, spanY = Math.max(0.001, bb.max.y - minY);
  const minZ = bb.min.z, spanZ = Math.max(0.001, bb.max.z - minZ);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), z = p.getZ(i);
    const ty = (y - minY) / spanY;
    const tz = (z - minZ) / spanZ;
    // 顶部收窄（肩线），两端也收窄（车头/车尾）
    const shoulder = 1 - amount * Math.pow(ty, 1.4);
    const ends = 0.84 + 0.16 * Math.sin(Math.PI * tz);
    p.setX(i, p.getX(i) * shoulder * ends);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function profileGeometry(points, len, hgt, width, bevel = 0.08) {
  const shape = new THREE.Shape();
  points.forEach(([px, py], i) => {
    const x = (px * len) / 2;
    const y = py * hgt;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width, bevelEnabled: bevel > 0, bevelThickness: bevel,
    bevelSize: bevel, bevelSegments: 2, curveSegments: 8,
  });
  geo.rotateY(-Math.PI / 2);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.max.x + bb.min.x) / 2, 0, -(bb.max.z + bb.min.z) / 2);
  geo.computeVertexNormals();
  return geo;
}

function boxUV(geo) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const p = geo.attributes.position, n = geo.attributes.normal;
  const sx = 1 / Math.max(0.001, bb.max.x - bb.min.x);
  const sy = 1 / Math.max(0.001, bb.max.y - bb.min.y);
  const sz = 1 / Math.max(0.001, bb.max.z - bb.min.z);
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    let u, v;
    if (nx >= ny && nx >= nz) { u = (p.getZ(i) - bb.min.z) * sz; v = (p.getY(i) - bb.min.y) * sy; if (n.getX(i) < 0) u = 1 - u; }
    else if (ny >= nx && ny >= nz) { u = (p.getX(i) - bb.min.x) * sx; v = (p.getZ(i) - bb.min.z) * sz; if (n.getY(i) > 0) u = 1 - u; }
    else { u = (p.getX(i) - bb.min.x) * sx; v = (p.getY(i) - bb.min.y) * sy; if (n.getZ(i) < 0) u = 1 - u; }
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('uv1', new THREE.BufferAttribute(uv.slice(), 2));
  return geo;
}

const cache = {};
function getGeos(spec) {
  if (cache[spec.id]) return cache[spec.id];
  const { len, wid, hgt } = spec;

  const paint = [];
  const body = taperBody(profileGeometry(spec.body, len, hgt, wid * 0.86, 0.09), spec.exposed ? 0.42 : 0.30);
  boxUV(body);
  paint.push({ g: body });

  const cabin = profileGeometry(spec.cabin, len, hgt, wid * 0.66, 0.05);
  const glass = [{ g: cabin }];

  // 车顶（座舱顶部一层车漆）
  paint.push({ g: new THREE.BoxGeometry(wid * 0.60, 0.05, len * 0.20), m: TRS(0, hgt * 0.93, -len * 0.05) });

  if (spec.splitter) {
    paint.push({ g: new THREE.BoxGeometry(wid * 0.98, 0.06, len * 0.10), m: TRS(0, 0.07, len * 0.48) });
  }
  if (spec.diffuser) {
    paint.push({ g: new THREE.BoxGeometry(wid * 0.84, 0.10, len * 0.12), m: TRS(0, 0.10, -len * 0.47) });
  }

  // 尾翼 + 端板 + 支柱
  const w = spec.wing;
  paint.push({ g: new THREE.BoxGeometry(w.w, 0.06, w.d), m: TRS(0, w.y, w.z) });
  paint.push({ g: new THREE.BoxGeometry(0.05, 0.20, w.d * 0.9), m: TRS(-w.w / 2, w.y - 0.08, w.z) });
  paint.push({ g: new THREE.BoxGeometry(0.05, 0.20, w.d * 0.9), m: TRS(w.w / 2, w.y - 0.08, w.z) });
  paint.push({ g: new THREE.BoxGeometry(0.06, 0.24, 0.16), m: TRS(-w.w * 0.34, w.y - 0.16, w.z) });
  paint.push({ g: new THREE.BoxGeometry(0.06, 0.24, 0.16), m: TRS(w.w * 0.34, w.y - 0.16, w.z) });

  // 侧裙
  for (const sgn of [-1, 1]) {
    paint.push({ g: new THREE.BoxGeometry(0.07, 0.10, len * 0.38), m: TRS(sgn * wid * 0.44, 0.11, 0) });
  }

  const lights = [];
  lights.push({ g: new THREE.BoxGeometry(wid * 0.52, 0.055, 0.05), m: TRS(0, hgt * 0.40, len * 0.49) });
  for (const sgn of [-1, 1]) {
    lights.push({ g: new THREE.BoxGeometry(wid * 0.16, 0.07, 0.04), m: TRS(sgn * wid * 0.34, hgt * 0.44, len * 0.485) });
  }
  lights.push({ g: new THREE.BoxGeometry(wid * 0.62, 0.05, 0.05), m: TRS(0, hgt * 0.46, -len * 0.49) });

  cache[spec.id] = {
    paint: mergeParts(paint),
    glass: mergeParts(glass),
    lights: mergeParts(lights),
  };
  return cache[spec.id];
}

/** 造一辆车。opts.spec 可传 CAR_SPECS 的索引或对象 */
export function buildCarMesh(tex, opts = {}) {
  const spec = typeof opts.spec === 'number' ? CAR_SPECS[opts.spec] : (opts.spec || CAR_SPECS[0]);
  const { tint = 0xffffff, ghost = false } = opts;
  const geos = getGeos(spec);
  const group = new THREE.Group();

  const paintMat = new THREE.MeshPhysicalMaterial({
    map: tex['car' + spec.livery], normalMap: tex.carN,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: tex.carORM, metalnessMap: tex.carORM, aoMap: tex.carORM,
    roughness: 1, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.10,
    color: tint, envMapIntensity: 1.55,
    transparent: ghost, opacity: ghost ? 0.52 : 1, depthWrite: !ghost,
  });
  const paint = new THREE.Mesh(geos.paint, paintMat);
  paint.castShadow = !ghost;
  group.add(paint);

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a1424, metalness: 0.9, roughness: 0.10,
    transparent: true, opacity: 0.86, envMapIntensity: 1.6,
  });
  group.add(new THREE.Mesh(geos.glass, glassMat));

  const lightMat = new THREE.MeshBasicMaterial({
    color: ghost ? 0x7fd8ff : spec.accent, toneMapped: false,
    transparent: ghost, opacity: ghost ? 0.7 : 1,
  });
  group.add(new THREE.Mesh(geos.lights, lightMat));

  const tyreGeo = new THREE.CylinderGeometry(spec.wheelR, spec.wheelR, spec.wheelR * 0.72, 20);
  tyreGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.TorusGeometry(spec.wheelR * 0.66, spec.wheelR * 0.10, 6, 20);
  rimGeo.rotateY(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(spec.wheelR * 0.10, spec.wheelR * 1.18, spec.wheelR * 0.10);
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x080a12, roughness: 0.75, metalness: 0.15 });
  const rimMat = new THREE.MeshStandardMaterial({
    color: ghost ? 0x9fe6ff : 0xb8c6d8, roughness: 0.25, metalness: 1,
    transparent: ghost, opacity: ghost ? 0.6 : 1,
  });

  const halfTrack = spec.exposed ? spec.wid * 0.62 : spec.wid * 0.46;
  const wheels = [];
  for (const [x, z] of [[halfTrack, spec.wheelBase / 2], [-halfTrack, spec.wheelBase / 2],
                        [halfTrack, -spec.wheelBase / 2], [-halfTrack, -spec.wheelBase / 2]]) {
    const hub = new THREE.Group();
    hub.position.set(x, spec.wheelR, z);
    const tyre = new THREE.Mesh(tyreGeo, tyreMat);
    tyre.castShadow = !ghost;
    hub.add(tyre);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.x = Math.sign(x) * spec.wheelR * 0.30;
    hub.add(rim);
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(spokeGeo, rimMat);
      sp.rotation.x = (i / 5) * Math.PI;
      sp.rotation.z = Math.PI / 2;
      sp.position.x = Math.sign(x) * spec.wheelR * 0.30;
      hub.add(sp);
    }
    group.add(hub);
    wheels.push(hub);
  }

  // 去掉了车底加色发光板：在明亮场景（沙漠/海岸）会变成过曝白斑
  group.userData.wheels = wheels;
  group.userData.spec = spec;
  return group;
}
