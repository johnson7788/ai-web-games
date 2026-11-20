import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Arcade speedboat: procedural vertex-coloured hull (bow along +x) plus a rigid
// body driven by throttle/steer. Heave, pitch and roll come from four water
// height queries (bow/stern/port/starboard) evaluated on the real FFT surface.

const MAX_SPEED = 46;      // m/s (~89 kn)
const BOOST_SPEED = 60;    // m/s
const REV_MAX = -9;
const ACCEL = 17;
const BOOST_ACCEL = 30;
const BRAKE = 30;

const col = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
const paint = (geo, c) => {
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
};
const box = (w, h, d, x, y, z, c) => paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);

function buildHull() {
  const L = 7.2, HW = 1.15, SX = 30, SY = 4, SZ = 10;
  const hull = (u, v, w, o) => {
    const t = u + 0.5, zn = Math.abs(2 * w), vv = v + 0.5;
    const f = t < 0.45 ? 0.74 + 0.26 * Math.sin((t / 0.45) * Math.PI / 2) : Math.max(0.03, 1 - ((t - 0.45) / 0.55) ** 1.6);
    const sb = Math.max(0, (t - 0.35) / 0.65);
    const top = 0.52 + 0.3 * sb * sb;
    const keel = -0.42 + 0.34 * Math.max(0, (t - 0.5) / 0.5) ** 1.5;
    const bot = keel + 0.34 * zn ** 1.4;
    return o.set(u * L, bot + (top - bot) * vv, 2 * w * HW * f * (0.82 + 0.18 * vv));
  };
  const g = new THREE.BoxGeometry(1, 1, 1, SX, SY, SZ);
  const pos = g.attributes.position, idx = g.index, orig = pos.array.slice(), p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) hull(orig[i * 3], orig[i * 3 + 1], orig[i * 3 + 2], p), pos.setXYZ(i, p.x, p.y, p.z);
  g.computeVertexNormals();

  const bottom = col(0x14283a), red = col(0xd8352a), white = col(0xf2f0e8), stripe = col(0x1fb6d8);
  const rows = [bottom, bottom, red, red, white];
  const tri = [];
  for (const { start, count, materialIndex: face } of g.groups) {
    for (let i = start; i < start + count; i += 3) {
      let v = 0, w = 0;
      for (let k = 0; k < 3; k++) { const j = idx.getX(i + k); v += orig[j * 3 + 1]; w += orig[j * 3 + 2]; }
      v = v / 3 + 0.5; w = w / 3 + 0.5;
      // deck (py): white with a red centre stripe and cyan sheer line
      if (face === 2) tri[i / 3] = Math.abs(w - 0.5) < 0.14 ? red : Math.abs(w - 0.5) > 0.4 ? stripe : white;
      else tri[i / 3] = face === 3 ? bottom : rows[Math.min(4, Math.floor(v * SY))];
    }
  }
  const hullGeo = g.toNonIndexed();
  const n = hullGeo.attributes.position.count;
  const ca = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const c = tri[Math.floor(i / 3)]; ca[i * 3] = c.r; ca[i * 3 + 1] = c.g; ca[i * 3 + 2] = c.b; }
  hullGeo.setAttribute('color', new THREE.BufferAttribute(ca, 3));

  const parts = [hullGeo];
  // cockpit recess + seats + console
  parts.push(box(2.3, 0.16, 1.5, -0.7, 0.62, 0, col(0x22303c)).toNonIndexed());
  for (const s of [-0.42, 0.42]) {
    parts.push(box(0.55, 0.34, 0.5, -1.05, 0.82, s, col(0xe8e4d8)).toNonIndexed());
    parts.push(box(0.14, 0.5, 0.5, -1.32, 1.05, s, col(0xd8352a)).toNonIndexed());
  }
  parts.push(box(0.5, 0.42, 1.2, 0.35, 0.85, 0, col(0x2a3947)).toNonIndexed());
  // outboard motor
  parts.push(box(0.55, 0.75, 0.42, -3.7, 0.75, 0, col(0x1c242c)).toNonIndexed());
  parts.push(box(0.28, 0.9, 0.2, -3.78, 0.0, 0, col(0x141a20)).toNonIndexed());
  // driver: torso, head, arms
  parts.push(box(0.42, 0.62, 0.4, -0.95, 1.28, 0.42, col(0xff8c1a)).toNonIndexed());
  parts.push(paint(new THREE.SphereGeometry(0.19, 12, 10).translate(-0.95, 1.78, 0.42), col(0xe8b48c)).toNonIndexed());
  parts.push(box(0.5, 0.12, 0.12, -0.62, 1.24, 0.42, col(0xff8c1a)).toNonIndexed());
  // bow rail
  parts.push(paint(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6).rotateZ(Math.PI / 2).translate(2.2, 0.92, 0), col(0xcfd6dc)).toNonIndexed());

  return { geo: mergeGeometries(parts), hull };
}

