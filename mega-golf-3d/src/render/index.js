// src/render/index.js — three.js 低多边形迷你高尔夫渲染。
// 职责：果岭/球/洞/旗/机关/风车/弹板/移动门/沙坑/水障/瞄准线/预测线/坡度箭头/相机。
// 只读 run 快照，不写逻辑；事件表现由 main 派发（震屏/粒子在此可选）。
import { THREE, createStage, addLights, lambert, box, sphere, cylinder, plane, addFog } from '../core/base3d.js';
import { GOLF, CAMERA, PALETTE } from '../../config/game.config.js';
import { predict } from '../game/sim.js';
import { loadModelData } from '../../lib/model-loader-data.js';
import windmillData from '../../lib/models/windmill.glb.js';
import golfTreeData from '../../lib/models/golf-tree.glb.js';
import holeFlagData from '../../lib/models/hole-flag.glb.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createRenderer(canvas) {
  const stage = createStage({ canvas, clearColor: PALETTE.sky, fov: CAMERA.FOV, near: 0.5, far: 300 });
  const { renderer, scene, camera } = stage;
  addLights(scene, { sky: 0xbfe6ff, ground: 0x2c5a2c, sun: 0xffffff, intensity: 1.25, sunPos: [40, 60, 30] });
  addFog(scene, PALETTE.sky, 70, 190);

  // 天空：程序化渐变兜底；AI 全景 sky.jpg 加载成功则替换为 equirect 背景
  scene.background = new THREE.CanvasTexture(makeSkyCanvas());
  new THREE.TextureLoader().load('assets/sky.jpg', (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
  });

  // 贴图接线：加载成功换 map（失败保持兜底色，不白屏）；RepeatWrapping 按几何尺寸平铺
  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  function applyMap(mat, url, rx, ry) {
    new THREE.TextureLoader().load(url, (t) => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
      mat.map = t;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    });
  }

  // ---------------------------------------------------------------- 静态：果岭 + 网格 + 装饰
  const green = plane(GOLF.GREEN_W, GOLF.GREEN_D, PALETTE.green);
  green.position.set(GOLF.GREEN_W / 2, 0, GOLF.GREEN_D / 2);
  scene.add(green);
  applyMap(green.material, 'assets/tex/green.webp', GOLF.GREEN_W / 6, GOLF.GREEN_D / 6);

  // 果岭轮廓线（read 动词：坡度用箭头，网格线给空间感）
  addGridLines(scene);

  // 周边低多边形装饰树/灌木
  addScenery(scene);

  // 边缘挡墙（视觉）
  addWalls(scene);

  // ---------------------------------------------------------------- 动态组
  const dyn = new THREE.Group();
  scene.add(dyn);

  // 球
  const ballMesh = sphere(GOLF.BALL_R, PALETTE.ball, 20);
  ballMesh.position.y = GOLF.BALL_R;
  dyn.add(ballMesh);

  // 洞（暗圆盘）+ 旗
  const holeMesh = cylinder(GOLF.HOLE_R + 0.06, GOLF.HOLE_R + 0.06, 0.06, PALETTE.hole, 24);
  holeMesh.position.y = 0.02;
  dyn.add(holeMesh);
  const flagGroup = new THREE.Group();
  dyn.add(flagGroup);
  // 程序化旗标兜底（GLB 到位后替换）；flagCloth 是保留的弹跳/摆动驱动节点
  const flagFallback = new THREE.Group();
  const flagPole = cylinder(0.05, 0.05, 2.2, 0xffffff, 8);
  flagPole.position.y = 1.1;
  flagFallback.add(flagPole);
  flagGroup.add(flagFallback);
  const flagCloth = new THREE.Group();
  flagCloth.position.set(0.35, 1.9, 0);
  const clothBox = box(0.7, 0.45, 0.05, PALETTE.flag);
  flagCloth.add(clothBox);
  flagGroup.add(flagCloth);
  let clothRestY = 1.9;
  loadModelData(holeFlagData, { targetLen: 1.6, forward: '+z', key: 'hole-flag' }).then((model) => {
    const mesh = firstMesh(model);
    // 拆分：旗面（红布，x>0.1 且 y>0.85）挂到 flagCloth 枢轴，旗杆/底座静态
    const { a: cloth, b: pole } = splitMeshByCentroid(mesh.geometry, mesh.material, mesh.matrixWorld, (c) => c.x > 0.1 && c.y > 0.85);
    const cb = new THREE.Box3().setFromObject(cloth);
    const pivot = new THREE.Vector3(cb.min.x, cb.max.y, (cb.min.z + cb.max.z) / 2);
    cloth.geometry.translate(-pivot.x, -pivot.y, -pivot.z);
    flagGroup.remove(flagFallback);
    flagGroup.add(pole);
    flagCloth.remove(clothBox);
    flagCloth.add(cloth);
    flagCloth.position.copy(pivot);
    clothRestY = pivot.y;
  }).catch(() => {});

  // 球 tee 标记
  const teeMesh = cylinder(0.4, 0.4, 0.06, 0xffffff, 16);
  teeMesh.position.y = 0.02;
  dyn.add(teeMesh);

  // 每洞机关组（切换洞时重建）
  const mechGroup = new THREE.Group();
  scene.add(mechGroup);
  let builtHole = -1;
  const windmillMesh = new THREE.Group();
  const gateMesh = box(1, 2, 1, PALETTE.gate);

  // 坡度箭头组
  const slopeGroup = new THREE.Group();
  scene.add(slopeGroup);

  // 瞄准线
  const aimGroup = new THREE.Group();
  scene.add(aimGroup);
  const aimLine = buildAimLine();
  aimGroup.add(aimLine.line);
  aimGroup.add(aimLine.head);
  const predDots = [];
  for (let i = 0; i < 40; i += 1) {
    const d = sphere(0.08, 0xffffff, 6);
    d.visible = false;
    aimGroup.add(d);
    predDots.push(d);
  }

  // 相机状态
  let yaw = 0;
  let dist = CAMERA.DIST;
  let height = CAMERA.HEIGHT;
  let camTarget = new THREE.Vector3(GOLF.GREEN_W / 2, 0, GOLF.GREEN_D / 2);

  function buildHole(run) {
    const h = run.hole;
    // 清空机关
    while (mechGroup.children.length) mechGroup.remove(mechGroup.children[0]);

    // 风车：固定座（塔）+ rotor（旋转叶片枢轴，保留每帧 rotation.y 驱动）
    if (h.windmill) {
      const w = h.windmill;
      const g = new THREE.Group();
      g.position.set(w.x, 0, w.z);
      const rotor = new THREE.Group();
      g.add(rotor);
      // 程序化兜底：固定座 hub + rotor 内四叶
      const hubFb = cylinder(0.3, 0.3, 1.6, PALETTE.windmill, 10);
      hubFb.position.y = 0.8;
      g.add(hubFb);
      const bladesFb = new THREE.Group();
      for (let i = 0; i < 4; i += 1) {
        const blade = box(w.r * 0.85, 0.14, 0.5, PALETTE.windmill);
        blade.position.x = Math.cos((i / 4) * TAU) * w.r * 0.5;
        blade.position.z = Math.sin((i / 4) * TAU) * w.r * 0.5;
        blade.rotation.y = -(i / 4) * TAU;
        blade.position.y = 0.8;
        bladesFb.add(blade);
      }
      rotor.add(bladesFb);
      windmillMesh.position.copy(g.position);
      // 存引用用于旋转（rotor 即旋转叶片节点）
      windmillMesh.userData.omega = w.omega;
      windmillMesh.userData.blades = rotor;
      mechGroup.add(g);
      // GLB：拆固定座/叶片，叶片放平挂到 rotor 枢轴，扫掠半径对齐玩法 w.r
      windmillParts().then((parts) => {
        if (rotor.parent !== g) return; // 已切洞，丢弃过期回调
        g.remove(hubFb);
        rotor.remove(bladesFb);
        g.add(parts.base.clone(true));
        const rm = parts.rotor.clone(true);
        rm.scale.setScalar((w.r * 0.92) / parts.tip);
        const pivot = new THREE.Group();
        pivot.position.y = parts.hubY;
        pivot.add(rm);
        rotor.add(pivot);
      }).catch(() => {});
    }

    // 弹板
    if (h.bounce) {
      const p = h.bounce;
      const pad = box(p.w, 0.1, p.d, PALETTE.pad);
      pad.position.set(p.x, 0.06, p.z);
      mechGroup.add(pad);
    }

    // 移动门（垂直墙，开合）
    if (h.gate) {
      const g = h.gate;
      gateMesh.scale.set(1, 1, 1);
      gateMesh.position.set(g.x, 1, g.z);
      gateMesh.geometry = new THREE.BoxGeometry(g.w, 2, g.d);
      gateMesh.userData = { gate: g };
      mechGroup.add(gateMesh);
    }

    // 沙坑
    if (h.sand) {
      const s = h.sand;
      const disc = cylinder(s.r, s.r, 0.04, PALETTE.sand, 24);
      disc.position.set(s.x, 0.01, s.z);
      applyMap(disc.material, 'assets/tex/sand.webp', s.r / 2.5, s.r / 2.5);
      mechGroup.add(disc);
    }

    // 水障
    if (h.water) {
      const w = h.water;
      const water = box(w.w, 0.05, w.d, PALETTE.water);
      water.position.set(w.x, 0.02, w.z);
      water.material = lambert(PALETTE.water, { transparent: true, opacity: 0.85 });
      mechGroup.add(water);
    }

    builtHole = run.holeIndex;
  }

  function buildSlopeArrows(run) {
    while (slopeGroup.children.length) slopeGroup.remove(slopeGroup.children[0]);
    const h = run.hole;
    const sx = h.slope[0], sz = h.slope[1];
    if (Math.hypot(sx, sz) < 0.05) return;
    const len = Math.hypot(sx, sz);
    const nx = sx / len, nz = sz / len;
    const ang = Math.atan2(nz, nx);
    for (let i = 0; i < 7; i += 1) {
      const ax = 12 + i * 7;
      const az = 8 + (i % 3) * 11;
      const arrow = new THREE.Group();
      const shaft = box(2.4, 0.08, 0.16, PALETTE.ball);
      const head = box(0.5, 0.16, 0.5, PALETTE.ball);
      head.position.x = 1.3;
      arrow.add(shaft); arrow.add(head);
      arrow.position.set(ax, 0.06, az);
      arrow.rotation.y = -ang;
      slopeGroup.add(arrow);
    }
  }

  function render(run, dt) {
    // 相机目标：球（无 run 时绕果岭中心慢转）
    if (!run) {
      camTarget.set(GOLF.GREEN_W / 2, 0, GOLF.GREEN_D / 2);
      yaw += dt * 0.18;
    } else {
      const b = run.ball;
      camTarget.set(b.x, 0, b.z);
      // 球跟随
      ballMesh.position.set(b.x, b.y, b.z);
      ballMesh.visible = true;
      ballMesh.rotation.x += (Math.hypot(b.vx, b.vz) / GOLF.BALL_R) * dt;
      teeMesh.position.set(run.hole.tee[0], 0.02, run.hole.tee[1]);
      holeMesh.position.set(run.hole.hole[0], 0.02, run.hole.hole[1]);
      flagGroup.position.set(run.hole.hole[0], 0, run.hole.hole[1]);

      // 旗子弹跳（进洞/一杆进洞庆祝）；clothRestY 随 GLB 旗面高度自适应
      const bounce = run.phase === 'capture' || run.lastResult === 'ace'
        ? Math.abs(Math.sin(run.time * 8)) * 0.5
        : (run.phase === 'finished' ? 0.2 : 0);
      flagCloth.position.y = clothRestY + bounce * (clothRestY / 1.9);
      flagCloth.rotation.y = Math.sin(run.time * 5) * 0.2;

      // 切换洞：重建机关/坡度箭头/相机朝向
      if (run.holeIndex !== builtHole) { buildHole(run); buildSlopeArrows(run); }

      // 风车旋转
      if (run.hole.windmill && windmillMesh.userData.blades) {
        windmillMesh.userData.blades.rotation.y += run.hole.windmill.omega * dt;
      }
      // 移动门开合
      if (run.hole.gate && gateMesh.userData.gate) {
        const g = run.hole.gate;
        const open = Math.sin(run.time * g.omega) > -0.35;
        gateMesh.position.y = open ? 3.2 : 1.0;
      }

      // 瞄准线 + 预测线
      updateAim(run);

      // 相机：默认球后（朝洞方向反向），右键/触屏旋转 yaw
      if (run.phase === 'capture') {
        yaw += CAMERA.ORBIT_SPEED * dt * 3;
      }
      // 平滑距离
      const targetDist = clamp(CAMERA.DIST, CAMERA.ZOOM_MIN, CAMERA.ZOOM_MAX);
      dist += (targetDist - dist) * Math.min(1, CAMERA.LERP * dt);
    }

    // 相机位姿
    const ox = Math.sin(yaw) * dist;
    const oz = Math.cos(yaw) * dist;
    camera.position.set(camTarget.x + ox, camTarget.y + height, camTarget.z + oz);
    camera.lookAt(camTarget.x, camTarget.y + 0.4, camTarget.z);

    renderer.render(scene, camera);
  }

  function updateAim(run) {
    aimLine.line.visible = run.aim.active;
    aimLine.head.visible = run.aim.active;
    if (!run.aim.active) {
      for (const d of predDots) d.visible = false;
      return;
    }
    const b = run.ball;
    const dx = run.aim.dirX, dz = run.aim.dirZ;
    const len = 2 + run.aim.power * 6;
    aimLine.line.position.set(b.x, 0.12, b.z);
    aimLine.line.lookAt(b.x + dx, 0.12, b.z + dz);
    aimLine.line.scale.z = len;
    aimLine.head.position.set(b.x + dx * len, 0.12, b.z + dz * len);
    aimLine.head.lookAt(b.x + dx, 0.12, b.z + dz);

    // 预测点（前 2s 弹道，受风/坡影响）
    const pts = predict(run, dx, dz, run.aim.power, 2);
    for (let i = 0; i < predDots.length; i += 1) {
      const idx = Math.min(pts.length - 1, i * 2);
      if (idx < 0) { predDots[i].visible = false; continue; }
      const p = pts[idx];
      predDots[i].visible = true;
      predDots[i].position.set(p[0], 0.1, p[1]);
      predDots[i].scale.setScalar(1 - i / predDots.length + 0.3);
    }
  }

  return {
    render,
    resize: () => stage.resize(),
    setOrbit(deltaYaw) { yaw += deltaYaw; },
    setZoom(k) { dist = clamp(dist * k, CAMERA.ZOOM_MIN, CAMERA.ZOOM_MAX); },
    get camera() { return camera; },
    get yaw() { return yaw; },
    setYaw(v) { yaw = v; },
    // 初始相机朝向：背对洞看球
    faceBallFromHole(run) {
      const h = run.hole;
      yaw = Math.atan2(h.hole[0] - run.ball.x, h.hole[1] - run.ball.z) + Math.PI;
    },
  };
}

