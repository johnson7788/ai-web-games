// PLUMBER RUN · 模拟/玩法核心（纯逻辑，零 DOM/零依赖）
// 契约：createRun({seed, level}) → run；run.step(input) / run.getHud() / run.drainEvents()
// 输入：{ left, right, jumpHeld, wrenchHeld, steamHeld }（按住布尔；边沿在 sim 内部检测）
// 事件：moveRight / jump / stomp / coin / powerUp / wrenchThrow / wrenchHit / bump /
//       brickBreak / steamGain / steamBurst / hit / death / levelClear / win / milestone
import {
  PLAYER, FORM, WRENCH, STEAM, ENEMY, SCORE, LIFE, STARS, CAM, STEP, clamp,
} from '../../config/gameplay.js';
import { WORLD } from '../../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';
import { mulberry32 } from './rng.js';

const TILE = WORLD.TILE;
const ROWS = WORLD.ROWS;
const SOLID = new Set(['#', '=', 'B', '?', 'C']);
const BUMPABLE = new Set(['B', '?', 'C']);

export function createRun({ seed = 0, level = 1 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing', // playing | dead | win
    time: 0,
    level: clamp(level | 0, 1, LEVEL_COUNT),
    levelTime: 0,
    coins: 0,
    score: 0,
    lives: LIFE.START,
    steam: 0,
    stars: 0,
    cameraX: 0,
    width: 0,
    height: ROWS,
    grid: null,
    player: null,
    coinsList: [],
    enemies: [],
    pickups: [],
    spikes: [],
    flag: null,
    wrench: null,
    particles: [], // 纯逻辑粒子（渲染消费；坐标 px）
    wrenchCooldown: 0,
    stats: {
      levelsReached: level,
      stomps: 0,
      bricksBroken: 0,
      coinsCollected: 0,
      powerups: 0,
      wrenchesThrown: 0,
      deaths: 0,
    },
    levelCoinCount: 0,
    levelCoins: 0,
    levelHit: false,
    events: [],
    nextId: 1,
    _prev: { jumpHeld: false, wrenchHeld: false, steamHeld: false },
    _mile: 0,
  };

  loadLevel(run, run.level);
  run.step = (input) => step(run, input || {});
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// ---------- 关卡装载 ----------
function loadLevel(run, index) {
  const def = LEVELS[index - 1];
  run.width = def.width;
  run.height = def.height;
  run.level = index;
  run.levelTime = 0;
  run.levelCoinCount = def.coinCount;
  run.levelCoins = 0;
  run.levelHit = false;
  run.flag = def.flag;
  run.coinsList = [];
  run.enemies = [];
  run.pickups = [];
  run.spikes = [];
  run.wrench = null;
  run.particles = [];
  run._mile = 0;
  run._rightMile = 0;

  // 深拷贝网格（可变：砖块被顶碎/问号用掉）
  run.grid = def.rows.map((row) => row.split(''));

  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < run.width; c += 1) {
      const ch = run.grid[r][c];
      const cx = (c + 0.5) * TILE;
      const cy = (r + 0.5) * TILE;
      if (ch === 'o') run.coinsList.push({ id: run.nextId++, c, r, x: cx, y: cy, taken: false });
      else if (ch === 'M' || ch === 'F' || ch === 'S') {
        run.pickups.push({ id: run.nextId++, kind: ch, x: cx, y: (r + 0.5) * TILE, vy: 0, popped: false });
        run.grid[r][c] = '.';
      } else if (ch === 'E') {
        run.enemies.push(makeEnemy(run, cx, (r + 0.5) * TILE));
        run.grid[r][c] = '.';
      } else if (ch === '^') run.spikes.push({ c, r, x: cx, y: cy });
    }
  }

  // 出生点（playerSpawn 是 r 行，feet 在 (r+1)*TILE 顶部）
  const sp = def.playerSpawn;
  const form = run.player ? run.player.form : FORM.SMALL;
  const h = heightFor(form);
  run.player = {
    x: (sp.c + 0.5) * TILE,
    y: (sp.r + 1) * TILE,
    vx: 0,
    vy: 0,
    w: PLAYER.W,
    h,
    form,
    dir: 1,
    onGround: true,
    coyote: 0,
    jumpBuffer: 0,
    invuln: 0,
    hover: 0,
    jumpCut: false,
  };
}

