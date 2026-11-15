// src/game/sim.js — 纯逻辑塔防模拟（无 DOM/window/THREE/localStorage/Date.now）。
// 判定几何/碰撞/BFS 改路/塔-敌-墙-波全部在此；事件经 drainEvents 对外广播。
// 契约：createSim / updateSim / getHud / drainEvents + 建造/升级/出售/提前开战。
import { MAP, TOWERS, WALL, ENEMIES, WAVES, ECON, STEP, cellWorld } from '../../config/game.config.js';

const key = (c, r) => `${c},${r}`;
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const BREAKER_WALL_DMG = 22; // 破墙兵对墙单次伤害

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emit(run, type, extra = {}) {
  run.events.push({ type, ...extra });
}

// BFS 最短路（4 邻接）：从出生点到核心，绕开 blocked 与可选额外格；堵死返回 null。
function bfs(run, extraBlock = null) {
  const { cols, rows, spawn, core } = MAP;
  const start = key(spawn.c, spawn.r);
  const goal = key(core.c, core.r);
  const prev = Object.create(null);
  const seen = new Set([start]);
  const q = [start];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (q.length) {
    const cur = q.shift();
    if (cur === goal) break;
    const [c, r] = cur.split(',').map(Number);
    for (const [dc, dr] of dirs) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const nk = key(nc, nr);
      if (seen.has(nk) || run.blocked.has(nk) || nk === extraBlock) continue;
      seen.add(nk); prev[nk] = cur; q.push(nk);
    }
  }
  if (!seen.has(goal)) return null;
  const out = [];
  let cur = goal;
  while (cur !== start) { out.unshift(cur); cur = prev[cur]; }
  out.unshift(start);
  return out.map((k) => { const [c, r] = k.split(',').map(Number); return { c, r }; });
}

function snapNode(run, x, z) {
  const path = run.path;
  let best = 0, bd = Infinity;
  for (let i = 0; i < path.length; i++) {
    const w = cellWorld(path[i].c, path[i].r);
    const d = dist(x, z, w.x, w.z);
    if (d < bd) { bd = d; best = i; }
  }
  return Math.min(path.length - 1, best + 1);
}

function recompute(run) {
  const p = bfs(run);
  if (p) {
    run.path = p;
    for (const e of run.enemies) if (!e.flying) e.nodeIdx = snapNode(run, e.x, e.z);
  }
  return p;
}

function canPlace(run, type, c, r) {
  const nk = key(c, r);
  if (c < 0 || r < 0 || c >= MAP.cols || r >= MAP.rows) return false;
  if ((c === MAP.spawn.c && r === MAP.spawn.r) || (c === MAP.core.c && r === MAP.core.r)) return false;
  if (run.blocked.has(nk)) return false;
  const cost = type === 'wall' ? WALL.cost : TOWERS[type].cost;
  if (run.gold < cost) return false;
  return bfs(run, nk) !== null; // 不允许完全堵死
}

export function buildTower(run, type, c, r) {
  if (!canPlace(run, type, c, r)) return false;
  const nk = key(c, r);
  const cost = type === 'wall' ? WALL.cost : TOWERS[type].cost;
  run.gold -= cost;
  run.blocked.add(nk);
  if (type === 'wall') run.walls[nk] = { c, r, hp: WALL.hp };
  else run.towers[nk] = { type, level: 1, c, r, cd: 0, id: run.nextId++ };
  recompute(run);
  emit(run, type === 'wall' ? 'wall_built' : 'build', { kind: type, c, r });
  return true;
}

export function upgradeTower(run, c, r) {
  const nk = key(c, r);
  const t = run.towers[nk];
  if (!t || t.level >= 3) return false;
  const spec = TOWERS[t.type];
  const cost = spec.upgradeCost[t.level - 1];
  if (run.gold < cost) return false;
  run.gold -= cost;
  t.level += 1;
  emit(run, 'upgrade', { kind: t.type, c, r, level: t.level });
  return true;
}

