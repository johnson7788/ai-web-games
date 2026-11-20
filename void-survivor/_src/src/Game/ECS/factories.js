import * as THREE from 'three';
import { makeGlowSprite, particleGeometry } from '../World/Components/Visuals';
import { ARENA_HALF } from '../World/Components/Arena';

/**
 * Entity factories — each entity is an ECS id with component bundles:
 *   transform { pos, rotY }  view { obj }  + role component.
 */

export const ENEMY_DEFS = {
  chaser: {
    color: 0xff3355, glow: 0xff3355, hp: 24, speed: 3.1, damage: 10,
    score: 10, radius: 0.55, baseY: 0.75,
  },
  runner: {
    color: 0xff2d95, glow: 0xff2d95, hp: 12, speed: 5.4, damage: 6,
    score: 15, radius: 0.42, baseY: 0.62,
  },
  tank: {
    color: 0xff9f1c, glow: 0xff9f1c, hp: 90, speed: 1.7, damage: 22,
    score: 30, radius: 0.95, baseY: 1.0,
  },
};

function addView(ecs, id, obj) {
  ecs.add(id, 'view', { obj });
  ecs.get(id, 'transform').pos.y = obj.position.y;
  return obj;
}

export function spawnPlayer(ecs, scene) {
  const id = ecs.create();
  ecs.add(id, 'transform', { pos: new THREE.Vector3(0, 0.55, 0), rotY: Math.PI });

  const group = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 1.15, 4),
    new THREE.MeshStandardMaterial({
      color: 0x062a33, emissive: 0x00f0ff, emissiveIntensity: 1.7,
      roughness: 0.3, metalness: 0.6,
    }),
  );
  hull.rotation.x = Math.PI / 2; // nose toward +Z
  hull.position.y = 0.1;
  group.add(hull);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.05, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0x7ff3ff }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.32;
  group.add(ring);
  const glow = makeGlowSprite(0x00f0ff, 3.2, 0.6);
  group.add(glow);
  group.position.set(0, 0.55, 0);
  scene.add(group);
  addView(ecs, id, group);

  ecs.add(id, 'player', {
    hp: 100, maxHp: 100,
    speed: 8, fireInterval: 0.24, damage: 12,
    fireCd: 0, dashCd: 0, dashT: 0, invuln: 0,
    radius: 0.6,
    aim: new THREE.Vector3(0, 0, -6),
    moveX: 0, moveZ: 0,
    hull, glow,
  });
  return id;
}

export function spawnEnemy(ecs, scene, kind, x, z, wave) {
  const def = ENEMY_DEFS[kind];
  const id = ecs.create();
  const pos = new THREE.Vector3(x, def.baseY, z);
  ecs.add(id, 'transform', { pos, rotY: Math.random() * Math.PI * 2 });

  const group = new THREE.Group();
  let geo;
  if (kind === 'chaser') geo = new THREE.OctahedronGeometry(0.55);
  else if (kind === 'runner') geo = new THREE.TetrahedronGeometry(0.5);
  else geo = new THREE.DodecahedronGeometry(0.95);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x0a0a14, emissive: def.color, emissiveIntensity: 1.35,
    roughness: 0.35, metalness: 0.4,
  });
  const body = new THREE.Mesh(geo, mat);
  group.add(body);
  if (kind === 'tank') {
    const wire = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0xffe0a3, wireframe: true, transparent: true, opacity: 0.3 }),
    );
    wire.scale.setScalar(1.12);
    group.add(wire);
  }
  const glow = makeGlowSprite(def.glow, kind === 'tank' ? 3.4 : 2.3, 0.55);
  group.add(glow);
  group.position.copy(pos);
  scene.add(group);
  addView(ecs, id, group);

  const hpScale = 1 + 0.13 * (wave - 1);
  const speedScale = Math.min(def.speed + (kind === 'runner' ? 0.22 : kind === 'tank' ? 0.09 : 0.16) * wave, def.speed * 1.9);
  ecs.add(id, 'enemy', {
    kind,
    hp: Math.round(def.hp * hpScale),
    maxHp: Math.round(def.hp * hpScale),
    speed: speedScale,
    damage: def.damage,
    radius: def.radius,
    score: def.score,
    baseY: def.baseY,
    touchCd: 0,
    spawnT: 0,
    flash: 0,
    bobPhase: Math.random() * Math.PI * 2,
    spin: (kind === 'runner' ? 3.2 : kind === 'tank' ? 0.7 : 1.6) * (Math.random() > 0.5 ? 1 : -1),
    body, mat, glow,
  });
  return id;
}

export function spawnBullet(ecs, scene, origin, dir, damage) {
  const id = ecs.create();
  const pos = origin.clone();
  pos.y = 0.62;
  ecs.add(id, 'transform', { pos, rotY: 0 });

  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.13, 0.95),
    new THREE.MeshBasicMaterial({ color: 0xc9fbff }),
  );
  group.add(core);
  const glow = makeGlowSprite(0x00f0ff, 1.5, 0.8);
  group.add(glow);
  group.position.copy(pos);
  group.lookAt(pos.clone().add(dir));
  scene.add(group);
  addView(ecs, id, group);

  const vel = dir.clone().setY(0).normalize().multiplyScalar(34);
  ecs.add(id, 'bullet', { vel, life: 1.15, damage, radius: 0.35 });
  return id;
}