function makeEnemy(run, x, y) {
  return {
    id: run.nextId++,
    x,
    y, // feet
    vx: ENEMY.SPEED,
    vy: 0,
    w: ENEMY.W,
    h: ENEMY.H,
    dir: -1,
    alive: true,
    squash: 0,
    onGround: false,
  };
}

function heightFor(form) {
  return form === FORM.SMALL ? PLAYER.H_SMALL : PLAYER.H_BIG;
}

// ---------- 每 tick ----------
function step(run, input) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;
  run.levelTime += dt;

  // 边沿检测
  const jumpPressed = !!input.jumpHeld && !run._prev.jumpHeld;
  const jumpReleased = !input.jumpHeld && run._prev.jumpHeld;
  const wrenchPressed = !!input.wrenchHeld && !run._prev.wrenchHeld;
  const steamPressed = !!input.steamHeld && !run._prev.steamHeld;
  run._prev = {
    jumpHeld: !!input.jumpHeld,
    wrenchHeld: !!input.wrenchHeld,
    steamHeld: !!input.steamHeld,
  };

  const p = run.player;
  const left = !!input.left;
  const right = !!input.right;

  // 计时器
  if (p.coyote > 0) p.coyote -= dt;
  if (p.jumpBuffer > 0) p.jumpBuffer -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.hover > 0) p.hover -= dt;

  // 跳跃缓冲 / 土狼时间 → 起跳
  if (jumpPressed) p.jumpBuffer = PLAYER.JUMP_BUFFER;
  if (p.jumpBuffer > 0 && (p.onGround || p.coyote > 0)) {
    p.vy = -PLAYER.JUMP_VX;
    p.onGround = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
    p.jumpCut = false;
    emit(run, 'jump', { x: p.x, y: p.y });
  }

  // 水平
  const maxVx = p.onGround ? PLAYER.MAX_VX : PLAYER.MAX_VX_AIR;
  if (left && !right) {
    p.dir = -1;
    p.vx -= (p.onGround ? PLAYER.ACCEL : PLAYER.AIR_ACCEL) * dt;
  } else if (right && !left) {
    p.dir = 1;
    p.vx += (p.onGround ? PLAYER.ACCEL : PLAYER.AIR_ACCEL) * dt;
  } else {
    // 摩擦
    const f = PLAYER.FRICTION * dt;
    if (p.vx > f) p.vx -= f;
    else if (p.vx < -f) p.vx += f;
    else p.vx = 0;
  }
  p.vx = clamp(p.vx, -maxVx, maxVx);

  const prevX = p.x;
  p.x += p.vx * dt;
  resolveHorizontal(run, p);

  // 移动里程碑（事件密度：每 50px 一个）
  const traveled = p.x - prevX;
  if (right && traveled > 0) {
    run._rightMile = (run._rightMile || 0) + traveled;
    if (run._rightMile >= 50) {
      run._rightMile = 0;
      emit(run, 'moveRight', { x: p.x });
    }
  }
  emitMilestone(run, p.x);

  // 垂直重力
  let grav = PLAYER.GRAVITY;
  if (p.vy < 0) grav = input.jumpHeld ? PLAYER.GRAVITY : PLAYER.GRAVITY_RISE;
  else if (p.hover > 0) grav = STEAM.HOVER_GRAV;
  else if (p.form === FORM.FIRE && input.jumpHeld && !p.onGround && p.vy > 0) grav = PLAYER.FIRE_HOVER_GRAV;

  p.vy += grav * dt;
  let maxFall = PLAYER.MAX_FALL;
  if (p.hover > 0) maxFall = STEAM.HOVER_MAX_FALL;
  else if (p.form === FORM.FIRE && input.jumpHeld && !p.onGround && p.vy > 0) maxFall = PLAYER.FIRE_HOVER_MAX_FALL;
  p.vy = Math.min(p.vy, maxFall);

  p.onGround = false;
  p.y += p.vy * dt;
  resolveVertical(run, p, jumpReleased, input.jumpHeld);

  // 蒸汽喷射（满罐高跳 + 悬停）
  if (steamPressed && run.steam >= STEAM.MAX) {
    run.steam = 0;
    p.vy = -STEAM.BURST_VY;
    p.hover = STEAM.HOVER_SEC;
    p.onGround = false;
    emit(run, 'steamBurst', { x: p.x, y: p.y });
  }

  // 扳手回旋
  if (wrenchPressed && !run.wrench && run.wrenchCooldown <= 0) {
    run.wrench = {
      x: p.x + p.dir * (p.w / 2 + 8),
      y: p.y - p.h * 0.5,
      vx: p.dir * WRENCH.SPEED,
      dir: p.dir,
      traveled: 0,
      returning: false,
    };
    run.wrenchCooldown = 0;
    run.stats.wrenchesThrown += 1;
    emit(run, 'wrenchThrow', { x: run.wrench.x, y: run.wrench.y });
  }
  if (run.wrenchCooldown > 0) run.wrenchCooldown -= dt;

  // 敌人
  updateEnemies(run, dt);
  collideEnemies(run, p);

  // 扳手
  updateWrench(run, dt);

  // 拾取
  updatePickups(run, dt);
  collectCoins(run, p);
  collectPickups(run, p);

  // 尖刺
  checkSpikes(run, p);

  // 旗杆 / 过关
  checkFlag(run, p);

  // 掉坑
  if (p.y > WORLD.HEIGHT + 60) killPlayer(run, 'pit');

  // 关卡超时计时器（站着不动也会死，保证 idle 基线会结束）
  if (run.levelTime > LIFE.LEVEL_TIME_LIMIT) killPlayer(run, 'timeout');

  // 相机
  updateCamera(run);
}

