// src/game/sim.js — 纯逻辑（不碰 DOM / window / localStorage / Date.now）。
// 经典网格贪吃蛇：吃光球成长、撞墙/自身/岩石死亡、冲刺、连击、金色球、120s 计时三阶段。
// 60Hz 固定步长由外部装配；本模块只提供 createRun / stepRun / getHud / drainEvents。
import { WORLD, SNAKE, FOOD, STAGES, RUN } from '../../config/game.config.js';

// 可复现的伪随机（mulberry32），测试与 selfplay 传 seed 保证确定性。
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function cellKey(x, y) {
  return `${x},${y}`;
}

export function createRun(opts = {}) {
  const seed = opts.seed ?? ((Date.now() || 0) >>> 0);
  const rng = mulberry32(seed);
  const hx = Math.floor(WORLD.COLS / 2);
  const hy = Math.floor(WORLD.ROWS / 2);
  const snake = [{ x: hx, y: hy }];
  for (let i = 1; i < SNAKE.INITIAL_LENGTH; i += 1) snake.push({ x: hx - i, y: hy });

  const run = {
    seed,
    rng,
    phase: 'playing', // playing | won | lost
    time: 0,
    elapsedMs: 0,
    moveAcc: 0,
    snake,
    dir: { x: 1, y: 0 },
    pending: [], // 方向队列（最多 2，支持快速连按）
    food: null,
    gold: null,
    goldSpawnedAtMs: 0,
    lastGoldAtMs: 0,
    rocks: [],
    score: 0,
    combo: 0,
    lastFoodAtMs: -Infinity,
    energy: SNAKE.ENERGY_MAX,
    boosting: false,
    stage: 1,
    foodEaten: 0,
    moves: 0,
    events: [],
  };

  spawnFood(run);
  return run;
}

// ---------------------------------------------------------------- 查询

export function getHud(run) {
  return {
    score: run.score,
    length: run.snake.length,
    time: run.time,
    timeLeft: Math.max(0, RUN.TIME_LIMIT_SEC - run.time),
    stage: run.stage,
    combo: run.combo,
    energy: Math.round(run.energy),
    boosting: run.boosting,
  };
}

export function getState(run) {
  return {
    phase: run.phase,
    time: run.time,
    stage: run.stage,
    score: run.score,
    length: run.snake.length,
    combo: run.combo,
    energy: Math.round(run.energy),
    boosting: run.boosting,
    dir: { ...run.dir },
    snake: run.snake.map((s) => ({ ...s })),
    food: run.food ? { ...run.food } : null,
    gold: run.gold ? { ...run.gold } : null,
    rocks: run.rocks.map((r) => ({ ...r })),
    cols: WORLD.COLS,
    rows: WORLD.ROWS,
  };
}

export function drainEvents(run) {
  const events = run.events;
  run.events = [];
  return events;
}

// ---------------------------------------------------------------- 内部

function emit(run, type, data) {
  run.events.push({ type, ...(data || {}), t: run.time });
}

function isBlocked(run, x, y) {
  if (x < 0 || y < 0 || x >= WORLD.COLS || y >= WORLD.ROWS) return true;
  if (run.rocks.some((r) => r.x === x && r.y === y)) return true;
  if (run.food && run.food.x === x && run.food.y === y) return true;
  if (run.gold && run.gold.x === x && run.gold.y === y) return true;
  for (let i = 0; i < run.snake.length; i += 1) {
    if (run.snake[i].x === x && run.snake[i].y === y) return true;
  }
  return false;
}

function randomEmptyCell(run) {
  // y 从 1 起：避开第 0 行（顶部 HUD 会遮挡）
  for (let a = 0; a < 300; a += 1) {
    const x = Math.floor(run.rng() * WORLD.COLS);
    const y = 1 + Math.floor(run.rng() * (WORLD.ROWS - 1));
    if (!isBlocked(run, x, y)) return { x, y };
  }
  for (let y = 1; y < WORLD.ROWS; y += 1) {
    for (let x = 0; x < WORLD.COLS; x += 1) {
      if (!isBlocked(run, x, y)) return { x, y };
    }
  }
  return null;
}