export function spawnPickup(ecs, scene, kind, x, z) {
  const id = ecs.create();
  const pos = new THREE.Vector3(x, 0.55, z);
  ecs.add(id, 'transform', { pos, rotY: 0 });

  const color = kind === 'heal' ? 0x37ffb4 : 0xffd166;
  const group = new THREE.Group();
  const geo = kind === 'heal' ? new THREE.IcosahedronGeometry(0.32) : new THREE.OctahedronGeometry(0.3);
  const body = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x0a0a14, emissive: color, emissiveIntensity: 1.8, roughness: 0.3, metalness: 0.4 }),
  );
  group.add(body);
  group.add(makeGlowSprite(color, 1.7, 0.7));
  group.position.copy(pos);
  scene.add(group);
  addView(ecs, id, group);

  ecs.add(id, 'pickup', { kind, life: 12, radius: 0.55, bobPhase: Math.random() * 6, body });
  return id;
}

/* ------------------------------------------------------------------ */
/* Particles                                                           */
/* ------------------------------------------------------------------ */

const MAX_PARTICLES = 420;

function particleCount(ecs) {
  return ecs.query('particle').length;
}

function addParticle(ecs, scene, kind, pos, vel, color, life, opts = {}) {
  if (particleCount(ecs) >= MAX_PARTICLES) return null;
  const id = ecs.create();
  ecs.add(id, 'transform', { pos: pos.clone(), rotY: Math.random() * 6 });
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: opts.opacity ?? 1,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(particleGeometry(kind), mat);
  mesh.position.copy(pos);
  if (kind === 'ring') mesh.rotation.x = -Math.PI / 2;
  if (kind === 'ghost') mesh.rotation.x = Math.PI / 2;
  mesh.scale.setScalar(opts.scale ?? 1);
  scene.add(mesh);
  ecs.add(id, 'view', { obj: mesh });
  ecs.add(id, 'particle', {
    vel: vel.clone(),
    angVel: kind === 'ring' || kind === 'ghost'
      ? new THREE.Vector3()
      : new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8),
    life, maxLife: life,
    gravity: opts.gravity ?? -16,
    shrink: opts.shrink ?? true,
    grow: opts.grow ?? 0,
    mat, kind,
  });
  return id;
}

/** Enemy shatter burst — the signature moment. */
export function shatterBurst(ecs, scene, pos, color, big = false) {
  const n = big ? 12 : 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const sp = 3.5 + Math.random() * 4.5;
    const vel = new THREE.Vector3(Math.cos(a) * sp, 2.5 + Math.random() * 4, Math.sin(a) * sp);
    addParticle(ecs, scene, big && i % 2 ? 'shardBig' : 'shard', pos, vel, color, 0.8 + Math.random() * 0.35);
  }
  for (let i = 0; i < 5; i++) {
    const vel = new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 6, (Math.random() - 0.5) * 10);
    addParticle(ecs, scene, 'spark', pos, vel, 0xffffff, 0.3 + Math.random() * 0.2, { additive: true, gravity: -6 });
  }
  addParticle(ecs, scene, 'ring', new THREE.Vector3(pos.x, 0.08, pos.z), new THREE.Vector3(), color, 0.45, { additive: true, gravity: 0, shrink: false, grow: big ? 14 : 9 });
}

export function hitSparks(ecs, scene, pos, color) {
  for (let i = 0; i < 4; i++) {
    const vel = new THREE.Vector3((Math.random() - 0.5) * 7, Math.random() * 5, (Math.random() - 0.5) * 7);
    addParticle(ecs, scene, 'spark', pos, vel, color, 0.22 + Math.random() * 0.15, { additive: true, gravity: -8 });
  }
}

export function spawnPortal(ecs, scene, x, z, color) {
  addParticle(ecs, scene, 'ring', new THREE.Vector3(x, 0.08, z), new THREE.Vector3(), color, 0.55, { additive: true, gravity: 0, shrink: false, grow: 7 });
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * Math.PI * 2;
    const vel = new THREE.Vector3(Math.cos(a) * 1.5, 3 + Math.random() * 2, Math.sin(a) * 1.5);
    addParticle(ecs, scene, 'spark', new THREE.Vector3(x, 0.2, z), vel, color, 0.4, { additive: true, gravity: -2 });
  }
}

export function dashGhost(ecs, scene, pos, rotY) {
  const id = addParticle(ecs, scene, 'ghost', pos, new THREE.Vector3(), 0x00f0ff, 0.3, { additive: true, gravity: 0, opacity: 0.4, shrink: false });
  if (id != null) {
    const obj = ecs.get(id, 'view').obj;
    obj.rotation.set(Math.PI / 2, 0, 0);
    obj.rotateY(rotY);
  }
}

export function playerExplosion(ecs, scene, pos) {
  shatterBurst(ecs, scene, pos, 0x00f0ff, true);
  shatterBurst(ecs, scene, pos, 0xffffff, false);
}

export function clampToArena(pos, margin = 0.8) {
  const lim = ARENA_HALF - margin;
  pos.x = Math.max(-lim, Math.min(lim, pos.x));
  pos.z = Math.max(-lim, Math.min(lim, pos.z));
}