// ---------- 碰撞 ----------
function solidTile(run, c, r) {
  if (r < 0 || r >= ROWS || c < 0 || c >= run.width) return null;
  const ch = run.grid[r][c];
  if (SOLID.has(ch)) return { c, r, ch };
  return null;
}

function resolveHorizontal(run, p) {
  const r0 = Math.floor((p.y - p.h + 0.5) / TILE);
  const r1 = Math.floor((p.y - 0.5) / TILE);
  if (p.vx > 0) {
    const c = Math.floor((p.x + p.w / 2) / TILE);
    for (let r = r0; r <= r1; r += 1) {
      const t = solidTile(run, c, r);
      if (t) { p.x = c * TILE - p.w / 2 - 0.01; p.vx = 0; return; }
    }
  } else if (p.vx < 0) {
    const c = Math.floor((p.x - p.w / 2) / TILE);
    for (let r = r0; r <= r1; r += 1) {
      const t = solidTile(run, c, r);
      if (t) { p.x = (c + 1) * TILE + p.w / 2 + 0.01; p.vx = 0; return; }
    }
  }
}

function resolveVertical(run, p, jumpReleased, jumpHeld) {
  if (p.vy >= 0) {
    // 下落 / 站地：脚底
    const row = Math.floor(p.y / TILE);
    const c0 = Math.floor((p.x - p.w / 2) / TILE);
    const c1 = Math.floor((p.x + p.w / 2) / TILE);
    for (let c = c0; c <= c1; c += 1) {
      const t = solidTile(run, c, row);
      if (t) {
        p.y = row * TILE;
        p.vy = 0;
        p.onGround = true;
        p.coyote = PLAYER.COYOTE;
        p.jumpCut = false;
        return;
      }
    }
  } else {
    // 上升：头顶
    const row = Math.floor((p.y - p.h) / TILE);
    const c0 = Math.floor((p.x - p.w / 2) / TILE);
    const c1 = Math.floor((p.x + p.w / 2) / TILE);
    for (let c = c0; c <= c1; c += 1) {
      const t = solidTile(run, c, row);
      if (t) {
        p.y = (row + 1) * TILE + p.h + 0.01;
        p.vy = 0;
        if (BUMPABLE.has(t.ch)) bump(run, t, p);
        return;
      }
    }
  }
}

