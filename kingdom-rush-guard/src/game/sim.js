// 纯逻辑（可无头测试）：塔防对局状态机。
// 无 DOM / 无渲染依赖；selfplay.mjs 直接 import 本文件。
import { GAME, WORLD } from '../../config/game.config.js';
import { LEVELS, ENEMY_DEFS, TOWER_DEFS, TOWER_ORDER } from '../../config/levels.js';

// 可复现随机
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function preparePath(pts) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const x0 = pts[i][0]; const y0 = pts[i][1];
    const x1 = pts[i + 1][0]; const y1 = pts[i + 1][1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    segs.push({ x0, y0, x1, y1, len, acc: total });
    total += len;
  }
  return { segs, total };
}

function posAt(path, dist) {
  let d = dist;
  for (const s of path.segs) {
    if (d <= s.len || !s.len) {
      const t = s.len ? d / s.len : 1;
      return { x: s.x0 + (s.x1 - s.x0) * t, y: s.y0 + (s.y1 - s.y0) * t };
    }
    d -= s.len;
  }
  const last = path.segs[path.segs.length - 1];
  return { x: last.x1, y: last.y1 };
}

let NEXT_ID = 1;
function nid() { NEXT_ID += 1; return NEXT_ID; }

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIndex | 0))];
  const rng = mulberry32(opts.seed == null ? 1 : opts.seed);
  const paths = level.paths.map(preparePath);
  const baseMaxHp = GAME.BASE_HP;

  const state = {
    phase: 'playing', // playing | won | lost
    level: (levelIndex | 0) + 1,
    time: 0,
    gold: GAME.START_GOLD,
    baseHp: baseMaxHp,
    baseMaxHp,
    waveIndex: 0,        // 下一个要生成敌人的波
    waveTotal: level.waves.length,
    wavesSpawned: false,
    enemies: [],
    towers: [],
    cores: [],
    combo: 0,
    comboTimer: 0,
    overdrive: false,
    orbitalCharges: 0,
    orbitalNeeded: GAME.ORBITAL_CHARGES_NEEDED,
    killCount: 0,
    spawnCount: 0,
    stars: 0,
    reason: null,
  };

  const events = [];
  const emit = (type, payload = {}) => events.push({ type, t: state.time, ...payload });
  let lastPulse = 0; // 敌人在场时的推进心跳，保证「可感知反馈」事件密度

  // 波次生成状态
  let spawning = null;       // 当前正在生成的波对象
  let spawnIdx = 0;
  let spawnTimer = 0;
  let waveDelay = level.waves[0].delay;

  const spotById = (spotIdx) => level.buildSpots.find((s) => s.id === spotIdx) || null;
  const towerAt = (spotIdx) => state.towers.find((t) => t.spotIdx === spotIdx) || null;

  function spawnEnemy(typeKey, lane) {
    const def = ENEMY_DEFS[typeKey];
    const path = paths[lane];
    const enemy = {
      id: nid(),
      type: typeKey,
      lane,
      path,
      dist: 0,
      baseSpeed: def.speed,
      speed: def.speed,
      slowUntil: 0,
      hp: def.hp,
      maxHp: def.hp,
      reward: def.reward,
      playerHurt: def.playerHurt,
      radius: def.radius,
      alive: true,
    };
    const p = posAt(path, 0);
    enemy.x = p.x; enemy.y = p.y;
    state.enemies.push(enemy);
    state.spawnCount += 1;
    emit('spawn', { enemy: enemy.id, enemyType: typeKey, lane });
    return enemy;
  }

  function dropCore() {
    const open = level.buildSpots.filter((s) => !s.blocked && !towerAt(s.id));
    if (!open.length) return;
    const spot = open[Math.floor(rng() * open.length)];
    state.cores.push({ id: nid(), spotIdx: spot.id, x: spot.x, y: spot.y - 42 });
    emit('coreDrop', { spotIdx: spot.id, x: spot.x, y: spot.y - 42 });
  }

  function onKill(enemy) {
    if (!enemy.alive) return;
    enemy.alive = false;
    state.combo += 1;
    state.comboTimer = GAME.COMBO_DECAY;
    state.overdrive = state.combo >= GAME.COMBO_OVERDRIVE_AT;
    const mult = 1 + Math.min(state.combo, 10) * 0.06;
    state.gold += Math.round(enemy.reward * mult);
    state.killCount += 1;
    emit('kill', { enemy: enemy.id, enemyType: enemy.type, combo: state.combo, x: enemy.x, y: enemy.y });
    if (state.combo > 0 && state.combo % 4 === 0) emit('combo', { combo: state.combo });
    if (state.killCount % GAME.CORE_EVERY_KILLS === 0) dropCore();
  }

  function removeDead() {
    state.enemies = state.enemies.filter((e) => e.alive);
  }

  function damageEnemy(enemy, dmg, sourceType) {
    if (!enemy.alive) return false;
    enemy.hp -= dmg;
    emit('hit', { enemy: enemy.id, dmg, source: sourceType });
    if (enemy.hp <= 0) {
      onKill(enemy);
      return true;
    }
    return false;
  }

  function towerRange(t) {
    const def = TOWER_DEFS[t.type];
    return def.range[t.level - 1];
  }

  function towerAttack(t) {
    const def = TOWER_DEFS[t.type];
    return def.attack[t.level - 1];
  }

  function towerFire(t) {
    const def = TOWER_DEFS[t.type];
    const base = def.fire[t.level - 1];
    return state.overdrive ? base / (1 + GAME.OVERDRIVE_FIRE_BONUS) : base;
  }

  function nearestEnemyInRange(t, range) {
    let best = null;
    let bestDist = Infinity;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      if (d <= range && d < bestDist) { best = e; bestDist = d; }
    }
    return best;
  }

  function fireTower(t) {
    const def = TOWER_DEFS[t.type];
    const range = towerRange(t);
    const target = nearestEnemyInRange(t, range);
    if (!target) return;
    emit('shoot', { tower: t.id, towerType: t.type, x: t.x, y: t.y });
    if (def.aoe) {
      // 轨道炮：溅射目标周围
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - target.x, e.y - target.y) <= def.aoe) damageEnemy(e, towerAttack(t), t.type);
      }
    } else if (def.slow) {
      target.slowUntil = state.time + GAME.SLOW_DURATION;
      emit('slow', { enemy: target.id });
      damageEnemy(target, towerAttack(t), t.type);
    } else if (t.type === 'drone') {
      // 无人机：对塔近身小范围内所有敌人急速攻击
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - t.x, e.y - t.y) <= range) damageEnemy(e, towerAttack(t), t.type);
      }
    } else {
      damageEnemy(target, towerAttack(t), t.type);
    }
    removeDead();
  }

  function updateEnemies(dt) {
    for (const e of state.enemies) {
      if (!e.alive) continue;
      e.speed = (e.slowUntil > state.time) ? e.baseSpeed * GAME.SLOW_FACTOR : e.baseSpeed;
      e.dist += e.speed * dt;
      if (e.dist >= e.path.total) {
        // 到达基地
        e.alive = false;
        state.baseHp -= e.playerHurt;
        emit('leak', { enemy: e.id, hurt: e.playerHurt });
        if (state.baseHp <= 0) {
          state.baseHp = 0;
          state.phase = 'lost';
          state.reason = 'breach';
          emit('lose', { reason: 'breach' });
        }
        continue;
      }
      const p = posAt(e.path, e.dist);
      e.x = p.x; e.y = p.y;
    }
    if (state.phase === 'playing') removeDead();
  }

  function updateTowers(dt) {
    for (const t of state.towers) {
      t.cooldown -= dt;
      if (t.cooldown <= 0) {
        const hasTarget = nearestEnemyInRange(t, towerRange(t));
        if (hasTarget) {
          fireTower(t);
          t.cooldown = towerFire(t);
        } else {
          t.cooldown = 0.05;
        }
      }
    }
  }

  function updateWaves(dt) {
    if (state.wavesSpawned) return;
    if (spawning) {
      spawnTimer -= dt;
      while (spawnTimer <= 0 && spawnIdx < spawning.spawn.length) {
        const typeKey = spawning.spawn[spawnIdx];
        // 车道轮询：0,1,2 循环
        const lane = spawnIdx % 3;
        spawnEnemy(typeKey, lane);
        spawnIdx += 1;
        spawnTimer += spawning.genEvery;
      }
      if (spawnIdx >= spawning.spawn.length) {
        spawning = null;
        state.waveIndex += 1;
        if (state.waveIndex >= level.waves.length) {
          state.wavesSpawned = true;
        } else {
          waveDelay = level.waves[state.waveIndex].delay;
        }
      }
      return;
    }
    // 等待下一波
    if (state.waveIndex < level.waves.length) {
      waveDelay -= dt;
      if (waveDelay <= 0) {
        spawning = level.waves[state.waveIndex];
        spawnIdx = 0;
        spawnTimer = 0;
        emit('wave', { wave: state.waveIndex + 1, total: level.waves.length });
      }
    }
  }

  function checkEnd() {
    if (state.phase !== 'playing') return;
    if (state.wavesSpawned && state.enemies.length === 0 && !spawning) {
      state.phase = 'won';
      const hp = state.baseHp;
      state.stars = hp >= GAME.STAR_HP_3 ? 3 : hp >= GAME.STAR_HP_2 ? 2 : 1;
      state.reason = 'clear';
      emit('win', { stars: state.stars, baseHp: hp });
    }
  }

  // ---- 对外 ----
  const run = {
    state,
    _level: level,

    step(dt) {
      if (state.phase !== 'playing') return;
      state.time += dt;

      // 连击衰减
      if (state.comboTimer > 0) {
        state.comboTimer -= dt;
        if (state.comboTimer <= 0) {
          state.combo = 0;
          state.overdrive = false;
        }
      }

      updateWaves(dt);
      updateEnemies(dt);
      updateTowers(dt);
      if (state.enemies.length > 0 && state.time - lastPulse >= 1.0) {
        lastPulse = state.time;
        emit('advance', { enemies: state.enemies.length });
      }
      checkEnd();
    },

    drainEvents() {
      if (!events.length) return [];
      const out = events.splice(0, events.length);
      return out;
    },

    getHud() {
      return {
        gold: state.gold,
        baseHp: state.baseHp,
        baseMaxHp: state.baseMaxHp,
        wave: Math.min(state.waveIndex + (spawning ? 1 : 0) + 1, state.waveTotal),
        waveTotal: state.waveTotal,
        combo: state.combo,
        overdrive: state.overdrive,
        orbitalCharges: state.orbitalCharges,
        orbitalNeeded: state.orbitalNeeded,
        killCount: state.killCount,
        time: state.time,
      };
    },

    buildTower(spotIdx, typeKey) {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (!TOWER_DEFS[typeKey]) return { ok: false, reason: 'type' };
      const spot = spotById(spotIdx);
      if (!spot || spot.blocked) return { ok: false, reason: 'blocked' };
      if (towerAt(spotIdx)) return { ok: false, reason: 'occupied' };
      const cost = TOWER_DEFS[typeKey].cost;
      if (state.gold < cost) return { ok: false, reason: 'gold' };
      state.gold -= cost;
      const tower = { id: nid(), spotIdx, type: typeKey, level: 1, x: spot.x, y: spot.y, cooldown: 0.2, lane: spot.lane };
      state.towers.push(tower);
      emit('build', { tower: tower.id, towerType: typeKey, spotIdx });
      return { ok: true };
    },

    upgradeTower(spotIdx) {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      const t = towerAt(spotIdx);
      if (!t) return { ok: false, reason: 'no-tower' };
      if (t.level >= 4) return { ok: false, reason: 'max' };
      const cost = Math.round(TOWER_DEFS[t.type].cost * 0.7);
      if (state.gold < cost) return { ok: false, reason: 'gold' };
      state.gold -= cost;
      t.level += 1;
      emit('upgrade', { tower: t.id, towerType: t.type, level: t.level });
      return { ok: true };
    },

    sellTower(spotIdx) {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      const t = towerAt(spotIdx);
      if (!t) return { ok: false, reason: 'no-tower' };
      const refund = Math.round(TOWER_DEFS[t.type].cost * 0.5);
      state.gold += refund;
      state.towers = state.towers.filter((x) => x.id !== t.id);
      emit('sell', { tower: t.id, towerType: t.type, refund });
      return { ok: true };
    },

    collectCore() {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (!state.cores.length) return { ok: false, reason: 'no-core' };
      const core = state.cores.shift();
      state.gold += GAME.CORE_GOLD;
      state.orbitalCharges += 1;
      emit('core', { core: core.id, spotIdx: core.spotIdx, gold: GAME.CORE_GOLD });
      return { ok: true };
    },

    useOrbital() {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (state.orbitalCharges < GAME.ORBITAL_CHARGES_NEEDED) return { ok: false, reason: 'not-ready' };
      state.orbitalCharges -= GAME.ORBITAL_CHARGES_NEEDED;
      emit('orbital', { damage: GAME.ORBITAL_DAMAGE });
      for (const e of state.enemies) {
        if (e.alive) damageEnemy(e, GAME.ORBITAL_DAMAGE, 'orbital');
      }
      removeDead();
      return { ok: true };
    },

    // 调试/自对弈辅助：直接读建造点布局
    buildSpots() { return level.buildSpots; },
  };

  return run;
}
