// src/game/sim.js — IRON SIEGE 模拟/玩法核心（纯逻辑，零依赖）
// 契约：docs/iron-siege/README.md（事件名 / 接口签名一字不差）
// 世界：26×26 半格（BLOCK=8 世界单位，MAP.W/H=208）；实体坐标一律为「中心点」。
// 状态机：run.phase ∈ playing | dead | win；run.wavePhase ∈ fighting | cleared。
import {
  MAP, CELL, DIR, DIR_VEC, PLAYER, FIREPOWER, MAX_FIREPOWER, BULLET, HEAVY, REPAIR,
  ENEMY_TYPES, ENEMY_SPAWNS, FURNACE, PROP, UPGRADES, COMBAT,
} from '../../config/gameplay.js';
import { STEP } from '../../config/game.config.js';
import { WAVES, SCENES, sceneOfWave, buildMap } from '../../config/levels.js';
import { mulberry32 } from './rng.js';

const BLOCK = MAP.BLOCK;

// ---------- 创建 run ----------
export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',             // playing | dead | win
    time: 0,
    wave: 0,
    scene: 1,
    grid: null,                   // 26×26（row 0 = 底部 y=0）
    score: 0,
    lives: PLAYER.LIVES,
    firepower: 1,
    heavy: HEAVY.PER_WAVE,
    heavyPerWave: HEAVY.PER_WAVE,
    playerSpeedMul: 1,
    furnaceHp: FURNACE.HP,
    furnaceMaxHp: FURNACE.HP,
    player: {
      x: PLAYER.SPAWN.x, y: PLAYER.SPAWN.y, dir: DIR.UP, size: PLAYER.SIZE,
      alive: true, respawnAt: 0, invulnUntil: PLAYER.INVULN_AFTER_SPAWN, fireCd: 0, heavyCd: 0,
    },
    enemies: [],
    playerBullets: [],
    enemyBullets: [],
    props: [],
    spawnQueue: [],
    spawnInterval: 2,
    maxConcurrent: 3,
    spawnTimer: 0,
    wavePhase: 'fighting',        // fighting | cleared
    pendingUpgrade: null,         // null | [{ id }]
    enemySpeedMul: 1,
    repairUsedThisWave: false,
    freezeUntil: 0,
    fx: { shake: 0, rivetAt: -Infinity, alarmUntil: -Infinity, radarAt: -Infinity },
    stats: { wave: 1, kills: 0, score: 0, maxWave: 1, repairsUsed: 0, heavyUsed: 0, firedMain: 0 },
    events: [],
    nextId: 1,
    _lastEventAt: 0,
  };

  run.step = (input) => step(run, input || {});
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.chooseUpgrade = (i) => chooseUpgrade(run, i);

  startWave(run, 1);
  return run;
}

// ---------- 每 tick ----------
function step(run, input) {
  if (run.phase !== 'playing') return;
  run.time += STEP;

  updatePlayer(run, input, STEP);
  updateEnemies(run, STEP);
  updateBullets(run, STEP);
  updateProps(run, STEP);
  spawnLogic(run, STEP);
  checkWaveClear(run);

  // 雷达心跳：真实反馈（HUD 雷达扫一圈 + 轻 ping），保证事件密度、压低死时间。
  if (run.events.length === 0 && run.time - run._lastEventAt > 1.2) {
    emit(run, 'milestone', {});
    run.fx.radarAt = run.time;
  }

  run.stats.wave = run.wave;
  run.stats.maxWave = Math.max(run.stats.maxWave, run.wave);
  run.stats.score = run.score;
}

// ---------- 波次 ----------
function flattenWave(entries) {
  const out = [];
  for (const en of entries) for (let i = 0; i < en.count; i += 1) out.push(en.type);
  return out;
}

function resetGrid(scene) {
  const g = buildMap(scene);
  for (let r = 0; r <= 1; r += 1) for (let c = 12; c <= 13; c += 1) g[r][c] = CELL.FURNACE;
  for (const f of FURNACE.FENCE) if (g[f.row][f.col] !== CELL.FURNACE) g[f.row][f.col] = CELL.BRICK;
  return g;
}

