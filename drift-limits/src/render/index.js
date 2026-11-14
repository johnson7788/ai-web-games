// src/render/index.js — M2 完整渲染：夜城环线 + 玩家车 + 警车/车流/路障 + 粒子 + 相机。
// 契约：createRenderer(canvas) → { render(run, dt), onEvent(ev), resize(w, h), dispose() }
import * as THREE from 'three';
import { CAR, CAMERA, CARS, TRACK_DEF } from '../../config/game.config.js';
import { createTrack } from '../game/track.js';
import { buildEnvironment } from './env.js';
import { buildCarMesh, buildCopMesh, buildTrafficMesh, buildBlockMesh } from './car.js';
import { createFX } from './fx.js';

export function createRenderer(canvas) {
  // 软件渲染（headless/无 GPU）探针：直接低画质起步，避免首帧编译阻塞逻辑
  const probe = document.createElement('canvas').getContext('webgl');
  const dbgInfo = probe && probe.getExtension('debug_renderer_info');
  const software = /swiftshader|llvmpipe|softpipe|software/i.test(String(dbgInfo ? probe.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : ''));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !software, powerPreference: 'high-performance' });
  renderer.setPixelRatio(software ? 0.66 : Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !software;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const theme = TRACK_DEF.theme;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(56, 16 / 9, 0.1, 4000);

  // 天空 + PMREM 环境反射；缺图时回退纯色夜天（不 404 崩，文件出现后刷新即生效）
  scene.background = new THREE.Color(theme.fog);
  scene.backgroundIntensity = theme.bgIntensity;
  scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);
  const pmrem = new THREE.PMREMGenerator(renderer);
  new THREE.TextureLoader().load(theme.sky, (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
    if (!software) { try { scene.environment = pmrem.fromEquirectangular(t).texture; } catch { /* 忽略 */ } }
  }, undefined, () => { scene.background = new THREE.Color(theme.fog); });

  // 灯光
  const hemi = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, theme.hemi);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(theme.key, theme.keyI);
  key.castShadow = !software;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 10; key.shadow.camera.far = 280;
  key.shadow.camera.left = -70; key.shadow.camera.right = 70;
  key.shadow.camera.top = 70; key.shadow.camera.bottom = -70;
  key.shadow.bias = -0.0006;
  key.position.set(60, 90, 40);
  scene.add(key); scene.add(key.target);
  const rim = new THREE.DirectionalLight(theme.rim, theme.rimI);
  scene.add(rim);
  const fill = new THREE.PointLight(theme.hemiSky, theme.fill, 28, 2);
  scene.add(fill);

  // 纹理（assets 已存在：车漆/法线/ORM、路面贴图/法线）
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function loadTex(url, { srgb = false, repeat = false } = {}) {
    const t = loader.load(url);
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  const tex = {
    car0: loadTex('assets/car-0.jpg', { srgb: true }),
    car1: loadTex('assets/car-1.jpg', { srgb: true }),
    car2: loadTex('assets/car-2.jpg', { srgb: true }),
    carN: loadTex('assets/car-normal.png'),
    carORM: loadTex('assets/car-orm.png'),
    road: loadTex('assets/road-albedo.jpg', { srgb: true, repeat: true }),
    roadN: loadTex('assets/road-normal.png', { repeat: true }),
  };

  // 世界（单赛道，与 sim 共用 TRACK_DEF，几何一次性构建）
  let track = null, built = false;
  let playerMesh = null, playerSpec = -1;
  const copMeshes = [], trafficMeshes = [], blockMeshes = [];
  const fx = createFX(scene);

  function ensureWorld() {
    if (built) return;
    built = true;
    // ponytail: 单赛道，渲染自建 track（与 run.track 数值一致），省去按 run 重建
    track = createTrack(TRACK_DEF);
    buildEnvironment(scene, track, theme, tex);
    ensurePlayerMesh(0);
    placeAt(0);
  }

  function ensurePlayerMesh(carIndex) {
    if (playerMesh && playerSpec === carIndex) return;
    if (playerMesh) scene.remove(playerMesh);
    playerSpec = carIndex;
    playerMesh = buildCarMesh(tex, { spec: carIndex, tint: CARS[carIndex]?.tint ?? 0xffffff });
    scene.add(playerMesh);
  }

  function placeAt(s) {
    const w = track.toWorld(s, 0);
    const f = track.at(s);
    playerMesh.position.set(w.x, 0, w.z);
    playerMesh.rotation.set(0, Math.atan2(f.tx, f.tz), 0);
  }

  function syncCops(run) {
    while (copMeshes.length < run.cops.length) { const m = buildCopMesh(); scene.add(m); copMeshes.push(m); }
    run.cops.forEach((c, i) => {
      const m = copMeshes[i];
      const w = track.toWorld(c.s, c.t);
      const f = track.at(c.s);
      m.position.set(w.x, 0, w.z);
      m.rotation.y = Math.atan2(f.tx, f.tz);
      m.userData.blink?.(run.time);
    });
  }
  function syncTraffic(run) {
    while (trafficMeshes.length < run.traffic.length) { const m = buildTrafficMesh(trafficMeshes.length); scene.add(m); trafficMeshes.push(m); }
    for (let i = 0; i < trafficMeshes.length; i++) {
      const c = run.traffic[i];
      const m = trafficMeshes[i];
      if (!c) { m.visible = false; continue; }
      m.visible = true;
      const w = track.toWorld(c.s, c.t);
      const f = track.at(c.s);
      m.position.set(w.x, 0, w.z);
      m.rotation.y = Math.atan2(f.tx, f.tz);
    }
  }
  function syncBlocks(run) {
    while (blockMeshes.length < run.blocks.length) { const m = buildBlockMesh(); scene.add(m); blockMeshes.push(m); }
    for (let i = 0; i < blockMeshes.length; i++) {
      const b = run.blocks[i];
      const m = blockMeshes[i];
      if (!b) { m.visible = false; continue; }
      m.visible = true;
      const closed = [-5, 0, 5].filter((l) => l !== b.openLane);
      const mid = (closed[0] + closed[1]) / 2;
      const w = track.toWorld(b.s, mid);
      const f = track.at(b.s);
      m.position.set(w.x, 0, w.z);
      m.rotation.y = Math.atan2(f.tx, f.tz);
      m.userData.blink?.(run.time);
    }
  }

  // 相机 / 状态
  const camLook = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const lastPos = new THREE.Vector3();
  let titleT = 0, shake = 0, smokeOn = false, flameOn = false;

  function renderTitle(dt) {
    titleT += dt;
    const w = track.toWorld(0, 0);
    const a = titleT * 0.14;
    camera.position.set(w.x + Math.sin(a) * 8.5, 2.7 + Math.sin(titleT * 0.4) * 0.25, w.z + Math.cos(a) * 8.5);
    // 标题内容在左半屏：相机瞄点左偏，把车让到右半屏
    camera.lookAt(w.x - Math.cos(a) * 4.3, 0.8, w.z + Math.sin(a) * 4.3);
    camera.fov = 58;
    camera.updateProjectionMatrix();
    key.position.set(w.x + 60, 90, w.z + 40);
    key.target.position.set(w.x, 0, w.z);
    fill.position.set(w.x, 4.2, w.z - 9.5);
  }

  function renderGame(run, dt) {
    ensurePlayerMesh(run.car);
    const p = run.player;
    const w = track.toWorld(p.s, p.t);
    const f = track.at(p.s);
    const yaw = Math.atan2(f.tx, f.tz) - p.angle;
    lastPos.set(w.x, 0, w.z);

    playerMesh.position.set(w.x, 0, w.z);
    playerMesh.rotation.y = yaw;
    playerMesh.rotation.z = -p.angle * 0.35;
    playerMesh.userData.wheels.forEach((hub, i) => {
      hub.rotation.x += p.speed * dt * 2.2;
      if (i < 2) hub.rotation.y = -p.steerSmooth * 0.35;
    });

    syncCops(run); syncTraffic(run); syncBlocks(run);

    fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    const camDist = CAMERA.dist + (run.boostT > 0 ? 1.1 : 0);
    tmp.set(w.x - fwd.x * camDist, CAMERA.height, w.z - fwd.z * camDist);
    if (shake > 0.01) {
      tmp.x += (Math.random() - 0.5) * shake;
      tmp.y += (Math.random() - 0.5) * shake * 0.6;
      tmp.z += (Math.random() - 0.5) * shake;
      shake *= Math.pow(0.02, dt);
    }
    camera.position.lerp(tmp, 1 - Math.exp(-CAMERA.posLerp * dt));
    camLook.lerp(tmp.set(w.x + fwd.x * CAMERA.lookAhead, 0.9, w.z + fwd.z * CAMERA.lookAhead), 1 - Math.exp(-CAMERA.lookLerp * dt));
    camera.lookAt(camLook);

    const targetFov = CAMERA.fovBase
      + Math.min(1, p.speed / CAR.maxSpeed) * CAMERA.fovSpeed
      + (run.boostT > 0 ? CAMERA.fovBoost : 0);
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();

    // 粒子：漂移烟 / 氮气尾焰
    if ((smokeOn || p.drifting) && Math.random() < 0.85) {
      const side = Math.sign(p.angle) || 1;
      fx.spawn(w.x - fwd.x * 1.6 + Math.cos(yaw) * side * 0.9, 0.25,
        w.z - fwd.z * 1.6 - Math.sin(yaw) * side * 0.9, 0xcfdae4, { spread: 1.4, life: 0.55, vy: 0.7 });
    }
    if (flameOn || run.boostT > 0) {
      fx.spawn(w.x - fwd.x * 2.0, 0.55, w.z - fwd.z * 2.0, 0x28e0ff, { spread: 0.7, life: 0.35, vy: 0.4 });
    }

    key.position.set(w.x + 60, 90, w.z + 40);
    key.target.position.set(w.x, 0, w.z);
    fill.position.set(w.x - fwd.x * 3.2, 4.2, w.z - fwd.z * 3.2);
  }

  function render(run, dt) {
    ensureWorld();
    dt = dt || 1 / 60;
    perfTick(dt);
    if (run) renderGame(run, dt); else renderTitle(dt);
    fx.tick(dt);
    renderer.render(scene, camera);
  }

  // 低 fps 自动降级（pixelRatio→1→shadows off，同 neon-drift）
  let perfT = 0, perfN = 0, perfStage = 0;
  function perfTick(dt) {
    perfT += dt; perfN++;
    if (perfT > 1.6) {
      const fps = perfN / perfT;
      if (fps < 34) {
        if (perfStage === 0) { renderer.setPixelRatio(1); perfStage = 1; console.warn('[perf] low fps', fps.toFixed(1), '→ pixelRatio 1'); }
        else if (perfStage === 1) { renderer.shadowMap.enabled = false; key.castShadow = false; perfStage = 2; console.warn('[perf] still low', fps.toFixed(1), '→ shadows off'); }
      }
      perfT = 0; perfN = 0;
    }
  }

  function onEvent(ev) {
    if (!ev) return;
    if (ev.type === 'crash') {
      shake = Math.max(shake, 0.6);
      const x = Number.isFinite(ev.x) ? ev.x : lastPos.x;
      const z = Number.isFinite(ev.z) ? ev.z : lastPos.z;
      fx.burst(x, 0.6, z, 0xffb347, 22, 5, 0.6);
    } else if (ev.type === 'boostStart') flameOn = true;
    else if (ev.type === 'boostEnd') flameOn = false;
    else if (ev.type === 'driftStart') smokeOn = true;
    else if (ev.type === 'driftEnd') smokeOn = false;
  }

  function resize(w, h) {
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    scene.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh || o.isPoints) {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m?.dispose?.());
      }
    });
    pmrem.dispose();
    renderer.dispose();
  }

  return { render, onEvent, resize, dispose };
}
