// src/render/index.js — 3D 渲染：糖果天空 + 悬浮赛道 + 半透明滚球(球里一只猴) + 香蕉/移动锤/弹跳板/终点。
// 契约：createRenderer(canvas) → { render(run, dt), onEvent(ev), resize(w,h), dispose() }
// 贴图走 assets/sky.jpg、assets/tex/*.webp，缺失/失败回退程序化（不白屏不报错）。
import { createStage, addLights, THREE, clamp } from '../core/base3d.js';
import { BALL, CAMERA, FX } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';
import { createTrack } from '../game/track.js';
import { loadModelData } from '../../lib/model-loader-data.js';
import monkeyBallData from '../../lib/models/monkey-ball.glb.js';
import bananaPickupData from '../../lib/models/banana-pickup.glb.js';
import slideHammerData from '../../lib/models/slide-hammer.glb.js';

// GLB 视觉替换标记：模型来自共享缓存（clone 共享 geometry/material），
// clearGroup 重建关卡时不可 dispose，否则后续克隆会失效。
function markGLB(root) { root.traverse((o) => { o.userData.__glb = true; }); return root; }

const COLORS = {
  sky: 0x60a5fa,
  track: 0xf472b6,
  banana: 0xfacc15,
  ball: 0xffffff,
  hammer: 0x8b5cf6,
  pad: 0x4ade80,
  finish: 0xffffff,
};