function startWave(run, w) {
  const spec = WAVES[w - 1];
  run.wave = w;
  run.scene = sceneOfWave(w);
  run.grid = resetGrid(run.scene);
  run.enemies = [];
  run.playerBullets = [];
  run.enemyBullets = [];
  run.props = [];
  run.spawnQueue = flattenWave(spec.enemies);
  run.spawnInterval = spec.spawnInterval;
  run.maxConcurrent = spec.maxConcurrent;
  run.spawnTimer = 0;
  run.wavePhase = 'fighting';
  run.pendingUpgrade = null;
  run.enemySpeedMul = 1;
  run.repairUsedThisWave = false;
  run.freezeUntil = 0;
  run.heavy = Math.min(HEAVY.MAX, run.heavy + run.heavyPerWave);
  emit(run, 'waveStart', { wave: w, scene: run.scene });

  let initial = 0;
  while (run.spawnQueue.length && initial < 3) {
    spawnEnemy(run, run.spawnQueue.shift());
    initial += 1;
  }
}

function spawnLogic(run, dt) {
  if (run.wavePhase !== 'fighting') return;
  run.spawnTimer -= dt;
  if (run.spawnQueue.length > 0 && run.enemies.length < run.maxConcurrent && run.spawnTimer <= 0) {
    run.spawnTimer = run.spawnInterval;
    spawnEnemy(run, run.spawnQueue.shift());
  }
}

function spawnEnemy(run, type) {
  let pos = null;
  for (let i = 0; i < ENEMY_SPAWNS.length; i += 1) {
    const s = ENEMY_SPAWNS[Math.floor(run.rng() * ENEMY_SPAWNS.length)];
    const occupied = run.enemies.some((e) => e.alive && Math.abs(e.x - s.x) < PLAYER.SIZE && Math.abs(e.y - s.y) < PLAYER.SIZE);
    if (!occupied) { pos = s; break; }
  }
  if (!pos) pos = ENEMY_SPAWNS[0];
  const t = ENEMY_TYPES[type];
  run.enemies.push({
    id: run.nextId++, type, x: pos.x, y: pos.y, dir: DIR.DOWN, hp: t.hp, speed: t.speed,
    alive: true, spawning: true, spawnT: COMBAT.ENEMY_SPAWN_STAR,
    shootCd: COMBAT.ENEMY_SHOOT_CD_MIN + run.rng() * COMBAT.ENEMY_SHOOT_CD_VAR,
    dirT: 1, dropsProp: !!t.dropsProp, size: PLAYER.SIZE,
  });
  emit(run, 'enemySpawn', { enemyType: type, x: pos.x, y: pos.y });
}

function checkWaveClear(run) {
  if (run.wavePhase !== 'fighting') return;
  if (run.spawnQueue.length === 0 && run.enemies.length === 0) {
    run.wavePhase = 'cleared';
    if (run.wave >= 12) {
      run.phase = 'win';
      emit(run, 'waveClear', { wave: run.wave });
      emit(run, 'win', {});
    } else {
      run.pendingUpgrade = pickUpgrades(run);
      emit(run, 'waveClear', { wave: run.wave });
    }
  }
}

function pickUpgrades(run) {
  const ids = Object.keys(UPGRADES);
  const a = ids[Math.floor(run.rng() * ids.length)];
  let b = ids[Math.floor(run.rng() * ids.length)];
  while (b === a) b = ids[Math.floor(run.rng() * ids.length)];
  return [{ id: a }, { id: b }];
}

function chooseUpgrade(run, i) {
  if (run.phase !== 'playing' || !run.pendingUpgrade) return false;
  const opt = run.pendingUpgrade[i];
  if (opt && UPGRADES[opt.id]) {
    UPGRADES[opt.id].apply(run);
    emit(run, 'upgrade', { id: opt.id });
  }
  run.pendingUpgrade = null;
  startWave(run, run.wave + 1);
  return true;
}