export class Boat {
  constructor(patchProp) {
    const { geo } = buildHull();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.08 });
    patchProp(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.layers.enable(1);

    // windshield
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.5, 1.35).translate(0.62, 1.12, 0).rotateZ(-0.35),
      new THREE.MeshStandardMaterial({ color: 0x9fd8ef, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.2 }),
    );
    glass.layers.enable(1);
    this.group = new THREE.Group();
    this.group.add(this.mesh, glass);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector2();
    this.heading = 0;
    this.yawVel = 0;
    this.y = 0; this.pitch = 0; this.roll = 0;
    this.speed = 0; this.forwardSpeed = 0;
    this.drifting = false;
    this.hitCooldown = 0;
    this.radius = 3.4;
    this.water = [0, 0, 0, 0];   // bow, stern, port, starboard heights
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    this._q = new THREE.Quaternion();
  }

  reset(x, z, heading) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0);
    this.heading = heading;
    this.yawVel = 0; this.y = 0; this.pitch = 0; this.roll = 0;
    this.speed = 0; this.forwardSpeed = 0; this.hitCooldown = 0;
    this.water.fill(0);
    this.syncMesh();
  }

  // local sample offsets for the water query (bow, stern, port, starboard)
  samplePoints(out) {
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    const pts = [[3.1, 0], [-3.1, 0], [0, -1.05], [0, 1.05]];
    for (let i = 0; i < 4; i++) {
      const [lx, lz] = pts[i];
      out[i * 2] = this.pos.x + lx * c - lz * s;
      out[i * 2 + 1] = this.pos.z + lx * s + lz * c;
    }
    return out;
  }

  ingestWater(result, offset) {
    for (let i = 0; i < 4; i++) this.water[i] = result[(offset + i) * 4];
  }

  step(dt, input, boosting, heightAt, rocks) {
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    const fwdX = Math.cos(this.heading), fwdZ = Math.sin(this.heading);
    const rgtX = -fwdZ, rgtZ = fwdX;
    let vf = this.vel.x * fwdX + this.vel.y * fwdZ;
    let vl = this.vel.x * rgtX + this.vel.y * rgtZ;

    // throttle / brake / reverse
    const max = boosting ? BOOST_SPEED : MAX_SPEED;
    if (input.throttle > 0) {
      vf += (boosting ? BOOST_ACCEL : ACCEL) * dt;
      vf -= vf * 0.04 * dt;
    } else if (input.throttle < 0) {
      if (vf > 0.5) vf -= BRAKE * dt;
      else vf = Math.max(REV_MAX, vf - 8 * dt);
    } else {
      vf -= (vf * 0.45 + vf * Math.abs(vf) * 0.004) * dt;
    }
    vf = Math.min(max, Math.max(REV_MAX, vf));

    // steering with inertia; less authority at top speed, flipped in reverse
    const authority = Math.min(1, Math.abs(vf) / 9) * (1.15 - 0.5 * Math.min(1, Math.abs(vf) / MAX_SPEED));
    const targetYaw = input.steer * 1.35 * authority * (vf < -0.5 ? -1 : 1);
    this.yawVel += (targetYaw - this.yawVel) * Math.min(1, dt * 5.5);
    this.heading += this.yawVel * dt;

    // lateral grip: strong unless steering hard at speed -> drift
    this.drifting = Math.abs(input.steer) > 0.6 && Math.abs(vf) > 20;
    const grip = this.drifting ? 2.1 : 5.5;
    vl *= Math.exp(-grip * dt);
    vl += this.yawVel * vf * dt * 0.22;   // centrifugal slide

    const nfX = Math.cos(this.heading), nfZ = Math.sin(this.heading);
    const nrX = -nfZ, nrZ = nfX;
    this.vel.set(nfX * vf + nrX * vl, nfZ * vf + nrZ * vl);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.y * dt;
    this.forwardSpeed = vf;
    this.speed = this.vel.length();

    // collisions: island shore + rocks. Returns impact speed (0 = none)
    let impact = 0;
    const resolve = (nx, nz, pushX, pushZ) => {
      this.pos.x = pushX; this.pos.z = pushZ;
      const vn = this.vel.x * nx + this.vel.y * nz;
      if (vn < 0) {
        impact = Math.max(impact, -vn);
        this.vel.x -= 1.3 * vn * nx;
        this.vel.y -= 1.3 * vn * nz;
        this.vel.multiplyScalar(0.55);
        this.yawVel *= 0.4;
      }
    };
    const h = heightAt(this.pos.x, this.pos.z);
    if (h > -0.8) {
      const gx = heightAt(this.pos.x + 1.5, this.pos.z) - heightAt(this.pos.x - 1.5, this.pos.z);
      const gz = heightAt(this.pos.x, this.pos.z + 1.5) - heightAt(this.pos.x, this.pos.z - 1.5);
      let nx = -gx, nz = -gz;
      const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      let px = this.pos.x, pz = this.pos.z;
      for (let i = 0; i < 10 && heightAt(px, pz) > -1.0; i++) { px += nx * 1.6; pz += nz * 1.6; }
      resolve(nx, nz, px, pz);
    }
    for (const r of rocks) {
      const dx = this.pos.x - r.x, dz = this.pos.z - r.z;
      const d = Math.hypot(dx, dz), rr = r.r + 1.7;
      if (d < rr && d > 1e-3) resolve(dx / d, dz / d, r.x + (dx / d) * (rr + 0.3), r.z + (dz / d) * (rr + 0.3));
    }

    // attitude from the four water samples + dynamic squat/bank
    const [hB, hS, hP, hSt] = this.water;
    const mean = (hB + hS + hP + hSt) * 0.25;
    const wavePitch = Math.atan2(hB - hS, 6.2) * 0.9;
    const waveRoll = Math.atan2(hP - hSt, 2.1) * 0.85;
    const dynPitch = input.throttle > 0 ? 0.055 * Math.min(1, this.speed / 12) : -0.02;
    const bank = -this.yawVel * Math.min(this.speed, 42) * 0.011;
    const k = Math.min(1, dt * 6.5);
    this.y += (mean + 0.12 - this.y) * k;
    this.pitch += (wavePitch + dynPitch - this.pitch) * k;
    this.roll += (waveRoll + bank - this.roll) * k;
    this.syncMesh();
    return impact;
  }

  syncMesh() {
    this.group.position.set(this.pos.x, this.y, this.pos.z);
    this._e.set(this.roll, -this.heading, this.pitch);
    this.group.quaternion.setFromEuler(this._e);
  }
}

export const BOAT_CONST = { MAX_SPEED, BOOST_SPEED };