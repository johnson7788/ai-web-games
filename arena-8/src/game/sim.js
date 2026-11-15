// src/game/sim.js — 纯逻辑核心：8 人布偶死斗（1 玩家 + 7 bot）。
// 无 DOM/THREE/Date.now；随机用 seed；60Hz 固定步长由 main 调用。
// 契约：createSim(opts) / updateSim(run, input, dt) / drainEvents(run) / getHud(run) / pickUpgrade(run, id) / ratingFor(score)
import { STEP, ARENA, FIGHTER, WEAPONS, MATCH, BOT, SCORE, UPGRADES } from '../../config/game.config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const EMPTY = new Set();
const GRAVITY = 24;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ratingFor(score) {
  for (const [name, min] of SCORE.ratings) if (score >= min) return name;
  return 'C';
}

function emit(run, type, extra = {}) { run.events.push({ type, ...extra }); }

function dist2(ax, az, bx, bz) { const dx = bx - ax, dz = bz - az; return Math.hypot(dx, dz); }

// 有效半径：第 5 场决胜圈收缩
function effRadius(run) {
  if (run.match < MATCH.rounds || !ARENA.shrink.enabled) return ARENA.R;
  const t = clamp((run.time - ARENA.shrink.atSec) / 30, 0, 1);
  return ARENA.R - (ARENA.R - ARENA.shrink.to) * t;
}

export function createSim(opts = {}) {
  const seed = opts.seed ?? 1;
  const run = {
    seed, rng: mulberry32(seed),
    phase: 'match',              // match | upgrade | won | lost
    match: 1,                    // 1-based
    rounds: MATCH.rounds,
    time: 0,
    totalTime: 0,
    arenaR: ARENA.R,
    upgrades: new Set(),         // 玩家已选升级 id
    upgradeChoices: [],
    stats: { kills: 0, falls: 0, wins: 0, score: 0 },
    fighters: [],
    weapons: [],
    counter: 0,                  // counter-punch 剩余秒
    events: [],
  };
  startMatch(run);
  emit(run, 'start', { match: run.match });
  return run;
}

function startMatch(run) {
  run.phase = 'match';
  run.time = 0;
  run.counter = 0;
  run.arenaR = effRadius(run);
  run.fighters = [];
  const n = MATCH.fighters;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + run.rng() * 0.35;
    const r = ARENA.R * MATCH.spawnR;
    run.fighters.push(makeFighter(run, i, Math.cos(a) * r, Math.sin(a) * r));
  }
  run.weapons = [];
  for (let i = 0; i < WEAPONS.spawn.count; i++) run.weapons.push(spawnWeapon(run));
  emit(run, 'matchStart', { match: run.match });
}

function makeFighter(run, idx, x, z) {
  const maxHp = FIGHTER.hp + (idx === 0 && run.upgrades.has('hp10') ? 10 : 0);
  return {
    id: idx, isPlayer: idx === 0, colorIdx: idx,
    x, z, y: 0, vx: 0, vz: 0, vy: 0,
    facing: Math.atan2(-z, -x),
    hp: maxHp, maxHp,
    alive: true, gone: false,
    ragdollT: 0, airborne: false,
    punchCd: 0, grabCd: 0, ultCd: 0,
    weapon: null, weaponDur: 0,
    grabbing: null, grabbedBy: null, grabHold: 0,
    lastHitBy: null,
  };
}

function spawnWeapon(run) {
  const types = Object.keys(WEAPONS.defs);
  const type = types[Math.floor(run.rng() * types.length)];
  const a = run.rng() * Math.PI * 2;
  const r = run.rng() * (ARENA.R * 0.72);
  return { type, x: Math.cos(a) * r, z: Math.sin(a) * r, respawnT: 0 };
}

function respawnWeapon(run, w) {
  const a = run.rng() * Math.PI * 2;
  const r = run.rng() * (ARENA.R * 0.72);
  w.x = Math.cos(a) * r; w.z = Math.sin(a) * r; w.respawnT = 0;
}

function fighterById(run, id) { return run.fighters.find((f) => f.id === id) || null; }

function effStats(run, f) {
  const up = f.isPlayer ? run.upgrades : EMPTY;
  const baseSpeed = f.isPlayer ? FIGHTER.speed : (BOT.baseSpeed + (run.match - 1) * BOT.speedPerRound);
  let speed = baseSpeed * (up.has('move-speed') ? 1.10 : 1);
  if (f.grabbing != null) speed *= FIGHTER.carrySpeedMul;
  return {
    speed,
    punchDmg: FIGHTER.punch.dmg * (up.has('punch-dmg') ? 1.25 : 1),
    grabRange: FIGHTER.grab.range * (up.has('grab-range') ? 1.4 : 1),
    throwPower: FIGHTER.throw.power * (up.has('throw-power') ? 1.4 : 1),
    ultRange: FIGHTER.ult.range * (up.has('shockwave') ? 1.3 : 1),
    weaponDurability: Math.round(WEAPONS.durability * (up.has('weapon-master') ? 1.5 : 1)),
  };
}