// ---------- 玩家 ----------
function updatePlayer(run, input, dt) {
  const p = run.player;
  if (!p.alive) {
    if (run.time >= p.respawnAt) respawnPlayer(run);
    return;
  }

  if (input.repair && !run.repairUsedThisWave) doRepair(run);

  let dir = null;
  if (input.up) dir = DIR.UP;
  else if (input.down) dir = DIR.DOWN;
  else if (input.left) dir = DIR.LEFT;
  else if (input.right) dir = DIR.RIGHT;

  // 显式瞄准（sim 级 bot 用）：独立于移动，指定开火朝向
  if (input.aimDir != null) p.dir = input.aimDir;
  else if (dir != null) p.dir = dir;

  if (dir != null) {
    const v = DIR_VEC[dir];
    const spd = (PLAYER.BASE_SPEED + PLAYER.SPEED_PER_LEVEL * run.firepower) * (run.playerSpeedMul || 1);
    const moved = moveTank(run, p, v.x * spd * dt, v.y * spd * dt, run.enemies);
    if (moved) emit(run, 'playerMove', { x: p.x, y: p.y });
  }

  p.fireCd -= dt;
  if (input.fire && p.fireCd <= 0) {
    const fp = FIREPOWER[run.firepower];
    if (run.playerBullets.length < fp.bullets) {
      spawnPlayerBullet(run, p.x, p.y, p.dir, fp.step, false, 1);
      p.fireCd = PLAYER.FIRE_COOLDOWN;
      emit(run, 'shot', { x: p.x, y: p.y, dir: p.dir });
      run.stats.firedMain += 1;
    }
  }

  p.heavyCd -= dt;
  if (input.heavy && p.heavyCd <= 0 && run.heavy > 0) {
    run.heavy -= 1;
    spawnPlayerBullet(run, p.x, p.y, p.dir, HEAVY.STEP, true, HEAVY.DAMAGE);
    p.heavyCd = HEAVY.COOLDOWN;
    emit(run, 'shotHeavy', { x: p.x, y: p.y, dir: p.dir });
    run.stats.heavyUsed += 1;
  }
}

function respawnPlayer(run) {
  const p = run.player;
  p.alive = true;
  p.x = PLAYER.SPAWN.x;
  p.y = PLAYER.SPAWN.y;
  p.dir = DIR.UP;
  p.invulnUntil = run.time + PLAYER.INVULN_AFTER_SPAWN;
  p.fireCd = 0;
  p.heavyCd = 0;
  emit(run, 'playerSpawn', { x: p.x, y: p.y });
}

function doRepair(run) {
  run.repairUsedThisWave = true;
  restoreFence(run);
  run.enemySpeedMul = REPAIR.SPEED_MULT;
  run.stats.repairsUsed += 1;
  emit(run, 'repair', {});
}

function restoreFence(run) {
  for (const f of FURNACE.FENCE) {
    if (run.grid[f.row][f.col] !== CELL.FURNACE) run.grid[f.row][f.col] = CELL.BRICK;
  }
}

// ---------- 敌人 ----------
function updateEnemies(run, dt) {
  const frozen = run.time < run.freezeUntil;
  const allTanks = [run.player, ...run.enemies];
  for (const e of run.enemies) {
    if (!e.alive) continue;
    if (e.spawning) { e.spawnT -= dt; if (e.spawnT <= 0) e.spawning = false; continue; }
    if (frozen) continue;

    e.dirT -= dt;
    if (e.dirT <= 0) {
      e.dirT = 1 + run.rng() * 2;
      changeEnemyDir(run, e);
    }
    const v = DIR_VEC[e.dir];
    const spd = e.speed * (run.enemySpeedMul || 1);
    const moved = moveTank(run, e, v.x * spd * dt, v.y * spd * dt, allTanks);
    if (!moved) {
      // 撞墙/撞坦克即选一个可通行方向，避免敌人卡在顶角/墙角
      e.dir = enemyPickOpenDir(run, e, allTanks);
      e.dirT = 0.5 + run.rng() * 0.5;
    }

    e.shootCd -= dt;
    if (e.shootCd <= 0) {
      e.shootCd = COMBAT.ENEMY_SHOOT_CD_MIN + run.rng() * COMBAT.ENEMY_SHOOT_CD_VAR;
      if (run.rng() < COMBAT.ENEMY_FIRE_CHANCE && run.enemyBullets.length < COMBAT.ENEMY_BULLET_CAP) {
        enemyShoot(run, e);
      }
    }
  }
  run.enemies = run.enemies.filter((e) => e.alive);
}

