// ARCHER MISS 3D · 纯逻辑模拟（无 DOM，可被 node --test / selfplay / main 共同使用）
//
// 核心循环（1:1 保留参考源码 P0）：
//   玩家是站桩型弓箭手：移动时不张弓；停下即自动瞄准最近的敌人连射。
//   敌人（近战碎片 / 远程施法者）追玩家、靠近攻击或放弹道；弹道带预警圈。
//   清空本层敌人 → 三选一升级 → 下一层；死 → 结算；全通 → 胜利。
//
// 新机制：连击得分、岩石掩体挡箭、星级评级、急速/治疗强化水晶。
import { WORLD, STEP, BALANCE, UPGRADES, levelDef } from '../../config/game.config.js';

// ---------- 可复用 RNG（确定性 seed） ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// 从升级池按权重抽取 n 个不重复升级
function sampleUpgrades(rng, n) {
  const pool = UPGRADES.slice();
  const picks = [];
  while (picks.length < n && pool.length) {
    const total = pool.reduce((s, u) => s + u.weight, 0);
    let r = rng() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i += 1) {
      r -= pool[i].weight;
      if (r <= 0) { idx = i; break; }
    }
    picks.push(pool.splice(idx, 1)[0].id);
  }
  return picks;
}

function applyUpgrade(player, id) {
  switch (id) {
    case 'double': player.upgrades.doubleShot = true; break;
    case 'pierce': player.upgrades.pierce = true; break;
    case 'ice': player.upgrades.ice = true; break;
    case 'fire': player.upgrades.fire = true; break;
    case 'lightning': player.upgrades.lightning = true; break;
    case 'rapid': player.upgrades.rapid = true; break;
    case 'atk': player.upgrades.attack = (player.upgrades.attack || 1) * 1.4; break;
    case 'spd': player.upgrades.moveSpeed = (player.upgrades.moveSpeed || 1) * 1.25; break;
    case 'hp': player.upgrades.maxHpMul = (player.upgrades.maxHpMul || 1) + 0.3; break;
    case 'crit': player.upgrades.crit = (player.upgrades.crit || 0) + 0.15; break;
    default: break;
  }
}

