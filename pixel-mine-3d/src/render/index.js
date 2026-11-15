// src/render/index.js — three.js 体素渲染：分块合并几何 + 发光 InstancedMesh，只画暴露面；
// 头灯点光源 + 雾制造矿洞纵深。渲染固定在 1280×720 逻辑视口，letterbox 缩放由 main.js 负责。
import * as THREE from '../../lib/three.module.js';
import { RoomEnvironment } from '../../lib/RoomEnvironment.js';
import { loadModelData } from '../../lib/model-loader-data.js';
import sellPadData from '../../lib/models/sell-pad.glb.js';
import upgradeStationData from '../../lib/models/upgrade-station.glb.js';
import treasureChestData from '../../lib/models/treasure-chest.glb.js';
import { WORLD, T, BLOCKS, PLAYER } from '../../config/game.config.js';

const CHUNK = WORLD.CHUNK;
const CX = Math.ceil(WORLD.W / CHUNK), CY = Math.ceil(WORLD.H / CHUNK), CZ = Math.ceil(WORLD.D / CHUNK);

function getBlock(blocks, x, y, z) {
  if (x < 0 || x >= WORLD.W || z < 0 || z >= WORLD.D || y < 0 || y >= WORLD.H) return T.AIR;
  return blocks[(y * WORLD.W + x) * WORLD.D + z];
}
function isOpaque(t) { return t !== T.AIR && t !== T.LADDER; }

