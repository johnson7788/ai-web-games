// 纯逻辑坦克大战 sim：无 DOM / 无渲染，Node 可测。
// 核心规则（1:1 取自参考源码玩法事实，换皮 + 新增机制见 config/design.json）：
//   - 4 方向网格碰撞移动；砖墙可破坏、钢铁不可破坏、草丛可藏身、水域挡坦克不挡子弹。
//   - 子弹打砖墙 1 发、打岩石 2 发（新机制）；打钢铁消失；打坦克/核心判定胜负。
//   - 连击（新机制）：击杀窗口内连杀，分数按连击翻倍。
//   - 道具（新机制）：破坏砖/岩概率掉 rapid/shield/freeze/life。
//   - 星级（新机制）：通关按「剩余生命」与「最大连击」给 1–3 星。
import { BOARD, GAME } from '../../config/game.config.js';
import { LEVELS, totalEnemies } from '../../config/levels.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const DIR_LIST = ['up', 'down', 'left', 'right'];

const T = { empty: 'empty', brick: 'brick', rock: 'rock', steel: 'steel', grass: 'grass', water: 'water', base: 'base' };
const SOLID_TANK = new Set([T.brick, T.rock, T.steel, T.water, T.base]);
const SOLID_BULLET = new Set([T.brick, T.rock, T.steel, T.base]);

const P_SPAWN = { c: 4, r: 23 };
const E_SPAWNS = [{ c: 4, r: 1 }, { c: 12, r: 1 }, { c: 20, r: 1 }];

function tileCenter(c, r) {
  return { x: BOARD.OX + c * BOARD.TILE + BOARD.TILE / 2, y: BOARD.OY + r * BOARD.TILE + BOARD.TILE / 2 };
}

// ---------- 地图生成（对称，程序化） ----------

function makeGrid() {
  const g = [];
  for (let r = 0; r < BOARD.ROWS; r += 1) {
    const row = [];
    for (let c = 0; c < BOARD.COLS; c += 1) row.push({ t: T.empty, hp: 1 });
    g.push(row);
  }
  return g;
}

function setTile(g, c, r, t) {
  if (c < 0 || c >= BOARD.COLS || r < 0 || r >= BOARD.ROWS) return;
  g[r][c] = { t, hp: t === T.rock ? 2 : 1 };
}

// 在左半棋盘放一块 (c..c+w-1, r..r+h-1)，并镜像到右半（保证左右对称）。
function placeMirrored(g, c, w, h, r, t) {
  for (let rr = r; rr < r + h; rr += 1) {
    for (let cc = c; cc < c + w; cc += 1) {
      setTile(g, cc, rr, t);
      setTile(g, BOARD.COLS - 1 - cc, rr, t);
    }
  }
}

function placeBase(g) {
  // 核心护墙：两侧钢铁（不可破坏），顶部两层砖门，核心暴露在砖门之后。
  // 敌人只能从正上方拆砖门后打到核心，给玩家留出防守/清场时间。
  for (let r = 22; r <= 25; r += 1) {
    for (let c = 10; c <= 15; c += 1) {
      if (c >= 12 && c <= 13 && r >= 24) setTile(g, c, r, T.base);
      else if (c === 10 || c === 15) setTile(g, c, r, T.steel);
      else setTile(g, c, r, T.brick);
    }
  }
}

function buildGrid(level) {
  const g = makeGrid();
  const terr = level.terrain || {};
  placeBase(g);

  // 砖墙群（对称稀疏 2×2 柱，留出 ≥3 格宽通道，避开出生点 row0-1 与玩家出生点）
  const bricks = [
    [3, 4, 2, 2], [8, 5, 2, 2],
    [5, 9, 2, 2],
    [2, 12, 2, 2], [9, 13, 2, 2],
    [4, 16, 2, 2], [8, 18, 2, 2],
    [2, 20, 2, 2],
  ];
  for (const [c, r, w, h] of bricks) placeMirrored(g, c, w, h, r, T.brick);

  if (terr.steel) {
    placeMirrored(g, 4, 2, 2, 11, T.steel);
    placeMirrored(g, 8, 2, 2, 5, T.steel);
  }
  if (terr.rock) {
    placeMirrored(g, 3, 3, 2, 14, T.rock);
    placeMirrored(g, 8, 2, 2, 9, T.rock);
  }
  if (terr.grass) {
    placeMirrored(g, 5, 3, 2, 5, T.grass);
    placeMirrored(g, 2, 3, 2, 15, T.grass);
    placeMirrored(g, 9, 3, 2, 20, T.grass);
  }
  if (terr.water) {
    // 水域：横贯两条部分水道，左右留过道
    placeMirrored(g, 3, 8, 1, 5, T.water);
    placeMirrored(g, 3, 8, 1, 18, T.water);
  }

  // 清出出生点与玩家出生点，避免出生即卡死
  for (const s of E_SPAWNS) { setTile(g, s.c, s.r, T.empty); setTile(g, s.c, s.r - 1, T.empty); }
  setTile(g, P_SPAWN.c, P_SPAWN.r, T.empty);
  return g;
}

