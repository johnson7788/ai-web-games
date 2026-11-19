// tank-siege-io · 纯逻辑（零 DOM，Node 可直接 import）
// 玩法：霓虹街机坦克围城。玩家守住底部核心，抵御逐波进攻的 AI 坦克。
// 事件（drainEvents 消费）：waveStart / shoot / hit / kill / brickBreak / rockBreak /
//   powerup / combo / coreHit / playerHit / win / lose
import { GAME } from '../../config/game.config.js';

// ---------- 确定性随机（bot / 测试可复现） ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 地形
export const TILE = { EMPTY: 0, BRICK: 1, ROCK: 2, STEEL: 3, GRASS: 4 };

// 方向：0 上 1 右 2 下 3 左
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const DIR_NAMES = ['up', 'right', 'down', 'left'];

const SOLID = new Set([TILE.BRICK, TILE.ROCK, TILE.STEEL]);

// ---------- 地图（对称，中心列 6 与玩家行 11 始终畅通，供敌人推进 / 玩家射击） ----------
function emptyGrid() {
  const grid = [];
  for (let r = 0; r < GAME.ROWS; r += 1) grid.push(new Array(GAME.COLS).fill(TILE.EMPTY));
  return grid;
}

function buildGrid(level) {
  const g = emptyGrid();
  const COLS = GAME.COLS;
  const set = (c, r, t) => { if (c >= 0 && c < COLS && r >= 0 && r < GAME.ROWS) g[r][c] = t; };
  // 关于中心列 6 镜像
  const M = (c, r, t) => { set(c, r, t); set(COLS - 1 - c, r, t); };

  // 核心两侧护墙（永久）
  set(5, 12, TILE.BRICK); set(7, 12, TILE.BRICK);

  // 顶部角落砖簇（永久）
  M(1, 1, TILE.BRICK); M(2, 1, TILE.BRICK); M(1, 2, TILE.BRICK); M(2, 2, TILE.BRICK);
  M(2, 3, TILE.BRICK);

  // 中部砖掩体（永久，避开中心列）
  M(2, 4, TILE.BRICK); M(3, 4, TILE.BRICK); M(4, 4, TILE.BRICK);
  M(2, 5, TILE.BRICK);
  M(4, 6, TILE.BRICK);
  M(2, 7, TILE.BRICK);
  M(2, 8, TILE.BRICK); M(3, 8, TILE.BRICK); M(4, 8, TILE.BRICK);
  M(4, 9, TILE.BRICK);

  // 底部两翼砖（永久）
  M(1, 10, TILE.BRICK); M(2, 10, TILE.BRICK);

  // 第 2 波起：岩石（2 击可破）
  if (level >= 2) {
    M(3, 5, TILE.ROCK); M(4, 5, TILE.ROCK);
    M(2, 6, TILE.ROCK);
    M(3, 9, TILE.ROCK);
  }
  // 第 3 波起：钢墙（不可破，守角）
  if (level >= 3) {
    set(1, 0, TILE.STEEL); set(0, 1, TILE.STEEL);
    set(COLS - 2, 0, TILE.STEEL); set(COLS - 1, 1, TILE.STEEL);
    set(0, 9, TILE.STEEL); set(0, 10, TILE.STEEL);
    set(COLS - 1, 9, TILE.STEEL); set(COLS - 1, 10, TILE.STEEL);
  }
  return g;
}

// ---------- 波次构成 ----------
function waveComposition(level) {
  const total = 1 + level; // L1:2, L2:3, L3:4 ...
  const list = [];
  const armorCount = level >= 4 ? Math.floor((level - 2) / 2) : 0;
  for (let i = 0; i < total; i += 1) {
    if (i < armorCount) list.push('armor');
    else if (level >= 3 && i % 4 === 2) list.push('speed');
    else list.push('normal');
  }
  return list;
}