export function sellTower(run, c, r) {
  const nk = key(c, r);
  let invested = 0;
  if (run.towers[nk]) {
    const t = run.towers[nk];
    invested = TOWERS[t.type].cost + TOWERS[t.type].upgradeCost.slice(0, t.level - 1).reduce((a, b) => a + b, 0);
    delete run.towers[nk];
  } else if (run.walls[nk]) {
    invested = WALL.cost;
    delete run.walls[nk];
  } else return false;
  run.gold += Math.floor(invested * ECON.sellPct);
  run.blocked.delete(nk);
  recompute(run);
  emit(run, 'sell', { c, r });
  return true;
}

export function canPlaceAt(run, type, c, r) { return canPlace(run, type, c, r); }
export function previewPath(run, c, r) { return bfs(run, key(c, r)); }

function startWave(run) {
  run.phase = 'combat';
  run.buildTimeLeft = 0;
  run.spawnQueue = [];
  run._spawnT = 0;
  const interest = Math.min(ECON.interestCap, Math.floor(run.gold * ECON.interestRate));
  if (interest > 0) { run.gold += interest; emit(run, 'interest', { amount: interest }); }
  let t = 0;
  for (const g of WAVES[run.wave - 1].enemies) {
    for (let i = 0; i < g.count; i++) run.spawnQueue.push({ type: g.type, at: t + i * g.interval });
    t += g.count * g.interval;
  }
  emit(run, 'wave', { wave: run.wave });
}

export function earlyStart(run) {
  if (run.phase !== 'build') return false;
  const bonus = Math.max(0, Math.round(run.buildTimeLeft * ECON.earlyStartPerSec));
  run.gold += bonus;
  emit(run, 'early_start', { bonus });
  startWave(run);
  return true;
}

function spawnEnemy(run, type) {
  const spec = ENEMIES[type];
  const s = MAP.spawn;
  const w = cellWorld(s.c, s.r);
  run.enemies.push({
    id: run.nextId++, type, spec,
    hp: spec.hp, maxHp: spec.hp,
    x: w.x, z: w.z, nodeIdx: 1, flying: spec.flying,
    slowT: 0, slowPct: 0, atkCd: 0, dead: false,
  });
  emit(run, 'enemy_spawn', { kind: type });
}

function coreReached(run, e) {
  run.coreHp = Math.max(0, run.coreHp - e.spec.dmg);
  run.totalHpLost += e.spec.dmg;
  e.dead = true;
  emit(run, 'core_hit', { dmg: e.spec.dmg, hp: run.coreHp });
  if (run.coreHp <= 0 && run.phase !== 'lost') {
    run.phase = 'lost';
    emit(run, 'fail', { wave: run.wave });
  }
}

function attackWall(run, e) {
  for (const nk in run.walls) {
    const w = run.walls[nk];
    const ww = cellWorld(w.c, w.r);
    if (dist(e.x, e.z, ww.x, ww.z) < 0.8) {
      if (e.atkCd <= 0) {
        w.hp -= BREAKER_WALL_DMG + e.spec.dmg;
        e.atkCd = 0.55;
        emit(run, 'hit', { x: ww.x, z: ww.z, wall: true });
        if (w.hp <= 0) {
          delete run.walls[nk];
          run.blocked.delete(nk);
          recompute(run);
          emit(run, 'wall_break', { c: w.c, r: w.r });
        }
      }
      return true; // 破墙兵停下打墙
    }
  }
  return false;
}