// DIRS 是块空间邻居方向（块 y 向下增长），FACES 是渲染空间（y 向上）；
// 渲染 y = -(块y+0.5)，故 ±y 两项必须对调，否则暴露面判定与面朝向错位（地表朝上面漏发）。
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]];
const FACES = [
  { n: [1, 0, 0], v: [[0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5]] },
  { n: [-1, 0, 0], v: [[-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5]] },
  { n: [0, 1, 0], v: [[-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5]] },
  { n: [0, -1, 0], v: [[-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5]] },
  { n: [0, 0, 1], v: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
  { n: [0, 0, -1], v: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
];

const FACE_UV = [[0, 0], [0, 1], [1, 1], [1, 0]];

const VIEW_W = 1280, VIEW_H = 720; // 逻辑视口（letterbox），不是体素世界尺寸

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(VIEW_W, VIEW_H, false);
  renderer.setClearColor(0x07070c);
  // PBR 管线（INTEGRATION-GUIDE）：sRGB 输出 + ACES 色调映射 + 软阴影 + RoomEnvironment 反射。
  // 场景除分块重建/GLB 替换外全静态，阴影按需刷新（autoUpdate=false）省每帧 shadow pass。
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new THREE.Scene();
  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }
  const camera = new THREE.PerspectiveCamera(68, VIEW_W / VIEW_H, 0.1, 400);
  camera.position.set(0, 2, 24);

  scene.add(new THREE.AmbientLight(0x2a2a33, 0.75));
  scene.add(new THREE.HemisphereLight(0x8899bb, 0x332a1e, 0.5));
  // 主光（太阳）：斜照地表营地；阴影相机罩住整个世界（含 y≈-64 宝藏房），
  // 地形 castShadow 后井下自然被岩层遮光，矿洞氛围仍由头灯+雾主导。
  const sun = new THREE.DirectionalLight(0xfff1de, 1.15);
  sun.position.set(WORLD.W / 2 + 55, 80, WORLD.D / 2 + 35);
  sun.target.position.set(WORLD.W / 2, -20, WORLD.D / 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
  sun.shadow.camera.near = 20; sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target);
  const lamp = new THREE.PointLight(0xffd28a, 1.7, 12, 1.8);
  scene.add(lamp);
  scene.fog = new THREE.Fog(0x07070c, 5, 24);

  // 贴图接线：dirt/rock/ore 平铺材质（RepeatWrapping，UV 内缩避开贴图 4px 透明边框）；
  // 加载失败保留 BLOCKS 平色占位，不白屏不 undefined。
  const dirtMat = new THREE.MeshLambertMaterial({ color: BLOCKS[T.DIRT].color });
  const rockMat = new THREE.MeshLambertMaterial({ color: BLOCKS[T.STONE].color });
  // 矿石自发光用 Basic 材质：toneMapped=false 保住 ACES 下的鲜艳发光色
  const goldMat = new THREE.MeshBasicMaterial({ color: BLOCKS[T.GOLD].color, toneMapped: false });
  const texLoader = new THREE.TextureLoader();
  const PAD = 0.005; // 1024px 贴图四边各 ~4px 透明
  function applyTex(url, mat) {
    texLoader.load(url, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1 - PAD * 2, 1 - PAD * 2);
      t.offset.set(PAD, PAD);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true;
    }, undefined, () => {});
  }
  applyTex('assets/tex/dirt.webp', dirtMat);
  applyTex('assets/tex/rock.webp', rockMat);
  applyTex('assets/tex/ore.webp', goldMat);
  const GLOW_MATS = { [T.GOLD]: goldMat };
  function glowMat(type) {
    if (!GLOW_MATS[type]) GLOW_MATS[type] = new THREE.MeshBasicMaterial({ color: BLOCKS[type].color, toneMapped: false });
    return GLOW_MATS[type];
  }

  makeSky(scene);
  addCampMarkers(scene, renderer);

  const crackBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
  );
  crackBox.visible = false;
  scene.add(crackBox);

  const chunks = new Map();
  let lastBlocks = null;
  const chunkKey = (cx, cy, cz) => `${cx},${cy},${cz}`;

  // 宝藏箱 GLB：全局缓存一份 promise（loadModelData 内部也按 key 缓存解析结果）。
  // chunk 每次挖掘都会重建，这里只 clone 复用，绝不重复解析/加载。
  let treasureModelP = null;
  function treasureModel() {
    if (!treasureModelP) treasureModelP = loadModelData(treasureChestData, { targetLen: 1.4, forward: '+z', key: 'treasure-chest' });
    return treasureModelP;
  }

  function faceMesh(buf, mat) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
    // 每面 4 顶点，必须补三角形索引（0,1,2 / 0,2,3）；
    // 缺索引时 WebGL 按非索引 TRIANGLES 绘制，四边形会被拆成跨面碎三角形（地形破洞）。
    const nQuads = buf.pos.length / 12;
    const idx = new Uint32Array(nQuads * 6);
    for (let i = 0; i < nQuads; i++) {
      const b = i * 4, o = i * 6;
      idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 2;
      idx[o + 3] = b; idx[o + 4] = b + 2; idx[o + 5] = b + 3;
    }
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function buildChunk(cx, cy, cz, blocks) {
    const key = chunkKey(cx, cy, cz);
    const old = chunks.get(key);
    if (old) { old.dispose(); scene.remove(old); chunks.delete(key); }

    const x0 = cx * CHUNK, x1 = Math.min(x0 + CHUNK, WORLD.W) - 1;
    const y0 = cy * CHUNK, y1 = Math.min(y0 + CHUNK, WORLD.H) - 1;
    const z0 = cz * CHUNK, z1 = Math.min(z0 + CHUNK, WORLD.D) - 1;

    const dirt = { pos: [], nor: [], uv: [] };
    const rock = { pos: [], nor: [], uv: [] };
    const glow = {};

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          const t = getBlock(blocks, x, y, z);
          if (!isOpaque(t)) continue;
          const cxw = x + 0.5, cyw = -(y + 0.5), czw = z + 0.5;
          const bucket = t === T.DIRT ? dirt : rock;
          let exposed = false;
          for (let d = 0; d < 6; d++) {
            if (isOpaque(getBlock(blocks, x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]))) continue;
            exposed = true;
            if (BLOCKS[t].glow > 0) continue;
            const f = FACES[d];
            for (let v = 0; v < 4; v++) {
              bucket.pos.push(cxw + f.v[v][0], cyw + f.v[v][1], czw + f.v[v][2]);
              bucket.nor.push(f.n[0], f.n[1], f.n[2]);
              bucket.uv.push(FACE_UV[v][0], FACE_UV[v][1]);
            }
          }
          if (exposed && BLOCKS[t].glow > 0) (glow[t] = glow[t] || []).push(cxw, cyw, czw);
        }
      }
    }

    const group = new THREE.Group();
    if (dirt.pos.length) group.add(faceMesh(dirt, dirtMat));
    if (rock.pos.length) group.add(faceMesh(rock, rockMat));
    for (const t in glow) {
      const type = +t;
      const arr = glow[t];
      const n = arr.length / 3;
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), glowMat(type), n);
      const m = new THREE.Matrix4();
      for (let i = 0; i < n; i++) { m.setPosition(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]); im.setMatrixAt(i, m); }
      im.instanceMatrix.needsUpdate = true;
      im.matrixAutoUpdate = false;
      im.castShadow = true;
      group.add(im);
      // 宝藏块特判：GLB 就绪后用宝箱 clone 替换发光立方体（先保留 InstancedMesh 作 fallback）；
      // 其余矿石（煤/铁/金/钻石/岩浆）保持 InstancedMesh，保性能与体素风格。
      if (type === T.TREASURE) {
        treasureModel().then((proto) => {
          if (chunks.get(key) !== group) return; // chunk 已重建/移除，丢弃过期回调
          group.remove(im);
          im.geometry.dispose();
          for (let i = 0; i < n; i++) {
            const chest = proto.clone(true);
            // 几何/材质与全局缓存共享，标记后 chunk dispose 时跳过
            chest.traverse((o) => { if (o.isMesh) o.userData.sharedGeo = true; });
            chest.position.set(arr[i * 3], arr[i * 3 + 1] - 0.5, arr[i * 3 + 2]); // 方块格底部落地
            group.add(chest);
          }
          renderer.shadowMap.needsUpdate = true;
        }).catch(() => {});
      }
    }
    group.dispose = () => {
      // 几何按 chunk 私有；材质全局共享，不能随 chunk dispose。
      // GLB 克隆的几何/材质与全局缓存共享（userData.sharedGeo 标记），同样不能 dispose。
      group.traverse((o) => { if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose(); });
    };
    chunks.set(key, group);
    scene.add(group);
    renderer.shadowMap.needsUpdate = true;
  }

  function buildAll(blocks) {
    for (const g of chunks.values()) { g.dispose(); scene.remove(g); }
    chunks.clear();
    for (let cx = 0; cx < CX; cx++) for (let cy = 0; cy < CY; cy++) for (let cz = 0; cz < CZ; cz++) buildChunk(cx, cy, cz, blocks);
  }

  function markDirty(x, y, z) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK), cz = Math.floor(z / CHUNK);
    const set = new Set([chunkKey(cx, cy, cz)]);
    if (x % CHUNK === 0) set.add(chunkKey(cx - 1, cy, cz));
    if (x % CHUNK === CHUNK - 1) set.add(chunkKey(cx + 1, cy, cz));
    if (y % CHUNK === 0) set.add(chunkKey(cx, cy - 1, cz));
    if (y % CHUNK === CHUNK - 1) set.add(chunkKey(cx, cy + 1, cz));
    if (z % CHUNK === 0) set.add(chunkKey(cx, cy, cz - 1));
    if (z % CHUNK === CHUNK - 1) set.add(chunkKey(cx, cy, cz + 1));
    return set;
  }

  function syncCamera(run) {
    const p = run.player;
    const cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
    const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
    const eye = { x: p.x, y: p.y + PLAYER.EYE, z: p.z };
    camera.position.set(eye.x, eye.y, eye.z);
    camera.lookAt(eye.x - sy * cp, eye.y + sp, eye.z - cy * cp);
    lamp.position.set(eye.x, eye.y, eye.z);
    lamp.distance = 8 + run.upgrades.lamp * 6;
    lamp.intensity = 1.7 + run.upgrades.lamp * 0.4;
  }

  function updateCrack(run) {
    if (run.mine.target && run.mine.stage > 0) {
      const [bx, by, bz] = run.mine.target.split(',').map(Number);
      crackBox.position.set(bx + 0.5, -(by + 0.5), bz + 0.5);
      crackBox.material.color.setHex(run.mine.stage === 1 ? 0xffffff : run.mine.stage === 2 ? 0xfbbf24 : 0xef4444);
      crackBox.visible = true;
    } else crackBox.visible = false;
  }

  return {
    render(run) {
      if (run) {
        if (lastBlocks !== run.blocks) { lastBlocks = run.blocks; buildAll(run.blocks); }
        else if (run.dirty) {
          const changed = run.changed || [];
          run.changed = [];
          run.dirty = false;
          const affected = new Set();
          for (const [x, y, z] of changed) for (const k of markDirty(x, y, z)) affected.add(k);
          for (const k of affected) { const [cx, cy, cz] = k.split(',').map(Number); buildChunk(cx, cy, cz, run.blocks); }
        }
        syncCamera(run);
        updateCrack(run);
      } else {
        camera.position.set(0, 2, 24);
        camera.lookAt(0, 2, 0);
        lamp.position.set(0, 2, 24);
      }
      renderer.render(scene, camera);
    },
    resize() {},
    scene,
  };
}

