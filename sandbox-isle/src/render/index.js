// src/render/index.js — three.js 体素岛渲染：InstancedMesh 体素 / 动物 / 粒子 / 天空 / 准星幽灵。
// 依赖 lib/three.module.js + src/core/base3d.js；贴图缺失时回退程序化（不白屏不报错）。
// 动物主体：GLB 高精模型（lib/models/*.glb.js，data-URI 零网络），加载失败回退程序化粗模。
import { createStage, addLights, addFog, lambert, Pool, clamp } from '../core/base3d.js';
import * as THREE from '../../lib/three.module.js';
import { loadModelData } from '../../lib/model-loader-data.js';
import chickenData from '../../lib/models/chicken.glb.js';
import sheepData from '../../lib/models/sheep.glb.js';
import peacockData from '../../lib/models/peacock.glb.js';
import { WORLD, BLOCK_DEFS, BLOCKS, HOTBAR, RAINBOW } from '../../config/game.config.js';
import { getBlock, isSolid, raycast } from '../game/sim.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);

function blockMat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

// 方块贴图（assets/tex）：grass 照片带白边，内裁 4% 避免白框；缺失时回退纯色
const BLOCK_TEX = { 1: 'grass', 4: 'sand', 5: 'water' };
function applyBlockTextures(materials) {
  const loader = new THREE.TextureLoader();
  for (const id of Object.keys(BLOCK_TEX)) {
    const mat = materials[id];
    if (!mat) continue;
    loader.load(`assets/tex/${BLOCK_TEX[id]}.webp`, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      if (BLOCK_TEX[id] === 'grass') { tex.offset.set(0.04, 0.04); tex.repeat.set(0.92, 0.92); }
      tex.anisotropy = 4;
      mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
    }, undefined, () => { /* 缺失回退纯色 */ });
  }
}

// GLB 动物主体规格：targetLen 对齐原程序化网格尺寸，朝向 +z（与原头部朝向一致）
const ANIMAL_MODEL_SPECS = {
  chicken: { targetLen: 0.9, data: chickenData },
  sheep: { targetLen: 1.2, data: sheepData },
  peacock: { targetLen: 1.6, data: peacockData },
};

// 在 GLB 里找孔雀尾屏节点（开屏动画引用）；找不到则保留程序化尾屏叠加
function findFanNode(model) {
  let best = null, bestScore = 0;
  model.traverse((o) => {
    const n = (o.name || '').toLowerCase();
    if (!n) return;
    const score = /fan|screen|plum|train/.test(n) ? 3 : /feather/.test(n) ? 2 : /tail/.test(n) ? 1 : 0;
    if (score > bestScore) { best = o; bestScore = score; }
  });
  return best;
}

// 天空：贴图失败回退纯色
function buildSky(scene) {
  const geo = new THREE.SphereGeometry(160, 24, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0x87ceeb, side: THREE.BackSide, fog: false });
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'sky';
  scene.add(sky);
  const loader = new THREE.TextureLoader();
  loader.load('assets/sky.jpg', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
  }, undefined, () => { /* 缺失回退纯色 */ });
  return sky;
}

