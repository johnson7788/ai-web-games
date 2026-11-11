import * as THREE from 'three';

/** 主题装饰：都市 / 戈壁 / 海岸。共用路面与护栏，只换"路边有什么"。 */
export function buildDecor(scene, track, theme) {
  if (theme.kind === 'coast') coast(scene, track, theme);        // 海岸用沙滩带 + 海面，不铺全局地面
  else {
    ground(scene, theme);
    if (theme.kind === 'desert') desert(scene, track, theme);
    else city(scene, track, theme);
  }
  sponsorBoards(scene, track, theme);
}

// ---------------------------------------------------------------- 赞助商广告牌
// 全部为虚构品牌（NOVA / HELIX / ORBIT / VOLT），避免商标风险
const SPONSOR_BRANDS = [
  { name: 'NOVA', color: '#28e0ff' },
  { name: 'HELIX', color: '#ffb347' },
  { name: 'ORBIT', color: '#ff2d78' },
  { name: 'VOLT', color: '#8aff5a' },
];
const boardTexCache = new Map();
function boardTexture(brand) {
  if (boardTexCache.has(brand.name)) return boardTexCache.get(brand.name);
  const c = document.createElement('canvas');
  c.width = 512; c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = '#080c18';
  g.fillRect(0, 0, 512, 192);
  g.strokeStyle = brand.color;
  g.lineWidth = 8;
  g.strokeRect(8, 8, 496, 176);
  g.fillStyle = brand.color;
  g.globalAlpha = 0.16;
  g.fillRect(8, 8, 496, 176);
  g.globalAlpha = 1;
  g.font = 'bold 96px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#f2f8ff';
  g.fillText(brand.name, 256, 104);
  g.fillStyle = brand.color;
  g.fillRect(120, 150, 272, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  boardTexCache.set(brand.name, t);
  return t;
}

function sponsorBoards(scene, track, theme) {
  const step = 210;
  const n = Math.floor(track.length / step);
  const geo = new THREE.PlaneGeometry(9, 3.4);
  for (let i = 0; i < n; i++) {
    const a = track.at((i + 0.5) * step);
    const brand = SPONSOR_BRANDS[i % SPONSOR_BRANDS.length];
    const sign = i % 2 ? 1 : -1;
    const pos = a.pos.clone().addScaledVector(a.side, sign * (track.halfWidth + 7));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: boardTexture(brand), toneMapped: false, side: THREE.DoubleSide,
    }));
    m.position.set(pos.x, 4.2, pos.z);
    // 法线朝向赛道内侧（否则牌面侧对镜头、看不见）
    m.rotation.y = Math.atan2(-sign * a.side.x, -sign * a.side.z) - sign * 0.22;
    scene.add(m);
    // 支架
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a3346, roughness: 0.8, metalness: 0.3 });
    for (const dx of [-2.6, 2.6]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.2, 0.25), legMat);
      leg.position.set(pos.x + Math.cos(m.rotation.y) * dx, 1.6, pos.z - Math.sin(m.rotation.y) * dx);
      scene.add(leg);
    }
  }
}

function ground(scene, theme) {
  const g = new THREE.Mesh(
    new THREE.PlaneGeometry(5000, 5000),
    new THREE.MeshStandardMaterial({
      color: theme.ground, roughness: theme.groundRough ?? 1, metalness: 0,
    })
  );
  g.rotation.x = -Math.PI / 2;
  g.position.y = -0.06;
  g.receiveShadow = true;
  scene.add(g);
}

/** 沿赛道挤出一条带状面（沙滩 / 路肩） */
function ribbon(scene, track, tFrom, tTo, color, y = -0.03, rough = 0.95) {
  const { n, halfWidth } = track;
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const a = track.samples[i % n];
    for (const t of [tFrom, tTo]) {
      const p = a.p.clone().addScaledVector(a.side, t);
      pos.push(p.x, y, p.z);
    }
    if (i < n) {
      const b = i * 2;
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 }));
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

// ---------------------------------------------------------------- 都市
function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0b1224'; g.fillRect(0, 0, 128, 256);
  const warm = ['#ffcf8a', '#ffe3b0', '#ffb45e'];
  const cool = ['#8fe9ff', '#b9f2ff', '#5fc6ff'];
  for (let y = 6; y < 250; y += 12) {
    for (let x = 6; x < 122; x += 11) {
      if (Math.random() < 0.42) continue;
      const pal = Math.random() < 0.55 ? warm : cool;
      g.fillStyle = pal[(Math.random() * pal.length) | 0];
      g.globalAlpha = 0.55 + Math.random() * 0.45;
      g.fillRect(x, y, 7, 7);
    }
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1.4, 2.2);
  return t;
}

