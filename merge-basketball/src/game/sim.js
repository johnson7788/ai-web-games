// MERGE BASKETBALL · 纯逻辑 sim（可无 DOM 测试）
//
// 玩法骨架 1:1 还原参考「合成大篮球」：
//   - 顶部落球，指针水平瞄准，释放落下（2 个在途球上限 + 300ms 间隔）
//   - 同数值球碰撞合成翻倍，速度按动量合并，得分 += 新数值
//   - 球直径 = (log2(v)-1)*12+30，数值为 2 的幂；合到 1024 = 合成大篮球（可继续）
//   - 球顶越过顶部危险线并停留 → 判负
// 新增机制（原创）：
//   1. 自动落球（auto-drop）：长时间不操作自动落下，制造压力、保证死亡存在
//   2. 连击（combo）：连击窗口内连续合成给额外分数
//   3. 岩石球（rock）：不能合成、更重，随机出现在下一球
//   4. 星级（star）：结算按最大球给 1-3 星
//
// 导出 createRun / mulberry32 / rankFor / ballSize / starsFor 供 main 与 selfplay 共用。

import { WORLD, GAME, DROP_VALUES } from '../../config/game.config.js';

const { WIDTH, HEIGHT, GROUND_H } = WORLD;
export const GROUND_Y = HEIGHT - GROUND_H; // 627

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 球直径：value 2 -> 30, 4 -> 42 ... 1024 -> 138
export function ballSize(value) {
  return (Math.log2(value) - 1) * 12 + 30;
}

// 每值的物理手感（摩擦/恢复/重力/密度），与参考一致
const RIGID = [
  { f: 0.1, r: 0.30, g: 1.0, d: 15 }, // 2
  { f: 0.2, r: 0.50, g: 0.7, d: 5 },  // 4
  { f: 0.4, r: 0.60, g: 0.8, d: 7 },  // 8
  { f: 0.4, r: 0.35, g: 0.9, d: 12 }, // 16
  { f: 0.1, r: 0.30, g: 1.0, d: 15 }, // 32
  { f: 0.3, r: 0.50, g: 0.8, d: 9 },  // 64
  { f: 0.1, r: 0.30, g: 1.0, d: 14 }, // 128
  { f: 0.2, r: 0.40, g: 0.8, d: 10 }, // 256
  { f: 0.2, r: 0.40, g: 0.8, d: 10 }, // 512
  { f: 0.2, r: 0.50, g: 0.8, d: 11 }, // 1024
];

function rigidFor(value) {
  const idx = Math.max(0, Math.min(RIGID.length - 1, Math.log2(value) - 1));
  return RIGID[idx];
}

// 最大球 → 排名（1-6，供 bot 遥测的 levelsReached）
export function rankFor(biggest) {
  if (biggest < 2) return 1;
  return Math.min(6, Math.max(1, Math.round(Math.log2(biggest))));
}

// 结算星级：最大球 ≥1024 = 3 星，≥256 = 2 星，否则 1 星
export function starsFor(biggest) {
  if (biggest >= GAME.WIN_VALUE) return 3;
  if (biggest >= 256) return 2;
  return 1;
}

let NEXT_ID = 1;

function makeBall(kind, value, x, y, vx, vy) {
  if (kind === 'rock') {
    return {
      id: NEXT_ID++, kind: 'rock', value: 0,
      x, y, vx, vy,
      r: GAME.ROCK_RADIUS,
      m: 22 * GAME.ROCK_RADIUS * GAME.ROCK_RADIUS,
      f: 0.5, rest: 0.15, g: 1.3,
      hasCollided: false, mergeLock: 0, dangerT: 0, dead: false,
    };
  }
  const size = ballSize(value);
  const r = size / 2;
  const att = rigidFor(value);
  return {
    id: NEXT_ID++, kind: 'ball', value,
    x, y, vx, vy, r,
    m: att.d * r * r,
    f: att.f, rest: att.r, g: att.g,
    hasCollided: false, mergeLock: 0, dangerT: 0, dead: false,
  };
}