function updateEnemies(run) {
  const core = cellWorld(MAP.core.c, MAP.core.r);
  const path = run.path;
  for (const e of run.enemies) {
    if (e.dead) continue;
    const speed = e.spec.speed * (e.slowT > 0 ? 1 - e.slowPct : 1);
    if (e.slowT > 0) e.slowT -= STEP;
    if (e.atkCd > 0) e.atkCd -= STEP;

    if (e.flying) {
      const d = dist(e.x, e.z, core.x, core.z);
      if (d < 0.2) { coreReached(run, e); continue; }
      const s = Math.min(speed * STEP, d);
      e.x += ((core.x - e.x) / d) * s;
      e.z += ((core.z - e.z) / d) * s;
      continue;
    }

    if (e.spec.breaker && attackWall(run, e)) continue;

    if (!path.length || e.nodeIdx >= path.length) { coreReached(run, e); continue; }
    const target = cellWorld(path[e.nodeIdx].c, path[e.nodeIdx].r);
    const d = dist(e.x, e.z, target.x, target.z);
    if (d < 0.05) { e.nodeIdx += 1; continue; }
    const s = Math.min(speed * STEP, d);
    e.x += ((target.x - e.x) / d) * s;
    e.z += ((target.z - e.z) / d) * s;
  }
}

function pickTarget(run, x, z, range) {
  const core = cellWorld(MAP.core.c, MAP.core.r);
  let best = null, bestD = Infinity;
  for (const e of run.enemies) {
    if (e.dead) continue;
    const d = dist(x, z, e.x, e.z);
    if (d > range + e.spec.radius) continue;
    const progress = dist(e.x, e.z, core.x, core.z);
    if (progress < bestD) { bestD = progress; best = e; }
  }
  return best;
}

function damage(run, e, dmg, kind) {
  if (e.dead) return false;
  const eff = Math.max(1, dmg - e.spec.armor);
  e.hp -= eff;
  emit(run, 'hit', { x: e.x, z: e.z, dmg: eff, kind });
  if (e.hp <= 0) {
    e.dead = true;
    run.gold += e.spec.gold;
    run.kills += 1;
    emit(run, 'kill', { kind: e.type, gold: e.spec.gold });
    return true;
  }
  return false;
}

function slowEnemy(e, spec) {
  const resist = e.spec && e.spec.slowResist ? e.spec.slowResist : 0;
  const slow = spec.slow * (1 - resist);
  const dur = spec.slowDur * (1 - resist);
  if (slow > e.slowPct || dur > e.slowT) {
    e.slowPct = Math.max(e.slowPct, slow);
    e.slowT = Math.max(e.slowT, dur);
  }
}

function applyIce(run, t, spec, target) {
  if (spec.aoe > 0) {
    for (const e of run.enemies) {
      if (!e.dead && dist(e.x, e.z, target.x, target.z) <= spec.aoe) slowEnemy(e, spec);
    }
  } else {
    slowEnemy(target, spec);
  }
  damage(run, target, spec.dmg, 'ice');
  emit(run, 'slow', { x: target.x, z: target.z });
}

function updateTowers(run) {
  for (const nk in run.towers) {
    const t = run.towers[nk];
    if (t.cd > 0) { t.cd -= STEP; continue; }
    const spec = TOWERS[t.type].levels[t.level - 1];
    const w = cellWorld(t.c, t.r);
    const target = pickTarget(run, w.x, w.z, spec.range);
    if (!target) continue;
    if (t.type === 'ice') {
      applyIce(run, t, spec, target);
      t.cd = 1 / spec.rate;
    } else {
      run.projectiles.push({
        x: w.x, z: w.z, tx: target.x, tz: target.z,
        speed: spec.projSpeed, type: t.type, dmg: spec.dmg,
        aoe: spec.aoe || 0, crit: spec.crit || 0, rng: run.rng, target,
      });
      emit(run, 'shoot', { kind: t.type, x: w.x, z: w.z });
      t.cd = 1 / spec.rate;
    }
  }
}