// ---------------------------------------------------------------- 程序化天空（渐变 + 云）
function makeSkyCanvas() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#7dd3fc');
  g.addColorStop(0.6, '#bae6fd');
  g.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  return c;
}

function addGridLines(scene) {
  const mat = new THREE.LineBasicMaterial({ color: 0x16a34a, transparent: true, opacity: 0.35 });
  const W = GOLF.GREEN_W, D = GOLF.GREEN_D;
  for (let x = 4; x < W; x += 4) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0.02, 0), new THREE.Vector3(x, 0.02, D)]);
    scene.add(new THREE.Line(geo, mat));
  }
  for (let z = 4; z < D; z += 4) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.02, z), new THREE.Vector3(W, 0.02, z)]);
    scene.add(new THREE.Line(geo, mat));
  }
}

function addScenery(scene) {
  const rnd = (seed) => { const s = Math.sin(seed) * 43758.5453; return s - Math.floor(s); };
  const slots = [];
  for (let i = 0; i < 14; i += 1) {
    const x = -3 + rnd(i) * (GOLF.GREEN_W + 6);
    const z = -3 + rnd(i * 3) * (GOLF.GREEN_D + 6);
    if (x > 0 && x < GOLF.GREEN_W && z > 0 && z < GOLF.GREEN_D) continue;
    const tree = new THREE.Group();
    const trunk = cylinder(0.18, 0.24, 1.4, 0x8b5e34, 8);
    trunk.position.y = 0.7;
    const top = sphere(1.0, 0x16a34a, 8);
    top.position.y = 1.9;
    tree.add(trunk); tree.add(top);
    tree.position.set(x, 0, z);
    scene.add(tree);
    slots.push({ tree, x, z, seed: i });
  }
  // GLB 树克隆摆位（替换程序化兜底，朝向/大小略有变化）
  loadModelData(golfTreeData, { targetLen: 3, forward: '+z', key: 'golf-tree' }).then((model) => {
    for (const s of slots) {
      const clone = model.clone(true);
      clone.position.set(s.x, 0, s.z);
      clone.rotation.y = rnd(s.seed * 7) * TAU;
      clone.scale.setScalar(0.85 + rnd(s.seed * 11) * 0.3);
      scene.remove(s.tree);
      scene.add(clone);
    }
  }).catch(() => {});
}