export function createRun(seed) {
  const rng = mulberry32(seed == null ? (Date.now() % 2147483647) || 1 : seed | 0);
  const state = {
    phase: 'playing',      // 'playing' | 'lost'
    won: false,            // 首次合到 1024 后置 true（游戏继续，可追更大）
    score: 0,
    biggest: 2,
    merges: 0,
    combo: 0,
    comboFlash: 0,
    nextValue: 2,
    nextKind: 'ball',      // 'ball' | 'rock'
    inFlight: 0,
    lastDropTime: -1,
    autoDropTimer: 0,
    time: 0,
    balls: [],
    rockCount: 0,
    drops: 0,
  };

  const events = [{ type: 'start' }];

  function emit(type, payload) {
    events.push({ type, ...(payload || {}) });
  }

  function pickNext() {
    const rockProb = 0.04 + Math.min(0.16, state.biggest / 8192);
    if (rng() < rockProb) {
      state.nextKind = 'rock';
      state.nextValue = 0;
    } else {
      state.nextKind = 'ball';
      state.nextValue = DROP_VALUES[Math.floor(rng() * DROP_VALUES.length)];
    }
  }

  function canDrop() {
    if (state.phase === 'lost') return false;
    if (state.inFlight >= GAME.DROP_MAX) return false;
    if (state.time - state.lastDropTime < GAME.DROP_GAP) return false;
    return true;
  }

  function spawn(value, kind, x, y, vx = 0, vy = 0, opts = {}) {
    const ball = makeBall(kind, value, x, y, vx, vy);
    if (opts.mergeLock) ball.mergeLock = opts.mergeLock;
    if (opts.hasCollided) ball.hasCollided = true;
    state.balls.push(ball);
    return ball;
  }

  function drop(x, manual) {
    if (!canDrop()) return { ok: false };
    const cx = Math.max(15, Math.min(WIDTH - 15, x == null ? WIDTH / 2 : x));
    const kind = state.nextKind;
    const value = state.nextValue;
    const vy = manual ? 60 : 20; // 手动给一点向下初速，自动落球更轻
    spawn(value, kind, cx, GAME.SPAWN_Y, 0, vy);
    state.inFlight += 1;
    state.lastDropTime = state.time;
    state.autoDropTimer = 0;
    state.drops += 1;
    if (kind === 'rock') state.rockCount += 1;
    pickNext();
    emit(manual ? 'drop' : 'autoDrop', { x: cx, value, kind, drops: state.drops });
    return { ok: true, x: cx, value, kind };
  }

  function markCollided(ball) {
    if (!ball.hasCollided) {
      ball.hasCollided = true;
      state.inFlight = Math.max(0, state.inFlight - 1);
    }
  }

  function lose() {
    if (state.phase === 'lost') return;
    state.phase = 'lost';
    const stars = starsFor(state.biggest);
    emit('lose', { score: state.score, biggest: state.biggest, stars, drops: state.drops });
  }

  function mergeAt(a, b) {
    markCollided(a);
    markCollided(b);
    const v = a.value * 2;
    const nx = (a.x + b.x) / 2;
    const ny = (a.y + b.y) / 2;
    const mass = a.m + b.m;
    let vx = (a.vx * a.m + b.vx * b.m) / (mass || 1);
    let vy = (a.vy * a.m + b.vy * b.m) / (mass || 1);
    const sp = Math.hypot(vx, vy);
    if (sp > GAME.MAX_SPEED) { vx = vx / sp * GAME.MAX_SPEED; vy = vy / sp * GAME.MAX_SPEED; }
    a.dead = true;
    b.dead = true;
    const nb = spawn(v, 'ball', nx, ny, vx, vy, { mergeLock: GAME.MERGE_LOCK, hasCollided: true });
    nb.hasCollided = true;

    state.merges += 1;
    state.biggest = Math.max(state.biggest, v);

    // 连击：窗口内连续合成，combo 从 1 递增
    if (state.comboFlash <= 0) {
      state.combo = 1;
    } else {
      state.combo += 1;
    }
    state.comboFlash = GAME.COMBO_WINDOW;

    const bonus = v * (state.combo - 1); // combo 1 → 0，combo 2 → +v，combo 3 → +2v …
    state.score += v + bonus;

    const firstWin = !state.won && v >= GAME.WIN_VALUE;
    if (firstWin) state.won = true;

    emit('merge', { value: v, x: nx, y: ny, combo: state.combo, score: state.score });
    emit('combo', { combo: state.combo });
    emit('grow', { biggest: state.biggest, value: v });
    if (state.biggest >= GAME.WIN_VALUE && firstWin) {
      emit('win', { value: v, biggest: state.biggest, score: state.score });
    }
  }

  function stepBall(ball, dt) {
    if (ball.dead) return;
    ball.vy += GAME.GRAVITY * ball.g * dt;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > GAME.MAX_SPEED) {
      ball.vx = ball.vx / sp * GAME.MAX_SPEED;
      ball.vy = ball.vy / sp * GAME.MAX_SPEED;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // 左右墙（不消耗在途计数）
    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx) * ball.rest;
    } else if (ball.x + ball.r > WIDTH) {
      ball.x = WIDTH - ball.r;
      ball.vx = -Math.abs(ball.vx) * ball.rest;
    }

    // 地面
    if (ball.y + ball.r > GROUND_Y) {
      ball.y = GROUND_Y - ball.r;
      if (Math.abs(ball.vy) > 40) {
        ball.vy = -Math.abs(ball.vy) * ball.rest;
      } else {
        ball.vy = 0;
      }
      ball.vx *= Math.max(0, 1 - ball.f * dt * 6);
      markCollided(ball);
    }

    // 危险线判定
    if (ball.y - ball.r < GAME.DANGER_Y) {
      ball.dangerT += dt;
      if (ball.dangerT > GAME.DANGER_GRACE || ball.y < GAME.DANGER_Y - ball.r) {
        lose();
      }
    } else {
      ball.dangerT = 0;
    }
  }

  function resolvePair(a, b) {
    if (a.dead || b.dead) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const minDist = a.r + b.r;
    if (dist >= minDist) return;

    // 同数值合成
    if (a.kind === 'ball' && b.kind === 'ball' && a.value === b.value && a.mergeLock <= 0 && b.mergeLock <= 0) {
      mergeAt(a, b);
      return;
    }

    markCollided(a);
    markCollided(b);

    // 位置分离
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    const total = a.m + b.m;
    const wa = b.m / total;
    const wb = a.m / total;
    a.x -= nx * overlap * wa;
    a.y -= ny * overlap * wa;
    b.x += nx * overlap * wb;
    b.y += ny * overlap * wb;

    // 冲量
    const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rvn < 0) {
      const e = Math.min(a.rest, b.rest);
      const j = -(1 + e) * rvn / (1 / a.m + 1 / b.m);
      const ix = j * nx;
      const iy = j * ny;
      a.vx -= ix / a.m;
      a.vy -= iy / a.m;
      b.vx += ix / b.m;
      b.vy += iy / b.m;
    }
  }

  function step(dt) {
    if (state.phase === 'lost') return;
    dt = Math.min(dt, 1 / 30);

    // 自动落球（长时间无操作）
    if (state.autoDropTimer >= GAME.AUTO_DROP_SEC) {
      if (canDrop()) {
        const jx = WIDTH / 2 + (rng() * 120 - 60);
        drop(jx, false);
      }
    } else {
      state.autoDropTimer += dt;
    }

    if (state.comboFlash > 0) state.comboFlash -= dt;

    for (const b of state.balls) stepBall(b, dt);

    // 球-球碰撞（O(n²)，规模小足够）
    const arr = state.balls;
    for (let i = 0; i < arr.length; i += 1) {
      for (let j = i + 1; j < arr.length; j += 1) {
        resolvePair(arr[i], arr[j]);
      }
    }

    // 清理已删除球
    if (state.balls.some((b) => b.dead)) {
      state.balls = state.balls.filter((b) => !b.dead);
    }

    state.time += dt;
  }

  function drainEvents() {
    if (!events.length) return [];
    return events.splice(0, events.length);
  }

  return {
    state,
    step,
    drainEvents,
    drop: (x) => drop(x, true),
    autoDrop: () => drop(WIDTH / 2 + (rng() * 120 - 60), false),
    canDrop,
    debug: {
      spawnBall: (value, x, y) => spawn(value, 'ball', x, y, 0, 0, { hasCollided: true }),
      spawnRock: (x, y) => spawn(0, 'rock', x, y, 0, 0, { hasCollided: true }),
    },
  };
}
