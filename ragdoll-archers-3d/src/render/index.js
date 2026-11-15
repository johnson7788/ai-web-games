// src/render/index.js — 低多边形 3D 渲染：罗马竞技场 + 布偶弓手 + 箭矢 + 抛物线预览 + 慢镜头环绕。
// 数据全部来自 sim（body 位置/朝向/轨迹/风/箱/台）；素材占位：assets/sky.jpg 等，缺失回退程序化。
import { THREE, createStage, lambert, box, sphere, addLights, addFog } from '../core/base3d.js';
import { loadModelData } from '../../lib/model-loader-data.js';
import pillarData from '../../lib/models/arena-pillar.glb.js';
import crateData from '../../lib/models/wooden-crate.glb.js';
import { WORLD, RAG, ARROW, COLORS, PLAYER } from '../../config/game.config.js';

// 程序化渐变天空（sky.jpg 未到位/加载失败时兜底，不白屏）
function gradientSky(top, bottom) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#' + top.toString(16).padStart(6, '0'));
  grd.addColorStop(1, '#' + bottom.toString(16).padStart(6, '0'));
  g.fillStyle = grd; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createRenderer(canvas) {
  const stage = createStage({ canvas, clearColor: COLORS.skyBottom, fov: 55, near: 0.1, far: 400 });
  const { renderer, scene, camera } = stage;
  addLights(scene, { sky: 0xf6ead0, ground: 0x8a6a3a, sun: 0xffffff, intensity: 1.1, sunPos: [40, 60, 25] });
  // 补光：从相机侧（+z）照亮角色可见面，保证色板可读
  const fill = new THREE.DirectionalLight(0xffffff, 0.75);
  fill.position.set(0, 8, 22);
  scene.add(fill);
  addFog(scene, COLORS.skyBottom, 30, 140);

  const group = new THREE.Group();
  scene.add(group);

  // 天空：sky.jpg 等距柱状映射为背景；未到位/加载失败回退程序化渐变
  scene.background = gradientSky(COLORS.skyTop, COLORS.skyBottom);
  new THREE.TextureLoader().load('assets/sky.jpg', (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
  }, undefined, () => {});

  // 地面（沙色；预留 sand.webp 贴图槽位）
  const groundMat = lambert(COLORS.arenaSand);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  scene.add(ground);
  new THREE.TextureLoader().load('assets/tex/sand.webp', (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(24, 24); tex.colorSpace = THREE.SRGBColorSpace;
    groundMat.map = tex; groundMat.needsUpdate = true;
  }, undefined, () => {});

  // 木箱（共享材质，加载一次；贴图缺位回退纯色）
  const crateMat = lambert(0xa07040);
  new THREE.TextureLoader().load('assets/tex/wood.webp', (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 1); tex.colorSpace = THREE.SRGBColorSpace;
    crateMat.map = tex; crateMat.needsUpdate = true;
  }, undefined, () => {});

  // 竞技场立柱装饰（AI GLB，加载完成前回退程序化）
  const pillarMat = lambert(0xc9a27e);
  for (const x of [-14, 14]) for (const z of [-6, 6]) {
    const pg = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 5, 8), pillarMat);
    p.position.y = 2.5; pg.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.6), lambert(0xb98f5f));
    cap.position.y = 5.2; pg.add(cap);
    pg.position.set(x, 0, z); scene.add(pg);
    loadModelData(pillarData, { targetLen: 5.4, forward: '+z', key: 'pillar' }).then((model) => {
      pg.remove(p); pg.remove(cap); pg.add(model);
    }).catch(() => {});
  }

  // 玩家弓手（蓝）
  const player = buildFigure(COLORS.playerBlue, COLORS.burlap);
  player.group.position.set(WORLD.PLAYER_X, 0, 0);
  group.add(player.group);

  // 动态对象
  const enemyGroups = new Map();
  const arrowMeshes = new Map();
  const crateMeshes = [];
  const platformMeshes = [];
  const dots = [];
  for (let i = 0; i < 12; i++) {
    const d = sphere(0.07, 0xffffff, 8);
    d.material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    d.visible = false; scene.add(d); dots.push(d);
  }
  let lastLevel = -1;
  let orbitT = 0;

  // 头顶标记（YOU/ENEMY）：让玩家与目标一眼可辨（vision rubric 的 goal_visible / silhouette）
  function marker(text, color) {
    const cv = document.createElement('canvas'); cv.width = 192; cv.height = 80;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 192, 80);
    g.fillStyle = 'rgba(18,12,6,0.9)';
    g.fillRect(8, 20, 176, 52);
    g.strokeStyle = color; g.lineWidth = 5;
    g.strokeRect(8, 20, 176, 52);
    g.fillStyle = color;
    g.beginPath(); g.moveTo(82, 8); g.lineTo(96, 20); g.lineTo(110, 8); g.closePath(); g.fill();
    g.font = 'bold 30px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 96, 47);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sp.scale.set(3.2, 1.33, 1); sp.visible = false; sp.renderOrder = 20;
    scene.add(sp);
    return sp;
  }
  const playerMarker = marker('YOU', '#3b82f6');

  function buildFigure(main, limb) {
    const g = new THREE.Group();
    const torso = box(RAG.torso.w, RAG.torso.h, RAG.torso.d, main); torso.position.y = RAG.torso.y; g.add(torso);
    const head = sphere(RAG.head.r, main, 14); head.position.y = RAG.head.y; g.add(head);
    const arm = (z) => { const a = box(RAG.arm.w, RAG.arm.h, RAG.arm.d, limb); a.position.set(0, RAG.arm.y, z); g.add(a); return a; };
    const leg = (z) => { const l = box(RAG.leg.w, RAG.leg.h, RAG.leg.d, limb); l.position.set(0, RAG.leg.y, z); g.add(l); return l; };
    const armL = arm(-RAG.arm.offZ), armR = arm(RAG.arm.offZ), legL = leg(-RAG.leg.offZ), legR = leg(RAG.leg.offZ);
    // 弓：弧 + 弦
    const bow = new THREE.Group();
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 16, Math.PI), lambert(0x6b4a2a));
    bow.add(arc);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.8, 4), lambert(0xf2ead8));
    string.rotation.z = Math.PI / 2; string.position.x = -0.02;
    bow.add(string);
    bow.position.set(RAG.torso.w / 2 + 0.25, RAG.arm.y, 0);
    bow.rotation.y = Math.PI / 2;
    g.add(bow);
    return { group: g, bow, armL, armR, head, torso };
  }

  function ensureEnemy(enemy) {
    let e = enemyGroups.get(enemy.id);
    if (!e) {
      const fig = buildFigure(COLORS.enemyRed, COLORS.burlap);
      fig.group.position.set(enemy.x, 0, enemy.z);
      group.add(fig.group);
      e = { fig, parts: {}, marker: marker('ENEMY', '#ef4444') };
      for (const [name, p] of Object.entries(enemy.parts)) {
        const m = name.startsWith('head') ? sphere(RAG.head.r, COLORS.enemyRed, 14)
          : name === 'torso' ? box(RAG.torso.w, RAG.torso.h, RAG.torso.d, COLORS.enemyRed)
          : name.startsWith('arm') ? box(RAG.arm.w, RAG.arm.h, RAG.arm.d, COLORS.burlap)
          : box(RAG.leg.w, RAG.leg.h, RAG.leg.d, COLORS.burlap);
        group.add(m); e.parts[name] = m;
      }
      enemyGroups.set(enemy.id, e);
    }
    return e;
  }

  function syncEnemies(run) {
    const seen = new Set();
    for (const enemy of run.enemies) {
      const e = ensureEnemy(enemy);
      seen.add(enemy.id);
      for (const [name, p] of Object.entries(enemy.parts)) {
        const m = e.parts[name];
        if (!m) continue;
        m.position.copy(p.body.position);
        m.quaternion.copy(p.body.quaternion);
      }
      e.fig.bow.visible = !enemy.bowDropped && enemy.alive;
      e.fig.bow.position.set(enemy.x, enemy.baseY + RAG.arm.y, enemy.z);
      e.fig.bow.rotation.y = Math.PI / 2;
      e.marker.visible = enemy.alive;
      e.marker.position.set(enemy.x, enemy.baseY + 2.85, enemy.z);
    }
    for (const [id, e] of enemyGroups) {
      if (!seen.has(id)) {
        for (const m of Object.values(e.parts)) group.remove(m);
        group.remove(e.fig.group);
        scene.remove(e.marker);
        enemyGroups.delete(id);
      }
    }
  }

  function syncArrows(run) {
    const seen = new Set();
    for (const arrow of run.arrows) {
      seen.add(arrow.id);
      let m = arrowMeshes.get(arrow.id);
      if (!m) {
        m = box(ARROW.length, ARROW.radius * 2, ARROW.radius * 2, 0xf5ead0);
        const tip = box(ARROW.length * 0.28, ARROW.radius * 2.6, ARROW.radius * 2.6, COLORS.enemyRed);
        tip.position.x = ARROW.length * 0.36;
        m.add(tip);
        const feather = box(0.05, ARROW.radius * 4, ARROW.radius * 4, COLORS.playerBlue);
        feather.position.x = -ARROW.length * 0.4;
        m.add(feather);
        group.add(m);
        arrowMeshes.set(arrow.id, m);
      }
      m.position.copy(arrow.pos);
      m.quaternion.copy(arrow.quat);
    }
    for (const [id, m] of arrowMeshes) {
      if (!seen.has(id)) { group.remove(m); arrowMeshes.delete(id); }
    }
  }

  function syncProps(run) {
    if (run.level !== lastLevel) {
      lastLevel = run.level;
      for (const m of crateMeshes) scene.remove(m);
      for (const m of platformMeshes) scene.remove(m);
      crateMeshes.length = 0; platformMeshes.length = 0;
      for (const c of run.crates) {
        const m = new THREE.Group();
        const fb = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), crateMat);
        fb.position.y = c.h / 2; m.add(fb);
        m.position.set(c.x, c.y - c.h / 2, c.z); m.userData.crate = c;
        scene.add(m); crateMeshes.push(m);
        loadModelData(crateData, { targetLen: Math.max(c.w, c.h, c.d), forward: '+z', key: 'crate' }).then((model) => {
          m.remove(fb); m.add(model);
        }).catch(() => {});
      }
      for (const p of run.platforms) {
        const m = box(p.w, p.h, p.d, 0xb98f5f);
        m.position.set(p.x, p.y, p.z);
        scene.add(m); platformMeshes.push(m);
      }
    }
    for (const m of crateMeshes) m.visible = m.userData.crate.alive;
  }

  function syncPlayer(run) {
    player.group.position.x = run.player.x;
    player.group.position.z = run.player.z;
    playerMarker.visible = true;
    playerMarker.position.set(run.player.x, 2.7, run.player.z);
    const ang = run.player.drawing ? run.player.aimAngle : 0.15;
    player.bow.rotation.z = ang - 0.4; // 弓随仰角上扬
    // 轨迹点
    const pts = run.trajectory || [];
    for (let i = 0; i < dots.length; i++) {
      const p = pts[i];
      if (!p) { dots[i].visible = false; continue; }
      dots[i].visible = true;
      dots[i].position.set(p.x, p.y, p.z);
    }
  }

  function updateCamera(run, dt) {
    if (run && run.slowmoT > 0) {
      // 击杀慢镜头：环绕最近死亡的敌人
      const dead = run.enemies.find((e) => !e.alive);
      if (dead) {
        orbitT += dt * 2.2;
        const r = 7;
        camera.position.set(dead.x + Math.sin(orbitT) * r, 3.4, dead.z + Math.cos(orbitT) * r);
        camera.lookAt(dead.x, 1.2, dead.z);
        return;
      }
    }
    const [cx, cy, cz] = WORLD.CAMERA.pos;
    const [lx, ly, lz] = WORLD.CAMERA.look;
    camera.position.set(cx, cy, cz);
    camera.lookAt(lx, ly, lz);
  }

  function render(run, dt) {
    if (run) {
      syncPlayer(run);
      syncEnemies(run);
      syncArrows(run);
      syncProps(run);
      updateCamera(run, dt || 1 / 60);
    } else {
      playerMarker.visible = false;
      for (const e of enemyGroups.values()) e.marker.visible = false;
      updateCamera(null);
    }
    renderer.render(scene, camera);
  }

  return { render, resize: stage.resize, stage, camera, scene };
}