function addWalls(scene) {
  const W = GOLF.GREEN_W, D = GOLF.GREEN_D;
  const mk = (x, z, w, d) => {
    const m = box(w, 1.2, d, 0xd6d3d1);
    m.position.set(x, 0.6, z);
    scene.add(m);
  };
  mk(-0.6, D / 2, 1.2, D + 1.2);
  mk(W + 0.6, D / 2, 1.2, D + 1.2);
  mk(W / 2, -0.6, W + 1.2, 1.2);
  mk(W / 2, D + 0.6, W + 1.2, 1.2);
}

function buildAimLine() {
  const lineGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6);
  const lineMat = lambert(0xffffff, { transparent: true, opacity: 0.8 });
  const line = new THREE.Mesh(lineGeo, lineMat);
  line.rotation.x = Math.PI / 2; // 让圆柱沿 Z（lookAt 用）
  const headGeo = new THREE.ConeGeometry(0.18, 0.5, 8);
  const headMat = lambert(0xffffff, { transparent: true, opacity: 0.9 });
  const head = new THREE.Mesh(headGeo, headMat);
  return { line, head };
}

// ---------------------------------------------------------------- GLB 主体拆分工具
// 取模型首个网格并刷新世界矩阵（GLB 经 loader 归一化后矩阵含缩放/落地）。
function firstMesh(model) {
  let mesh = null;
  model.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  mesh.updateWorldMatrix(true, false);
  return mesh;
}

