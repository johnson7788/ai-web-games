// src/render/index.js — THREE 渲染：霓虹塔（低多边形平台 + 发光边条 + 霓虹圈）+ 第一人称相机 + 坠落俯冲。
// 贴图槽位：assets/sky.jpg（天空）/ assets/tex/platform.webp（平台顶面），加载失败回退程序化，不白屏不报错。
import { createStage, THREE, addLights, addFog, clamp, lerp } from '../core/base3d.js';
import { PALETTE, TOWER, PHYS, WORLD, PLATFORMS } from '../../config/game.config.js';
import { loadModelData } from '../../lib/model-loader-data.js';
import towerCoreData from '../../lib/models/tower-core.glb.js';
import neonPlatformData from '../../lib/models/neon-platform.glb.js';
import summitBeaconData from '../../lib/models/summit-beacon.glb.js';

const FOV_BASE = 72;

function edgeColor(type) {
  if (type === 'crumble' || type === 'rotate' || type === 'finish') return PALETTE.magenta;
  if (type === 'landing') return PALETTE.purple;
  return PALETTE.cyan;
}

function gradientTexture() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#05050f');
  gr.addColorStop(0.5, '#1a1030');
  gr.addColorStop(0.72, '#3b1a5e');
  gr.addColorStop(0.9, '#0a0a14');
  gr.addColorStop(1, '#0a0a14');
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRenderer(canvas) {
  const stage = createStage({ canvas, clearColor: PALETTE.bg, fov: FOV_BASE, near: 0.1, far: 600 });
  const { renderer, scene, camera } = stage;
  camera.rotation.order = 'YXZ';
  addLights(scene, { sky: 0x3a2f5e, ground: 0x0a0a14, sun: 0xffffff, intensity: 0.85, sunPos: [30, 70, 20] });
  addFog(scene, PALETTE.bg, 28, 240);

  // ---------------- 天空 + 星空 ----------------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, color: 0xffffff }));
  sky.material.map = gradientTexture();
  sky.material.needsUpdate = true;
  new THREE.TextureLoader().load('assets/sky.jpg',
    (tex) => { tex.colorSpace = THREE.SRGBColorSpace; sky.material.map = tex; sky.material.needsUpdate = true; },
    undefined, () => { /* 回退程序化渐变 */ });
  scene.add(sky);

  const starGeo = new THREE.BufferGeometry();
  const starN = 400;
  const starPos = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.5;
    const r = 260;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    starPos[i * 3 + 1] = Math.sin(e) * r + 10;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.7 }));
  scene.add(stars);

  // ---------------- 塔心 + 平台 + 霓虹圈 ----------------
  const tower = new THREE.Group();
  const towerH = TOWER.floors * TOWER.layerH;
  // 塔心用实心亮紫柱（不透明），从第 1 层一眼看到「要爬的塔」；半透明柱在暗夜里会被当成极光/几何色块
  // 程序化柱保留作 fallback：GLB 异步加载成功后才移除。
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.7, towerH, 12), new THREE.MeshBasicMaterial({ color: PALETTE.purple }));
  core.position.y = towerH / 2;
  tower.add(core);
  scene.add(tower);

  // GLB 塔心：自然比例偏粗短，按原柱体足迹（整塔高 + 原底径）非均匀贴合，保持「细长高塔」轮廓不变；
  // 电光紫自发光，还原原 MeshBasic 亮紫柱的「目标入画」可读性。碰撞/玩法不涉及塔心，纯视觉替换。
  loadModelData(towerCoreData, { targetLen: 8, forward: '+z', key: 'tower-core' }).then((model) => {
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const target = new THREE.Vector3(3.4, towerH, 3.4); // 原柱底径 1.7*2，整塔高
    model.scale.set(target.x / size.x, target.y / size.y, target.z / size.z);
    model.traverse((o) => {
      if (o.isMesh && o.material) {
        o.material = o.material.clone();
        o.material.color = new THREE.Color(PALETTE.purple).lerp(new THREE.Color(0xffffff), 0.55);
        o.material.emissive = new THREE.Color(PALETTE.purple);
        o.material.emissiveIntensity = 0.7;
        o.material.metalness = 0.3;
        o.material.roughness = 0.5;
      }
    });
    tower.remove(core);
    tower.add(model);
  }).catch(() => { /* 回退程序化亮紫柱 */ });

  const platGroup = new THREE.Group();
  scene.add(platGroup);
  const platMeshes = new Map();

  function makePlatform(p) {
    const g = new THREE.Group();
    const half = p.half;
    const side = new THREE.MeshStandardMaterial({ color: PALETTE.platformTop, roughness: 0.6, metalness: 0.3 });
    const top = new THREE.MeshStandardMaterial({ color: PALETTE.platformTop, roughness: 0.6, metalness: 0.3 });
    // BoxGeometry 材质顺序：+x, -x, +y(顶), -y, +z, -z —— 只给顶面贴图，侧面/底面保持纯色
    // slab 保留作 fallback：GLB 底板异步加载成功后才移除。
    const slab = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.45, half * 2), [side, side, top, side, side, side]);
    slab.position.y = -0.22;
    g.add(slab);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.12, 0.07, half * 2 + 0.12), new THREE.MeshBasicMaterial({ color: edgeColor(p.type) }));
    edge.position.y = 0.02;
    g.add(edge);
    const under = new THREE.Mesh(new THREE.BoxGeometry(half * 2 - 0.1, 0.1, half * 2 - 0.1), new THREE.MeshBasicMaterial({ color: edgeColor(p.type), transparent: true, opacity: 0.75 }));
    under.position.y = -0.45;
    g.add(under);
    g.userData.edge = edge;
    g.userData.type = p.type;
    g.userData.top = top;
    g.userData.half = half;
    g.userData.slab = slab;   // fallback 板，GLB 到位后移除
    g.userData.under = under; // 底部光晕，GLB 到位后随底板厚度下移
    g.position.set(p.x, p.y, p.z);
    return g;
  }

  for (const p of PLATFORMS) platMeshes.set(p.id, makePlatform(p));
  for (const m of platMeshes.values()) platGroup.add(m);

  // 平台顶面贴图：assets/tex/platform.webp（成功替换顶面材质，失败/缺失回退纯色，不白屏不报错）
  // 顶面材质引用 userData.top 在 GLB 到位后会指向 GLB 材质，故贴图应用做成可重入：
  // 贴图加载完成时应用一次；GLB 换板后再对新材料应用一次（每个材质只挂一次，避免重复 clone）。
  let platformTex = null;
  function applyPlatformTops() {
    if (!platformTex) return;
    for (const m of platMeshes.values()) {
      const top = m.userData.top;
      if (!top || top.userData.__platTex) continue;
      const t = platformTex.clone();
      t.repeat.set(m.userData.half * 2, m.userData.half * 2);
      t.needsUpdate = true;
      top.color.set(0xffffff);
      top.map = t;
      top.needsUpdate = true;
      top.userData.__platTex = true;
    }
  }
  new THREE.TextureLoader().load('assets/tex/platform.webp',
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      platformTex = tex;
      applyPlatformTops();
    },
    undefined, () => { /* 回退纯色顶面 */ });

  // GLB 悬浮平台底板：替换程序化 slab，保留 edge/under 发光条与 userData.edge/top/half 引用。
  // 碰撞用 config 的 half（sim 侧），与视觉网格无关；这里把 GLB 缩放对齐 half*2 的碰撞足迹。
  function attachPlatformGLB(g, proto) {
    const half = g.userData.half;
    const model = proto.clone(true);
    // 每平台独立材质实例：顶面贴图 repeat 按 half 各不相同，不能共享同一 material。
    model.traverse((o) => { if (o.isMesh && o.material) o.material = o.material.clone(); });
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const w = half * 2;
    const thick = 0.55; // 悬浮底板视觉厚度（原 slab 0.45，GLB 略厚更有体量）
    model.scale.set(w / size.x, thick / size.y, w / size.z);
    model.position.y = -thick; // 归一化后底在 y=0 → 顶面对齐本地 y≈0（与原 slab 顶面/碰撞面一致）
    let topMat = null;
    model.traverse((o) => {
      if (o.isMesh && o.material) {
        o.material.metalness = 0.35;
        o.material.roughness = 0.6;
        if (!topMat) topMat = o.material;
      }
    });
    if (g.userData.slab) g.remove(g.userData.slab);
    g.add(model);
    if (topMat) g.userData.top = topMat; // 顶面贴图引用指向 GLB 材质（edge/half/type 不变）
    if (g.userData.under) g.userData.under.position.y = -thick - 0.03; // 光晕移到底板下方
    applyPlatformTops();
  }
  loadModelData(neonPlatformData, { targetLen: 3, forward: '+z', key: 'neon-platform' }).then((proto) => {
    for (const g of platMeshes.values()) attachPlatformGLB(g, proto);
  }).catch(() => { /* 回退程序化 slab + 发光边条 */ });

  const ringGroup = new THREE.Group();
  scene.add(ringGroup);
  const ringMeshes = [];
  for (let f = 1; f <= TOWER.floors; f++) {
    const p = PLATFORMS.find((q) => q.kind === 'landing' && q.floor === f);
    const color = f === TOWER.floors ? PALETTE.finish : f === WORLD.CHECKPOINT_FLOOR ? PALETTE.magenta : PALETTE.cyan;
    const r = p.half + 0.5;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.22, 8, 48), new THREE.MeshBasicMaterial({ color }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(p.x, p.y + 0.35, p.z);
    ring.userData.floor = f;
    ringGroup.add(ring);
    ringMeshes.push(ring);
  }
  // 塔顶信标：亮品红光球 + 冲天光柱，让「顶端=目标」一眼可读
  // 程序化光球保留作 fallback；GLB（宝石球+基座）异步加载成功后替换。光晕/光柱保留。
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), new THREE.MeshBasicMaterial({ color: PALETTE.magenta }));
  beacon.position.set(0, towerH + 1.3, 0);
  scene.add(beacon);
  const beaconGlow = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 16), new THREE.MeshBasicMaterial({ color: PALETTE.magenta, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  beaconGlow.position.set(0, towerH + 2.0, 0);
  scene.add(beaconGlow);
  const lightBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 34, 8), new THREE.MeshBasicMaterial({ color: PALETTE.magenta, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  lightBeam.position.set(0, towerH + 18, 0);
  scene.add(lightBeam);

  // GLB 信标：等比放大到约 3.5m（原光球直径 3），底部落在塔顶，品红自发光还原「目标」可读性。
  loadModelData(summitBeaconData, { targetLen: 2, forward: '+z', key: 'summit-beacon' }).then((model) => {
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    model.scale.multiplyScalar(3.5 / size.y);
    model.position.y = towerH - 0.2; // 基座坐落塔顶，球体升起
    model.traverse((o) => {
      if (o.isMesh && o.material) {
        o.material = o.material.clone();
        o.material.color = new THREE.Color(PALETTE.magenta).lerp(new THREE.Color(0xffffff), 0.5);
        o.material.emissive = new THREE.Color(PALETTE.magenta);
        o.material.emissiveIntensity = 0.6;
        o.material.metalness = 0.4;
        o.material.roughness = 0.4;
      }
    });
    scene.remove(beacon);
    scene.add(model);
  }).catch(() => { /* 回退程序化品红光球 */ });

  // ---------------- 粒子（坠落拉线 / 落地尘土） ----------------
  const MAX_P = 300;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAX_P * 3);
  const pCol = new Float32Array(MAX_P * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.28, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const particles = new THREE.Points(pGeo, pMat);
  particles.frustumCulled = false;
  scene.add(particles);
  const pool = Array.from({ length: MAX_P }, () => ({ life: 0, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, max: 1 }));
  let pCursor = 0;

  function spawnBurst(x, y, z, n, color, spread, vy) {
    for (let i = 0; i < n; i++) {
      const p = pool[pCursor];
      pCursor = (pCursor + 1) % MAX_P;
      p.life = p.max = 0.6 + Math.random() * 0.5;
      p.x = x + (Math.random() - 0.5) * spread;
      p.y = y + (Math.random() - 0.5) * spread * 0.4;
      p.z = z + (Math.random() - 0.5) * spread;
      p.vx = (Math.random() - 0.5) * 2;
      p.vy = vy * (0.5 + Math.random() * 0.7);
      p.vz = (Math.random() - 0.5) * 2;
      const c = new THREE.Color(color);
      p.r = c.r; p.g = c.g; p.b = c.b;
    }
  }

  // ---------------- 状态 ----------------
  let t = 0;
  let beaconT = 0; // 信标呼吸专用计时（菜单/游玩都推进，不影响 t 驱动的霓虹圈/碎裂时序）
  let fallT = 0, fallY0 = 20, fallX = 0, fallZ = 0;
  let lastFloor = 0;

  function onEvent(ev) {
    if (ev.type === 'fall') {
      fallT = 1.15;
      fallY0 = Math.max(10, ev.fromY ?? 30);
      fallX = camera.position.x; fallZ = camera.position.z;
      spawnBurst(fallX, fallY0, fallZ, 90, PALETTE.cyan, 6, -26);
    } else if (ev.type === 'land') {
      spawnBurst(camera.position.x, camera.position.y - 1.4, camera.position.z, 6, PALETTE.purple, 1.2, -3);
    } else if (ev.type === 'dash') {
      spawnBurst(camera.position.x, camera.position.y, camera.position.z, 8, PALETTE.cyan, 0.8, 2);
    } else if (ev.type === 'level_up' && ev.floor > lastFloor) {
      lastFloor = ev.floor;
    }
  }

  function updateParticles(dt) {
    for (let i = 0; i < MAX_P; i++) {
      const p = pool[i];
      if (p.life <= 0) { pPos[i * 3 + 1] = -999; continue; }
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
      const a = clamp(p.life / p.max, 0, 1);
      pCol[i * 3] = p.r * a; pCol[i * 3 + 1] = p.g * a; pCol[i * 3 + 2] = p.b * a;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }

  function syncPlatforms(run) {
    for (const p of run.platforms) {
      const m = platMeshes.get(p.id);
      if (!m) continue;
      m.position.set(p.x, p.y, p.z);
      if (p.collapsed) m.visible = false;
      else if (m.userData.type === 'crumble' && p.crumbling) {
        m.visible = true;
        m.userData.edge.material.opacity = 0.4 + 0.6 * Math.abs(Math.sin(t * 18));
      }
      const blink = m.userData.blink || 1;
      m.scale.setScalar(blink);
    }
  }

  function positionCamera(run, dt) {
    const p = run.player;
    let px = p.x, py = p.y + PHYS.eye, pz = p.z;
    let yaw = p.yaw, pitch = p.pitch;

    if (fallT > 0) {
      fallT -= dt;
      const k = 1 - fallT / 1.15; // 0→1
      if (k < 0.62) {
        const s = k / 0.62;
        py = lerp(fallY0, WORLD.KILL_Y + 8, s);
        px = fallX; pz = fallZ;
        pitch = lerp(pitch, 1.2, s);
      } else {
        const s = (k - 0.62) / 0.38;
        const e = s * s * (3 - 2 * s);
        py = lerp(WORLD.KILL_Y + 8, p.y + PHYS.eye, e);
        px = lerp(fallX, p.x, e);
        pz = lerp(fallZ, p.z, e);
        pitch = lerp(1.2, p.pitch, e);
      }
    }

    camera.position.set(px, py, pz);
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    // 冲刺 FOV kick
    const wantFov = FOV_BASE + (p.dashT > 0 ? 10 : 0);
    if (Math.abs(camera.fov - wantFov) > 0.1) { camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 20); camera.updateProjectionMatrix(); }
  }

  function orbitCamera(dt) {
    t += dt;
    const a = t * 0.12;
    const r = 26;
    camera.position.set(Math.cos(a) * r, 22 + Math.sin(t * 0.3) * 3, Math.sin(a) * r);
    camera.rotation.order = 'YXZ';
    camera.lookAt(0, 28, 0);
  }

  function render(run, dt) {
    dt = dt || 1 / 60;
    if (!run) {
      orbitCamera(dt);
    } else {
      syncPlatforms(run);
      positionCamera(run, dt);
    }
    for (const ring of ringMeshes) {
      ring.rotation.z += dt * 0.4;
      ring.material.opacity = 0.7 + 0.3 * Math.sin(t * 2 + ring.userData.floor);
      ring.material.transparent = true;
    }
    // 塔顶信标呼吸光晕（纯装饰，独立计时，不改玩法/霓虹圈/碎裂时序）
    beaconT += dt;
    const pulse = 0.5 + 0.5 * Math.sin(beaconT * 2.2);
    beaconGlow.material.opacity = 0.28 + 0.22 * pulse;
    lightBeam.material.opacity = 0.3 + 0.14 * pulse;
    stars.rotation.y += dt * 0.004;
    updateParticles(dt);
    renderer.render(scene, camera);
  }

  return { render, onEvent, resize: stage.resize, camera, scene };
}