function spawnFood(run) {
  const cell = randomEmptyCell(run);
  if (cell) {
    run.food = cell;
    emit(run, 'foodSpawn', { x: cell.x, y: cell.y });
  }
}

function spawnGold(run) {
  const cell = randomEmptyCell(run);
  if (cell) {
    run.gold = cell;
    run.goldSpawnedAtMs = run.elapsedMs;
    emit(run, 'goldSpawn', { x: cell.x, y: cell.y });
  }
}

function spawnRocksForStage(run, stage) {
  const target = STAGES[stage - 1].rocks;
  let attempts = 0;
  while (run.rocks.length < target && attempts < 300) {
    attempts += 1;
    const cell = randomEmptyCell(run);
    if (!cell) break;
    // 别刷在蛇头下一格，避免开局被岩石贴脸。
    const head = run.snake[0];
    if (Math.abs(cell.x - head.x) + Math.abs(cell.y - head.y) < 3) continue;
    run.rocks.push(cell);
    emit(run, 'rockSpawn', { x: cell.x, y: cell.y });
  }
}

function queueDir(run, d) {
  const last = run.pending.length ? run.pending[run.pending.length - 1] : run.dir;
  if (!d || (d.x === 0 && d.y === 0)) return false;
  if (d.x === last.x && d.y === last.y) return false; // 同向
  if (d.x === -last.x && d.y === -last.y) return false; // 禁止 180° 掉头
  if (run.pending.length >= 2) return false;
  run.pending.push({ x: d.x, y: d.y });
  return true;
}

function moveIntervalMs(run) {
  let base = SNAKE.BASE_INTERVAL_MS;
  if (run.stage >= 3) base = SNAKE.STAGE3_INTERVAL_MS;
  else if (run.stage >= 2) base = SNAKE.STAGE2_INTERVAL_MS;
  if (run.boosting) base = Math.max(45, base * SNAKE.BOOST_FACTOR);
  return base;
}

function kill(run, reason) {
  if (run.phase !== 'playing') return;
  run.phase = 'lost';
  run.boosting = false;
  emit(run, 'death', { reason, score: run.score, length: run.snake.length });
}

function win(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'won';
  run.boosting = false;
  emit(run, 'win', { score: run.score, length: run.snake.length });
}

function doMove(run) {
  run.moves += 1;
  if (run.pending.length) run.dir = run.pending.shift();

  const head = run.snake[0];
  const nx = head.x + run.dir.x;
  const ny = head.y + run.dir.y;

  const willGrow =
    (run.food && nx === run.food.x && ny === run.food.y) ||
    (run.gold && nx === run.gold.x && ny === run.gold.y);

  // 撞墙
  if (nx < 0 || ny < 0 || nx >= WORLD.COLS || ny >= WORLD.ROWS) {
    kill(run, 'wall');
    return;
  }
  // 撞岩石
  if (run.rocks.some((r) => r.x === nx && r.y === ny)) {
    kill(run, 'rock');
    return;
  }
  // 撞自己（不吃时尾巴会挪走，故尾巴格安全；吃时尾巴不动，全段都要判）
  const bodyLimit = willGrow ? run.snake.length : run.snake.length - 1;
  for (let i = 0; i < bodyLimit; i += 1) {
    if (run.snake[i].x === nx && run.snake[i].y === ny) {
      kill(run, 'self');
      return;
    }
  }

  run.snake.unshift({ x: nx, y: ny });
  if (willGrow) {
    if (run.food && nx === run.food.x && ny === run.food.y) eatFood(run);
    else if (run.gold && nx === run.gold.x && ny === run.gold.y) eatGold(run);
  } else {
    run.snake.pop();
  }
}

