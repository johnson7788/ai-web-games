// SNAKE NEON 2048 · 纯逻辑模拟（无 DOM，可被 node --test 与 tools/selfplay.mjs 直接 import）。
// P0 玩法 1:1 还原自参考贪吃蛇：网格棋盘（0 可通行 / 1 墙）、蛇头/身/尾、方向向量、
// 撞墙/咬尾死亡、进食 +1 生长、每吃 N 个核心提速（interval *= multiplier，有下限）。
// 新机制：3 秒连击倍率、黄金核心（×5 + 慢动作）、按最高连击结算星级、三关推进。

import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OPPOSITE = { '0,1': '0,-1', '0,-1': '0,1', '1,0': '-1,0', '-1,0': '1,0' };

export function createRun(levelIndex, opts = {}) {
  const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, (levelIndex ?? 0) | 0));
  const level = LEVELS[idx];
  const seed = opts.seed != null ? opts.seed : ((Date.now() % 2147483647) || 1);
  const rng = mulberry32(seed);

  const state = {
    level: idx + 1,                 // 1 基
    rows: level.rows,
    cols: level.cols,
    grid: level.tiles.map((row) => row.map((t) => ({ type: t }))),
    snake: level.snake.parts.map((p) => ({ x: p.x, y: p.y })),
    dir: { ...level.snake.dir },
    phase: 'idle',                  // idle | running | dead | won
    score: 0,
    combo: 0,
    maxCombo: 0,
    fruits: 0,
    target: level.target,
    fruit: null,
    golden: null,
    goldenCountdown: level.goldenEvery,
    moveAccum: 0,
    time: 0,
    slowUntil: 0,
    interval: level.speed.initial,
    accelerateMultiplier: level.speed.accelerateMultiplier,
    accelerateEvery: level.speed.accelerateEvery,
    minimum: level.speed.minimum,
    lastEatTime: -Infinity,
    stars: 0,
    deathReason: null,
  };

  const events = [];

  const emit = (type, payload = {}) => events.push({ type, ...payload });

  const keyOf = (x, y) => `${x}|${y}`;

  function occupied(x, y) {
    return state.snake.some((s) => s.x === x && s.y === y);
  }

  function freeCells() {
    const list = [];
    for (let y = 0; y < state.rows; y += 1) {
      for (let x = 0; x < state.cols; x += 1) {
        if (state.grid[y][x].type !== 0) continue;
        if (occupied(x, y)) continue;
        if (state.fruit && state.fruit.x === x && state.fruit.y === y) continue;
        if (state.golden && state.golden.x === x && state.golden.y === y) continue;
        list.push({ x, y });
      }
    }
    return list;
  }

  function randomFreeCell() {
    const list = freeCells();
    if (!list.length) return null;
    return list[Math.floor(rng() * list.length)];
  }

  function spawnTarget() {
    if (state.goldenCountdown <= 0) {
      state.golden = randomFreeCell();
      state.fruit = null;
      state.goldenCountdown = level.goldenEvery;
    } else {
      state.fruit = randomFreeCell();
      state.golden = null;
    }
  }

  function currentInterval() {
    const slow = state.slowUntil > state.time;
    return state.interval * (slow ? GAME.SLOW_FACTOR : 1);
  }

  function startRun() {
    state.phase = 'running';
    state.moveAccum = 0;
    emit('start', { level: state.level });
  }

  function starsFor(combo) {
    if (combo >= GAME.STAR_COMBO_3) return 3;
    if (combo >= GAME.STAR_COMBO_2) return 2;
    return 1;
  }

  function die(reason) {
    state.phase = 'dead';
    state.deathReason = reason;
    state.stars = 0;
    emit('die', { reason, score: state.score });
    emit('lose', { reason, score: state.score, maxCombo: state.maxCombo });
  }

  function win() {
    state.phase = 'won';
    state.stars = starsFor(state.maxCombo);
    emit('win', { level: state.level, score: state.score, maxCombo: state.maxCombo, stars: state.stars });
  }

  function eatFruit() {
    // 连击：3 秒窗口内连续进食 → combo+1，否则回到 1
    const gap = state.time - state.lastEatTime;
    state.combo = gap <= GAME.COMBO_WINDOW ? Math.min(GAME.COMBO_MAX, state.combo + 1) : 1;
    state.lastEatTime = state.time;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.score += state.combo;
    state.fruits += 1;
    state.fruit = null;
    if (state.combo > 1) emit('combo', { combo: state.combo, score: state.score });
    emit('eat', { combo: state.combo, score: state.score, fruits: state.fruits, target: state.target });

    // 提速
    if (state.fruits % state.accelerateEvery === 0) {
      const prev = state.interval;
      state.interval = Math.max(state.interval * state.accelerateMultiplier, state.minimum);
      if (state.interval < prev) emit('speedup', { interval: state.interval });
    }

    state.goldenCountdown -= 1;
    if (state.fruits >= state.target) {
      win();
      return;
    }
    spawnTarget();
  }

  function eatGolden() {
    state.combo = Math.min(GAME.COMBO_MAX, state.combo + 1);
    state.lastEatTime = state.time;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.score += GAME.GOLDEN_VALUE;
    state.fruits += 1;
    state.slowUntil = state.time + GAME.GOLDEN_SLOW_SEC;
    state.golden = null;
    emit('golden', { score: state.score, combo: state.combo, fruits: state.fruits });
    emit('slow', { seconds: GAME.GOLDEN_SLOW_SEC });
    if (state.fruits >= state.target) {
      win();
      return;
    }
    state.goldenCountdown = level.goldenEvery;
    spawnTarget();
  }

  function doMove() {
    const head = state.snake[0];
    const nx = head.x + state.dir.x;
    const ny = head.y + state.dir.y;

    const outOfBounds = nx < 0 || ny < 0 || nx >= state.cols || ny >= state.rows;
    const wall = !outOfBounds && state.grid[ny][nx].type === 1;
    if (outOfBounds || wall) { die(wall ? 'wall' : 'bound'); return; }

    const grows = (state.fruit && state.fruit.x === nx && state.fruit.y === ny)
      || (state.golden && state.golden.x === nx && state.golden.y === ny);

    // 自碰撞：grows 时尾巴不动（整条蛇都算障碍），否则尾巴会让出格子
    const body = grows ? state.snake : state.snake.slice(0, -1);
    if (body.some((s) => s.x === nx && s.y === ny)) { die('self'); return; }

    state.snake.unshift({ x: nx, y: ny });
    if (!grows) state.snake.pop();
    emit('move', { x: nx, y: ny, len: state.snake.length });

    if (grows) {
      if (state.fruit && state.fruit.x === nx && state.fruit.y === ny) eatFruit();
      else if (state.golden && state.golden.x === nx && state.golden.y === ny) eatGolden();
    }
  }

  spawnTarget();

  return {
    state,

    step(dt) {
      if (state.phase === 'dead' || state.phase === 'won') return;
      state.time += dt;
      if (state.phase === 'idle') {
        if (state.time >= GAME.AUTO_LAUNCH_SEC) startRun();
        else return;
      }
      state.moveAccum += dt;
      const interval = currentInterval();
      let guard = 0;
      while (state.moveAccum >= interval && state.phase === 'running' && guard++ < 8) {
        state.moveAccum -= interval;
        doMove();
      }
    },

    drainEvents() {
      return events.splice(0, events.length);
    },

    setDir(dx, dy) {
      dx = Math.sign(dx | 0);
      dy = Math.sign(dy | 0);
      if ((dx === 0 && dy === 0) || (dx !== 0 && dy !== 0)) return { ok: false };
      if (state.phase === 'idle') {
        state.dir = { x: dx, y: dy };
        startRun();
        emit('input', { dir: { x: dx, y: dy } });
        return { ok: true };
      }
      if (state.phase !== 'running') return { ok: false };
      if (dx === state.dir.x && dy === state.dir.y) return { ok: false };
      if (OPPOSITE[`${state.dir.x},${state.dir.y}`] === `${dx},${dy}`) return { ok: false };
      state.dir = { x: dx, y: dy };
      emit('turn', { dir: { x: dx, y: dy } });
      emit('input', { dir: { x: dx, y: dy } });
      return { ok: true };
    },

    getHud() {
      return {
        level: state.level,
        score: state.score,
        combo: state.combo,
        maxCombo: state.maxCombo,
        fruits: state.fruits,
        target: state.target,
        slowLeft: Math.max(0, state.slowUntil - state.time),
      };
    },

    // 验收/截图用调试钩子（不参与正式玩法）
    debug: {
      forceWin() { win(); },
      forceDie() { die('self'); },
      spawnGolden() { state.fruit = null; state.goldenCountdown = 0; spawnTarget(); },
      setSlow(sec) { state.slowUntil = state.time + sec; },
      setCombo(n) { state.combo = Math.min(GAME.COMBO_MAX, Math.max(0, n | 0)); state.maxCombo = Math.max(state.maxCombo, state.combo); },
    },

    // 供调试/验收脚本读取的棋盘几何快照
    snapshot() {
      return {
        level: state.level,
        rows: state.rows,
        cols: state.cols,
        grid: state.grid.map((r) => r.map((c) => c.type)),
        snake: state.snake.map((s) => ({ ...s })),
        dir: { ...state.dir },
        fruit: state.fruit ? { ...state.fruit } : null,
        golden: state.golden ? { ...state.golden } : null,
        phase: state.phase,
        score: state.score,
        combo: state.combo,
        maxCombo: state.maxCombo,
        fruits: state.fruits,
        target: state.target,
        stars: state.stars,
        interval: state.interval,
        slowLeft: Math.max(0, state.slowUntil - state.time),
      };
    },
  };
}
