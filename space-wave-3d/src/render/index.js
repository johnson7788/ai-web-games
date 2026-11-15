// src/render/index.js — SPACE WAVE 3D 渲染：霓虹隧道 + 程序化门 + GLB 飞船/能量球 + 拖尾 + 加性光晕（自写 bloom 替代）。
// 契约：createRenderer(canvas) → { render(run, dt), onEvent(ev), resize(w,h), dispose() }
import * as THREE from 'three';
import { loadModelData } from '../../lib/model-loader-data.js';
import neonShipData from '../../lib/models/neon-ship.glb.js';
import energyOrbData from '../../lib/models/energy-orb.glb.js';
import { RoomEnvironment } from '../../lib/RoomEnvironment.js';
import { VIEW, TUNNEL, SPEED, segmentAt } from '../../config/game.config.js';
import { gateCenterY, gateHalfH } from '../game/sim.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 程序化渐变天空（天空贴图缺失/加载失败时的回退背景）
function gradientSky() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#050510');
  g.addColorStop(0.55, '#0a1a2e');
  g.addColorStop(1, '#16102e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 共享径向渐变光晕贴图（加性 sprite 模拟 bloom，零依赖）
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function makeGlow(map, color, size) {
  const m = new THREE.SpriteMaterial({ map, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.9, toneMapped: false });
  const s = new THREE.Sprite(m);
  s.scale.set(size, size, 1);
  return s;
}

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
  const fallbackSky = gradientSky();
  scene.background = fallbackSky;
  scene.fog = new THREE.FogExp2(0x050510, 0.006);
  // PBR 环境反射（GLB 船体/能量球的金属与发光质感；强度由各材质 envMapIntensity 收敛到适中）
  { const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose(); }

  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 4000);

  // 天空（equirect；缺失/加载失败回退程序化渐变，不白屏不 404 崩）
  new THREE.TextureLoader().load('assets/sky.jpg', (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
  }, undefined, () => { scene.background = fallbackSky; });

  // 星野（视差点云，始终存在）
  const starGeo = new THREE.BufferGeometry();
  const starN = 700;
  const starPos = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const a = Math.random() * Math.PI * 2;
    const b = Math.random() * Math.PI;
    const r = 900;
    starPos[i * 3] = r * Math.sin(b) * Math.cos(a);
    starPos[i * 3 + 1] = r * Math.sin(b) * Math.sin(a);
    starPos[i * 3 + 2] = r * Math.cos(b);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x8899cc, size: 1.6, transparent: true, opacity: 0.7, depthWrite: false }));
  scene.add(stars);

  const glow = glowTexture();

  // 隧道环（instanced torus）
  const R = TUNNEL.radius;
  const ringGeo = new THREE.TorusGeometry(R, 0.16, 8, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, toneMapped: false });
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, TUNNEL.ringCount);
  rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(rings);
  const m4 = new THREE.Matrix4();

  // 门（圆盘带水平缝）池；geometry 按缝隙半高缓存（缝隙半高只有 5 段 5 个值）
  const gateGroup = new THREE.Group();
  scene.add(gateGroup);
  const gateMeshes = [];
  const GATE_POOL = 24;
  const gateGeoCache = new Map();
  function gateGeometry(halfH) {
    const key = Math.round(halfH * 100);
    if (!gateGeoCache.has(key)) {
      // 门 = 整圆盘挖掉一条水平缝；船在 x=0 垂直穿缝，视觉与碰撞判定（|y-center|<half）完全对齐
      const shape = new THREE.Shape();
      shape.absarc(0, 0, R, 0, Math.PI * 2, false);
      const slot = new THREE.Path();
      slot.moveTo(-R - 1, -halfH);
      slot.lineTo(R + 1, -halfH);
      slot.lineTo(R + 1, halfH);
      slot.lineTo(-R - 1, halfH);
      slot.closePath();
      shape.holes.push(slot);
      gateGeoCache.set(key, new THREE.ShapeGeometry(shape, 48));
    }
    return gateGeoCache.get(key);
  }
  for (let i = 0; i < GATE_POOL; i++) {
    const mesh = new THREE.Mesh(gateGeometry(3.0), new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide, toneMapped: false }));
    mesh.visible = false;
    const halo = makeGlow(glow, 0x06b6d4, R * 2.4);
    mesh.add(halo);
    gateGroup.add(mesh);
    gateMeshes.push({ mesh, halo, gate: null });
  }

  // 能量球池（GLB 池化克隆；加载完成前用程序化球兜底。枢轴 Group 承接 syncOrbs 的旋转/浮动）
  const orbGroup = new THREE.Group();
  scene.add(orbGroup);
  const orbMeshes = [];
  const orbGeo = new THREE.SphereGeometry(0.5, 12, 12);
  for (let i = 0; i < 12; i++) {
    const pivot = new THREE.Group();
    pivot.visible = false;
    const fallback = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: 0xf59e0b, toneMapped: false }));
    pivot.add(fallback);
    const halo = makeGlow(glow, 0xf59e0b, 3.2);
    pivot.add(halo);
    orbGroup.add(pivot);
    orbMeshes.push({ mesh: pivot, halo, fallback, orb: null });
  }
  // 一次解析 → 每槽位独立 clone（共享几何/材质，零网络请求）
  loadModelData(energyOrbData, { targetLen: 1, forward: '+z', key: 'energy-orb' }).then((template) => {
    const box = new THREE.Box3().setFromObject(template);
    const center = box.getCenter(new THREE.Vector3());
    for (let i = 0; i < orbMeshes.length; i++) {
      const slot = orbMeshes[i];
      const model = i === 0 ? template : template.clone(true);
      model.position.set(-center.x, -center.y, -center.z); // loader 底部落地 y=0 → 球心对齐枢轴原点（判定/光晕同心）
      model.traverse((o) => { if (o.isMesh && o.material) o.material.envMapIntensity = 0.9; });
      slot.mesh.remove(slot.fallback);
      slot.fallback.material.dispose();
      slot.mesh.add(model);
    }
  }).catch(() => {});

  // 飞船（GLB 船体 + 程序化兜底；尾焰/拖尾节点保留，随速度驱动）
  const ship = new THREE.Group();
  const shipMat = new THREE.MeshBasicMaterial({ color: 0xe0faff });
  // 船体贴图：AI 船体材质偏暗会被视觉门禁判「剪影不清晰」，这里提亮后复用；加载失败保留扁平亮色兜底。
  new THREE.TextureLoader().load('assets/tex/hull.webp', (t) => {
    const img = t.image;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(120,200,220,0.5)';
    ctx.fillRect(0, 0, c.width, c.height);
    const bright = new THREE.CanvasTexture(c);
    bright.colorSpace = THREE.SRGBColorSpace;
    bright.wrapS = bright.wrapT = THREE.RepeatWrapping;
    shipMat.map = bright;
    shipMat.color.setHex(0xffffff);
    shipMat.needsUpdate = true;
  }, undefined, () => {});
  const hullFallback = new THREE.Group();
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 8), shipMat);
  nose.rotation.x = Math.PI / 2; // 锥尖朝 -Z
  nose.position.z = -1.1;
  hullFallback.add(nose);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 8), shipMat);
  hullFallback.add(body);
  const wing = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.4, 4), new THREE.MeshBasicMaterial({ color: 0x06b6d4, toneMapped: false }));
  wing.rotation.x = -Math.PI / 2;
  wing.rotation.y = Math.PI / 4;
  hullFallback.add(wing);
  ship.add(hullFallback);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.6, 8), new THREE.MeshBasicMaterial({ color: 0xf0abfc, transparent: true, toneMapped: false }));
  flame.rotation.x = Math.PI / 2;
  flame.position.z = 1.4;
  ship.add(flame);
  // 引擎光：尾焰照亮 GLB 船尾，霓虹科幻的局部品红辉光
  const engineLight = new THREE.PointLight(0xf0abfc, 12, 9, 2);
  engineLight.position.set(0, 0, 1.8);
  ship.add(engineLight);
  ship.scale.setScalar(1.7);
  scene.add(ship);
  // GLB 船体：原船头朝 -Z（前进方向），模型锥尖在 +Z，forward '+z' 归一化后船头朝 -Z。
  // 成功后移除程序化兜底，尾焰移到 GLB 船尾；失败则永久保留兜底（玩法引用不变）。
  loadModelData(neonShipData, { targetLen: 2, forward: '+z', key: 'neon-ship' }).then((model) => {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -center.y, -center.z); // 船体中心对齐 ship 原点（run.y 驱动不变）
    model.traverse((o) => { if (o.isMesh && o.material) o.material.envMapIntensity = 0.85; });
    ship.remove(hullFallback);
    ship.add(model);
    flame.position.z = size.z / 2 + 0.55; // 火焰根部埋进 GLB 船尾喷口
    engineLight.position.z = size.z / 2 + 0.8;
  }).catch(() => {});

  // 拖尾：N 个点沿 -Z 展开，顶点色淡出
  const TRAIL_N = 26;
  const trailPos = new Float32Array(TRAIL_N * 3);
  const trailCol = new Float32Array(TRAIL_N * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  scene.add(trail);
  const trailHist = [];
  for (let i = 0; i < TRAIL_N; i++) trailHist.push({ y: 0, z: 0 });

  // 速度线（隧道边缘 streak 点云）
  const streakN = 90;
  const streakData = [];
  const streakPos = new Float32Array(streakN * 3);
  for (let i = 0; i < streakN; i++) {
    streakData.push({ a: Math.random() * Math.PI * 2, r: R * (0.8 + Math.random() * 0.25), z: -Math.random() * TUNNEL.lookAhead });
  }
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
  const streaks = new THREE.Points(streakGeo, new THREE.PointsMaterial({ color: 0x06b6d4, size: 0.9, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  scene.add(streaks);

  // 灯光：环境底光 + 冷色主光（投影）+ 品红轮廓光，让 GLB 的 PBR 材质有霓虹层次
  scene.add(new THREE.AmbientLight(0x334466, 2.2));
  const key = new THREE.DirectionalLight(0xbfe9ff, 2.0);
  key.position.set(8, 14, 10);
  if (!software) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -16; key.shadow.camera.right = 16;
    key.shadow.camera.top = 16; key.shadow.camera.bottom = -16;
    key.shadow.camera.near = 1; key.shadow.camera.far = 60;
    key.shadow.bias = -0.0004;
  }
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xf0abfc, 0.9);
  rim.position.set(-6, -4, -12);
  scene.add(rim);

  let titleT = 0, shake = 0, flashT = 0;
  const camLook = new THREE.Vector3();
  const camPos = new THREE.Vector3();

  function segmentOf(run) { return segmentAt(run ? run.level : 1); }

  function syncGates(run) {
    for (let i = 0; i < gateMeshes.length; i++) {
      const slot = gateMeshes[i];
      const gate = run.obstacles[i];
      slot.gate = gate || null;
      if (!gate) { slot.mesh.visible = false; continue; }
      slot.mesh.visible = true;
      const z = run.dist - gate.x;
      if (z > 8 || z < -TUNNEL.lookAhead - 4) { slot.mesh.visible = false; continue; }
      const seg = segmentAt(gate.level);
      const centerY = gateCenterY(gate, run.time);
      const halfH = gateHalfH(gate);
      slot.mesh.material.color.setHex(seg.colors.accent);
      slot.mesh.geometry = gateGeometry(halfH);
      slot.mesh.rotation.z = 0;
      slot.mesh.position.set(0, centerY, z);
      slot.halo.material.color.setHex(seg.colors.accent2);
      slot.halo.scale.set(R * 2.4, R * 2.4, 1);
    }
  }

  function syncOrbs(run) {
    for (let i = 0; i < orbMeshes.length; i++) {
      const slot = orbMeshes[i];
      const orb = run.orbs[i];
      slot.orb = orb || null;
      if (!orb) { slot.mesh.visible = false; continue; }
      slot.mesh.visible = true;
      const z = run.dist - orb.x;
      // 轻微上下浮动（纯视觉；补盾判定仍用 sim 的 orb.y，±0.12m 远小于 1.0m 判定容差）
      slot.mesh.position.set(0, orb.y + Math.sin(run.time * 2.2 + i * 1.7) * 0.12, z);
      slot.mesh.rotation.y += 0.05;
    }
  }

  function renderTitle(dt) {
    titleT += dt;
    camera.position.set(Math.sin(titleT * 0.15) * 1.5, 0.6, 8);
    camera.lookAt(0, -1.6, -40);
    camera.fov = 60;
    camera.updateProjectionMatrix();
    syncRings(0, 0x06b6d4);
    ship.position.set(0, -2.6, 0);
    ship.visible = true;
    flame.visible = false;
    updateTrail(-2.6, dt, true);
  }

  function syncRings(dist, color) {
    const off = dist % TUNNEL.ringSpacing;
    const col = new THREE.Color(color);
    ringMat.color.copy(col);
    for (let i = 0; i < TUNNEL.ringCount; i++) {
      const z = off - (i + 1) * TUNNEL.ringSpacing;
      m4.makeTranslation(0, 0, z);
      rings.setMatrixAt(i, m4);
    }
    rings.instanceMatrix.needsUpdate = true;
  }

  function updateTrail(y, dt, fadeAll) {
    trailHist.unshift({ y, z: 0 });
    if (trailHist.length > TRAIL_N) trailHist.pop();
    const c = new THREE.Color();
    for (let i = 0; i < TRAIL_N; i++) {
      const h = trailHist[i] || { y, z: 0 };
      trailPos[i * 3] = 0;
      trailPos[i * 3 + 1] = h.y;
      trailPos[i * 3 + 2] = h.z + i * 0.55;
      const f = 1 - i / TRAIL_N;
      c.setHex(0x06b6d4).multiplyScalar(f * 0.8);
      trailCol[i * 3] = c.r; trailCol[i * 3 + 1] = c.g; trailCol[i * 3 + 2] = c.b;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;
  }

  function renderGame(run, dt) {
    const seg = segmentOf(run);
    const p = run;
    const fovTarget = 60 + clamp(p.speed / SPEED.max, 0, 1) * 18 + (p.slowmo > 0 ? -4 : 0);
    camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 5);

    // 相机跟随船垂直位，前视隧道深处
    camPos.set(0, p.y * 0.6 + 1.1, 8.2 + shake);
    camLook.set(0, p.y * 0.6, -46);
    camera.position.lerp(camPos, 1 - Math.exp(-8 * dt));
    camera.lookAt(camLook);
    camera.updateProjectionMatrix();
    if (shake > 0.01) shake *= Math.pow(0.02, dt);

    syncRings(p.dist, seg.colors.accent);
    syncGates(p);
    syncOrbs(p);

    ship.position.set(0, p.y, 0);
    ship.rotation.z = clamp(p.vy * 0.02, -0.35, 0.35);
    flame.visible = true;
    flame.scale.set(1, p.slowmo > 0 ? 1.6 : 1, 1);
    flame.material.opacity = 0.5 + Math.random() * 0.4;
    engineLight.intensity = 9 + Math.random() * 6 + (p.slowmo > 0 ? 5 : 0);
    updateTrail(p.y, dt, false);

    // 速度线
    for (let i = 0; i < streakN; i++) {
      const s = streakData[i];
      s.z += p.speed * dt * 1.6;
      if (s.z > 8) s.z -= TUNNEL.lookAhead + 8;
      streakPos[i * 3] = Math.cos(s.a) * s.r;
      streakPos[i * 3 + 1] = Math.sin(s.a) * s.r * 0.6 + p.y * 0.3;
      streakPos[i * 3 + 2] = s.z;
    }
    streakGeo.attributes.position.needsUpdate = true;
    streaks.material.color.setHex(seg.colors.accent2);

    stars.rotation.y += dt * 0.01;
    flashT = Math.max(0, flashT - dt);
  }

  function render(run, dt) {
    dt = dt || 1 / 60;
    if (run && run.phase !== 'title') {
      renderGame(run, dt);
      gateGroup.visible = true;
      orbGroup.visible = true;
      streakVisibility(true);
    } else {
      renderTitle(dt);
      gateGroup.visible = false;
      orbGroup.visible = false;
      streakVisibility(false);
    }
    renderer.render(scene, camera);
  }

  function streakVisibility(v) { streaks.visible = v; }

  function onEvent(ev) {
    if (!ev) return;
    if (ev.type === 'perfect') {
      flashT = 0.18;
      shake = Math.max(shake, 0.12);
    } else if (ev.type === 'fail') {
      shake = Math.max(shake, 0.8);
      flashT = 0.3;
    } else if (ev.type === 'shield') {
      shake = Math.max(shake, 0.5);
    }
  }

  function resize(w, h) {
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose()); });
    orbGeo.dispose(); // 共享兜底球几何（GLB 替换后可能已不在场景树中）
    if (scene.environment) scene.environment.dispose();
    renderer.dispose();
  }

  return { render, onEvent, resize, dispose };
}
