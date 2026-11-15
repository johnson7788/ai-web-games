// src/render/index.js — 3D 渲染：程序化低多边形废弃医院 + 手电 + 应急灯 + 实体剪影。
// 依赖 lib/three.module.js（经 base3d 导出）；几何从 config 地图构建，门开合按 run 更新。
import { THREE, createStage, box, plane } from '../core/base3d.js';
import { WORLD, PLAYER, MAP } from '../../config/game.config.js';
import { buildMap } from '../game/map.js';
import { loadModelData } from '../../lib/model-loader-data.js';
import shadowEntityData from '../../lib/models/shadow-entity.glb.js';
import handFlashlightData from '../../lib/models/hand-flashlight.glb.js';
import generatorData from '../../lib/models/generator.glb.js';

// 恐怖氛围：PBR 环境反射压低（r160 无 scene.environmentIntensity，按材质设置）
function dimEnv(group, k = 0.25) {
  group.traverse((o) => { if (o.isMesh && o.material && o.material.envMapIntensity !== undefined) o.material.envMapIntensity = k; });
  return group;
}

const PAL = {
  wall: 0x2a3a34,
  wallDark: 0x1a2e2a,
  floor: 0x17221f,
  floor2: 0x1c2a26,
  door: 0x4a3527,
  exit: 0x7f1d1d,
  generator: 0x3a4a44,
  drawer: 0x4a5a52,
  corpse: 0x5a2a2a,
  cabinet: 0x33403b,
  battery: 0x2a6a3a,
  entity: 0x0a0d0b,
  silhouette: 0x050706,
};

