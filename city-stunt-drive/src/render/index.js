// src/render/index.js — 3D 渲染：黄昏城市天台特技场 + 低多边形车 + 霓虹坡道 + 金币 + 粒子。
// 契约：createRenderer(canvas) → { render(run, dt), onEvent(ev), resize(w,h), dispose() }
import * as THREE from '../../lib/three.module.js';
import { loadModelData, tintModel } from '../../lib/model-loader-data.js';
import carData from '../../lib/models/car.glb.js';
import { RoomEnvironment } from '../../lib/RoomEnvironment.js';
import { CARS, CAMERA, TRACK, RAMPS, WORLD, VIEW } from '../../config/game.config.js';

const COL = { deep: 0x1a1f3a, orange: 0xff9f43, cyan: 0x22d3ee, gold: 0xffcf4d, road: 0x232840 };

export function createRenderer(canvas) {
  const probe = document.createElement('canvas').getContext('webgl');
  const dbg = probe && probe.getExtension('debug_renderer_info');
  const software = /swiftshader|llvmpipe|softpipe|software/i.test(String(dbg ? probe.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ''));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !software, powerPreference: 'high-performance' });
  renderer.setPixelRatio(software ? 0.66 : Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !software;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.deep);
  scene.fog = new THREE.Fog(COL.deep, 90, 320);
  // PBR 环境反射（车漆/金属质感的关键）
  { const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; }
  const camera = new THREE.PerspectiveCamera(CAMERA.fovBase, VIEW.W / VIEW.H, 0.1, 900);

  // 天空贴图（缺失回退深蓝紫渐变背景，不白屏）
  new THREE.TextureLoader().load('assets/sky.jpg', (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12),
      new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, depthWrite: false, fog: false }));
    s.renderOrder = -10;
    s.position.y = 40;
    scene.add(s);
    scene.background = new THREE.Color(0x2a2f52);
  }, undefined, () => {});

  // 灯光（黄昏：深蓝紫底 + 橙金主光 + 霓虹青边）
  scene.add(new THREE.HemisphereLight(0x8fb8ff, 0x1a1430, 0.75));
  const key = new THREE.DirectionalLight(0xffcf9f, 1.9);
  key.position.set(60, 110, 120);
  if (!software) { key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -60; key.shadow.camera.right = 60; key.shadow.camera.top = 80; key.shadow.camera.bottom = -40; key.shadow.camera.far = 400; key.shadow.bias = -0.0005; }
  scene.add(key);
  const rim = new THREE.DirectionalLight(COL.cyan, 1.1); rim.position.set(-40, 30, -60); scene.add(rim);

  // 纹理（缺失回退程序化色）
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function loadTex(url, repeat = false) {
    const t = loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return t;
  }
  const roadTex = loadTex('assets/tex/road.webp', true);
  const rampTex = loadTex('assets/tex/ramp.webp', true);

  // ---------------------------------------------------------------- 世界
  const world = new THREE.Group();
  scene.add(world);

  // 地面（天台深色）
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 1400),
    new THREE.MeshStandardMaterial({ color: COL.deep, roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.08, 200); ground.receiveShadow = true;
  world.add(ground);

  // 跑道
  const roadLen = TRACK.finishZ + 60;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(TRACK.halfWidth * 2, roadLen),
    new THREE.MeshStandardMaterial({ map: roadTex, color: 0xffffff, roughness: 0.85, metalness: 0.05 }));
  roadTex.repeat.set(1, roadLen / 6);
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, roadLen / 2 - 20); road.receiveShadow = true;
  world.add(road);

  // 坡道（霓虹边条）
  const rampMat = new THREE.MeshStandardMaterial({ map: rampTex, color: 0xffffff, roughness: 0.7, metalness: 0.1 });
  const neonMat = new THREE.MeshBasicMaterial({ color: COL.cyan, toneMapped: false });
  const neonMat2 = new THREE.MeshBasicMaterial({ color: COL.orange, toneMapped: false });
  for (const r of RAMPS) {
    const angle = Math.atan2(r.h, r.len);
    const hyp = Math.hypot(r.len, r.h);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(TRACK.halfWidth * 2, 0.32, hyp), rampMat);
    rampTex.repeat.set(1, 1);
    ramp.rotation.x = -angle;
    ramp.position.set(0, r.h / 2, r.z + r.len / 2);
    ramp.receiveShadow = true; ramp.castShadow = true;
    world.add(ramp);
    // 两侧霓虹边条
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, hyp + 0.6), side < 0 ? neonMat : neonMat2);
      edge.rotation.x = -angle;
      edge.position.set(side * (TRACK.halfWidth - 0.2), r.h / 2 + 0.12, r.z + r.len / 2);
      world.add(edge);
    }
  }

  // 冲线
  const finish = new THREE.Mesh(new THREE.PlaneGeometry(TRACK.halfWidth * 2, 3),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, toneMapped: false }));
  finish.rotation.x = -Math.PI / 2; finish.position.set(0, 0.03, TRACK.finishZ);
  world.add(finish);

  // 城市楼群（窗光纹理 InstancedMesh）
  const winTex = windowTexture();
  const bMat = new THREE.MeshStandardMaterial({ map: winTex, emissiveMap: winTex, emissive: 0xffffff, emissiveIntensity: 0.55, color: 0x3a4168, roughness: 0.7, metalness: 0.3 });
  const dummy = new THREE.Object3D();
  const bCount = 90;
  const buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bMat, bCount);
  for (let i = 0; i < bCount; i++) {
    const side = i % 2 ? 1 : -1;
    const z = -40 + (i / bCount) * (roadLen + 120);
    const dist = TRACK.halfWidth + 14 + ((i * 37) % 46);
    const h = 14 + ((i * 53) % 66);
    const w = 8 + ((i * 29) % 15);
    dummy.position.set(side * dist, h / 2, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(w, h, w);
    dummy.updateMatrix();
    buildings.setMatrixAt(i, dummy.matrix);
  }
  buildings.instanceMatrix.needsUpdate = true;
  world.add(buildings);

  // 金币
  const coinGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.18, 16);
  coinGeo.rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshStandardMaterial({ color: COL.gold, emissive: 0x8a6a00, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.9 });
  const coins = [];
  function syncCoins(run) {
    const track = run.track;
    for (let i = 0; i < track.coins.length; i++) {
      const c = track.coins[i];
      let m = coins[i];
      if (!m) { m = new THREE.Mesh(coinGeo, coinMat); world.add(m); coins.push(m); }
      m.visible = !c.taken;
      m.position.set(c.x, c.y, c.z);
    }
  }

  // 车辆网格：AI 生成 GLB 真模型（异步预载），加载完成前回退低多边形占位
  const carGroup = new THREE.Group();
  world.add(carGroup);
  let carSpecId = -1;
  let carModel = null;
  loadModelData(carData, { targetLen: 4.3, forward: '+z', key: 'car' }).then((m) => {
    carModel = m; carSpecId = -1;
  }).catch(() => { carModel = null; });
  function buildCar(carIndex) {
    if (carSpecId === carIndex) return;
    carSpecId = carIndex;
    while (carGroup.children.length) carGroup.remove(carGroup.children[0]);
    const spec = CARS[carIndex] || CARS[0];
    if (carModel) {
      const m = carModel.clone(true);
      m.traverse((o) => {
        if (o.isMesh && o.material) {
          o.material = o.material.clone();
          o.material.color = new THREE.Color(spec.tint).lerp(new THREE.Color(0xffffff), 0.2);
          o.material.metalness = Math.max(o.material.metalness ?? 0, 0.35);
          o.material.roughness = Math.min(o.material.roughness ?? 0.6, 0.55);
        }
      });
      carGroup.add(m);
      carGroup.userData.wheels = [];
      return;
    }
    const paint = new THREE.MeshStandardMaterial({ color: spec.tint, roughness: 0.35, metalness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0c1220, roughness: 0.5, metalness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.2, metalness: 0.8 });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff3d0, toneMapped: false });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 4.3), paint); body.position.y = 0.55; body.castShadow = true;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.0), glass); cabin.position.set(0, 1.05, -0.2);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.3, 0.5), paint); nose.position.set(0, 0.45, 2.15);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.5), dark); wing.position.set(0, 1.0, -2.0);
    carGroup.add(body, cabin, nose, wing);
    const hl = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.08), lightMat); hl.position.set(0, 0.62, 2.18);
    carGroup.add(hl);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 14); wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0c12, roughness: 0.8 });
    const wheels = [];
    for (const [x, z] of [[-1.05, 1.5], [1.05, 1.5], [-1.05, -1.5], [1.05, -1.5]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(x, 0.42, z);
      carGroup.add(w); wheels.push(w);
    }
    carGroup.userData.wheels = wheels;
  }

  // ---------------------------------------------------------------- 粒子
  const fx = createFX(scene);
  let shake = 0;

  function renderTitle(dt) {
    const a = performance.now() * 0.0002;
    const c = { x: 0, y: 1.0, z: 6 };
    camera.position.set(Math.sin(a) * 9, 4.5 + Math.sin(performance.now() * 0.0004) * 0.5, c.z + Math.cos(a) * 9);
    camera.lookAt(c.x, 1.0, c.z);
    camera.fov = 58; camera.updateProjectionMatrix();
  }

  function renderGame(run, dt) {
    buildCar(run.car);
    const p = run.player;
    const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    carGroup.position.set(p.x, p.y - 0.12, p.z);
    carGroup.rotation.order = 'YXZ';
    carGroup.rotation.set(p.pitch, p.yaw, p.roll);
    carGroup.userData.wheels.forEach((w) => { w.rotation.x += Math.max(0, p.vz) * dt * 2.0; });
    syncCoins(run);
    coins.forEach((m, i) => { if (m.visible) { m.rotation.z += dt * 3; } });

    const camDist = CAMERA.dist + (run.boostT > 0 ? 1.4 : 0);
    const target = new THREE.Vector3(p.x - fwd.x * camDist, p.y + CAMERA.height, p.z - fwd.z * camDist);
    if (shake > 0.01) { target.x += (Math.random() - 0.5) * shake; target.y += (Math.random() - 0.5) * shake * 0.5; shake *= Math.pow(0.02, dt); }
    camera.position.lerp(target, 1 - Math.exp(-CAMERA.posLerp * dt));
    const look = new THREE.Vector3(p.x + fwd.x * CAMERA.lookAhead, p.y + 1.0, p.z + fwd.z * CAMERA.lookAhead);
    camera.lookAt(look);
    const tfov = CAMERA.fovBase + Math.min(1, p.vz / 34) * CAMERA.fovSpeed + (run.boostT > 0 ? CAMERA.fovBoost : 0);
    camera.fov += (tfov - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();

    key.position.set(p.x + 60, 110, p.z + 80);
    key.target.position.set(p.x, 0, p.z + 20);
    key.target.updateMatrixWorld();

    // 氮气尾焰
    if (run.boostT > 0 && Math.random() < 0.7) {
      fx.spawn(p.x - fwd.x * 2.3, p.y - 0.1, p.z - fwd.z * 2.3, COL.cyan, { spread: 0.6, life: 0.35, vy: 0.4 });
    }
  }

  function render(run, dt) {
    dt = dt || 1 / 60;
    if (run) renderGame(run, dt); else renderTitle(dt);
    fx.tick(dt);
    renderer.render(scene, camera);
  }

  function onEvent(ev) {
    if (!ev) return;
    if (ev.type === 'perfect') fx.burst(0, 1.2, 0, COL.gold, 20, 6, 0.7, 'gold');
    else if (ev.type === 'badLand') { shake = Math.max(shake, 0.5); fx.burst(0, 0.5, 0, 0xd9d9e0, 12, 4, 0.5); }
    else if (ev.type === 'coin') fx.burst(0, 1.2, 0, COL.gold, 8, 3, 0.5, 'spark');
    else if (ev.type === 'wreck') { shake = Math.max(shake, 0.9); fx.burst(0, 1.0, 0, COL.orange, 26, 7, 0.8); }
    else if (ev.type === 'nitro') fx.burst(0, 0.6, 0, COL.cyan, 14, 4, 0.5, 'nitro');
  }

  function resize(w, h) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }

  function dispose() {
    scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh || o.isPoints) { o.geometry?.dispose?.(); const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((mm) => mm?.dispose?.()); } });
    renderer.dispose();
  }

  return { render, onEvent, resize, dispose };
}

