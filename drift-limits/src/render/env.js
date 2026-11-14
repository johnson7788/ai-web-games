// src/render/env.js — 静态世界：地面/路面贴图/护栏/霓虹边条/城市楼群/路灯。
import * as THREE from 'three';

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
  return t;
}

export function buildEnvironment(scene, track, theme, tex) {
  const { n, ds, halfWidth } = track;

  // 地面
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000),
    new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  scene.add(ground);

  // 路面（贴图 + 法线，沿弧长重复）
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const a = track.samples[i % n];
    const v = (i * ds) / 9;
    for (const [k, off] of [[0, -halfWidth], [1, halfWidth]]) {
      pos.push(a.x + a.sx * off, 0.02, a.z + a.sz * off);
      uv.push(k, v);
    }
    if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  roadGeo.setIndex(idx);
  roadGeo.computeVertexNormals();
  const road = new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({
    map: tex.road, normalMap: tex.roadN, normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.86, metalness: 0.04, color: 0xffffff,
  }));
  road.receiveShadow = true;
  scene.add(road);

  // 护栏（竖面，两侧）
  const railPos = [], railUv = [], railIdx = [];
  let vi = 0;
  for (const sign of [-1, 1]) {
    const start = vi;
    for (let i = 0; i <= n; i++) {
      const a = track.samples[i % n];
      const x = a.x + a.sx * sign * (halfWidth + 0.55);
      const z = a.z + a.sz * sign * (halfWidth + 0.55);
      railPos.push(x, 0, z, x, 0.95, z);
      railUv.push(0, (i * ds) / 6, 1, (i * ds) / 6);
      vi += 2;
    }
    for (let i = 0; i < n; i++) { const b = start + i * 2; railIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const railGeo = new THREE.BufferGeometry();
  railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPos, 3));
  railGeo.setAttribute('uv', new THREE.Float32BufferAttribute(railUv, 2));
  railGeo.setIndex(railIdx);
  railGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(railGeo, new THREE.MeshStandardMaterial({
    color: 0x141c2c, roughness: 0.98, metalness: 0.02,
    emissive: theme.neon, emissiveIntensity: 0.03, side: THREE.DoubleSide,
  })));

  // 霓虹边条（左右两色）
  for (const [sign, color] of [[-1, theme.neon], [1, theme.neon2]]) {
    const np = [], ni = [];
    for (let i = 0; i <= n; i++) {
      const a = track.samples[i % n];
      const ix = a.x + a.sx * sign * (halfWidth - 0.25), iz = a.z + a.sz * sign * (halfWidth - 0.25);
      const ox = a.x + a.sx * sign * (halfWidth + 0.12), oz = a.z + a.sz * sign * (halfWidth + 0.12);
      np.push(ix, 0.05, iz, ox, 0.05, oz);
      if (i < n) { const b = i * 2; ni.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(np, 3));
    geo.setIndex(ni);
    scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, toneMapped: false })));
  }

  // 起跑线
  const a0 = track.at(0);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(halfWidth * 2, 3),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, toneMapped: false }));
  line.rotation.x = -Math.PI / 2;
  line.rotation.z = -Math.atan2(a0.tx, a0.tz);
  line.position.set(a0.x, 0.03, a0.z);
  scene.add(line);

  // 城市楼群（窗光 canvas 纹理，InstancedMesh）
  const dummy = new THREE.Object3D();
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
    const h = 16 + ((i * 53) % 78);
    const w = 9 + ((i * 29) % 18);
    dummy.position.set(a.x + a.sx * sign * dist, h / 2, a.z + a.sz * sign * dist);
    dummy.rotation.set(0, Math.atan2(a.tx, a.tz) + (i % 3) * 0.2, 0);
    dummy.scale.set(w, h, w);
    dummy.updateMatrix();
    buildings.setMatrixAt(i, dummy.matrix);
  }
  buildings.instanceMatrix.needsUpdate = true;
  scene.add(buildings);

  // 路灯（灯柱 + 灯头，InstancedMesh）
  const step = Math.max(6, Math.round(26 / ds));
  const count = Math.floor(n / step) * 2;
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x24304f, roughness: 0.5, metalness: 0.7 });
  const pillars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 7.5, 0.45), pillarMat, count);
  const lampMat = new THREE.MeshBasicMaterial({ color: theme.neon, toneMapped: false });
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 8, 8), lampMat, count);
  let c = 0;
  for (let i = 0; i < n; i += step) {
    const a = track.samples[i];
    for (const sign of [-1, 1]) {
      const x = a.x + a.sx * sign * (halfWidth + 2.6);
      const z = a.z + a.sz * sign * (halfWidth + 2.6);
      dummy.position.set(x, 3.75, z);
      dummy.rotation.set(0, Math.atan2(a.tx, a.tz), 0);
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
  pillars.instanceMatrix.needsUpdate = true;
  lamps.instanceMatrix.needsUpdate = true;
  scene.add(pillars, lamps);
}
