// src/render/index.js — 3D 渲染：天空峡谷 + 金环 + 高精度 GLB 飞机/金环/岩岛（程序化粗模兜底）+ 拖尾/火花 + 追踪相机。
// 契约：createRenderer(canvas) → { render(run, dt), onEvent(ev), resize(w,h), switchCamera(), dispose() }
// 贴图槽位：assets/sky.jpg 加载失败回退纯色天空（不白屏不报错）。
// GLB 主体：stunt-plane（玩家+bot，改色材质区分）/ race-ring（XY 环面 +Z 法线）/ canyon-butte（岩岛），
// 玩法引用（userData.ring、position/rotation/scale 驱动、移动环）全部保留，GLB 只做视觉替换。
import * as THREE from 'three';
import { CONFIG, CAMERA, TRACKS, BOT } from '../../config/game.config.js';
import { createCourse } from '../game/track.js';
import { loadModelData } from '../../lib/model-loader-data.js';
import { RoomEnvironment } from '../../lib/RoomEnvironment.js';
import planeData from '../../lib/models/stunt-plane.glb.js';
import ringData from '../../lib/models/race-ring.glb.js';
import butteData from '../../lib/models/canyon-butte.glb.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 程序化渐变天空（缺 assets/sky.jpg 时兜底，不白屏）
function makeSkyTexture() {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#38bdf8');
  g.addColorStop(0.55, '#7dd3fc');
  g.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 低多边形飞机（机头朝 +Z）
function buildPlaneMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.0, 5), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 }));
  body.rotation.x = Math.PI / 2; // 锥尖朝 +Z
  body.position.z = 0.3;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 1.3), new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35 }));
  wing.position.z = -0.1;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.8), new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35 }));
  tail.position.set(0, 0, -1.5);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.9), new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35 }));
  fin.position.set(0, 0.45, -1.4);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.3 }));
  cockpit.position.set(0, 0.32, 1.0);
  g.add(body, wing, tail, fin, cockpit);
  return g;
}

// GLB 底图多为深红漆面，直接乘 tint 会把 bot 颜色染脏 → 先灰度化底图再改色（共享一张灰度图）。
const _grayTexCache = new Map();
function grayVersion(tex) {
  if (!tex || !tex.image) return tex;
  if (_grayTexCache.has(tex.uuid)) return _grayTexCache.get(tex.uuid);
  const img = tex.image;
  const w = img.width || 1024, h = img.height || 1024;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    // 取 max 通道（明度）而非加权亮度：饱和红漆 luminance 会发暗，max 保留漆面亮度，改色后更鲜艳
    const l = Math.max(d[i], d[i + 1], d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = l;
  }
  ctx.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = tex.flipY; // glTF 贴图 flipY=false，必须继承
  t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  _grayTexCache.set(tex.uuid, t);
  return t;
}

// 玩家/bot 改色：克隆材质（互不影响），灰度底图 × 队色，保留金属/粗糙度贴图。
function recolorPlane(model, color) {
  const tint = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.12);
  model.traverse((o) => {
    if (o.isMesh && o.material) {
      const m = o.material.clone();
      if (m.map) m.map = grayVersion(m.map);
      m.color = tint.clone();
      m.metalness = Math.max(m.metalness ?? 0, 0.3);
      m.roughness = Math.min(m.roughness ?? 0.6, 0.6);
      o.material = m;
    }
  });
  return model;
}

// loader 归一化后底部落地 y=0；飞行主体/环需要几何中心对齐枢轴原点 → 垂直居中。
function centerPivotY(model) {
  const box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  for (const child of model.children) child.position.y -= c.y;
  return model;
}