function city(scene, track, theme) {
  const { n, halfWidth } = track;
  const dummy = new THREE.Object3D();

  // 建筑
  const bCount = 130;
  const bTex = windowTexture();
  const bMat = new THREE.MeshStandardMaterial({
    map: bTex, emissiveMap: bTex, emissive: 0xffffff, emissiveIntensity: 0.78,
    color: 0x4a5a80, roughness: 0.62, metalness: 0.35,
  });
  const buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bMat, bCount);
  for (let i = 0; i < bCount; i++) {
    const a = track.at((i / bCount) * track.length);
    const sign = i % 2 ? 1 : -1;
    const dist = halfWidth + 20 + ((i * 37) % 70);
    const p = a.pos.clone().addScaledVector(a.side, sign * dist);
    const h = 16 + ((i * 53) % 78);
    const w = 9 + ((i * 29) % 18);
    dummy.position.set(p.x, h / 2, p.z);
    dummy.rotation.set(0, Math.atan2(a.tan.x, a.tan.z) + (i % 3) * 0.2, 0);
    dummy.scale.set(w, h, w);
    dummy.updateMatrix();
    buildings.setMatrixAt(i, dummy.matrix);
  }
  scene.add(buildings);

  // 灯柱 + 灯头
  const step = Math.max(6, Math.round(26 / track.ds));
  const count = Math.floor(n / step) * 2;
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x24304f, roughness: 0.5, metalness: 0.7 });
  const pillars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 7.5, 0.45), pillarMat, count);
  const lampMat = new THREE.MeshBasicMaterial({ color: theme.neon, toneMapped: false });
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 8, 8), lampMat, count);
  let c = 0;
  for (let i = 0; i < n; i += step) {
    const a = track.samples[i];
    for (const sign of [-1, 1]) {
      const p = a.p.clone().addScaledVector(a.side, sign * (halfWidth + 2.6));
      dummy.position.set(p.x, 3.75, p.z);
      dummy.rotation.set(0, Math.atan2(a.tan.x, a.tan.z), 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      pillars.setMatrixAt(c, dummy.matrix);
      dummy.position.y = 7.4;
      dummy.updateMatrix();
      lamps.setMatrixAt(c, dummy.matrix);
      c++;
    }
  }
  pillars.count = c; lamps.count = c;
  scene.add(pillars, lamps);
}

// ---------------------------------------------------------------- 戈壁
function desert(scene, track, theme) {
  const dummy = new THREE.Object3D();
  const { halfWidth } = track;

  // 台地 / 孤峰
  const mesaMat = new THREE.MeshStandardMaterial({ color: 0x8a4630, roughness: 0.95, flatShading: true });
  const mesas = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.62, 1, 1, 7), mesaMat, 46);
  for (let i = 0; i < 46; i++) {
    const a = track.at((i / 46) * track.length);
    const sign = i % 2 ? 1 : -1;
    const dist = halfWidth + 120 + ((i * 61) % 220);
    const p = a.pos.clone().addScaledVector(a.side, sign * dist);
    const r = 16 + ((i * 41) % 40);
    const h = 18 + ((i * 67) % 52);
    dummy.position.set(p.x, h / 2 - 2, p.z);
    dummy.rotation.set(0, i * 0.7, 0);
    dummy.scale.set(r, h, r);
    dummy.updateMatrix();
    mesas.setMatrixAt(i, dummy.matrix);
  }
  scene.add(mesas);

  // 近处碎石
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a4a30, roughness: 1, flatShading: true });
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, 160);
  for (let i = 0; i < 160; i++) {
    const a = track.at((i / 160) * track.length);
    const sign = i % 2 ? 1 : -1;
    const p = a.pos.clone().addScaledVector(a.side, sign * (halfWidth + 4 + (i % 9) * 3));
    const s = 0.7 + ((i * 13) % 30) / 10;
    dummy.position.set(p.x, s * 0.4, p.z);
    dummy.rotation.set(i, i * 1.7, i * 0.3);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  scene.add(rocks);

  // 木桩 + 反光片（戈壁公路感）
  const step = Math.max(4, Math.round(34 / track.ds));
  const count = Math.floor(track.n / step) * 2;
  const postMat = new THREE.MeshStandardMaterial({ color: 0x5a4633, roughness: 0.9 });
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 1.15, 0.16), postMat, count);
  const reflMat = new THREE.MeshBasicMaterial({ color: theme.neon, toneMapped: false });
  const refl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.13, 0.05), reflMat, count);
  let c = 0;
  for (let i = 0; i < track.n; i += step) {
    const a = track.samples[i];
    for (const sign of [-1, 1]) {
      const p = a.p.clone().addScaledVector(a.side, sign * (halfWidth + 1.9));
      dummy.position.set(p.x, 0.58, p.z);
      dummy.rotation.set(0, Math.atan2(a.tan.x, a.tan.z), 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      posts.setMatrixAt(c, dummy.matrix);
      dummy.position.y = 1.12;
      dummy.updateMatrix();
      refl.setMatrixAt(c, dummy.matrix);
      c++;
    }
  }
  posts.count = c; refl.count = c;
  scene.add(posts, refl);
}

