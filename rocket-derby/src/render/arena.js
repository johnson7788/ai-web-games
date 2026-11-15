// src/render/arena.js — 静态世界：霓虹球场（地面/围栏/边线/中圈/球门/天空）。
import * as THREE from 'three';
import { ARENA, COLORS } from '../../config/game.config.js';

function gradientSky() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#0a0820');
  gr.addColorStop(0.55, '#1e1b3a');
  gr.addColorStop(1, '#2a2350');
  g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildArena(scene, renderer) {
  const { HX, HZ, WALL_H, GOAL_W, GOAL_D, GOAL_H } = ARENA;
  const loader = new THREE.TextureLoader();

  // 天空：贴图回退程序化渐变
  scene.background = gradientSky();
  scene.fog = new THREE.Fog(COLORS.bg, 80, 220);
  loader.load('assets/sky.jpg', (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
  }, undefined, () => { scene.background = gradientSky(); });

  // 地面（turf 贴图回退纯色）
  let floorMat = new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.95, metalness: 0.02 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2 + 6, HZ * 2 + 6), floorMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  loader.load('assets/tex/turf.webp', (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 4);
    t.colorSpace = THREE.SRGBColorSpace;
    floorMat.map = t; floorMat.color = new THREE.Color(0xffffff); floorMat.needsUpdate = true;
  }, undefined, () => {});

  // 围栏（四面，绿色霓虹顶边）
  const trimMat = new THREE.MeshBasicMaterial({ color: COLORS.neon, toneMapped: false });
  const wallSpecs = [];
  function wall(w, h, x, z, ry) {
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.wall, roughness: 0.6, metalness: 0.15 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), mat);
    m.position.set(x, h / 2, z);
    m.rotation.y = ry || 0;
    m.receiveShadow = true;
    scene.add(m);
    wallSpecs.push({ mat, len: w });
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.66), trimMat);
    trim.position.set(x, h - 0.1, z);
    trim.rotation.y = ry || 0;
    scene.add(trim);
    return m;
  }
  // 长边（沿 X 的左右 Z 墙，球门开口在 ±X 墙）
  wall(HX * 2, WALL_H, 0, -HZ, 0);
  wall(HX * 2, WALL_H, 0, HZ, 0);
  // ±X 端墙分段（球门开口处断开，段沿 Z 轴 → 转 90°）
  const segLen = HZ - GOAL_W / 2;
  const segCenter = GOAL_W / 2 + segLen / 2;
  for (const sign of [-1, 1]) {
    wall(segLen, WALL_H, sign * HX, -segCenter, Math.PI / 2);
    wall(segLen, WALL_H, sign * HX, segCenter, Math.PI / 2);
  }

  // 霓虹边线（矩形边框 + 中线 + 中圈）
  const lineMat = new THREE.MeshBasicMaterial({ color: COLORS.neon2, toneMapped: false });
  function strip(w, h, x, z, ry) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), lineMat);
    s.position.set(x, 0.05, z);
    s.rotation.y = ry || 0;
    scene.add(s);
  }
  strip(HX * 2, 0.12, 0, -HZ + 0.3, 0);
  strip(HX * 2, 0.12, 0, HZ - 0.3, 0);
  strip(0.12, HZ * 2, -HX + 0.3, 0, 0);
  strip(0.12, HZ * 2, HX - 0.3, 0, 0);
  // 中线
  strip(0.12, HZ * 2, 0, 0, 0);
  // 中圈
  const circle = new THREE.Mesh(new THREE.RingGeometry(9.5, 9.9, 48), new THREE.MeshBasicMaterial({ color: COLORS.neon, side: THREE.DoubleSide, toneMapped: false }));
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.05;
  scene.add(circle);

  // 围栏贴图（wall.webp，按各墙几何长度重复；缺失回退纯色）
  loader.load('assets/tex/wall.webp', (t) => {
    for (const s of wallSpecs) {
      const c = t.clone();
      c.wrapS = c.wrapT = THREE.RepeatWrapping;
      c.repeat.set(s.len / WALL_H, 1);
      c.colorSpace = THREE.SRGBColorSpace;
      c.needsUpdate = true;
      s.mat.map = c;
      s.mat.color = new THREE.Color(0xffffff);
      s.mat.needsUpdate = true;
    }
  }, undefined, () => {});

  // 球门（含网）
  buildGoals(scene, HX, HZ, GOAL_W, GOAL_D, GOAL_H, trimMat, trimMat);

  // 灯光
  const hemi = new THREE.HemisphereLight(0xb9c4ff, 0x1a1430, 0.85);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(30, 60, 30);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -90; key.shadow.camera.right = 90;
  key.shadow.camera.top = 90; key.shadow.camera.bottom = -90;
  key.shadow.camera.near = 10; key.shadow.camera.far = 200;
  scene.add(key); scene.add(key.target);
  const rim = new THREE.DirectionalLight(COLORS.neon2, 0.9);
  rim.position.set(-40, 30, -20);
  scene.add(rim);

  return { key };
}

function buildGoals(scene, HX, HZ, GOAL_W, GOAL_D, GOAL_H, postMat, wallMat) {
  for (const sign of [-1, 1]) {
    const gx = sign * (HX + 0.3);
    const half = GOAL_W / 2;
    // 立柱
    for (const z of [-half, half]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, GOAL_H, 0.4), postMat);
      post.position.set(sign * HX, GOAL_H / 2, z);
      post.castShadow = true;
      scene.add(post);
    }
    // 横梁
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, GOAL_W + 0.4), postMat);
    bar.position.set(sign * HX, GOAL_H, 0);
    scene.add(bar);
    // 球网（背板 + 两侧）
    const netMat = new THREE.MeshStandardMaterial({ color: 0x22304a, roughness: 0.9, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.2, GOAL_H, GOAL_W), netMat);
    back.position.set(sign * (HX + GOAL_D), GOAL_H / 2, 0);
    scene.add(back);
    for (const z of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(GOAL_D, GOAL_H, 0.2), netMat);
      side.position.set(sign * (HX + GOAL_D / 2), GOAL_H / 2, z * half);
      scene.add(side);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(GOAL_D, 0.2, GOAL_W), netMat);
    roof.position.set(sign * (HX + GOAL_D / 2), GOAL_H, 0);
    scene.add(roof);
    // 球门区域地面标记
    const area = new THREE.Mesh(new THREE.BoxGeometry(GOAL_D, 0.06, GOAL_W + 2), new THREE.MeshBasicMaterial({ color: COLORS.neon2, toneMapped: false }));
    area.position.set(sign * (HX + GOAL_D / 2 - 0.3), 0.03, 0);
    scene.add(area);
  }
}
