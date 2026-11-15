// src/render/index.js — 3D 渲染：低多边形山地拉力赛道 + 车 + 尘烟粒子 + 相机。
// 契约：createRenderer(canvas) → { render(run,dt), onEvent(ev), resize(w,h), setCamera(mode), dispose() }。
// 贴图槽位：assets/sky.jpg（天空）、assets/tex/gravel.webp（路面）、assets/tex/mud.webp（泥地），加载失败回退程序化。
// 主体（车/撞车石/松树）用 lib/models/*.glb.js 高精度模型，异步加载到位前保留程序化 fallback。
import * as THREE from 'three';
import { CAR, CAMERA, SURFACES, STAGES } from '../../config/game.config.js';
import { createStage, mulberry32 } from '../game/track.js';
import { loadModelData } from '../../lib/model-loader-data.js';
import { RoomEnvironment } from '../../lib/RoomEnvironment.js';
import rallyCarData from '../../lib/models/rally-car.glb.js';
import rallyBoulderData from '../../lib/models/rally-boulder.glb.js';
import pineTreeData from '../../lib/models/pine-tree.glb.js';

const PALETTE = { ground: 0x5a6b3a, dirt: 0xd6a35c, forest: 0x3f6212, red: 0xdc2626, rock: 0x8a8f98 };