// bot 打玩家时的伤害缩放（难度随场次上升；bot 互殴永远满伤害）
function botDmgScale(run) {
  return clamp(BOT.dmgBase + (run.match - 1) * BOT.dmgPerRound, 0.5, 1.0);
}

export function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

export function getHud(run) {
  const p = run.fighters[0];
  const alive = run.fighters.filter((f) => f.alive).length;
  const ultPct = p ? clamp(1 - p.ultCd / FIGHTER.ult.cd, 0, 1) : 0;
  return {
    phase: run.phase, time: run.time, match: run.match, rounds: run.rounds,
    hp: p ? Math.max(0, Math.round(p.hp)) : 0, maxHp: p ? p.maxHp : FIGHTER.hp,
    alive, weapon: p ? p.weapon : null, weaponDur: p ? p.weaponDur : 0,
    ultPct, kills: run.stats.kills, falls: run.stats.falls, score: run.stats.score,
    arenaR: run.arenaR,
  };
}

export function pickUpgrade(run, id) {
  if (run.phase !== 'upgrade') return false;
  if (!run.upgradeChoices.includes(id)) return false;
  run.upgrades.add(id);
  run.match += 1;
  startMatch(run);
  return true;
}

// ---------------------------------------------------------------- 攻击/淘汰

function knockback(run, f, fromX, fromZ, power, airborne) {
  const dx = f.x - fromX, dz = f.z - fromZ;
  const l = Math.hypot(dx, dz) || 1;
  f.vx = (dx / l) * power;
  f.vz = (dz / l) * power;
  f.ragdollT = FIGHTER.punch.ragdoll;
  if (airborne) { f.airborne = true; f.vy = 2.6; }
}

function doThrow(run, f) {
  const t = fighterById(run, f.grabbing);
  f.grabbing = null; f.grabHold = 0;
  if (t && t.alive) {
    t.grabbedBy = null; t.y = 1.0;
    t.lastHitBy = f.id; // 扔出场外计为投掷者淘汰
    const st = effStats(run, f);
    t.vx = Math.cos(f.facing) * st.throwPower;
    t.vz = Math.sin(f.facing) * st.throwPower;
    t.vy = FIGHTER.throw.up;
    t.airborne = true; t.ragdollT = 1.2;
    emit(run, 'throw', { from: f.id, to: t.id });
  }
}

function eliminate(run, f, cause) {
  if (!f.alive) return;
  f.alive = false;
  if (f.grabbing != null) { const t = fighterById(run, f.grabbing); if (t) t.grabbedBy = null; f.grabbing = null; }
  if (f.grabbedBy != null) { const g = fighterById(run, f.grabbedBy); if (g) g.grabbing = null; f.grabbedBy = null; }
  // 布偶飞出场外签名画面
  if (cause === 'kill') {
    // HP 归零：给一个向外弹飞
    const l = Math.hypot(f.x, f.z) || 1;
    f.vx = (f.x / l) * 9;
    f.vz = (f.z / l) * 9;
    f.vy = 4.5;
  }
  // cause === 'fall'：保留扔出/打出场的动量，继续飞出场外
  f.airborne = true; f.ragdollT = 1.5;
  const by = f.lastHitBy;
  if (by === 0 && cause === 'fall') { run.stats.falls += 1; run.stats.score += SCORE.fall; }
  else if (by === 0) { run.stats.kills += 1; run.stats.score += SCORE.kill; }
  if (by === 0) {
    const p = run.fighters[0];
    if (p.alive) p.hp = Math.min(p.maxHp, p.hp + FIGHTER.lifesteal);
  }
  emit(run, cause, { id: f.id, by: by == null ? -1 : by });
}

function nearestAlive(run, f) {
  let best = null, bd = Infinity;
  for (const o of run.fighters) {
    if (o === f || !o.alive || o.grabbedBy != null) continue;
    let d = dist2(f.x, f.z, o.x, o.z);
    if (!f.isPlayer && o.isPlayer) d *= 2.0; // bot 优先互殴，玩家不被集火
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function nearestInArc(run, f, range, arc) {
  let best = null, bd = range;
  for (const o of run.fighters) {
    if (o === f || !o.alive || o.grabbedBy != null) continue;
    const d = dist2(f.x, f.z, o.x, o.z);
    if (d > range) continue;
    let da = Math.atan2(o.z - f.z, o.x - f.x) - f.facing;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) <= arc && d < bd) { bd = d; best = o; }
  }
  return best;
}