// 动物：GLB 高精主体 + 程序化 fallback。
// 结构约定（render 每帧驱动，勿破坏）：
//   g.children[0] = bob 枢轴（position.y = 0.45 + bob），GLB/fallback 都挂其内并下移 0.45 贴地；
//   g.userData.fan = 孔雀尾屏（GLB 尾屏节点或程序化尾屏），scale 驱动开合。
function buildAnimal(type, color, seed) {
  const g = new THREE.Group();
  const bobPivot = new THREE.Group();
  bobPivot.position.y = 0.45;
  g.add(bobPivot);
  // 程序化 fallback（GLB 加载成功后移除）
  const proc = new THREE.Group();
  proc.position.y = -0.45;
  bobPivot.add(proc);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.55), lambert(color));
  body.position.y = 0.45; proc.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), lambert(type === 'chicken' ? 0xf472b6 : 0xffffff));
  head.position.set(0, 0.78, 0.28); proc.add(head);
  if (type === 'chicken') {
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 6), lambert(0xfacc15));
    beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.74, 0.46); proc.add(beak);
    g.userData.comb = (() => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 6), lambert(0xef4444)); c.position.set(0, 0.95, 0.3); proc.add(c); return c; })();
  } else if (type === 'sheep') {
    const wool = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), lambert(0xffffff));
    wool.position.set(0, 0.5, -0.05); proc.add(wool);
  } else if (type === 'peacock') {
    // 尾屏：默认收拢，开屏时展开彩羽（GLB 无独立尾屏节点时保留此叠加层）
    const fan = new THREE.Group();
    const cols = [0x22c55e, 0x06b6d4, 0x3b82f6, 0x8b5cf6, 0xef4444];
    for (let i = 0; i < 9; i++) {
      const feather = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.9, 6), lambert(cols[i % cols.length]));
      feather.position.set(0, 0.15, 0);
      feather.rotation.x = -Math.PI / 2 + (i - 4) * 0.24;
      feather.rotation.z = (i - 4) * 0.34;
      fan.add(feather);
    }
    fan.position.set(0, 0.5, -0.42);
    fan.scale.setScalar(0.01);
    fan.name = 'fan';
    g.add(fan);
    g.userData.fan = fan;
  }
  g.userData.type = type;
  // 异步换 GLB：保留 bob 枢轴与 fan 引用，只换视觉网格
  const spec = ANIMAL_MODEL_SPECS[type];
  if (spec) {
    loadModelData(spec.data, { targetLen: spec.targetLen, forward: '+z', key: type }).then((model) => {
      if (!model || !g.parent) return; // 加载期间动物已被 rebuild 移除
      bobPivot.remove(proc);
      model.position.y = -0.45; // GLB 归一化底部 y=0 → 贴地，bob 由枢轴驱动
      bobPivot.add(model);
      if (type === 'peacock') {
        // GLB 若带独立尾屏节点则接管 fan 引用；否则保留程序化尾屏叠加在 GLB 身体上
        const fanNode = findFanNode(model);
        if (fanNode && g.userData.fan) {
          const k = g.userData.fan.scale.x; // 继承当前开合度
          g.remove(g.userData.fan);
          fanNode.userData.baseScale = fanNode.scale.clone();
          fanNode.userData.k = k;
          fanNode.scale.multiplyScalar(k);
          g.userData.fan = fanNode;
        }
      }
    }).catch(() => { /* GLB 失败保留程序化 */ });
  }
  return g;
}