// 程序化渐变天空（等距柱状），assets/sky.jpg 加载失败时的兜底（不白屏）
function gradientSky() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#4c6a88');
  grad.addColorStop(0.5, '#94a3b8');
  grad.addColorStop(0.6, '#b8c4cc');
  grad.addColorStop(1, '#c9b394');
  g.fillStyle = grad; g.fillRect(0, 0, 8, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

// 黑白格纹理（终点拱门横幅）
function checkeredTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? '#101010' : '#f4f4f4';
      g.fillRect(x * 8, y * 8, 8, 8);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function probeSoftware() {
  try {
    const c = document.createElement('canvas').getContext('webgl');
    const dbg = c && c.getExtension('debug_renderer_info');
    return /swiftshader|llvmpipe|softpipe|software/i.test(String(dbg ? c.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ''));
  } catch { return false; }
}

export function createRenderer(canvas) {
  const software = probeSoftware();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !software, powerPreference: 'high-performance' });
  renderer.setPixelRatio(software ? 0.7 : Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !software;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // PBR 环境反射（GLB 车漆/金属/岩石质感的关键）
  { const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose(); }
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 4000);
  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 天空：assets/sky.jpg（等距柱状 → 环境背景），失败回退程序化渐变天空
  scene.background = gradientSky();
  scene.fog = new THREE.Fog(0x9fb0bd, 130, 950);
  const loader = new THREE.TextureLoader();
  const tex = { gravel: null, mud: null };
  loader.load('assets/sky.jpg', (t) => { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; scene.background = t; }, undefined, () => { scene.background = gradientSky(); });
  for (const [k, url] of [['gravel', 'assets/tex/gravel.webp'], ['mud', 'assets/tex/mud.webp']]) {
    loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; tex[k] = t; }, undefined, () => { tex[k] = null; });
  }

  // 灯光
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x3a2f24, 0.95));
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.35);
  sun.position.set(50, 90, 40);
  if (!software) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
    sun.shadow.camera.near = 20; sun.shadow.camera.far = 280;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  }
  scene.add(sun);
  scene.add(sun.target);
  // 主光阴影跟随车辆（赛道长，静态阴影相机只能覆盖起点）
  function followSun(x, z) { sun.position.set(x + 50, 90, z + 40); sun.target.position.set(x, 0, z); }

  // GLB 主体异步加载：到位前用程序化 fallback，到位后视觉替换（玩法引用不动）
  const glb = { car: null, rock: null, pine: null };
  const glbWaiters = { car: [], rock: [], pine: [] };
  function useGLB(key, fn) { if (glb[key]) fn(glb[key]); else glbWaiters[key].push(fn); }
  function loadGLB(key, data, opts) {
    loadModelData(data, opts).then((m) => {
      glb[key] = m;
      const ws = glbWaiters[key]; glbWaiters[key] = [];
      for (const fn of ws) { try { fn(m); } catch { /* fallback 保留 */ } }
    }).catch(() => { /* 加载失败保留程序化 fallback */ });
  }
  loadGLB('car', rallyCarData, { targetLen: 4.2, forward: '+z', key: 'rally-car' });
  loadGLB('rock', rallyBoulderData, { targetLen: 2, forward: '+z', key: 'rally-boulder' });
  loadGLB('pine', pineTreeData, { targetLen: 4, forward: '+z', key: 'pine-tree' });

  // 世界（按 stage 重建）
  let world = null, builtStage = -1;
  const car = buildCar(useGLB, software);
  scene.add(car.group);
  const dust = createDust(scene);
  const previewTrack = createStage(STAGES[0]);

  function buildRoad(track) {
    // 按路面类型分段建 mesh，各自贴对应纹理（gravel/mud），无纹理段回退纯色。
    // 碰撞/判定几何在 sim（s,t 空间），这里纯渲染件，可自由分段。
    const hw = track.halfWidth;
    const n = track.count;
    const root = new THREE.Group();
    let cur = null, seg = null;
    const flush = () => {
      if (!seg) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(seg.pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(seg.uv, 2));
      geo.setIndex(seg.idx);
      geo.computeVertexNormals();
      const t = tex[seg.type];
      const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
      if (t) { mat.map = t; mat.color = new THREE.Color(0xffffff); }
      else mat.color = new THREE.Color(SURFACES[seg.type].color);
      const road = new THREE.Mesh(geo, mat);
      road.receiveShadow = true;
      root.add(road);
    };
    const addSample = (a) => {
      const v = a.s / 9;                 // 沿弧长每 9m 重复一次（RepeatWrapping）
      const vi = seg.vi;
      seg.pos.push(a.x + a.sx * -hw, 0.02, a.z + a.sz * -hw, a.x + a.sx * hw, 0.02, a.z + a.sz * hw);
      seg.uv.push(0, v, 1, v);
      if (vi > 0) seg.idx.push(vi - 2, vi - 1, vi, vi - 1, vi + 1, vi);
      seg.vi = vi + 2;
    };
    for (let i = 0; i < n; i++) {
      const a = track.samples[i];
      const type = track.surfaceAt(a.s);
      if (type !== cur) {
        if (seg) { addSample(a); flush(); seg = null; }  // 边界采样补一针，闭合上一段
        cur = type;
        seg = { type, pos: [], uv: [], idx: [], vi: 0 };
      }
      addSample(a);
    }
    flush();
    return root;
  }

  function buildWorld(track) {
    const root = new THREE.Group();
    const built = { root, track, alive: true };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: PALETTE.ground }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    root.add(ground);
    root.add(buildRoad(track));

    const rng = mulberry32(track.spec.seed + 99);
    // 装饰树：程序化锥 fallback → GLB 松树（烘焙归一化变换后仍用 InstancedMesh，保持单 draw call）
    const decorCount = 60;
    const dummy = new THREE.Object3D();
    const coneGeo = new THREE.ConeGeometry(1.6, 6, 7);
    const coneMat = new THREE.MeshLambertMaterial({ color: PALETTE.forest });
    const decor = new THREE.InstancedMesh(coneGeo, coneMat, decorCount);
    decor.castShadow = !software;
    const decorSpots = [];
    for (let i = 0; i < decorCount; i++) {
      const s = (i / decorCount) * track.length;
      const a = track.at(s);
      const side = i % 2 ? 1 : -1;
      const t = track.halfWidth + 8 + rng() * 18;
      const x = a.x + a.sx * side * t, z = a.z + a.sz * side * t;
      const sc = 0.8 + rng() * 0.9;
      decorSpots.push({ x, z, sc });
      dummy.position.set(x, 2.2, z);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      decor.setMatrixAt(i, dummy.matrix);
    }
    decor.instanceMatrix.needsUpdate = true;
    root.add(decor);

    // 碰撞障碍（树/石）：碰撞判定在 sim（s,t,r），这里纯视觉，fallback → GLB 克隆
    const rockGeo = new THREE.DodecahedronGeometry(1.5, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: PALETTE.rock });
    const treeFallbacks = [], rockFallbacks = [];
    for (const o of track.obstacles) {
      const w = track.toWorld(o.s, o.t);
      if (o.kind === 'tree') {
        const m = new THREE.Mesh(new THREE.ConeGeometry(1.5, 7, 7), new THREE.MeshLambertMaterial({ color: 0x2f4a12 }));
        m.position.set(w.x, 3.5, w.z);
        m.castShadow = !software;
        treeFallbacks.push({ mesh: m, x: w.x, z: w.z });
        root.add(m);
      } else {
        const sc = 0.7 + ((o.s * 13) % 1) * 0.6;
        const r = new THREE.Mesh(rockGeo, rockMat);
        r.position.set(w.x, 0.8, w.z);
        r.scale.setScalar(sc);
        r.castShadow = !software;
        rockFallbacks.push({ mesh: r, x: w.x, z: w.z, sc });
        root.add(r);
      }
    }

    // GLB 松树：路边 decor 实例化 + 障碍树克隆（复用同一缓存模型）
    useGLB('pine', (model) => {
      if (!built.alive) return;
      model.updateMatrixWorld(true);
      let src = null;
      model.traverse((o) => { if (o.isMesh && !src) src = o; });
      if (src) {
        const geo = src.geometry.clone();
        geo.applyMatrix4(src.matrixWorld);   // 烘焙 loader 的缩放/朝向/落地变换
        const inst = new THREE.InstancedMesh(geo, src.material, decorCount);
        inst.castShadow = !software;
        for (let i = 0; i < decorCount; i++) {
          const p = decorSpots[i];
          dummy.position.set(p.x, -0.2, p.z);          // GLB 底部落地，微陷土
          dummy.scale.setScalar(p.sc * 1.5);           // 对齐原锥树冠高度（6·sc）
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
        root.remove(decor);
        root.add(inst);
      }
      for (const t of treeFallbacks) {
        const m = model.clone(true);
        m.scale.setScalar(1.7);                        // 障碍树高≈6.8，对齐原 7 高锥树
        m.position.set(t.x, -0.15, t.z);
        root.remove(t.mesh);
        root.add(m);
      }
    });
    // GLB 撞车石：克隆替换十二面体，尺寸/埋深对齐原轮廓
    useGLB('rock', (model) => {
      if (!built.alive) return;
      for (const r of rockFallbacks) {
        const m = model.clone(true);
        m.scale.setScalar(r.sc * 1.5);                 // 宽≈3·sc，对齐原十二面体直径
        m.position.set(r.x, 0.8 - 1.14 * r.sc, r.z);   // 保持原顶高与埋深
        root.remove(r.mesh);
        root.add(m);
      }
    });

    // 起点线 / 终点线 / 沿途检查点拱门（点对点拉力：让目标始终可见）
    const line = (s, mat) => {
      const a = track.at(s);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(track.halfWidth * 2, 3), mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -Math.atan2(a.tx, a.tz);
      m.position.set(a.x, 0.04, a.z);
      return m;
    };
    root.add(line(0, new THREE.MeshBasicMaterial({ color: 0xffffff })));
    root.add(line(track.length, new THREE.MeshBasicMaterial({ color: 0xdc2626 })));

    const poleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const gateMat = new THREE.MeshBasicMaterial({ color: 0xffa520 });
    const finBannerMat = new THREE.MeshBasicMaterial({ map: checkeredTexture() });
    finBannerMat.map.repeat.set(6, 1);
    const gate = (s, bannerMat, h) => {
      const a = track.at(s);
      const w = track.halfWidth + 1.8;
      const grp = new THREE.Group();
      for (const sgn of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.45, h, 0.45), poleMat);
        pole.position.set(sgn * w, h / 2, 0);
        grp.add(pole);
      }
      const banner = new THREE.Mesh(new THREE.BoxGeometry(w * 2, 1.4, 0.5), bannerMat);
      banner.position.set(0, h - 0.9, 0);
      grp.add(banner);
      grp.position.set(a.x, 0, a.z);
      grp.rotation.y = Math.atan2(a.tx, a.tz);
      root.add(grp);
    };
    for (let s = 180; s < track.length - 260; s += 300) gate(s, gateMat, 6.5);
    gate(track.length, finBannerMat, 7.5);

    scene.add(root);
    return built;
  }

  function ensureWorld(track, stage) {
    if (builtStage === stage) return;
    if (world) { world.alive = false; scene.remove(world.root); }
    world = buildWorld(track);
    builtStage = stage;
  }

  // 相机状态
  let camMode = 'chase', shake = 0;
  const camLook = new THREE.Vector3(), fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
  const lastPos = new THREE.Vector3();
  let titleT = 0;

  function renderTitle(dt) {
    ensureWorld(previewTrack, -1);
    titleT += dt;
    const w = previewTrack.at(0);
    followSun(car.group.position.x, car.group.position.z);
    const a = titleT * 0.14;
    camera.position.set(w.x + Math.sin(a) * 9, 3 + Math.sin(titleT * 0.4) * 0.3, w.z + Math.cos(a) * 9);
    camera.lookAt(w.x, 0.8, w.z);
    camera.fov = 56;
    camera.updateProjectionMatrix();
  }

  function renderGame(run, dt) {
    ensureWorld(run.track, run.stage);
    const p = run.player;
    const track = run.track;
    const w = track.toWorld(p.s, p.t);
    const f = track.at(p.s);
    const yaw = Math.atan2(f.tx, f.tz) - p.angle;
    lastPos.set(w.x, 0, w.z);
    followSun(w.x, w.z);

    car.group.position.set(w.x, 0, w.z);
    car.group.rotation.y = yaw;
    car.group.rotation.z = -p.angle * 0.30;
    car.wheels.forEach((hub) => { hub.rotation.x += p.speed * dt * 2.4; if (hub.userData.front) hub.rotation.y = -p.steerSmooth * 0.4; });

    fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    const cam = CAMERA[camMode];
    tmp.set(w.x - fwd.x * cam.dist, cam.height, w.z - fwd.z * cam.dist);
    if (shake > 0.01 && !reducedMotion) {
      tmp.x += (Math.random() - 0.5) * shake;
      tmp.y += (Math.random() - 0.5) * shake * 0.6;
      shake *= Math.pow(0.02, dt);
    }
    camera.position.lerp(tmp, 1 - Math.exp(-cam.posLerp * dt));
    camLook.lerp(tmp.set(w.x + fwd.x * cam.lookAhead, 0.9, w.z + fwd.z * cam.lookAhead), 1 - Math.exp(-cam.lookLerp * dt));
    camera.lookAt(camLook);
    const targetFov = cam.fov + Math.min(1, p.speed / CAR.maxSpeed) * cam.fovSpeed;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();

    // 尘烟：随路面/速度变化（签名记忆点）
    const surface = track.surfaceAt(p.s);
    const dusty = surface !== 'asphalt';
    const dustRate = dusty ? 0.9 : 0.25;
    if ((p.drifting || (p.speed > 18 && dusty)) && Math.random() < dustRate) {
      const side = Math.sign(p.angle) || 1;
      const intensity = Math.min(1, p.speed / CAR.maxSpeed) * (p.drifting ? 1.4 : 0.8);
      dust.spawn(
        w.x - fwd.x * 1.7 + Math.cos(yaw) * side * 1.1, 0.3,
        w.z - fwd.z * 1.7 - Math.sin(yaw) * side * 1.1,
        0xd6a35c, { spread: 1.6 * intensity, life: 0.8, vy: 0.8 + intensity });
    }
    // 颠簸路段持续震屏
    if (track.inBumpy(p.s) && p.speed > 20) shake = Math.max(shake, CAMERA.shake * 0.8);
  }

  function render(run, dt) {
    dt = dt || 1 / 60;
    if (run) renderGame(run, dt); else renderTitle(dt);
    dust.tick(dt);
    renderer.render(scene, camera);
  }

  function onEvent(ev) {
    if (!ev) return;
    if (ev.type === 'hit') {
      shake = Math.max(shake, 0.7);
      dust.burst(lastPos.x, 0.6, lastPos.z, 0xc9b06a, 24, 5, 0.6);
    } else if (ev.type === 'busted') {
      shake = Math.max(shake, 0.8);
    }
  }

  function setCamera(mode) { camMode = mode === 'hood' ? 'hood' : 'chase'; car.setShellVisible(camMode !== 'hood'); }
  function resize(w, h) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function dispose() {
    scene.traverse((o) => { if (o.isMesh || o.isSprite) { o.geometry?.dispose?.(); o.material?.dispose?.(); } });
    scene.environment?.dispose?.();
    renderer.dispose();
  }

  return { render, onEvent, resize, setCamera, dispose };
}

