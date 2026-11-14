// src/render/car.js — 车辆网格：三车型（neon-drift 几何）+ 警车/车流/路障。
import * as THREE from 'three';

// ---------------------------------------------------------------- 车型
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

  paint.push({ g: new THREE.BoxGeometry(wid * 0.60, 0.05, len * 0.20), m: TRS(0, hgt * 0.93, -len * 0.05) });

  if (spec.splitter) {
    paint.push({ g: new THREE.BoxGeometry(wid * 0.98, 0.06, len * 0.10), m: TRS(0, 0.07, len * 0.48) });
  }
  if (spec.diffuser) {
    paint.push({ g: new THREE.BoxGeometry(wid * 0.84, 0.10, len * 0.12), m: TRS(0, 0.10, -len * 0.47) });
  }

  const w = spec.wing;
  paint.push({ g: new THREE.BoxGeometry(w.w, 0.06, w.d), m: TRS(0, w.y, w.z) });
  paint.push({ g: new THREE.BoxGeometry(0.05, 0.20, w.d * 0.9), m: TRS(-w.w / 2, w.y - 0.08, w.z) });
  paint.push({ g: new THREE.BoxGeometry(0.05, 0.20, w.d * 0.9), m: TRS(w.w / 2, w.y - 0.08, w.z) });
  paint.push({ g: new THREE.BoxGeometry(0.06, 0.24, 0.16), m: TRS(-w.w * 0.34, w.y - 0.16, w.z) });
  paint.push({ g: new THREE.BoxGeometry(0.06, 0.24, 0.16), m: TRS(w.w * 0.34, w.y - 0.16, w.z) });

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

function addWheels(group, spec) {
  const tyreGeo = new THREE.CylinderGeometry(spec.wheelR, spec.wheelR, spec.wheelR * 0.72, 20);
  tyreGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.TorusGeometry(spec.wheelR * 0.66, spec.wheelR * 0.10, 6, 20);
  rimGeo.rotateY(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(spec.wheelR * 0.10, spec.wheelR * 1.18, spec.wheelR * 0.10);
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x080a12, roughness: 0.75, metalness: 0.15 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8c6d8, roughness: 0.25, metalness: 1 });

  const halfTrack = spec.exposed ? spec.wid * 0.62 : spec.wid * 0.46;
  const wheels = [];
  for (const [x, z] of [[halfTrack, spec.wheelBase / 2], [-halfTrack, spec.wheelBase / 2],
                        [halfTrack, -spec.wheelBase / 2], [-halfTrack, -spec.wheelBase / 2]]) {
    const hub = new THREE.Group();
    hub.position.set(x, spec.wheelR, z);
    const tyre = new THREE.Mesh(tyreGeo, tyreMat);
    tyre.castShadow = true;
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
  return wheels;
}

/** 玩家车：按 spec 选三车型几何，tint 用 config CARS 车漆色。 */
export function buildCarMesh(tex, opts = {}) {
  const spec = typeof opts.spec === 'number' ? CAR_SPECS[opts.spec] : (opts.spec || CAR_SPECS[0]);
  const { tint = 0xffffff } = opts;
  const geos = getGeos(spec);
  const group = new THREE.Group();

  const paintMat = new THREE.MeshPhysicalMaterial({
    map: tex['car' + spec.livery], normalMap: tex.carN,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: tex.carORM, metalnessMap: tex.carORM, aoMap: tex.carORM,
    roughness: 1, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.10,
    color: tint, envMapIntensity: 1.55,
  });
  const paint = new THREE.Mesh(geos.paint, paintMat);
  paint.castShadow = true;
  group.add(paint);

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a1424, metalness: 0.9, roughness: 0.10,
    transparent: true, opacity: 0.86, envMapIntensity: 1.6,
  });
  group.add(new THREE.Mesh(geos.glass, glassMat));

  const lightMat = new THREE.MeshBasicMaterial({ color: spec.accent, toneMapped: false });
  group.add(new THREE.Mesh(geos.lights, lightMat));

  group.userData.wheels = addWheels(group, spec);
  group.userData.spec = spec;
  return group;
}

