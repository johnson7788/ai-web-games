// runtime/character.js — 第三人称角色控制器 + 动画状态机。脚手架复制到 src/core/character.js。
// 铁律：移动/跳跃/碰撞这些实时判定**必须由确定性逻辑算**，不许交给大模型每帧生成。
import * as THREE from '../../lib/three.module.js';

export class ThirdPersonController {
  /**
   * @param {object} o { pos, radius, cfg, groundAt(x,z)->y, colliders:[{x,z,r}], blocked?(x,z)->bool }
   * cfg: walkSpeed runSpeed sprintAccel accel friction gravity jumpVel coyoteMs bufferMs turnRate slopeMax
   */
  constructor(o = {}) {
    const c = o.cfg || {};
    this.pos = o.pos ? o.pos.clone() : new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.radius = o.radius ?? 0.42;
    this.groundAt = o.groundAt || (() => 0);
    this.colliders = o.colliders || [];
    this.walkSpeed = c.walkSpeed ?? 3.2;
    this.runSpeed = c.runSpeed ?? 6.0;
    this.accel = c.accel ?? 26;
    this.friction = c.friction ?? 14;
    this.gravity = c.gravity ?? 22;
    this.jumpVel = c.jumpVel ?? 7.2;
    this.coyote = (c.coyoteMs ?? 120) / 1000;
    this.buffer = (c.jumpBufferMs ?? 150) / 1000;
    this.turnRate = c.turnRate ?? 12;
    this.slopeMax = c.slopeMax ?? 42;
    this.facing = 0;
    this.grounded = false;
    this.coyoteT = 0;
    this.bufferT = 0;
    this.speed = 0;
    this.airTime = 0;
    this.carrying = false;
    this.weightFactor = 1;      // 0..1，负重越重越慢、越难跳
    this.enabled = true;
    this.controlledFall = false;
  }
  teleport(x, y, z) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); }
  /**
   * @param {number} dt 固定步长
   * @param {object} input { move:{x,y}(触屏), axisF, axisS, jump:boolean(边沿), run:boolean, look:{x,y} 由相机侧处理 }
   */
  update(dt, input) {
    if (!this.enabled) { this.speed = 0; return this.snapshot(); }
    let f = (input.axisF || 0) + (input.move ? -input.move.y : 0);
    let s = (input.axisS || 0) + (input.move ? input.move.x : 0);
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    const wantRun = !!input.run && len > 0.1;
    const maxSpeed = (wantRun ? this.runSpeed : this.walkSpeed) * (this.carrying ? Math.max(0.55, 1 - 0.45 * this.weightFactor) : 1);
    // 目标速度在世界空间（输入是相机相对还是世界相对？第三人称用世界相对，简单可靠）
    const tvx = s * maxSpeed;
    const tvz = -f * maxSpeed;
    const k = (this.grounded ? this.accel : this.accel * 0.4) * dt;
    this.vel.x += (tvx - this.vel.x) * Math.min(1, k / Math.max(0.001, maxSpeed) * 3.2);
    this.vel.z += (tvz - this.vel.z) * Math.min(1, k / Math.max(0.001, maxSpeed) * 3.2);
    if (this.grounded && len < 0.02) {
      const d = Math.max(0, 1 - this.friction * dt);
      this.vel.x *= d; this.vel.z *= d;
    }
    // 跳跃：coyote time + jump buffer（输入宽容是手感分水岭）
    this.coyoteT = this.grounded ? this.coyote : Math.max(0, this.coyoteT - dt);
    this.bufferT = input.jump ? this.buffer : Math.max(0, this.bufferT - dt);
    const jumpPower = this.jumpVel * (this.carrying ? Math.max(0.6, 1 - 0.35 * this.weightFactor) : 1);
    if (this.bufferT > 0 && this.coyoteT > 0) {
      this.vel.y = jumpPower;
      this.coyoteT = 0; this.bufferT = 0; this.grounded = false; this.airTime = 0;
    }
    this.vel.y -= this.gravity * dt;
    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;
    this.resolveColliders(nx, nz, dt);
    this.pos.y += this.vel.y * dt;
    const gy = this.groundAt(this.pos.x, this.pos.z);
    if (this.pos.y <= gy) {
      if (!this.grounded) this.landImpact = Math.min(1, Math.abs(this.vel.y) / 14);
      this.pos.y = gy; this.vel.y = 0; this.grounded = true; this.airTime = 0;
    } else {
      this.grounded = false; this.airTime += dt;
    }
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.speed > 0.25) {
      const want = Math.atan2(this.vel.x, this.vel.z);
      let d = want - this.facing;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.facing += d * Math.min(1, this.turnRate * dt);
    }
    return this.snapshot();
  }
  resolveColliders(nx, nz) {
    let px = nx, pz = nz;
    for (const c of this.colliders) {
      if (!c || c.disabled) continue;
      const dx = px - c.x, dz = pz - c.z;
      const rr = (c.r || 0.6) + this.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-9) {
        const d = Math.sqrt(d2), push = (rr - d) / d;
        px += dx * push; pz += dz * push;
      } else if (d2 <= 1e-9) { px = c.x + rr; }
    }
    this.pos.x = px; this.pos.z = pz;
  }
  snapshot() {
    return {
      x: +this.pos.x.toFixed(3), y: +this.pos.y.toFixed(3), z: +this.pos.z.toFixed(3),
      speed: +this.speed.toFixed(3), grounded: this.grounded, facing: +this.facing.toFixed(3),
      carrying: this.carrying, weight: +this.weightFactor.toFixed(2), airTime: +this.airTime.toFixed(2),
    };
  }
}

