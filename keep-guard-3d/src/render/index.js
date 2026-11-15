// src/render/index.js — 低多边形 3D 渲染：斜 45° 俯视网格地图 + 塔/墙/敌人/红线 + 射程圈/路径预览。
// 契约：createRenderer(canvas) → { render(run, dt), resize(w,h), setView(v), pickCell(x,y), onEvent, dispose }。
// 贴图 assets 加载失败静默回退程序化纯色（不 404、不报错）。
import * as THREE from '../../lib/three.module.js';
import { RoomEnvironment } from '../../lib/RoomEnvironment.js';
import { loadModelData } from '../../lib/model-loader-data.js';
import towerArrowData from '../../lib/models/tower-arrow.glb.js';
import towerCannonData from '../../lib/models/tower-cannon.glb.js';
import towerIceData from '../../lib/models/tower-ice.glb.js';
import { MAP, TOWERS, WALL, ENEMIES, CAM, PAL, VIEW, cellWorld } from '../../config/game.config.js';


const world = (c, r) => { const w = cellWorld(c, r); return new THREE.Vector3(w.x, 0, w.z); };

function loadTexture(url, repeatX = 1, repeatY = 1) {
  return fetch(url)
    .then((r) => { if (!r.ok) throw new Error('missing'); return r.blob(); })
    .then((b) => createImageBitmap(b))
    .then((bmp) => {
      const t = new THREE.Texture(bmp);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      t.needsUpdate = true;
      return t;
    })
    .catch(() => null);
}

// 程序化渐变天空（canvas 2:1，Equirectangular 映射），sky.jpg 缺位/失败时的兜底
function gradientSky() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#1e293b');
  grad.addColorStop(0.52, '#334155');
  grad.addColorStop(0.8, '#b45309');
  grad.addColorStop(1, '#f59e0b');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 红线（扁平 ribbon，沿路径中心），MeshBasic 保证清晰可见
