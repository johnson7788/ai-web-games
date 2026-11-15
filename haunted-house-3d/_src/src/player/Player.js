import * as THREE from 'three';
import { flashlightCookie } from '../world/Textures.js';

const EYE_HEIGHT = 1.62;
const RADIUS = 0.32;
const WALK_SPEED = 2.3;
const SPRINT_SPEED = 4.3;
const BEAM_INTENSITY = 26;
const DRAIN_PER_SEC = 0.55;   // idle flashlight drain
const BURN_DRAIN_PER_SEC = 5; // extra drain while burning him

export class Player {
  constructor(camera, domElement, audio) {
    this.camera = camera;
    this.dom = domElement;
    this.audio = audio;

    this.position = new THREE.Vector3(0, EYE_HEIGHT, 6.4);
    this.yaw = 0;                  // facing north (-z), into the house
    this.pitch = 0;
    this.velocity = new THREE.Vector3();
    this.keys = {};
    this.enabled = false;
    this.bobPhase = 0;
    this.stepDistance = 0;
    this.stepSide = 1;
    this.flashlightOn = true;
    this.flickerTime = 0;
    this.battery = 100;
    this.burning = false;
    this.fallbackLook = false;   // set by Game when pointer lock is unavailable
    this._dragging = false;

    this._buildFlashlight();
    this._bindInput();
  }

  _buildFlashlight() {
    this.flashlight = new THREE.SpotLight(0xfff2d8, BEAM_INTENSITY, 19, 0.5, 0.55, 2.0);
    this.flashlight.map = flashlightCookie();
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.shadow.camera.near = 0.2;
    this.flashlight.shadow.camera.far = 20;
    this.flashlight.shadow.bias = -0.004;
    this.flashTarget = new THREE.Object3D();
    this.flashlight.target = this.flashTarget;
    // smooth lag on the beam
    this.aimDir = new THREE.Vector3(0, 0, -1);
  }

  addTo(scene) {
    scene.add(this.flashlight);
    scene.add(this.flashTarget);
  }

  _bindInput() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyF' && this.enabled) {
        if (!this.flashlightOn && this.battery <= 0) {
          this.audio?.click();
          return; // dead cell — nothing happens
        }
        this.flashlightOn = !this.flashlightOn;
        this.audio?.click();
      }
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      const locked = document.pointerLockElement === this.dom;
      // pointer lock → free look; sandbox fallback → hold-and-drag look
      if (!locked && !(this.fallbackLook && this._dragging)) return;
      this.yaw -= e.movementX * 0.0021;
      this.pitch -= e.movementY * 0.0021;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });
    // drag-to-look fallback (pointer lock denied, e.g. sandboxed iframe)
    this.dom.addEventListener('mousedown', (e) => { if (e.button === 0) this._dragging = true; });
    document.addEventListener('mouseup', () => { this._dragging = false; });
    this.dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get isMoving() {
    return this.keys['KeyW'] || this.keys['KeyA'] || this.keys['KeyS'] || this.keys['KeyD'];
  }

  get isSprinting() {
    return this.isMoving && (this.keys['ShiftLeft'] || this.keys['ShiftRight']);
  }

  get beamActive() { return this.flashlightOn && this.battery > 0; }

  addBattery(amount) {
    this.battery = Math.min(100, this.battery + amount);
    if (!this.flashlightOn) this.flashlightOn = true;
  }

  flashlightFlicker(duration = 0.8) { this.flickerTime = Math.max(this.flickerTime, duration); }

  update(dt, colliders) {
    if (!this.enabled) {
      this._updateCamera(0);
      this._updateFlashlight(dt);
      return;
    }

    // --- battery ---
    if (this.flashlightOn && this.battery > 0) {
      this.battery -= dt * (DRAIN_PER_SEC + (this.burning ? BURN_DRAIN_PER_SEC : 0));
      if (this.battery <= 0) {
        this.battery = 0;
        this.flashlightOn = false;
        this.audio?.click();
      }
    }

    // --- arrow-key look (works with or without pointer lock) ---
    const LOOK_RATE = 1.9; // rad/s
    if (this.keys['ArrowLeft']) this.yaw += LOOK_RATE * dt;
    if (this.keys['ArrowRight']) this.yaw -= LOOK_RATE * dt;
    if (this.keys['ArrowUp']) this.pitch = Math.min(1.45, this.pitch + LOOK_RATE * dt);
    if (this.keys['ArrowDown']) this.pitch = Math.max(-1.45, this.pitch - LOOK_RATE * dt);

    // --- movement ---
    const speed = this.isSprinting ? SPRINT_SPEED : WALK_SPEED;
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const wish = new THREE.Vector3();
    if (this.keys['KeyW']) wish.add(forward);
    if (this.keys['KeyS']) wish.sub(forward);
    if (this.keys['KeyD']) wish.add(right);
    if (this.keys['KeyA']) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    // smooth accel
    this.velocity.x += (wish.x - this.velocity.x) * Math.min(1, dt * 11);
    this.velocity.z += (wish.z - this.velocity.z) * Math.min(1, dt * 11);

    const step = this.velocity.clone().multiplyScalar(dt);
    this.position.x += step.x;
    this._resolveCollisions(colliders, 'x');
    this.position.z += step.z;
    this._resolveCollisions(colliders, 'z');

    // --- footsteps (alternating stereo) ---
    const moved = Math.hypot(step.x, step.z);
    this.stepDistance += moved;
    const strideLen = this.isSprinting ? 2.0 : 1.45;
    if (this.stepDistance > strideLen && moved > 0.001) {
      this.stepDistance = 0;
      this.stepSide *= -1;
      this.audio?.footstep(this.isSprinting, this.stepSide * 0.13);
    }

    // --- head bob ---
    const speedRatio = Math.hypot(this.velocity.x, this.velocity.z) / SPRINT_SPEED;
    this.bobPhase += dt * (4 + speedRatio * 7);
    const bob = Math.sin(this.bobPhase * 2) * 0.028 * speedRatio;

    this._updateCamera(bob);
    this._updateFlashlight(dt);
  }

  _resolveCollisions(colliders, axis) {
    for (const b of colliders) {
      const cx = Math.max(b.minX, Math.min(this.position.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(this.position.z, b.maxZ));
      const dx = this.position.x - cx;
      const dz = this.position.z - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < RADIUS * RADIUS) {
        const dist = Math.sqrt(distSq) || 0.0001;
        const push = RADIUS - dist;
        if (axis === 'x') this.position.x += (dx / dist) * push;
        else this.position.z += (dz / dist) * push;
      }
    }
  }

  _updateCamera(bob) {
    this.camera.position.set(this.position.x, EYE_HEIGHT + bob, this.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  _updateFlashlight(dt) {
    // beam follows view with a touch of lag for weight
    const target = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
    this.aimDir.lerp(target, Math.min(1, dt * 9));
    this.flashlight.position.copy(this.camera.position);
    this.flashlight.position.y -= 0.12;
    this.flashTarget.position.copy(this.camera.position).addScaledVector(this.aimDir, 8);

    let intensity = this.beamActive ? BEAM_INTENSITY : 0;
    // weak cell sputters below 20%
    if (this.beamActive && this.battery < 20 && Math.random() < 0.06) {
      intensity *= Math.random() * 0.5;
    }
    if (this.flickerTime > 0 && this.beamActive) {
      this.flickerTime -= dt;
      if (Math.random() < 0.4) intensity = Math.random() * 8;
    }
    this.flashlight.intensity = intensity;
  }
}

export { EYE_HEIGHT, RADIUS };