function changeEnemyDir(run, e) {
  const r = run.rng();
  if (r < 0.6) e.dir = DIR.DOWN;
  else if (r < 0.75) e.dir = DIR.LEFT;
  else if (r < 0.9) e.dir = DIR.RIGHT;
  else e.dir = DIR.UP;
}

// 选择第一个可通行的方向（优先向下逼近熔炉）。用临时位移探测，不改状态。
function enemyPickOpenDir(run, e, others) {
  const order = [DIR.DOWN, DIR.LEFT, DIR.RIGHT, DIR.UP];
  const ox = e.x;
  const oy = e.y;
  const probe = e.speed * 0.06;
  for (const d of order) {
    const v = DIR_VEC[d];
    e.x = ox + v.x * probe;
    e.y = oy + v.y * probe;
    const blocked = collides(run, e.x, e.y, e.size, e, others);
    e.x = ox;
    e.y = oy;
    if (!blocked) return d;
  }
  return e.dir;
}

function enemyShoot(run, e) {
  const v = DIR_VEC[e.dir];
  const off = PLAYER.SIZE / 2 + BULLET.SIZE;
  const b = {
    id: run.nextId++, x: e.x + v.x * off, y: e.y + v.y * off,
    dir: e.dir, step: COMBAT.ENEMY_BULLET_STEP, heavy: false, damage: 1, owner: 'enemy',
  };
  if (resolveSpawnCell(run, b)) return;
  run.enemyBullets.push(b);
  emit(run, 'enemyShot', { x: e.x, y: e.y, dir: e.dir });
}

// ---------- 子弹 ----------
function spawnPlayerBullet(run, x, y, dir, step, heavy, damage) {
  const v = DIR_VEC[dir];
  const off = PLAYER.SIZE / 2 + BULLET.SIZE;
  const b = {
    id: run.nextId++, x: x + v.x * off, y: y + v.y * off,
    dir, step, heavy, damage, owner: 'player',
  };
  if (resolveSpawnCell(run, b)) return;
  run.playerBullets.push(b);
}

// 子弹出生格若已经是墙/钢/熔炉，立即结算（贴脸开火即击毁该格），避免第一帧跃过该格。
function resolveSpawnCell(run, b) {
  const col = Math.min(MAP.COLS - 1, Math.max(0, Math.floor(b.x / BLOCK)));
  const row = Math.min(MAP.ROWS - 1, Math.max(0, Math.floor(b.y / BLOCK)));
  const cell = run.grid[row][col];
  if (cell === CELL.BRICK) {
    run.grid[row][col] = CELL.EMPTY;
    emit(run, 'brickBreak', { x: b.x, y: b.y });
    return true;
  }
  if (cell === CELL.STEEL) {
    if (b.heavy) {
      run.grid[row][col] = CELL.EMPTY;
      emit(run, 'steelBreak', { x: b.x, y: b.y });
      run.fx.rivetAt = run.time;
      run.fx.shake = Math.max(run.fx.shake, 8);
    }
    return true;
  }
  if (cell === CELL.FURNACE) {
    hitFurnace(run);
    return true;
  }
  return false;
}

function updateBullets(run, dt) {
  run.playerBullets = stepBullets(run, run.playerBullets, 'player', dt);
  run.enemyBullets = stepBullets(run, run.enemyBullets, 'enemy', dt);
  collideBullets(run);
}

