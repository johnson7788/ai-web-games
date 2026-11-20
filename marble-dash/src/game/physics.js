// Marble Dash — original lightweight physics: a ball rolling on a tilting board.
// Everything is computed in board-local space; gravity is the world "down"
// vector rotated by the inverse board tilt. No external physics library.
import * as THREE from 'three';
import { rampHeight } from './levels.js';

export const P = {
  G: 25,              // gravity magnitude
  MAX_TILT: 0.24,     // rad (~13.7 deg)
  TILT_RATE: 7.5,     // tilt smoothing
  ROLL_K: 5 / 7,      // solid-sphere rolling factor
  DAMP_GROUND: 0.30,  // rolling resistance (1/s)
  DAMP_AIR: 0.02,
  MAX_SPEED: 15.5,
  R: 0.5,             // ball radius
  REST: 0.42,         // wall restitution
  SUBSTEP: 1 / 120,
  FALL_Y: -12,
  EDGE_FORGIVE: 0.12, // center may overhang edge slightly
};

const _q = new THREE.Quaternion();
const _g = new THREE.Vector3();
const _e = new THREE.Euler();

export class Physics {
  constructor() {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.pitch = 0; this.roll = 0;
    this.targetPitch = 0; this.targetRoll = 0;
    this.grounded = false;
    this.onMover = null;
    this.events = [];       // drained by game each frame
    this.time = 0;
    this.rt = null;
    this.spinAxis = new THREE.Vector3(1, 0, 0);
    this.spinSpeed = 0;
    this.lastSupportY = 0;
  }

  load(rt, spawn) {
    this.rt = rt;
    this.time = 0;
    this.pitch = this.roll = this.targetPitch = this.targetRoll = 0;
    this.events.length = 0;
    this.respawn(spawn);
  }

  respawn(spawn) {
    this.pos.set(spawn.x, (spawn.y || 0) + P.R + 0.02, spawn.z);
    this.vel.set(0, 0, 0);
    this.grounded = true;
    this.onMover = null;
    this.lastSupportY = 0;
  }

  setTiltFromInput(ix, iz) {
    // ix: +1 = tilt right (D), iz: +1 = tilt forward (W)
    this.targetRoll = -ix * P.MAX_TILT;
    this.targetPitch = -iz * P.MAX_TILT;
  }

  emit(type, data) { this.events.push({ type, ...data }); }

  // highest supporting surface under (x,z); returns {y, mover?, ramp?} or null
  support(x, z) {
    let best = null;
    const f = P.EDGE_FORGIVE;
    for (const s of this.rt.supports) {
      if (s.ramp) {
        const h = rampHeight(s.ramp, x, z);
        if (h !== null && (!best || h > best.y)) best = { y: h, ramp: s.ramp };
      } else {
        if (x >= s.x0 - f && x <= s.x1 + f && z >= s.z0 - f && z <= s.z1 + f) {
          if (!best || s.y > best.y) best = { y: s.y, mover: s.mover || null };
        }
      }
    }
    return best;
  }

