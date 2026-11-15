// base3d.js — 3D 批次共享底座（每款游戏复制到 src/core/base3d.js，勿跨目录引用）
// 提供：16:9 letterbox 渲染器 / 60Hz 固定步长 / 键鼠+触屏输入 / 第一人称控制器 / 追踪相机 / 常用几何工厂
// 依赖：lib/three.module.js（vendor，零运行期外链）。物理需要时另引 lib/cannon-es.js。
import * as THREE from '../../lib/three.module.js';
import { RoomEnvironment } from '../../lib/RoomEnvironment.js';

export { THREE };

// ---------- 舞台：1280×720 逻辑视口，letterbox 居中，DPR≤2 ----------
export function createStage({ canvas, clearColor = 0x0b0e1a, fov = 60, near = 0.1, far = 600 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(clearColor);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  { const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; }
  const camera = new THREE.PerspectiveCamera(fov, 16 / 9, near, far);
  camera.position.set(0, 6, 12);
  function resize() {
    const ww = window.innerWidth, wh = window.innerHeight;
    let w = ww, h = ww * 9 / 16;
    if (h > wh) { h = wh; w = wh * 16 / 9; }
    renderer.setSize(Math.round(w), Math.round(h), false);
    canvas.style.width = Math.round(w) + 'px';
    canvas.style.height = Math.round(h) + 'px';
    canvas.style.position = 'absolute';
    canvas.style.left = Math.round((ww - w) / 2) + 'px';
    canvas.style.top = Math.round((wh - h) / 2) + 'px';
  }
  window.addEventListener('resize', resize);
  resize();
  return { renderer, scene, camera, resize, render: () => renderer.render(scene, camera) };
}

// ---------- 60Hz 固定步长循环（掉帧不改判定） ----------
export class FixedLoop {
  constructor(step, render) { this.step = step; this.render = render; this.acc = 0; this.last = 0; this.running = false; this._raf = 0; this.maxSteps = 5; }
  start() {
    if (this.running) return;
    this.running = true; this.last = performance.now();
    const tick = (now) => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000; this.last = now;
      if (dt > 0.25) dt = 0.25;
      this.acc += dt;
      let n = 0;
      while (this.acc >= 1 / 60 && n < this.maxSteps) { this.step(1 / 60); this.acc -= 1 / 60; n++; }
      if (n === this.maxSteps) this.acc = 0;
      this.render(dt);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }
  stop() { this.running = false; cancelAnimationFrame(this._raf); }
}

// ---------- 输入：键盘 held/pressed + 指针锁定鼠标增量 + 触屏摇杆/视角 ----------
export class Input {
  constructor(dom) {
    this.dom = dom; this.held = new Set(); this.pressed = new Set();
    this.mouseDX = 0; this.mouseDY = 0; this.locked = false;
    this.touchMove = { x: 0, y: 0 }; this.touchLook = { x: 0, y: 0 }; this.touchButtons = new Set();
    this._kd = (e) => { if (!this.held.has(e.code)) this.pressed.add(e.code); this.held.add(e.code); if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault(); };
    this._ku = (e) => this.held.delete(e.code);
    this._mm = (e) => { if (this.locked) { this.mouseDX += e.movementX || 0; this.mouseDY += e.movementY || 0; } };
    this._lc = () => { this.locked = document.pointerLockElement === this.dom; };
    window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
    window.addEventListener('mousemove', this._mm); document.addEventListener('pointerlockchange', this._lc);
    this._setupTouch();
  }
  _setupTouch() {
    const dom = this.dom; let moveId = null, lookId = null, mx = 0, my = 0, lx = 0, ly = 0;
    const opts = { passive: false };
    dom.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.45 && moveId === null) { moveId = t.identifier; mx = t.clientX; my = t.clientY; }
        else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
      }
    }, opts);
    dom.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === moveId) {
          this.touchMove.x = Math.max(-1, Math.min(1, (t.clientX - mx) / 60));
          this.touchMove.y = Math.max(-1, Math.min(1, (t.clientY - my) / 60));
        } else if (t.identifier === lookId) {
          this.touchLook.x += (t.clientX - lx); this.touchLook.y += (t.clientY - ly);
          lx = t.clientX; ly = t.clientY;
        }
      }
    }, opts);
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === moveId) { moveId = null; this.touchMove.x = 0; this.touchMove.y = 0; }
        if (t.identifier === lookId) lookId = null;
      }
    };
    dom.addEventListener('touchend', end); dom.addEventListener('touchcancel', end);
  }
  requestLock() { try { const p = this.dom.requestPointerLock?.(); if (p?.catch) p.catch(() => {}); } catch {} }
  down(code) { return this.held.has(code); }
  hit(code) { return this.pressed.has(code); }
  // 每逻辑帧末调用，清边沿与鼠标增量
  endFrame() { this.pressed.clear(); this.mouseDX = 0; this.mouseDY = 0; this.touchLook.x = 0; this.touchLook.y = 0; }
  axis(neg, pos) { return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0); }
  dispose() {
    window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku);
    window.removeEventListener('mousemove', this._mm); document.removeEventListener('pointerlockchange', this._lc);
  }
}

