// src/render/index.js — 低多边形后室渲染（three.js，零外链）。
// 职责：墙/地板/天花板/桌/出口门/实体/体力药/荧光灯；后室美学本体（壁纸/地毯/灯管）保持程序化，
//       主体（追猎实体/出口门/躲藏桌）异步升级为 GLB 高精模型，程序化网格保留作 fallback；
//       贴图槽位尝试加载 assets/*，失败回退纯色（不白屏不报错）。相机跟随 sim.player（第一人称）。
import * as THREE from '../../lib/three.module.js';
import { createStage, addFog } from '../core/base3d.js';
import { WORLD, PLAYER } from '../../config/game.config.js';
import { RoomEnvironment } from '../../lib/RoomEnvironment.js';
import { loadModelData } from '../../lib/model-loader-data.js';
import entityGlbData from '../../lib/models/backrooms-entity.glb.js';
import exitDoorGlbData from '../../lib/models/exit-door.glb.js';
import officeTableGlbData from '../../lib/models/office-table.glb.js';

const C = WORLD.COLORS;
const WALL_T = 0.28; // 墙厚

// 恐怖氛围：PBR 环境反射压低（r160 无 scene.environmentIntensity，按材质设置）
function dimEnv(group, k = 0.25) {
  group.traverse((o) => { if (o.isMesh && o.material && o.material.envMapIntensity !== undefined) o.material.envMapIntensity = k; });
  return group;
}

// GLB 几何被 loader 缓存的所有 clone 共享：标记后迷宫重建时跳过 dispose，避免误删共享缓冲
function markShared(group) {
  group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.userData.shared = true; });
  return group;
}

function disposeGroup(g) {
  g.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
}