export function createRenderer(canvas) {
  const stage = createStage({ canvas, clearColor: COLORS.sky, fov: CAMERA.fovBase, far: 900 });
  const { renderer, scene, camera } = stage;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.sky, 40, 380);
  addLights(scene, { sky: 0xd6ecff, ground: 0x3a4a66, sun: 0xffffff, intensity: 1.15, sunPos: [18, 42, 20] });

  // 天空球（预留贴图槽位，失败回退纯色）
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), new THREE.MeshBasicMaterial({ color: COLORS.sky, side: THREE.BackSide, fog: false }));
  scene.add(skyDome);

  // 贴图槽位
  const tex = { track: null, monkey: null };
  const monkeyFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.6),
    new THREE.MeshBasicMaterial({ color: 0xa3724a, transparent: true, side: THREE.DoubleSide })
  );
  function loadTex(url, ok) {
    const img = new Image();
    img.onload = () => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      ok(t);
    };
    img.onerror = () => { /* 回退程序化，静默 */ };
    img.src = url;
  }
  loadTex('assets/sky.jpg', (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    skyDome.material = new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false });
  });
  loadTex('assets/tex/track.webp', (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    tex.track = t;
    // 若贴图晚于轨道 mesh 构建到位，补接已建材质（否则回退纯色会卡住）
    trackGroup.children.forEach((m) => { if (m.material?.map === null) { m.material.map = t; m.material.needsUpdate = true; } });
  });
  loadTex('assets/tex/monkey.webp', (t) => { tex.monkey = t; monkeyFace.material.map = t; monkeyFace.material.needsUpdate = true; });

  // ---- 世界（按关卡重建轨道 / 香蕉 / 陷阱 / 终点）----
  let builtLevel = -1;
  const trackGroup = new THREE.Group();
  const bananasGroup = new THREE.Group();
  const hazardGroup = new THREE.Group();
  const finishGroup = new THREE.Group();
  scene.add(trackGroup, bananasGroup, hazardGroup, finishGroup);

  function clearGroup(g) {
    while (g.children.length) {
      const c = g.children.pop();
      c.traverse?.((o) => { if (o.userData?.__glb) return; o.geometry?.dispose?.(); if (Array.isArray(o.material)) o.material.forEach((m) => m?.dispose?.()); else o.material?.dispose?.(); });
    }
  }

  function buildRibbon(lv) {
    const step = 2;
    const n = Math.ceil(lv.length / step);
    const pos = [], uv = [], idx = [];
    const thick = 0.5;
    for (let i = 0; i <= n; i++) {
      const z = Math.min(lv.length, i * step);
      const y = lv.surfaceY(z);
      const w = lv.halfWidthAt(z);
      pos.push(-w, y, z, w, y, z, -w, y - thick, z, w, y - thick, z);
      uv.push(0, z / 6, 1, z / 6, 0, z / 6, 1, z / 6);
    }
    for (let i = 0; i < n; i++) {
      const b = i * 4;
      idx.push(b, b + 1, b + 5, b, b + 5, b + 4); // 顶面
      idx.push(b, b + 4, b + 6, b, b + 6, b + 2); // 左侧
      idx.push(b + 1, b + 3, b + 7, b + 1, b + 7, b + 5); // 右侧
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.track, map: tex.track, roughness: 0.72, metalness: 0.05 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  function buildBanana(x, y, z) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.banana, roughness: 0.5, metalness: 0.05, emissive: COLORS.banana, emissiveIntensity: 0.4 });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 10, 14, Math.PI * 1.4), mat);
    arc.rotation.z = Math.PI * 0.5;
    g.add(arc);
    g.position.set(x, y, z);
    g.userData.baseY = y; // 浮动驱动引用保留（renderGame 每帧读 baseY）
    // GLB 视觉替换：g 仍是 bananasGroup 直接子级（索引对齐 run.bananas_list），旋转/浮动驱动不变
    loadModelData(bananaPickupData, { targetLen: 0.8, forward: '+z', key: 'banana-pickup' }).then((model) => {
      model.position.y = -0.4; // 归一化底部落地 → 移回原 Torus 的居中高度
      markGLB(model);
      g.remove(arc); g.add(model);
    }).catch(() => { /* 保留程序化 fallback */ });
    return g;
  }

  function buildHammer() {
    const g = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 6), new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.6 }));
    arm.position.y = 1.0;
    g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: COLORS.hammer, roughness: 0.4, metalness: 0.3 }));
    head.position.y = 2.0;
    g.add(head);
    g.userData.head = head; // 滑动驱动引用（renderGame: head.position.x = barX）
    // GLB 视觉替换：整锤落入滑动枢轴，head 引用改指枢轴，barX 滑动驱动原样保留
    loadModelData(slideHammerData, { targetLen: 2, forward: '+z', key: 'slide-hammer' }).then((model) => {
      const pivot = new THREE.Group(); // 底部 y=0 落地，占地与原 arm+head 一致
      markGLB(model);
      pivot.add(model);
      g.remove(arm); g.remove(head);
      g.add(pivot);
      g.userData.head = pivot;
    }).catch(() => { /* 保留程序化 fallback */ });
    return g;
  }

  function buildPad(p, lv) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(p.halfWidth * 2, 0.08, 1.2), new THREE.MeshStandardMaterial({ color: COLORS.pad, roughness: 0.4, emissive: COLORS.pad, emissiveIntensity: 0.35 }));
    m.position.set(0, lv.surfaceY(p.z) + 0.04, p.z);
    return m;
  }

  function buildFinish(lv) {
    const g = new THREE.Group();
    const z = lv.length;
    const w = lv.halfWidthAt(z);
    for (const x of [-w, w]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 8), new THREE.MeshStandardMaterial({ color: COLORS.finish, roughness: 0.4 }));
      post.position.set(x, lv.surfaceY(z) + 1.5, z);
      g.add(post);
    }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(w * 2, 0.6, 0.1), new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5 }));
    banner.position.set(0, lv.surfaceY(z) + 2.6, z);
    g.add(banner);
    return g;
  }

  function ensureWorld(lvIndex) {
    if (builtLevel === lvIndex) return;
    builtLevel = lvIndex;
    const level = LEVELS[lvIndex];
    const lv = createTrack(level);
    clearGroup(trackGroup);
    clearGroup(bananasGroup);
    clearGroup(hazardGroup);
    clearGroup(finishGroup);
    trackGroup.add(buildRibbon(lv));
    for (const b of level.bananas) bananasGroup.add(buildBanana(b.x, b.y ?? lv.surfaceY(b.z) + BALL.radius * 1.8, b.z));
    for (const h of level.hammers) hazardGroup.add(buildHammer());
    for (const p of level.pads) hazardGroup.add(buildPad(p, lv));
    finishGroup.add(buildFinish(lv));
  }

  // ---- 球 + 球里猴子 ----
  const ballShell = new THREE.Mesh(new THREE.SphereGeometry(BALL.radius, 24, 24), new THREE.MeshStandardMaterial({ color: COLORS.ball, roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.92 }));
  // 深色描边（反向壳）：让玩家球在浅色轨道/天空上保持清晰剪影
  const ballOutline = new THREE.Mesh(new THREE.SphereGeometry(BALL.radius * 1.14, 24, 24), new THREE.MeshBasicMaterial({ color: 0x1e293b, side: THREE.BackSide }));
  monkeyFace.position.z = -BALL.radius * 0.4;
  const ballGroup = new THREE.Group();
  ballGroup.add(ballShell);
  ballGroup.add(ballOutline);
  ballGroup.add(monkeyFace);
  scene.add(ballGroup);
  // GLB 视觉替换（猴在球内整体模型）：ballGroup 的 position 驱动不变；
  // ballRoll 承接滚动旋转（球随速度滚动），ballLook 承接窄桥张望动画。
  let ballRoll = null;
  let ballLook = null;
  loadModelData(monkeyBallData, { targetLen: 1.6, forward: '+z', key: 'monkey-ball' }).then((model) => {
    model.position.y = -0.8; // 归一化底部落地 → 球心对齐 ballGroup 原点（sim p.y 为球心）
    markGLB(model);
    ballLook = new THREE.Group();
    ballLook.add(model);
    ballRoll = new THREE.Group();
    ballRoll.add(ballLook);
    ballGroup.remove(ballShell);
    ballGroup.remove(ballOutline);
    ballGroup.remove(monkeyFace);
    ballGroup.add(ballRoll);
  }).catch(() => { /* 保留程序化 fallback */ });

  // ---- 相机 / 状态 ----
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  let shake = 0;
  let titleT = 0;
  let bananaT = 0;

  function renderTitle(dt) {
    titleT += dt;
    const r = 9;
    const a = titleT * 0.3;
    camera.position.set(Math.sin(a) * r, 3.4, Math.cos(a) * r);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0.6, 0);
    camera.fov = CAMERA.fovBase;
    camera.updateProjectionMatrix();
  }

  function renderGame(run, dt) {
    const p = run.player;
    const lv = run.level;
    ensureWorld(run.levelIndex);

    ballGroup.position.set(p.x, p.y, p.z);
    // 滚动驱动：GLB 到位后作用于 ballRoll，否则保持原 ballShell 驱动
    const roller = ballRoll || ballShell;
    roller.rotation.x -= (p.vz * dt) / BALL.radius;
    roller.rotation.z += (p.vx * dt) / BALL.radius;

    // 窄桥签名：猴子左顾右盼 + 球身微颤（GLB 时张望作用于 ballLook 枢轴）
    const narrow = lv.halfWidthAt(p.z) < 1.0;
    const looker = ballLook || monkeyFace;
    if (narrow) {
      looker.rotation.y = Math.sin(run.time * 6) * 0.7;
      roller.scale.setScalar(1 + Math.sin(run.time * 40) * 0.006);
    } else {
      looker.rotation.y = 0;
      roller.scale.setScalar(1);
    }

    // 香蕉：收集后隐藏 + 浮动
    bananaT += dt;
    bananasGroup.children.forEach((b, i) => {
      const taken = run.bananas_list[i]?.taken;
      b.visible = !taken;
      if (!taken) {
        b.rotation.y += dt * 1.4;
        b.position.y = b.userData.baseY + Math.sin(bananaT * 2 + i) * 0.12;
      }
    });

    // 移动锤：摆臂跟随 sim 计算的 barX
    for (let i = 0; i < run.hammers.length; i++) {
      const h = run.hammers[i];
      const g = hazardGroup.children[i];
      if (!g) continue;
      g.position.set(0, lv.surfaceY(h.z), h.z);
      g.userData.head.position.x = h.barX ?? 0;
    }

    // 相机：球后上方跟随 + 速度感 FOV + 窄桥侧倾
    const target = new THREE.Vector3(p.x, p.y + CAMERA.height, p.z - CAMERA.dist);
    camPos.lerp(target, 1 - Math.exp(-CAMERA.posLerp * dt));
    if (shake > 0.01) {
      camPos.x += (Math.random() - 0.5) * shake;
      camPos.y += (Math.random() - 0.5) * shake * 0.6;
      camPos.z += (Math.random() - 0.5) * shake;
      shake *= Math.pow(0.02, dt);
    }
    camera.position.copy(camPos);
    camLook.set(p.x, p.y + 1.1, p.z + CAMERA.lookAhead);
    const tilt = narrow ? Math.sin(run.time * 1.2) * 0.06 : 0;
    camera.up.set(Math.sin(tilt), Math.cos(tilt), 0);
    camera.lookAt(camLook);

    const spdF = clamp((Math.hypot(p.vx, p.vz)) / BALL.maxSpeed, 0, 1);
    camera.fov += ((CAMERA.fovBase + spdF * CAMERA.fovSpeed) - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();
  }

  function render(run, dt) {
    dt = dt || 1 / 60;
    if (run) renderGame(run, dt);
    else renderTitle(dt);
    renderer.render(scene, camera);
  }

  function onEvent(ev) {
    if (!ev) return;
    if (ev.type === 'hammerHit') shake = Math.max(shake, FX.shakeHit);
    else if (ev.type === 'fall') shake = Math.max(shake, FX.shakeFall);
  }

  function resize() {
    stage.resize();
  }

  function dispose() {
    renderer.dispose();
  }

  return { render, onEvent, resize, dispose };
}