function eatFood(run) {
  const now = run.elapsedMs;
  const combo = now - run.lastFoodAtMs <= FOOD.COMBO_WINDOW_MS ? run.combo + 1 : 1;
  run.combo = combo;
  run.lastFoodAtMs = now;
  const gain = FOOD.SCORE * combo;
  run.score += gain;
  run.foodEaten += 1;
  const fx = run.food.x;
  const fy = run.food.y;
  run.food = null;
  emit(run, 'food', { combo, gain, x: fx, y: fy });
  if (combo >= 2) emit(run, 'combo', { combo });
  spawnFood(run);
}

function eatGold(run) {
  const combo = run.combo > 0 ? run.combo : 1;
  const gain = FOOD.GOLD_SCORE * combo;
  run.score += gain;
  // 金色球：本身吃掉多 1 节（未弹尾），再额外补 GOLD_GROW 节。
  const tail = run.snake[run.snake.length - 1];
  for (let i = 0; i < FOOD.GOLD_GROW; i += 1) {
    run.snake.push({ x: tail.x, y: tail.y });
  }
  const fx = run.gold.x;
  const fy = run.gold.y;
  run.gold = null;
  run.lastGoldAtMs = run.elapsedMs;
  emit(run, 'goldEat', { gain, x: fx, y: fy });
}

function updateStage(run) {
  let stage = 1;
  if (run.time >= STAGES[2].atSec) stage = 3;
  else if (run.time >= STAGES[1].atSec) stage = 2;

  if (stage !== run.stage) {
    run.stage = stage;
    emit(run, 'stageUp', { stage });
    spawnRocksForStage(run, stage);
  }

  if (run.time >= RUN.TIME_LIMIT_SEC) {
    win(run);
  }
}

// ---------------------------------------------------------------- 步进

export function stepRun(run, input, dt) {
  const seconds = typeof dt === 'number' && Number.isFinite(dt) ? dt : 1 / 60;
  if (run.phase !== 'playing') {
    run.time += seconds;
    return run;
  }

  run.elapsedMs += seconds * 1000;
  run.time = run.elapsedMs / 1000;

  // 阶段推进（含 120s 结算）
  updateStage(run);
  if (run.phase !== 'playing') return run;

  // 冲刺状态
  const wantBoost = !!input?.boost && run.energy > 0;
  if (wantBoost && !run.boosting) {
    run.boosting = true;
    emit(run, 'boostStart', {});
  } else if (!wantBoost && run.boosting) {
    run.boosting = false;
    emit(run, 'boostEnd', {});
  }

  // 能量
  if (run.boosting) {
    run.energy -= SNAKE.ENERGY_DRAIN_PER_S * seconds;
    if (run.energy <= 0) {
      run.energy = 0;
      run.boosting = false;
      emit(run, 'boostEnd', {});
    }
  } else {
    run.energy = Math.min(SNAKE.ENERGY_MAX, run.energy + SNAKE.ENERGY_REGEN_PER_S * seconds);
  }

  // 第 3 段：金色球生成 / 过期
  if (run.stage >= 3) {
    if (!run.gold && run.elapsedMs - run.lastGoldAtMs >= FOOD.GOLD_INTERVAL_MS) spawnGold(run);
    if (run.gold && run.elapsedMs - run.goldSpawnedAtMs > FOOD.GOLD_LIFETIME_MS) run.gold = null;
  }

  // 方向输入
  if (input?.dir) queueDir(run, input.dir);

  // 步进累加器
  const interval = moveIntervalMs(run);
  run.moveAcc += seconds * 1000;
  let guard = 0;
  while (run.moveAcc >= interval && run.phase === 'playing' && guard < 8) {
    run.moveAcc -= interval;
    doMove(run);
    guard += 1;
  }
  if (run.moveAcc >= interval) run.moveAcc = 0;

  return run;
}

// 标准 run 接口别名（step/getHud/drainEvents），供 playbook 契约与 selfplay 复用。
export function decorateRun(run) {
  run.step = (input = {}) => stepRun(run, input, 1 / 60);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.getState = () => getState(run);
  return run;
}

export { DIRS, cellKey };