// 粒子池
function createFX(scene) {
  const PMAX = 280;
  const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX), pVel = new Float32Array(PMAX * 3);
  for (let i = 0; i < PMAX; i++) { pLife[i] = 0; pPos[i * 3 + 1] = -999; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.45, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.0, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.6, depthWrite: false, vertexColors: true, sizeAttenuation: true }));
  points.frustumCulled = false;
  scene.add(points);
  let idx = 0;
  function spawn(x, y, z, color, opts = {}) {
    const i = idx = (idx + 1) % PMAX;
    const cc = color instanceof THREE.Color ? color : new THREE.Color(color);
    const { spread = 1.2, life = 0.7, vy = 0.6 } = opts;
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
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }
  return { spawn, burst, tick };
}

function windowTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0b1224'; g.fillRect(0, 0, 64, 128);
  const warm = ['#ffcf8a', '#ffe3b0', '#ffb45e'];
  const cool = ['#8fe9ff', '#b9f2ff', '#5fc6ff'];
  for (let y = 4; y < 124; y += 9) for (let x = 4; x < 60; x += 8) {
    if (Math.random() < 0.45) continue;
    const pal = Math.random() < 0.5 ? warm : cool;
    g.fillStyle = pal[(Math.random() * pal.length) | 0];
    g.globalAlpha = 0.5 + Math.random() * 0.5;
    g.fillRect(x, y, 5, 5);
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