// ---------------------------------------------------------------- 车
function buildCar(useGLB, software) {
  const group = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: PALETTE.red, roughness: 0.35, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.6, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0c1626, roughness: 0.15, metalness: 0.7 });

  // 程序化车壳 fallback（GLB 到位后整组移除）
  const fallback = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.52, 4.3), red);
  body.position.y = 0.62;
  fallback.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.48, 1.9), glass);
  cabin.position.set(0, 1.1, -0.15);
  fallback.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.9), red);
  hood.position.set(0, 0.9, 1.6);
  fallback.add(hood);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.42), dark);
  spoiler.position.set(0, 1.15, -2.05);
  fallback.add(spoiler);
  for (const sgn of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.08), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
    l.position.set(sgn * 0.72, 0.62, 2.16);
    fallback.add(l);
  }
  fallback.traverse((o) => { if (o.isMesh) o.castShadow = !software; });
  group.add(fallback);

  // 四轮 pivot 保留：rotation.x 滚动 / rotation.y 转向驱动不变（renderGame）。
  // 位置/尺寸对齐 GLB 轮拱，程序化胎+金属轮辋略大于 GLB 轮以完全包覆，滚动可见。
  const tyreGeo = new THREE.CylinderGeometry(0.40, 0.40, 0.44, 20);
  tyreGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.46, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.9, metalness: 0 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.35, metalness: 0.85 });
  const wheels = [];
  for (const [x, z] of [[-0.80, 1.30], [0.80, 1.30], [-0.80, -1.12], [0.80, -1.12]]) {
    const hub = new THREE.Group();
    hub.position.set(x, 0.40, z);
    hub.userData.front = z > 0;
    const tyre = new THREE.Mesh(tyreGeo, tyreMat);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    tyre.castShadow = rim.castShadow = !software;
    hub.add(tyre, rim);
    group.add(hub);
    wheels.push(hub);
  }

  // GLB 车壳替换 Box 车身（车轮 pivot 独立保留）；朝向 +z 对齐原车头
  let shell = fallback, shellVisible = true;
  useGLB('car', (model) => {
    group.remove(fallback);
    model.visible = shellVisible;
    shell = model;
    group.add(model);
  });
  // 引擎盖视角隐藏车壳：原 Box 座舱从内部靠背面剔除「透视」，GLB 封闭舱会挡镜头，故显式隐藏
  function setShellVisible(v) { shellVisible = v; shell.visible = v; }
  return { group, wheels, setShellVisible };
}