/** 警车：白黑车漆 + 车顶红蓝闪灯条 + 红蓝 PointLight。 */
export function buildCopMesh() {
  const spec = CAR_SPECS[1];
  const geos = getGeos(spec);
  const g = new THREE.Group();

  const paint = new THREE.Mesh(geos.paint, new THREE.MeshPhysicalMaterial({
    color: 0xf2f5fb, roughness: 0.32, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.12,
  }));
  paint.castShadow = true;
  g.add(paint);

  g.add(new THREE.Mesh(geos.glass, new THREE.MeshPhysicalMaterial({
    color: 0x0a1424, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.9,
  })));

  const black = new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.5, metalness: 0.4 });
  const hood = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.72, 0.05, spec.len * 0.30), black);
  hood.position.set(0, spec.hgt * 0.52, spec.len * 0.35);
  g.add(hood);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.72, 0.05, spec.len * 0.22), black);
  trunk.position.set(0, spec.hgt * 0.52, -spec.len * 0.42);
  g.add(trunk);

  const headMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, toneMapped: false });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.18, 0.08, 0.05), headMat);
    h.position.set(s * spec.wid * 0.34, spec.hgt * 0.40, spec.len * 0.49);
    g.add(h);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.6, 0.09, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2233, toneMapped: false }));
  tail.position.set(0, spec.hgt * 0.44, -spec.len * 0.49);
  g.add(tail);

  // 车顶红蓝闪灯条
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.5, 0.10, 0.30), black);
  barBase.position.set(0, spec.hgt * 0.94, spec.len * 0.02);
  g.add(barBase);
  const redHalf = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.24, 0.12, 0.26), new THREE.MeshBasicMaterial({ color: 0xff2233, toneMapped: false }));
  redHalf.position.set(-spec.wid * 0.12, spec.hgt * 0.99, spec.len * 0.02);
  g.add(redHalf);
  const blueHalf = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.24, 0.12, 0.26), new THREE.MeshBasicMaterial({ color: 0x2244ff, toneMapped: false }));
  blueHalf.position.set(spec.wid * 0.12, spec.hgt * 0.99, spec.len * 0.02);
  g.add(blueHalf);

  const redLight = new THREE.PointLight(0xff2233, 0, 9, 2);
  redLight.position.set(-spec.wid * 0.12, spec.hgt * 1.2, 0);
  g.add(redLight);
  const blueLight = new THREE.PointLight(0x2244ff, 0, 9, 2);
  blueLight.position.set(spec.wid * 0.12, spec.hgt * 1.2, 0);
  g.add(blueLight);

  g.userData.wheels = addWheels(g, spec);
  g.userData.blink = (t) => {
    const on = Math.floor(t * 6) % 2 === 0;
    redLight.intensity = on ? 6 : 0;
    blueLight.intensity = on ? 0 : 6;
    redHalf.material.color.setHex(on ? 0xff3344 : 0x3a0a0e);
    blueHalf.material.color.setHex(on ? 0x3355ff : 0x0a0e3a);
  };
  return g;
}

// ---------------------------------------------------------------- 车流（简装车）
const trafficGeos = {};
function trafficShared() {
  if (trafficGeos.body) return trafficGeos;
  trafficGeos.body = new THREE.BoxGeometry(1.8, 0.55, 4.2);
  trafficGeos.cabin = new THREE.BoxGeometry(1.45, 0.5, 1.9);
  trafficGeos.wheel = new THREE.CylinderGeometry(0.32, 0.32, 0.26, 10);
  trafficGeos.tail = new THREE.BoxGeometry(1.5, 0.1, 0.06);
  return trafficGeos;
}
const trafficBodyMats = [0x8899aa, 0x6a7a8a, 0x9aa0b8, 0x7a6a88].map((c) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.25 }));
const trafficCabinMat = new THREE.MeshStandardMaterial({ color: 0x0c1524, roughness: 0.3, metalness: 0.6 });
const trafficWheelMat = new THREE.MeshStandardMaterial({ color: 0x080a12, roughness: 0.8 });
const trafficTailMat = new THREE.MeshBasicMaterial({ color: 0xff3344, toneMapped: false });

export function buildTrafficMesh(variant = 0) {
  const geo = trafficShared();
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo.body, trafficBodyMats[variant % trafficBodyMats.length]);
  body.castShadow = true;
  body.position.y = 0.45;
  g.add(body);
  const cabin = new THREE.Mesh(geo.cabin, trafficCabinMat);
  cabin.position.set(0, 0.85, -0.2);
  g.add(cabin);
  for (const [x, z] of [[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.4], [0.85, -1.4]]) {
    const wh = new THREE.Mesh(geo.wheel, trafficWheelMat);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(x, 0.32, z);
    g.add(wh);
  }
  const tail = new THREE.Mesh(geo.tail, trafficTailMat);
  tail.position.set(0, 0.55, -2.1);
  g.add(tail);
  return g;
}

// ---------------------------------------------------------------- 路障（条纹拒马 + 黄闪灯）
let stripeTex = null;
function stripeTexture() {
  if (stripeTex) return stripeTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#ff7a1a';
  for (let x = -64; x < 128; x += 32) {
    g.beginPath();
    g.moveTo(x, 64); g.lineTo(x + 20, 0); g.lineTo(x + 32, 0); g.lineTo(x + 12, 64);
    g.closePath(); g.fill();
  }
  stripeTex = new THREE.CanvasTexture(c);
  stripeTex.colorSpace = THREE.SRGBColorSpace;
  return stripeTex;
}

export function buildBlockMesh() {
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(9, 0.55, 0.4),
    new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.6, metalness: 0.1 }));
  board.position.y = 0.55;
  board.castShadow = true;
  g.add(board);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a3346, roughness: 0.8 });
  for (const x of [-3.8, 3.8]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.5), legMat);
    leg.position.set(x, 0.3, 0);
    g.add(leg);
  }
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.3), new THREE.MeshBasicMaterial({ color: 0xffd23f, toneMapped: false }));
  lamp.position.y = 1.0;
  g.add(lamp);
  g.userData.blink = (t) => { lamp.material.color.setHex(Math.sin(t * 8) > 0 ? 0xffd23f : 0x3a2c00); };
  return g;
}