  step(dt) {
    const rt = this.rt;
    if (!rt) return;
    this.time += dt;

    // smooth board tilt
    const k = Math.min(1, P.TILT_RATE * dt);
    this.pitch += (this.targetPitch - this.pitch) * k;
    this.roll += (this.targetRoll - this.roll) * k;

    // gravity in board space
    _e.set(this.pitch, 0, this.roll, 'XYZ');
    _q.setFromEuler(_e).invert();
    _g.set(0, -P.G, 0).applyQuaternion(_q);

    // moving platforms: advance & compute carry delta
    for (const m of rt.movers) {
      const off = Math.sin(this.time * m.speed + m.phase) * m.range;
      const nx = m.axis === 'x' ? m.x + off : m.x;
      const nz = m.axis === 'z' ? m.z + off : m.z;
      m.dx = nx - m.px; m.dz = nz - m.pz;
      m.px = nx; m.pz = nz;
      m.sup.x0 = nx - m.w / 2; m.sup.x1 = nx + m.w / 2;
      m.sup.z0 = nz - m.d / 2; m.sup.z1 = nz + m.d / 2;
    }
    for (const s of rt.spinners) { s.angle = this.time * s.speed; s.cd = Math.max(0, s.cd - dt); }
    for (const b of rt.boosts) b.cd = Math.max(0, b.cd - dt);

    const p = this.pos, v = this.vel;

    // carry by mover
    if (this.grounded && this.onMover) { p.x += this.onMover.dx; p.z += this.onMover.dz; }

    // support & vertical state
    const sup = this.support(p.x, p.z);
    const wasGrounded = this.grounded;
    // Ground whenever a surface is at/below the ball's feet. Ramp launches
    // survive because v.y (surface-follow) is kept when support disappears.
    if (sup && p.y - P.R <= sup.y + 0.14) {
      // grounded: follow surface
      const impactVy = v.y;
      const newY = sup.y + P.R;
      const vy = (newY - p.y) / dt;
      p.y = newY;
      if (!wasGrounded && impactVy < -3.5) this.emit('land', { speed: -impactVy });
      // keep upward surface-follow velocity: this is what launches off ramp lips
      v.y = Math.max(0, Math.min(20, vy));
      this.grounded = true;
      this.onMover = sup.mover || null;
      this.lastSupportY = sup.y;
      // rolling acceleration from tilted gravity
      v.x += _g.x * P.ROLL_K * dt;
      v.z += _g.z * P.ROLL_K * dt;
      const d = Math.exp(-P.DAMP_GROUND * dt);
      v.x *= d; v.z *= d;
    } else {
      if (wasGrounded && !sup) {
        // rolled off an edge: keep surface-follow vy (ramp launches happen here)
      }
      this.grounded = false;
      this.onMover = null;
      v.x += _g.x * dt; v.y += _g.y * dt; v.z += _g.z * dt;
      const d = Math.exp(-P.DAMP_AIR * dt);
      v.x *= d; v.z *= d;
    }

    // speed cap (horizontal)
    const hs = Math.hypot(v.x, v.z);
    if (hs > P.MAX_SPEED) { v.x *= P.MAX_SPEED / hs; v.z *= P.MAX_SPEED / hs; }

    // integrate
    p.x += v.x * dt;
    p.z += v.z * dt;
    if (!this.grounded) p.y += v.y * dt;

    // ---- wall collisions (sphere vs AABB in XZ)
    for (const w of rt.walls) {
      if (p.y - P.R >= w.y1 - 0.03 || p.y + P.R <= w.y0) continue;
      const cx = Math.max(w.x0, Math.min(p.x, w.x1));
      const cz = Math.max(w.z0, Math.min(p.z, w.z1));
      let dx = p.x - cx, dz = p.z - cz;
      let d2 = dx * dx + dz * dz;
      if (d2 >= P.R * P.R) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        const nx = dx / d, nz = dz / d, pen = P.R - d;
        p.x += nx * pen; p.z += nz * pen;
        const vn = v.x * nx + v.z * nz;
        if (vn < 0) {
          v.x -= (1 + P.REST) * vn * nx;
          v.z -= (1 + P.REST) * vn * nz;
          if (-vn > 2.2) this.emit('bounce', { speed: -vn, x: p.x, z: p.z });
        }
      } else {
        // center inside rect: push along min-penetration axis
        const pens = [p.x - w.x0 + P.R, w.x1 - p.x + P.R, p.z - w.z0 + P.R, w.z1 - p.z + P.R];
        const mi = pens.indexOf(Math.min(...pens));
        if (mi === 0) { p.x = w.x0 - P.R; v.x = -Math.abs(v.x) * P.REST; }
        else if (mi === 1) { p.x = w.x1 + P.R; v.x = Math.abs(v.x) * P.REST; }
        else if (mi === 2) { p.z = w.z0 - P.R; v.z = -Math.abs(v.z) * P.REST; }
        else { p.z = w.z1 + P.R; v.z = Math.abs(v.z) * P.REST; }
        this.emit('bounce', { speed: 3, x: p.x, z: p.z });
      }
    }