// 按三角形质心谓词把（可能量化压缩的）网格拆成两个浮点网格 a/b。
// 逐顶点 fromBufferAttribute 反量化后再施加世界矩阵，避免对整型属性 applyMatrix4 失真。
function splitMeshByCentroid(geo, material, matrix, isA) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv, idx = geo.index;
  const nm = new THREE.Matrix3().getNormalMatrix(matrix);
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  const A = { p: [], n: [], u: [] }, B = { p: [], n: [], u: [] };
  const N = new THREE.Vector3(), cen = new THREE.Vector3();
  const ids = [0, 0, 0], vs = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let t = 0; t < triCount; t += 1) {
    for (let k = 0; k < 3; k += 1) {
      ids[k] = idx ? idx.getX(t * 3 + k) : t * 3 + k;
      vs[k].fromBufferAttribute(pos, ids[k]).applyMatrix4(matrix);
    }
    cen.copy(vs[0]).add(vs[1]).add(vs[2]).multiplyScalar(1 / 3);
    const dst = isA(cen) ? A : B;
    for (let k = 0; k < 3; k += 1) {
      const ii = ids[k];
      dst.p.push(vs[k].x, vs[k].y, vs[k].z);
      if (nor) { N.fromBufferAttribute(nor, ii).applyMatrix3(nm).normalize(); dst.n.push(N.x, N.y, N.z); }
      if (uv) dst.u.push(uv.getX(ii), uv.getY(ii));
    }
  }
  const mk = (d) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(d.p, 3));
    if (d.n.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(d.n, 3));
    if (d.u.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(d.u, 2));
    const m = new THREE.Mesh(g, material);
    m.castShadow = true;
    return m;
  };
  return { a: mk(A), b: mk(B) };
}