function buildRibbon(points, width, color, y = 0.06) {
  const pos = [], nor = [], idx = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1] || p;
    const next = points[i + 1] || p;
    let dx = next.x - prev.x, dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const px = -dz * width / 2, pz = dx * width / 2;
    pos.push(p.x + px, y, p.z + pz, p.x - px, y, p.z - pz);
    nor.push(0, 1, 0, 0, 1, 0);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(PAL.sky);

  const scene = new THREE.Scene();
  { const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; }
  scene.background = gradientSky();
  loadTexture('assets/sky.jpg').then((t) => { if (t) { t.mapping = THREE.EquirectangularReflectionMapping; scene.background = t; } });
  scene.fog = new THREE.Fog(PAL.fog, 18, 60);

  const camera = new THREE.PerspectiveCamera(45, VIEW.W / VIEW.H, 0.1, 200);

  const hemi = new THREE.HemisphereLight(0xdce7ff, 0x2a2f1a, 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(12, 22, 8);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  { const sc = sun.shadow.camera; sc.left = -25; sc.right = 25; sc.top = 25; sc.bottom = -25; sc.far = 80; sun.shadow.bias = -0.0005; }
  scene.add(sun);

  // 相机轨道
  const cam = { yaw: CAM.yaw, pitch: CAM.pitch, dist: CAM.dist };
  const target = new THREE.Vector3(0, 0, 0);
  function applyCam() {
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    camera.position.set(
      target.x + cam.dist * cp * Math.sin(cam.yaw),
      cam.dist * sp,
      target.z + cam.dist * cp * Math.cos(cam.yaw),
    );
    camera.lookAt(target);
  }

  // ---------------- 地面 / 岩石 / 出生点 / 核心 ----------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP.cols, MAP.rows),
    new THREE.MeshLambertMaterial({ color: PAL.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  loadTexture('assets/tex/grass.webp', 8, 6).then((t) => { if (t) { ground.material.map = t; ground.material.color.set(0xffffff); ground.material.needsUpdate = true; } });

  const rockMat = new THREE.MeshLambertMaterial({ color: PAL.rock });
  const rockGeo = new THREE.BoxGeometry(1, 0.9, 1);
  const rocks = [];
  for (const [c, r] of MAP.rocks) {
    const m = new THREE.Mesh(rockGeo, rockMat);
    const w = world(c, r);
    m.position.set(w.x, 0.45, w.z);
    scene.add(m); rocks.push(m);
  }
  loadTexture('assets/tex/stone.webp', 4, 4).then((t) => { if (t) { rockMat.map = t; rockMat.color.set(0xffffff); rockMat.needsUpdate = true; } });

  const coreGroup = new THREE.Group();
  {
    const w = world(MAP.core.c, MAP.core.r);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 1.1), new THREE.MeshLambertMaterial({ color: PAL.core }));
    base.position.set(w.x, 0.3, w.z);
    const keep = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.4, 6), new THREE.MeshLambertMaterial({ color: 0x92400e }));
    keep.position.set(w.x, 1.3, w.z);
    coreGroup.add(base, keep);
    scene.add(coreGroup);
  }
  const spawnGroup = new THREE.Group();
  {
    const w = world(MAP.spawn.c, MAP.spawn.r);
    const mark = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 12), new THREE.MeshBasicMaterial({ color: PAL.enemy }));
    mark.position.set(w.x, 0.02, w.z);
    spawnGroup.add(mark);
    scene.add(spawnGroup);
  }

  // ---------------- 动态层 ----------------
  const pathTiles = new THREE.Group(); scene.add(pathTiles);
  let pathLine = null;
  const towerGroup = new THREE.Group(); scene.add(towerGroup);
  const wallGroup = new THREE.Group(); scene.add(wallGroup);
  const enemyGroup = new THREE.Group(); scene.add(enemyGroup);
  const projGroup = new THREE.Group(); scene.add(projGroup);
  const fxGroup = new THREE.Group(); scene.add(fxGroup);

  const enemyMeshes = []; // 与 run.enemies 对齐的池
  const towerMeshes = new Map(); // id -> mesh
  const wallMeshes = new Map(); // key -> mesh
  const projMeshes = [];

  // 塔几何：AI GLB 真模型（外部 meshopt，按类型），加载完成前回退低多边形剪影
  const TOWER_DATA = { arrow: towerArrowData, cannon: towerCannonData, ice: towerIceData };
  function buildTowerMesh(t) {
    const spec = TOWERS[t.type];
    const g = new THREE.Group();
    const lvl = t.level;
    // 程序化占位（剪影分明）
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.5, 8), new THREE.MeshLambertMaterial({ color: spec.color }));
    base.position.y = 0.25;
    g.add(base);
    let head;
    if (t.type === 'arrow') {
      head = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 6), new THREE.MeshLambertMaterial({ color: spec.color }));
      head.position.y = 0.95 + lvl * 0.1;
    } else if (t.type === 'cannon') {
      head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshLambertMaterial({ color: 0x1f2937 }));
      head.position.y = 0.75 + lvl * 0.08;
    } else {
      head = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 + lvl * 0.03), new THREE.MeshLambertMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.9 }));
      head.position.y = 0.9 + lvl * 0.1;
    }
    g.add(head);
    const data = TOWER_DATA[t.type];
    if (data) {
      loadModelData(data, { targetLen: 2.0, forward: '+z', key: t.type }).then((model) => {
        model.traverse((o) => {
          if (o.isMesh && o.material) {
            o.material = o.material.clone();
            o.material.metalness = Math.max(o.material.metalness ?? 0, 0.2);
            o.material.roughness = Math.min(o.material.roughness ?? 0.7, 0.7);
          }
        });
        g.remove(base); g.remove(head);
        g.add(model);
      }).catch(() => {});
    }
    g.scale.setScalar(0.9 + lvl * 0.08);
    return g;
  }
  function buildWallMesh() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), new THREE.MeshLambertMaterial({ color: WALL.color }));
    b.position.y = 0.35;
    g.add(b);
    return g;
  }

  // 敌人几何（按类型形状区分）
  function enemySpecShape(type) {
    const s = ENEMIES[type];
    let geo;
    if (type === 'runner') geo = new THREE.ConeGeometry(s.scale, s.scale * 1.8, 5);
    else if (type === 'breaker') geo = new THREE.BoxGeometry(s.scale * 1.4, s.scale * 1.4, s.scale * 1.4);
    else if (type === 'flyer') geo = new THREE.OctahedronGeometry(s.scale * 1.2);
    else if (type === 'boss') geo = new THREE.BoxGeometry(s.scale * 1.2, s.scale * 1.2, s.scale * 1.2);
    else geo = new THREE.SphereGeometry(s.scale, 10, 8);
    return geo;
  }
  const enemyGeos = {};
  const enemyMats = {};
  for (const k in ENEMIES) { enemyGeos[k] = enemySpecShape(k); enemyMats[k] = new THREE.MeshLambertMaterial({ color: ENEMIES[k].color }); }

  let ringMesh = null;
  let previewGhost = null;
  let previewLine = null;

  // 视图状态（main 写入）
  const view = { selected: null, hover: null, previewPath: null, range: null };

  function rebuildPath(run) {
    pathTiles.clear();
    if (pathLine) { pathTiles.remove(pathLine); pathLine = null; }
    const pts = run.path.map((p) => { const w = cellWorld(p.c, p.r); return new THREE.Vector3(w.x, 0, w.z); });
    const tan = new THREE.MeshLambertMaterial({ color: PAL.path });
    loadTexture('assets/tex/path.webp', 4, 4).then((t) => { if (t) { tan.map = t; tan.color.set(0xffffff); tan.needsUpdate = true; } });
    for (const p of run.path) {
      const w = cellWorld(p.c, p.r);
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), tan);
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(w.x, 0.015, w.z);
      pathTiles.add(tile);
    }
    pathLine = buildRibbon(pts, 0.34, PAL.enemy);
    pathTiles.add(pathLine);
  }

  function syncTowers(run) {
    const seen = new Set();
    for (const k in run.towers) {
      const t = run.towers[k];
      seen.add(t.id);
      let m = towerMeshes.get(t.id);
      if (!m || m.userData.sig !== `${t.type}:${t.level}`) {
        if (m) towerGroup.remove(m);
        m = buildTowerMesh(t);
        m.userData.sig = `${t.type}:${t.level}`;
        towerGroup.add(m);
        towerMeshes.set(t.id, m);
      }
      const w = cellWorld(t.c, t.r);
      m.position.set(w.x, 0, w.z);
      m.userData.tower = t;
    }
    for (const [id, m] of towerMeshes) {
      if (!seen.has(id)) { towerGroup.remove(m); towerMeshes.delete(id); }
    }
  }

  function syncWalls(run) {
    for (const k in run.walls) {
      const w = run.walls[k];
      if (!wallMeshes.has(k)) { const m = buildWallMesh(); wallGroup.add(m); wallMeshes.set(k, m); }
      const m = wallMeshes.get(k);
      const ww = cellWorld(w.c, w.r);
      m.position.set(ww.x, 0, ww.z);
      m.scale.setScalar(0.6 + 0.4 * (w.hp / WALL.hp));
    }
    for (const k of wallMeshes.keys()) {
      if (!run.walls[k]) { wallGroup.remove(wallMeshes.get(k)); wallMeshes.delete(k); }
    }
  }

  function syncEnemies(run) {
    while (enemyMeshes.length < run.enemies.length) {
      const m = new THREE.Mesh(enemyGeos.infantry, enemyMats.infantry);
      enemyGroup.add(m);
      enemyMeshes.push(m);
    }
    for (let i = 0; i < enemyMeshes.length; i++) {
      const m = enemyMeshes[i];
      const e = run.enemies[i];
      if (!e) { m.visible = false; continue; }
      m.visible = true;
      m.geometry = enemyGeos[e.type] || enemyGeos.infantry;
      m.material = enemyMats[e.type] || enemyMats.infantry;
      m.position.set(e.x, e.flying ? 0.8 : (e.spec.scale || 0.3), e.z);
      m.rotation.y = e.type === 'runner' ? Math.atan2(e.x, e.z) : 0;
      const k = Math.min(1, e.hp / e.maxHp);
      m.scale.setScalar(0.8 + k * 0.2);
    }
  }

  function syncProjectiles(run) {
    while (projMeshes.length < run.projectiles.length) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      projGroup.add(m);
      projMeshes.push(m);
    }
    for (let i = 0; i < projMeshes.length; i++) {
      const m = projMeshes[i];
      const p = run.projectiles[i];
      if (!p) { m.visible = false; continue; }
      m.visible = true;
      m.position.set(p.x, 0.35, p.z);
      m.material.color.set(p.type === 'cannon' ? 0x1f2937 : 0xfff7d6);
    }
  }

  function syncPreview() {
    if (ringMesh) { fxGroup.remove(ringMesh); ringMesh = null; }
    if (previewGhost) { fxGroup.remove(previewGhost); previewGhost = null; }
    if (previewLine) { fxGroup.remove(previewLine); previewLine = null; }
    if (view.hover && view.selected) {
      const w = cellWorld(view.hover.c, view.hover.r);
      const spec = view.selected === 'wall' ? null : TOWERS[view.selected].levels[0];
      const range = spec ? spec.range : 0;
      const ok = view.hover.canPlace;
      const col = ok ? 0x65a30d : 0xdc2626;
      if (range > 0) {
        ringMesh = new THREE.Mesh(
          new THREE.RingGeometry(range - 0.06, range, 48),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
        );
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.set(w.x, 0.04, w.z);
        fxGroup.add(ringMesh);
      }
      const ghost = view.selected === 'wall' ? buildWallMesh() : buildTowerMesh({ type: view.selected, level: 1 });
      ghost.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5; } });
      ghost.position.set(w.x, 0, w.z);
      fxGroup.add(ghost);
      previewGhost = ghost;
      if (view.previewPath) {
        const pts = view.previewPath.map((p) => { const pw = cellWorld(p.c, p.r); return new THREE.Vector3(pw.x, 0, pw.z); });
        previewLine = buildRibbon(pts, 0.3, 0xf59e0b, 0.08);
        fxGroup.add(previewLine);
      }
    }
  }

  function render(run, dt) {
    if (run) {
      if (!run._pathSig || run._pathSig !== run.path.map((p) => p.c + ',' + p.r).join('|')) {
        run._pathSig = run.path.map((p) => p.c + ',' + p.r).join('|');
        rebuildPath(run);
      }
      syncTowers(run);
      syncWalls(run);
      syncEnemies(run);
      syncProjectiles(run);
    } else {
      cam.yaw += dt * 0.1;
    }
    syncPreview();
    applyCam();
    renderer.render(scene, camera);
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function pickCell(clientX, clientY) {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const c = Math.round(hit.x + (MAP.cols - 1) / 2);
    const r = Math.round(hit.z + (MAP.rows - 1) / 2);
    if (c < 0 || r < 0 || c >= MAP.cols || r >= MAP.rows) return null;
    return { c, r };
  }

  function onEvent(ev) { /* 渲染侧无重型 fx，保留接口 */ }

  function dispose() {
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    renderer.dispose();
  }

  resize(window.innerWidth, window.innerHeight);
  applyCam();

  return {
    render, resize, setView: (v) => Object.assign(view, v), get view() { return view; },
    pickCell, onEvent, dispose, camera, scene, cam, applyCam,
    orbit(dyaw, dpitch, ddist) {
      cam.yaw += dyaw;
      cam.pitch = Math.max(CAM.minPitch, Math.min(CAM.maxPitch, cam.pitch + dpitch));
      cam.dist = Math.max(CAM.minDist, Math.min(CAM.maxDist, cam.dist * ddist));
      applyCam();
    },
  };
}