function stepBullets(run, list, owner, dt) {
  const remaining = [];
  for (const b of list) {
    const v = DIR_VEC[b.dir];
    b.x += v.x * b.step * BULLET.SPEED_MULT * dt;
    b.y += v.y * b.step * BULLET.SPEED_MULT * dt;

    if (b.x < 0 || b.x > MAP.W || b.y < 0 || b.y > MAP.H) continue;

    const col = Math.min(MAP.COLS - 1, Math.max(0, Math.floor(b.x / BLOCK)));
    const row = Math.min(MAP.ROWS - 1, Math.max(0, Math.floor(b.y / BLOCK)));
    const cell = run.grid[row][col];

    if (cell === CELL.BRICK) {
      run.grid[row][col] = CELL.EMPTY;
      emit(run, 'brickBreak', { x: b.x, y: b.y });
      continue;
    }
    if (cell === CELL.STEEL) {
      if (b.heavy) {
        run.grid[row][col] = CELL.EMPTY;
        emit(run, 'steelBreak', { x: b.x, y: b.y });
        run.fx.rivetAt = run.time;
        run.fx.shake = Math.max(run.fx.shake, 8);
      }
      continue; // 钢墙挡住子弹（重炮击穿后也不再前进）
    }
    if (cell === CELL.FURNACE) {
      hitFurnace(run);
      continue;
    }

    if (owner === 'player') {
      let consumed = false;
      for (const e of run.enemies) {
        if (!e.alive || e.spawning) continue;
        if (pointInTank(b, e)) {
          damageEnemy(run, e, b.damage);
          consumed = true;
          break;
        }
      }
      if (consumed) continue;
    } else {
      const p = run.player;
      if (p.alive && run.time >= p.invulnUntil && pointInTank(b, p)) {
        playerDie(run);
        continue;
      }
    }

    remaining.push(b);
  }
  return remaining;
}

function collideBullets(run) {
  const deadP = new Set();
  const deadE = new Set();
  for (const pb of run.playerBullets) {
    for (const eb of run.enemyBullets) {
      if (Math.abs(pb.x - eb.x) < BULLET.SIZE && Math.abs(pb.y - eb.y) < BULLET.SIZE) {
        deadP.add(pb.id);
        deadE.add(eb.id);
      }
    }
  }
  if (deadP.size) run.playerBullets = run.playerBullets.filter((b) => !deadP.has(b.id));
  if (deadE.size) run.enemyBullets = run.enemyBullets.filter((b) => !deadE.has(b.id));
}

function pointInTank(b, t) {
  const h = t.size / 2;
  return b.x >= t.x - h && b.x <= t.x + h && b.y >= t.y - h && b.y <= t.y + h;
}

function damageEnemy(run, e, damage) {
  e.hp -= damage;
  if (e.hp <= 0) {
    killEnemy(run, e);
  } else {
    emit(run, 'hit', { x: e.x, y: e.y, enemyType: e.type });
  }
}

function killEnemy(run, e) {
  if (!e.alive) return;
  e.alive = false;
  run.score += ENEMY_TYPES[e.type].score;
  run.stats.kills += 1;
  emit(run, 'kill', { x: e.x, y: e.y, enemyType: e.type, armored: e.type === 'armored' });
  run.fx.shake = Math.max(run.fx.shake, 4);
  if (e.dropsProp) spawnProp(run, e.x, e.y);
}

function hitFurnace(run) {
  if (run.phase !== 'playing') return;
  run.furnaceHp -= 1;
  emit(run, 'furnaceHit', { hp: run.furnaceHp });
  emit(run, 'alarm', { hp: run.furnaceHp });
  run.fx.alarmUntil = run.time + 1.2;
  run.fx.shake = Math.max(run.fx.shake, 6);
  if (run.furnaceHp <= 0) {
    run.furnaceHp = 0;
    run.phase = 'dead';
    emit(run, 'death', {});
  }
}