/** 追踪轨道相机：鼠标/触摸转视角，位置平滑跟随，俯仰夹紧 */
export class OrbitChaseCamera {
  constructor(camera, opts = {}) {
    this.camera = camera;
    this.dist = opts.dist ?? 6.2;
    this.height = opts.height ?? 2.4;
    this.yaw = opts.yaw ?? 0;
    this.pitch = opts.pitch ?? 0.26;
    this.smooth = opts.smooth ?? 8;
    this.pitchMin = opts.pitchMin ?? -0.25;
    this.pitchMax = opts.pitchMax ?? 1.05;
    this.sens = opts.sensitivity ?? 0.0032;
    this.target = new THREE.Vector3();
    this.shake = 0;
  }
  look(dx, dy) {
    this.yaw -= dx * this.sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * this.sens, this.pitchMin, this.pitchMax);
  }
  update(dt, targetPos, opts = {}) {
    const k = Math.min(1, this.smooth * dt);
    this.target.lerp(targetPos, k);
    const d = this.dist * (opts.zoom || 1);
    const cx = this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * d;
    const cz = this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * d;
    const cy = this.target.y + this.height + Math.sin(this.pitch) * d;
    if (opts.snap) this.camera.position.set(cx, cy, cz);
    else this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), k);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const a = this.shake * 0.22;
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
    }
    this.camera.lookAt(this.target.x, this.target.y + 1.15, this.target.z);
    return this.camera.position;
  }
}

/**
 * 动画状态机：AnimationMixer + 交叉淡入淡出。
 * states: { idle:{clip,speed}, walk:{...}, ... }；play(name) 自动 crossfade。
 * 优先级由调用方决定（jump > carry > run > walk > idle），这里只提供机制。
 */
export class AnimStateMachine {
  constructor(mixer, clips, cfg = {}) {
    this.mixer = mixer;
    this.actions = {};
    this.crossFade = cfg.crossfadeSec ?? 0.18;
    this.runThreshold = cfg.runThreshold ?? 4.2;
    this.current = null;
    for (const [name, clip] of Object.entries(clips)) {
      if (!clip) continue;
      const a = mixer.clipAction(clip);
      a.enabled = true;
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = false;
      this.actions[name] = a;
    }
    this.log = [];
  }
  has(name) { return !!this.actions[name]; }
  play(name, { speed = 1, force = false, loop = true } = {}) {
    const next = this.actions[name];
    if (!next) return false;
    if (this.current === name && !force) { this.setSpeed(speed); return true; }
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.timeScale = speed;
    next.fadeIn(this.crossFade);
    next.play();
    if (this.current && this.actions[this.current] && this.actions[this.current] !== next) this.actions[this.current].fadeOut(this.crossFade);
    this.current = name;
    this._speed = speed;
    this.log.push(name);
    if (this.log.length > 40) this.log.shift();
    return true;
  }
  setSpeed(s) {
    const a = this.actions[this.current];
    if (a && Math.abs((this._speed || 1) - s) > 0.05) { a.timeScale = s; this._speed = s; }
  }
  /** 根据运动状态自动选 clip（可被 jump/talk/carry 打断） */
  auto({ grounded, speed, carrying, run, override }) {
    if (override && this.actions[override]) return this.play(override, { speed: 1 });
    if (!grounded) return this.play('jump', { speed: 1 });
    if (carrying && this.actions.carry && speed > 0.35) return this.play('carry', { speed: run ? 1.25 : 1 });
    if (speed > this.runThreshold) return this.play('run', { speed: 1 });
    if (speed > 0.35) return this.play('walk', { speed: run ? 1.3 : 1 });
    return this.play('idle', { speed: 1 });
  }
  update(dt) { if (this.mixer) this.mixer.update(dt); }
}