// 风车 GLB 拆件（缓存一次）：固定座 base + 叶片 rotor（已绕枢轴放平），hubY/tip 供摆位缩放。
let _wmPartsPromise = null;
function windmillParts() {
  if (!_wmPartsPromise) {
    _wmPartsPromise = loadModelData(windmillData, { targetLen: 3, forward: '+z', key: 'windmill' }).then((model) => {
      const mesh = firstMesh(model);
      // 叶片盘位于塔前 z∈(0.30,0.50)（归一化 targetLen=3 空间），其余为塔/座
      const { a: rotor, b: base } = splitMeshByCentroid(mesh.geometry, mesh.material, mesh.matrixWorld, (c) => c.z > 0.30 && c.z < 0.50);
      const hub = new THREE.Box3().setFromObject(rotor).getCenter(new THREE.Vector3());
      rotor.geometry.translate(-hub.x, -hub.y, -hub.z);
      rotor.geometry.rotateX(-Math.PI / 2); // 竖直叶片盘 → 水平扫掠（对齐玩法 XZ 旋转）
      const rp = rotor.geometry.attributes.position;
      let tip = 0;
      for (let i = 0; i < rp.count; i += 1) tip = Math.max(tip, Math.hypot(rp.getX(i), rp.getZ(i)));
      return { base, rotor, hubY: hub.y, tip: tip || 1 };
    });
  }
  return _wmPartsPromise;
}