function updateProjectiles(run) {
  for (let i = run.projectiles.length - 1; i >= 0; i--) {
    const p = run.projectiles[i];
    const d = dist(p.x, p.z, p.tx, p.tz);
    const step = p.speed * STEP;
    if (d <= step || d < 0.08) {
      if (p.type === 'cannon') {
        for (const e of run.enemies) {
          if (!e.dead && dist(e.x, e.z, p.tx, p.tz) <= p.aoe + e.spec.radius) damage(run, e, p.dmg, 'aoe');
        }
        emit(run, 'aoe', { x: p.tx, z: p.tz });
      } else if (p.target && !p.target.dead) {
        let dmg = p.dmg;
        const crit = p.crit && p.rng() < p.crit;
        if (crit) dmg *= 2;
        damage(run, p.target, dmg, crit ? 'crit' : 'arrow');
      }
      run.projectiles.splice(i, 1);
    } else {
      p.x += ((p.tx - p.x) / d) * step;
      p.z += ((p.tz - p.z) / d) * step;
    }
  }
}

function waveCleared(run) {
  const bonus = ECON.waveBonus(run.wave);
  run.gold += bonus;
  emit(run, 'wave_clear', { wave: run.wave, bonus });
  if (run.wave >= WAVES.length) {
    run.phase = 'won';
    emit(run, 'win', { hp: run.coreHp });
  } else {
    run.wave += 1;
    run.phase = 'build';
    run.buildTimeLeft = ECON.buildPhase;
  }
}

function stepCombat(run) {
  run._spawnT += STEP;
  while (run.spawnQueue.length && run.spawnQueue[0].at <= run._spawnT) spawnEnemy(run, run.spawnQueue.shift().type);
  updateEnemies(run);
  updateTowers(run);
  updateProjectiles(run);
  run.enemies = run.enemies.filter((e) => !e.dead);
  if (!run.spawnQueue.length && !run.enemies.length && run.phase === 'combat') waveCleared(run);
}

export function updateSim(run, input = {}) {
  if (input.build) buildTower(run, input.build.type, input.build.c, input.build.r);
  if (input.upgrade) upgradeTower(run, input.upgrade.c, input.upgrade.r);
  if (input.sell) sellTower(run, input.sell.c, input.sell.r);
  if (input.earlyStart) earlyStart(run);
  if (run.phase === 'won' || run.phase === 'lost') { run.time += STEP; return; }

  run.time += STEP;
  if (run.phase === 'build') {
    run.buildTimeLeft -= STEP;
    if (run.buildTimeLeft <= 0) startWave(run);
  } else if (run.phase === 'combat') {
    stepCombat(run);
  }
}

export function getHud(run) {
  return {
    time: run.time, gold: run.gold, wave: run.wave, totalWaves: WAVES.length,
    coreHp: run.coreHp, coreMax: run.coreMax, phase: run.phase,
    buildTimeLeft: run.buildTimeLeft, enemies: run.enemies.length, kills: run.kills,
  };
}

export function drainEvents(run) {
  const evs = run.events;
  run.events = [];
  return evs;
}

export function createSim({ seed = 1 } = {}) {
  const rng = mulberry32(seed);
  const rocks = MAP.rocks.map(([c, r]) => key(c, r));
  const run = {
    seed, rng, time: 0,
    gold: ECON.startGold,
    coreHp: ECON.coreHp, coreMax: ECON.coreHp,
    phase: 'build', wave: 1, buildTimeLeft: ECON.buildPhase,
    enemies: [], projectiles: [], towers: {}, walls: {},
    rocks: new Set(rocks), blocked: new Set(rocks),
    path: [], spawnQueue: [], nextId: 1, kills: 0, totalHpLost: 0, events: [],
    _spawnT: 0,
  };
  run.path = bfs(run) || [];
  run.step = (input = {}) => updateSim(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.startWave = () => { if (run.phase === 'build') startWave(run); };
  run.earlyStart = () => earlyStart(run);
  run.build = (type, c, r) => buildTower(run, type, c, r);
  run.upgrade = (c, r) => upgradeTower(run, c, r);
  run.sell = (c, r) => sellTower(run, c, r);
  run.canPlace = (type, c, r) => canPlace(run, type, c, r);
  run.previewPath = (c, r) => previewPath(run, c, r);
  emit(run, 'start', { wave: 1 });
  return run;
}
