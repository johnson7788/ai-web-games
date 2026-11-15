// src/game/sim.js — 纯逻辑核心：cannon-es 布偶决斗 + 抛物线箭矢 + 风 + 5 关 + 升级。
// 无 DOM/window/localStorage/Date.now；随机用 seed（mulberry32）。60Hz 固定步长由 main 调用。
// 判定几何/碰撞/命中全部代码化（不依赖 cannon 接触事件，用确定性 overlap）。
import * as CANNON from '../../lib/cannon-es.js';
import { STEP, WORLD, PLAYER, RAG, ARROW, QUIVER, WIND, LEVELS, ENEMY, UPGRADES, SLOWMO } from '../../config/game.config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- 基础
function emit(run, type, extra) { run.events.push({ type, ...extra }); }

export function drainEvents(run) { const ev = run.events; run.events = []; return ev; }

export function getHud(run) {
  return {
    phase: run.phase, level: run.level, hearts: run.hearts, quiver: run.quiver,
    time: run.time, headshots: run.headshots, wind: run.wind.strength,
    enemiesLeft: run.enemies.filter((e) => e.alive).length,
    drawing: run.player.drawing, aimAngle: run.player.aimAngle, aimPower: run.player.aimPower,
  };
}

function windAccel(run) {
  return run.wind.strength * ARROW.windScale * (run.upgrades.has('wind-reader') ? 0.3 : 1);
}

// 解析解：给定起点/终点/风加速度，求落点初速（最小飞行时间优先）。不可达返回 null。
export function solveVelocity(from, to, windAcc, maxSpeed) {
  const g = -WORLD.GRAVITY;
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  for (let T = 0.25; T <= 2.6; T += 0.05) {
    const vx = (dx - 0.5 * windAcc * T * T) / T;
    const vy = (dy + 0.5 * g * T * T) / T;
    const vz = dz / T;
    const s = Math.hypot(vx, vy, vz);
    if (s <= maxSpeed) return { vx, vy, vz };
  }
  return null;
}

// ---------------------------------------------------------------- 世界/关卡
function newWorld() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, WORLD.GRAVITY, 0) });
  world.allowSleep = true;
  const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  ground.collisionFilterGroup = 1; ground.collisionFilterMask = 2; // 只与布偶碰撞
  world.addBody(ground);
  return world;
}

function box(hx, hy, hz) { return new CANNON.Box(new CANNON.Vec3(hx, hy, hz)); }

// 布偶：6 刚体 + 5 PointToPointConstraint。存活时 KINEMATIC 站桩，击杀切 DYNAMIC 瘫软。
function buildRagdoll(world, x, y, z) {
  const parts = {};
  const B = (shape, mass, pos) => {
    const b = new CANNON.Body({ mass, shape, position: new CANNON.Vec3(pos[0], pos[1], pos[2]) });
    b.linearDamping = RAG.damping; b.angularDamping = RAG.angularDamping;
    b.collisionFilterGroup = 2; b.collisionFilterMask = 1; // 布偶只与地面碰撞
    b.type = CANNON.BODY_TYPES.KINEMATIC;
    world.addBody(b);
    b.base = new CANNON.Vec3(pos[0], pos[1], pos[2]);
    return b;
  };
  const torso = B(box(RAG.torso.w / 2, RAG.torso.h / 2, RAG.torso.d / 2), RAG.torso.mass, [x, y + RAG.torso.y, z]);
  const head = B(new CANNON.Sphere(RAG.head.r), RAG.head.mass, [x, y + RAG.head.y, z]);
  const armL = B(box(RAG.arm.w / 2, RAG.arm.h / 2, RAG.arm.d / 2), RAG.arm.mass, [x, y + RAG.arm.y, z - RAG.arm.offZ]);
  const armR = B(box(RAG.arm.w / 2, RAG.arm.h / 2, RAG.arm.d / 2), RAG.arm.mass, [x, y + RAG.arm.y, z + RAG.arm.offZ]);
  const legL = B(box(RAG.leg.w / 2, RAG.leg.h / 2, RAG.leg.d / 2), RAG.leg.mass, [x, y + RAG.leg.y, z - RAG.leg.offZ]);
  const legR = B(box(RAG.leg.w / 2, RAG.leg.h / 2, RAG.leg.d / 2), RAG.leg.mass, [x, y + RAG.leg.y, z + RAG.leg.offZ]);
  parts.torso = { body: torso, r: 0.44, part: 'torso' };
  parts.head = { body: head, r: RAG.head.r, part: 'head' };
  parts.armL = { body: armL, r: 0.22, part: 'limb' };
  parts.armR = { body: armR, r: 0.22, part: 'limb' };
  parts.legL = { body: legL, r: 0.22, part: 'limb' };
  parts.legR = { body: legR, r: 0.22, part: 'limb' };
  const P = CANNON.PointToPointConstraint;
  const j = (a, pa, b, pb) => world.addConstraint(new P(a, new CANNON.Vec3(...pa), b, new CANNON.Vec3(...pb)));
  j(torso, [0, RAG.torso.h / 2, 0], head, [0, -RAG.head.r * 0.5, 0]);
  j(torso, [0, RAG.arm.y - RAG.torso.y, -RAG.torso.d / 2], armL, [0, RAG.arm.h / 2, 0]);
  j(torso, [0, RAG.arm.y - RAG.torso.y, RAG.torso.d / 2], armR, [0, RAG.arm.h / 2, 0]);
  j(torso, [0, RAG.leg.y - RAG.torso.y, -RAG.torso.d / 2], legL, [0, RAG.leg.h / 2, 0]);
  j(torso, [0, RAG.leg.y - RAG.torso.y, RAG.torso.d / 2], legR, [0, RAG.leg.h / 2, 0]);
  return parts;
}

function buildLevel(run, index) {
  const L = LEVELS[index - 1];
  run.world = newWorld();
  run.enemies = []; run.arrows = []; run.crates = []; run.platforms = [];
  run.wind.strength = L.wind * (run.rng() < 0.5 ? 1 : -1);
  run.windT = WIND.gustIntervalSec;
  if (L.platform) run.platforms.push({ x: WORLD.ENEMY_X, y: 1.0, z: 0, w: 2.4, h: 2.0, d: 3.2 });
  if (L.crates) run.crates.push({ x: 1.5, y: 0.65, z: 0, w: 1.0, h: 1.3, d: 1.2, alive: true });
  const zs = L.enemies === 1 ? [0] : [-1.7, 1.7];
  const baseY = L.platform ? 2.0 : 0;
  for (let i = 0; i < L.enemies; i++) {
    const id = run.enemyId++;
    run.enemies.push({
      id, x: WORLD.ENEMY_X, z: zs[i], baseY, alive: true, facing: -1,
      torsoHits: 0, disarmT: 0, bowDropped: false,
      accuracy: L.accuracy, fireSec: L.enemyFireSec,
      aimT: L.enemyFireSec * (0.6 + run.rng() * 0.8),
      bobPhase: run.rng() * 6.28,
      parts: buildRagdoll(run.world, WORLD.ENEMY_X, baseY, zs[i]),
    });
  }
  run.player.z = 0; run.player.invulnT = 0.5; run.player.drawing = false;
  run.quiver = QUIVER.max; run.trajectory = [];
  run.slowmoT = 0; run.timeScale = 1;
}

export function createRun(opts = {}) {
  const run = {
    seed: opts.seed ?? 1,
    rng: mulberry32(opts.seed ?? 1),
    phase: 'duel', level: 1, time: 0, timeScale: 1,
    hearts: PLAYER.hearts, quiver: QUIVER.max, regenT: 0,
    headshots: 0, levelClearT: 0, slowmoT: 0,
    player: { x: WORLD.PLAYER_X, z: 0, aimAngle: 0.4, aimPower: 0, drawing: false, wasDrawing: false, invulnT: 0, alive: true },
    wind: { strength: 0 }, windT: 0,
    upgrades: new Set(), enemies: [], arrows: [], crates: [], platforms: [], trajectory: [],
    events: [], world: null, enemyId: 1, arrowId: 1,
  };
  buildLevel(run, 1);
  emit(run, 'start', { level: 1 });
  // 契约方法（design-doc §5.3 smoke test）：run.step / getHud / drainEvents / upgrade / solveAim
  run.step = (inp) => updateSim(run, inp);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.getUpgradeChoices = (n = 3) => getUpgradeChoices(run, n);
  run.applyUpgrade = (id) => applyUpgrade(run, id);
  run.solveAim = (part) => solveAim(run, part);
  return run;
}
export const createSim = createRun; // 兼容旧调用

// 调试/验收用：强制击杀当前关所有存活对手（触发 levelClear/slowmo）
export function forceKillEnemies(run) {
  for (const enemy of run.enemies) {
    if (enemy.alive) killEnemy(run, enemy, new CANNON.Vec3(8, 2, 0), 'torso');
  }
}

// ---------------------------------------------------------------- 箭矢
function spawnArrow(run, from, vel, owner, zOff = 0) {
  const b = new CANNON.Body({ mass: ARROW.mass, shape: box(ARROW.length / 2, ARROW.radius, ARROW.radius) });
  b.position.set(from.x, from.y, from.z + zOff);
  b.velocity.set(vel.x, vel.y, vel.z);
  b.linearDamping = 0.02; b.angularDamping = 0.3; b.allowSleep = false;
  b.collisionFilterGroup = 4; b.collisionFilterMask = 0; // 箭矢不参与 cannon 碰撞，命中全部代码判定
  if (vel.length() > 0.001) b.quaternion.setFromVectors(new CANNON.Vec3(1, 0, 0), vel.clone().normalize());
  run.world.addBody(b);
  const arrow = {
    id: run.arrowId++, body: b, owner, flying: true, stuckTo: null,
    pos: new CANNON.Vec3(from.x, from.y, from.z + zOff),
    quat: new CANNON.Quaternion().copy(b.quaternion),
  };
  run.arrows.push(arrow);
  return arrow;
}

function fireArrow(run) {
  if (run.quiver <= 0) { emit(run, 'quiver_empty'); return; }
  const p = run.player;
  const speed = p.aimPower * ARROW.maxSpeed;
  const vx = Math.cos(p.aimAngle) * speed, vy = Math.sin(p.aimAngle) * speed;
  spawnArrow(run, { x: p.x + PLAYER.bowX, y: PLAYER.bowY, z: p.z }, new CANNON.Vec3(vx, vy, 0), 'player');
  if (run.upgrades.has('split-shot')) {
    spawnArrow(run, { x: p.x + PLAYER.bowX, y: PLAYER.bowY, z: p.z }, new CANNON.Vec3(vx, vy, 1.4), 'player');
  }
  run.quiver = Math.max(0, run.quiver - 1);
  emit(run, 'shot', { angle: +p.aimAngle.toFixed(2), power: +p.aimPower.toFixed(2) });
}

function stickArrow(run, arrow, body) {
  arrow.flying = false;
  arrow.stuckTo = body;
  try { run.world.removeBody(arrow.body); } catch { /* already removed */ }
}

function dropArrow(run, arrow) {
  arrow.flying = false;
  arrow.stuckTo = null;
  try { run.world.removeBody(arrow.body); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- 命中
function killEnemy(run, enemy, hitVel, partName) {
  enemy.alive = false;
  const back = new CANNON.Vec3(RAG.collapseSpeed, RAG.collapseUp, 0);
  const v = hitVel ? hitVel.clone() : new CANNON.Vec3();
  for (const p of Object.values(enemy.parts)) {
    p.body.type = CANNON.BODY_TYPES.DYNAMIC;
    p.body.velocity.set(v.x * 0.4 + back.x, Math.max(0, v.y * 0.4) + back.y, v.z * 0.4);
    p.body.angularVelocity.set((run.rng() * 2 - 1) * 3, (run.rng() * 2 - 1) * 3, (run.rng() * 2 - 1) * 3);
  }
  run.slowmoT = SLOWMO.killSec;
  run.timeScale = SLOWMO.timeScale;
  if (partName === 'head') run.headshots++;
  emit(run, 'kill', { headshot: partName === 'head', level: run.level });
  emit(run, 'ragdoll', {});
  if (run.enemies.every((e) => !e.alive)) {
    run.phase = 'levelClear'; run.levelClearT = 1.2;
    emit(run, 'level_clear', { level: run.level });
  }
}

function damageEnemy(run, enemy, name, arrow, hitVel) {
  if (name === 'head') { killEnemy(run, enemy, hitVel, 'head'); return; }
  if (name === 'torso') {
    enemy.torsoHits++;
    if (enemy.torsoHits >= ENEMY.torsoHitsToKill || run.upgrades.has('arrow-dmg')) killEnemy(run, enemy, hitVel, 'torso');
    else emit(run, 'hit', { part: 'torso', hits: enemy.torsoHits });
    return;
  }
  enemy.disarmT = ENEMY.disarmSec; enemy.bowDropped = true;
  emit(run, 'hit', { part: 'limb' });
}

function checkCrateHit(run, arrow) {
  for (const c of run.crates) {
    if (!c.alive) continue;
    const a = arrow.pos;
    if (Math.abs(a.x - c.x) < c.w / 2 + ARROW.radius && a.y < c.h + ARROW.radius && Math.abs(a.z - c.z) < c.d / 2 + ARROW.radius) {
      if (run.upgrades.has('piercing-arrow')) { c.alive = false; emit(run, 'hit', { part: 'crate', pierce: true }); return false; }
      c.alive = false; emit(run, 'hit', { part: 'crate' }); dropArrow(run, arrow); return true;
    }
  }
  return false;
}

function checkEnemyHit(run, arrow) {
  const hitVel = arrow.body.velocity;
  for (const enemy of run.enemies) {
    for (const [name, p] of Object.entries(enemy.parts)) {
      const d = Math.hypot(arrow.pos.x - p.body.position.x, arrow.pos.y - p.body.position.y, arrow.pos.z - p.body.position.z);
      if (d < p.r + ARROW.radius) {
        stickArrow(run, arrow, p.body);
        if (enemy.alive) damageEnemy(run, enemy, p.part === 'limb' ? 'limb' : name, arrow, hitVel);
        return true;
      }
    }
  }
  return false;
}

function playerKnockdown(run) {
  run.hearts--;
  emit(run, 'heart_lost', { hearts: run.hearts });
  if (run.hearts <= 0) { run.phase = 'dead'; run.player.alive = false; emit(run, 'dead'); emit(run, 'fail'); }
  else { resetLevel(run); emit(run, 'level_restart', { level: run.level }); }
}

function checkPlayerHit(run, arrow) {
  if (run.player.invulnT > 0) return false;
  const p = run.player, a = arrow.pos;
  const px = p.x + 0.15, pz = p.z;
  const headY = PLAYER.hitTorsoY + 0.62;
  if (Math.hypot(a.x - px, a.y - headY, a.z - pz) < PLAYER.hitHeadR + ARROW.radius) { dropArrow(run, arrow); playerKnockdown(run); return true; }
  if (Math.abs(a.x - px) < PLAYER.hitTorsoHalf + ARROW.radius && Math.abs(a.y - PLAYER.hitTorsoY) < PLAYER.hitTorsoHalf + ARROW.radius && Math.abs(a.z - pz) < PLAYER.hitTorsoHalf * 1.3) {
    dropArrow(run, arrow); playerKnockdown(run); return true;
  }
  return false;
}

// ---------------------------------------------------------------- 更新
function updateArrows(run, dt) {
  for (let i = 0; i < run.arrows.length; i++) {
    const arrow = run.arrows[i];
    if (!arrow.flying) {
      if (arrow.stuckTo) { arrow.pos.copy(arrow.stuckTo.position); arrow.quat.copy(arrow.stuckTo.quaternion); }
      continue;
    }
    arrow.pos.copy(arrow.body.position);
    arrow.quat.copy(arrow.body.quaternion);
    if (arrow.pos.y < -1 || Math.abs(arrow.pos.x) > 45 || Math.abs(arrow.pos.z) > 45) { dropArrow(run, arrow); continue; }
    if (arrow.owner === 'player') {
      if (checkCrateHit(run, arrow)) continue;
      if (checkEnemyHit(run, arrow)) continue;
      if (arrow.pos.y <= 0.02) { dropArrow(run, arrow); continue; }
    } else {
      if (checkPlayerHit(run, arrow)) { if (run.phase !== 'duel' && run.phase !== 'levelClear') return; continue; }
      if (arrow.pos.y <= 0.02) { dropArrow(run, arrow); continue; }
    }
  }
}

function enemyShoot(run, enemy) {
  const bow = { x: enemy.x - 0.65, y: enemy.baseY + 1.25, z: enemy.z };
  const good = run.rng() < enemy.accuracy;
  // 误射分三类，都保证不会穿过玩家身体：打短（落点在前方地面）/打高（飞过头顶）/打偏（侧面）
  let target;
  if (good) {
    target = { x: run.player.x, y: 1.15, z: run.player.z };
  } else {
    const k = run.rng();
    if (k < 0.4) target = { x: run.player.x - 1.0 - run.rng() * 3.0, y: 0, z: run.player.z + (run.rng() * 2 - 1) * 0.4 };
    else if (k < 0.7) target = { x: run.player.x, y: 4.2 + run.rng() * 2.0, z: run.player.z + (run.rng() * 2 - 1) * 0.4 };
    else target = { x: run.player.x, y: 1.15, z: run.player.z + (run.rng() < 0.5 ? -1 : 1) * (1.3 + run.rng() * 1.8) };
  }
  const sol = solveVelocity(bow, target, windAccel(run), ARROW.maxSpeed);
  const vel = sol ? new CANNON.Vec3(sol.vx, sol.vy, sol.vz) : new CANNON.Vec3(-8, 4, 0);
  spawnArrow(run, bow, vel, 'enemy');
  emit(run, 'enemy_shot', { level: run.level });
}

function updateEnemies(run, dt) {
  for (const enemy of run.enemies) {
    enemy.bobPhase += dt * 2.2;
    const bob = Math.sin(enemy.bobPhase) * 0.02;
    for (const [name, p] of Object.entries(enemy.parts)) {
      if (enemy.alive) {
        p.body.position.set(p.body.base.x, p.body.base.y + (name === 'head' || name === 'torso' ? bob : 0), p.body.base.z);
      }
    }
    if (!enemy.alive) continue;
    if (enemy.disarmT > 0) { enemy.disarmT -= dt; continue; }
    enemy.aimT -= dt;
    if (enemy.aimT <= 0) { enemyShoot(run, enemy); enemy.aimT = enemy.fireSec; }
  }
}

export function updateSim(run, input) {
  if (run.phase !== 'duel' && run.phase !== 'levelClear') return;
  const dt = STEP * run.timeScale;
  run.time += STEP;

  // 玩家：横移 + 拉弓（power 缓动，draw-speed 更快满弓）
  const p = run.player;
  const inp = input || {};
  if (inp.strafe) {
    const sp = PLAYER.zSpeed * (run.upgrades.has('move-speed') ? 1.4 : 1);
    p.z = clamp(p.z + inp.strafe * sp * STEP, -WORLD.ARENA_Z, WORLD.ARENA_Z);
  }
  p.drawing = !!inp.aim;
  if (inp.aim) {
    if (!p.wasDrawing) emit(run, 'draw');
    p.aimAngle = clamp(inp.aim.angle, ARROW.minAngle, ARROW.maxAngle);
    const target = clamp(inp.aim.power, 0, 1);
    const rate = run.upgrades.has('draw-speed') ? 3.2 : 2.0;
    p.aimPower += clamp(target - p.aimPower, -rate * STEP, rate * STEP);
    computeTrajectory(run);
  } else {
    p.aimPower *= 0.7; // 松弦后功率回落
    run.trajectory = [];
  }
  p.wasDrawing = p.drawing;
  if (inp.fire && p.drawing && run.phase === 'duel') fireArrow(run);

  // 风阵
  run.windT -= STEP;
  if (run.windT <= 0 && LEVELS[run.level - 1].wind > 0) {
    run.wind.strength = (run.rng() * 2 - 1) * WIND.max * (LEVELS[run.level - 1].wind / WIND.max);
    run.windT = WIND.gustIntervalSec;
    emit(run, 'wind', { strength: +run.wind.strength.toFixed(2) });
  }

  // 箭袋补给
  if (run.quiver < QUIVER.max) {
    run.regenT += STEP;
    const interval = QUIVER.regenSec * (run.upgrades.has('quiver-cycle') ? 0.5 : 1);
    if (run.regenT >= interval) { run.quiver++; run.regenT = 0; }
  }

  updateEnemies(run, dt);

  // 风作用于飞行箭矢
  const wAcc = windAccel(run);
  for (const arrow of run.arrows) {
    if (arrow.flying) arrow.body.applyForce(new CANNON.Vec3(wAcc * arrow.body.mass, 0, 0));
  }

  run.world.step(dt, dt, 3);
  updateArrows(run, dt);

  // 无敌/慢放/关卡结算
  p.invulnT = Math.max(0, p.invulnT - STEP);
  if (run.slowmoT > 0) { run.slowmoT -= STEP; if (run.slowmoT <= 0) run.timeScale = 1; }
  if (run.phase === 'levelClear') {
    run.levelClearT -= STEP;
    if (run.levelClearT <= 0) {
      if (run.level < LEVELS.length) { run.phase = 'upgrade'; emit(run, 'upgrade_offer', { level: run.level }); }
      else { run.phase = 'won'; emit(run, 'win'); }
    }
  }
}

function computeTrajectory(run) {
  const p = run.player;
  const speed = p.aimPower * ARROW.maxSpeed;
  const vx = Math.cos(p.aimAngle) * speed, vy = Math.sin(p.aimAngle) * speed;
  const wx = windAccel(run), g = WORLD.GRAVITY;
  const x0 = p.x + PLAYER.bowX, y0 = PLAYER.bowY, z0 = p.z;
  const pts = [];
  for (let i = 0; i < 12; i++) {
    const t = i * 0.07;
    const x = x0 + vx * t + 0.5 * wx * t * t;
    const y = y0 + vy * t + 0.5 * g * t * t;
    if (y < 0) break;
    pts.push({ x, y, z: z0 });
  }
  run.trajectory = pts;
}

function resetLevel(run) {
  const lvl = run.level;
  buildLevel(run, lvl);
}

// ---------------------------------------------------------------- 升级
export function getUpgradeChoices(run, n = 3) {
  const pool = UPGRADES.filter((u) => !run.upgrades.has(u.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(run.rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n).map((u) => u.id);
}

export function applyUpgrade(run, id) {
  if (!UPGRADES.find((u) => u.id === id) || run.upgrades.has(id)) return false;
  run.upgrades.add(id);
  run.level++;
  run.phase = 'duel';
  buildLevel(run, run.level);
  emit(run, 'upgrade', { id });
  emit(run, 'start', { level: run.level });
  return true;
}

// ---------------------------------------------------------------- 自动瞄准
export function solveAim(run, part = 'torso') {
  const enemy = run.enemies.find((e) => e.alive);
  if (!enemy) return { angle: Math.PI / 4, power: 0.5 };
  const p = enemy.parts[part] || enemy.parts.torso;
  const bow = { x: run.player.x + PLAYER.bowX, y: PLAYER.bowY, z: run.player.z };
  const target = { x: p.body.position.x, y: p.body.position.y, z: p.body.position.z };
  const sol = solveVelocity(bow, target, windAccel(run), ARROW.maxSpeed);
  if (!sol) return { angle: Math.PI / 4, power: 1 };
  const speed = Math.hypot(sol.vx, sol.vy, sol.vz);
  return { angle: Math.atan2(sol.vy, Math.hypot(sol.vx, sol.vz)), power: clamp(speed / ARROW.maxSpeed, ARROW.minPower, 1) };
}