// ---------- 顶砖 ----------
function bump(run, t, p) {
  emit(run, 'bump', { c: t.c, r: t.r, ch: t.ch });
  const ch = t.ch;
  if (ch === '?') {
    if (p.form === FORM.SMALL) spawnPickup(run, t, 'M');
    else if (p.form === FORM.BIG) spawnPickup(run, t, 'F');
    else { run.score += SCORE.POWERUP; run.coins += 1; run.levelCoins += 1; emit(run, 'coin', { x: (t.c + 0.5) * TILE, y: (t.r - 0.5) * TILE }); }
    run.grid[t.r][t.c] = '#'; // 用过的问号变实心
  } else if (ch === 'C') {
    run.grid[t.r][t.c] = '#';
    run.coins += 1;
    run.levelCoins += 1;
    run.score += SCORE.COIN;
    run.stats.coinsCollected += 1;
    emit(run, 'coin', { x: (t.c + 0.5) * TILE, y: (t.r - 0.5) * TILE });
  } else if (ch === 'B') {
    if (p.form >= FORM.BIG) {
      run.grid[t.r][t.c] = '.';
      run.score += SCORE.BRICK;
      run.stats.bricksBroken += 1;
      burst(run, (t.c + 0.5) * TILE, t.r * TILE, '#b08d57');
      emit(run, 'brickBreak', { c: t.c, r: t.r });
    }
  }
}

function spawnPickup(run, t, kind) {
  run.pickups.push({
    id: run.nextId++,
    kind,
    x: (t.c + 0.5) * TILE,
    y: t.r * TILE - 10,
    vy: -70,
    popped: true,
  });
}

// ---------- 敌人 ----------
function updateEnemies(run, dt) {
  for (const e of run.enemies) {
    if (!e.alive) {
      if (e.squash > 0) e.squash -= dt;
      continue;
    }
    // 重力
    e.vy = Math.min(e.vy + PLAYER.GRAVITY * dt, PLAYER.MAX_FALL);
    const prevFeet = e.y;
    e.onGround = false;
    e.y += e.vy * dt;
    // 落地
    const row = Math.floor(e.y / TILE);
    const c0 = Math.floor((e.x - e.w / 2) / TILE);
    const c1 = Math.floor((e.x + e.w / 2) / TILE);
    for (let c = c0; c <= c1; c += 1) {
      const t = solidTile(run, c, row);
      if (t && e.vy >= 0) { e.y = row * TILE; e.vy = 0; e.onGround = true; break; }
    }

    // 水平
    e.x += e.vx * dt;
    const hr0 = Math.floor((e.y - e.h + 0.5) / TILE);
    const hr1 = Math.floor((e.y - 0.5) / TILE);
    let wall = false;
    if (e.vx > 0) {
      const c = Math.floor((e.x + e.w / 2) / TILE);
      for (let r = hr0; r <= hr1; r += 1) if (solidTile(run, c, r)) { e.x = c * TILE - e.w / 2 - 0.01; wall = true; break; }
    } else if (e.vx < 0) {
      const c = Math.floor((e.x - e.w / 2) / TILE);
      for (let r = hr0; r <= hr1; r += 1) if (solidTile(run, c, r)) { e.x = (c + 1) * TILE + e.w / 2 + 0.01; wall = true; break; }
    }
    if (wall) { e.vx = -e.vx; e.dir = -e.dir; }

    // 悬崖检测（不走向坑）
    if (e.onGround) {
      const ahead = Math.floor((e.x + (e.vx > 0 ? e.w / 2 : -e.w / 2)) / TILE);
      const belowRow = Math.floor((e.y + 2) / TILE);
      if (!solidTile(run, ahead, belowRow)) { e.vx = -e.vx; e.dir = -e.dir; }
    }
  }
}

// ---------- 玩家 × 敌人 ----------
function collideEnemies(run, p) {
  for (const e of run.enemies) {
    if (!e.alive) continue;
    const overlap = Math.abs(e.x - p.x) < (e.w / 2 + p.w / 2)
      && Math.abs((e.y - e.h / 2) - (p.y - p.h / 2)) < (e.h / 2 + p.h / 2);
    if (!overlap) continue;
    // 踩怪：下落中且脚在敌人中线以上
    const stomp = p.vy > 0 && p.y < e.y - e.h * 0.5 + 6;
    if (stomp) {
      e.alive = false;
      e.squash = ENEMY.SQUASH_MS / 1000;
      p.vy = -ENEMY.STOMP_BOUNCE;
      p.onGround = false;
      run.score += SCORE.STOMP;
      run.stats.stomps += 1;
      emit(run, 'stomp', { x: e.x, y: e.y });
    } else if (p.invuln <= 0) {
      damagePlayer(run);
    }
  }
}