function buildSpawnQueue(level) {
  const q = [];
  for (const grp of level.enemies) {
    for (let i = 0; i < grp.count; i += 1) q.push(grp.type);
  }
  return q;
}

function enemyStats(type) {
  switch (type) {
    case 'scout': return { hp: 1, speed: GAME.SCOUT_SPEED, fireCd: GAME.ENEMY_FIRE_CD };
    case 'gunner': return { hp: 1, speed: GAME.ENEMY_SPEED, fireCd: GAME.GUNNER_FIRE_CD };
    case 'tank': return { hp: 2, speed: GAME.ENEMY_SPEED * 0.9, fireCd: GAME.ENEMY_FIRE_CD };
    default: return { hp: 1, speed: GAME.ENEMY_SPEED, fireCd: GAME.ENEMY_FIRE_CD };
  }
}

// ---------- 对局工厂 ----------

export function createRun(levelIndex, opts = {}) {
  const idx = Math.max(0, Math.min(LEVELS.length - 1, levelIndex | 0));
  const level = LEVELS[idx];
  const rng = mulberry32((opts.seed | 0) || 1);

  const spawn = tileCenter(P_SPAWN.c, P_SPAWN.r);
  const state = {
    level: idx,
    phase: 'playing',
    time: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    comboT: 0,
    stars: 0,
    baseAlive: true,
    baseHp: 6,
    freeze: 0,
    spawnT: 0.5,
    spawnQueue: buildSpawnQueue(level),
    enemies: [],
    bullets: [],
    powerups: [],
    grid: buildGrid(level),
    player: {
      x: spawn.x,
      y: spawn.y,
      dir: 'up',
      alive: true,
      fireCd: 0,
      invuln: 1.0,
      shieldT: 0,
      rapidT: 0,
      respawnT: 0,
      lives: GAME.PLAYER_LIVES,
    },
    enemiesTotal: totalEnemies(level),
  };

  const events = [];
  let enemyId = 0;
  let lastInput = { dir: null, fire: false };

  function emit(type, payload = {}) {
    events.push({ type, ...payload });
  }

  function tileAt(x, y) {
    const c = Math.floor((x - BOARD.OX) / BOARD.TILE);
    const r = Math.floor((y - BOARD.OY) / BOARD.TILE);
    if (c < 0 || c >= BOARD.COLS || r < 0 || r >= BOARD.ROWS) return null;
    return { c, r, cell: state.grid[r][c] };
  }

  function canMove(x, y, self) {
    const half = GAME.TANK_SIZE / 2;
    const c0 = Math.floor((x - half - BOARD.OX) / BOARD.TILE);
    const c1 = Math.floor((x + half - BOARD.OX) / BOARD.TILE);
    const r0 = Math.floor((y - half - BOARD.OY) / BOARD.TILE);
    const r1 = Math.floor((y + half - BOARD.OY) / BOARD.TILE);
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        if (c < 0 || c >= BOARD.COLS || r < 0 || r >= BOARD.ROWS) return false;
        if (SOLID_TANK.has(state.grid[r][c].t)) return false;
      }
    }
    const overlap = (ox, oy) => Math.abs(ox - x) < GAME.TANK_SIZE && Math.abs(oy - y) < GAME.TANK_SIZE;
    for (const e of state.enemies) if (e !== self && e.alive && overlap(e.x, e.y)) return false;
    if (self !== state.player && state.player.alive && overlap(state.player.x, state.player.y)) return false;
    return true;
  }

  function moveTank(ent, dir, speed, dt) {
    const v = DIRS[dir];
    const nx = ent.x + v.x * speed * dt;
    const ny = ent.y + v.y * speed * dt;
    if (canMove(nx, ny, ent)) {
      ent.x = nx;
      ent.y = ny;
      return true;
    }
    return false;
  }

  function muzzle(p, dir) {
    const v = DIRS[dir];
    const off = GAME.TANK_SIZE / 2 + GAME.BULLET_SIZE / 2 + 2;
    return { x: p.x + v.x * off, y: p.y + v.y * off };
  }

  function spawnBullet(x, y, dir, owner) {
    state.bullets.push({ x, y, dir, owner });
  }

  function spawnEnemy() {
    if (!state.spawnQueue.length || state.enemies.filter((e) => e.alive).length >= GAME.MAX_ACTIVE) return;
    const type = state.spawnQueue.shift();
    const pt = E_SPAWNS[Math.floor(rng() * E_SPAWNS.length)];
    const c = tileCenter(pt.c, pt.r);
    const stats = enemyStats(type);
    state.enemies.push({
      id: enemyId++,
      type,
      x: c.x,
      y: c.y,
      dir: 'down',
      hp: stats.hp,
      speed: stats.speed,
      fireCd: stats.fireCd,
      alive: true,
      invuln: GAME.SPAWN_INVULN,
      moveT: 0.3 + rng() * 0.6,
      fireT: 0.8 + rng() * 0.8,
    });
    emit('spawn', { type });
  }

  function tryPlayerFire() {
    const p = state.player;
    if (!p.alive || p.fireCd > 0) return;
    p.fireCd = p.rapidT > 0 ? GAME.PLAYER_FIRE_CD * 0.45 : GAME.PLAYER_FIRE_CD;
    const m = muzzle(p, p.dir);
    spawnBullet(m.x, m.y, p.dir, 'player');
    emit('fire');
  }

  function destroyTile(c, r, allowDrop) {
    const cell = state.grid[r][c];
    state.grid[r][c] = { t: T.empty, hp: 1 };
    if (allowDrop && (cell.t === T.brick || cell.t === T.rock)) {
      if (rng() < GAME.POWERUP_DROP) spawnPowerup(c, r);
    }
  }

  function spawnPowerup(c, r) {
    const ctr = tileCenter(c, r);
    const roll = rng();
    let type = 'rapid';
    if (roll < 0.34) type = 'rapid';
    else if (roll < 0.62) type = 'shield';
    else if (roll < 0.86) type = 'freeze';
    else type = 'life';
    state.powerups.push({ x: ctr.x, y: ctr.y, type, ttl: GAME.POWERUP_TTL });
  }

  function applyPowerup(pu) {
    const p = state.player;
    if (pu.type === 'rapid') p.rapidT = GAME.RAPID_TIME;
    else if (pu.type === 'shield') p.shieldT = GAME.SHIELD_TIME;
    else if (pu.type === 'freeze') { state.freeze = GAME.FREEZE_TIME; emit('freeze'); }
    else if (pu.type === 'life') p.lives = Math.min(5, p.lives + 1);
    emit('powerup', { kind: pu.type });
  }

  function hitEnemy(e) {
    e.hp -= 1;
    if (e.hp <= 0) {
      e.alive = false;
      state.combo += 1;
      state.comboT = GAME.COMBO_WINDOW;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.score += 10 * state.combo;
      emit('kill', { combo: state.combo, score: state.score, x: e.x, y: e.y });
      if (state.combo >= 2) emit('combo', { combo: state.combo });
    } else {
      emit('hit', { kind: 'enemy' });
    }
  }

  function hitPlayer() {
    const p = state.player;
    if (!p.alive) return;
    if (p.invuln > 0) return;                       // 出生/重生无敌
    if (p.shieldT > 0) { p.shieldT = 0; emit('shield'); return; }
    p.lives -= 1;
    p.alive = false;
    emit('playerHit', { lives: p.lives, x: p.x, y: p.y });
    if (p.lives <= 0) finish('lost', 'lives');
    else p.respawnT = 1.2;
  }

  function respawnPlayer() {
    const p = state.player;
    const c = tileCenter(P_SPAWN.c, P_SPAWN.r);
    p.x = c.x;
    p.y = c.y;
    p.dir = 'up';
    p.alive = true;
    p.invuln = GAME.RESPAWN_INVULN;
    p.fireCd = 0;
  }

  function destroyBase() {
    if (!state.baseAlive) return;
    state.baseAlive = false;
    const bc = { x: BOARD.OX + 13 * BOARD.TILE, y: BOARD.OY + 25 * BOARD.TILE };
    emit('baseHit', { x: bc.x, y: bc.y, hp: 0 });
    finish('lost', 'base');
  }

  function hitBase() {
    if (!state.baseAlive) return;
    state.baseHp -= 1;
    const bc = { x: BOARD.OX + 13 * BOARD.TILE, y: BOARD.OY + 25 * BOARD.TILE };
    emit('baseHit', { x: bc.x, y: bc.y, hp: state.baseHp });
    if (state.baseHp <= 0) destroyBase();
  }

  function computeStars() {
    let s = 1;
    if (state.player.lives >= GAME.STAR_LIVES) s += 1;
    if (state.maxCombo >= GAME.STAR_COMBO) s += 1;
    return s;
  }

  function finish(kind, reason) {
    if (state.phase !== 'playing') return;
    if (kind === 'won') {
      state.stars = computeStars();
      state.phase = 'won';
      emit('win', { stars: state.stars, score: state.score });
    } else {
      state.phase = 'lost';
      emit('lose', { reason });
    }
  }

  function pickDir(e) {
    const p = state.player;
    if (p.alive && rng() < 0.4) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dirs = Math.abs(dx) > Math.abs(dy)
        ? [dx > 0 ? 'right' : 'left', dy > 0 ? 'down' : 'up']
        : [dy > 0 ? 'down' : 'up', dx > 0 ? 'right' : 'left'];
      for (const d of dirs) if (canMove(e.x + DIRS[d].x * e.speed * 0.1, e.y + DIRS[d].y * e.speed * 0.1, e)) return d;
    }
    return DIR_LIST[Math.floor(rng() * 4)];
  }

  function enemyFire(e) {
    const p = state.player;
    let dir = e.dir;
    if (p.alive) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      if (Math.abs(dx) < GAME.TANK_SIZE && Math.abs(dy) > 4) dir = dy > 0 ? 'down' : 'up';
      else if (Math.abs(dy) < GAME.TANK_SIZE && Math.abs(dx) > 4) dir = dx > 0 ? 'right' : 'left';
      else if (rng() < 0.35) dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    const m = muzzle(e, dir);
    spawnBullet(m.x, m.y, dir, 'enemy');
    emit('enemyFire');
  }

  function updateEnemy(e, dt) {
    if (state.freeze > 0) return;
    e.invuln = Math.max(0, e.invuln - dt);
    e.moveT -= dt;
    e.fireT -= dt;
    if (e.moveT <= 0) {
      e.moveT = 0.9 + rng() * 1.3;
      e.dir = pickDir(e);
    }
    if (!moveTank(e, e.dir, e.speed, dt)) e.dir = pickDir(e);
    if (e.fireT <= 0) {
      e.fireT = e.fireCd * (0.7 + rng() * 0.6);
      enemyFire(e);
    }
  }

  function updateBullets(dt) {
    const kept = [];
    for (const b of state.bullets) {
      const v = DIRS[b.dir];
      b.x += v.x * GAME.BULLET_SPEED * dt;
      b.y += v.y * GAME.BULLET_SPEED * dt;
      let dead = false;

      if (b.x < BOARD.OX - 8 || b.x > BOARD.OX + BOARD.COLS * BOARD.TILE + 8
        || b.y < BOARD.OY - 8 || b.y > BOARD.OY + BOARD.ROWS * BOARD.TILE + 8) {
        dead = true;
      } else {
        const tt = tileAt(b.x, b.y);
        if (tt && SOLID_BULLET.has(tt.cell.t)) {
          dead = true;
          if (tt.cell.t === T.brick) { destroyTile(tt.c, tt.r, true); emit('hit', { kind: 'brick' }); }
          else if (tt.cell.t === T.rock) {
            tt.cell.hp -= 1;
            if (tt.cell.hp <= 0) destroyTile(tt.c, tt.r, true);
            emit('hit', { kind: 'rock' });
          } else if (tt.cell.t === T.steel) { emit('hit', { kind: 'steel' }); }
          else if (tt.cell.t === T.base) hitBase();
        }
      }

      if (!dead) {
        if (b.owner === 'player') {
          for (const e of state.enemies) {
            if (e.alive && Math.abs(e.x - b.x) < GAME.TANK_SIZE / 2 + 4 && Math.abs(e.y - b.y) < GAME.TANK_SIZE / 2 + 4) {
              dead = true;
              hitEnemy(e);
              break;
            }
          }
        } else {
          const p = state.player;
          if (p.alive && Math.abs(p.x - b.x) < GAME.TANK_SIZE / 2 + 4 && Math.abs(p.y - b.y) < GAME.TANK_SIZE / 2 + 4) {
            dead = true;
            hitPlayer();
          }
        }
      }

      if (!dead) kept.push(b);
    }
    state.bullets = kept;
  }

  function updatePowerups(dt) {
    const p = state.player;
    const kept = [];
    for (const pu of state.powerups) {
      pu.ttl -= dt;
      let collected = false;
      if (p.alive && Math.abs(p.x - pu.x) < GAME.TANK_SIZE / 2 + 10 && Math.abs(p.y - pu.y) < GAME.TANK_SIZE / 2 + 10) {
        applyPowerup(pu);
        collected = true;
      }
      if (!collected && pu.ttl > 0) kept.push(pu);
    }
    state.powerups = kept;
  }

  function checkEnd() {
    if (state.phase !== 'playing') return;
    if (!state.baseAlive) { finish('lost', 'base'); return; }
    const anyAlive = state.enemies.some((e) => e.alive) || state.spawnQueue.length > 0;
    if (!anyAlive) finish('won');
  }

  function step(dt) {
    if (state.phase !== 'playing') return;
    state.time += dt;
    state.freeze = Math.max(0, state.freeze - dt);
    state.comboT = Math.max(0, state.comboT - dt);
    if (state.comboT === 0) state.combo = 0;

    const p = state.player;
    p.fireCd = Math.max(0, p.fireCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.shieldT = Math.max(0, p.shieldT - dt);
    p.rapidT = Math.max(0, p.rapidT - dt);

    if (p.alive) {
      if (lastInput.dir) {
        p.dir = lastInput.dir;
        moveTank(p, p.dir, GAME.PLAYER_SPEED, dt);
      }
      if (lastInput.fire) tryPlayerFire();
    } else {
      p.respawnT -= dt;
      if (p.respawnT <= 0) respawnPlayer();
    }

    state.spawnT -= dt;
    if (state.spawnT <= 0) {
      state.spawnT = GAME.SPAWN_INTERVAL;
      spawnEnemy();
    }

    for (const e of state.enemies) if (e.alive) updateEnemy(e, dt);

    updateBullets(dt);
    updatePowerups(dt);
    checkEnd();
  }

  return {
    state,
    step,
    setInput(input) {
      lastInput.dir = (input && input.dir) || null;
      lastInput.fire = !!(input && input.fire);
      return { ok: state.phase === 'playing' };
    },
    drainEvents() {
      return events.splice(0, events.length);
    },
    probe(dir) {
      const p = state.player;
      if (!p.alive) return false;
      const v = DIRS[dir];
      return canMove(p.x + v.x * GAME.PLAYER_SPEED * 0.05, p.y + v.y * GAME.PLAYER_SPEED * 0.05, p);
    },
    getHud() {
      const remaining = state.spawnQueue.length + state.enemies.filter((e) => e.alive).length;
      return {
        level: state.level + 1,
        lives: state.player.lives,
        enemiesLeft: remaining,
        enemiesTotal: state.enemiesTotal,
        combo: state.combo,
        maxCombo: state.maxCombo,
        score: state.score,
        stars: state.stars,
        baseAlive: state.baseAlive,
        freeze: state.freeze,
      };
    },
  };
}

export { T, DIRS, DIR_LIST };
