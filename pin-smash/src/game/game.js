// src/game/game.js — Pin Smash: 3D physics bowling on enable3d (AmmoPhysics) + three.js.
import * as THREE from 'three';
import { AmmoPhysics } from '../../lib/enable3d.ammoPhysics.module.min.js';
import { AudioEngine } from './audio.js';
import { newFrames, frameComplete, scoreGame, ratingFor } from './scoring.js';
import { makeLaneTexture, makePinTexture, makeBallTexture, makeSignTexture, makeFloorTexture } from './textures.js';

const A = () => window.Ammo;

// ---- tuning constants (game units) ----
const LANE_HALF_W = 1.0;
const BALL_R = 0.20;
const BALL_MASS = 6;
const BALL_START_Z = 7.6;
const PIN_H = 0.62;
const HEAD_PIN_Z = -5.6;
const SX = 0.30;          // lateral pin spacing
const SZ = 0.27;          // row depth spacing
const GRAVITY = -25;
const HOOK_ACCEL = 2.6;   // lateral hook strength
const MIN_SPEED = 7.0;
const MAX_SPEED = 17.0;
const AIM_LIMIT = 0.82;

// pin rack layout (id, x-in-spacing-units, row)
const RACK = [
  [1, 0, 0],
  [2, -0.5, 1], [3, 0.5, 1],
  [4, -1, 2], [5, 0, 2], [6, 1, 2],
  [7, -1.5, 3], [8, -0.5, 3], [9, 0.5, 3], [10, 1.5, 3],
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------- Particle system (confetti + sparks) ----------------
class Particles {
  constructor(scene, max = 500) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxlife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.geo = geo;
    scene.add(this.points);
    for (let i = 0; i < max; i++) this.life[i] = 0;
  }
  spawn(x, y, z, count, opts = {}) {
    const { speed = 3, spread = 1, colors = [[1, 1, 1]], gravity = 9, life = 1.2, up = 2 } = opts;
    for (let n = 0; n < count; n++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      this.vel[i * 3] = Math.cos(a) * r * speed;
      this.vel[i * 3 + 1] = (Math.random() * 0.7 + 0.3) * up * speed * 0.5;
      this.vel[i * 3 + 2] = Math.sin(a) * r * speed;
      const c = colors[(Math.random() * colors.length) | 0];
      this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2];
      this.life[i] = life * (0.6 + Math.random() * 0.6);
      this.maxlife[i] = this.life[i];
      this.grav[i] = gravity;
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -999; continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.life[i] <= 0) this.pos[i * 3 + 1] = -999;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

// ---------------- Main game ----------------
export class BowlingGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.audio = new AudioEngine();
    this.state = 'title';
    this.paused = false;
    this.frames = newFrames();
    this.frameIndex = 0;
    this.rollInFrame = 0;
    this.aimX = 0;
    this.spin = 0;
    this.power = 0;
    this.chargeTime = 0;
    this.timeScale = 1;
    this.slowmoTimer = 0;
    this.shake = 0;
    this.rollTime = 0;
    this.settleTime = 0;
    this.settleCalm = 0;
    this.sweepTimer = 0;
    this.nextAction = null;
    this.gutterBall = false;
    this.impactDone = false;
    this.lastHitSound = 0;
    this.pins = [];
    this.ballMesh = null;
    this.standingCount = 10;
    this.keys = {};
    this.mouseAim = null;
    this.lastT = 0;
    this.fpsAccum = 0; this.fpsFrames = 0; this.fps = 60;
    this.best = 0;
    this.stats = { strikes: 0, spares: 0, gutters: 0 };
    this._tmpV = null;
    this.camPos = new THREE.Vector3(0, 2.7, 10.8);
    this.camLook = new THREE.Vector3(0, 0.25, -3.5);
    this.onState = null; // callback for UI
  }

  async init() {
    this._initRenderer();
    this._initScene();
    this.physics = new AmmoPhysics(this.scene, { gravity: { x: 0, y: GRAVITY, z: 0 }, maxSubSteps: 4, fixedTimeStep: 1 / 60 });
    this._tmpV = new (A().btVector3)();
    this.particles = new Particles(this.scene);
    this._buildAlley();
    this._buildAimVisuals();
    this.resetRack();
    this._spawnBallMesh();
    this._bindInput();
    this._buildScoreboard();
    this.best = this._loadBest();
    this._updateBestUI();
    window.addEventListener('resize', () => this._resize());
    this._resize();
    this.lastT = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#06060e');
    this.scene.fog = new THREE.Fog('#06060e', 20, 46);
    this.camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 120);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    const hemi = new THREE.HemisphereLight('#4a4a70', '#0a0a12', 0.7);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight('#fff1dd', 1.5);
    key.position.set(4, 12, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1; key.shadow.camera.far = 40;
    key.shadow.camera.left = -8; key.shadow.camera.right = 8;
    key.shadow.camera.top = 12; key.shadow.camera.bottom = -12;
    key.shadow.bias = -0.0005;
    this.scene.add(key);

    const laneSpot = new THREE.SpotLight('#ffe9c9', 2.2, 0, Math.PI / 4, 0.5, 0);
    laneSpot.position.set(0, 9, 3); laneSpot.target.position.set(0, 0, 0);
    this.scene.add(laneSpot, laneSpot.target);
    const deckSpot = new THREE.SpotLight('#ffffff', 2.6, 0, Math.PI / 5, 0.6, 0);
    deckSpot.position.set(0, 8, -5); deckSpot.target.position.set(0, 0, -6);
    deckSpot.castShadow = true; deckSpot.shadow.mapSize.set(1024, 1024); deckSpot.shadow.bias = -0.0005;
    this.scene.add(deckSpot, deckSpot.target);

    const mag = new THREE.PointLight('#ff2d95', 1.4, 0, 0); mag.position.set(-3.2, 1.6, -3); this.scene.add(mag);
    const cyan = new THREE.PointLight('#22d3ee', 1.4, 0, 0); cyan.position.set(3.2, 1.6, -3); this.scene.add(cyan);
    const mag2 = new THREE.PointLight('#ff2d95', 0.8, 0, 0); mag2.position.set(-3.2, 1.6, 6); this.scene.add(mag2);
    const cyan2 = new THREE.PointLight('#22d3ee', 0.8, 0, 0); cyan2.position.set(3.2, 1.6, 6); this.scene.add(cyan2);
  }

  _staticBox(w, h, d, x, y, z, material, name) {
    const m = this.physics.add.box({ width: w, height: h, depth: d, x, y, z, mass: 0 });
    m.material = material; m.name = name || 'static';
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  _buildAlley() {
    const laneTex = makeLaneTexture();
    const woodSide = new THREE.MeshStandardMaterial({ color: '#6b4a2a', roughness: 0.85 });
    const laneTop = new THREE.MeshStandardMaterial({ map: laneTex, roughness: 0.35, metalness: 0.05 });
    const laneMats = [woodSide, woodSide, laneTop, woodSide, woodSide, woodSide];
    const lane = this._staticBox(LANE_HALF_W * 2, 0.5, 20, 0, -0.25, 0, laneMats, 'lane');
    lane.body.ammo.setFriction(0.22);
    lane.body.ammo.setRestitution(0.05);

    const gutterMat = new THREE.MeshStandardMaterial({ color: '#1c1c28', roughness: 0.6, metalness: 0.3 });
    for (const s of [-1, 1]) {
      const g = this._staticBox(0.36, 0.3, 20, s * 1.18, -0.37, 0, gutterMat, 'gutter');
      g.body.ammo.setFriction(0.4);
      // outer wall
      const wall = this._staticBox(0.12, 0.8, 20, s * 1.42, 0.1, 0, new THREE.MeshStandardMaterial({ color: '#101018', roughness: 0.7 }), 'wall');
      wall.body.ammo.setFriction(0.3);
      // neon strip on top of outer wall
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 20),
        new THREE.MeshBasicMaterial({ color: s < 0 ? '#ff2d95' : '#22d3ee' }));
      strip.position.set(s * 1.42, 0.52, 0);
      this.scene.add(strip);
    }

    // back pit wall
    const back = this._staticBox(3.4, 1.4, 0.4, 0, 0.45, -9.7, new THREE.MeshStandardMaterial({ color: '#0c0c16', roughness: 0.8 }), 'back');
    back.body.ammo.setRestitution(0.2);
    // neon sign above pit
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05),
      new THREE.MeshBasicMaterial({ map: makeSignTexture('PIN SMASH'), transparent: true }));
    sign.position.set(0, 2.3, -9.45);
    this.scene.add(sign);
    this.sign = sign;

    // alley floor
    const floor = this._staticBox(60, 0.5, 60, 0, -0.85, 0, new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.95 }), 'floor');
    floor.receiveShadow = true;

    // side ambiance walls (visual)
    const sideMat = new THREE.MeshStandardMaterial({ color: '#0a0a14', roughness: 1 });
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), sideMat);
      w.position.set(s * 7, 3, -2); w.rotation.y = -s * Math.PI / 2;
      this.scene.add(w);
    }
    // ceiling glow plane
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 30), new THREE.MeshBasicMaterial({ color: '#0d0d1a' }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 7.5, -2);
    this.scene.add(ceil);
  }

  _pinGeometry() {
    const pts = [
      [0.000, -0.31], [0.055, -0.31], [0.072, -0.27], [0.083, -0.16],
      [0.078, -0.06], [0.055, 0.04], [0.040, 0.10], [0.036, 0.15],
      [0.042, 0.20], [0.048, 0.24], [0.040, 0.285], [0.020, 0.305], [0.000, 0.31],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(pts, 20);
  }

  resetRack() {
    // clear existing pins
    for (const p of this.pins) {
      if (p.mesh.body) this.physics.destroy(p.mesh);
      this.scene.remove(p.mesh);
    }
    this.pins = [];
    const geo = this._pinGeometry();
    const mat = new THREE.MeshStandardMaterial({ map: makePinTexture(), roughness: 0.3, metalness: 0.05 });
    for (const [id, xu, row] of RACK) {
      const x = xu * SX;
      const z = HEAD_PIN_Z - row * SZ;
      const mesh = this.physics.add.cylinder({ radiusTop: 0.045, radiusBottom: 0.075, height: PIN_H, x, y: PIN_H / 2, z, mass: 1.5 });
      mesh.geometry = geo;
      mesh.material = mat;
      mesh.name = 'pin-' + id;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.body.ammo.setFriction(0.45);
      mesh.body.ammo.setRestitution(0.18);
      mesh.body.ammo.setDamping(0.08, 0.25);
      mesh.body.checkCollisions = true;
      this.scene.add(mesh);
      const pin = { id, mesh, home: new THREE.Vector3(x, PIN_H / 2, z), down: false };
      mesh.body.on.collision((other, ev) => {
        if (ev === 'start') this._onPinHit(pin, other);
      });
      this.pins.push(pin);
    }
    this.standingCount = 10;
  }

  removeDownedPins() {
    for (const p of this.pins) {
      if (p.down && p.mesh.body) {
        // sink + hide
        p.mesh.visible = false;
        this.physics.destroy(p.mesh);
      }
    }
    this.standingCount = this.pins.filter((p) => !p.down).length;
  }

  _spawnBallMesh() {
    const mat = new THREE.MeshStandardMaterial({ map: makeBallTexture('#4a1f7a', '#b14aed'), roughness: 0.18, metalness: 0.25 });
    const mesh = this.physics.add.sphere({ radius: BALL_R, x: 0, y: BALL_R, z: BALL_START_Z, mass: BALL_MASS });
    mesh.geometry = new THREE.SphereGeometry(BALL_R, 32, 24);
    mesh.material = mat;
    mesh.name = 'ball';
    mesh.castShadow = true;
    mesh.body.ammo.setFriction(0.32);
    mesh.body.ammo.setRestitution(0.25);
    mesh.body.ammo.setDamping(0.02, 0.05);
    mesh.body.ammo.setActivationState(5); // DISABLE_SIMULATION while aiming
    mesh.body.checkCollisions = true;
    mesh.body.on.collision((other, ev) => { if (ev === 'start') this._onBallHit(other); });
    this.scene.add(mesh);
    this.ballMesh = mesh;
    this._placeBall(0);
  }

  _placeBall(x) {
    const t = new (A().btTransform)();
    t.setIdentity();
    this._tmpV.setValue(x, BALL_R, BALL_START_Z);
    t.setOrigin(this._tmpV);
    const q = new (A().btQuaternion)(0, 0, 0, 1);
    t.setRotation(q);
    const b = this.ballMesh.body.ammo;
    b.setWorldTransform(t);
    b.getMotionState().setWorldTransform(t);
    b.clearForces();
    b.setLinearVelocity(new (A().btVector3)(0, 0, 0));
    b.setAngularVelocity(new (A().btVector3)(0, 0, 0));
    this.ballMesh.position.set(x, BALL_R, BALL_START_Z);
    this.ballMesh.quaternion.identity();
    A().destroy(t); A().destroy(q);
  }

  _buildAimVisuals() {
    // aim arrow
    this.aimArrow = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 12), new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.9 }));
    cone.rotation.x = -Math.PI / 2; cone.position.z = -0.4;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.5), new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.6 }));
    shaft.position.z = -0.05;
    this.aimArrow.add(cone, shaft);
    this.aimArrow.position.set(0, 0.03, BALL_START_Z - 0.3);
    this.scene.add(this.aimArrow);
    // trajectory line
    const g = new THREE.BufferGeometry();
    const N = 40;
    this._trajN = N;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.trajLine = new THREE.Line(g, new THREE.LineDashedMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.5, dashSize: 0.25, gapSize: 0.18 }));
    this.trajLine.frustumCulled = false;
    this.scene.add(this.trajLine);
  }

  _updateAimVisuals() {
    const show = (this.state === 'aim' || this.state === 'charge');
    this.aimArrow.visible = show;
    this.trajLine.visible = show;
    if (!show) return;
    this.aimArrow.position.x = this.aimX;
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 220);
    this.aimArrow.children.forEach((c) => { c.material.opacity = pulse; });
    // trajectory preview with hook
    const arr = this.trajLine.geometry.attributes.position.array;
    const N = this._trajN;
    const startZ = BALL_START_Z - 0.3, endZ = HEAD_PIN_Z - 0.6;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const z = lerp(startZ, endZ, t);
      const x = this.aimX + this.spin * 0.95 * t * t;
      arr[i * 3] = x; arr[i * 3 + 1] = 0.04; arr[i * 3 + 2] = z;
    }
    this.trajLine.geometry.attributes.position.needsUpdate = true;
    this.trajLine.computeLineDistances();
  }

  // ---- collisions / feedback ----
  _onBallHit(other) {
    const now = performance.now();
    if (other && other.name && other.name.startsWith('pin')) {
      if (!this.impactDone) {
        this.impactDone = true;
        this._triggerSlowmo(0.4);
        this.shake = Math.max(this.shake, 0.35);
      }
      if (now - this.lastHitSound > 55) { this.audio.pinHit(1); this.lastHitSound = now; }
      const p = other.position;
      this.particles.spawn(p.x, p.y + 0.2, p.z, 8, { speed: 2.2, spread: 1, colors: [[1, 0.9, 0.5], [1, 0.6, 0.2]], gravity: 6, life: 0.5, up: 1.5 });
    }
  }
  _onPinHit(pin, other) {
    const now = performance.now();
    if (now - this.lastHitSound > 70) { this.audio.pinHit(0.5); this.lastHitSound = now; }
  }

  _triggerSlowmo(dur) { this.slowmoTimer = dur; }

  // ---- input ----
  _bindInput() {
    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    const c = this.canvas;
    c.addEventListener('mousemove', (e) => {
      if (this.state !== 'aim' && this.state !== 'charge') return;
      const r = c.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width;
      this.aimX = clamp((nx - 0.5) * 2 * AIM_LIMIT * 1.15, -AIM_LIMIT, AIM_LIMIT);
    });
    c.addEventListener('mousedown', (e) => { if (e.button === 0) this._pressStart(); });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this._pressEnd(); });
    c.addEventListener('touchstart', (e) => { e.preventDefault(); this._touch(e, 'start'); }, { passive: false });
    c.addEventListener('touchmove', (e) => { e.preventDefault(); this._touch(e, 'move'); }, { passive: false });
    c.addEventListener('touchend', (e) => { e.preventDefault(); this._touch(e, 'end'); }, { passive: false });
  }

  _touch(e, phase) {
    const t = e.changedTouches[0]; if (!t) return;
    const r = this.canvas.getBoundingClientRect();
    const nx = (t.clientX - r.left) / r.width;
    if (phase === 'start') {
      this.aimX = clamp((nx - 0.5) * 2 * AIM_LIMIT * 1.15, -AIM_LIMIT, AIM_LIMIT);
      this._pressStart();
    } else if (phase === 'move') {
      if (this.state === 'aim' || this.state === 'charge') this.aimX = clamp((nx - 0.5) * 2 * AIM_LIMIT * 1.15, -AIM_LIMIT, AIM_LIMIT);
    } else if (phase === 'end') {
      this._pressEnd();
    }
  }

  _key(e, down) {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', ' ', 'a', 'd'].includes(k) || k === 'spacebar') e.preventDefault();
    this.keys[k] = down;
    if (!down) {
      if (k === ' ' || k === 'spacebar') this._pressEnd();
      return;
    }
    if (k === ' ' || k === 'spacebar') this._pressStart();
    if (k === 'p' || k === 'escape') this.togglePause();
    if (k === 'm') this.toggleMute();
    if (k === 'r' && this.state === 'gameover') this.startGame();
  }

  _pressStart() {
    this.audio.ensure();
    if (this.state === 'aim' && !this.paused) {
      this.state = 'charge'; this.chargeTime = 0; this.power = 0;
      this._setState();
    }
  }
  _pressEnd() {
    if (this.state === 'charge' && !this.paused) this._throw(this.power);
  }

  _throw(power) {
    const speed = MIN_SPEED + power * (MAX_SPEED - MIN_SPEED);
    this.state = 'roll';
    this.rollTime = 0; this.settleTime = 0; this.settleCalm = 0;
    this.gutterBall = false; this.impactDone = false;
    this.power = power;
    const b = this.ballMesh.body.ammo;
    b.setActivationState(4); // DISABLE_DEACTIVATION
    b.setLinearVelocity(new (A().btVector3)(this.spin * 0.4, 0, -speed));
    b.setAngularVelocity(new (A().btVector3)(speed / BALL_R, this.spin * 6, 0));
    this.audio.throwWhoosh(power);
    this.audio.startRoll();
    this._setState();
    if (window.PipySDK) window.PipySDK.track('shot', { power: Math.round(power * 100), spin: this.spin });
  }

  _applyHook(dt) {
    if (!this.ballMesh || !this.ballMesh.body) return;
    const b = this.ballMesh.body.ammo;
    const z = this.ballMesh.position.z;
    const ramp = clamp((BALL_START_Z - z) / 12, 0, 1);
    const hook = this.spin * HOOK_ACCEL * ramp * ramp;
    const v = b.getLinearVelocity();
    v.setX(v.x() + hook * dt);
    b.setLinearVelocity(v);
  }

  // ---- flow ----
  startGame() {
    this.frames = newFrames();
    this.frameIndex = 0; this.rollInFrame = 0;
    this.spin = 0; this.aimX = 0; this.power = 0;
    this.stats = { strikes: 0, spares: 0, gutters: 0 };
    this.resetRack();
    this._placeBall(0);
    this.ballMesh.body.ammo.setActivationState(5);
    this.state = 'aim';
    this.paused = false;
    this.timeScale = 1;
    this.audio.ensure();
    if (window.PipySDK) window.PipySDK.newRun();
    this._updateHUD();
    this._setState();
  }

  _evaluateRoll() {
    // count newly downed pins (standingBefore = pins upright before this roll)
    const standingBefore = this.pins.filter((p) => !p.down).length;
    let newly = 0;
    for (const p of this.pins) {
      if (p.down) continue;
      if (this._isDown(p)) { p.down = true; newly++; }
    }
    this.standingCount = this.pins.filter((p) => !p.down).length;
    const fr = this.frames[this.frameIndex];
    fr.push(newly);

    // feedback: clearing a full rack = strike; clearing the remaining partial rack = spare
    const t = (k) => window.I18N ? window.I18N.t(k) : k;
    const isStrike = newly === 10 && standingBefore === 10;
    const isSpare = !isStrike && standingBefore > 0 && standingBefore < 10 && newly === standingBefore;
    if (newly === 0 && this.gutterBall) { this.stats.gutters++; this._toast(t('GUTTER!'), 'bad'); this.audio.gutter(); }
    else if (isStrike) { this.stats.strikes++; this._toast(t('STRIKE!'), 'strike'); this.audio.strike(); this._celebrate(1.0); }
    else if (isSpare) { this.stats.spares++; this._toast(t('SPARE!'), 'spare'); this.audio.spare(); this._celebrate(0.6); }
    else if (newly === 0) { this._toast(t('MISS'), 'meh'); }
    else { this._toast(t('{n} PINS').replace('{n}', newly), 'ok'); this.audio.frameScore(); }

    this._updateHUD();

    // decide next
    const complete = frameComplete(this.frameIndex, fr);
    if (complete) {
      if (this.frameIndex === 9) {
        this.nextAction = () => this._gameOver();
        this.sweepTimer = isStrike || isSpare ? 1.8 : 1.2;
      } else {
        this.nextAction = () => { this.frameIndex++; this.rollInFrame = 0; this.resetRack(); this._placeBall(this.aimX); this.ballMesh.body.ammo.setActivationState(5); this.state = 'aim'; this._updateHUD(); this._setState(); };
        this.sweepTimer = isStrike ? 1.9 : isSpare ? 1.5 : 1.0;
      }
    } else {
      this.nextAction = () => {
        this.rollInFrame++;
        if (this.standingCount === 0) this.resetRack();
        else this.removeDownedPins();
        this._placeBall(this.aimX);
        this.ballMesh.body.ammo.setActivationState(5);
        this.state = 'aim';
        this._updateHUD(); this._setState();
      };
      this.sweepTimer = 1.0;
    }
    this.state = 'sweep';
    this.audio.stopRoll();
    this._setState();
  }

  _isDown(p) {
    const m = p.mesh;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(m.quaternion);
    const tilt = up.y;
    const dx = m.position.x - p.home.x, dz = m.position.z - p.home.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    return tilt < 0.55 || dist > 0.42 || m.position.y < 0.06;
  }

  _celebrate(intensity) {
    this.shake = Math.max(this.shake, 0.5 * intensity + 0.3);
    const colors = [[1, 0.18, 0.58], [0.13, 0.83, 0.93], [1, 0.85, 0.2], [0.6, 0.4, 1], [0.3, 1, 0.5]];
    const n = Math.floor(120 * intensity);
    this.particles.spawn(0, 1.2, HEAD_PIN_Z, n, { speed: 4, spread: 1.4, colors, gravity: 7, life: 2.0, up: 3 });
    this.particles.spawn(-1, 0.5, HEAD_PIN_Z + 1, Math.floor(n / 2), { speed: 3.5, spread: 1, colors, gravity: 6, life: 1.8, up: 3 });
    this.particles.spawn(1, 0.5, HEAD_PIN_Z + 1, Math.floor(n / 2), { speed: 3.5, spread: 1, colors, gravity: 6, life: 1.8, up: 3 });
    this._flash(intensity);
  }

  _flash(intensity) {
    const el = document.getElementById('flash');
    if (!el) return;
    el.style.opacity = String(0.55 * intensity);
    el.classList.remove('fade'); void el.offsetWidth; el.classList.add('fade');
  }

  _gameOver() {
    this.state = 'gameover';
    const s = scoreGame(this.frames);
    const total = s.total;
    const rating = ratingFor(total);
    const isBest = total > this.best;
    if (isBest) { this.best = total; this._saveBest(total); }
    this._updateBestUI();
    if (window.PipySDK) { window.PipySDK.levelCleared({ score: total }); window.PipySDK.track('win', { score: total, strikes: this.stats.strikes }); }
    this.audio.gameOver(total >= 100);
    this._showResults(total, rating, isBest, s);
    this._setState();
  }

  // ---- per-frame updates ----
  _updateInput(dt) {
    if (this.state === 'aim' || this.state === 'charge') {
      let dir = 0;
      if (this.keys['arrowleft']) dir -= 1;
      if (this.keys['arrowright']) dir += 1;
      if (dir) this.aimX = clamp(this.aimX + dir * 1.6 * dt, -AIM_LIMIT, AIM_LIMIT);
      let sd = 0;
      if (this.keys['a']) sd -= 1;
      if (this.keys['d']) sd += 1;
      if (sd) this.spin = clamp(this.spin + sd * 1.3 * dt, -1, 1);
    }
    if (this.state === 'charge') {
      this.chargeTime += dt;
      const t = (this.chargeTime / 1.3) % 2;
      this.power = 1 - Math.abs(1 - t);
      if (Math.random() < 0.12) this.audio.charge(this.power);
    }
  }

  _updateRoll(dt) {
    this.rollTime += dt;
    const b = this.ballMesh;
    if (b.position.y < 0.05) this.gutterBall = true;
    const v = b.body.ammo.getLinearVelocity();
    const sp = Math.sqrt(v.x() * v.x() + v.z() * v.z());
    this.audio.updateRoll(clamp(sp / MAX_SPEED, 0, 1));
    const past = b.position.z < HEAD_PIN_Z - 2.6;
    const dropped = b.position.y < -0.28;
    const slow = sp < 0.4 && this.rollTime > 1.6;
    if (past || dropped || slow || this.rollTime > 5) {
      this.state = 'settle'; this.settleTime = 0; this.settleCalm = 0;
      this._setState();
    }
  }

  _updateSettle(dt) {
    this.settleTime += dt;
    let maxSp = 0;
    for (const p of this.pins) {
      if (p.down || !p.mesh.body) continue;
      const v = p.mesh.body.ammo.getLinearVelocity();
      const w = p.mesh.body.ammo.getAngularVelocity();
      const s = Math.sqrt(v.x() * v.x() + v.y() * v.y() + v.z() * v.z()) + Math.sqrt(w.x() * w.x() + w.y() * w.y() + w.z() * w.z()) * 0.1;
      if (s > maxSp) maxSp = s;
    }
    if (maxSp < 0.3) this.settleCalm += dt; else this.settleCalm = 0;
    if (this.settleCalm > 0.35 || this.settleTime > 2.8) this._evaluateRoll();
  }

  _updateCamera(dt) {
    let tp, tl;
    const b = this.ballMesh;
    if (this.state === 'roll') {
      tp = new THREE.Vector3(b.position.x * 0.3, 2.3, Math.max(b.position.z + 5.5, 2.0));
      tl = new THREE.Vector3(b.position.x * 0.3, 0.25, b.position.z - 4.5);
    } else if (this.state === 'settle' || this.state === 'sweep') {
      tp = new THREE.Vector3(0, 2.0, 2.4); tl = new THREE.Vector3(0, 0.3, -6.0);
    } else if (this.state === 'gameover') {
      tp = new THREE.Vector3(0, 3.4, 6.5); tl = new THREE.Vector3(0, 0.5, -4);
    } else {
      tp = new THREE.Vector3(this.aimX * 0.35, 2.7, 10.8); tl = new THREE.Vector3(this.aimX * 0.15, 0.25, -3.5);
    }
    const k = 1 - Math.exp(-dt * 4.5);
    this.camPos.lerp(tp, k);
    this.camLook.lerp(tl, k);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.4;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.4;
      this.shake *= Math.exp(-dt * 5);
    }
    this.camera.lookAt(this.camLook);
  }

  _loop(t) {
    requestAnimationFrame((tt) => this._loop(tt));
    let dtMs = t - this.lastT; this.lastT = t;
    dtMs = clamp(dtMs, 0, 50);
    // fps
    this.fpsAccum += dtMs; this.fpsFrames++;
    if (this.fpsAccum > 500) { this.fps = Math.round(this.fpsFrames / (this.fpsAccum / 1000)); this.fpsAccum = 0; this.fpsFrames = 0; }

    // slowmo
    if (this.slowmoTimer > 0) { this.slowmoTimer -= dtMs / 1000; this.timeScale = 0.35; }
    else this.timeScale = lerp(this.timeScale, 1, 0.1);

    const active = !this.paused && this.state !== 'title' && this.state !== 'gameover';
    const dt = (dtMs / 1000) * this.timeScale;
    if (active) {
      this._updateInput(dt);
      if (this.state === 'roll') this._applyHook(dt);
      this.physics.update(dtMs * this.timeScale);
      if (this.state === 'roll') this._updateRoll(dt);
      else if (this.state === 'settle') this._updateSettle(dt);
      else if (this.state === 'sweep') {
        this.sweepTimer -= dtMs / 1000;
        if (this.sweepTimer <= 0 && this.nextAction) { const fn = this.nextAction; this.nextAction = null; fn(); }
      }
      this.particles.update(dt);
    } else {
      this.physics.update(dtMs * 0.0001); // keep world alive minimally
      this.particles.update(dtMs / 1000);
    }
    this._updateAimVisuals();
    this._updateCamera(dtMs / 1000);
    this._updatePowerUI();
    if (this.sign) this.sign.material.opacity = 0.85 + 0.15 * Math.sin(t / 400);
    this.renderer.render(this.scene, this.camera);
  }

  // ---- UI ----
  _buildScoreboard() {
    const sb = document.getElementById('scoreboard');
    if (!sb) return;
    sb.innerHTML = '';
    this.sbFrames = [];
    for (let f = 0; f < 10; f++) {
      const div = document.createElement('div');
      div.className = 'sb-frame';
      const cells = f === 9 ? 3 : 2;
      let rollsHtml = '';
      for (let c = 0; c < cells; c++) rollsHtml += '<span></span>';
      div.innerHTML = `<div class="sb-num">${f + 1}</div><div class="sb-rolls${f === 9 ? ' three' : ''}">${rollsHtml}</div><div class="sb-cum"></div>`;
      sb.appendChild(div);
      this.sbFrames.push(div);
    }
  }

  _updateHUD() {
    const s = scoreGame(this.frames);
    // scoreboard
    if (this.sbFrames) {
      for (let f = 0; f < 10; f++) {
        const el = this.sbFrames[f];
        const fr = s.frames[f];
        el.classList.toggle('active', f === this.frameIndex && this.state !== 'gameover');
        el.classList.toggle('done', fr.cumulative !== null);
        const spans = el.querySelectorAll('.sb-rolls span');
        for (let c = 0; c < spans.length; c++) {
          const mk = fr.marks[c] || '';
          spans[c].textContent = mk;
          spans[c].className = mk === 'X' ? 'strike' : mk === '/' ? 'spare' : '';
        }
        el.querySelector('.sb-cum').textContent = fr.cumulative !== null ? fr.cumulative : '';
      }
    }
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('hud-frame', (this.frameIndex + 1) + '/10');
    set('hud-roll', String(this.rollInFrame + 1));
    set('hud-pins', String(this.standingCount));
    set('hud-total', String(s.total));
  }

  _updatePowerUI() {
    const fill = document.getElementById('power-fill');
    const wrap = document.getElementById('power-wrap');
    if (wrap) wrap.classList.toggle('hidden', !(this.state === 'charge' || this.state === 'aim'));
    if (fill) {
      const p = this.state === 'charge' ? this.power : 0;
      fill.style.width = (p * 100) + '%';
      fill.className = 'power-fill' + (p > 0.85 ? ' hot' : p > 0.5 ? ' mid' : '');
    }
    const needle = document.getElementById('spin-needle');
    if (needle) needle.style.left = (50 + this.spin * 48) + '%';
    const spinVal = document.getElementById('spin-val');
    if (spinVal) spinVal.textContent = this.spin === 0 ? '0' : (this.spin > 0 ? 'R ' : 'L ') + Math.abs(this.spin).toFixed(1);
  }

  _toast(text, kind) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.className = 'toast show ' + (kind || '');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.className = 'toast'; }, 1500);
  }

  _setState() {
    if (this.onState) this.onState(this.state);
    // controls hint
    const hint = document.getElementById('controls-hint');
    if (hint) hint.classList.toggle('hidden', this.state !== 'aim' && this.state !== 'charge');
  }

  _showResults(total, rating, isBest, s) {
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('res-total', String(total));
    const rEl = document.getElementById('res-rating');
    if (rEl) {
      rEl.textContent = (window.I18N ? window.I18N.t('rating_' + rating.key) : rating.key);
      rEl.dataset.rating = rating.key;
    }
    const stars = document.getElementById('res-stars');
    if (stars) stars.textContent = '★'.repeat(rating.stars) + '☆'.repeat(5 - rating.stars);
    const stats = document.getElementById('res-stats');
    if (stats) {
      const t = (k) => window.I18N ? window.I18N.t(k) : k;
      stats.innerHTML = `<span>${t('Strikes')}: <b>${this.stats.strikes}</b></span><span>${t('Spares')}: <b>${this.stats.spares}</b></span><span>${t('Gutters')}: <b>${this.stats.gutters}</b></span>`;
    }
    const rec = document.getElementById('res-record');
    if (rec) rec.classList.toggle('hidden', !isBest);
  }

  _updateBestUI() {
    const t = (k) => window.I18N ? window.I18N.t(k) : k;
    const e = document.getElementById('best-title');
    if (e) e.textContent = t('Best') + ': ' + this.best;
    const e2 = document.getElementById('best-hud');
    if (e2) e2.textContent = this.best;
  }

  _loadBest() {
    try { if (window.PipySDK) { const v = window.PipySDK.load('best', 0); return typeof v === 'number' ? v : 0; } } catch (e) {}
    try { return parseInt(localStorage.getItem('pin-smash:best') || '0', 10) || 0; } catch (e) { return 0; }
  }
  _saveBest(v) {
    try { if (window.PipySDK) { window.PipySDK.save('best', v); return; } } catch (e) {}
    try { localStorage.setItem('pin-smash:best', String(v)); } catch (e) {}
  }

  togglePause() {
    if (this.state === 'title' || this.state === 'gameover') return;
    this.paused = !this.paused;
    if (this.paused) this.audio.stopRoll();
    if (this.onState) this.onState(this.paused ? 'paused' : this.state);
  }
  resume() { this.paused = false; if (this.onState) this.onState(this.state); }

  toggleMute() {
    this.audio.ensure();
    this.audio.setMuted(!this.audio.muted);
    return this.audio.muted;
  }

  toMenu() {
    this.state = 'title'; this.paused = false;
    this.audio.stopRoll();
    if (this.onState) this.onState('title');
  }

  _resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}