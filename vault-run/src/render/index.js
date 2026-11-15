// src/render/index.js — 3D 渲染：低多边形城市屋顶 + 障碍 + 第一人称相机 + 手撑 + 粒子。
// 契约：createRenderer(canvas) → { render(run, dt), onEvent(ev), resize(w, h), dispose() }
import * as THREE from '../../lib/three.module.js';
import { box, lambert, addLights, addFog, clamp, lerp } from '../core/base3d.js';
import { createCourse, cranePlatformX } from '../game/course.js';
import { CAMERA, PALETTE, RUN } from '../../config/game.config.js';
import { loadModelData } from '../../lib/model-loader-data.js';
import { RoomEnvironment } from '../../lib/RoomEnvironment.js';
import vaultWallData from '../../lib/models/vault-wall.glb.js';
import slidePipeData from '../../lib/models/slide-pipe.glb.js';
import cranePlatformData from '../../lib/models/crane-platform.glb.js';

const DEG = Math.PI / 180;

// 程序化渐变天空（sky.jpg 加载失败时的兜底背景，不白屏不报错）
function gradientSky(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, `#${top.toString(16).padStart(6, '0')}`);
  grad.addColorStop(1, `#${bottom.toString(16).padStart(6, '0')}`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createRenderer(canvas) {
  // 软件渲染探针（headless 无 GPU 时低画质起步，避免首帧编译阻塞）
  const probe = document.createElement('canvas').getContext('webgl');
  const dbg = probe && probe.getExtension('debug_renderer_info');
  const software = /swiftshader|llvmpipe|softpipe|software/i.test(String(dbg ? probe.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ''));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !software, powerPreference: 'high-performance' });
  renderer.setPixelRatio(software ? 0.66 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(1280, 720);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // PBR 环境反射（GLB 金属/锈面质感来源）
  { const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose(); }
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 16 / 9, 0.1, 3000);

  // 天空（assets/sky.jpg 全景；失败回退程序化渐变，不白屏不报错）
  const skyFallback = gradientSky(PALETTE.sky, PALETTE.fog);
  scene.background = skyFallback;
  addFog(scene, PALETTE.fog, 60, 420);
  new THREE.TextureLoader().load('assets/sky.jpg', (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
  }, undefined, () => { scene.background = skyFallback; });

  const sun = addLights(scene, { sky: 0x9db8ff, ground: 0x4a3a2c, sun: PALETTE.sun, intensity: 1.6, sunPos: [60, 90, 200] });
  // 主光软阴影：阴影相机随玩家平移（2m 网格吸附防抖动），覆盖近处障碍即可
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
  sun.shadow.camera.near = 20; sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.0004;
  scene.add(sun.target);

  // 贴图（缺失回退纯色；同图只加载一次，每 mesh 克隆并按几何尺寸铺 tile）
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const ROOF_URL = 'assets/tex/roof.webp';
  const BRICK_URL = 'assets/tex/brick.webp';
  const ROOF_TILE = 4;     // 混凝土：每 4m 一块
  const BRICK_W = 2;       // 砖墙：水平每 2m 一块
  const BRICK_H = 0.6;     // 砖层高 0.6m
  const texOnce = {};
  const loadOnce = (url) => texOnce[url] || (texOnce[url] = new Promise((ok) => {
    loader.load(url, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
      ok(t);
    }, undefined, () => ok(null));
  }));
  const tileMat = (color, url, rx, ry) => {
    const mat = lambert(color);
    loadOnce(url).then((base) => {
      if (!base) return;
      const t = base.clone();
      t.repeat.set(rx, ry);
      mat.map = t;
      mat.needsUpdate = true;
    });
    return mat;
  };

  // ---------------------------------------------------------------- 世界
  let built = false;
  const staticMeshes = [];      // 屋顶/装饰/墙/管道
  const craneMeshes = [];       // 吊臂移动平台
  const wallrunMeshes = [];     // 蹬墙侧墙
  const hands = new THREE.Group();
  let handL, handR;

  function solidIntervals(course) {
    // 屋顶实心区间 = 全程去掉 wallrun/crane 缺口
    const gaps = course.obstacles.filter((o) => o.type === 'wallrun' || o.type === 'crane')
      .map((o) => [o.z, o.z + o.gapW]);
    const iv = [];
    let z = 0;
    for (const [a, b] of gaps) { if (a > z) iv.push([z, a]); z = b; }
    if (z < course.finishZ) iv.push([z, course.finishZ]);
    return iv;
  }

  function ensureWorld() {
    if (built) return;
    built = true;
    const course = createCourse(() => 0.5);

    // 屋顶实心块
    for (const [a, b] of solidIntervals(course)) {
      const mid = (a + b) / 2;
      const hw = course.halfWidthAt(mid);
      const m = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.5, b - a), tileMat(PALETTE.concrete, ROOF_URL, (hw * 2) / ROOF_TILE, (b - a) / ROOF_TILE));
      m.position.set(0, -0.25, mid);
      m.receiveShadow = true;
      scene.add(m); staticMeshes.push(m);
    }

    // 装饰：两侧低多边形楼群 + 水箱 + 霓虹剪影
    const rng = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    for (let z = 30; z < RUN.finishZ; z += 26) {
      for (const side of [-1, 1]) {
        const h = 6 + rng() * 16;
        const w = 6 + rng() * 8;
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 7), lambert(rng() < 0.5 ? PALETTE.brick : 0x4a4458));
        b.position.set(side * (course.halfWidthAt(z) + w / 2 + 3 + rng() * 4), h / 2 - 4, z + rng() * 8);
        scene.add(b); staticMeshes.push(b);
        if (rng() < 0.4) {
          const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 3.2, 8), lambert(0x5b5666));
          tank.position.set(b.position.x + side * rng() * 2, h - 2, b.position.z);
          scene.add(tank); staticMeshes.push(tank);
        }
      }
      if (rng() < 0.25) {
        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 2.4), lambert(PALETTE.accent, { emissive: PALETTE.accent, emissiveIntensity: 0.5 }));
        sign.position.set((rng() < 0.5 ? -1 : 1) * (course.halfWidthAt(z) + 8), 5, z + 4);
        scene.add(sign); staticMeshes.push(sign);
      }
    }

    // 障碍：矮墙 / 管道 / 蹬墙侧墙 / 吊臂平台
    for (const ob of course.obstacles) {
      const hw = course.halfWidthAt(ob.z);
      if (ob.type === 'vault') {
        // 翻越矮墙：程序化砖墙作 fallback，异步换 GLB 石墙（按宽平铺，高/深对齐原网格）
        const pivot = new THREE.Group();
        pivot.position.set(0, 0, ob.z);
        const m = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, ob.h, 0.5), tileMat(PALETTE.brick, BRICK_URL, (hw * 2) / BRICK_W, ob.h / BRICK_H));
        m.position.set(0, ob.h / 2, 0);
        m.castShadow = true; m.receiveShadow = true;
        pivot.add(m); scene.add(pivot); staticMeshes.push(m);
        loadModelData(vaultWallData, { targetLen: 2.4, forward: '+z', key: 'vault-wall' }).then((model) => {
          const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
          const W = hw * 2, n = Math.max(1, Math.round(W / 2.4)), segW = W / n;
          pivot.remove(m);
          for (let i = 0; i < n; i++) {
            const seg = i === 0 ? model : model.clone(true);
            seg.scale.set(segW / size.x, ob.h / size.y, 0.5 / size.z);
            seg.position.set(-W / 2 + segW * (i + 0.5), 0, 0);
            pivot.add(seg);
          }
        }).catch(() => {});
      } else if (ob.type === 'slide') {
        // 滑铲横管：程序化管+支腿作 fallback，异步换 GLB 锈管（按宽平铺，保持管径/高度）
        const pivot = new THREE.Group();
        pivot.position.set(0, 0, ob.z);
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, hw * 2, 12), lambert(0x35303f));
        pipe.rotation.z = Math.PI / 2;
        pipe.position.set(0, ob.h, 0);
        pipe.castShadow = true;
        pivot.add(pipe); staticMeshes.push(pipe);
        const legs = [];
        for (const side of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, ob.h, 0.3), lambert(0x35303f));
          leg.position.set(side * hw, ob.h / 2, 0);
          leg.castShadow = true;
          pivot.add(leg); staticMeshes.push(leg); legs.push(leg);
        }
        scene.add(pivot);
        loadModelData(slidePipeData, { targetLen: 3, forward: '+z', key: 'slide-pipe' }).then((model) => {
          const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
          const W = hw * 2, n = Math.max(1, Math.round(W / 3)), segW = W / n;
          pivot.remove(pipe); legs.forEach((l) => pivot.remove(l));
          for (let i = 0; i < n; i++) {
            const seg = i === 0 ? model : model.clone(true);
            seg.scale.set(segW / size.x, 1, 1);
            seg.position.set(-W / 2 + segW * (i + 0.5), 0, 0);
            pivot.add(seg);
          }
        }).catch(() => {});
      } else if (ob.type === 'wallrun') {
        for (const side of [-1, 1]) {
          const wall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, ob.gapW), tileMat(PALETTE.brick, BRICK_URL, ob.gapW / BRICK_W, 5 / BRICK_H));
          wall.position.set(side * hw, 2.5, ob.z + ob.gapW / 2);
          scene.add(wall); wallrunMeshes.push(wall); staticMeshes.push(wall);
        }
      } else if (ob.type === 'crane') {
        // 吊臂移动平台：枢轴 Group 保留 craneMeshes 横移驱动；GLB 甲板顶对齐原平台顶 y≈0.25
        const pivot = new THREE.Group();
        pivot.position.set(0, 0, ob.z + ob.gapW / 2);
        const plat = new THREE.Mesh(new THREE.BoxGeometry(ob.platformHalf * 2, 0.5, 6), lambert(PALETTE.accent));
        plat.castShadow = true; plat.receiveShadow = true;
        pivot.add(plat); scene.add(pivot);
        craneMeshes.push({ mesh: pivot, ob });
        loadModelData(cranePlatformData, { targetLen: 3, forward: '+z', key: 'crane-platform' }).then((model) => {
          const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
          pivot.remove(plat);
          model.scale.set((ob.platformHalf * 2) / size.x, 1, 1);
          model.position.y = -0.2;
          pivot.add(model);
        }).catch(() => {});
      }
    }

    // 第一人称手（翻越时手撑）
    handL = box(0.16, 0.16, 0.5, 0x2a2438);
    handR = box(0.16, 0.16, 0.5, 0x2a2438);
    hands.add(handL, handR);
    hands.visible = false;
    scene.add(hands);
  }

  // ---------------------------------------------------------------- 粒子
  const particles = [];
  function spawnDust(x, y, z, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const m = box(0.14, 0.14, 0.14, color);
      m.position.set(x, y, z);
      scene.add(m);
      particles.push({ m, vx: (Math.random() - 0.5) * 4, vy: Math.random() * 2.5, vz: (Math.random() - 0.5) * 4, life: 0.5 + Math.random() * 0.3 });
    }
  }
  function tickFx(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.vy -= 6 * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      const k = Math.max(0, p.life / 0.8);
      p.m.scale.setScalar(0.3 + k);
      if (p.life <= 0) { scene.remove(p.m); particles.splice(i, 1); }
    }
  }

  // ---------------------------------------------------------------- 相机
  let titleT = 0, shake = 0;

  function renderTitle(dt) {
    titleT += dt;
    const a = titleT * 0.12;
    camera.position.set(Math.sin(a) * 14, 6 + Math.sin(titleT * 0.3) * 0.5, 40 + Math.cos(a) * 14);
    camera.lookAt(0, 2, 90);
    camera.fov = 62;
    camera.updateProjectionMatrix();
    sun.position.set(60, 90, -80);
    sun.target.position.set(0, 0, 60);
  }

  function renderGame(run, dt) {
    const p = run.player;
    const sprinting = run.stunT <= 0 && run.stamina > 0;
    const speed01 = clamp((run.speed - RUN.speedBase) / (RUN.speedMax * RUN.sprintMul - RUN.speedBase), 0, 1);
    const bob = Math.sin(run.time * CAMERA.bobSpeed) * CAMERA.bobAmp * speed01;

    // 吊臂平台随 run 移动（枢轴 Group 横移，GLB 子节点随之移动）
    for (const c of craneMeshes) {
      c.mesh.position.x = cranePlatformX(c.ob, run.time);
    }

    // 主光阴影相机随玩家平移（2m 网格吸附，避免阴影抖动）；光从玩家后上方打来，照亮障碍可见面
    const sx = Math.round(p.x / 2) * 2, sz = Math.round(p.z / 2) * 2;
    sun.position.set(sx + 60, 90, sz - 140);
    sun.target.position.set(sx, 0, sz);

    // 手撑：翻越时显示并下压
    hands.visible = !!p.acting && p.acting.type === 'vault';
    if (hands.visible) {
      const k = p.acting.t / p.acting.dur;
      const push = Math.sin(clamp(k, 0, 1) * Math.PI);
      handL.position.set(-0.24, -0.42 - push * 0.28, 0.55);
      handR.position.set(0.24, -0.42 - push * 0.28, 0.55);
      hands.position.set(p.x, CAMERA.eye + p.y, p.z);
    }

    // 相机眼高 / FOV / 侧倾
    let eye = CAMERA.eye + bob + p.y;
    let fov = CAMERA.fov + speed01 * 6;
    let roll = 0, lookDip = 0;
    if (p.acting) {
      if (p.acting.type === 'vault') { eye = CAMERA.eye + p.y; fov = CAMERA.fovVault; lookDip = Math.sin(clamp(p.acting.t / p.acting.dur, 0, 1) * Math.PI) * 0.45; }
      else if (p.acting.type === 'slide') { eye = CAMERA.eyeSlide; fov = CAMERA.fovSlide; }
      else if (p.acting.type === 'wallrun') { roll = CAMERA.tiltWallrun * DEG; fov = CAMERA.fovVault; }
    }
    if (sprinting && run.stunT <= 0) fov = CAMERA.fovSprint;

    if (shake > 0.01) {
      eye += (Math.random() - 0.5) * shake;
      roll += (Math.random() - 0.5) * shake * 8 * DEG;
      shake *= Math.pow(0.02, dt);
    }

    camera.position.set(p.x, eye, p.z);
    camera.lookAt(p.x, eye - lookDip, p.z + 20);
    if (roll) camera.rotateZ(roll);
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 8);
    camera.updateProjectionMatrix();
  }

  function render(run, dt) {
    ensureWorld();
    dt = dt || 1 / 60;
    if (run && run.phase === 'running') renderGame(run, dt); else renderTitle(dt);
    tickFx(dt);
    renderer.render(scene, camera);
  }

  function onEvent(ev) {
    if (!ev) return;
    if (ev.type === 'vault') spawnDust(0, 0.3, ev.t === undefined ? 0 : 0, 0xd8c9a3, 8);
    if (ev.type === 'slide') spawnDust(0, 0.2, 0, 0xf9c74f, 6);
    if (ev.type === 'hit') shake = Math.max(shake, 0.5);
    if (ev.type === 'fall') shake = Math.max(shake, 0.8);
  }

  function resize(w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    scene.traverse((o) => {
      if (o.isMesh) { o.geometry?.dispose?.(); const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((mm) => mm?.dispose?.()); }
    });
    renderer.dispose();
  }

  return { render, onEvent, resize, dispose };
}
