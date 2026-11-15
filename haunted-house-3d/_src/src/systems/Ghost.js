import * as THREE from 'three';
import { ghostFaceTexture } from '../world/Textures.js';
import { BOUNDS } from '../world/House.js';

const CHASE_SPEED = 3.3;
const STALK_SPEED = 1.25;
const CATCH_DIST = 0.75;
const BURN_TIME_STALK = 1.6;   // seconds of beam to banish a stalker
const BURN_TIME_CHASE = 2.4;   // he is stronger once fully awake
const BANISH_DOWNTIME = 8;     // chase: seconds before he reforms

export class Ghost {
  constructor(scene) {
    this.scene = scene;
    this.mode = 'hidden';   // hidden | apparition | stalk | chase | banished
    this.apparitionTimer = 0;
    this.stalkTimer = 0;
    this.banishTimer = 0;
    this.flickerClock = 0;
    this.faceClock = 0;
    this.bobClock = Math.random() * 10;
    this.burnMeter = 0;
    this.burning = false;
    this.banishCount = 0;

    this._build();
    this.group.visible = false;
    scene.add(this.group);
  }

  _build() {
    this.group = new THREE.Group();
    this.shroudMats = [];

    const shroud = (opacity) => {
      const m = new THREE.MeshStandardMaterial({
        color: 0x04040a, roughness: 1, transparent: true, opacity,
      });
      this.shroudMats.push(m);
      return m;
    };

    // gaunt core — taller than a man
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.55, 2.5, 10, 6), shroud(0.94));
    body.position.y = 1.25;
    this.group.add(body);
    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), shroud(0.94));
    shoulders.position.y = 2.28;
    shoulders.scale.set(1.3, 0.6, 0.8);
    this.group.add(shoulders);

    // tattered hanging strips that flutter
    this.strips = [];
    for (let i = 0; i < 7; i++) {
      const w = 0.1 + Math.random() * 0.12;
      const h = 0.8 + Math.random() * 0.9;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 4), shroud(0.5 + Math.random() * 0.3));
      strip.material.side = THREE.DoubleSide;
      const a = (i / 7) * Math.PI * 2;
      strip.position.set(Math.cos(a) * 0.3, 0.9 - Math.random() * 0.3, Math.sin(a) * 0.3);
      strip.rotation.y = -a;
      strip.userData.phase = Math.random() * 10;
      this.group.add(strip);
      this.strips.push(strip);
    }

    // long arms ending in claw fingers
    this.arms = [];
    for (const side of [-1, 1]) {
      const armGroup = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.055, 1.65, 6), shroud(0.92));
      arm.position.y = -0.78;
      armGroup.add(arm);
      const hand = new THREE.Group();
      hand.position.y = -1.6;
      for (let f = 0; f < 4; f++) {
        const finger = new THREE.Mesh(
          new THREE.CylinderGeometry(0.006, 0.013, 0.26, 4),
          new THREE.MeshStandardMaterial({ color: 0x787068, roughness: 0.9 })
        );
        finger.position.set((f - 1.5) * 0.035, -0.1, 0.02);
        finger.rotation.x = 0.5 + f * 0.07;
        hand.add(finger);
      }
      armGroup.add(hand);
      armGroup.position.set(side * 0.36, 2.2, 0.04);
      armGroup.rotation.z = side * 0.2;
      armGroup.userData.side = side;
      this.group.add(armGroup);
      this.arms.push(armGroup);
    }

    // animated face — cycles between expressions
    this.faces = [ghostFaceTexture(0), ghostFaceTexture(1), ghostFaceTexture(2)];
    this.faceMat = new THREE.MeshBasicMaterial({
      map: this.faces[0], transparent: true, opacity: 0.96, depthWrite: false,
    });
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.58), this.faceMat);
    this.face.position.y = 2.5;
    this.group.add(this.face);

    // eyes pierce the dark even unlit
    this.eyeLight = new THREE.PointLight(0x96b4cc, 1.8, 5, 2);
    this.eyeLight.position.y = 2.48;
    this.group.add(this.eyeLight);

    // black vapor trailing off him
    const N = 50;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.7;
      pos[i * 3 + 1] = Math.random() * 2.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.7;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.smoke = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x1a1a26, size: 0.09, transparent: true, opacity: 0.5, depthWrite: false,
    }));
    this.group.add(this.smoke);
  }

  /* ---------------- states ---------------- */

  appearAt(pos, duration = 1.2) {
    this.group.position.set(pos.x, 0, pos.z);
    this.mode = 'apparition';
    this.apparitionTimer = duration;
    this.group.visible = true;
  }

  vanish() {
    this.mode = 'hidden';
    this.group.visible = false;
    this.burnMeter = 0;
  }

  /** Pre-finale hunting phase: he manifests and drifts toward the player. */
  startStalk(spawnPos, lifespan = 20) {
    this.group.position.set(spawnPos.x, 0, spawnPos.z);
    this.mode = 'stalk';
    this.stalkTimer = lifespan;
    this.burnMeter = 0;
    this.group.visible = true;
  }

  startChase(spawnPos) {
    this.group.position.set(spawnPos.x, 0, spawnPos.z);
    this.mode = 'chase';
    this.burnMeter = 0;
    this.group.visible = true;
  }

  get engaged() { return this.mode === 'stalk' || this.mode === 'chase'; }

  /** Beam is on him. Returns 'banished' the moment the meter fills. */
  applyBurn(dt) {
    if (!this.engaged) return null;
    this.burning = true;
    const burnTime = this.mode === 'chase' ? BURN_TIME_CHASE : BURN_TIME_STALK;
    this.burnMeter += dt / burnTime;
    if (this.burnMeter >= 1) {
      this._banish();
      return 'banished';
    }
    return 'burning';
  }

  stopBurn() { this.burning = false; }

  _banish() {
    this.banishCount++;
    this.burnMeter = 0;
    this.burning = false;
    if (this.mode === 'chase') {
      this.mode = 'banished';
      this.banishTimer = BANISH_DOWNTIME;
      this.group.visible = false;
    } else {
      this.vanish();
    }
  }

  /* ---------------- update ---------------- */

  /** @returns true the moment the player is caught */
  update(dt, playerPos, t) {
    if (this.mode === 'banished') {
      this.banishTimer -= dt;
      if (this.banishTimer <= 0) {
        // he reforms out of reach and resumes the hunt
        const a = Math.random() * Math.PI * 2;
        const x = THREE.MathUtils.clamp(playerPos.x + Math.cos(a) * 10, BOUNDS.minX + 1, BOUNDS.maxX - 1);
        const z = THREE.MathUtils.clamp(playerPos.z + Math.sin(a) * 10, BOUNDS.minZ + 1, BOUNDS.maxZ - 1);
        this.startChase(new THREE.Vector3(x, 0, z));
      }
      return false;
    }
    if (this.mode === 'hidden') return false;

    // face the player
    const dx = playerPos.x - this.group.position.x;
    const dz = playerPos.z - this.group.position.z;
    const dist = Math.hypot(dx, dz);
    this.group.rotation.y = Math.atan2(dx, dz);

    // uneasy hover + breathing scale
    this.bobClock += dt;
    this.group.position.y = Math.sin(this.bobClock * 1.7) * 0.06;
    const breathe = 1 + Math.sin(this.bobClock * 2.3) * 0.02;
    this.group.scale.set(breathe, 1 / breathe, breathe);

    // tatters flutter
    for (const s of this.strips) {
      s.rotation.x = Math.sin(t * 2.1 + s.userData.phase) * 0.22;
      s.rotation.z = Math.sin(t * 1.4 + s.userData.phase * 2) * 0.14;
    }
    // arms reach forward as he closes in
    const reach = THREE.MathUtils.clamp(1 - dist / 6, 0, 1);
    for (const a of this.arms) {
      a.rotation.x = -0.25 - reach * 1.1 + Math.sin(t * 3 + a.userData.side) * 0.06;
      a.rotation.z = a.userData.side * (0.2 - reach * 0.15);
    }
    // expression shifts at random — never on a rhythm
    this.faceClock -= dt;
    if (this.faceClock <= 0) {
      this.faceMat.map = this.faces[Math.floor(Math.random() * this.faces.length)];
      this.faceClock = this.mode === 'chase' ? 0.08 + Math.random() * 0.25 : 0.4 + Math.random() * 1.2;
    }
    // burning: he recoils, eyes white out, body thrashes
    if (this.burning) {
      this.eyeLight.intensity = 4 + Math.random() * 4;
      this.eyeLight.color.setHex(0xfff4dd);
      this.group.position.x += (Math.random() - 0.5) * 0.05;
      this.group.position.z += (Math.random() - 0.5) * 0.05;
      for (const m of this.shroudMats) m.opacity = Math.max(0.25, m.opacity - dt * 0.3);
    } else {
      this.eyeLight.intensity = 1.8;
      this.eyeLight.color.setHex(0x96b4cc);
      for (const m of this.shroudMats) m.opacity = Math.min(0.94, m.opacity + dt * 0.5);
      this.burnMeter = Math.max(0, this.burnMeter - dt * 0.45);
    }

    // smoke churn
    const p = this.smoke.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * 0.5;
      if (y > 2.6) y = 0.1;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t * 3 + i) * dt * 0.05);
    }
    p.needsUpdate = true;

    if (this.mode === 'apparition') {
      this.apparitionTimer -= dt;
      this.group.visible = Math.random() > 0.25;
      if (this.apparitionTimer <= 0) this.vanish();
      return false;
    }

    // ----- movement: glides through walls, lurching, never smooth -----
    const slow = this.burning ? 0.3 : 1;
    const base = this.mode === 'chase' ? CHASE_SPEED : STALK_SPEED;
    const lurch = 1 + Math.sin(this.bobClock * 8.5) * 0.55;   // surging gait
    if (dist > 0.001) {
      const step = Math.min(base * slow * lurch * dt, dist);
      this.group.position.x += (dx / dist) * step;
      this.group.position.z += (dz / dist) * step;
      // lateral drift so he weaves at you
      if (this.mode === 'chase') {
        const px = -dz / dist, pz = dx / dist;
        const sway = Math.sin(this.bobClock * 2.7) * 0.5 * dt;
        this.group.position.x += px * sway;
        this.group.position.z += pz * sway;
      }
    }

    if (this.mode === 'stalk') {
      this.stalkTimer -= dt;
      if (this.stalkTimer <= 0) { this.vanish(); return false; }
      // stalker is patient — solid, slow, staring
      this.group.visible = true;
    } else {
      // chase: corrupted-frame strobing
      this.flickerClock -= dt;
      if (this.flickerClock <= 0) {
        this.group.visible = !this.group.visible;
        this.flickerClock = this.group.visible ? 0.12 + Math.random() * 0.3 : 0.04 + Math.random() * 0.1;
      }
    }

    return dist < CATCH_DIST;
  }

  distanceTo(playerPos) {
    return Math.hypot(playerPos.x - this.group.position.x, playerPos.z - this.group.position.z);
  }
}
