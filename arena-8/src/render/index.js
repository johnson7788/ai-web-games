// src/render/index.js — 3D 渲染：低多边形圆形竞技场 + 8 糖果色布偶 + 武器 + 粒子。
// 契约：createRenderer(canvas) → { render(run, dt, cam), onEvent(ev), resize(), dispose() }
// 程序化占位渲染；AI 素材（天空/贴图）加载失败回退渐变天空/纯色地板，不白屏不报错。
import { THREE, box, sphere, cylinder, lambert, addLights, clamp, lerp } from '../core/base3d.js';
import { loadModelData } from '../../lib/model-loader-data.js';
import { RoomEnvironment } from '../../lib/RoomEnvironment.js';
import batData from '../../lib/models/baseball-bat.glb.js';
import panData from '../../lib/models/frying-pan.glb.js';
import { ARENA, FIGHTER, WEAPONS, MATCH, COLORS, FLOOR, ARENA_COLOR, CAMERA } from '../../config/game.config.js';

const SKY_URL = 'assets/sky.jpg';
const FLOOR_TEX_URL = 'assets/tex/floor.webp';
const FLOOR_TILE = 8; // 每张贴图覆盖的世界边长（单位），repeat = 场地直径 / tile

// 程序化渐变天空（天空 jpg 缺失/加载失败时的回退，不白屏）
function gradientSky() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#0b0518');
  grad.addColorStop(0.55, '#3b1a6e');
  grad.addColorStop(1, '#7c3aed');
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createRenderer(canvas) {
  const probe = document.createElement('canvas').getContext('webgl');
  const dbg = probe && probe.getExtension('debug_renderer_info');
  const software = /swiftshader|llvmpipe|softpipe|software/i.test(String(dbg ? probe.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ''));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !software, powerPreference: 'high-performance' });
  renderer.setPixelRatio(software ? 0.66 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(1280, 720, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // PBR 环境反射（AI GLB 武器为标准材质，受益；程序化布偶保持 Lambert 糖果色）
  { const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; }
  scene.background = gradientSky();
  scene.fog = new THREE.Fog(0x1a1030, 55, 200);

  // 天空贴图（失败回退程序化渐变天空）
  new THREE.TextureLoader().load(SKY_URL, (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
  }, undefined, () => { scene.background = gradientSky(); });

  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 16 / 9, 0.1, 400);
  addLights(scene, { sky: 0xbfc9ff, ground: 0x241a33, sun: 0xffffff, intensity: 1.0, sunPos: [30, 50, 20] });

  // ---------------------------------------------------------------- 竞技场
  const arena = new THREE.Group();
  scene.add(arena);
  const floor = cylinder(ARENA.R, ARENA.R, 0.6, FLOOR, 48);
  floor.position.y = -0.3;
  floor.receiveShadow = true;
  arena.add(floor);
  // 地板贴图（缺失/失败回退纯色 FLOOR，只换材质不改几何）
  new THREE.TextureLoader().load(FLOOR_TEX_URL, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.repeat.set((ARENA.R * 2) / FLOOR_TILE, (ARENA.R * 2) / FLOOR_TILE);
    floor.material.map = t;
    floor.material.color.set(0xffffff);
    floor.material.needsUpdate = true;
  });
  // 地板紫色网格环（派对竞技风格）
  const grid = new THREE.GridHelper(ARENA.R * 2, 20, ARENA_COLOR, 0x33303e);
  grid.position.y = 0.02;
  arena.add(grid);
  // 霓虹边线（紫色 torus，双环更醒目）
  const edge = new THREE.Mesh(new THREE.TorusGeometry(ARENA.R, 0.32, 8, 64), new THREE.MeshBasicMaterial({ color: 0xa06bff }));
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.1;
  arena.add(edge);
  const edge2 = new THREE.Mesh(new THREE.TorusGeometry(ARENA.R, 0.14, 8, 64), new THREE.MeshBasicMaterial({ color: 0xd8b4ff }));
  edge2.rotation.x = Math.PI / 2;
  edge2.position.y = 0.14;
  arena.add(edge2);
  // 决胜圈（第 5 场收缩展示）
  const shrinkRing = new THREE.Mesh(new THREE.TorusGeometry(ARENA.R, 0.2, 8, 64), new THREE.MeshBasicMaterial({ color: 0xff4d6d, transparent: true, opacity: 0.8 }));
  shrinkRing.rotation.x = Math.PI / 2;
  shrinkRing.position.y = 0.15;
  shrinkRing.visible = false;
  arena.add(shrinkRing);

  // ---------------------------------------------------------------- 布偶
  const fighters = [];
  const G = new THREE.Group();
  scene.add(G);
  function limb(w, h, d, color) {
    const m = new THREE.Group();
    const b = box(w, h, d, color, { emissive: new THREE.Color(color), emissiveIntensity: 0.3 });
    b.position.y = -h / 2;
    m.add(b);
    return m;
  }
  function buildFighter(color) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    body.scale.setScalar(1.4);
    body.position.y = 1.05; // 抬升使放大后脚仍落地
    g.add(body);
    const mat = { emissive: new THREE.Color(color), emissiveIntensity: 0.3 };
    body.add(box(0.72, 0.72, 0.5, color, mat));          // 躯干
    const head = sphere(0.34, color, 12);
    head.material.emissive = new THREE.Color(color);
    head.material.emissiveIntensity = 0.3;
    head.position.y = 0.72;
    body.add(head);
    const eyes = sphere(0.06, 0x111111, 6);
    eyes.scale.set(1, 1, 0.5); eyes.position.set(0.09, 0.76, 0.3);
    body.add(eyes);
    const armL = limb(0.2, 0.6, 0.2, color); armL.position.set(-0.5, 0.36, 0);
    const armR = limb(0.2, 0.6, 0.2, color); armR.position.set(0.5, 0.36, 0);
    const legL = limb(0.22, 0.5, 0.22, color); legL.position.set(-0.2, -0.36, 0);
    const legR = limb(0.22, 0.5, 0.22, color); legR.position.set(0.2, -0.36, 0);
    body.add(armL, armR, legL, legR);
    // 武器挂点（右手）
    const weapon = new THREE.Group();
    weapon.position.set(0.5, 0.1, 0);
    armR.add(weapon);
    return { g, body, head, armL, armR, legL, legR, weapon, phase: Math.random() * 6.28 };
  }
  for (let i = 0; i < MATCH.fighters; i++) {
    const f = buildFighter(COLORS[i]);
    // 布偶保留程序化枢轴结构（armL/armR/legL/legR 摆动 + body 翻滚是玩法喜剧核心，不整换 GLB）
    f.g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    G.add(f.g);
    fighters.push(f);
  }

  // ---------------------------------------------------------------- 武器（程序化 fallback + AI GLB 视觉升级）
  // weaponSlots：每类武器的全部视觉容器（手持挂点 + 地面克隆）。GLB 到位后统一替换内部 fallback。
  const weaponSlots = {};
  for (const t of Object.keys(WEAPONS.defs)) weaponSlots[t] = [];
  function buildWeaponMesh(type) {
    const slot = new THREE.Group();
    const fallback = new THREE.Group();
    fallback.name = 'weapon-fallback';
    if (type === 'bat') {
      const m = cylinder(0.09, 0.16, 0.9, 0x8b5a2b);
      m.rotation.x = Math.PI / 2;
      fallback.add(m);
    } else if (type === 'pan') {
      const face = cylinder(0.3, 0.3, 0.06, 0x444444);
      face.rotation.x = Math.PI / 2;
      const handle = cylinder(0.04, 0.04, 0.4, 0x333333);
      fallback.add(face, handle);
    } else {
      fallback.add(box(0.3, 0.3, 0.3, 0xff4444)); // 拳套
    }
    slot.add(fallback);
    weaponSlots[type].push(slot);
    return slot;
  }
  const weaponMeshes = {};
  for (const t of Object.keys(WEAPONS.defs)) weaponMeshes[t] = buildWeaponMesh(t);

  // GLB 升级：手持挂点/地面克隆的 Group 引用与驱动逻辑不变，只替换内部视觉网格。
  function upgradeWeaponGLB(type, dataUri, targetLen) {
    loadModelData(dataUri, { targetLen, forward: '+z', key: 'weapon-' + type }).then((model) => {
      const holder = new THREE.Group();
      holder.add(model);
      // 长轴摆向 Z（对齐原球棒 rotation.x=π/2 的横握姿态），再居中到握点（对齐原 Cylinder 居中放置）
      const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      if (size.y >= size.x && size.y >= size.z) model.rotation.x = Math.PI / 2;
      else if (size.x > size.z) model.rotation.y = Math.PI / 2;
      const center = new THREE.Box3().setFromObject(holder).getCenter(new THREE.Vector3());
      model.position.sub(center);
      for (const slot of weaponSlots[type]) {
        const fb = slot.getObjectByName('weapon-fallback');
        if (fb) { slot.remove(fb); slot.add(holder.clone(true)); }
      }
    }).catch(() => {});
  }
  // AI GLB 武器（data-URI 内联，零网络请求）；解析失败自动保留程序化 fallback
  upgradeWeaponGLB('bat', batData, 1.4);
  upgradeWeaponGLB('pan', panData, 1.2);

  // ---------------------------------------------------------------- 粒子
  const parts = [];
  const P_MAX = 160;
  function spawnParticles(x, y, z, color, n = 8) {
    for (let i = 0; i < n && parts.length < P_MAX; i++) {
      const m = sphere(0.12, color, 4);
      m.position.set(x, y, z);
      m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5 + 1, (Math.random() - 0.5) * 6);
      m.userData.life = 0.5 + Math.random() * 0.3;
      scene.add(m);
      parts.push(m);
    }
  }

  // ---------------------------------------------------------------- 更新
  const camYaw = { yaw: 0, dist: CAMERA.dist, height: CAMERA.height };

  function updateFighters(run, dt) {
    for (let i = 0; i < fighters.length; i++) {
      const f = run.fighters[i];
      if (!f || f.gone) { fighters[i].g.visible = false; continue; }
      const m = fighters[i];
      m.g.visible = true;
      m.g.position.set(f.x, f.y, f.z);
      m.g.rotation.y = f.facing;
      const rag = f.ragdollT > 0 || !f.alive;
      if (rag) {
        // 布偶瘫软/飞出场外：四肢乱舞 + 身体翻滚
        m.phase += dt * 18;
        m.armL.rotation.x = Math.sin(m.phase * 1.7) * 1.4;
        m.armR.rotation.x = Math.cos(m.phase * 1.9) * 1.4;
        m.legL.rotation.x = Math.sin(m.phase * 1.3 + 1) * 1.2;
        m.legR.rotation.x = Math.cos(m.phase * 1.5 + 2) * 1.2;
        if (f.airborne || !f.alive) {
          m.body.rotation.x += dt * 6;
          m.body.rotation.z += dt * 4;
        } else {
          m.body.rotation.x *= 0.9; m.body.rotation.z *= 0.9;
        }
      } else {
        const speed = Math.hypot(f.vx, f.vz);
        m.phase += dt * (4 + speed * 2.2);
        const sw = Math.sin(m.phase);
        m.armL.rotation.x = sw * 0.5;
        m.armR.rotation.x = -sw * 0.5;
        m.legL.rotation.x = -sw * 0.5;
        m.legR.rotation.x = sw * 0.5;
        m.body.rotation.x = lerp(m.body.rotation.x, 0, 0.2);
        m.body.rotation.z = lerp(m.body.rotation.z, 0, 0.2);
      }
      // 武器
      m.weapon.clear();
      if (f.weapon && weaponMeshes[f.weapon] && f.alive) {
        m.weapon.add(weaponMeshes[f.weapon]);
      }
    }
    // 场地上的武器
    for (const w of run.weapons) {
      if (w.respawnT > 0) continue;
      if (!w._mesh) { w._mesh = weaponMeshes[w.type].clone(); weaponSlots[w.type].push(w._mesh); w._mesh.position.y = 0.5; arena.add(w._mesh); w._mesh.rotation.y = run.time * 2; }
      w._mesh.visible = true;
      w._mesh.position.x = w.x; w._mesh.position.z = w.z;
    }
    for (const w of run.weapons) if (w.respawnT > 0 && w._mesh) w._mesh.visible = false;
  }

  function updateArena(run) {
    // 决胜圈收缩可视化
    const shrinkOn = run.match >= MATCH.rounds && ARENA.shrink.enabled;
    if (shrinkOn && run.phase === 'match') {
      shrinkRing.visible = true;
      const r = run.arenaR;
      shrinkRing.geometry.dispose();
      shrinkRing.geometry = new THREE.TorusGeometry(r, 0.2, 8, 64);
      if (r < ARENA.R - 0.1) {
        // 收缩时地板外圈暗化示意：跳过（保持简单）
      }
    } else shrinkRing.visible = false;
  }

  function updateCamera(run, dt) {
    const p = run.fighters[0];
    if (!p) return;
    const tx = p.x + Math.sin(camYaw.yaw) * camYaw.dist;
    const ty = p.y + camYaw.height;
    const tz = p.z + Math.cos(camYaw.yaw) * camYaw.dist;
    const k = Math.min(1, CAMERA.smooth * dt);
    camera.position.x += (tx - camera.position.x) * k;
    camera.position.y += (ty - camera.position.y) * k;
    camera.position.z += (tz - camera.position.z) * k;
    camera.lookAt(p.x, p.y + 1, p.z);
  }

  // ---------------------------------------------------------------- 粒子更新
  function updateParticles(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.userData.life -= dt;
      p.userData.v.y -= 20 * dt;
      p.position.addScaledVector(p.userData.v, dt);
      if (p.userData.life <= 0) {
        scene.remove(p);
        p.geometry.dispose();
        parts.splice(i, 1);
      }
    }
  }

  let lastRun = null;

  return {
    camera,
    get camYaw() { return camYaw; },
    render(run, dt, cam = {}) {
      if (cam.yaw !== undefined) camYaw.yaw = cam.yaw;
      lastRun = run || lastRun;
      if (run) {
        updateFighters(run, dt);
        updateArena(run);
      }
      if (cam.title || !run) {
        // 标题屏：缓慢环绕竞技场展示
        const a = performance.now() * 0.00025;
        camera.position.set(Math.sin(a) * 26, 18, Math.cos(a) * 26);
        camera.lookAt(0, 0, 0);
      } else {
        updateCamera(run, dt);
      }
      updateParticles(dt);
      renderer.render(scene, camera);
    },
    onEvent(ev) {
      const r = lastRun;
      if (!r) return;
      if (ev.type === 'hit') {
        const t = r.fighters[ev.to];
        if (t) spawnParticles(t.x, t.y + 1, t.z, 0xffffff, 6);
      } else if (ev.type === 'kill' || ev.type === 'fall') {
        const t = r.fighters[ev.id];
        if (t) spawnParticles(t.x, t.y + 1, t.z, 0xff4d6d, 14);
      } else if (ev.type === 'ult') {
        const f = r.fighters[ev.from];
        if (f) spawnParticles(f.x, 0.3, f.z, ARENA_COLOR, 18);
      }
    },
    resize() {},
    dispose() { renderer.dispose(); },
  };
}
