// src/render/index.js — 3D 渲染：霓虹球场 + 火箭车 + 球 + 粒子 + 广播机位。
import * as THREE from 'three';
import { RoomEnvironment } from '../../lib/RoomEnvironment.js';
import { ARENA, BALL, COLORS, CAMERA } from '../../config/game.config.js';
import { buildArena } from './arena.js';
import { buildCarMesh, buildBallMesh, buildPickupMesh } from './car.js';
import { createFX } from './fx.js';

const CAR_COLORS = [
  { body: COLORS.green, accent: 0x86efac },  // 玩家
  { body: COLORS.blue, accent: 0x7dd3fc },   // 队友
  { body: COLORS.orange, accent: 0xfdba74 }, // 对手
  { body: 0xf87171, accent: 0xfca5a5 },      // 对手
];

export function createRenderer(canvas) {
  const probe = document.createElement('canvas').getContext('webgl');
  const dbgInfo = probe && probe.getExtension('debug_renderer_info');
  const software = /swiftshader|llvmpipe|softpipe|software/i.test(String(dbgInfo ? probe.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : ''));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !software, powerPreference: 'high-performance' });
  renderer.setPixelRatio(software ? 0.66 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !software;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  { const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; }
  const camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 600);
  buildArena(scene, renderer);

  const fx = createFX(scene);

  // 车辆 / 球 / 拾取点网格
  const carMeshes = CAR_COLORS.map((c, i) => buildCarMesh(c.body, c.accent, i === 0));
  for (const m of carMeshes) scene.add(m.group);
  const ballMesh = buildBallMesh(COLORS.ball);
  scene.add(ballMesh);
  const pickupMeshes = [];
  const pickupColor = COLORS.green;

  // 相机状态
  const look = new THREE.Vector3(0, 0, CAMERA.lookZ);
  let titleT = 0, shake = 0, lastGoal = null, lastGoalT = 0;

  function syncCar(i, car) {
    const m = carMeshes[i];
    m.group.position.set(car.x, car.y, car.z);
    m.group.rotation.y = -car.heading;
    m.setFlame(car.boostOn && !car.demoed);
    m.spinWheels(1 / 60, car.speed);
    // 翻车：打转 + 侧倾
    if (car.demoed) {
      m.group.rotation.z += 0.2;
      m.group.rotation.x = Math.sin(car.demoT * 20) * 0.5;
    } else {
      m.group.rotation.z = 0;
      m.group.rotation.x = 0;
    }
  }

  function syncPickups(run) {
    while (pickupMeshes.length < run.pickups.length) {
      const m = buildPickupMesh(pickupColor);
      scene.add(m);
      pickupMeshes.push(m);
    }
    run.pickups.forEach((p, i) => {
      const m = pickupMeshes[i];
      m.visible = p.active;
      m.position.set(p.x, 0.9 + Math.sin(run.time * 3 + i) * 0.15, p.z);
      m.userData.ring.rotation.z += 0.05;
    });
    for (let i = run.pickups.length; i < pickupMeshes.length; i++) pickupMeshes[i].visible = false;
  }

  function renderTitle(dt) {
    titleT += dt;
    const a = titleT * CAMERA.titleSpeed;
    const r = CAMERA.titleR;
    camera.position.set(Math.sin(a) * r, CAMERA.y * 0.55, Math.cos(a) * r + 8);
    camera.lookAt(0, 0, 0);
    camera.fov = 55;
    camera.updateProjectionMatrix();
  }

  function renderGame(run, dt) {
    const b = run.ball;
    // 球火尾
    const bSpeed = Math.hypot(b.vx, b.vz);
    if (bSpeed > 12) fx.trail(b.x, b.y + BALL.R, b.z, bSpeed > 26 ? 0xfb923c : 0x4ade80, bSpeed);

    for (let i = 0; i < run.cars.length; i++) syncCar(i, run.cars[i]);
    ballMesh.position.set(b.x, b.y + BALL.R, b.z);
    syncPickups(run);

    // 广播机位：跟随球，回放时紧盯球
    const kx = run.phase === 'goalReplay' ? 1.0 : CAMERA.followX;
    look.x += (b.x * kx - look.x) * Math.min(1, 4 * dt);
    look.z += (b.z * CAMERA.followZ + CAMERA.lookZ - look.z) * Math.min(1, 4 * dt);
    let cx = 0, cy = CAMERA.y, cz = CAMERA.z;
    if (shake > 0.01) {
      cx += (Math.random() - 0.5) * shake;
      cy += (Math.random() - 0.5) * shake * 0.5;
      shake *= Math.pow(0.02, dt);
    }
    camera.position.set(cx, cy, cz);
    camera.lookAt(look.x, 0, look.z);
    camera.fov = 52;
    camera.updateProjectionMatrix();
  }

  let currentRun = null;
  function render(run, dt) {
    dt = dt || 1 / 60;
    currentRun = run;
    if (run) renderGame(run, dt); else renderTitle(dt);
    // 进球闪爆逐渐消失
    if (lastGoal && lastGoalT > 0) {
      lastGoalT -= dt;
      if (lastGoalT <= 0) lastGoal = null;
    }
    fx.tick(dt);
    renderer.render(scene, camera);
  }

  function onEvent(ev) {
    if (!ev) return;
    if (ev.type === 'hit') {
      const x = currentRun ? currentRun.ball.x : 0, z = currentRun ? currentRun.ball.z : 0;
      fx.burst(x, 1, z, 0x4ade80, 10, 3, 0.4);
    } else if (ev.type === 'goal') {
      shake = 0.8;
      fx.burst(ARENA.HX + 2, 2, 0, 0x4ade80, 40, 6, 0.9);
    } else if (ev.type === 'concede') {
      shake = 0.8;
      fx.burst(-ARENA.HX - 2, 2, 0, 0xfb923c, 40, 6, 0.9);
    } else if (ev.type === 'demo') {
      shake = 0.5;
    } else if (ev.type === 'demoed') {
      shake = 0.7;
    } else if (ev.type === 'pickup') {
      fx.burst(ev.x || 0, 1.5, ev.z || 0, 0x38bdf8, 16, 3, 0.5);
    }
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    scene.traverse((o) => {
      if (o.isMesh || o.isPoints) {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m?.dispose?.());
      }
    });
    renderer.dispose();
  }

  return { render, onEvent, resize, dispose };
}