// ---------- 扳手 ----------
function updateWrench(run, dt) {
  const w = run.wrench;
  if (!w) return;
  const p = run.player;
  w.traveled += WRENCH.SPEED * dt;
  if (!w.returning && w.traveled >= WRENCH.RANGE) {
    w.returning = true;
    w.dir = -w.dir; // 到射程掉头回旋
  }
  w.vx = w.dir * WRENCH.SPEED;
  w.x += w.vx * dt;

  // 命中敌人（去程与回程都伤敌）
  for (const e of run.enemies) {
    if (!e.alive) continue;
    if (Math.abs(w.x - e.x) < 14 && Math.abs(w.y - (e.y - e.h / 2)) < e.h) {
      e.alive = false;
      e.squash = ENEMY.SQUASH_MS / 1000;
      run.score += SCORE.STOMP;
      run.stats.stomps += 1;
      emit(run, 'wrenchHit', { x: e.x, y: e.y });
    }
  }

  // 回程接住
  if (w.returning && Math.abs(w.x - p.x) < 18 && Math.abs(w.y - (p.y - p.h / 2)) < 40) {
    run.wrench = null;
    run.wrenchCooldown = WRENCH.COOLDOWN;
  }
}

// ---------- 拾取 ----------
function collectCoins(run, p) {
  for (const c of run.coinsList) {
    if (c.taken) continue;
    if (Math.abs(c.x - p.x) < (p.w / 2 + 12) && Math.abs(c.y - (p.y - p.h / 2)) < (p.h / 2 + 12)) {
      c.taken = true;
      run.coins += 1;
      run.levelCoins += 1;
      run.score += SCORE.COIN;
      run.stats.coinsCollected += 1;
      emit(run, 'coin', { x: c.x, y: c.y });
    }
  }
}

function updatePickups(run, dt) {
  for (const pk of run.pickups) {
    if (pk.popped) {
      pk.y += pk.vy * dt;
      pk.vy += 160 * dt; // 重力，让顶出的道具回落 1 格
      if (pk.vy > 0) pk.popped = false;
    }
  }
}

function collectPickups(run, p) {
  for (const pk of run.pickups) {
    if (Math.abs(pk.x - p.x) < (p.w / 2 + 14) && Math.abs(pk.y - (p.y - p.h / 2)) < (p.h / 2 + 14)) {
      applyPickup(run, pk);
      pk.done = true;
    }
  }
  run.pickups = run.pickups.filter((pk) => !pk.done);
}

function applyPickup(run, pk) {
  const p = run.player;
  if (pk.kind === 'S') {
    const before = run.steam;
    run.steam = clamp(run.steam + STEAM.PICKUP, 0, STEAM.MAX);
    emit(run, 'steamGain', { steam: run.steam, gained: run.steam - before });
    run.score += SCORE.POWERUP;
  } else if (pk.kind === 'M') {
    run.stats.powerups += 1;
    if (p.form === FORM.SMALL) { setForm(run, FORM.BIG); emit(run, 'powerUp', { kind: 'grow' }); }
    else { run.score += SCORE.POWERUP; emit(run, 'powerUp', { kind: 'bonus' }); }
  } else if (pk.kind === 'F') {
    run.stats.powerups += 1;
    if (p.form === FORM.SMALL) { setForm(run, FORM.BIG); emit(run, 'powerUp', { kind: 'grow' }); }
    else if (p.form === FORM.BIG) { setForm(run, FORM.FIRE); emit(run, 'powerUp', { kind: 'fire' }); }
    else { run.score += SCORE.POWERUP + 100; emit(run, 'powerUp', { kind: 'bonus' }); }
  }
}

function setForm(run, form) {
  const p = run.player;
  const oldH = p.h;
  p.form = form;
  p.h = heightFor(form);
  // 长高时向上抬，避免嵌入头顶
  if (p.h > oldH) p.y -= (p.h - oldH);
}

