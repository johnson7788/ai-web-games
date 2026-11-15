// src/render/index.js — 3D 渲染：无限直路 + 车流 + 第一人称车把 + 后视镜 + 速度线 + 昼/夜。
// 契约：createRenderer(canvas) → { render(run, dt, view), onEvent(ev), resize(w, h), dispose() }
// AI 素材接线：sky.jpg → 天空全景；tex/road.webp → 路面；tex/cockpit.webp → 驾驶舱。
// 任一加载失败回退程序化（渐变天空/纯色路面/纯色舱板），不白屏不报错。
import { THREE, clamp, lerp, Pool } from '../core/base3d.js';
import { loadModelData } from '../../lib/model-loader-data.js';
import trafficCarData from '../../lib/models/traffic-car.glb.js';
import trafficTruckData from '../../lib/models/traffic-truck.glb.js';
import motoCockpitData from '../../lib/models/moto-cockpit.glb.js';
import { MOTO, ROAD, TRAFFIC, SEGMENTS } from '../../config/game.config.js';

const CAR_COLORS = [0xe74c3c, 0x3498db, 0xf1c40f, 0xf5f5f5, 0x2ecc71, 0x9b59b6];
const TRUCK_COLORS = [0xc0392b, 0x2980b9, 0x7f8c8d, 0x27ae60, 0xd35400, 0x8e44ad];
const LANE_DASH = 0xffffff;
const LANE_EDGE = 0xffffff;
const LANE_CENTER = 0xf0c40a;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  if ('useLegacyLights' in renderer) renderer.useLegacyLights = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(MOTO.fovBase, 16 / 9, 0.1, 1500);
  camera.position.set(0, 1.55, 0);

  // 灯光（随昼夜调强度）
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x3a2f24, 1.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(30, 70, -60);
  scene.add(sun);

  // ---------- 素材加载（AI 贴图挂载；加载失败保持程序化色板，不白屏不报错） ----------
  const texLoader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function mapTex(url, mat, { repeat = null } = {}) {
    const t = texLoader.load(url, () => {
      t.colorSpace = THREE.SRGBColorSpace;
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
      mat.map = t; mat.color.setHex(0xffffff); mat.needsUpdate = true;
    }, undefined, () => { /* 加载失败：保持程序化色板 */ });
    t.anisotropy = maxAniso;
    return t;
  }

  // 天空：sky.jpg 全景（Equirectangular）→ scene.background；缺失回退程序化渐变
  const skyGrad = (() => {
    const c = document.createElement('canvas'); c.width = 16; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#5aa8d8'); gr.addColorStop(0.55, '#a5d8ef'); gr.addColorStop(1, '#d9eaf3');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  scene.background = skyGrad;
  texLoader.load('assets/sky.jpg', (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
  }, undefined, () => { /* 保持程序化渐变 */ });

  // ---------- 地面 + 路面（road.webp 平铺路面，缺失回退纯色沥青） ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshLambertMaterial({ color: 0x2b2f36 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.06, -200);
  scene.add(ground);

  const roadLen = ROAD.visibleAhead + ROAD.visibleBehind;
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const roadTex = mapTex('assets/tex/road.webp', roadMat, { repeat: [(ROAD.halfWidth * 2 + 2.4) / 4, roadLen / 4] });
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD.halfWidth * 2 + 2.4, roadLen),
    roadMat,
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, (ROAD.visibleBehind - ROAD.visibleAhead) / 2);
  scene.add(road);

  // ---------- 车道线（canvas 纹理滚动） ----------
  function dashTex(solid) {
    const c = document.createElement('canvas'); c.width = 32; c.height = 256;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 32, 256);
    if (solid) { g.fillStyle = '#f5f5f5'; g.fillRect(0, 0, 32, 256); }
    else {
      g.fillStyle = '#f5f5f5';
      for (let y = 0; y < 256; y += 64) g.fillRect(6, y, 20, 40);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function lineTex(color) {
    const c = document.createElement('canvas'); c.width = 4; c.height = 4;
    const g = c.getContext('2d');
    g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.fillRect(0, 0, 4, 4);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function makeLine(x, width, color, { dash = false, center = false } = {}) {
    const tex = dash ? dashTex(false) : (center ? lineTex(color) : lineTex(color));
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(width, roadLen),
      new THREE.MeshBasicMaterial({ map: tex, transparent: dash, toneMapped: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.02, (ROAD.visibleBehind - ROAD.visibleAhead) / 2);
    m.userData.tex = tex;
    scene.add(m);
    return m;
  }
  const lines = [
    makeLine(-ROAD.halfWidth - 0.3, 0.18, LANE_EDGE),
    makeLine(ROAD.halfWidth + 0.3, 0.18, LANE_EDGE),
    makeLine(-ROAD.laneWidth, 0.16, LANE_DASH, { dash: true }),
    makeLine(ROAD.laneWidth, 0.16, LANE_DASH, { dash: true }),
    makeLine(-0.12, 0.12, LANE_CENTER, { center: true }),
    makeLine(0.12, 0.12, LANE_CENTER, { center: true }),
  ];

  // ---------- 护栏（两侧连续，提供速度参照） ----------
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.65, roadLen),
      new THREE.MeshLambertMaterial({ color: 0x9aa2ad }),
    );
    rail.position.set(s * (ROAD.halfWidth + 1.5), 0.3, (ROAD.visibleBehind - ROAD.visibleAhead) / 2);
    scene.add(rail);
  }

  // ---------- 车流网格（对象池：小汽车 + 卡车） ----------
  function buildVehicle(isTruck) {
    const g = new THREE.Group();
    const bodyColor = isTruck ? TRUCK_COLORS[(Math.random() * TRUCK_COLORS.length) | 0] : CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0];
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.3 });
    g.userData.bodyMat = bodyMat;
    // 程序化占位（GLB 加载完成后移除）
    const fallback = new THREE.Group();
    if (isTruck) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.5, TRAFFIC.truckLen), bodyMat);
      box.position.y = 1.45; fallback.add(box);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.3, 1.9), new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
      cab.position.set(0, 0.75, TRAFFIC.truckLen / 2 - 0.5); fallback.add(cab);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, TRAFFIC.carLen), bodyMat);
      body.position.y = 0.5; fallback.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.5, 1.9), new THREE.MeshLambertMaterial({ color: 0x141b26 }));
      cabin.position.set(0, 0.95, -0.3); fallback.add(cabin);
    }
    g.add(fallback);
    // 尾灯（发光）
    const tail = new THREE.Mesh(new THREE.BoxGeometry(isTruck ? 2.0 : 1.5, 0.14, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false }));
    tail.position.set(0, isTruck ? 1.1 : 0.62, -(isTruck ? TRAFFIC.truckLen / 2 : TRAFFIC.carLen / 2));
    g.add(tail);
    // 前灯（夜间可见）
    const head = new THREE.Mesh(new THREE.BoxGeometry(isTruck ? 2.0 : 1.5, 0.14, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, toneMapped: false }));
    head.position.set(0, isTruck ? 1.1 : 0.6, (isTruck ? TRAFFIC.truckLen / 2 : TRAFFIC.carLen / 2));
    g.add(head);
    // AI 高精度车模（data-URI），保留 bodyMat 供 syncTraffic 每帧改色
    loadModelData(isTruck ? trafficTruckData : trafficCarData, { targetLen: isTruck ? TRAFFIC.truckLen : TRAFFIC.carLen, forward: '+z', key: isTruck ? 'truck' : 'car' }).then((model) => {
      model.traverse((o) => { if (o.isMesh) { if (o.material && o.material.map) bodyMat.map = o.material.map; o.material = bodyMat; } });
      bodyMat.needsUpdate = true;
      g.remove(fallback);
      g.add(model);
    }).catch(() => {});
    return g;
  }
  const carPool = new Pool(() => buildVehicle(false), (o) => { o.visible = true; }, TRAFFIC.max);
  const truckPool = new Pool(() => buildVehicle(true), (o) => { o.visible = true; }, TRAFFIC.max);
  const activeMeshes = new Map();

  function syncTraffic(run) {
    const seen = new Set();
    for (const c of run.traffic) {
      let mesh = activeMeshes.get(c);
      if (!mesh) {
        mesh = (c.isTruck ? truckPool : carPool).get();
        activeMeshes.set(c, mesh);
        scene.add(mesh);
      }
      seen.add(c);
      mesh.position.set(c.x, 0, -c.z);
      mesh.rotation.y = c.dir === -1 ? Math.PI : 0;
      mesh.userData.bodyMat.color.setHex((c.isTruck ? TRUCK_COLORS : CAR_COLORS)[c.color % (c.isTruck ? TRUCK_COLORS.length : CAR_COLORS.length)]);
    }
    for (const [c, m] of activeMeshes) {
      if (!seen.has(c)) { (c.isTruck ? truckPool : carPool).release(m); activeMeshes.delete(c); }
    }
  }

  // ---------- 第一人称车把 / 油箱 ----------
  const bike = new THREE.Group();
  {
    const fallback = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.86, 10),
      new THREE.MeshLambertMaterial({ color: 0x14181e }));
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.06, 0);
    fallback.add(bar);
    for (const s of [-1, 1]) {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 10),
        new THREE.MeshLambertMaterial({ color: 0x1a1d22 }));
      grip.rotation.z = Math.PI / 2;
      grip.position.set(s * 0.43, 0.06, 0);
      fallback.add(grip);
    }
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.1), new THREE.MeshLambertMaterial({ color: 0x2a2f36 }));
    stem.position.set(0, -0.08, 0); fallback.add(stem);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.28, 0.8), new THREE.MeshLambertMaterial({ color: 0xff7a1a }));
    tank.position.set(0, -0.16, -0.15); fallback.add(tank);
    bike.add(fallback);
    loadModelData(motoCockpitData, { targetLen: 0.5, forward: '-z', key: 'cockpit' }).then((model) => {
      model.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.metalness = Math.max(o.material.metalness ?? 0, 0.3); o.material.roughness = Math.min(o.material.roughness ?? 0.5, 0.5); } });
      model.position.set(0, -0.3, -0.3);
      bike.remove(fallback);
      bike.add(model);
    }).catch(() => {});
  }
  bike.position.set(0, -0.42, -0.55);
  camera.add(bike);
  scene.add(camera);

  // ---------- 速度线 ----------
  const SL = 90;
  const slPos = new Float32Array(SL * 3);
  for (let i = 0; i < SL; i++) {
    slPos[i * 3] = (Math.random() * 2 - 1) * 14;
    slPos[i * 3 + 1] = (Math.random() * 2 - 1) * 7;
    slPos[i * 3 + 2] = -Math.random() * 110;
  }
  const slGeo = new THREE.BufferGeometry();
  slGeo.setAttribute('position', new THREE.BufferAttribute(slPos, 3));
  const slMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0, depthWrite: false });
  const speedlines = new THREE.Points(slGeo, slMat);
  speedlines.frustumCulled = false;
  camera.add(speedlines);

  // ---------- 昼夜主题插值 ----------
  const theme = { sky: 0x7ec8e3, fog: 0xa5d8ef, ground: 0x2b2f36, sun: 2.0, hemi: 1.0, skyI: 1.0, night: false };
  const themeTarget = { ...theme };
  scene.fog = new THREE.Fog(theme.sky, 60, 420);

  function updateTheme(run) {
    const seg = SEGMENTS[run?.segment ?? 0] || SEGMENTS[0];
    themeTarget.sky = seg.sky; themeTarget.fog = seg.fog; themeTarget.ground = seg.ground;
    themeTarget.sun = seg.sun; themeTarget.hemi = seg.hemi; themeTarget.skyI = seg.skyI ?? 1.0; themeTarget.night = !!seg.night;
    const k = Math.min(1, 3 / 60); // 每帧平滑
    for (const key of ['sky', 'fog', 'ground', 'sun', 'hemi', 'skyI']) theme[key] = lerp(theme[key], themeTarget[key], k);
    theme.night = themeTarget.night;
    scene.backgroundIntensity = theme.skyI; // 天空贴图/渐变随昼夜压暗
    scene.fog.color.setHex(theme.fog);
    ground.material.color.setHex(theme.ground);
    hemi.intensity = theme.hemi;
    sun.intensity = theme.sun;
  }

  // ---------- 相机 / 抖动 ----------
  let shake = 0;
  const baseFov = MOTO.fovBase;

  function render(run, dt, view = 'game') {
    dt = dt || 1 / 60;
    if (run) updateTheme(run);

    const speed = run ? run.player.speed : 0;
    const speedF = Math.min(1, speed / MOTO.topSpeed);
    const steer = run ? (run.player.steer ?? 0) : 0;

    // 相机
    camera.fov = lerp(baseFov, MOTO.fovTop, speedF);
    camera.rotation.set(lerp(-0.02, -0.06, speedF), 0, -steer * 0.1);
    if (shake > 0.01) {
      camera.position.x = (Math.random() - 0.5) * shake;
      camera.position.y = 1.55 + (Math.random() - 0.5) * shake * 0.5;
      shake *= Math.pow(0.02, dt);
    } else {
      camera.position.x = 0; camera.position.y = 1.55;
    }
    camera.updateProjectionMatrix();

    if (run) {
      // 车道线 + 路面贴图滚动（速度感，同相位）
      const off = (run.player.distance * 0.16) % 1;
      for (const ln of lines) ln.userData.tex.offset.y = off;
      roadTex.offset.y = off;
      syncTraffic(run);
    }

    // 速度线
    const slOn = speedF > 0.42 ? speedF : 0;
    slMat.opacity = slOn * 0.55;
    if (slOn > 0) {
      const arr = slGeo.attributes.position.array;
      const boost = 30 + speed * 1.1;
      for (let i = 0; i < SL; i++) {
        arr[i * 3 + 2] += boost * dt;
        if (arr[i * 3 + 2] > 4) { arr[i * 3 + 2] = -100 - Math.random() * 20; arr[i * 3] = (Math.random() * 2 - 1) * 15; arr[i * 3 + 1] = (Math.random() * 2 - 1) * 8; }
      }
      slGeo.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }

  function onEvent(ev) {
    if (!ev) return;
    if (ev.type === 'crash') shake = Math.max(shake, 0.7);
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = 16 / 9;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    scene.traverse((o) => { if (o.isMesh || o.isPoints) { o.geometry?.dispose?.(); const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((x) => x?.dispose?.()); } });
    renderer.dispose();
  }

  return { render, onEvent, resize, dispose };
}