// ---------- 第一人称控制器（指针锁定 + WASD + 跳跃，含 coyote/jump buffer） ----------
export class FPSController {
  constructor(camera, input, opts = {}) {
    this.camera = camera; this.input = input;
    this.pos = new THREE.Vector3(0, 1.7, 0); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.onGround = false;
    this.speed = opts.speed ?? 8; this.accel = opts.accel ?? 40; this.friction = opts.friction ?? 10;
    this.gravity = opts.gravity ?? 24; this.jumpVel = opts.jumpVel ?? 8.5;
    this.eye = opts.eye ?? 1.7; this.radius = opts.radius ?? 0.4;
    this.coyote = 0; this.jumpBuffer = 0;
    this.groundAt = opts.groundAt || (() => 0); // (x,z)=>地面高度；碰撞墙由游戏侧自行处理
    this.sensitivity = opts.sensitivity ?? 0.0024;
    this.enabled = true;
  }
  teleport(x, y, z) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); }
  update(dt) {
    if (!this.enabled) return;
    const inp = this.input;
    this.yaw -= (inp.mouseDX + inp.touchLook.x * 3) * this.sensitivity;
    this.pitch -= (inp.mouseDY + inp.touchLook.y * 3) * this.sensitivity;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    let f = inp.axis('KeyS', 'KeyW') + -inp.touchMove.y;
    let s = inp.axis('KeyA', 'KeyD') + inp.touchMove.x;
    const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = (s * cos - f * sin) * this.speed;
    const wz = (-f * cos - s * sin) * this.speed;
    // 水平加速/摩擦
    const k = this.onGround ? this.accel : this.accel * 0.35;
    this.vel.x += (wx - this.vel.x) * Math.min(1, k * dt / this.speed * 2);
    this.vel.z += (wz - this.vel.z) * Math.min(1, k * dt / this.speed * 2);
    if (this.onGround && len < 0.01) { const d = Math.max(0, 1 - this.friction * dt); this.vel.x *= d; this.vel.z *= d; }
    // 跳跃（coyote 120ms + buffer 150ms）
    this.coyote = this.onGround ? 0.12 : Math.max(0, this.coyote - dt);
    if (inp.hit('Space')) this.jumpBuffer = 0.15; else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) { this.vel.y = this.jumpVel; this.coyote = 0; this.jumpBuffer = 0; this.onGround = false; }
    this.vel.y -= this.gravity * dt;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;
    const g = this.groundAt(this.pos.x, this.pos.z) + this.eye;
    if (this.pos.y <= g) { this.pos.y = g; this.vel.y = 0; this.onGround = true; } else this.onGround = false;
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw); this.camera.rotateX(this.pitch);
  }
  forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
}

// ---------- 追踪相机（载具/第三人称） ----------
export function chaseCamera(camera, targetPos, heading, opts = {}) {
  const dist = opts.dist ?? 9, height = opts.height ?? 4, smooth = opts.smooth ?? 6, lookAhead = opts.lookAhead ?? 3;
  const tx = targetPos.x - Math.sin(heading) * -dist, tz = targetPos.z - Math.cos(heading) * -dist;
  const k = Math.min(1, smooth * (opts.dt ?? 1 / 60));
  camera.position.x += (targetPos.x + Math.sin(heading) * dist - camera.position.x) * k;
  camera.position.y += (targetPos.y + height - camera.position.y) * k;
  camera.position.z += (targetPos.z + Math.cos(heading) * dist - camera.position.z) * k;
  camera.lookAt(targetPos.x - Math.sin(heading) * lookAhead, targetPos.y + 1, targetPos.z - Math.cos(heading) * lookAhead);
}

// ---------- 几何/光照工厂（低多边形风格） ----------
export function lambert(color, opts = {}) { return new THREE.MeshLambertMaterial({ color, ...opts }); }
export function box(w, h, d, color, opts) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color, opts)); }
export function sphere(r, color, seg = 16) { return new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), lambert(color)); }
export function cylinder(rt, rb, h, color, seg = 16) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), lambert(color)); }
export function plane(w, h, color, opts) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lambert(color, opts)); m.rotation.x = -Math.PI / 2; return m; }
export function addLights(scene, { sky = 0xbfd4ff, ground = 0x3a2f24, sun = 0xffffff, intensity = 1.1, sunPos = [30, 50, 20] } = {}) {
  scene.add(new THREE.HemisphereLight(sky, ground, 0.9));
  const d = new THREE.DirectionalLight(sun, intensity); d.position.set(...sunPos);
  d.castShadow = true; d.shadow.mapSize.set(2048, 2048);
  const sc = d.shadow.camera; sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.far = 200; d.shadow.bias = -0.0005;
  scene.add(d);
  return d;
}
export function addFog(scene, color, near = 40, far = 220) { scene.fog = new THREE.Fog(color, near, far); }

// ---------- 对象池（车流/子弹/敌人通用） ----------
export class Pool {
  constructor(make, reset, size = 32) { this.items = []; this.make = make; this.reset = reset; for (let i = 0; i < size; i++) { const o = make(); o.userData.active = false; this.items.push(o); } }
  get() { let o = this.items.find((x) => !x.userData.active); if (!o) { o = this.make(); this.items.push(o); } o.userData.active = true; this.reset(o); return o; }
  release(o) { o.userData.active = false; if (o.parent) o.parent.remove(o); }
  forEach(fn) { for (const o of this.items) if (o.userData.active) fn(o); }
}

// ---------- 小工具 ----------
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }