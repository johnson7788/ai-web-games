// src/game/sim.js — 纯逻辑体素大逃杀：缩圈 / 建造 / 射击 / 拾取 / bot AI。
// 不碰 DOM / window / localStorage / Date.now；随机全部走 seed。
import { STEP, MAP, PLAYER, BOTS, WEAPONS, BUILD, ZONE, LOOT, DROP, RATINGS } from '../../config/game.config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az; return dx * dx + dz * dz; };

const KIND = { NONE: 0, BUILDING: 1, WALL: 2, RAMP: 3 };

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cellIndex(x, z) {
  const cx = Math.floor(x), cz = Math.floor(z);
  if (cx < 0 || cz < 0 || cx >= MAP.size || cz >= MAP.size) return -1;
  return cx + cz * MAP.size;
}

function weaponRank(w) { return w === 'sniper' ? 3 : w === 'rifle' ? 2 : w === 'pistol' ? 1 : 0; }

function makeEntity(id, isPlayer, x, z, yaw) {
  return {
    id, isPlayer, x, z, y: DROP.planeY, yaw: yaw ?? 0, pitch: 0,
    hp: PLAYER.hp, armor: 0, weapon: null, ammo: 0, mag: 0,
    blocks: 0, meds: 0, alive: true, kills: 0,
    cd: 0, reloadT: 0, targetId: null,
    // bot 专用
    spawnX: x, spawnZ: z, strafeDir: 1, buildCd: 0,
  };
}

export function createSim({ seed = 1 } = {}) {
  const rng = mulberry32(seed);
  const n = MAP.size, c = MAP.center;
  const base = new Int8Array(n * n);
  const top = new Int8Array(n * n);
  const hp = new Int8Array(n * n);
  const kind = new Uint8Array(n * n);

  // 岛：岛内地面 0，岛外水 -1
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - c, z + 0.5 - c);
      base[x + z * n] = d < MAP.islandRadius ? 0 : -1;
      top[x + z * n] = base[x + z * n];
    }
  }

  // 体素建筑群
  let bCount = 26;
  while (bCount-- > 0) {
    const bx = c + (rng() * 2 - 1) * MAP.islandRadius * 0.72;
    const bz = c + (rng() * 2 - 1) * MAP.islandRadius * 0.72;
    const w = 2 + Math.floor(rng() * 3);
    const d = 2 + Math.floor(rng() * 3);
    const h = 2 + Math.floor(rng() * 4);
    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        const i = cellIndex(Math.floor(bx) + dx, Math.floor(bz) + dz);
        if (i < 0 || base[i] < 0) continue;
        base[i] = 0; top[i] = h; hp[i] = BUILD.blockHp; kind[i] = KIND.BUILDING;
      }
    }
  }
  // 中心落点清空，保证玩家/近身 bot 能落地
  for (let z = -3; z <= 3; z++) {
    for (let x = -3; x <= 3; x++) {
      const i = cellIndex(c + x, c + z);
      if (i < 0) continue;
      if (base[i] < 0) continue;
      top[i] = base[i]; hp[i] = 0; kind[i] = KIND.NONE;
    }
  }

  const run = {
    seed, rng, n, base, top, hp, kind, time: 0,
    phase: 'drop', // drop | playing | won | dead
    player: null, bots: [], loot: [], deathBoxes: [],
    events: [],
    zone: { stage: 0, r: ZONE.stages[0].r, cx: c, cz: c, lastTick: 0 },
    airdrop: null,
    stats: { shots: 0, hits: 0, kills: 0, blocksPlaced: 0, pickups: 0 },
  };

  // 玩家落中心
  run.player = makeEntity('p0', true, c, c + 1, 0);
  run.player.weapon = 'pistol';
  run.player.mag = WEAPONS.pistol.mag;
  run.player.ammo = 24;
  run.player.armor = 50;
  run.player.blocks = 8;
  run.player.meds = 2;

  // 29 bot：一部分近身（保证早期交火），其余散开
  const bots = [];
  const nearCount = 4, farCount = BOTS.count - nearCount;
  for (let i = 0; i < nearCount; i++) {
    const a = rng() * Math.PI * 2, r = 6 + rng() * 7;
    bots.push(makeEntity('b' + i, false, c + Math.cos(a) * r, c + Math.sin(a) * r, rng() * Math.PI * 2));
  }
  for (let i = 0; i < farCount; i++) {
    const a = rng() * Math.PI * 2, r = 10 + rng() * (MAP.islandRadius - 12);
    bots.push(makeEntity('b' + (nearCount + i), false, c + Math.cos(a) * r, c + Math.sin(a) * r, rng() * Math.PI * 2));
  }
  for (const b of bots) {
    // 一半有枪
    if (rng() < 0.55) {
      const roll = rng();
      b.weapon = roll < 0.2 ? 'sniper' : roll < 0.6 ? 'rifle' : 'pistol';
      b.mag = WEAPONS[b.weapon].mag;
      b.ammo = Math.floor(WEAPONS[b.weapon].mag * (1 + rng() * 2));
    }
    b.blocks = Math.floor(rng() * 8);
    b.meds = Math.floor(rng() * 3);
    b.armor = rng() < 0.25 ? 50 : 0;
  }
  run.bots = bots;

  // 战利品：中心放一把步枪（保证首胜可达），其余散落
  run.loot.push({ x: c + 3, z: c - 2, items: [{ type: 'rifle', n: 1 }, { type: 'ammo', n: 40 }, { type: 'blocks', n: 6 }], fromDeath: false });
  run.loot.push({ x: c - 3, z: c + 3, items: [{ type: 'pistol', n: 1 }, { type: 'meds', n: 1 }], fromDeath: false });
  for (let i = 0; i < LOOT.piles - 2; i++) {
    const a = rng() * Math.PI * 2, r = 8 + rng() * (MAP.islandRadius - 10);
    const x = c + Math.cos(a) * r, z = c + Math.sin(a) * r;
    run.loot.push({ x, z, items: randomLoot(rng), fromDeath: false });
  }

  emit(run, { type: 'start' });
  return run;
}

function randomLoot(rng) {
  const items = [];
  const roll = rng();
  if (roll < 0.35) items.push({ type: 'pistol', n: 1 });
  else if (roll < 0.55) items.push({ type: 'rifle', n: 1 });
  else if (roll < 0.62) items.push({ type: 'sniper', n: 1 });
  if (rng() < 0.6) items.push({ type: 'ammo', n: 12 + Math.floor(rng() * 36) });
  if (rng() < 0.4) items.push({ type: 'armor', n: 25 + Math.floor(rng() * 50) });
  if (rng() < 0.4) items.push({ type: 'blocks', n: 3 + Math.floor(rng() * 8) });
  if (rng() < 0.3) items.push({ type: 'meds', n: 1 });
  if (!items.length) items.push({ type: 'ammo', n: 18 });
  return items;
}

// ---------------------------------------------------------------- 基础查询
function emit(run, ev) { ev.t = run.time; run.events.push(ev); }
export function drainEvents(run) { const e = run.events; run.events = []; return e; }

function baseAt(run, x, z) {
  const i = cellIndex(x, z);
  return i < 0 ? -1 : run.base[i];
}

function canStand(run, x, z, foot) {
  const i = cellIndex(x, z);
  if (i < 0) return false;
  if (run.base[i] < 0) return false;                       // 水
  if (run.top[i] > run.base[i] && run.top[i] - foot > 0.55) return false; // 掩体/建筑
  return true;
}