export function createRenderer(canvas) {
  const stage = createStage({ canvas, clearColor: 0x87ceeb, fov: 70, near: 0.1, far: 400 });
  const { renderer, scene, camera } = stage;
  addFog(scene, 0xbfe8ff, 40, 120);
  addLights(scene, { sky: 0xbfe0ff, ground: 0x3a2f24, sun: 0xfff2d0, intensity: 1.4, sunPos: [40, 60, 20] });
  buildSky(scene);

  // 水面微光平面（波光）
  const waterPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.W, WORLD.D),
    new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.25, depthWrite: false }),
  );
  waterPlane.rotation.x = -Math.PI / 2;
  waterPlane.position.set(WORLD.W / 2, WORLD.WATER_LEVEL + 0.06, WORLD.D / 2);
  scene.add(waterPlane);

  const R = {
    stage, renderer, scene, camera,
    dirty: true, _sim: null,
    voxels: {}, materials: {}, animals: {},
    ghost: null, ghostMat: null,
    particles: [],
    view: 'fp', // fp | top
    fanFx: 0,
  };

  // 准星幽灵（放置预览）
  R.ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.7, depthTest: false });
  R.ghost = new THREE.Mesh(BOX, R.ghostMat);
  R.ghost.visible = false;
  R.ghost.renderOrder = 999;
  scene.add(R.ghost);

  // 第一人称手持方块：右下角显示当前选中的方块，作为「玩家」可视化锚点
  scene.add(camera);
  const hand = new THREE.Group();
  const handMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x222222 });
  const handBlock = new THREE.Mesh(BOX, handMat);
  handBlock.scale.setScalar(0.5);
  handBlock.position.set(0.4, -0.32, -0.72);
  handBlock.rotation.set(0.18, 0.5, 0.05);
  hand.add(handBlock);
  hand.visible = false;
  camera.add(hand);

  // 粒子池
  const PART_N = 220;
  const partGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  for (let i = 0; i < PART_N; i++) {
    const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    m.visible = false;
    scene.add(m);
    R.particles.push({ m, vx: 0, vy: 0, vz: 0, life: 0, max: 1, grav: 12 });
  }
  let partCursor = 0;
  function spawnParticle(x, y, z, color, vx, vy, vz, life = 0.7, grav = 12) {
    const p = R.particles[partCursor]; partCursor = (partCursor + 1) % PART_N;
    p.m.visible = true; p.m.material.color.set(color);
    p.m.position.set(x, y, z);
    p.vx = vx; p.vy = vy; p.vz = vz; p.life = life; p.max = life; p.grav = grav;
  }

  function materialsFor() {
    if (Object.keys(R.materials).length) return;
    for (const id of Object.keys(BLOCK_DEFS)) {
      const d = BLOCK_DEFS[id];
      const opts = d.fluid ? { transparent: true, opacity: 0.66, depthWrite: false } : {};
      R.materials[id] = blockMat(d.color, opts);
    }
    applyBlockTextures(R.materials);
  }

  function rebuild(sim) {
    materialsFor();
    for (const k in R.voxels) { scene.remove(R.voxels[k]); R.voxels[k].dispose(); }
    R.voxels = {};
    const buckets = {};
    const { w, h, d } = sim.dims;
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        for (let y = 0; y < h; y++) {
          const b = getBlock(sim.world, x, y, z);
          if (b === BLOCKS.AIR) continue;
          const exposed = b === BLOCKS.WATER
            ? getBlock(sim.world, x, y + 1, z) === BLOCKS.AIR
            : (
              getBlock(sim.world, x + 1, y, z) === BLOCKS.AIR || getBlock(sim.world, x - 1, y, z) === BLOCKS.AIR ||
              getBlock(sim.world, x, y + 1, z) === BLOCKS.AIR || getBlock(sim.world, x, y - 1, z) === BLOCKS.AIR ||
              getBlock(sim.world, x, y, z + 1) === BLOCKS.AIR || getBlock(sim.world, x, y, z - 1) === BLOCKS.AIR
            );
          if (!exposed) continue;
          (buckets[b] = buckets[b] || []).push([x, y, z]);
        }
      }
    }
    const mtx = new THREE.Matrix4();
    for (const b in buckets) {
      const arr = buckets[b];
      const mesh = new THREE.InstancedMesh(BOX, R.materials[b], arr.length);
      arr.forEach(([x, y, z], i) => {
        mtx.setPosition(x + 0.5, y + 0.5, z + 0.5);
        mesh.setMatrixAt(i, mtx);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (BLOCK_DEFS[b]?.fluid) mesh.renderOrder = 1;
      R.voxels[b] = mesh;
      scene.add(mesh);
    }
    // 动物（buildAnimal 返回 Group：GLB 或程序化 fallback，rebuild 统一实例化）
    for (const k in R.animals) { scene.remove(R.animals[k]); }
    R.animals = {};
    const AC = { chicken: 0xfde68a, sheep: 0xf8fafc, peacock: 0x2563eb };
    for (const a of sim.animals) {
      const g = buildAnimal(a.type, AC[a.type], sim.seed);
      R.animals[a.id] = g;
      scene.add(g);
    }
  }

  function setCamera(sim, dt) {
    const p = sim.player;
    if (R.view === 'top') {
      camera.position.set(WORLD.W / 2, 34, WORLD.D / 2 + 0.01);
      camera.rotation.set(0, 0, 0);
      camera.lookAt(WORLD.W / 2, 0, WORLD.D / 2);
      camera.up.set(0, 0, -1);
    } else {
      camera.up.set(0, 1, 0);
      camera.position.set(p.x, p.y + WORLD.EYE, p.z);
      camera.rotation.set(0, 0, 0);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = p.yaw;
      camera.rotation.x = clamp(p.pitch, -1.45, 1.45);
    }
  }

  function updateGhost(sim) {
    const p = sim.player;
    const e = { x: p.x, y: p.y + WORLD.EYE, z: p.z };
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const dx = -sin * Math.cos(p.pitch), dy = Math.sin(p.pitch), dz = -cos * Math.cos(p.pitch);
    const hit = raycast(sim, e.x, e.y, e.z, dx, dy, dz, WORLD.REACH);
    if (!hit.hit) { R.ghost.visible = false; return; }
    const sel = HOTBAR[p.slot];
    const px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
    const ok = BLOCK_DEFS[sel]?.placeable && (sim.player.inventory[sel] || 0) > 0 && getBlock(sim.world, px, py, pz) === BLOCKS.AIR;
    R.ghost.visible = true;
    R.ghost.position.set(px + 0.5, py + 0.5, pz + 0.5);
    R.ghostMat.color.set(ok ? 0x22c55e : 0xef4444);
  }

  R.render = function render(sim, dt) {
    if (!sim) { renderer.render(scene, camera); return; }
    if (R._sim !== sim) { R._sim = sim; R.dirty = true; }
    if (R.dirty) { rebuild(sim); R.dirty = false; }
    setCamera(sim, dt);
    updateGhost(sim);
    const sel = HOTBAR[sim.player.slot];
    handMat.color.set(BLOCK_DEFS[sel].color);
    handMat.emissive.set(BLOCK_DEFS[sel].color).multiplyScalar(0.3);
    handBlock.position.y = -0.32 + Math.sin(sim.time * 3) * 0.012;
    // 动物姿态
    for (const a of sim.animals) {
      const g = R.animals[a.id];
      if (!g) continue;
      g.position.set(a.x, a.y, a.z);
      g.rotation.y = a.yaw;
      const bob = Math.sin(a.anim * 6) * 0.04;
      g.children[0].position.y = 0.45 + bob; // children[0] = bob 枢轴（GLB/fallback 共用）
      if (g.userData.fan) {
        const f = g.userData.fan;
        const target = a.fan ? 1 : 0.01;
        const bs = f.userData.baseScale; // GLB 尾屏节点：按基础缩放 × 开合度
        const cur = bs ? (f.userData.k ?? 0.01) : f.scale.x;
        const next = cur + (target - cur) * Math.min(1, dt * 8);
        if (bs) { f.userData.k = next; f.scale.set(bs.x * next, bs.y * next, bs.z * next); }
        else f.scale.setScalar(next);
      }
    }
    // 水面微光 + 粒子
    waterPlane.position.y = WORLD.WATER_LEVEL + 0.06 + Math.sin(sim.time * 1.5) * 0.03;
    for (const p of R.particles) {
      if (!p.m.visible) continue;
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; continue; }
      p.vy -= p.grav * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      const s = Math.max(0.2, p.life / p.max);
      p.m.scale.setScalar(s);
    }
    renderer.render(scene, camera);
  };

  R.onEvent = function onEvent(ev) {
    if (ev.type === 'dig') {
      for (let i = 0; i < 8; i++) {
        spawnParticle(ev.x + 0.5, ev.y + 0.5, ev.z + 0.5, BLOCK_DEFS[ev.block].color,
          (Math.random() - 0.5) * 4, Math.random() * 4, (Math.random() - 0.5) * 4, 0.5);
      }
    } else if (ev.type === 'place') {
      for (let i = 0; i < 4; i++) spawnParticle(ev.x + 0.5, ev.y + 0.5, ev.z + 0.5, 0xffffff, (Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2, 0.3, 2);
    } else if (ev.type === 'feed') {
      for (let i = 0; i < 6; i++) spawnParticle(ev.x, ev.y + 0.8, ev.z, 0xef4444, (Math.random() - 0.5) * 2, 2 + Math.random() * 2, (Math.random() - 0.5) * 2, 0.6, 2);
    } else if (ev.type === 'peacock_fan') {
      for (let i = 0; i < 30; i++) {
        const ang = Math.random() * Math.PI * 2;
        const cols = [0x22c55e, 0x06b6d4, 0x3b82f6, 0x8b5cf6, 0xef4444, 0xfacc15];
        spawnParticle(ev.x, ev.y + 0.6, ev.z, cols[i % cols.length],
          Math.cos(ang) * 3, 2 + Math.random() * 3, Math.sin(ang) * 3, 1.1, 5);
      }
    } else if (ev.type === 'gold_egg') {
      spawnParticle(ev.x, ev.y + 1, ev.z, 0xfacc15, 0, 3, 0, 1.2, 14);
    } else if (ev.type === 'win') {
      for (let i = 0; i < 80; i++) {
        const cols = [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x06b6d4, 0x3b82f6, 0x8b5cf6];
        spawnParticle(WORLD.W / 2 + (Math.random() - 0.5) * 12, 6 + Math.random() * 14, WORLD.D / 2 + (Math.random() - 0.5) * 12,
          cols[i % cols.length], (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, 2.5, 3);
      }
    }
  };

  R.setView = function (v) { R.view = v; };
  R.setHeld = function (v) { hand.visible = v; };

  return R;
}