export function createRenderer(canvas) {
  const stage = createStage({ canvas, clearColor: C.shadow, fov: 75, near: 0.05, far: 220 });
  const { scene, camera, renderer } = stage;

  // PBR：ACES 色调映射 + 软阴影 + 低强度环境反射（恐怖氛围，反射仅作用于 GLB 的 Standard 材质）
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  { const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose(); }

  addFog(scene, C.shadow, 40, 180);

  // 灯光：偏黄荧光 + 跟随玩家的点光源 + 全局暖补光（保证墙体/通道边界可读）
  scene.add(new THREE.AmbientLight(0x4a4030, 0.7));
  scene.add(new THREE.HemisphereLight(C.fluorescent, 0x7a6840, 1.1));
  const MAZE_W = WORLD.GRID_W * WORLD.CELL, MAZE_H = WORLD.GRID_H * WORLD.CELL;
  const dir = new THREE.DirectionalLight(0xfff6d8, 0.85);
  dir.position.set(MAZE_W / 2 + 20, 40, MAZE_H / 2 + 10);
  dir.target.position.set(MAZE_W / 2, 0, MAZE_H / 2);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.left = -55; dir.shadow.camera.right = 55;
  dir.shadow.camera.top = 55; dir.shadow.camera.bottom = -55;
  dir.shadow.camera.near = 5; dir.shadow.camera.far = 130;
  dir.shadow.bias = -0.0003; dir.shadow.normalBias = 0.02;
  scene.add(dir, dir.target);
  const playerLight = new THREE.PointLight(0xfff2c0, 2.8, 40, 1.6);
  playerLight.position.set(0, PLAYER.eye, 0);
  scene.add(playerLight);

  // 共享材质（贴图槽位：加载成功则替换 map，失败回退纯色，不白屏不报错）
  const wallMat = new THREE.MeshLambertMaterial({ color: C.wallpaper }); // 壁纸无贴图回退
  const carpetMat = new THREE.MeshLambertMaterial({ color: C.carpet });
  const ceilingMat = new THREE.MeshLambertMaterial({ color: C.fluorescent });
  const tubeMat = new THREE.MeshBasicMaterial({ color: C.fluorescent });
  const tableMat = new THREE.MeshLambertMaterial({ color: C.table });
  const entityMat = new THREE.MeshLambertMaterial({ color: C.entity });
  const eyeMat = new THREE.MeshBasicMaterial({ color: C.entityEye });
  const doorMat = new THREE.MeshBasicMaterial({ color: C.door });
  const doorDimMat = new THREE.MeshBasicMaterial({ color: C.doorDim });
  const pickupMat = new THREE.MeshBasicMaterial({ color: C.pickup });

  // GLB 原型：每主体只解析一次（loader 内部缓存），各集成点 clone 复用，
  // 避免建表/建门时并发重复解析同一 GLB；clone 间几何共享（markShared 跳过 dispose）
  const tableProto = loadModelData(officeTableGlbData, { targetLen: 2, forward: '+z', key: 'office-table' });
  const doorProto = loadModelData(exitDoorGlbData, { targetLen: 2.6, forward: '+z', key: 'exit-door' });
  const entityProto = loadModelData(entityGlbData, { targetLen: 2.4, forward: '+z', key: 'backrooms-entity' });

  // 贴图：地板/天花板单材质固定 repeat；壁纸按墙长 repeat（格墙 8u、边界墙 72u 两种），
  //       贴图异步到达后 bump version 触发重建（复用缓存材质，不泄漏）。
  const texLoader = new THREE.TextureLoader();
  const texVersion = { wall: 0 };
  let wallTex = null;
  const wallMatCache = new Map(); // repeatX -> 材质

  function loadTex(url, onLoad) {
    try {
      texLoader.load(url, (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        onLoad(tex);
      }, undefined, () => { /* 回退纯色 */ });
    } catch { /* 回退纯色 */ }
  }
  loadTex('assets/tex/carpet.webp', (tex) => { tex.repeat.set(9, 9); carpetMat.map = tex; carpetMat.needsUpdate = true; });
  loadTex('assets/tex/ceiling.webp', (tex) => { tex.repeat.set(9, 9); ceilingMat.map = tex; ceilingMat.needsUpdate = true; });
  loadTex('assets/sky.jpg', (tex) => { wallTex = tex; texVersion.wall++; });

  function wallMaterial(len) {
    if (!wallTex) return wallMat;
    const rx = Math.max(1, Math.round(len / WORLD.CELL));
    let m = wallMatCache.get(rx);
    if (!m) {
      const t = wallTex.clone();
      t.repeat.set(rx, 1);
      t.needsUpdate = true;
      m = new THREE.MeshLambertMaterial({ color: C.wallpaper, map: t });
      wallMatCache.set(rx, m);
    }
    return m;
  }

  const mazeGroup = new THREE.Group();
  const exitGroup = new THREE.Group();
  const entityGroup = new THREE.Group();
  const pickupGroup = new THREE.Group();
  scene.add(mazeGroup, exitGroup, entityGroup, pickupGroup);

  let builtKey = '';
  let exitKey = '';
  let tubeMats = [];
  const pickups = [];

  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  function clearGroup(g) {
    while (g.children.length) {
      const c = g.children[0];
      g.remove(c);
      c.traverse?.((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
    }
  }

  function buildMaze(run) {
    const m = run.maze;
    const key = `${run.segment}:${m.walls.length}:${texVersion.wall}`;
    if (builtKey === key) return;
    builtKey = key;
    clearGroup(mazeGroup);
    exitKey = ''; // 迷宫重建（含标题→开局）时强制重建出口门，避免标题迷宫的门框残留
    tubeMats = [];

    const Wx = WORLD.GRID_W * WORLD.CELL;
    const Hz = WORLD.GRID_H * WORLD.CELL;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(Wx, Hz), carpetMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    mazeGroup.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(Wx, Hz), ceilingMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = WORLD.WALL_H;
    mazeGroup.add(ceil);

    for (const w of m.walls) {
      const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
      const cx = (w.x1 + w.x2) / 2, cz = (w.z1 + w.z2) / 2;
      const vertical = Math.abs(w.x1 - w.x2) < 1e-6;
      const b = vertical ? box(WALL_T, WORLD.WALL_H, len, wallMaterial(len)) : box(len, WORLD.WALL_H, WALL_T, wallMaterial(len));
      b.position.set(cx, WORLD.WALL_H / 2, cz);
      b.castShadow = true; b.receiveShadow = true;
      mazeGroup.add(b);
    }

    for (const t of m.tables) {
      // 躲藏桌：枢轴在 (t.x, 0, t.z)，坐标逻辑不动；GLB 到位后替换程序化 fallback
      const tableRoot = new THREE.Group();
      tableRoot.position.set(t.x, 0, t.z);
      const fallback = new THREE.Group();
      const top = box(2.6, 0.16, 1.5, tableMat);
      top.position.set(0, 0.82, 0);
      fallback.add(top);
      for (const [lx, lz] of [[-1.05, -0.55], [1.05, -0.55], [-1.05, 0.55], [1.05, 0.55]]) {
        const leg = box(0.14, 0.82, 0.14, tableMat);
        leg.position.set(lx, 0.41, lz);
        fallback.add(leg);
      }
      fallback.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      tableRoot.add(fallback);
      mazeGroup.add(tableRoot);
      tableProto.then((proto) => {
        if (tableRoot.parent !== mazeGroup) return; // 迷宫已重建，丢弃过期结果
        const model = proto.clone(true);
        dimEnv(model, 0.3); markShared(model);
        tableRoot.remove(fallback); disposeGroup(fallback);
        tableRoot.add(model);
      }).catch(() => {});
    }

    for (let j = 0; j < WORLD.GRID_H; j++) for (let i = 0; i < WORLD.GRID_W; i++) {
      const tube = box(3.6, 0.08, 0.5, tubeMat);
      tube.position.set((i + 0.5) * WORLD.CELL, WORLD.WALL_H - 0.05, (j + 0.5) * WORLD.CELL);
      mazeGroup.add(tube);
      tubeMats.push(tube.material);
    }
  }

  function buildExits(run) {
    // key 含出口坐标：标题迷宫与开局迷宫即使 segment/exitIndex 相同也不会串门框
    const key = `${run.segment}:${run.exitIndex}:${run.maze.exits.map((e) => `${e.x},${e.z}`).join(';')}`;
    if (exitKey === key) return;
    exitKey = key;
    clearGroup(exitGroup);
    for (const e of run.maze.exits) {
      const isActive = e === run.activeExit;
      const mat = isActive ? doorMat : doorDimMat;
      const frame = new THREE.Group();
      const fallback = new THREE.Group();
      // 四角门柱 + 顶框（从任意方向都读作“门框”，而不是单面纸片）
      for (const [px, pz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
        const post = box(0.16, 2.6, 0.16, mat); post.position.set(px, 1.3, pz); post.castShadow = true; fallback.add(post);
      }
      const top = box(1.56, 0.5, 1.56, mat); top.position.set(0, 2.75, 0); top.castShadow = true; fallback.add(top);
      // 中心发光门板：3D 体块，任何角度都可见（激活=亮绿，未激活=暗）
      const door = box(1.1, 2.4, 1.1, mat); door.position.set(0, 1.3, 0); door.castShadow = true; fallback.add(door);
      frame.add(fallback);
      if (isActive) {
        const light = new THREE.PointLight(C.door, 2.5, 14, 1.6);
        light.position.set(0, 2.4, 0);
        frame.add(light);
      }
      frame.position.set(e.x, 0, e.z);
      exitGroup.add(frame);
      // GLB 门框：单 mesh（门板与框一体），整体换用共享 doorMat/doorDimMat，
      // 激活/未激活切换语义与原程序化门完全一致；PointLight 挂在 frame 上不受替换影响
      doorProto.then((proto) => {
        if (frame.parent !== exitGroup) return; // 出口已重建，丢弃过期结果
        const model = proto.clone(true);
        model.traverse((o) => { if (o.isMesh) o.material = mat; });
        markShared(model);
        frame.remove(fallback); disposeGroup(fallback);
        frame.add(model);
      }).catch(() => {});
    }
  }

  let entityMesh = null;
  function syncDynamic(run) {
    if (!entityMesh) {
      const g = new THREE.Group();
      const fallback = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.1, 4, 8), entityMat);
      body.position.y = 1.1; body.castShadow = true;
      fallback.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), entityMat);
      head.position.y = 1.85; head.castShadow = true;
      fallback.add(head);
      // 发光双眼：GLB 无独立眼节点 → 保留原眼网格，GLB 到位后移到其头部表面。
      // eyeMat 引用不变，追逐变色示警（下方 setHex）照常生效。
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
      eyeL.position.set(-0.12, 1.88, -0.24);
      const eyeR = eyeL.clone(); eyeR.position.x = 0.12;
      g.add(fallback, eyeL, eyeR);
      entityMesh = g;
      entityGroup.add(g);
      entityProto.then((model) => {
        dimEnv(model, 0.2); markShared(model);
        // 眼部锚点：取头部区域（模型高 78%–95%）顶点的质心高度与前缘 z，
        // 在模型未入场景前计算（局部坐标），使发光眼贴合 GLB 脸部（模型面朝 -Z，与 sim yaw 一致）
        model.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(model);
        const H = bb.max.y;
        let mesh = null; model.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
        if (mesh && H > 0) {
          const pos = mesh.geometry.attributes.position;
          const v = new THREE.Vector3();
          let n = 0, sy = 0, minZ = Infinity;
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
            if (v.y > 0.78 * H && v.y < 0.95 * H) { n++; sy += v.y; if (v.z < minZ) minZ = v.z; }
          }
          if (n > 0 && Number.isFinite(minZ)) {
            const ey = sy / n, ez = minZ - 0.03;
            eyeL.position.set(-0.12, ey, ez);
            eyeR.position.set(0.12, ey, ez);
          }
        }
        g.remove(fallback); disposeGroup(fallback);
        g.add(model);
      }).catch(() => {});
    }
    entityMesh.position.set(run.entity.x, 0, run.entity.z);
    entityMesh.rotation.y = run.entity.yaw;
    eyeMat.color.setHex(run.entity.state === 'chase' ? 0xff5a3c : C.entityEye);

    // 体力药（池）
    const active = run.maze.pickups.filter((p) => p.active);
    while (pickups.length < active.length) {
      pickups.push(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.3), pickupMat));
      pickupGroup.add(pickups[pickups.length - 1]);
    }
    active.forEach((p, i) => {
      pickups[i].visible = true;
      pickups[i].position.set(p.x, 0.4, p.z);
      pickups[i].rotation.y += 0.03;
    });
    for (let i = active.length; i < pickups.length; i++) pickups[i].visible = false;
  }

  function applyFlicker(on) {
    for (const m of tubeMats) m.color.setHex(on ? 0xffffff : C.fluorescent);
  }

  let titleRun = null;
  function titleCam(time) {
    const Wx = WORLD.GRID_W * WORLD.CELL, Hz = WORLD.GRID_H * WORLD.CELL;
    const ang = time * 0.08;
    const r = Math.max(Wx, Hz) * 0.62;
    camera.position.set(Math.cos(ang) * r, r * 0.55, Math.sin(ang) * r);
    camera.lookAt(Wx / 2, 0, Hz / 2);
  }

  return {
    stage,
    render(run, dt, phase = 'playing') {
      if (phase === 'title') {
        if (!titleRun) {
          import('../game/sim.js').then((sim) => {
            titleRun = sim.createRun({ seed: 7 });
            buildMaze(titleRun);
            buildExits(titleRun);
            syncDynamic(titleRun);
          });
        }
        if (titleRun) {
          buildMaze(titleRun);
          syncDynamic(titleRun);
          titleCam(performance.now() / 1000);
        }
      } else if (run) {
        buildMaze(run);
        buildExits(run);
        syncDynamic(run);
        applyFlicker(run.fx.on);
        const eye = run.player.hidden ? 0.55 : PLAYER.eye;
        camera.position.set(run.player.x, eye, run.player.z);
        camera.rotation.set(0, 0, 0);
        camera.rotateY(run.player.yaw);
        camera.rotateX(run.player.pitch);
        playerLight.position.set(run.player.x, eye, run.player.z);
      }
      stage.render();
    },
    resize: () => stage.resize(),
    onEvent() { /* fx 走 sim 的 flicker 状态 */ },
  };
}
