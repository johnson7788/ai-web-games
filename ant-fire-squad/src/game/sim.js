// ANT FIRE SQUAD · 纯逻辑模拟（无 DOM，Node 可直接 import 供 selfplay / 单测）
// 玩法：火蚁自动巡逻，玩家点击投放火种；火蚁搬火种进熔炉 → 热量 + 连击倍率。
//       黄蜂从边缘扑向熔炉，撞上会扣热量；点黄蜂投放火兵烧掉它。
//       火花表蓄满触发随机特殊事件（火种雨/加速/金蛋/黄蜂/炸弹）。
//       达到目标热量前倒计时结束 = 失败；达到目标 = 过关。

import { WORLD, FORGE, ARENA, COMBO, SOLDIER, ANT, ORB, WASP, SPARK } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

let NEXT_ID = 1;
function uid() { return NEXT_ID++; }

export function createRun(levelIndex, opts = {}) {
  const lvl = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIndex | 0))];
  const rng = mulberry32((opts.seed == null ? 1 : opts.seed) >>> 0);

  const events = [];
  const state = {
    level: levelIndex + 1,
    phase: 'playing',       // playing | won | lost
    time: 0,
    timeLeft: lvl.time,
    initialTime: lvl.time,
    heat: 0,
    target: lvl.target,
    combo: 1,
    comboTimer: 0,
    bestCombo: 1,
    spark: 0,
    soldierCharges: SOLDIER.max,
    soldierRecharge: 0,
    ants: [],
    orbs: [],
    wasps: [],
    soldiers: [],
    specials: [],          // 短命视觉实体：boost 闪光 / 炸弹
    stats: { deliveries: 0, kills: 0, waspsSpawned: 0, forgeHits: 0, combos: 0 },
    nextWaspAt: lvl.waspFirstAt,
    specialBag: [],
  };

  function emit(type, payload = {}) {
    events.push({ type, ...payload });
  }

  function randomInArena() {
    return {
      x: ARENA.x0 + rng() * (ARENA.x1 - ARENA.x0),
      y: ARENA.y0 + rng() * (ARENA.y1 - ARENA.y0),
    };
  }

  function orbWeight() {
    return rng() < 0.55 ? ORB.minWeight : ORB.maxWeight;
  }

  // 初始火蚁：从熔炉附近出发
  for (let i = 0; i < lvl.ants; i += 1) {
    state.ants.push({
      id: uid(),
      x: FORGE.x + (rng() - 0.5) * 120,
      y: FORGE.y - 40 - rng() * 120,
      tx: 0, ty: 0, mode: 'wander', orbId: null,
      stun: 0, boost: 0,
    });
    state.ants[i].tx = ARENA.x0 + rng() * (ARENA.x1 - ARENA.x0);
    state.ants[i].ty = ARENA.y0 + rng() * (ARENA.y1 - ARENA.y0);
  }

  function spawnOrb(x, y, kind, weight) {
    // 场上未搬运火种达到上限时，先回收最旧的一枚，保持画面清爽
    const active = state.orbs.filter((o) => o.carriedBy == null);
    while (active.length >= ORB.cap) {
      const oldest = active.shift();
      state.orbs = state.orbs.filter((o) => o.id !== oldest.id);
    }
    const orb = {
      id: uid(), x, y, weight, kind, claimedBy: null, carriedBy: null, age: 0,
    };
    state.orbs.push(orb);
    return orb;
  }

  function fireSpecial() {
    // 洗牌袋：保证一轮内各类特殊事件都会出现一次（多样性、可预期）
    const base = lvl.bombs ? ['burst', 'boost', 'egg', 'wasp', 'bomb'] : ['burst', 'boost', 'egg', 'wasp'];
    if (state.specialBag.length === 0) {
      state.specialBag = base.slice();
      for (let i = state.specialBag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [state.specialBag[i], state.specialBag[j]] = [state.specialBag[j], state.specialBag[i]];
      }
    }
    const kind = state.specialBag.shift();
    const p = randomInArena();
    emit('special', { kind });

    if (kind === 'burst') {
      for (let i = 0; i < 3; i += 1) {
        const b = { x: p.x + (rng() - 0.5) * 160, y: p.y + (rng() - 0.5) * 120 };
        b.x = clamp(b.x, ARENA.x0, ARENA.x1);
        b.y = clamp(b.y, ARENA.y0, ARENA.y1);
        spawnOrb(b.x, b.y, 'ember', orbWeight());
      }
      emit('burst', { x: p.x, y: p.y });
    } else if (kind === 'boost') {
      for (const a of state.ants) a.boost = 5;
      state.specials.push({ kind: 'boost', x: p.x, y: p.y, ttl: 0.8 });
      emit('boost', { x: p.x, y: p.y });
    } else if (kind === 'egg') {
      spawnOrb(p.x, p.y, 'egg', 5);
      emit('egg', { x: p.x, y: p.y });
    } else if (kind === 'bomb') {
      state.specials.push({ kind: 'bomb', x: p.x, y: p.y, ttl: 1.4 });
      emit('bomb', { x: p.x, y: p.y });
    } else if (kind === 'wasp') {
      spawnWasp();
    }
  }

  function spawnWasp() {
    const side = Math.floor(rng() * 3);
    let x; let y;
    if (side === 0) { x = ARENA.x0 + rng() * (ARENA.x1 - ARENA.x0); y = ARENA.y0; }
    else if (side === 1) { x = ARENA.x0; y = ARENA.y0 + rng() * (ARENA.y1 - ARENA.y0); }
    else { x = ARENA.x1; y = ARENA.y0 + rng() * (ARENA.y1 - ARENA.y0); }
    state.wasps.push({ id: uid(), x, y, hp: lvl.waspHp, speed: lvl.waspSpeed });
    state.stats.waspsSpawned += 1;
    emit('spawnWasp', { id: state.wasps[state.wasps.length - 1].id, x, y });
  }

  function applyCombo() {
    if (state.comboTimer > 0) state.combo = Math.min(COMBO.max, state.combo + 1);
    else state.combo = 1;
    state.comboTimer = COMBO.window;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    if (state.combo > 1) { state.stats.combos += 1; emit('combo', { combo: state.combo }); }
  }

  function deliver(ant, orb) {
    const gain = orb.weight * state.combo;
    state.heat += gain;
    state.stats.deliveries += 1;
    applyCombo();
    state.orbs = state.orbs.filter((o) => o.id !== orb.id);
    ant.mode = 'wander';
    ant.orbId = null;
    emit('deliver', { weight: orb.weight, kind: orb.kind, gain, heat: state.heat, combo: state.combo });
  }

  function moveAnt(ant, dt) {
    if (ant.stun > 0) { ant.stun -= dt; return; }
    const speed = ANT.speed * (ant.boost > 0 ? 1.7 : 1);

    if (ant.mode === 'unload') {
      const orb = state.orbs.find((o) => o.id === ant.orbId);
      if (!orb) { ant.mode = 'wander'; ant.orbId = null; return; }
      ant.unloadT -= dt;
      if (ant.unloadT <= 0) deliver(ant, orb);
      return;
    }

    if (ant.mode === 'carry') {
      const orb = state.orbs.find((o) => o.id === ant.orbId);
      if (!orb) { ant.mode = 'wander'; ant.orbId = null; return; }
      const dx = FORGE.x - ant.x;
      const dy = FORGE.y - ant.y;
      const d = Math.hypot(dx, dy);
      if (d < FORGE.r + 6) {
        ant.mode = 'unload';
        ant.unloadT = ANT.unloadSec;
        return;
      }
      const carry = speed * clamp(1 - ANT.carrySlow * (orb.weight - 1), 0.35, 1);
      const step = carry * dt;
      ant.x += (dx / d) * step;
      ant.y += (dy / d) * step;
      orb.x = ant.x; orb.y = ant.y;
      return;
    }

    // seek：冲向目标火种
    if (ant.mode === 'seek') {
      const orb = state.orbs.find((o) => o.id === ant.orbId);
      if (!orb || orb.carriedBy != null || orb.claimedBy !== ant.id) {
        ant.mode = 'wander'; ant.orbId = null; return;
      }
      const dx = orb.x - ant.x;
      const dy = orb.y - ant.y;
      const d = Math.hypot(dx, dy);
      if (d < ANT.radius + 10) {
        orb.carriedBy = ant.id;
        ant.mode = 'carry';
        emit('grab', { weight: orb.weight, kind: orb.kind });
        return;
      }
      const step = speed * dt;
      ant.x += (dx / d) * step;
      ant.y += (dy / d) * step;
      return;
    }

    // wander：慢速巡逻
    const dx = ant.tx - ant.x;
    const dy = ant.ty - ant.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) {
      ant.tx = ARENA.x0 + rng() * (ARENA.x1 - ARENA.x0);
      ant.ty = ARENA.y0 + rng() * (ARENA.y1 - ARENA.y0);
      return;
    }
    const step = speed * 0.6 * dt;
    ant.x += (dx / d) * step;
    ant.y += (dy / d) * step;
  }

  function updateAnts(dt) {
    for (const a of state.ants) {
      if (a.boost > 0) a.boost -= dt;
      moveAnt(a, dt);
    }
  }

  function assignOrbs() {
    for (const a of state.ants) {
      if (a.mode !== 'wander') continue;
      let best = null;
      let bestD = Infinity;
      for (const o of state.orbs) {
        if (o.carriedBy != null || o.claimedBy != null) continue;
        const d = dist(a.x, a.y, o.x, o.y);
        if (d < bestD) { bestD = d; best = o; }
      }
      if (best) {
        best.claimedBy = a.id;
        a.orbId = best.id;
        a.mode = 'seek';
      }
    }
  }

  function updateWasps(dt) {
    for (const w of state.wasps) {
      const dx = FORGE.x - w.x;
      const dy = FORGE.y - w.y;
      const d = Math.hypot(dx, dy);
      if (d < FORGE.r + WASP.radius) {
        state.heat = Math.max(0, state.heat - lvl.waspDamage);
        state.combo = 1;
        state.comboTimer = 0;
        state.stats.forgeHits += 1;
        emit('forgeHit', { damage: lvl.waspDamage, heat: state.heat });
        w.dead = true;
        continue;
      }
      const step = w.speed * dt;
      w.x += (dx / d) * step;
      w.y += (dy / d) * step;
    }
    state.wasps = state.wasps.filter((w) => !w.dead);
  }

  function updateSoldiers(dt) {
    for (const s of state.soldiers) {
      let target = state.wasps.find((w) => w.id === s.targetWaspId);
      if (!target) target = state.wasps[0];
      if (!target) { s.dead = true; continue; }
      s.targetWaspId = target.id;
      const dx = target.x - s.x;
      const dy = target.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d < WASP.radius + 12) {
        target.hp -= 1;
        if (target.hp <= 0) {
          target.dead = true;
          state.stats.kills += 1;
          state.heat += SOLDIER.bonusHeat;
          emit('killWasp', { x: target.x, y: target.y, heat: state.heat });
        }
        s.dead = true;
        continue;
      }
      const step = SOLDIER.speed * dt;
      s.x += (dx / d) * step;
      s.y += (dy / d) * step;
    }
    state.wasps = state.wasps.filter((w) => !w.dead);
    state.soldiers = state.soldiers.filter((s) => !s.dead);
  }

  function updateSpecials(dt) {
    for (const s of state.specials) {
      s.ttl -= dt;
      if (s.kind === 'bomb' && s.ttl <= 0) {
        s.dead = true;
        for (const a of state.ants) {
          if (dist(a.x, a.y, s.x, s.y) < 92) {
            a.stun = ANT.stunSec;
            emit('stun', { antId: a.id });
          }
        }
      }
    }
    state.specials = state.specials.filter((s) => !s.dead);
  }

  function ageOrbs(dt) {
    for (const o of state.orbs) {
      if (o.carriedBy == null) o.age += dt;
    }
    state.orbs = state.orbs.filter((o) => o.carriedBy != null || o.age < 10);
  }

  const run = {
    state,

    step(dt) {
      if (state.phase !== 'playing') return;
      state.time += dt;
      state.timeLeft -= dt;

      if (state.comboTimer > 0) state.comboTimer -= dt;
      else state.combo = 1;

      state.soldierRecharge -= dt;
      if (state.soldierRecharge <= 0 && state.soldierCharges < SOLDIER.max) {
        state.soldierCharges += 1;
        state.soldierRecharge = SOLDIER.rechargeSec;
      }

      updateAnts(dt);
      assignOrbs();
      updateWasps(dt);
      updateSoldiers(dt);
      updateSpecials(dt);
      ageOrbs(dt);

      if (state.time >= state.nextWaspAt) {
        spawnWasp();
        state.nextWaspAt += lvl.waspEvery;
      }

      if (state.heat >= state.target) {
        state.phase = 'won';
        emit('win', { level: state.level, heat: state.heat, target: state.target });
      } else if (state.timeLeft <= 0) {
        state.phase = 'lost';
        emit('lose', { reason: 'timeOut', level: state.level, heat: state.heat, target: state.target });
      }
    },

    drainEvents() {
      const out = events.slice();
      events.length = 0;
      return out;
    },

    tap(x, y) {
      if (state.phase !== 'playing') return { ok: false };
      if (x < ARENA.x0 || x > ARENA.x1 || y < ARENA.y0 || y > ARENA.y1) return { ok: false };
      if (dist(x, y, FORGE.x, FORGE.y) < FORGE.r + 34) return { ok: false };
      spawnOrb(x, y, 'ember', orbWeight());
      state.spark += 1;
      if (state.spark >= SPARK.max) { state.spark = 0; fireSpecial(); }
      emit('drop', { x, y });
      return { ok: true };
    },

    dropSoldier(x, y) {
      if (state.phase !== 'playing') return { ok: false };
      if (state.soldierCharges <= 0) return { ok: false };
      let best = null;
      let bestD = Infinity;
      for (const w of state.wasps) {
        const d = dist(x, y, w.x, w.y);
        if (d < bestD) { bestD = d; best = w; }
      }
      if (!best || bestD > 170) return { ok: false };
      state.soldierCharges -= 1;
      state.soldierRecharge = SOLDIER.rechargeSec;
      state.soldiers.push({ id: uid(), x, y: ARENA.y0 - 20, targetWaspId: best.id });
      emit('dropSoldier', { x, y, target: best.id });
      return { ok: true };
    },

    // 调试/验收辅助：当前对局快照（不含函数）
    getHud() {
      return {
        level: state.level,
        phase: state.phase,
        heat: Math.floor(state.heat),
        target: state.target,
        timeLeft: state.timeLeft,
        combo: state.combo,
        soldierCharges: state.soldierCharges,
        soldierMax: SOLDIER.max,
        spark: state.spark,
        sparkMax: SPARK.max,
        ants: state.ants.length,
        wasps: state.wasps.length,
        bestCombo: state.bestCombo,
      };
    },
  };

  emit('levelStart', { level: state.level, target: state.target, time: state.timeLeft });
  return run;
}