export function createRun(opts = {}) {
  const seed = opts.seed == null ? 1 : opts.seed;
  const rng = mulberry32(seed);

  const state = {
    phase: 'title',       // title | playing | paused | result
    sub: null,            // 'upgrade'（关间选强化，暂停模拟）
    level: 0,             // 0 基当前关卡
    time: 0,
    won: false,
    score: 0,
    combo: 0,
    comboMax: 0,
    comboUntil: 0,
    stars: 0,             // 本层星级
    totalStars: 0,
    kills: 0,
    lastLevelStars: 0,
    player: {
      x: 0, y: 0, hp: 100, maxHp: 100, angle: 0,
      dirX: 0, dirY: 0, moving: false, aimLock: false, cooldown: 0, alive: true,
      rapidUntil: 0,
      upgrades: { attack: 1, moveSpeed: 1, maxHpMul: 1, crit: 0, doubleShot: false, pierce: false, ice: false, fire: false, lightning: false, rapid: false },
    },
    monsters: [],
    arrows: [],
    projectiles: [],
    warnings: [],
    rocks: [],
    powerups: [],
    pendingUpgrade: [],
  };

  const events = [];
  const emit = (type, payload = {}) => events.push({ type, ...payload });

  function playerAttackInterval() {
    const base = BALANCE.player.attackInterval;
    const rapid = state.player.rapidUntil > 0 ? BALANCE.powerup.rapidAttackInterval : base;
    return rapid;
  }

  function playerDamage() {
    return BALANCE.player.attack * (state.player.upgrades.attack || 1);
  }

  function critChance() {
    return BALANCE.player.critRate + (state.player.upgrades.crit || 0);
  }

  function critDamage() {
    return BALANCE.player.critDamage + (state.player.upgrades.crit || 0) * 1.5;
  }

  function spawnRocks(def) {
    const rocks = [];
    const count = def.rocks;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * TAU + (rng() - 0.5) * 0.5;
      const radius = 4.6 + rng() * 2.4;
      rocks.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, r: WORLD.ROCK_R });
    }
    return rocks;
  }

  function spawnMonsters(def) {
    const monsters = [];
    let id = 0;
    const spawnOne = (type, angle) => {
      const mdef = BALANCE.monster[type];
      const hp = mdef.hp * def.hpMul;
      monsters.push({
        id: id++, type, kind: type,
        x: Math.cos(angle) * 8.6, y: Math.sin(angle) * 8.6,
        hp, maxHp: hp,
        attack: mdef.attack * def.atkMul,
        attackInterval: mdef.attackInterval,
        moveSpeed: mdef.moveSpeed * def.spdMul,
        range: mdef.range,
        cooldown: 0.4 + rng() * 0.8,
        angle: 0,
        slowed: 0,
        burning: 0,
        burnTick: 0,
      });
    };
    const total = def.shards + def.casters;
    // 敌人集中刷在玩家前方（上屏 -y）约 100° 扇形内，便于风筝与可读性
    for (let i = 0; i < total; i += 1) {
      const type = i < def.shards ? 'shard' : 'caster';
      const angle = -Math.PI / 2 + (rng() - 0.5) * 1.8;
      spawnOne(type, angle);
    }
    return monsters;
  }

  function setupLevel(levelIndex) {
    const def = levelDef(levelIndex);
    state.level = levelIndex;
    state.rocks = spawnRocks(def);
    state.monsters = spawnMonsters(def);
    state.arrows = [];
    state.projectiles = [];
    state.warnings = [];
    state.powerups = [];
    state.combo = 0;
    state.comboUntil = 0;
    state.stars = 0;
    state.sub = null;
    state.phase = 'playing';
    const p = state.player;
    p.x = 0; p.y = 0; p.moving = false; p.aimLock = false; p.cooldown = 0.2; p.rapidUntil = 0; p.alive = true;
    emit('spawn', { level: levelIndex + 1, monsters: state.monsters.length, rocks: state.rocks.length });
  }

  function nearestMonster() {
    const p = state.player;
    let best = null;
    let bd = Infinity;
    for (const m of state.monsters) {
      if (m.hp <= 0) continue;
      const d = dist(p.x, p.y, m.x, m.y);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  function fireArrow() {
    const p = state.player;
    const target = nearestMonster();
    if (!target) return;
    p.angle = Math.atan2(target.y - p.y, target.x - p.x);
    const dir = { x: Math.cos(p.angle), y: Math.sin(p.angle) };
    const mk = (spread) => {
      const a = p.angle + spread;
      state.arrows.push({
        x: p.x + Math.cos(a) * 0.4, y: p.y + Math.sin(a) * 0.4,
        vx: Math.cos(a) * BALANCE.arrow.speed, vy: Math.sin(a) * BALANCE.arrow.speed,
        life: BALANCE.arrow.life, pierced: false,
      });
    };
    mk(0);
    if (p.upgrades.doubleShot) { mk(0.14); mk(-0.14); }
    emit('shoot');
  }

  function hurtPlayer(damage, source = 'monster') {
    const p = state.player;
    if (!p.alive) return;
    // 闪避
    if (rng() < BALANCE.player.dodge) return;
    p.hp -= damage;
    p.combo = 0; p.comboUntil = 0;
    emit('hurt', { damage: Math.round(damage), hp: Math.max(0, p.hp), source });
    if (p.hp <= 0) {
      p.hp = 0; p.alive = false; state.won = false; state.phase = 'result';
      emit('lose', { reason: source });
    }
  }

  function killMonster(m) {
    m.hp = 0;
    state.kills += 1;
    state.combo += 1;
    state.comboUntil = BALANCE.comboWindow;
    if (state.combo > state.comboMax) state.comboMax = state.combo;
    const mult = 1 + state.combo * 0.1;
    state.score += Math.round(100 * mult);
    emit('kill', { id: m.id, combo: state.combo });
    if (state.combo % 5 === 0) emit('combo', { combo: state.combo });
    // 掉落强化水晶
    if (rng() < 0.14) state.powerups.push({ x: m.x, y: m.y, kind: 'rapid', r: BALANCE.powerup.radius });
    else if (rng() < 0.12) state.powerups.push({ x: m.x, y: m.y, kind: 'heal', r: BALANCE.powerup.radius });
  }

  function damageMonster(m, dmg) {
    m.hp -= dmg;
    // 冰霜减速 / 灼烧
    if (state.player.upgrades.ice) m.slowed = 1.2;
    if (state.player.upgrades.fire) { m.burning = 2.0; m.burnTick = 0; }
    // 连锁闪电：波及附近一个敌人
    if (state.player.upgrades.lightning) {
      let bd = Infinity; let bn = null;
      for (const o of state.monsters) {
        if (o === m || o.hp <= 0) continue;
        const d = dist(m.x, m.y, o.x, o.y);
        if (d < 3.2 && d < bd) { bd = d; bn = o; }
      }
      if (bn) bn.hp -= dmg * 0.5;
    }
    emit('arrowHit', { id: m.id, hp: Math.max(0, m.hp) });
    if (m.hp <= 0) killMonster(m);
  }

  function stepArrows(dt) {
    const p = state.player;
    for (let i = state.arrows.length - 1; i >= 0; i -= 1) {
      const a = state.arrows[i];
      a.life -= dt;
      const steps = 3;
      let dead = a.life <= 0;
      for (let s = 0; s < steps && !dead; s += 1) {
        a.x += a.vx * dt / steps;
        a.y += a.vy * dt / steps;
        // 出界
        if (dist(0, 0, a.x, a.y) > WORLD.ARENA_R) { dead = true; break; }
        // 岩石挡箭（核心机制）
        let hitRock = false;
        for (const r of state.rocks) {
          if (dist(a.x, a.y, r.x, r.y) < r.r + BALANCE.arrow.radius) { hitRock = true; break; }
        }
        if (hitRock) { dead = true; break; }
        // 命中敌人
        for (const m of state.monsters) {
          if (m.hp <= 0) continue;
          if (dist(a.x, a.y, m.x, m.y) < WORLD.MONSTER_R + BALANCE.arrow.radius) {
            let dmg = playerDamage();
            if (rng() < critChance()) dmg *= critDamage();
            damageMonster(m, dmg);
            if (state.player.upgrades.pierce && !a.pierced) { a.pierced = true; break; }
            dead = true;
            break;
          }
        }
      }
      if (dead) state.arrows.splice(i, 1);
    }
  }

  function stepMonsters(dt) {
    const p = state.player;
    if (!p.alive) return;
    for (const m of state.monsters) {
      if (m.hp <= 0) continue;
      const spd = m.moveSpeed * (m.slowed > 0 ? 0.55 : 1);
      m.slowed = Math.max(0, m.slowed - dt);
      m.cooldown -= dt;
      // 灼烧 DoT
      if (m.burning > 0) {
        m.burning -= dt; m.burnTick += dt;
        if (m.burnTick >= 0.5) { m.burnTick = 0; damageMonster(m, Math.round(m.maxHp * 0.05)); if (m.hp <= 0) continue; }
      }
      const d = dist(p.x, p.y, m.x, m.y);
      m.angle = Math.atan2(p.y - m.y, p.x - m.x);

      if (m.type === 'caster') {
        // 保持距离 + 放弹道
        const want = m.range * 0.9;
        let dx = 0; let dy = 0;
        if (d > m.range) { dx = Math.cos(m.angle); dy = Math.sin(m.angle); }
        else if (d < want) { dx = -Math.cos(m.angle); dy = -Math.sin(m.angle); }
        moveEntity(m, dx, dy, spd, dt, WORLD.MONSTER_R);
        if (m.cooldown <= 0 && d <= m.range * 1.4) {
          m.cooldown = m.attackInterval;
          // 预警圈放在玩家当前位置
          state.warnings.push({ x: p.x, y: p.y, r: 1.0, t: BALANCE.projectile.warningSec, target: { x: p.x, y: p.y }, dmg: m.attack });
          emit('warn', { id: m.id });
        }
      } else {
        // 近战：追玩家，贴脸攻击
        if (d > m.range) {
          moveEntity(m, Math.cos(m.angle), Math.sin(m.angle), spd, dt, WORLD.MONSTER_R);
        } else if (m.cooldown <= 0) {
          m.cooldown = m.attackInterval;
          hurtPlayer(m.attack, m.type);
        }
      }
    }
    state.monsters = state.monsters.filter((m) => m.hp > 0);
  }

  function moveEntity(e, dx, dy, speed, dt, r) {
    const nx = e.x + dx * speed * dt;
    const ny = e.y + dy * speed * dt;
    // 岩石阻挡（简单：撞上则不移动）
    for (const rock of state.rocks) {
      if (dist(nx, ny, rock.x, rock.y) < rock.r + r) return;
    }
    const lim = WORLD.ARENA_R - r;
    const len = Math.hypot(nx, ny);
    if (len > lim) { const k = lim / len; e.x = nx * k; e.y = ny * k; }
    else { e.x = nx; e.y = ny; }
  }

  function stepWarnings(dt) {
    for (let i = state.warnings.length - 1; i >= 0; i -= 1) {
      const w = state.warnings[i];
      w.t -= dt;
      if (w.t <= 0) {
        // 生成弹道，飞向预警时锁定的玩家位置
        const dx = w.target.x - w.x;
        const dy = w.target.y - w.y;
        const len = Math.hypot(dx, dy) || 1;
        state.projectiles.push({
          x: w.x, y: w.y,
          vx: dx / len * BALANCE.projectile.speed, vy: dy / len * BALANCE.projectile.speed,
          life: 3.0,
          dmg: w.dmg || 10,
        });
        emit('projectile');
        state.warnings.splice(i, 1);
      }
    }
  }

  function stepProjectiles(dt) {
    const p = state.player;
    for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
      const pr = state.projectiles[i];
      pr.life -= dt;
      let dead = pr.life <= 0;
      const steps = 3;
      for (let s = 0; s < steps && !dead; s += 1) {
        pr.x += pr.vx * dt / steps;
        pr.y += pr.vy * dt / steps;
        if (dist(0, 0, pr.x, pr.y) > WORLD.ARENA_R) { dead = true; break; }
        for (const r of state.rocks) {
          if (dist(pr.x, pr.y, r.x, r.y) < r.r + BALANCE.projectile.radius) { dead = true; break; }
        }
        if (dead) break;
        if (p.alive && dist(pr.x, pr.y, p.x, p.y) < WORLD.PLAYER_R + BALANCE.projectile.radius) {
          hurtPlayer(pr.dmg || 10, 'projectile');
          dead = true;
          break;
        }
      }
      if (dead) state.projectiles.splice(i, 1);
    }
  }

  function stepPowerups(dt) {
    const p = state.player;
    for (let i = state.powerups.length - 1; i >= 0; i -= 1) {
      const pu = state.powerups[i];
      if (p.alive && dist(p.x, p.y, pu.x, pu.y) < WORLD.PLAYER_R + pu.r) {
        if (pu.kind === 'rapid') {
          const dur = BALANCE.powerup.rapidDuration * (state.player.upgrades.rapid ? 1.6 : 1);
          p.rapidUntil = Math.max(p.rapidUntil, state.time + dur);
        } else if (pu.kind === 'heal') {
          p.hp = Math.min(p.maxHp, p.hp + 25);
        }
        emit('powerup', { kind: pu.kind });
        state.powerups.splice(i, 1);
      }
    }
  }

  function computeStars() {
    const hpRatio = state.player.hp / state.player.maxHp;
    const fast = state.time < 60;
    if (hpRatio > 0.7 && fast) return 3;
    if (hpRatio > 0.4) return 2;
    return 1;
  }

  function checkLevelClear() {
    if (state.monsters.length > 0) return;
    state.stars = computeStars();
    state.totalStars += state.stars;
    state.lastLevelStars = state.stars;
    if (state.level >= BALANCE.levelCount - 1) {
      state.won = true;
      state.phase = 'result';
      emit('win', { stars: state.stars });
    } else {
      state.sub = 'upgrade';
      state.pendingUpgrade = sampleUpgrades(rng, 3);
      emit('levelClear', { stars: state.stars, level: state.level + 1 });
    }
  }

  // ---------- run 对象 ----------
  const run = {
    get state() { return state; },

    start(levelIndex = 0) {
      state.score = 0; state.combo = 0; state.comboMax = 0; state.kills = 0; state.totalStars = 0; state.won = false;
      state.player.upgrades = { attack: 1, moveSpeed: 1, maxHpMul: 1, crit: 0, doubleShot: false, pierce: false, ice: false, fire: false, lightning: false, rapid: false };
      const p = state.player;
      p.maxHp = BALANCE.player.hp;
      p.hp = p.maxHp;
      state.time = 0;
      setupLevel(Math.max(0, Math.min(levelIndex, BALANCE.levelCount - 1)));
      return { ok: true };
    },

    setMove(dx, dy) {
      if (state.phase !== 'playing' || state.sub === 'upgrade' || !state.player.alive) return { ok: false };
      const p = state.player;
      const moving = !!(dx || dy);
      if (moving) {
        const len = Math.hypot(dx, dy) || 1;
        p.dirX = dx / len; p.dirY = dy / len;
        p.angle = Math.atan2(p.dirY, p.dirX);
        p.moving = true;
      } else {
        if (p.moving) p.aimLock = true; // 第一次「停下」后解锁自动射击
        p.moving = false;
      }
      return { ok: true };
    },

    chooseUpgrade(id) {
      if (state.sub !== 'upgrade' || !state.pendingUpgrade.includes(id)) return { ok: false };
      applyUpgrade(state.player, id);
      // 生命强化回血 + 提上限
      if (id === 'hp') {
        const p = state.player;
        const oldMax = p.maxHp;
        p.maxHp = Math.round(BALANCE.player.hp * (p.upgrades.maxHpMul || 1));
        p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - oldMax) + 30);
      }
      state.pendingUpgrade = [];
      state.sub = null;
      state.time = 0;
      setupLevel(state.level + 1);
      return { ok: true };
    },

    step(dt) {
      if (state.phase !== 'playing' || state.sub === 'upgrade') return;
      const dtc = clamp(dt, 0, 0.1);
      state.time += dtc;
      const p = state.player;
      p.cooldown -= dtc;
      if (p.rapidUntil > 0) p.rapidUntil -= dtc;
      // 连击衰减
      if (state.comboUntil > 0) {
        state.comboUntil -= dtc;
        if (state.comboUntil <= 0) state.combo = 0;
      }
      // 玩家移动
      if (p.moving && p.alive) {
        moveEntity(p, p.dirX, p.dirY, BALANCE.player.moveSpeed * (p.upgrades.moveSpeed || 1), dtc, WORLD.PLAYER_R);
      }
      // 自动射击：站定 + 已解锁 + 有敌人
      if (!p.moving && p.aimLock && p.alive && p.cooldown <= 0 && state.monsters.length > 0) {
        fireArrow();
        p.cooldown = playerAttackInterval();
      }
      stepArrows(dtc);
      stepMonsters(dtc);
      stepWarnings(dtc);
      stepProjectiles(dtc);
      stepPowerups(dtc);
      checkLevelClear();
    },

    drainEvents() {
      return events.splice(0, events.length);
    },

    getHud() {
      const p = state.player;
      return {
        phase: state.phase,
        level: state.level + 1,
        targets: state.monsters.length,
        hp: Math.max(0, Math.ceil(p.hp)),
        maxHp: p.maxHp,
        score: state.score,
        combo: state.combo,
        comboMax: state.comboMax,
        stars: state.totalStars,
        kills: state.kills,
        pendingUpgrade: state.pendingUpgrade.slice(),
      };
    },

    // 调试/验收用
    pause() { if (state.phase === 'playing') state.phase = 'paused'; return { ok: true }; },
    resume() { if (state.phase === 'paused') state.phase = 'playing'; return { ok: true }; },
    forceKillAll() {
      for (const m of state.monsters) { m.hp = 0; }
      state.monsters = [];
      checkLevelClear();
      return { ok: true };
    },
  };

  return run;
}

export default createRun;
export { STEP as SIM_STEP };