function moveGround(run, e, mx, mz, speed) {
  const foot = e.y;
  const len = Math.hypot(mx, mz) || 1;
  const ux = mx / len, uz = mz / len;
  const nx = e.x + ux * speed * STEP, nz = e.z + uz * speed * STEP;
  if (canStand(run, nx, nz, foot)) { e.x = nx; e.z = nz; return; }
  if (canStand(run, nx, e.z, foot)) { e.x = nx; return; }
  if (canStand(run, e.x, nz, foot)) { e.z = nz; return; }
}

function clampIsland(run, e) {
  const c = MAP.center;
  const d = Math.hypot(e.x - c, e.z - c);
  const max = MAP.islandRadius - 1;
  if (d > max) { e.x = c + (e.x - c) / d * max; e.z = c + (e.z - c) / d * max; }
}

function entities(run) { return [run.player, ...run.bots]; }

function aliveCount(run) {
  return (run.player.alive ? 1 : 0) + run.bots.reduce((s, b) => s + (b.alive ? 1 : 0), 0);
}

function losClear(run, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const d = Math.hypot(dx, dz) || 1;
  const steps = Math.ceil(d / 0.5);
  for (let s = 1; s < steps; s++) {
    const x = a.x + dx * s / steps, z = a.z + dz * s / steps;
    const i = cellIndex(x, z);
    if (i < 0) return false;
    if (run.top[i] > BUILD.losBlock) return false;
  }
  return true;
}

export function nearestEnemy(run, e) {
  let best = null, bd = Infinity;
  const all = entities(run);
  for (const t of all) {
    if (!t.alive || t === e) continue;
    const d = dist2(e.x, e.z, t.x, t.z);
    if (d >= bd) continue;
    if (!losClear(run, e, t)) continue;
    best = t; bd = d;
  }
  return best;
}