function palmGeometry() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.14, 0.24, 5.2, 5);
  trunk.translate(0, 2.6, 0);
  parts.push({ g: trunk, color: [0.42, 0.29, 0.19] });
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.ConeGeometry(0.3, 2.6, 4);
    frond.translate(0, 1.3, 0);
    frond.rotateZ(-1.25);
    frond.rotateY((i / 6) * Math.PI * 2);
    frond.translate(0, 5.2, 0);
    parts.push({ g: frond, color: i % 2 ? [0.16, 0.42, 0.22] : [0.21, 0.52, 0.28] });
  }
  // 合并并写入顶点色
  let total = 0;
  const geos = parts.map(({ g, color }) => {
    const ng = g.index ? g.toNonIndexed() : g;
    total += ng.attributes.position.count;
    return { ng, color };
  });
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const { ng, color } of geos) {
    pos.set(ng.attributes.position.array, o * 3);
    nor.set(ng.attributes.normal.array, o * 3);
    for (let i = 0; i < ng.attributes.position.count; i++) {
      col[(o + i) * 3] = color[0];
      col[(o + i) * 3 + 1] = color[1];
      col[(o + i) * 3 + 2] = color[2];
    }
    o += ng.attributes.position.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return merged;
}

// ---------------------------------------------------------------- 海岸
function coast(scene, track, theme) {
  const dummy = new THREE.Object3D();
  const { halfWidth } = track;

  // 沙滩带（路两侧）
  ribbon(scene, track, halfWidth + 0.2, halfWidth + 95, 0xd8b98a, -0.05, 1);
  ribbon(scene, track, -halfWidth - 95, -halfWidth - 0.2, 0xd8b98a, -0.05, 1);

  // 海面
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 6000),
    new THREE.MeshStandardMaterial({
      color: 0x2f93b8, roughness: 0.14, metalness: 0.25,
      envMapIntensity: 1.7,
    })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -1.1;
  scene.add(sea);

  // 椰树：合并成一个带顶点色的几何，1 次 draw call
  const palmGeo = palmGeometry();
  const palmMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true,
  });
  const N = 110;
  const palms = new THREE.InstancedMesh(palmGeo, palmMat, N);
  for (let i = 0; i < N; i++) {
    const a = track.at((i / N) * track.length);
    const sign = i % 2 ? 1 : -1;
    const p = a.pos.clone().addScaledVector(a.side, sign * (halfWidth + 8 + (i % 9) * 5));
    const h = 0.8 + ((i * 17) % 10) / 22;
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(0, i * 1.3, 0);
    dummy.scale.set(1, h, 1);
    dummy.updateMatrix();
    palms.setMatrixAt(i, dummy.matrix);
  }
  scene.add(palms);

  // 礁石
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6f6a63, roughness: 0.95, flatShading: true });
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, 70);
  for (let i = 0; i < 70; i++) {
    const a = track.at((i / 70) * track.length);
    const sign = i % 2 ? 1 : -1;
    const p = a.pos.clone().addScaledVector(a.side, sign * (halfWidth + 40 + (i % 11) * 9));
    const s = 2.5 + ((i * 23) % 45) / 6;
    dummy.position.set(p.x, s * 0.25 - 0.8, p.z);
    dummy.rotation.set(i, i * 1.3, i * 0.6);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  scene.add(rocks);

  // 路灯（白色，海边公路）
  const step = Math.max(6, Math.round(40 / track.ds));
  const count = Math.floor(track.n / step) * 2;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xdfe8ef, roughness: 0.4, metalness: 0.7 });
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.10, 0.13, 6.4, 6), poleMat, count);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2cc, toneMapped: false });
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 8, 8), lampMat, count);
  let c = 0;
  for (let i = 0; i < track.n; i += step) {
    const a = track.samples[i];
    for (const sign of [-1, 1]) {
      const p = a.p.clone().addScaledVector(a.side, sign * (halfWidth + 2.4));
      dummy.position.set(p.x, 3.2, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poles.setMatrixAt(c, dummy.matrix);
      dummy.position.y = 6.5;
      dummy.updateMatrix();
      lamps.setMatrixAt(c, dummy.matrix);
      c++;
    }
  }
  poles.count = c; lamps.count = c;
  scene.add(poles, lamps);
}
