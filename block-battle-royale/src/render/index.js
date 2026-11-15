// src/render/index.js — three.js 体素岛渲染：地形/建筑/实体/圈/战利品/粒子。
// 贴图槽位：assets/sky.jpg（天空）、assets/tex/grass.webp（草）、assets/tex/brick.webp（砖），加载失败回退程序化，不白屏不报错。
import { THREE, createStage, addLights, addFog, lambert } from '../core/base3d.js';
import { loadModelData, tintModel } from '../../lib/model-loader-data.js';
import { MAP, PLAYER, COLORS, BUILD } from '../../config/game.config.js';

const KIND = { NONE: 0, BUILDING: 1, WALL: 2, RAMP: 3 };

export function createRenderer(canvas) {
  const stage = createStage({ canvas, clearColor: COLORS.sky, fov: 72, far: 320 });
  const { renderer, scene, camera } = stage;
  addLights(scene, { sky: 0xbfd4ff, ground: 0x3a2f24, sun: 0xffffff, intensity: 1.15, sunPos: [40, 70, 30] });
  addFog(scene, 0x9fd4f5, 55, 240);

  // ---- 天空：sky.jpg（等距柱状）优先，回退程序化渐变（不白屏不报错）----
  function makeSkyGradient() {
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#5aa7f0');
    grad.addColorStop(0.55, '#9fd4f5');
    grad.addColorStop(1, '#e0f2ff');
    g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  scene.background = makeSkyGradient();

  const dummy = new THREE.Object3D();
  const M = new THREE.Matrix4();

  // ---- 贴图槽位（失败静默回退）----
  const loader = new THREE.TextureLoader();
  const tex = {};
  function loadTex(url, onOk) {
    try {
      loader.load(url, (t) => { tex[url] = t; onOk(t); }, undefined, () => {});
    } catch { /* 回退程序化 */ }
  }
  loadTex('assets/sky.jpg', (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
  });

  // ---- 水 ----
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP.size + 2, MAP.size + 2),
    new THREE.MeshLambertMaterial({ color: COLORS.water }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(MAP.center, -1.01, MAP.center);
  scene.add(water);

  // ---- 地形柱（岛内 1×1×1 草方块）----
  const terrainGeo = new THREE.BoxGeometry(1, 1, 1);
  const terrainMat = new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 0.95, metalness: 0 });
  const islandCells = [];
  {
    const n = MAP.size, c = MAP.center;
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - c, z + 0.5 - c);
      if (d < MAP.islandRadius) islandCells.push(x + z * n);
    }
  }
  const terrain = new THREE.InstancedMesh(terrainGeo, terrainMat, islandCells.length);
  islandCells.forEach((i, idx) => {
    const x = i % MAP.size, z = Math.floor(i / MAP.size);
    dummy.position.set(x + 0.5, -0.5, z + 0.5);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    terrain.setMatrixAt(idx, dummy.matrix);
  });
  terrain.instanceMatrix.needsUpdate = true;
  terrain.receiveShadow = true;
  scene.add(terrain);
  loadTex('assets/tex/grass.webp', (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 1); // 1×1 草方块，每面一整张瓦片
    terrainMat.color.set(0xffffff);
    terrainMat.map = t; terrainMat.needsUpdate = true;
  });

  // ---- 建筑 / 掩体（每帧按世界重建实例）----
  const maxBlocks = MAP.size * MAP.size;
  const blockGeo = new THREE.BoxGeometry(1, 1, 1);
  const buildingMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.9, metalness: 0 });
  const coverMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85, metalness: 0 });
  const buildings = new THREE.InstancedMesh(blockGeo, buildingMat, maxBlocks);
  const covers = new THREE.InstancedMesh(blockGeo, coverMat, maxBlocks);
  buildings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  covers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  buildings.receiveShadow = true; covers.receiveShadow = true;
  scene.add(buildings); scene.add(covers);
  loadTex('assets/tex/brick.webp', (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 1); // 1×1 砖块，每面一整张瓦片
    buildingMat.color.set(0xffffff);
    buildingMat.map = t; buildingMat.needsUpdate = true;
  });

  let blockDirty = true;
  function rebuildBlocks(run) {
    let bi = 0, ci = 0;
    for (let i = 0; i < run.n * run.n; i++) {
      const h = run.top[i] - run.base[i];
      if (h <= 0) continue;
      const x = i % MAP.size, z = Math.floor(i / MAP.size);
      for (let k = 0; k < h; k++) {
        const y = run.base[i] + k + 0.5;
        dummy.position.set(x + 0.5, y, z + 0.5);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        if (run.kind[i] === KIND.BUILDING) { buildings.setMatrixAt(bi++, dummy.matrix); }
        else { covers.setMatrixAt(ci++, dummy.matrix); covers.setColorAt(ci - 1, new THREE.Color(run.kind[i] === KIND.RAMP ? COLORS.ramp : COLORS.wall)); }
      }
    }
    buildings.count = bi;
    covers.count = ci;
    buildings.instanceMatrix.needsUpdate = true;
    covers.instanceMatrix.needsUpdate = true;
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    if (covers.instanceColor) covers.instanceColor.needsUpdate = true;
  }

  // ---- 实体：玩家 + 29 bot（GLB blocky-soldier，程序化 Box 兜底）----
  const playerGroup = new THREE.Group();
  const bodyMat = lambert(COLORS.player);
  const headMat = lambert(0x93c5fd);
  const gunMat = lambert(0x334155);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.5, 0.5), bodyMat);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), headMat);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.8), gunMat);
  body.position.y = 0.75; head.position.y = 1.55; gun.position.set(0.15, 1.3, -0.5);
  const playerFallback = new THREE.Group();
  playerFallback.add(body, head, gun);
  playerGroup.add(playerFallback);
  scene.add(playerGroup);

  const botBodyGeo = new THREE.BoxGeometry(0.7, 1.5, 0.5);
  const botHeadGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
  const botBody = new THREE.InstancedMesh(botBodyGeo, lambert(COLORS.bot), 40);
  const botHead = new THREE.InstancedMesh(botHeadGeo, lambert(0xfca5a5), 40);
  scene.add(botBody, botHead);

  // GLB 士兵：动态 import，模块缺失/加载失败静默回退程序化（不白屏不报错）。
  // forward '+z' 归一化后朝 -Z，与 sim yaw 约定（yaw=0 朝 -Z）及原枪口 -Z 一致。
  function loadSoldier() {
    return import('../../lib/models/blocky-soldier.glb.js')
      .then((mod) => loadModelData(mod.default, { targetLen: 1.9, forward: '+z', key: 'blocky-soldier' }))
      .catch(() => null);
  }
  // 玩家：整组替换，render 只驱动 playerGroup 的 position/rotation（零成本）
  loadSoldier().then((model) => {
    if (!model) return;
    playerGroup.remove(playerFallback);
    playerGroup.add(model);
  });
  // bot：预加载克隆池（共享几何/材质），替代双 InstancedMesh；超量自动扩容
  const BOT_POOL_SIZE = 32; // BOTS.count=29，留余量
  const botPool = [];
  let botProto = null;
  function growBotPool() {
    const g = botProto.clone(true);
    g.visible = false;
    scene.add(g);
    botPool.push(g);
    return g;
  }
  loadSoldier().then((model) => {
    if (!model) return;
    botProto = tintModel(model, COLORS.bot, 0.6); // 红队辨识 tint；材质已克隆，不影响玩家共享材质
    botProto.traverse((o) => { // 蓝甲×红色 tint 仍偏蓝，补红色自发光保留原版"红.bot"敌我辨识
      if (o.isMesh && o.material) { o.material.emissive = new THREE.Color(COLORS.bot); o.material.emissiveIntensity = 0.3; }
    });
    for (let i = 0; i < BOT_POOL_SIZE; i++) growBotPool();
    botBody.visible = false; botHead.visible = false;
  });

  // ---- 战利品 / 死亡盒（战利品换 GLB loot-crate 克隆池，InstancedMesh 兜底）----
  const lootMat = new THREE.MeshBasicMaterial({ color: COLORS.loot });
  const lootGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
  const lootMesh = new THREE.InstancedMesh(lootGeo, lootMat, 128);
  lootMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(lootMesh);

  const LOOT_POOL_SIZE = 96; // 60 堆 + 2 初始 + 死亡掉落 + 空投，超量自动扩容
  const lootPool = [];
  let lootProto = null;
  function growLootPool() {
    const g = lootProto.clone(true);
    g.visible = false;
    scene.add(g);
    lootPool.push(g);
    return g;
  }
  import('../../lib/models/loot-crate.glb.js')
    .then((mod) => loadModelData(mod.default, { targetLen: 1.4, forward: '+z', key: 'loot-crate' }))
    .then((model) => {
      // 保留原发光拾取 affordance：PBR 材质上加弱自发光（克隆材质，避免污染缓存）
      model.traverse((o) => {
        if (o.isMesh && o.material) {
          o.material = o.material.clone();
          o.material.emissive = new THREE.Color(COLORS.loot);
          o.material.emissiveIntensity = 0.22;
        }
      });
      lootProto = model;
      for (let i = 0; i < LOOT_POOL_SIZE; i++) growLootPool();
      lootMesh.visible = false;
    })
    .catch(() => {});

  const deathGeo = new THREE.BoxGeometry(0.9, 0.5, 0.6);
  const deathMesh = new THREE.InstancedMesh(deathGeo, lambert(COLORS.deathBox), 32);
  deathMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(deathMesh);

  // ---- 缩圈墙 + 地面圈 ----
  const zoneMat = new THREE.MeshBasicMaterial({ color: COLORS.zone, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  const zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 44, 48, 1, true), zoneMat);
  zoneMesh.position.y = 22;
  scene.add(zoneMesh);
  const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 48), new THREE.MeshBasicMaterial({ color: COLORS.zone, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.08;
  scene.add(ringMesh);

  // ---- 粒子池（命中火花 / 碎块）----
  const P = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
    m.visible = false; scene.add(m); P.push({ m, ttl: 0 });
  }

  function spawnFx(x, y, z, color) {
    const p = P.find((q) => q.ttl <= 0) || P[0];
    p.m.visible = true; p.ttl = 0.28;
    p.m.position.set(x, y, z);
    p.m.material.color.set(color);
    p.m.scale.setScalar(1);
  }

  // ---- 相机 ----
  const aim = { yaw: 0, pitch: 0, shake: 0 };
  function applyCamera(x, y, z, yaw, pitch) {
    camera.position.set(x, y + PLAYER.eye, z);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(yaw);
    camera.rotateX(pitch);
  }

  let titleT = 0;
  function renderTitle(dt) {
    titleT += dt;
    const c = MAP.center;
    const a = titleT * 0.1;
    camera.position.set(c + Math.sin(a) * 40, 24, c + Math.cos(a) * 40);
    camera.lookAt(c, 1, c);
  }

  function render(run, state, dt = 1 / 60) {
    // 粒子衰减
    for (const p of P) {
      if (p.ttl > 0) {
        p.ttl -= dt;
        p.m.scale.setScalar(Math.max(0.01, p.ttl / 0.28));
        if (p.ttl <= 0) p.m.visible = false;
      }
    }
    if (!run) {
      renderer.render(scene, camera);
      return;
    }
    if (blockDirty) { rebuildBlocks(run); blockDirty = false; }

    // 圈
    zoneMesh.scale.set(run.zone.r, 1, run.zone.r);
    zoneMesh.position.set(run.zone.cx, 22, run.zone.cz);
    ringMesh.scale.set(run.zone.r, 1, run.zone.r);
    ringMesh.position.set(run.zone.cx, 0.08, run.zone.cz);

    // 实体（GLB 克隆池优先，未就绪走 InstancedMesh 兜底）
    let bi = 0;
    for (const b of run.bots) {
      if (!b.alive) continue;
      if (botProto) {
        const g = botPool[bi] || growBotPool();
        g.visible = true;
        g.position.set(b.x, b.y, b.z); // GLB 底部落地 y=0，直接脚底对齐
        g.rotation.set(0, b.yaw || 0, 0);
      } else {
        dummy.position.set(b.x, b.y + 0.75, b.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        botBody.setMatrixAt(bi, dummy.matrix);
        dummy.position.set(b.x, b.y + 1.52, b.z);
        dummy.updateMatrix();
        botHead.setMatrixAt(bi, dummy.matrix);
      }
      bi++;
    }
    if (botProto) {
      for (let i = bi; i < botPool.length; i++) botPool[i].visible = false;
    } else {
      botBody.count = bi; botHead.count = bi;
      botBody.instanceMatrix.needsUpdate = true; botHead.instanceMatrix.needsUpdate = true;
    }

    const p = run.player;
    // 第一人称纯 FPS 视角：GLB 士兵肩宽/胸深大于原瘦盒，置于眼相机会挡屏（原盒体恰在屏外）。
    // 因此游玩时隐藏自身模型（与原版观感一致），标题环绕镜头展示 GLB 士兵。
    playerGroup.visible = state === 'title';
    playerGroup.position.set(p.x, p.y, p.z);
    playerGroup.rotation.set(0, 0, 0);
    playerGroup.rotateY(p.yaw);

    // 战利品（保留旋转 + 空投 1.4 缩放）
    let li = 0;
    for (const l of run.loot) {
      const s = l.airdrop ? 1.4 : 1;
      if (lootProto) {
        const g = lootPool[li] || growLootPool();
        g.visible = true;
        g.position.set(l.x, Math.max(0, l.y ?? 0), l.z);
        g.rotation.set(0, run.time * 2, 0);
        g.scale.setScalar(s);
      } else {
        dummy.position.set(l.x, Math.max(0, l.y ?? 0) + 0.4, l.z);
        dummy.rotation.y = run.time * 2;
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        lootMesh.setMatrixAt(li, dummy.matrix);
      }
      li++;
    }
    if (lootProto) {
      for (let i = li; i < lootPool.length; i++) lootPool[i].visible = false;
    } else {
      lootMesh.count = li;
      lootMesh.instanceMatrix.needsUpdate = true;
    }

    // 死亡盒
    let di = 0;
    for (const d of run.deathBoxes) {
      dummy.position.set(d.x, 0.25, d.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      deathMesh.setMatrixAt(di++, dummy.matrix);
    }
    deathMesh.count = di;
    deathMesh.instanceMatrix.needsUpdate = true;

    // 相机
    if (state === 'title') renderTitle(dt);
    else applyCamera(p.x, p.y, p.z, p.yaw, p.pitch);

    renderer.render(scene, camera);
  }

  function onEvent(ev) {
    if (ev.type === 'blockBreak') { blockDirty = true; spawnFx(ev.x, (ev.y ?? 1) + 0.5, ev.z, COLORS.wall); }
    else if (ev.type === 'build') blockDirty = true;
    else if (ev.type === 'hit') spawnFx(ev.x, (ev.y ?? 1) + 1, ev.z, COLORS.danger);
    else if (ev.type === 'spark') spawnFx(ev.x, ev.y, ev.z, 0xffe08a);
    else if (ev.type === 'kill') spawnFx(ev.x, 1.2, ev.z, COLORS.danger);
  }

  return { render, onEvent, resize: stage.resize, markBlocksDirty: () => { blockDirty = true; } };
}