export function nearestLoot(run, e) {
  let best = null, bd = Infinity;
  for (const l of run.loot) {
    const d = dist2(e.x, e.z, l.x, l.z);
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}

function aimAt(b, tx, ty, tz, jx, jy) {
  const dx = tx - b.x, dy = ty - (b.y + PLAYER.eye), dz = tz - b.z;
  const h = Math.hypot(dx, dz);
  b.yaw = Math.atan2(-dx, -dz) + jx;
  b.pitch = clamp(Math.atan2(dy, h) + jy, -1.45, 1.45);
}

// ---------------------------------------------------------------- 射击
function rayCylinder(ox, oy, oz, dx, dy, dz, t) {
  const ex = ox - t.x, ez = oz - t.z;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return null;
  const b = 2 * (ex * dx + ez * dz);
  const c = ex * ex + ez * ez - PLAYER.radius * PLAYER.radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let s = (-b - sq) / (2 * a);
  if (s < 0) s = (-b + sq) / (2 * a);
  if (s < 0) return null;
  const y = oy + dy * s;
  if (y < t.y || y > t.y + PLAYER.bodyHeight) return null;
  return { t: s, headshot: y > t.y + PLAYER.headY };
}

function reloadMag(e) {
  const w = WEAPONS[e.weapon];
  const need = w.mag - e.mag;
  const take = Math.min(need, e.ammo);
  e.mag += take; e.ammo -= take;
}

function fire(run, shooter) {
  const w = WEAPONS[shooter.weapon];
  if (!w || shooter.mag <= 0) return false;
  shooter.mag--;
  shooter.cd = 1 / w.fireRate;
  run.stats.shots++;
  const ox = shooter.x, oy = shooter.y + PLAYER.eye, oz = shooter.z;
  const cp = Math.cos(shooter.pitch), sp = Math.sin(shooter.pitch);
  const dx = -Math.sin(shooter.yaw) * cp, dy = sp, dz = -Math.cos(shooter.yaw) * cp;
  emit(run, { type: 'shot', x: shooter.x, z: shooter.z, shooter: shooter.id, weapon: shooter.weapon });

  let bestT = w.range, hitEnt = null, headshot = false;
  for (const t of entities(run)) {
    if (!t.alive || t === shooter) continue;
    const h = rayCylinder(ox, oy, oz, dx, dy, dz, t);
    if (h && h.t < bestT) { bestT = h.t; hitEnt = t; headshot = h.headshot; }
  }

  // 世界 DDA 前进（只走到实体命中距离为止）
  let world = null;
  for (let s = 0; s < bestT; s += 0.2) {
    const px = ox + dx * s, py = oy + dy * s, pz = oz + dz * s;
    if (py < 0) { world = { cell: -1, breakable: false, x: px, y: py, z: pz }; break; }
    const i = cellIndex(px, pz);
    if (i < 0) continue;
    const th = run.top[i];
    if (py < th) {
      world = { cell: i, breakable: py > run.base[i] && run.top[i] > run.base[i], x: px, y: py, z: pz };
      break;
    }
  }

  if (hitEnt) {
    applyDamage(run, hitEnt, shooter, w, headshot);
  } else if (world && world.breakable) {
    damageBlock(run, world.cell, world);
  } else if (world && shooter.isPlayer) {
    emit(run, { type: 'spark', x: world.x, y: world.y, z: world.z });
  }
  return true;
}

function applyDamage(run, victim, shooter, w, headshot) {
  let dmg = w.dmg * (headshot ? w.headMul : 1);
  if (victim.armor > 0) {
    const absorbed = Math.min(victim.armor, dmg * 0.5);
    victim.armor -= absorbed; dmg -= absorbed;
  }
  victim.hp -= dmg;
  run.stats.hits++;
  emit(run, { type: 'hit', x: victim.x, z: victim.z, shooter: shooter.id, target: victim.id, dmg: Math.round(dmg), headshot: !!headshot });
  if (victim.hp <= 0) killEntity(run, victim, shooter);
}

function damageBlock(run, i, w) {
  if (i < 0 || run.hp[i] <= 0) return;
  run.hp[i]--;
  if (run.hp[i] <= 0) {
    run.top[i]--;
    if (run.top[i] > run.base[i]) run.hp[i] = BUILD.blockHp;
    else { run.hp[i] = 0; run.kind[i] = KIND.NONE; }
  }
  emit(run, { type: 'blockBreak', cell: i, x: w.x, z: w.z });
}

function killEntity(run, victim, killer) {
  if (!victim.alive) return;
  victim.alive = false; victim.hp = 0;
  if (killer) { killer.kills++; run.stats.kills++; }
  emit(run, { type: 'kill', x: victim.x, z: victim.z, killer: killer ? killer.id : null, victim: victim.id });
  const items = [];
  if (victim.weapon) items.push({ type: victim.weapon, n: 1 });
  if (victim.ammo || victim.mag) items.push({ type: 'ammo', n: victim.ammo + victim.mag });
  if (victim.blocks) items.push({ type: 'blocks', n: victim.blocks });
  if (victim.meds) items.push({ type: 'meds', n: victim.meds });
  if (victim.armor) items.push({ type: 'armor', n: victim.armor });
  if (items.length) run.loot.push({ x: victim.x, z: victim.z, items, fromDeath: true });
  run.deathBoxes.push({ x: victim.x, z: victim.z, id: victim.id });
  emit(run, { type: 'deathBox', x: victim.x, z: victim.z, victim: victim.id });
}

// ---------------------------------------------------------------- 拾取 / 建造
function applyItem(run, e, item) {
  if (typeof item === 'string') item = { type: item, n: 1 };
  switch (item.type) {
    case 'pistol': case 'rifle': case 'sniper':
      if (weaponRank(item.type) > weaponRank(e.weapon)) { e.weapon = item.type; e.mag = WEAPONS[item.type].mag; }
      e.ammo += WEAPONS[item.type].mag * 2;
      break;
    case 'ammo': e.ammo += item.n; break;
    case 'armor': e.armor = Math.min(PLAYER.armorMax, e.armor + item.n); break;
    case 'blocks': e.blocks = Math.min(BUILD.maxBlocks, e.blocks + item.n); break;
    case 'meds': e.meds += item.n; break;
  }
}

function pickupAt(run, e, maxDist) {
  let best = -1, bd = maxDist * maxDist;
  for (let i = 0; i < run.loot.length; i++) {
    const d = dist2(e.x, e.z, run.loot[i].x, run.loot[i].z);
    if (d < bd) { bd = d; best = i; }
  }
  if (best < 0) return false;
  const pile = run.loot[best];
  for (const item of pile.items) applyItem(run, e, item);
  run.loot.splice(best, 1);
  run.stats.pickups++;
  emit(run, { type: 'pickup', x: e.x, z: e.z, id: e.id, weapon: e.weapon });
  return true;
}

function placeBlock(run, e, k) {
  if (e.blocks < BUILD.wallCost) return false;
  const sin = Math.sin(e.yaw), cos = Math.cos(e.yaw);
  const tx = e.x - sin * BUILD.placeDist, tz = e.z - cos * BUILD.placeDist;
  const i = cellIndex(tx, tz);
  if (i < 0 || run.base[i] < 0) return false;
  if (run.top[i] > run.base[i]) return false; // 已有方块
  const h = k === 'ramp' ? BUILD.rampHeight : BUILD.wallHeight;
  run.top[i] = run.base[i] + h;
  run.hp[i] = BUILD.blockHp;
  run.kind[i] = k === 'ramp' ? KIND.RAMP : KIND.WALL;
  e.blocks -= BUILD.wallCost;
  run.stats.blocksPlaced++;
  emit(run, { type: 'build', x: tx, z: tz, kind: k, owner: e.id });
  return true;
}

// ---------------------------------------------------------------- 玩家 / bot
function applyPlayer(run, p, inp) {
  if (p.alive && p.hp > 0 && p.hp < 40 && p.meds > 0) { p.hp = Math.min(PLAYER.hp, p.hp + PLAYER.medHeal); p.meds--; emit(run, { type: 'heal', x: p.x, z: p.z, id: p.id }); }
  if (inp.yaw !== undefined) p.yaw = inp.yaw;
  if (inp.pitch !== undefined) p.pitch = clamp(inp.pitch, -1.45, 1.45);
  const f = inp.forward ?? 0, s = inp.strafe ?? 0;
  if (Math.abs(f) > 0.01 || Math.abs(s) > 0.01) {
    const len = Math.hypot(f, s) || 1;
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const wx = (s / len) * cos - (f / len) * sin;
    const wz = -(f / len) * cos - (s / len) * sin;
    moveGround(run, p, wx, wz, PLAYER.speed);
  }
  p.cd -= STEP;
  if (p.reloadT > 0) { p.reloadT -= STEP; if (p.reloadT <= 0) reloadMag(p); }
  else if (inp.reload && p.mag < WEAPONS[p.weapon].mag && p.ammo > 0) p.reloadT = WEAPONS[p.weapon].reload;
  if (inp.fire && p.cd <= 0 && p.reloadT <= 0) {
    if (p.mag <= 0 && p.ammo > 0) p.reloadT = WEAPONS[p.weapon].reload;
    else fire(run, p);
  }
  if (inp.pickup) pickupAt(run, p, LOOT.radius);
  if (inp.build) placeBlock(run, p, inp.buildKind === 'ramp' ? 'ramp' : 'wall');
  pickupAt(run, p, 1.0); // 走过自动拾取
}

function updateBot(run, b) {
  b.cd -= STEP;
  if (b.reloadT > 0) { b.reloadT -= STEP; if (b.reloadT <= 0) reloadMag(b); }
  if (b.buildCd > 0) b.buildCd -= STEP;
  const aim = clamp(BOTS.aimBase + run.time * BOTS.aimRamp, 0, BOTS.aimCap);
  const target = nearestEnemy(run, b);
  b.targetId = target ? target.id : null;

  if (b.hp < 50 && b.meds > 0) { b.hp = Math.min(PLAYER.hp, b.hp + PLAYER.medHeal); b.meds--; emit(run, { type: 'heal', x: b.x, z: b.z, id: b.id }); }

  const inZone = Math.hypot(b.x - run.zone.cx, b.z - run.zone.cz) <= run.zone.r;
  let gx, gz, wantShoot = false, strafe = 0;
  if (!inZone && run.time > ZONE.stages[0].t + 2) { gx = run.zone.cx; gz = run.zone.cz; }
  else if (!b.weapon || (b.ammo === 0 && b.mag === 0)) {
    const l = nearestLoot(run, b);
    if (l) { gx = l.x; gz = l.z; } else { gx = target ? target.x : run.zone.cx; gz = target ? target.z : run.zone.cz; }
  } else if (target && Math.hypot(target.x - b.x, target.z - b.z) < BOTS.reactDist) {
    gx = target.x; gz = target.z; wantShoot = true; strafe = b.strafeDir;
    if (b.strafeDir > 0 && run.rng() < 0.02) b.strafeDir = -1;
    else if (b.strafeDir < 0 && run.rng() < 0.02) b.strafeDir = 1;
  } else {
    gx = target ? target.x : run.zone.cx; gz = target ? target.z : run.zone.cz;
  }

  // 掩体
  if (wantShoot && b.blocks > 0 && b.buildCd <= 0 && (run.zone.stage >= 2 || b.hp < 70) && run.rng() < BOTS.buildProb) {
    placeBlock(run, b, 'wall'); b.buildCd = 1.2;
  }

  const dx = gx - b.x, dz = gz - b.z;
  let mx = 0, mz = 0;
  const dd = Math.hypot(dx, dz);
  if (dd > 0.5) {
    let ux = dx / dd, uz = dz / dd;
    if (strafe) { const px = -uz, pz = ux; ux = ux * 0.6 + px * strafe * 0.8; uz = uz * 0.6 + pz * strafe * 0.8; }
    mx = ux; mz = uz;
  }
  if (mx || mz) moveGround(run, b, mx, mz, BOTS.speed);

  if (wantShoot && b.weapon) {
    const jitter = (1 - aim) * 0.45;
    aimAt(b, target.x, target.y + 1.25, target.z, (run.rng() * 2 - 1) * jitter, (run.rng() * 2 - 1) * jitter * 0.5);
    if (b.cd <= 0 && b.reloadT <= 0) {
      if (b.mag <= 0 && b.ammo > 0) b.reloadT = WEAPONS[b.weapon].reload;
      else fire(run, b);
    }
  } else if (mx || mz) {
    b.yaw = Math.atan2(-mx, -mz);
  }
}

function updateZone(run) {
  const t = run.time;
  let stage = 0;
  for (let i = 0; i < ZONE.stages.length; i++) if (t >= ZONE.stages[i].t) stage = i;
  if (stage !== run.zone.stage) {
    run.zone.stage = stage;
    emit(run, { type: 'zone', stage });
  }
  const cur = ZONE.stages[stage];
  let r = cur.r;
  if (stage > 0) {
    const prev = ZONE.stages[stage - 1];
    const k = clamp((t - cur.t) / ZONE.shrinkSec, 0, 1);
    r = prev.r + (cur.r - prev.r) * k;
  }
  run.zone.r = r;

  if (t >= ZONE.airdropAt && !run.airdrop) {
    const a = run.rng() * Math.PI * 2, rr = 4 + run.rng() * 8;
    run.airdrop = { x: run.zone.cx + Math.cos(a) * rr, z: run.zone.cz + Math.sin(a) * rr };
    run.loot.push({ x: run.airdrop.x, z: run.airdrop.z, items: [{ type: 'sniper', n: 1 }, { type: 'ammo', n: 15 }, { type: 'armor', n: 100 }, { type: 'meds', n: 2 }], fromDeath: false, airdrop: true });
    emit(run, { type: 'airdrop', x: run.airdrop.x, z: run.airdrop.z });
  }

  for (const e of entities(run)) {
    if (!e.alive) continue;
    if (Math.hypot(e.x - run.zone.cx, e.z - run.zone.cz) > r) {
      e.hp -= ZONE.dps * STEP;
      if (e.hp <= 0) killEntity(run, e, null);
    }
  }

  // 心跳已上移到 updateSim（drop 阶段也发）
}

function checkEnd(run) {
  if ((!run.player.alive || run.player.hp <= 0) && run.phase === 'playing') {
    run.player.alive = false; run.player.hp = 0;
    run.phase = 'dead';
    emit(run, { type: 'dead', x: run.player.x, z: run.player.z });
    return;
  }
  if (run.player.alive && run.phase === 'playing' && aliveCount(run) === 1) {
    run.phase = 'won';
    emit(run, { type: 'win', x: run.player.x, z: run.player.z, kills: run.player.kills });
  }
}

// ---------------------------------------------------------------- 主步进
export function updateSim(run, input = {}) {
  run.time += STEP;
  // 全局心跳（drop + playing 都发，防死时间）
  if (run.time - run.zone.lastTick >= ZONE.heartbeatSec) {
    run.zone.lastTick = run.time;
    emit(run, { type: 'zoneTick', alive: aliveCount(run), stage: run.zone.stage });
  }
  if (run.phase === 'drop') return updateDrop(run, input);
  if (run.phase !== 'playing') return;

  applyPlayer(run, run.player, input);
  for (const b of run.bots) if (b.alive) updateBot(run, b);
  updateZone(run);
  checkEnd(run);
}

function updateDrop(run, inp) {
  const p = run.player;
  if (inp.yaw !== undefined) p.yaw = inp.yaw;
  const f = inp.forward ?? 0, s = inp.strafe ?? 0;
  if (Math.abs(f) > 0.01 || Math.abs(s) > 0.01) {
    const len = Math.hypot(f, s) || 1;
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const wx = (s / len) * cos - (f / len) * sin;
    const wz = -(f / len) * cos - (s / len) * sin;
    p.x += wx * 22 * STEP; p.z += wz * 22 * STEP;
    clampIsland(run, p);
  }
  for (const b of run.bots) {
    b.x += clamp(b.spawnX - b.x, -1, 1) * 10 * STEP;
    b.z += clamp(b.spawnZ - b.z, -1, 1) * 10 * STEP;
  }
  const landT = ZONE.stages[0].t;
  const y = Math.max(0, DROP.planeY * (1 - run.time / landT));
  for (const e of entities(run)) e.y = y;
  if (run.time >= landT) {
    run.phase = 'playing';
    for (const e of entities(run)) e.y = Math.max(0, baseAt(run, e.x, e.z));
    emit(run, { type: 'land' });
  }
}

// ---------------------------------------------------------------- 出口
export function getHud(run) {
  const p = run.player;
  const w = WEAPONS[p.weapon] || WEAPONS.pistol;
  return {
    phase: run.phase, time: run.time,
    hp: Math.max(0, Math.round(p.hp)), armor: Math.round(p.armor),
    weapon: p.weapon, mag: p.mag, ammo: p.ammo, blocks: p.blocks, meds: p.meds,
    kills: p.kills, alive: aliveCount(run),
    zoneStage: run.zone.stage, zoneRadius: run.zone.r,
    inZone: Math.hypot(p.x - run.zone.cx, p.z - run.zone.cz) <= run.zone.r,
    reloading: p.reloadT > 0,
  };
}

export function getRating(run) {
  const k = run.player.kills;
  for (const [letter, min] of RATINGS) if (k >= min) return letter;
  return 'D';
}