// ---------- 尖刺 ----------
function checkSpikes(run, p) {
  if (p.invuln > 0) return;
  for (const s of run.spikes) {
    const sx0 = s.x - TILE / 2 + 4;
    const sx1 = s.x + TILE / 2 - 4;
    const sy0 = s.y - TILE / 2 + 8;
    const sy1 = s.y + TILE / 2;
    const px0 = p.x - p.w / 2;
    const px1 = p.x + p.w / 2;
    const py0 = p.y - p.h;
    const py1 = p.y;
    if (px1 > sx0 && px0 < sx1 && py1 > sy0 && py0 < sy1) {
      damagePlayer(run);
      return;
    }
  }
}

// ---------- 旗杆 ----------
function checkFlag(run, p) {
  if (!run.flag) return;
  const fcx = (run.flag.c + 0.5) * TILE;
  if (p.x >= fcx - TILE * 0.6 && p.x <= fcx + TILE * 0.6 && p.y > (run.flag.r) * TILE - 60) {
    clearLevel(run);
  }
}

function clearLevel(run) {
  const level = run.level;
  const coinStar = run.levelCoinCount === 0 ? 3 : (run.levelCoins >= Math.ceil(run.levelCoinCount * STARS.COIN_RATIO) ? 1 : 0);
  const timeStar = run.levelTime <= STARS.TIME_SEC ? 1 : 0;
  const noHitStar = !run.levelHit ? 1 : 0;
  const gained = coinStar + timeStar + noHitStar;
  run.stars += gained;
  run.score += SCORE.FLAG + Math.max(0, Math.floor((STARS.TIME_SEC - run.levelTime) * SCORE.TIME_BONUS_PER_SEC * 10));
  run.stats.levelsReached = Math.max(run.stats.levelsReached, level);
  emit(run, 'levelClear', { level, stars: gained, coins: run.levelCoins, time: Math.round(run.levelTime * 10) / 10 });

  if (level >= LEVEL_COUNT) {
    run.phase = 'win';
    emit(run, 'win', { score: run.score, stars: run.stars });
  } else {
    loadLevel(run, level + 1);
  }
}

// ---------- 受伤 / 死亡 ----------
function damagePlayer(run) {
  const p = run.player;
  if (p.invuln > 0) return;
  run.levelHit = true;
  if (p.form === FORM.SMALL) {
    killPlayer(run, 'enemy');
  } else {
    setForm(run, FORM.SMALL);
    p.invuln = LIFE.INVULN_SEC;
    emit(run, 'hit', { x: p.x, y: p.y });
  }
}

function killPlayer(run, cause) {
  if (run.phase !== 'playing') return;
  run.stats.deaths += 1;
  run.lives -= 1;
  emit(run, 'death', { cause });
  if (run.lives <= 0) {
    run.phase = 'dead';
  } else {
    // 重生在本关起点
    const def = LEVELS[run.level - 1];
    const sp = def.playerSpawn;
    const p = run.player;
    p.x = (sp.c + 0.5) * TILE;
    p.y = (sp.r + 1) * TILE;
    p.vx = 0;
    p.vy = 0;
    setForm(run, FORM.SMALL);
    p.invuln = LIFE.INVULN_SEC;
    p.hover = 0;
    run.levelTime = 0;
  }
}

// ---------- 粒子 / 里程碑 ----------
function burst(run, x, y, color) {
  for (let i = 0; i < 6; i += 1) {
    run.particles.push({
      x, y,
      vx: (run.rng() - 0.5) * 240,
      vy: -run.rng() * 220,
      life: 0.5,
      color,
      size: 4 + run.rng() * 4,
    });
  }
}

function emitMilestone(run, x) {
  const mile = Math.floor(x / 50);
  if (mile > run._mile) {
    run._mile = mile;
    emit(run, 'milestone', { x });
  }
}

function updateCamera(run) {
  const target = run.player.x - WORLD.WIDTH * CAM.LOOKAHEAD;
  const maxCam = Math.max(0, run.width * TILE - WORLD.WIDTH);
  run.cameraX = clamp(target, 0, maxCam);
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const p = run.player;
  return {
    level: run.level,
    levelName: `level.${run.level}`,
    time: run.time,
    levelTime: run.levelTime,
    coins: run.coins,
    lives: run.lives,
    score: run.score,
    form: p.form,
    steam: run.steam,
    steamMax: STEAM.MAX,
    phase: run.phase,
    stars: run.stars,
    x: p.x,
    y: p.y,
  };
}

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}