// 飞机枢轴：玩法驱动节点（placePlane 设 position/rotation，renderTitle 设 scale）。
// 程序化粗模兜底，GLB 就绪后原位替换；机头保持 +Z（GLB 原生机头朝 -X，forward '+x' 旋到 +Z）。
function buildPlane(color) {
  const pivot = new THREE.Group();
  const fallback = buildPlaneMesh(color);
  pivot.add(fallback);
  loadModelData(planeData, { targetLen: 4, forward: '+x', key: 'stunt-plane' }).then((model) => {
    recolorPlane(model, color);
    centerPivotY(model);
    pivot.remove(fallback);
    pivot.add(model);
  }).catch(() => {});
  return pivot;
}

// 粒子池（拖尾 + 火花 + 尾焰），复用共享点云
function createFX(scene, max = 400) {
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const life = new Float32Array(max);
  const vel = new Float32Array(max * 3);
  for (let i = 0; i < max; i++) { life[i] = 0; pos[i * 3 + 1] = -9999; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const rg = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.4, 'rgba(255,255,255,.6)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, 64, 64);
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 2.0, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.55,
    depthWrite: false, vertexColors: true, sizeAttenuation: true, toneMapped: true,
  }));
  points.frustumCulled = false;
  scene.add(points);
  let idx = 0;
  return {
    spawn(x, y, z, color, o = {}) {
      const i = idx = (idx + 1) % max;
      const { spread = 1.0, life: lf = 0.6, vx = 0, vy = 0.3, vz = 0 } = o;
      const cc = color instanceof THREE.Color ? color : new THREE.Color(color);
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
      vel[i * 3] = (Math.random() - 0.5) * spread + vx;
      vel[i * 3 + 1] = vy + Math.random() * 0.6;
      vel[i * 3 + 2] = (Math.random() - 0.5) * spread + vz;
      life[i] = lf * (0.7 + Math.random() * 0.6);
    },
    burst(x, y, z, color, n = 16, spread = 5, lf = 0.55) {
      for (let k = 0; k < n; k++) this.spawn(x, y, z, color, { spread, life: lf, vy: 1.5 + Math.random() * 2.5 });
    },
    tick(dt) {
      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] -= 1.0 * dt;
        if (life[i] <= 0) pos[i * 3 + 1] = -9999;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

export function createRenderer(canvas) {
  const probe = document.createElement('canvas').getContext('webgl');
  const dbg = probe && probe.getExtension('debug_renderer_info');
  const software = /swiftshader|llvmpipe|softpipe|software/i.test(String(dbg ? probe.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ''));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !software, powerPreference: 'high-performance' });
  renderer.setPixelRatio(software ? 0.7 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // PBR 环境反射（RoomEnvironment → PMREM），GLB 金属漆面/金环高光依赖它
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();
  const skyColor = new THREE.Color(CONFIG.color.sky);
  scene.background = makeSkyTexture(); // 程序化渐变兜底，sky.jpg 就绪后替换
  scene.fog = new THREE.Fog(skyColor, 260, 1200);
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 4000);

  // 天空全景（写真级 HDRI）：作背景 + 环境反射光源
  new THREE.TextureLoader().load('assets/tex/sky.jpg', (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromEquirectangular(t).texture;
    pm.dispose();
  }, undefined, () => { scene.background = makeSkyTexture(); });

  // 灯光
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x3a2f24, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(80, 140, 60);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 10;
  key.shadow.camera.far = 450;
  key.shadow.camera.left = -150;
  key.shadow.camera.right = 150;
  key.shadow.camera.top = 150;
  key.shadow.camera.bottom = -150;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.6;
  scene.add(key);
  scene.add(key.target); // 阴影相机跟随玩家（renderGame/renderTitle 里更新 target）

  // 静态世界：沙漠地面 + 峡谷浮岛
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xc2a878, roughness: 0.95, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);
  // 写真级沙漠地面纹理 + 法线
  new THREE.TextureLoader().load('assets/tex/ground.webp', (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(48, 48);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    groundMat.map = t; groundMat.color.set(0xffffff); groundMat.needsUpdate = true;
  }, undefined, () => {});
  new THREE.TextureLoader().load('assets/tex/ground_n.webp', (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(48, 48);
    groundMat.normalMap = t; groundMat.normalScale = new THREE.Vector2(0.35, 0.35); groundMat.needsUpdate = true;
  }, undefined, () => {});
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.9, metalness: 0, flatShading: true });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 40);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const rad = 360 + ((i * 61) % 160);
    dummy.position.set(Math.cos(a) * rad, -6 + ((i * 37) % 14), Math.sin(a) * rad);
    dummy.scale.setScalar(6 + ((i * 53) % 18));
    dummy.rotation.set(0, a, 0);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  scene.add(rocks);

  // 峡谷岩岛 GLB：保留 InstancedMesh 兜底，就绪后按原摆位/缩放克隆替换（玩法无关，纯视觉）
  loadModelData(butteData, { targetLen: 10, forward: '+z', key: 'canyon-butte' }).then((proto) => {
    centerPivotY(proto); // 原二十面体以中心摆位，GLB 归一化底部落地 → 居中后再摆
    const rockGroup = new THREE.Group();
    for (let i = 0; i < 40; i++) {
      const m = proto.clone(true);
      const a = (i / 40) * Math.PI * 2;
      const rad = 360 + ((i * 61) % 160);
      const s = 6 + ((i * 53) % 18);
      m.position.set(Math.cos(a) * rad, -6 + ((i * 37) % 14), Math.sin(a) * rad);
      m.scale.setScalar((s * 2) / 10); // 原二十面体直径 2s，GLB 最大边 10
      m.rotation.set(0, a, 0);
      m.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
      rockGroup.add(m);
    }
    scene.add(rockGroup);
    rocks.visible = false;
  }).catch(() => {});

  // 浮岛贴图（assets/tex/rock.webp，缺图保留棕灰底色占位）
  new THREE.TextureLoader().load('assets/tex/rock.webp', (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    t.colorSpace = THREE.SRGBColorSpace;
    rockMat.map = t;
    rockMat.color.set(0xffffff);
    rockMat.needsUpdate = true;
  }, undefined, () => {});

  // 远景云带已移除：写真级天空全景自带云层，避免人工矩形云板穿帮

  // 环（金环发光）——按当前赛道重建。
  // holder Group 承载全部玩法引用：scale=r.radius、quaternion(+Z→环法线)、userData.ring/base、移动环 position。
  // GLB 环面保持 XY 平面/+Z 法线（forward '+z' 绕 Y 转 π 不改变环面），穿环方向不变。
  let ringMeshes = [];
  let builtTrack = -1;
  let ringProto = null;
  function swapRing(holder) {
    if (!ringProto || !holder.parent || holder.userData.glb) return;
    const m = ringProto.clone(true);
    holder.remove(holder.userData.fallback);
    holder.add(m);
    holder.userData.glb = true;
  }
  // GLB 环：最大边 4 → scale=r.radius 时外半径 2r、内孔≈1.01r，正好对齐 sim 的穿环判定半径 r.radius。
  // 金色 emissive 保留原 Torus 材质的发光观感。
  loadModelData(ringData, { targetLen: 4, forward: '+z', key: 'race-ring' }).then((model) => {
    centerPivotY(model);
    model.traverse((o) => {
      if (o.isMesh && o.material) {
        const m = o.material.clone();
        m.emissive = new THREE.Color(CONFIG.color.ring);
        m.emissiveIntensity = 0.25;
        o.material = m;
      }
    });
    ringProto = model;
    for (const h of ringMeshes) swapRing(h);
  }).catch(() => {});
  function ensureRings(trackIndex) {
    if (trackIndex === builtTrack) return;
    builtTrack = trackIndex;
    for (const m of ringMeshes) scene.remove(m);
    ringMeshes = [];
    const course = createCourse(TRACKS[trackIndex]);
    const torus = new THREE.TorusGeometry(1, 0.1, 12, 32);
    const mat = new THREE.MeshStandardMaterial({ color: CONFIG.color.ring, roughness: 0.35, metalness: 0.4, emissive: CONFIG.color.ring, emissiveIntensity: 0.35 });
    for (const r of course.rings) {
      const holder = new THREE.Group();
      const fb = new THREE.Mesh(torus, mat);
      holder.add(fb);
      holder.userData.fallback = fb;
      // XY 环面按 r.radius 缩放（内孔≈判定半径）；法线方向压扁到 0.35，
      // 避免 GLB 厚环带（原 ±8m）在擦环时吞掉追踪相机，贴近原 Torus 管厚观感。
      holder.scale.set(r.radius, r.radius, r.radius * 0.35);
      const n = new THREE.Vector3(r.nx, r.ny, r.nz);
      holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      holder.userData.base = { x: r.bx, y: r.by, z: r.bz };
      holder.userData.ring = r;
      scene.add(holder);
      ringMeshes.push(holder);
      swapRing(holder); // GLB 已就绪则立即替换，否则等 proto 加载完统一替换
    }
  }

  // 飞机网格（GLB clone + 改色材质区分玩家/bot；加载完成前程序化粗模兜底）
  let playerMesh = buildPlane(CONFIG.color.player);
  scene.add(playerMesh);
  const botMeshes = [];
  for (let i = 0; i < BOT.count; i++) { const m = buildPlane(BOT.colors[i]); m.visible = false; scene.add(m); botMeshes.push(m); }

  // 尾焰
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.2, 6), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9, toneMapped: false }));
  flame.rotation.x = -Math.PI / 2;
  flame.visible = false;
  scene.add(flame);

  const fx = createFX(scene);

  function placePlane(mesh, plane) {
    mesh.position.set(plane.pos.x, plane.pos.y, plane.pos.z);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.set(plane.pitch, plane.yaw, plane.roll);
  }

  let mode = 0, titleT = 0, shake = 0, snapCam = true;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), lastPos = new THREE.Vector3();

  function renderTitle(dt) {
    titleT += dt;
    snapCam = true;
    for (const m of ringMeshes) m.visible = false;
    const a = titleT * 0.14;
    const r0 = TRACKS[0];
    const course = createCourse(r0);
    const c0 = course.rings[0];
    camera.position.set(c0.bx + Math.sin(a) * 26, c0.by + 1 + Math.sin(titleT * 0.5) * 2, c0.bz + Math.cos(a) * 26);
    camera.lookAt(c0.bx, c0.by + 9, c0.bz);
    camera.fov = 60;
    camera.updateProjectionMatrix();
    // 标题屏也要有「主体」：红色玩家机放大、衬在天空上，提升剪影辨识度
    playerMesh.scale.setScalar(1.7);
    placePlane(playerMesh, { pos: { x: c0.bx, y: c0.by + 5 + Math.sin(titleT * 1.2) * 2, z: c0.bz }, pitch: 0, yaw: Math.atan2(c0.nx, c0.nz), roll: Math.sin(titleT * 0.8) * 0.4 });
    key.position.set(c0.bx + 80, 140, c0.bz + 60);
    key.target.position.set(c0.bx, c0.by, c0.bz);
  }

  function renderGame(run, dt) {
    ensureRings(run.trackIndex);
    const p = run.player;
    playerMesh.scale.setScalar(1);
    placePlane(playerMesh, p);
    run.bots.forEach((b, i) => {
      const m = botMeshes[i];
      m.visible = !b.finished;
      placePlane(m, b);
    });

    // 环位置（移动环）
    for (const m of ringMeshes) {
      const r = m.userData.ring;
      const dy = r.moveAmp ? r.moveAmp * Math.sin(run.time * r.moveFreq * Math.PI * 2 + r.phase) : 0;
      m.position.set(r.bx, r.by + dy, r.bz);
      m.visible = true;
    }
    lastPos.set(p.pos.x, p.pos.y, p.pos.z);

    // 相机（刚进入玩法时直接 snap 到追踪位，避免从原点 fly-in）
    const cfg = CAMERA.modes[mode];
    const fxv = p.fx, fyv = p.fy, fzv = p.fz;
    let tx, ty, tz;
    if (cfg.dist === 0) { tx = p.pos.x; ty = p.pos.y + cfg.height; tz = p.pos.z; }
    else { tx = p.pos.x - fxv * cfg.dist; ty = p.pos.y + cfg.height; tz = p.pos.z - fzv * cfg.dist; }
    if (shake > 0.01) { tx += (Math.random() - 0.5) * shake; ty += (Math.random() - 0.5) * shake; tz += (Math.random() - 0.5) * shake; shake *= Math.pow(0.02, dt); }
    const lx = p.pos.x + fxv * cfg.lookAhead, ly = p.pos.y + fyv * cfg.lookAhead + 1.2, lz = p.pos.z + fzv * cfg.lookAhead;
    if (snapCam) {
      snapCam = false;
      camPos.set(tx, ty, tz);
      camLook.set(lx, ly, lz);
    } else {
      const k = 1 - Math.exp(-CAMERA.posLerp * dt);
      camPos.lerp(new THREE.Vector3(tx, ty, tz), k);
      camLook.lerp(new THREE.Vector3(lx, ly, lz), 1 - Math.exp(-CAMERA.lookLerp * dt));
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    const targetFov = cfg.fovBase + Math.min(1, p.speed / 70) * cfg.fovSpeed + (p.boosting ? cfg.fovBoost : 0);
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();

    // 拖尾粒子（玩家 + bot）
    const emit = (plane, color) => {
      if (Math.random() < 0.6) {
        fx.spawn(plane.pos.x - plane.fx * 2.2, plane.pos.y - plane.fy * 2.2, plane.pos.z - plane.fz * 2.2, color, { spread: 0.6, life: 0.7, vy: 0.1 });
      }
    };
    emit(p, 0xf0f9ff);
    for (let i = 0; i < run.bots.length; i++) if (!run.bots[i].finished) emit(run.bots[i], BOT.colors[i]);

    // 尾焰
    flame.visible = p.boosting;
    if (p.boosting) {
      flame.position.set(p.pos.x - fxv * 2.6, p.pos.y - fyv * 2.6, p.pos.z - fzv * 2.6);
      flame.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(fxv, fyv, fzv));
    }

    key.position.set(p.pos.x + 80, 140, p.pos.z + 60);
    key.target.position.set(p.pos.x, p.pos.y, p.pos.z); // 阴影视锥跟随玩家
  }

  function render(run, dt) {
    dt = dt || 1 / 60;
    if (run) renderGame(run, dt); else renderTitle(dt);
    fx.tick(dt);
    renderer.render(scene, camera);
  }

  function onEvent(ev) {
    if (!ev) return;
    if (ev.type === 'ringHit') { shake = Math.max(shake, 0.5); fx.burst(lastPos.x, lastPos.y, lastPos.z, CONFIG.color.ring, 18, 5); }
    else if (ev.type === 'crash') { shake = Math.max(shake, 0.9); fx.burst(lastPos.x, lastPos.y, lastPos.z, 0xffb347, 26, 7, 0.7); }
    else if (ev.type === 'groundHit') { fx.burst(lastPos.x, lastPos.y, lastPos.z, 0x9aa7b4, 14, 5); }
    else if (ev.type === 'ringPass') { fx.burst(lastPos.x, lastPos.y, lastPos.z, CONFIG.color.ring, 10, 4, 0.4); }
  }

  function resize(w, h) {
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function switchCamera() { mode = (mode + 1) % CAMERA.modes.length; }

  function dispose() {
    scene.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh || o.isPoints) {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m?.dispose?.());
      }
    });
    envTex.dispose();
    renderer.dispose();
  }

  return { render, onEvent, resize, switchCamera, dispose, getCamera: () => camera };
}
