// src/render/index.js — 3D 渲染（three.js）：低多边形军事场景 / 敌人剪影 / 枪械视角 / 特效。
// 只读 sim 快照，不做判定。天空/贴图加载 assets/sky.jpg、assets/tex/*.webp，失败回退程序化。
import { createStage, THREE, lambert, box, addLights, addFog, clamp, lerp } from '../core/base3d.js';
import { loadModelData } from '../../lib/model-loader-data.js';
import soldierData from '../../lib/models/enemy-soldier.glb.js';
import rifleData from '../../lib/models/rifle.glb.js';
import { MAPS, ENEMIES, PLAYER, WEAPONS, COLORS } from '../../config/game.config.js';


const SKY_URL = 'assets/sky.jpg';
const TEX = { crate: 'assets/tex/crate.webp', metal: 'assets/tex/metal.webp', concrete: 'assets/tex/concrete.webp' };

export function createRenderer(canvas) {
  const stage = createStage({ canvas, clearColor: COLORS.bg, fov: PLAYER.hipFov, near: 0.08, far: 400 });
  const { renderer, scene, camera } = stage;
  camera.rotation.order = 'YXZ';

  const loader = new THREE.TextureLoader();
  const sun = addLights(scene, { sky: 0x4a5a6e, ground: 0x333a44, sun: 0xffd2a8, intensity: 1.8, sunPos: [25, 45, 18] });
  scene.add(new THREE.AmbientLight(0x5a6470, 1.7));
  addFog(scene, 0x1c232d, 34, 150);

  // 天空：优先 AI 天空图，失败/未到位回退程序化渐变（夜空+地平线余烬）
  const gradientSky = () => {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 512;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0b0e1a');
    grad.addColorStop(0.5, '#1a2230');
    grad.addColorStop(0.8, '#2a3340');
    grad.addColorStop(1, '#8a4a24');
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  scene.background = gradientSky();
  loader.load(SKY_URL, (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
  }, undefined, () => { /* 保持渐变回退 */ });

  const mapGroup = new THREE.Group();
  scene.add(mapGroup);

  // 标题页装饰：几个站立的敌人剪影，给标题画面提供可辨认的「目标」剪影
  const titleDeco = new THREE.Group();
  {
    const spots = [[-12, -10], [12, -10], [-13, 7], [13, 7], [-10, 13]];
    const kinds = ['rusher', 'shooter', 'exploder', 'rusher', 'shooter'];
    spots.forEach(([x, z], i) => {
      const base = ENEMIES[kinds[i]];
      const g = new THREE.Group();
      let body;
      if (kinds[i] === 'rusher') body = new THREE.Mesh(new THREE.ConeGeometry(base.radius * 1.4, base.height, 6), lambert(base.color, { emissive: base.color, emissiveIntensity: 0.55 }));
      else if (kinds[i] === 'shooter') body = new THREE.Mesh(new THREE.BoxGeometry(base.radius * 1.6, base.height, base.radius * 1.6), lambert(base.color, { emissive: base.color, emissiveIntensity: 0.55 }));
      else body = new THREE.Mesh(new THREE.SphereGeometry(base.radius * 1.5, 12, 10), lambert(base.color, { emissive: base.color, emissiveIntensity: 0.9 }));
      body.position.y = base.height / 2;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(base.radius * 0.62, 10, 8), lambert(base.color, { emissive: base.color, emissiveIntensity: 0.4 }));
      head.position.y = base.height - base.radius * 0.5;
      g.add(head);
      // 地面橙色标记环，让标题里的敌人剪影更明确是「目标」
      const ring = new THREE.Mesh(new THREE.CircleGeometry(base.radius * 2.4, 24), new THREE.MeshBasicMaterial({ color: 0xff6b35, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      g.add(ring);
      g.scale.setScalar(1.25);
      g.position.set(x, 0, z);
      titleDeco.add(g);
    });
  }
  scene.add(titleDeco);

  const gunGroup = new THREE.Group();
  camera.add(gunGroup);
  scene.add(camera);
  gunGroup.position.set(0.34, -0.32, -0.62);
  gunGroup.scale.setScalar(1.7);

  const muzzleLight = new THREE.PointLight(0xffb27a, 0, 9, 2);
  gunGroup.add(muzzleLight);

  // ---------------------------------------------------------------- 地图
  let builtMap = -1;
  const texCache = {};
  // 按几何尺寸设 repeat，tile ≈ (tx, ty) 世界单位；贴图未到位时返回纯色材质
  const rep = (w, h, tx, ty) => [Math.max(1, Math.round(w / tx)), Math.max(1, Math.round(h / ty))];
  function matFor(color, key, repX = 1, repY = 1) {
    const m = lambert(color);
    const t = texCache[key];
    if (t) {
      const c = t.clone();
      c.repeat.set(Math.max(1, repX), Math.max(1, repY));
      c.needsUpdate = true;
      m.map = c;
    }
    return m;
  }
  // 预加载贴图一次；到位后重建当前图，用纹理替换纯色
  for (const [key, url] of Object.entries(TEX)) {
    loader.load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      texCache[key] = t;
      if (builtMap >= 0) { const m = builtMap; builtMap = -1; buildMap(m); }
    }, undefined, () => {});
  }

  function buildMap(mapIndex) {
    if (mapIndex === builtMap) return;
    builtMap = mapIndex;
    mapGroup.clear();
    const map = MAPS[mapIndex];
    const size = map.size;
    const [frx, fry] = rep(size * 2, size * 2, 4, 4);
    const floor = matFor(map.floor, 'concrete', frx, fry);

    // 地面
    const g = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), floor);
    g.rotation.x = -Math.PI / 2;
    mapGroup.add(g);

    // 四周墙（每面按自身尺寸设 repeat，避免拉伸）
    const wallH = map.wallH;
    const walls = [
      [0, wallH / 2, -size, size * 2, wallH, 0.4, 0],
      [0, wallH / 2, size, size * 2, wallH, 0.4, 0],
      [-size, wallH / 2, 0, 0.4, wallH, size * 2, 0],
      [size, wallH / 2, 0, 0.4, wallH, size * 2, 0],
    ];
    for (const [x, y, z, w, h, d] of walls) {
      const m = box(w, h, d, map.wall, {});
      const span = Math.max(w, d); // 长边为墙面横向跨度，避免薄墙贴图拉伸
      const [wx, wy] = rep(span, h, 4, 2);
      m.material = matFor(map.wall, 'metal', wx, wy);
      m.position.set(x, y, z);
      mapGroup.add(m);
    }

    // 顶部发光条（地图辨识色，沿四周墙顶，避免横穿画面中央）
    const strips = [
      [0, wallH - 0.15, -size, size * 2, 0.08, 0.12],
      [0, wallH - 0.15, size, size * 2, 0.08, 0.12],
      [-size, wallH - 0.15, 0, 0.12, 0.08, size * 2],
      [size, wallH - 0.15, 0, 0.12, 0.08, size * 2],
    ];
    for (const [x, y, z, w, h, d] of strips) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: map.accent, toneMapped: false }));
      strip.position.set(x, y, z);
      mapGroup.add(strip);
    }

    // 掩体（高掩体=金属墙，矮掩体=木箱）
    for (const ob of map.obstacles) {
      const m = box(ob.w, ob.h, ob.d, 0x3a414b, {});
      if (ob.h > 2) {
        const [wx, wy] = rep(ob.w, ob.h, 4, 2);
        m.material = matFor(map.wall, 'metal', wx, wy);
      } else {
        const [cx, cy] = rep(ob.w, ob.h, 2.4, 2.4);
        m.material = matFor(0x6b7a5c, 'crate', cx, cy);
      }
      m.position.set(ob.x, ob.h / 2, ob.z);
      mapGroup.add(m);
    }
  }

  // ---------------------------------------------------------------- 敌人
  const enemyMeshes = new Map(); // id -> { group, kind, deathT }
  function enemyMeshFor(e) {
    let em = enemyMeshes.get(e.id);
    if (!em) {
      const group = new THREE.Group();
      const base = ENEMIES[e.kind];
      let body;
      if (e.kind === 'rusher') body = new THREE.Mesh(new THREE.ConeGeometry(base.radius * 1.4, base.height, 6), lambert(base.color, { emissive: base.color, emissiveIntensity: 0.5 }));
      else if (e.kind === 'shooter') body = new THREE.Mesh(new THREE.BoxGeometry(base.radius * 1.6, base.height, base.radius * 1.6), lambert(base.color, { emissive: base.color, emissiveIntensity: 0.5 }));
      else if (e.kind === 'exploder') body = new THREE.Mesh(new THREE.SphereGeometry(base.radius * 1.5, 12, 10), lambert(base.color, { emissive: base.color, emissiveIntensity: 0.9 }));
      else body = new THREE.Mesh(new THREE.BoxGeometry(base.radius * 2.2, base.height, base.radius * 2.2), lambert(base.color, { emissive: base.color, emissiveIntensity: 0.5 }));
      body.position.y = base.height / 2;
      group.add(body);
      // 头（爆头区视觉提示，发光便于辨认）
      const head = new THREE.Mesh(new THREE.SphereGeometry(base.radius * 0.62, 10, 8), lambert(base.color, { emissive: base.color, emissiveIntensity: 0.35 }));
      head.position.y = base.height - base.radius * 0.5;
      group.add(head);
      // 人形敌兵换 AI GLB 真模型（自爆兵保留球体剪影），按种类着色
      if (e.kind !== 'exploder') {
        loadModelData(soldierData, { targetLen: base.height, forward: '+z', key: 'soldier' }).then((model) => {
          model.traverse((o) => {
            if (o.isMesh && o.material) {
              o.material = o.material.clone();
              o.material.color = new THREE.Color(base.color).lerp(new THREE.Color(0xffffff), 0.4);
              o.material.metalness = Math.max(o.material.metalness ?? 0, 0.25);
              o.material.roughness = Math.min(o.material.roughness ?? 0.6, 0.6);
            }
          });
          group.remove(body); group.remove(head);
          group.add(model);
        }).catch(() => {});
      }
      em = { group, kind: e.kind, deathT: -1, baseH: base.height };
      enemyMeshes.set(e.id, em);
      mapGroup.add(group);
    }
    return em;
  }

  function syncEnemies(sim) {
    const seen = new Set();
    for (const e of sim.enemies) {
      seen.add(e.id);
      const em = enemyMeshFor(e);
      if (e.hp > 0) {
        em.deathT = -1;
        em.group.rotation.set(0, 0, 0);
        em.group.position.set(e.x, 0, e.z);
        em.group.rotation.y = e.yaw;
        em.group.scale.setScalar(1);
        em.group.visible = true;
      } else {
        if (em.deathT < 0) em.deathT = 0;
        em.deathT += 1 / 60;
        const t = Math.min(1, em.deathT / 0.7);
        em.group.rotation.x = -t * (Math.PI / 2);
        em.group.position.y = -t * 0.2;
        em.group.scale.setScalar(1 - t * 0.6);
        if (t >= 1) em.group.visible = false;
      }
    }
    for (const [id, em] of enemyMeshes) {
      if (!seen.has(id)) { mapGroup.remove(em.group); enemyMeshes.delete(id); }
    }
  }

  // ---------------------------------------------------------------- 子弹/特效
  const tracers = [];
  function tracer() {
    let m = tracers.find((x) => !x.active);
    if (!m) {
      const geo = new THREE.BoxGeometry(0.05, 0.05, 1.6);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffc27a, toneMapped: false, transparent: true, opacity: 0.95 });
      m = new THREE.Mesh(geo, mat);
      tracers.push(m);
      scene.add(m);
    }
    m.active = true;
    m.visible = true;
    return m;
  }
  function syncBullets(sim) {
    for (const m of tracers) m.active = false;
    for (const b of sim.bullets) {
      const m = tracer();
      m.material.color.set(0xffc27a);
      m.position.set(b.x, b.y, b.z);
      m.lookAt(b.x + b.dx, b.y + b.dy, b.z + b.dz);
      m.scale.set(1, 1, clamp(b.speed / 60, 0.8, 2));
    }
    for (const b of sim.enemyBullets) {
      const m = tracer();
      m.material.color.set(0xff6b35);
      m.position.set(b.x, b.y, b.z);
      m.lookAt(b.x + b.dx, b.y + b.dy, b.z + b.dz);
      m.scale.set(0.6, 0.6, 0.6);
    }
    for (const m of tracers) m.visible = m.active;
  }

  const explosions = [];
  function spawnExplosion(x, y, z, color) {
    let e = explosions.find((x) => !x.active);
    if (!e) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), new THREE.MeshBasicMaterial({ color: 0xff9a3c, toneMapped: false, transparent: true, opacity: 0.9 }));
      e = { mesh: m, t: 0 };
      explosions.push(e);
      scene.add(m);
    }
    e.active = true; e.t = 0;
    e.mesh.material.color.set(color);
    e.mesh.position.set(x, y, z);
  }
  function syncExplosions(dt) {
    for (const e of explosions) {
      if (!e.active) continue;
      e.t += dt;
      const k = e.t / 0.4;
      if (k >= 1) { e.active = false; e.mesh.visible = false; continue; }
      e.mesh.visible = true;
      const s = 0.5 + k * 4;
      e.mesh.scale.setScalar(s);
      e.mesh.material.opacity = 0.9 * (1 - k);
    }
  }

  // ---------------------------------------------------------------- 枪械视角
  let gunBuilt = -1;
  function buildGun(weapon) {
    if (gunBuilt === weapon) return;
    gunBuilt = weapon;
    gunGroup.clear();
    gunGroup.add(muzzleLight);
    const w = WEAPONS[weapon];
    // 枪械用 MeshBasicMaterial（无光照）保证任何亮度下都清晰可见
    const gm = (wd, h, d, color) => new THREE.Mesh(new THREE.BoxGeometry(wd, h, d), new THREE.MeshBasicMaterial({ color }));
    const steel = 0xb8c4d0, dark = 0x3a4148, accent = 0xff6b35;
    if (weapon === 'rifle') {
      // AI 高精度步枪视角模型（PBR），加载完成前回退方块
      const fallback = new THREE.Group();
      fallback.add(place(gm(0.09, 0.11, 0.85, steel), 0, 0, -0.1));
      fallback.add(place(gm(0.05, 0.05, 0.35, dark), 0, 0.05, -0.55));
      fallback.add(place(gm(0.08, 0.22, 0.12, dark), 0, -0.16, 0.15));
      gunGroup.add(fallback);
      loadModelData(rifleData, { targetLen: 0.8, forward: '+x', key: 'rifle' }).then((m) => {
        m.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.metalness = Math.max(o.material.metalness ?? 0, 0.4); o.material.roughness = Math.min(o.material.roughness ?? 0.5, 0.5); } });
        m.position.set(0, -0.18, -0.1);
        gunGroup.remove(fallback);
        gunGroup.add(m);
      }).catch(() => {});
    } else if (weapon === 'shotgun') {
      gunGroup.add(place(gm(0.11, 0.12, 0.7, steel), 0, 0, -0.05));
      gunGroup.add(place(gm(0.06, 0.06, 0.45, dark), 0, 0.05, -0.5));
      gunGroup.add(place(gm(0.09, 0.24, 0.16, 0x5a4632), 0, -0.17, 0.18));
      gunGroup.add(place(gm(0.08, 0.08, 0.06, accent), 0, 0, -0.76));
    } else {
      gunGroup.add(place(gm(0.08, 0.14, 0.3, steel), 0, 0, -0.05));
      gunGroup.add(place(gm(0.05, 0.05, 0.2, dark), 0, 0.06, -0.24));
      gunGroup.add(place(gm(0.08, 0.16, 0.1, dark), 0, -0.14, 0.1));
      gunGroup.add(place(gm(0.06, 0.06, 0.06, accent), 0, 0, -0.32));
    }
  }
  function place(m, x, y, z) { m.position.set(x, y, z); return m; }

  // ---------------------------------------------------------------- 主渲染
  let titleCam = 0;
  function renderTitle(dt) {
    titleCam += dt * 0.1;
    buildMap(0);
    titleDeco.visible = true;
    const s = MAPS[0].size;
    camera.fov = 60; camera.updateProjectionMatrix();
    camera.position.set(Math.sin(titleCam) * s * 1.1, s * 0.7, Math.cos(titleCam) * s * 1.1);
    camera.lookAt(0, 0, 0);
    syncExplosions(dt);
    renderer.render(scene, camera);
  }

  function render(sim, dt = 1 / 60) {
    if (!sim) { renderTitle(dt); return; }
    const p = sim.player;
    titleDeco.visible = false;
    buildMap(sim.mapIndex);
    buildGun(p.weapon);

    // 相机
    const targetFov = sim.aiming ? PLAYER.aimFov : PLAYER.hipFov;
    camera.fov = lerp(camera.fov, targetFov, Math.min(1, dt * 12));
    camera.updateProjectionMatrix();
    camera.position.set(p.x, PLAYER.eyeY, p.z);
    camera.rotation.set(0, 0, 0);
    camera.rotation.y = p.yaw;
    camera.rotation.x = p.pitch;

    // 枪械后坐力
    const rec = sim.recoil;
    gunGroup.position.set(0.34, -0.32, -0.62 + rec * 1.4);
    gunGroup.rotation.x = -rec * 2.2;
    gunGroup.rotation.y = sim.muzzle > 0 ? 0.02 : 0;
    muzzleLight.intensity = sim.muzzle > 0 ? 2.4 : 0;

    syncEnemies(sim);
    syncBullets(sim);
    syncExplosions(dt);

    renderer.render(scene, camera);
  }

  function onEvent(ev) {
    if (ev.type === 'explosion') spawnExplosion(ev.x, ev.y ?? 1.2, ev.z, 0xff9a3c);
    else if (ev.type === 'headshot') spawnExplosion(ev.x, ev.y, ev.z, 0xffe08a);
    else if (ev.type === 'kill' || ev.type === 'impact') spawnExplosion(ev.x, ev.y ?? 1.2, ev.z, 0x8a6a5a);
  }

  return { render, onEvent, scene, camera, renderer, resize: stage.resize };
}