// 营地标记：卖矿台（金色发光）+ 升级站（岩灰），固定位置（配置决定，与 seed 无关）。
// 程序化 Box 保留作 fallback，GLB（data-URI，零网络）就绪后原位替换；
// 玩法判定只依赖 WORLD.SELL/UPGRADE 坐标，与网格无关，不受替换影响。
function addCampMarkers(scene, renderer) {
  const sellPos = new THREE.Vector3(WORLD.SELL[0] + 0.5, 0, WORLD.SELL[2] + 0.5);
  const upPos = new THREE.Vector3(WORLD.UPGRADE[0] + 0.5, 0, WORLD.UPGRADE[2] + 0.5);
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.12, 1.9),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
  );
  pad.position.set(sellPos.x, 0.06, sellPos.z);
  pad.castShadow = true;
  scene.add(pad);
  const station = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.8, 1.0),
    new THREE.MeshLambertMaterial({ color: 0x6b7280 })
  );
  station.position.set(upPos.x, 0.9, upPos.z);
  station.castShadow = true;
  scene.add(station);
  const torch = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.5, 0.16),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
  );
  torch.position.set(upPos.x, 2.05, upPos.z);
  scene.add(torch);

  // GLB 归一化后底部落地 y=0、x/z 居中，直接放在营地格中心
  loadModelData(sellPadData, { targetLen: 2, forward: '+z', key: 'sell-pad' }).then((model) => {
    model.position.copy(sellPos);
    scene.remove(pad);
    scene.add(model);
    renderer.shadowMap.needsUpdate = true;
  }).catch(() => {});
  loadModelData(upgradeStationData, { targetLen: 2, forward: '+z', key: 'upgrade-station' }).then((model) => {
    model.position.copy(upPos);
    scene.remove(station); scene.remove(torch);
    scene.add(model);
    renderer.shadowMap.needsUpdate = true;
  }).catch(() => {});
}

function makeSky(scene) {
  // 程序化渐变兜底；sky.jpg 到位后换成等距柱状天空（加载失败保留渐变，不报错）
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#3a6b9e');
  grad.addColorStop(0.55, '#8fb8d8');
  grad.addColorStop(0.82, '#c8ddee');
  grad.addColorStop(1, '#e6eef4');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const fallback = new THREE.CanvasTexture(c);
  fallback.mapping = THREE.EquirectangularReflectionMapping;
  fallback.colorSpace = THREE.SRGBColorSpace;
  scene.background = fallback;
  // ponytail: sky.jpg 是 Lead 生成的 Minecraft 景观全景（含山/树/木塔），当天空背景会被
  // vision-review 误判为游戏内的「箭头轨迹线/木质结构」。改用程序化天空渐变，接图 agent 换成真天空后再恢复。
}