// ---------------------------------------------------------------- 尘烟粒子池
function createDust(scene) {
  const PMAX = 340;
  const pPos = new Float32Array(PMAX * 3);
  const pCol = new Float32Array(PMAX * 3);
  const pLife = new Float32Array(PMAX);
  const pVel = new Float32Array(PMAX * 3);
  for (let i = 0; i < PMAX; i++) { pLife[i] = 0; pPos[i * 3 + 1] = -999; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,250,235,0.9)');
  rg.addColorStop(0.5, 'rgba(214,163,92,0.5)');
  rg.addColorStop(1, 'rgba(214,163,92,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 2.6, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.NormalBlending, vertexColors: true, sizeAttenuation: true,
  }));
  points.frustumCulled = false;
  scene.add(points);
  let pIdx = 0;
  function spawn(x, y, z, color, opts = {}) {
    const i = pIdx = (pIdx + 1) % PMAX;
    const { spread = 1.4, life = 0.7, vy = 0.7 } = opts;
    const cc = new THREE.Color(color);
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
    pCol[i * 3] = cc.r; pCol[i * 3 + 1] = cc.g; pCol[i * 3 + 2] = cc.b;
    pVel[i * 3] = (Math.random() - 0.5) * spread;
    pVel[i * 3 + 1] = vy + Math.random() * 1.6;
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
      pVel[i * 3 + 1] -= 1.1 * dt;
      if (pLife[i] <= 0) pPos[i * 3 + 1] = -999;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }
  return { spawn, burst, tick };
}