function enemiesWithin(run, f, r) {
  let n = 0;
  for (const o of run.fighters) {
    if (o === f || !o.alive || o.grabbedBy != null) continue;
    if (dist2(f.x, f.z, o.x, o.z) < r) n++;
  }
  return n;
}

function nearestWeapon(run, f) {
  let best = null, bd = Infinity;
  for (const w of run.weapons) {
    if (w.respawnT > 0) continue;
    const d = dist2(f.x, f.z, w.x, w.z);
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}

// ---------------------------------------------------------------- 单兵步进

function stepFighter(run, f, inp, dt) {
  if (!f.alive) return;

  // 被抓：跟随抓取者（举过头顶）
  if (f.grabbedBy != null) {
    const g = fighterById(run, f.grabbedBy);
    if (!g || !g.alive) { f.grabbedBy = null; }
    else {
      f.x = g.x; f.z = g.z; f.y = 1.8; f.vx = 0; f.vz = 0;
      f.ragdollT = 1; f.airborne = false;
      return;
    }
  }

  f.punchCd = Math.max(0, f.punchCd - dt);
  f.grabCd = Math.max(0, f.grabCd - dt);
  f.ultCd = Math.max(0, f.ultCd - dt);
  if (f.isPlayer && run.counter > 0) run.counter = Math.max(0, run.counter - dt);

  // 抓举自动扔出（hold 到时即投，避免无限抓着）
  if (f.grabbing != null) {
    f.grabHold -= dt;
    if (f.grabHold <= 0) doThrow(run, f);
  }

  // 瘫软/腾空：只做受击物理
  if (f.ragdollT > 0) {
    f.ragdollT = Math.max(0, f.ragdollT - dt);
    if (f.airborne) {
      f.vy -= GRAVITY * dt;
      f.y += f.vy * dt;
      f.x += f.vx * dt; f.z += f.vz * dt;
      if (f.y <= 0) { f.y = 0; f.airborne = false; f.vy = 0; f.ragdollT = Math.max(f.ragdollT, 0.6); }
    } else {
      const fr = Math.max(0, 1 - FIGHTER.friction * 0.7 * dt);
      f.x += f.vx * dt; f.z += f.vz * dt;
      f.vx *= fr; f.vz *= fr;
    }
    maybeFall(run, f);
    return;
  }

  const st = effStats(run, f);
  let mx = inp.mx || 0, mz = inp.mz || 0;
  if (mx || mz) {
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    f.vx += (mx * st.speed - f.vx) * Math.min(1, FIGHTER.accel * dt * 2 / Math.max(1, st.speed));
    f.vz += (mz * st.speed - f.vz) * Math.min(1, FIGHTER.accel * dt * 2 / Math.max(1, st.speed));
    f.facing = Math.atan2(mz, mx);
  } else {
    const d = Math.max(0, 1 - FIGHTER.friction * dt);
    f.vx *= d; f.vz *= d;
  }
  f.x += f.vx * dt; f.z += f.vz * dt;
  f.y = 0;

  // 拾取武器
  if (!f.weapon) {
    for (const w of run.weapons) {
      if (w.respawnT > 0) continue;
      if (dist2(f.x, f.z, w.x, w.z) < 1.3) {
        f.weapon = w.type; f.weaponDur = st.weaponDurability;
        w.respawnT = WEAPONS.spawn.respawnT;
        emit(run, 'weaponPickup', { id: f.id, weapon: w.type });
        break;
      }
    }
  }

  // 拳
  if (inp.punch && f.punchCd <= 0) {
    const wd = f.weapon ? WEAPONS.defs[f.weapon] : null;
    f.punchCd = FIGHTER.punch.cd / (wd ? wd.speedMul : 1);
    // 软锁定：朝射程内最近敌人（玩家也能稳定命中）
    const lock = nearestAlive(run, f);
    if (lock && dist2(f.x, f.z, lock.x, lock.z) < FIGHTER.punch.range * 1.2) {
      f.facing = Math.atan2(lock.z - f.z, lock.x - f.x);
    }
    const t = nearestInArc(run, f, FIGHTER.punch.range, FIGHTER.punch.arc);
    if (t) {
      const dmgMul = (wd ? wd.dmgMul : 1) * (f.isPlayer && run.counter > 0 ? 1.5 : 1);
      const dmg = st.punchDmg * dmgMul * ((!f.isPlayer && t.isPlayer) ? botDmgScale(run) : 1);
      t.hp -= dmg;
      t.lastHitBy = f.id;
      if (f.isPlayer && run.counter > 0) run.counter = 0;
      knockback(run, t, f.x, f.z, FIGHTER.punch.knockback * (wd ? wd.knockMul : 1), false);
      if (f.weapon) {
        f.weaponDur -= 1;
        if (f.weaponDur <= 0) { emit(run, 'weaponBreak', { id: f.id, weapon: f.weapon }); f.weapon = null; f.weaponDur = 0; }
      }
      if (t.isPlayer) run.counter = 2.0; // 反击拳窗口
      emit(run, 'hit', { from: f.id, to: t.id, dmg: Math.round(dmg), weapon: wd ? f.weapon : null });
      if (t.hp <= 0) eliminate(run, t, 'kill');
    } else {
      emit(run, 'punch', { from: f.id });
    }
  }

  // 抓 / 扔
  if (inp.grab && f.grabCd <= 0) {
    f.grabCd = 0.3;
    if (f.grabbing != null) {
      doThrow(run, f);
    } else {
      const t = nearestAlive(run, f);
      if (t && dist2(f.x, f.z, t.x, t.z) < st.grabRange) {
        f.grabbing = t.id; t.grabbedBy = f.id; f.grabHold = 1.2;
        emit(run, 'grab', { from: f.id, to: t.id });
      }
    }
  }

  // 大招（震地）
  if (inp.ult && f.ultCd <= 0) {
    f.ultCd = FIGHTER.ult.cd;
    emit(run, 'ult', { from: f.id });
    for (const o of run.fighters) {
      if (o === f || !o.alive || o.grabbedBy != null) continue;
      if (dist2(f.x, f.z, o.x, o.z) < st.ultRange) {
        const udmg = FIGHTER.ult.dmg * ((!f.isPlayer && o.isPlayer) ? botDmgScale(run) : 1);
        o.hp -= udmg;
        o.lastHitBy = f.id;
        knockback(run, o, f.x, f.z, FIGHTER.ult.knockback, true);
        if (o.isPlayer) run.counter = 2.0;
        emit(run, 'hit', { from: f.id, to: o.id, dmg: Math.round(udmg), ult: true });
        if (o.hp <= 0) eliminate(run, o, 'kill');
      }
    }
  }

  maybeFall(run, f);

  // 软边界：受控者不能走出场外（只能被扔/打出）
  if (f.alive && f.ragdollT <= 0 && !f.airborne) {
    const max = run.arenaR - FIGHTER.radius;
    const d = Math.hypot(f.x, f.z);
    if (d > max) { f.x *= max / d; f.z *= max / d; }
  }
}

function maybeFall(run, f) {
  if (f.alive && (f.airborne || f.ragdollT > 0)) {
    if (Math.hypot(f.x, f.z) > run.arenaR + ARENA.FALL_MARGIN) eliminate(run, f, 'fall');
  }
}

// 死亡布偶继续飞出场外
function stepDead(run, f, dt) {
  f.vy -= GRAVITY * dt;
  f.y += f.vy * dt;
  f.x += f.vx * dt; f.z += f.vz * dt;
  if (f.y < -14) f.gone = true;
}

function stepPassive(run, dt) {
  for (const f of run.fighters) {
    if (!f.alive && !f.gone) stepDead(run, f, dt);
    else if (f.alive && f.airborne) {
      f.vy -= GRAVITY * dt; f.y += f.vy * dt;
      f.x += f.vx * dt; f.z += f.vz * dt;
      if (f.y <= 0) { f.y = 0; f.airborne = false; f.vy = 0; f.ragdollT = Math.max(f.ragdollT, 0.6); }
      maybeFall(run, f);
    }
  }
  for (const w of run.weapons) {
    if (w.respawnT > 0) { w.respawnT -= dt; if (w.respawnT <= 0) respawnWeapon(run, w); }
  }
}

function separate(run) {
  const fs = run.fighters.filter((f) => f.alive && !f.airborne && f.grabbedBy == null);
  const min = FIGHTER.radius * 2;
  for (let i = 0; i < fs.length; i++) {
    for (let j = i + 1; j < fs.length; j++) {
      const a = fs[i], b = fs[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d > 0 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d, nz = dz / d;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
      }
    }
  }
}

// ---------------------------------------------------------------- bot AI

function botInput(run, f) {
  const out = { mx: 0, mz: 0, punch: false, grab: false, ult: false };
  const st = effStats(run, f);
  const target = nearestAlive(run, f);
  if (!target) return out;
  const dx = target.x - f.x, dz = target.z - f.z;
  const d = Math.hypot(dx, dz) || 1;
  const toEdge = run.arenaR - Math.hypot(f.x, f.z);
  const aliveCount = run.fighters.filter((x) => x.alive).length;
  let dirX, dirZ;
  const cx = -f.x / (Math.hypot(f.x, f.z) || 1);
  const cz = -f.z / (Math.hypot(f.x, f.z) || 1);
  if (aliveCount > 2 && f.hp < BOT.fleeHp && d < 8) {
    // 残血逃跑：主要朝中心退（脱离边缘，避免绕圈），略带离敌
    dirX = (-dx / d) * 0.35 + cx * 0.65;
    dirZ = (-dz / d) * 0.35 + cz * 0.65;
  } else {
    dirX = dx / d; dirZ = dz / d;
    if (toEdge < BOT.edgeAvoid && d > 3) {
      dirX = dirX * 0.3 + cx * 0.7; dirZ = dirZ * 0.3 + cz * 0.7;
      const l = Math.hypot(dirX, dirZ) || 1; dirX /= l; dirZ /= l;
    }
  }
  if (!f.weapon) {
    const w = nearestWeapon(run, f);
    if (w && dist2(f.x, f.z, w.x, w.z) < 15) {
      dirX = w.x - f.x; dirZ = w.z - f.z;
      const l = Math.hypot(dirX, dirZ) || 1; dirX /= l; dirZ /= l;
    }
  }
  out.mx = dirX; out.mz = dirZ;
  f.facing = Math.atan2(dirZ, dirX);
  const aggro = clamp(BOT.aggroBase + (run.match - 1) * BOT.aggroPerRound, 0.05, 0.95);
  if (d < BOT.punchRange && f.punchCd <= 0 && run.rng() < aggro) out.punch = true;
  if (d < BOT.grabRange && f.grabCd <= 0 && run.rng() < 0.02 * aggro) out.grab = true;
  if (f.ultCd <= 0 && enemiesWithin(run, f, st.ultRange) >= 3 && run.rng() < 0.15) out.ult = true;
  return out;
}

// ---------------------------------------------------------------- 流程

function checkMatchEnd(run) {
  const alive = run.fighters.filter((f) => f.alive);
  const playerAlive = run.fighters[0].alive;
  if (!playerAlive) { endMatch(run, false); return; }
  if (alive.length === 1) { endMatch(run, true); return; }
  if (run.time >= MATCH.time) {
    const ranked = [...alive].sort((a, b) => b.hp - a.hp);
    endMatch(run, ranked[0].isPlayer);
  }
}

function endMatch(run, won) {
  if (won) {
    run.stats.wins += 1;
    run.stats.score += SCORE.winMatch + SCORE.survive;
    emit(run, 'matchEnd', { won: true, match: run.match });
    if (run.match >= run.rounds) { run.phase = 'won'; emit(run, 'win', { score: run.stats.score }); }
    else {
      run.phase = 'upgrade';
      offerUpgrades(run);
      emit(run, 'upgrade', { choices: run.upgradeChoices });
    }
  } else {
    emit(run, 'matchEnd', { won: false, match: run.match });
    run.phase = 'lost';
    emit(run, 'lose', { score: run.stats.score });
  }
}

function offerUpgrades(run) {
  const pool = UPGRADES.filter((u) => !run.upgrades.has(u.id));
  const picks = [];
  const copy = [...pool];
  for (let i = 0; i < 3 && copy.length; i++) {
    const idx = Math.floor(run.rng() * copy.length);
    picks.push(copy.splice(idx, 1)[0].id);
  }
  run.upgradeChoices = picks;
}

// ---------------------------------------------------------------- 主步进

export function updateSim(run, input = {}, dt = STEP) {
  run.totalTime += dt;
  if (run.phase !== 'match') {
    stepPassive(run, dt);
    return;
  }
  run.time += dt;
  run.arenaR = effRadius(run);
  const player = run.fighters[0];
  if (player.alive) stepFighter(run, player, input, dt);
  for (let i = 1; i < run.fighters.length; i++) {
    const b = run.fighters[i];
    if (!b.alive) continue;
    stepFighter(run, b, botInput(run, b), dt);
  }
  for (const w of run.weapons) {
    if (w.respawnT > 0) { w.respawnT -= dt; if (w.respawnT <= 0) respawnWeapon(run, w); }
  }
  separate(run);
  checkMatchEnd(run);
}