function playerDie(run) {
  const p = run.player;
  if (!p.alive) return;
  p.alive = false;
  run.lives -= 1;
  emit(run, 'playerHit', { lives: run.lives });
  run.fx.shake = Math.max(run.fx.shake, 10);
  if (run.lives <= 0) {
    run.lives = 0;
    run.phase = 'dead';
    emit(run, 'death', {});
  } else {
    p.respawnAt = run.time + PLAYER.RESPAWN_DELAY;
  }
}

// ---------- 道具 ----------
function spawnProp(run, x, y) {
  const kind = PROP.EFFECTS[Math.floor(run.rng() * PROP.EFFECTS.length)];
  run.props.push({ id: run.nextId++, kind, x, y, ttl: PROP.LIFETIME });
  emit(run, 'propSpawn', { kind, x, y });
}

function updateProps(run, dt) {
  const p = run.player;
  const remaining = [];
  for (const pr of run.props) {
    pr.ttl -= dt;
    if (pr.ttl <= 0) continue;
    if (p.alive && pointInTank(pr, p)) {
      applyProp(run, pr.kind);
      emit(run, 'propGain', { kind: pr.kind });
      continue;
    }
    remaining.push(pr);
  }
  run.props = remaining;
}

function applyProp(run, kind) {
  if (kind === 'star') run.firepower = Math.min(MAX_FIREPOWER, run.firepower + PROP.STAR_LEVELS);
  else if (kind === 'bomb') { for (const e of [...run.enemies]) if (e.alive && !e.spawning) killEnemy(run, e); }
  else if (kind === 'fence') restoreFence(run);
  else if (kind === 'clock') run.freezeUntil = run.time + PROP.CLOCK_SEC;
}

// ---------- 移动与碰撞 ----------
function collides(run, x, y, size, self, others, prevX, prevY) {
  const half = size / 2;
  if (x - half < 0 || x + half > MAP.W || y - half < 0 || y + half > MAP.H) return true;
  const c0 = Math.floor((x - half) / BLOCK);
  const c1 = Math.floor((x + half - 0.001) / BLOCK);
  const r0 = Math.floor((y - half) / BLOCK);
  const r1 = Math.floor((y + half - 0.001) / BLOCK);
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      const cell = run.grid[r][c];
      if (cell === CELL.BRICK || cell === CELL.STEEL || cell === CELL.WATER || cell === CELL.FURNACE) return true;
    }
  }
  for (const o of others) {
    if (!o || o === self || !o.alive) continue;
    if (o.spawning || o.invuln) continue;
    // 允许已重叠的坦克彼此分离：若移动前就重叠，则不拦截（否则永远无法分开）
    const wasOverlap = prevX != null && prevY != null
      && Math.abs(o.x - prevX) < size && Math.abs(o.y - prevY) < size;
    if (wasOverlap) continue;
    if (Math.abs(o.x - x) < size && Math.abs(o.y - y) < size) return true;
  }
  return false;
}

function moveTank(run, ent, dx, dy, others) {
  const ox = ent.x;
  const oy = ent.y;
  ent.x += dx;
  ent.y += dy;
  if (collides(run, ent.x, ent.y, ent.size, ent, others, ox, oy)) {
    ent.x = ox;
    ent.y = oy;
    return false;
  }
  return true;
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  return {
    wave: run.wave,
    scene: run.scene,
    sceneKey: SCENES[run.scene - 1] ? SCENES[run.scene - 1].key : 'wastes',
    lives: run.lives,
    firepower: run.firepower,
    heavy: run.heavy,
    heavyPerWave: run.heavyPerWave,
    score: run.score,
    kills: run.stats.kills,
    furnaceHp: run.furnaceHp,
    furnaceMaxHp: run.furnaceMaxHp,
    enemiesLeft: run.spawnQueue.length + run.enemies.length,
    repairAvailable: !run.repairUsedThisWave,
    pendingUpgrade: run.pendingUpgrade,
    phase: run.phase,
    wavePhase: run.wavePhase,
  };
}

function emit(run, type, fields = {}) {
  // 事件 type 永远胜出：fields 里不许再有 type 键（敌人类型统一用 enemyType）
  run.events.push({ ...fields, type });
  run._lastEventAt = run.time;
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}