    // ---- spinner arms (rotated box knock)
    for (const s of rt.spinners) {
      // center post collider
      {
        const dx = p.x - s.x, dz = p.z - s.z;
        const rr = 0.34 + P.R;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-9 && p.y - P.R < s.y + 1 && p.y + P.R > s.y) {
          const d = Math.sqrt(d2);
          p.x = s.x + (dx / d) * rr; p.z = s.z + (dz / d) * rr;
          const nx = dx / d, nz = dz / d;
          const vn = v.x * nx + v.z * nz;
          if (vn < 0) { v.x -= 1.4 * vn * nx; v.z -= 1.4 * vn * nz; }
        }
      }
      const armTop = s.y + 0.85, armBot = s.y + 0.25;
      if (p.y - P.R >= armTop || p.y + P.R <= armBot) continue;
      const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
      const rx = p.x - s.x, rz = p.z - s.z;
      // three.js rotation.y convention: world->local
      const lx = rx * ca - rz * sa;
      const lz = rx * sa + rz * ca;
      const hx = s.len / 2, hz = 0.3;
      const cx = Math.max(-hx, Math.min(lx, hx));
      const cz = Math.max(-hz, Math.min(lz, hz));
      let dx = lx - cx, dz = lz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= P.R * P.R || d2 < 1e-9) continue;
      const d = Math.sqrt(d2);
      const nlx = dx / d, nlz = dz / d, pen = P.R - d;
      // local->world normal
      const nxl = nlx * ca + nlz * sa;
      const nzl = -nlx * sa + nlz * ca;
      p.x += nxl * (pen + 0.02); p.z += nzl * (pen + 0.02);
      const dist = Math.hypot(rx, rz);
      const knock = 3.4 + Math.abs(s.speed) * dist * 0.9;
      v.x = v.x * 0.25 + nxl * knock;
      v.z = v.z * 0.25 + nzl * knock;
      v.y = Math.max(v.y, 1.6);
      if (s.cd <= 0) { this.emit('hit', { x: p.x, z: p.z }); s.cd = 0.3; }
    }

    // ---- bumpers (elastic circles)
    for (const b of rt.bumpers) {
      if (p.y - P.R >= b.y + 0.95 || p.y + P.R <= b.y) continue;
      const dx = p.x - b.x, dz = p.z - b.z;
      const rr = b.r + P.R;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 < 1e-9) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d, nz = dz / d;
      p.x = b.x + nx * rr; p.z = b.z + nz * rr;
      const vn = v.x * nx + v.z * nz;
      const out = Math.max(5, -vn * 1.15 + 2.5);
      v.x = nx * out + v.x * 0.15;
      v.z = nz * out + v.z * 0.15;
      this.emit('bumper', { x: b.x, z: b.z, idx: rt.bumpers.indexOf(b) });
    }

    // ---- boost strips
    if (this.grounded) {
      for (const b of rt.boosts) {
        if (b.cd > 0) continue;
        if (Math.abs(p.y - P.R - b.y) > 0.3) continue;
        if (p.x < b.x0 || p.x > b.x1 || p.z < b.z0 || p.z > b.z1) continue;
        v.x += b.dir[0] * b.power;
        v.z += b.dir[1] * b.power;
        b.cd = 0.9;
        this.emit('boost', { x: p.x, z: p.z });
      }
    }

    // ---- gems
    for (let i = 0; i < rt.gems.length; i++) {
      const g = rt.gems[i];
      if (g.taken) continue;
      const dx = p.x - g.x, dy = p.y - g.y, dz = p.z - g.z;
      if (dx * dx + dy * dy + dz * dz < 0.95 * 0.95) {
        g.taken = true;
        this.emit('gem', { idx: i, x: g.x, y: g.y, z: g.z });
      }
    }

    // ---- checkpoints
    for (let i = 0; i < rt.checkpoints.length; i++) {
      const c = rt.checkpoints[i];
      if (c.active || !this.grounded) continue;
      if (Math.hypot(p.x - c.x, p.z - c.z) < 1.35) {
        c.active = true;
        this.emit('checkpoint', { idx: i, x: c.x, z: c.z, y: c.y || 0 });
      }
    }

    // ---- goal
    const gl = rt.goal;
    if (this.grounded && Math.hypot(p.x - gl.x, p.z - gl.z) < 0.72 && Math.abs(p.y - P.R - gl.y) < 0.4) {
      this.emit('goal', {});
    }

    // ---- fell out of the world
    if (p.y < P.FALL_Y) this.emit('fall', {});

    // visual spin (rolling without slipping)
    this.spinSpeed = Math.hypot(v.x, v.z) / P.R;
    if (this.spinSpeed > 0.01) this.spinAxis.set(-v.z, 0, v.x).normalize();
  }

  update(frameDt) {
    let n = Math.min(6, Math.ceil(frameDt / P.SUBSTEP));
    const dt = frameDt / n;
    for (let i = 0; i < n; i++) this.step(dt);
  }
}