// ---------- 核心创建 ----------
export function createRun(seed = 1, opts = {}) {
  const rng = mulberry32(seed);
  const events = [];

  const state = {
    phase: 'playing',      // playing | lost
    level: 1,
    time: 0,
    levelTime: 0,
    score: 0,
    bestCombo: 0,
    combo: 0,
    comboTimer: 0,
    grid: buildGrid(1),
    tanks: [],
    bullets: [],
    powerups: [],
    core: { c: GAME.CORE.pos[0], r: GAME.CORE.pos[1], hp: GAME.CORE.maxHp, maxHp: GAME.CORE.maxHp, alive: true },
    spawnQueue: [],
    spawnTimer: 0,
    aliveEnemies: 0,
    intermission: 0,
    player: null,
    shake: 0,
    kills: 0,
  };

  const emit = (type, payload = {}) => events.push({ type, ...payload });

  // ---------- 查询 ----------
  const inBounds = (c, r) => c >= 0 && c < GAME.COLS && r >= 0 && r < GAME.ROWS;
  const tileAt = (c, r) => (inBounds(c, r) ? state.grid[r][c] : TILE.STEEL);
  const tankAt = (c, r, excludeId) => state.tanks.find((t) => t.alive && t.c === c && t.r === r && t.id !== excludeId);
  const coreAt = (c, r) => state.core.alive && c === state.core.c && r === state.core.r;
  const passable = (c, r, id) => inBounds(c, r) && !SOLID.has(tileAt(c, r)) && !coreAt(c, r) && !tankAt(c, r, id);

  function makeTank(id, team, type, c, r, dir) {
    const base = type === 'player' ? GAME.PLAYER : GAME.ENEMY[type];
    return {
      id,
      team,
      type,
      c, r, dir,
      hp: base.hp,
      maxHp: base.hp,
      speed: base.speed,
      fireInterval: base.fireInterval,
      fireCd: type === 'player' ? 0 : 0.6 + rng() * 0.6, // 敌人错峰开火
      moveTimer: 0,
      moving: false,
      fireHeld: false,
      alive: true,
      // 增益
      shieldUntil: 0,
      rapidUntil: 0,
      tripleUntil: 0,
      speedUntil: 0,
      score: base.score || 0,
    };
  }

  function spawnPlayer() {
    const [c, r] = GAME.PLAYER.spawn;
    const p = makeTank(0, 0, 'player', c, r, 0);
    p.moving = false;
    state.player = p;
    state.tanks.push(p);
  }

  function freeSpawnPos() {
    const shuffled = [...GAME.SPAWNS].sort(() => rng() - 0.5);
    for (const [c, r] of shuffled) {
      if (!tankAt(c, r) && !coreAt(c, r) && !SOLID.has(tileAt(c, r))) return { c, r };
    }
    return null;
  }

  function spawnEnemy(type) {
    const pos = freeSpawnPos();
    if (!pos) return false;
    const id = state.tanks.length ? Math.max(...state.tanks.map((t) => t.id)) + 1 : 1;
    const e = makeTank(id, 1, type, pos.c, pos.r, 2); // 朝下
    e.moving = true;
    state.tanks.push(e);
    state.aliveEnemies += 1;
    return true;
  }

  function startLevel(level) {
    state.level = level;
    state.levelTime = 0;
    state.bestCombo = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.grid = buildGrid(level);
    state.spawnQueue = waveComposition(level);
    state.spawnTimer = 0.9;
    state.intermission = 0;
    state.bullets = [];
    state.powerups = [];
    // 清掉残敌
    for (const t of state.tanks) if (t.team === 1) t.alive = false;
    state.tanks = state.tanks.filter((t) => t.alive);
    state.aliveEnemies = 0;
    // 开场护盾
    if (state.player && state.player.alive) {
      state.player.shieldUntil = state.time + GAME.PLAYER.spawnShield;
    }
    emit('waveStart', { level });
  }

  // ---------- 射击 ----------
  function fireBullet(tank, dir) {
    const dx = DX[dir];
    const dy = DY[dir];
    const bx = tank.c + 0.5 + dx * 1.0;
    const by = tank.r + 0.5 + dy * 1.0;
    state.bullets.push({
      x: bx, y: by, dx, dy,
      speed: GAME.BULLET_SPEED,
      team: tank.team,
      alive: true,
    });
    emit('shoot', { team: tank.team, c: tank.c, r: tank.r, dir });
  }

  function tryFire(tank) {
    if (!tank.alive || tank.fireCd > 0) return false;
    tank.fireCd = tank.fireInterval * (tank.rapidUntil > state.time ? 0.5 : 1);
    const dirs = tank.tripleUntil > state.time ? [(tank.dir + 3) % 4, tank.dir, (tank.dir + 1) % 4] : [tank.dir];
    for (const d of dirs) fireBullet(tank, d);
    return true;
  }

  // ---------- 子弹 ----------
  function bulletHitTank(b, c, r) {
    const t = tankAt(c, r);
    if (!t || t.team === b.team) return false;
    if (t.shieldUntil > state.time) return true; // 护盾吞弹
    t.hp -= 1;
    if (t.team === 0) emit('playerHit', { c, r });
    else emit('hit', { c, r, id: t.id });
    if (t.hp <= 0) killTank(t);
    return true;
  }

  function killTank(t) {
    t.alive = false;
    if (t.team === 0) {
      loseGame('tank');
      return;
    }
    if (t.team === 1) {
      state.aliveEnemies -= 1;
      state.kills += 1;
      state.combo += 1;
      state.comboTimer = GAME.COMBO_WINDOW;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      const mult = state.combo;
      state.score += t.score * mult;
      if (state.combo >= 2) emit('combo', { combo: state.combo });
      emit('kill', { id: t.id, kind: t.type, combo: state.combo, score: t.score * mult, c: t.c, r: t.r });
      maybeDropPowerup(t.c, t.r);
    }
  }

  function stepBullets(dt) {
    for (const b of state.bullets) {
      if (!b.alive) continue;
      const steps = Math.max(1, Math.ceil((b.speed * dt) / 0.25)); // 子步防穿透
      const sub = (b.speed * dt) / steps;
      for (let i = 0; i < steps && b.alive; i += 1) {
        b.x += b.dx * sub;
        b.y += b.dy * sub;
        const c = Math.floor(b.x);
        const r = Math.floor(b.y);
        if (!inBounds(c, r)) { b.alive = false; break; }
        const t = tileAt(c, r);
        if (SOLID.has(t)) {
          damageTile(c, r, t);
          b.alive = false;
          break;
        }
        if (coreAt(c, r)) {
          state.core.hp -= 1;
          state.shake = Math.max(state.shake, 4);
          emit('coreHit', { hp: state.core.hp });
          if (state.core.hp <= 0) { state.core.alive = false; loseGame('core'); }
          b.alive = false;
          break;
        }
        if (bulletHitTank(b, c, r)) { b.alive = false; break; }
      }
    }
    state.bullets = state.bullets.filter((b) => b.alive);
  }

  function damageTile(c, r, t) {
    const cell = state.grid[r][c];
    if (t === TILE.BRICK) {
      state.grid[r][c] = TILE.EMPTY;
      state.score += 5;
      emit('brickBreak', { c, r });
    } else if (t === TILE.ROCK) {
      state.grid[r][c] = TILE.BRICK; // 岩石一枪变砖
      emit('rockBreak', { c, r });
    } else {
      // 钢墙：不可破
    }
    state.shake = Math.max(state.shake, 2);
    void cell;
  }

  // ---------- 道具 ----------
  function maybeDropPowerup(c, r) {
    if (rng() > GAME.POWERUP_DROP) return;
    const kinds = ['speed', 'rapid', 'shield', 'repair', 'triple'];
    const kind = kinds[Math.floor(rng() * kinds.length)];
    state.powerups.push({ c, r, kind, ttl: GAME.POWERUP_TTL });
  }

  function applyPowerup(p) {
    const pl = state.player;
    if (p.kind === 'repair') {
      state.core.hp = Math.min(state.core.maxHp, state.core.hp + 5);
    } else if (p.kind === 'speed') {
      pl.speedUntil = state.time + GAME.POWERUP_DURATION;
    } else if (p.kind === 'rapid') {
      pl.rapidUntil = state.time + GAME.POWERUP_DURATION;
    } else if (p.kind === 'shield') {
      pl.shieldUntil = state.time + 6.0;
    } else if (p.kind === 'triple') {
      pl.tripleUntil = state.time + GAME.POWERUP_DURATION;
    }
    state.score += 50;
    emit('powerup', { kind: p.kind, c: p.c, r: p.r });
  }

  function stepPowerups(dt) {
    for (const p of state.powerups) p.ttl -= dt;
    state.powerups = state.powerups.filter((p) => p.ttl > 0);
    const pl = state.player;
    if (pl && pl.alive) {
      const idx = state.powerups.findIndex((p) => p.c === pl.c && p.r === pl.r);
      if (idx >= 0) {
        const [p] = state.powerups.splice(idx, 1);
        applyPowerup(p);
      }
    }
  }

  // ---------- 移动 ----------
  function moveTank(t, dt) {
    if (!t.alive || !t.moving) return;
    t.moveTimer -= dt;
    const interval = 1 / (t.speed * (t.speedUntil > state.time ? 1.5 : 1));
    if (t.moveTimer <= 0) {
      t.moveTimer += interval;
      const nc = t.c + DX[t.dir];
      const nr = t.r + DY[t.dir];
      if (passable(nc, nr, t.id)) {
        t.c = nc;
        t.r = nr;
      }
    }
  }

  // ---------- 敌人 AI ----------
  function losDir(e, target) {
    if (e.c === target.c) {
      const d = target.r > e.r ? 2 : 0;
      const dr = Math.sign(target.r - e.r);
      let r = e.r + dr;
      while (r !== target.r) {
        if (SOLID.has(tileAt(e.c, r))) return null;
        const tank = tankAt(e.c, r, e.id);
        if (tank && tank.team === e.team) return null;
        r += dr;
      }
      return d;
    }
    if (e.r === target.r) {
      const d = target.c > e.c ? 1 : 3;
      const dc = Math.sign(target.c - e.c);
      let c = e.c + dc;
      while (c !== target.c) {
        if (SOLID.has(tileAt(c, e.r))) return null;
        const tank = tankAt(c, e.r, e.id);
        if (tank && tank.team === e.team) return null;
        c += dc;
      }
      return d;
    }
    return null;
  }

  function enemyDesiredDirs(e, target) {
    const dc = target.c - e.c;
    const dr = target.r - e.r;
    const opts = [];
    if (dc !== 0) opts.push({ dir: dc > 0 ? 1 : 3, dist: Math.abs(dc) });
    if (dr !== 0) opts.push({ dir: dr > 0 ? 2 : 0, dist: Math.abs(dr) });
    opts.sort((a, b) => b.dist - a.dist);
    return opts.map((o) => o.dir);
  }

  function stepEnemy(e, dt) {
    if (!e.alive) return;
    e.fireCd -= dt;
    e.moveTimer -= dt;

    // 开火：先瞄玩家，再瞄核心
    if (e.fireCd <= 0) {
      const pt = state.player && state.player.alive ? { c: state.player.c, r: state.player.r } : null;
      let fired = false;
      if (pt) {
        const d = losDir(e, pt);
        if (d != null) { e.dir = d; fired = tryFire(e); }
      }
      if (!fired && state.core.alive) {
        const d = losDir(e, { c: state.core.c, r: state.core.r });
        if (d != null) { e.dir = d; tryFire(e); }
      }
    }

    // 移动：朝目标（玩家近则追玩家，否则冲核心）
    const target = (state.player && state.player.alive && Math.abs(state.player.c - e.c) + Math.abs(state.player.r - e.r) <= 5)
      ? { c: state.player.c, r: state.player.r }
      : { c: state.core.c, r: state.core.r };

    if (e.moveTimer <= 0) {
      const interval = 1 / e.speed;
      e.moveTimer += interval;
      // 若当前方向被堵，重寻方向
      const aheadC = e.c + DX[e.dir];
      const aheadR = e.r + DY[e.dir];
      if (!passable(aheadC, aheadR, e.id)) {
        const desired = enemyDesiredDirs(e, target);
        let chosen = -1;
        for (const d of desired) {
          if (passable(e.c + DX[d], e.r + DY[d], e.id)) { chosen = d; break; }
        }
        if (chosen === -1) {
          // 随机绕行（优先横向）
          const perps = e.dir % 2 === 0 ? [1, 3] : [0, 2];
          const shuffled = [...perps].sort(() => rng() - 0.5);
          for (const d of shuffled) {
            if (passable(e.c + DX[d], e.r + DY[d], e.id)) { chosen = d; break; }
          }
          if (chosen === -1 && passable(aheadC, aheadR, e.id)) chosen = e.dir;
        }
        if (chosen >= 0) e.dir = chosen;
      }
      const nc = e.c + DX[e.dir];
      const nr = e.r + DY[e.dir];
      if (passable(nc, nr, e.id)) { e.c = nc; e.r = nr; }
    }
  }

  // ---------- 终局 ----------
  function loseGame(reason) {
    if (state.phase !== 'playing') return;
    state.phase = 'lost';
    emit('lose', { reason });
  }

  function clearLevel() {
    const stars = computeStars();
    emit('win', { level: state.level, stars, score: state.score, coreHp: state.core.hp });
    state.score += state.level * 200;
    state.core.hp = Math.min(state.core.maxHp, state.core.hp + GAME.CORE.healPerWave);
    if (state.level < GAME.MAX_LEVEL) {
      startLevel(state.level + 1);
    } else {
      // 全通：保持 playing，不再刷敌（视为无尽胜利）
      state.spawnQueue = [];
    }
  }

  function computeStars() {
    let s = 1;
    if (state.core.hp >= state.core.maxHp * 0.75) s += 1;
    if (state.bestCombo >= 2 || state.levelTime <= 25) s += 1;
    return Math.min(3, s);
  }

  // ---------- 主步进 ----------
  function step(dt, input = null) {
    if (state.phase !== 'playing') return;
    if (input) applyInput(input);

    state.time += dt;
    state.levelTime += dt;

    if (state.intermission > 0) {
      state.intermission -= dt;
      if (state.intermission <= 0) state.intermission = 0;
    }

    // 玩家
    const pl = state.player;
    if (pl && pl.alive) {
      pl.fireCd -= dt;
      if (pl.fireHeld && pl.fireCd <= 0) tryFire(pl);
      moveTank(pl, dt);
    }

    // 敌人
    for (const e of state.tanks) if (e.team === 1) stepEnemy(e, dt);

    // 刷敌
    if (state.spawnQueue.length > 0 && state.intermission <= 0) {
      state.spawnTimer -= dt;
      const cap = GAME.CONCURRENT_BASE + (state.level >= 3 ? 1 : 0);
      if (state.spawnTimer <= 0 && state.aliveEnemies < cap) {
        const type = state.spawnQueue.shift();
        if (spawnEnemy(type)) state.spawnTimer = GAME.SPAWN_INTERVAL;
        else state.spawnQueue.unshift(type);
      }
    }

    stepBullets(dt);
    stepPowerups(dt);

    // 连击窗口
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) { state.combo = 0; state.comboTimer = 0; }
    }

    // 清残敌
    state.tanks = state.tanks.filter((t) => t.alive);

    // 过关判定
    if (state.phase === 'playing' && state.spawnQueue.length === 0 && state.aliveEnemies === 0) {
      clearLevel();
    }

    state.shake = Math.max(0, state.shake - dt * 20);
  }

  function applyInput(input) {
    const pl = state.player;
    if (!pl || !pl.alive) return;
    if (input.dir != null && input.dir >= 0 && input.dir <= 3) {
      pl.dir = input.dir;
      pl.moving = true;
    } else {
      pl.moving = false;
    }
    pl.fireHeld = !!input.fire;
  }

  // ---------- 对外接口 ----------
  const run = {
    state,
    get rng() { return rng; },
    step,
    setInput(input) {
      applyInput(input);
    },
    fire() {
      const pl = state.player;
      if (!pl || !pl.alive) return { ok: false };
      return { ok: tryFire(pl) };
    },
    setMove(dir) {
      const pl = state.player;
      if (!pl || !pl.alive) return { ok: false };
      const changed = pl.dir !== dir || !pl.moving;
      pl.dir = dir;
      pl.moving = true;
      return { ok: changed };
    },
    getHud() {
      const pl = state.player;
      return {
        score: state.score,
        level: state.level,
        combo: state.combo,
        coreHp: state.core.hp,
        coreMaxHp: state.core.maxHp,
        hp: pl ? pl.hp : 0,
        maxHp: pl ? pl.maxHp : 0,
        enemiesLeft: state.spawnQueue.length + state.aliveEnemies,
        bestCombo: state.bestCombo,
        time: state.time,
      };
    },
    drainEvents() {
      return events.splice(0, events.length);
    },
    debug: {
      grid: () => state.grid,
      tiles: () => state.grid,
      tanks: () => state.tanks,
      player: () => state.player,
    },
  };

  spawnPlayer();
  startLevel(1);

  return run;
}

export { DIR_NAMES, DX, DY, SOLID, buildGrid, waveComposition };