export function createRenderer(canvas) {
  const stage = createStage({ canvas, clearColor: 0x050806, fov: 70, near: 0.06, far: 200 });
  const { scene, camera, renderer } = stage;
  scene.add(camera); // 相机入场景：手电聚光/光束/手中手电（相机子节点）才会被渲染
  scene.fog = new THREE.Fog(0x101a16, 16, 80);

  const map = buildMap();
  const cell = map.cell;

  // ---------------- 灯光 ----------------
  scene.add(new THREE.HemisphereLight(0x3a524a, 0x101614, 1.1));
  const amb = new THREE.AmbientLight(0x2a3a34, 2.4);
  scene.add(amb);

  // 手电（相机子节点，聚光）
  const spot = new THREE.SpotLight(0xfde68a, 60, FLASHLIGHT_RANGE(), 0.55, 0.5, 1.5);
  spot.position.set(0, 0, 0);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, 0, -1);
  spot.target = spotTarget;
  camera.add(spot);
  camera.add(spotTarget);
  // 主光（手电聚光）投影：软阴影已在全局开启，这里补光源侧参数
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = 0.1;
  spot.shadow.camera.far = FLASHLIGHT_RANGE();
  spot.shadow.bias = -0.0004;

  // 手电光束（玩家存在感：半透明锥体，跟随相机）
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(3, 16, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  );
  beam.rotation.x = Math.PI / 2;
  beam.position.set(0, 0, -8);
  beam.visible = false;
  camera.add(beam);

  // 手中手电（第一人称存在感：手 + 筒身 + 亮镜头，右下角，完整入画）
  const torch = new THREE.Group();
  const torchFallback = new THREE.Group();
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.42), new THREE.MeshBasicMaterial({ color: 0xe8c49a }));
  hand.position.set(0, -0.16, -0.05);
  hand.rotation.z = 0.15;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 10), new THREE.MeshBasicMaterial({ color: 0x3a3a3a }));
  grip.rotation.x = Math.PI / 2;
  grip.position.set(0.04, -0.02, -0.34);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.24, 12), new THREE.MeshBasicMaterial({ color: 0xbbbbbb }));
  head.rotation.x = Math.PI / 2;
  head.position.set(0.04, -0.02, -0.66);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12), new THREE.MeshBasicMaterial({ color: 0xfde68a, fog: false }));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0.04, -0.02, -0.8);
  torchFallback.add(hand, grip, head, lens);
  torch.add(torchFallback);
  torch.position.set(0.42, -0.14, -0.4);
  torch.rotation.y = -0.35;
  camera.add(torch);
  // GLB 升级：targetLen 取小值（≈0.5）放视野下方避免挡屏。
  // 关键：镜片材质指回原 lens.material —— render() 每帧经 lens.material 开关变色，引用必须存活。
  loadModelData(handFlashlightData, { targetLen: 0.5, forward: '-z', key: 'hand-flashlight' }).then((model) => {
    dimEnv(model, 0.3);
    let lensNode = null;
    model.traverse((o) => { if (o.isMesh && /lens|glass|bulb|lamp/i.test(o.name || '')) lensNode = o; });
    if (lensNode) {
      lensNode.material = lens.material; // 独立镜片节点：直接共享原镜片材质
      model.updateMatrixWorld(true);
      const lp = new THREE.Vector3();
      lensNode.getWorldPosition(lp);
      model.worldToLocal(lp);
      if (lp.z > 0) model.rotation.y += Math.PI; // 镜片须朝相机前方（-Z）
    } else {
      // 合并网格无独立镜片节点：按两端截面半径找灯头（半径大的一端），
      // 灯头朝前（-Z）后把程序化镜片贴到灯头端面，开关变色仍可见。
      let geo = null;
      model.traverse((o) => { if (!geo && o.isMesh && o.geometry?.attributes?.position) geo = o.geometry; });
      torchFallback.remove(lens);
      const bb = new THREE.Box3().setFromObject(model);
      const ctr = bb.getCenter(new THREE.Vector3());
      let headZ = bb.min.z, headR = 0.07;
      if (geo) {
        const p = geo.attributes.position;
        let zmin = Infinity, zmax = -Infinity;
        for (let i = 0; i < p.count; i++) { const z = p.getZ(i); if (z < zmin) zmin = z; if (z > zmax) zmax = z; }
        const band = (zmax - zmin) * 0.18;
        let rLo = 0, rHi = 0;
        for (let i = 0; i < p.count; i++) {
          const r = Math.hypot(p.getX(i), p.getY(i));
          const z = p.getZ(i);
          if (z <= zmin + band) rLo = Math.max(rLo, r);
          if (z >= zmax - band) rHi = Math.max(rHi, r);
        }
        if (rHi > rLo) model.rotation.y += Math.PI; // 灯头在 +Z（相机侧）→ 翻转朝前
        const s = (bb.max.z - bb.min.z) / Math.max(zmax - zmin, 1e-6);
        headZ = bb.min.z; // x/z 已居中，翻转后灯头必在 -Z 端
        headR = Math.max(rHi, rLo) * s;
      }
      lens.position.set(ctr.x, ctr.y, headZ + 0.005);
      lens.scale.setScalar(Math.max(0.3, headR / 0.14));
      torch.add(lens);
    }
    model.position.set(0, -0.08, -0.3);
    torch.remove(torchFallback);
    torch.add(model);
  }).catch(() => {});

  // 应急灯（绿光/红光微光）
  const emergencies = [];
  for (const [floor, pts] of Object.entries({ 1: [[4, 4], [33, 15], [25, 35]], 2: [[7, 3], [19, 15]] })) {
    for (const [gx, gz] of pts) {
      const c = (gx + gz) % 3 === 0 ? 0x7f1d1d : 0x1a5a3a;
      const l = new THREE.PointLight(c, 4.5, 20, 1.5);
      l.position.set(gx, map.grids[floor].y + 2.5, gz);
      scene.add(l);
      emergencies.push({ light: l, base: 4.5 });
    }
  }

  // ---------------- 天空（程序化渐变穹顶；sky.jpg 生成像蛛网，回退程序化） ----------------
  scene.background = new THREE.Color(0x0c1512);
  const skyDome = makeGradientSky();
  scene.add(skyDome);

  // ---------------- 贴图（只换美术件，几何/判定不动） ----------------
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function loadTex(url, rx, ry) {
    const t = loader.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    if (rx) t.repeat.set(rx, ry ?? rx);
    return t;
  }
  const wallTex = loadTex('assets/tex/tile.webp', 2, 3);      // 墙块 2m×3m → 每米重复一次
  const floorTex = loadTex('assets/tex/floor.webp', 1, 1);    // 每层按尺寸 clone 设 repeat
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: wallTex });

  // ---------------- 静态几何 ----------------
  const wallGroups = {};
  const floorPlanes = [];
  const doorMeshes = [];
  const propMeshes = { searchables: [], cabinets: [], batteries: [], generator: null, exit: null };

  for (const [fk, g] of Object.entries(map.grids)) {
    const floor = +fk;
    const wallGroup = new THREE.Group();
    const y = g.y;
    // 地板（也是下一层天花板）
    const ft = floorTex.clone();
    ft.repeat.set(g.w * cell, g.h * cell);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(g.w * cell, g.h * cell), new THREE.MeshLambertMaterial({ color: 0xffffff, map: ft }));
    fl.rotation.x = -Math.PI / 2;
    fl.position.set(g.w * cell / 2, y, g.h * cell / 2);
    fl.receiveShadow = true; // 承接手电/实体软阴影
    scene.add(fl);
    floorPlanes.push(fl);

    for (let z = 0; z < g.h; z += 1) {
      for (let x = 0; x < g.w; x += 1) {
        const c = g.cells[z][x];
        if (c === '#') {
          const m = new THREE.Mesh(new THREE.BoxGeometry(cell, WORLD.WALL_H, cell), wallMat);
          m.position.set((x + 0.5) * cell, y + WORLD.WALL_H / 2, (z + 0.5) * cell);
          m.receiveShadow = true;
          wallGroup.add(m);
        } else if (c === 'g') {
          const m = box(cell * 0.9, 1.4, cell * 0.9, PAL.generator);
          m.position.set((x + 0.5) * cell, y + 0.7, (z + 0.5) * cell);
          wallGroup.add(m);
          propMeshes.generator = { floor, x: (x + 0.5) * cell, z: (z + 0.5) * cell };
          // GLB 升级：发电机（坐标/修理判定不动；propMeshes.generator 只存坐标，无网格引用）
          loadModelData(generatorData, { targetLen: 2, forward: '+z', key: 'generator' }).then((model) => {
            dimEnv(model, 0.3);
            model.position.set((x + 0.5) * cell, y, (z + 0.5) * cell); // GLB 底部落地 y=0
            wallGroup.remove(m);
            wallGroup.add(model);
          }).catch(() => {});
        } else if (c === 'X') {
          const m = box(cell, WORLD.WALL_H, 0.4, PAL.exit);
          m.position.set((x + 0.5) * cell, y + WORLD.WALL_H / 2, (z + 0.5) * cell);
          wallGroup.add(m);
          propMeshes.exit = { floor, x: (x + 0.5) * cell, z: (z + 0.5) * cell };
        } else if (c === '^') {
          const m = box(cell, 0.3, cell, PAL.wallDark);
          m.position.set((x + 0.5) * cell, y + 0.15, (z + 0.5) * cell);
          wallGroup.add(m);
        }
      }
    }
    scene.add(wallGroup);
    wallGroups[floor] = wallGroup;
  }

  // 门（薄片，开=隐）
  for (const d of map.doors) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(cell * 0.95, WORLD.WALL_H, 0.25), new THREE.MeshLambertMaterial({ color: PAL.door }));
    const cx = d.cells.reduce((s, c) => s + c.x, 0) / d.cells.length;
    const cz = d.cells.reduce((s, c) => s + c.z, 0) / d.cells.length;
    const y = map.grids[d.floor].y;
    mesh.position.set((cx + 0.5) * cell, y + WORLD.WALL_H / 2, (cz + 0.5) * cell);
    if (d.dir === 'v') mesh.scale.set(1, 1, cell);
    scene.add(mesh);
    doorMeshes.push({ id: d.id, floor: d.floor, mesh });
  }

  // 可搜索点/柜/电池
  for (const s of map.searchables) {
    const geo = s.kind === 'corpse' ? new THREE.BoxGeometry(cell * 0.8, 0.3, cell * 1.4) : new THREE.BoxGeometry(cell * 0.7, 0.8, cell * 0.7);
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: s.kind === 'corpse' ? PAL.corpse : PAL.drawer }));
    const y = map.grids[s.floor].y;
    m.position.set(s.x, y + (s.kind === 'corpse' ? 0.15 : 0.4), s.z);
    scene.add(m);
    propMeshes.searchables.push({ floor: s.floor, mesh: m, ref: s });
  }
  for (const c of map.cabinets) {
    const m = box(cell * 0.8, WORLD.WALL_H * 0.9, cell * 0.8, PAL.cabinet);
    const y = map.grids[c.floor].y;
    m.position.set(c.x, y + WORLD.WALL_H * 0.45, c.z);
    scene.add(m);
    propMeshes.cabinets.push({ floor: c.floor, mesh: m });
  }
  for (const b of map.batteries) {
    const m = box(0.5, 0.5, 0.5, PAL.battery);
    const y = map.grids[b.floor].y;
    m.position.set(b.x, y + 0.25, b.z);
    scene.add(m);
    propMeshes.batteries.push({ floor: b.floor, mesh: m, ref: b });
  }

  // 实体 + 剪影（枢轴 Group：setEntityPose 只改 position/rotation.y，驱动逻辑零改动）
  const entityMat = new THREE.MeshLambertMaterial({ color: PAL.entity });
  const entity = new THREE.Group();
  const entityFallback = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.6, 10), entityMat);
  entity.add(entityFallback);
  entity.position.y = 1.3;
  scene.add(entity);
  const silMat = new THREE.MeshBasicMaterial({ color: PAL.silhouette });
  const silhouette = new THREE.Group();
  const silFallback = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 3.4, 8), silMat);
  silhouette.add(silFallback);
  silhouette.position.y = 1.7;
  silhouette.visible = false;
  scene.add(silhouette);
  // GLB 升级：追逐怪物 targetLen≈2.6，forward '+z'（rotation.y=atan2(dx,dz) 面向玩家）。
  // GLB 归一化后底部落地 y=0，枢轴在 y+1.3 → 模型本地 offset -1.3 使脚落地。
  loadModelData(shadowEntityData, { targetLen: 2.6, forward: '+z', key: 'shadow-entity' }).then((model) => {
    dimEnv(model, 0.2); // 恐怖氛围：环境反射压低
    model.position.y = -1.3;
    entity.remove(entityFallback);
    entity.add(model);
  }).catch(() => {});
  // 剪影：同模型纯黑材质（不受光照），targetLen 3.4 对齐原剪影高度
  loadModelData(shadowEntityData, { targetLen: 3.4, forward: '+z', key: 'shadow-entity-sil' }).then((model) => {
    model.traverse((o) => { if (o.isMesh) o.material = silMat; });
    model.position.y = -1.7;
    silhouette.remove(silFallback);
    silhouette.add(model);
  }).catch(() => {});

  let pitch = 0;

  function setEntityPose(mesh, run, isSil) {
    const y = map.grids[run.entity.floor].y;
    if (isSil) {
      mesh.position.set(run.silhouette.x, y + 1.7, run.silhouette.z);
    } else {
      mesh.position.set(run.entity.x, y + 1.3, run.entity.z);
      const p = run.player;
      const dx = p.x - run.entity.x, dz = p.z - run.entity.z;
      mesh.rotation.y = Math.atan2(dx, dz);
    }
  }

  function render(run, dt) {
    if (!run) {
      camera.position.set(18, 4, 56);
      camera.lookAt(18, 3, 10);
      spot.visible = false;
      beam.visible = false;
      torch.visible = false;
      amb.intensity = 1.2;
      for (const e of emergencies) e.light.intensity = e.base * 0.6;
      renderer.render(scene, camera);
      return;
    }
    spot.visible = true;
    const p = run.player;
    const y = map.grids[p.floor].y;

    // 相机
    camera.position.set(p.x, y + WORLD.EYE, p.z);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(p.yaw);
    camera.rotateX(pitch);

    // 只显示当前层墙体/道具
    for (const [f, grp] of Object.entries(wallGroups)) grp.visible = +f === p.floor;

    // 门开合
    for (const d of doorMeshes) {
      const door = run.map.doorById[d.id];
      d.mesh.visible = d.floor === p.floor && door && !door.open;
    }
    // 电池
    for (const b of propMeshes.batteries) b.mesh.visible = b.floor === p.floor && !b.ref.taken;
    for (const s of propMeshes.searchables) s.mesh.visible = s.floor === p.floor;
    for (const c of propMeshes.cabinets) c.mesh.visible = c.floor === p.floor;

    // 手电：开关 + 电量闪烁 + 签名闪烁
    let on = p.flashlight;
    beam.visible = on;
    torch.visible = true;
    lens.material.color.setHex(on ? 0xfde68a : 0x2a2412);
    let intensity = 0;
    if (on) {
      intensity = 55 + Math.sin(run.time * 40) * 3;
      if (run.flickerT > 0 && Math.sin(run.time * 90) > 0.2) intensity = 6;
    }
    spot.intensity = intensity;
    // 电量低时手电昏暗
    if (on && p.battery < 25) intensity *= 0.7;
    spot.intensity = intensity;

    // 发电机亮灯：全楼增亮
    for (const e of emergencies) e.light.intensity = run.generator.lightsT > 0 ? e.base * 2 : e.base;
    amb.intensity = run.generator.lightsT > 0 ? 3.2 : 2.4;

    // 实体 + 剪影
    setEntityPose(entity, run, false);
    entity.visible = run.entity.floor === p.floor;
    silhouette.visible = run.silhouetteT > 0;
    if (silhouette.visible) setEntityPose(silhouette, run, true);

    renderer.render(scene, camera);
  }

  return {
    render,
    setPitch(v) { pitch = v; },
    get camera() { return camera; },
    get scene() { return scene; },
    resize: stage.resize,
  };
}

function FLASHLIGHT_RANGE() { return 18; }

// 程序化渐变天穹（sky.jpg 加载前的兜底；垂直渐变 + BackSide，不受雾影响）
function makeGradientSky() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#0a1412');   // 顶：深黑绿
  grad.addColorStop(0.5, '#24402f');   // 中：暗青
  grad.addColorStop(1.0, '#5a8068');   // 地平线：病绿微光（更亮，衬出建筑剪影）
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 12), mat);
  dome.renderOrder = -10;
  return dome;
}
