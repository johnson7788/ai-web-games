// MINI PINBALL · 纯逻辑模拟（无 DOM / 无渲染）。
// 玩法骨架来自参考源码《小小弹球》：拖拽发射 → 弹性反弹球 → 打破方块 → 清空过关。
// 换皮 + 新机制：连击倍率 / 星级评定（按发射数）/ 橡皮细条掉落加分光球 / 圆形挡板弹射链。
// 数值：无生命上限，落空只损失一次发射并清零连击，方块进度保留（更友好的现代处理，见交付报告）。
import { WORLD, STEP, BALL, ARENA, SCORING, LAUNCH } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';

// 固定种子 PRNG（selfplay 的 random 策略用）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cloneBlocks(blocks) {
  return blocks.map((b) => {
    const c = { ...b };
    c.pulse = 0;
    c.alive = true;
    return c;
  });
}

export function createState(levelIndex) {
  const level = LEVELS[levelIndex] || LEVELS[0];
  return {
    levelIndex,
    level,
    phase: 'aiming', // aiming | flying | won
    ball: {
      x: BALL.LAUNCH_X,
      y: BALL.LAUNCH_Y,
      vx: 0,
      vy: 0,
      active: false,
    },
    blocks: cloneBlocks(level.blocks),
    orbs: [],          // { x, y, alive }
    score: 0,
    combo: 0,
    launches: 0,
    misses: 0,
    time: 0,
    flightT: 0,
    events: [],
  };
}

export function cloneState(state) {
  return {
    ...state,
    ball: { ...state.ball },
    blocks: state.blocks.map((b) => ({ ...b })),
    orbs: state.orbs.map((o) => ({ ...o })),
    events: state.events.slice(),
  };
}

function emit(state, type, payload = {}) {
  state.events.push({ type, ...payload });
}

export function breakables(state) {
  return state.blocks.filter((b) => b.alive && (b.type === 'brick' || b.type === 'rubber'));
}

export function isCleared(state) {
  return breakables(state).length === 0;
}

export function resetBall(state) {
  const b = state.ball;
  b.x = BALL.LAUNCH_X;
  b.y = BALL.LAUNCH_Y;
  b.vx = 0;
  b.vy = 0;
  b.active = false;
}

export function launchBall(state, angle) {
  if (state.phase !== 'aiming') return false;
  const b = state.ball;
  b.active = true;
  b.x = BALL.LAUNCH_X;
  b.y = BALL.LAUNCH_Y;
  b.vx = Math.cos(angle) * BALL.LAUNCH_SPEED;
  b.vy = Math.sin(angle) * BALL.LAUNCH_SPEED;
  state.phase = 'flying';
  state.launches += 1;
  state.combo = 0;
  state.flightT = 0;
  emit(state, 'launch', { angle });
  return true;
}

function comboMult(state) {
  return Math.min(state.combo, SCORING.MAX_COMBO);
}

function reflectVelocity(b, nx, ny) {
  const vn = b.vx * nx + b.vy * ny;
  b.vx -= 2 * vn * nx;
  b.vy -= 2 * vn * ny;
}

function handleExit(state) {
  if (isCleared(state)) {
    state.phase = 'won';
    const stars = state.launches <= SCORING.STAR_LAUNCHES_3 ? 3 : state.launches <= SCORING.STAR_LAUNCHES_2 ? 2 : 1;
    emit(state, 'win', { stars, score: state.score, launches: state.launches, level: state.levelIndex });
    emit(state, 'stars', { stars });
    return;
  }
  state.misses += 1;
  state.combo = 0;
  emit(state, 'lose', { reason: 'ballExit', misses: state.misses });
  resetBall(state);
  state.phase = 'aiming';
}

function collideRect(state, block) {
  const b = state.ball;
  const R = BALL.RADIUS;
  const halfW = block.w / 2;
  const halfH = block.h / 2;
  const closestX = Math.max(block.x - halfW, Math.min(b.x, block.x + halfW));
  const closestY = Math.max(block.y - halfH, Math.min(b.y, block.y + halfH));
  const dx = b.x - closestX;
  const dy = b.y - closestY;
  const d2 = dx * dx + dy * dy;
  if (d2 >= R * R) return false;

  let nx;
  let ny;
  if (d2 < 1e-6) {
    // 球心在矩形内部：选最小穿透轴推出
    const left = b.x - (block.x - halfW);
    const right = (block.x + halfW) - b.x;
    const top = b.y - (block.y - halfH);
    const bottom = (block.y + halfH) - b.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) { nx = -1; ny = 0; b.x = block.x - halfW - R; }
    else if (m === right) { nx = 1; ny = 0; b.x = block.x + halfW + R; }
    else if (m === top) { nx = 0; ny = -1; b.y = block.y - halfH - R; }
    else { nx = 0; ny = 1; b.y = block.y + halfH + R; }
  } else {
    const d = Math.sqrt(d2);
    nx = dx / d;
    ny = dy / d;
    b.x = closestX + nx * (R + 0.5);
    b.y = closestY + ny * (R + 0.5);
  }
  reflectVelocity(b, nx, ny);
  return true;
}

function collideBumper(state, block) {
  const b = state.ball;
  const R = BALL.RADIUS;
  const dx = b.x - block.x;
  const dy = b.y - block.y;
  const rr = R + block.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return false;
  const d = Math.sqrt(d2) || 0.001;
  const nx = dx / d;
  const ny = dy / d;
  b.x = block.x + nx * (rr + 0.5);
  b.y = block.y + ny * (rr + 0.5);
  reflectVelocity(b, nx, ny);
  block.pulse = 1;
  return true;
}

function stepPhysics(state, dt) {
  const b = state.ball;
  const speed = Math.hypot(b.vx, b.vy);
  const substeps = Math.max(1, Math.min(20, Math.ceil((speed * dt) / 5)));
  const subdt = dt / substeps;

  for (let s = 0; s < substeps; s += 1) {
    b.vy += BALL.GRAVITY * subdt;
    b.x += b.vx * subdt;
    b.y += b.vy * subdt;

    // 墙面（左/右/上反弹，底部开口）
    if (b.x - BALL.RADIUS < 0) { b.x = BALL.RADIUS; b.vx = Math.abs(b.vx); emit(state, 'wall', { side: 'left' }); }
    else if (b.x + BALL.RADIUS > WORLD.WIDTH) { b.x = WORLD.WIDTH - BALL.RADIUS; b.vx = -Math.abs(b.vx); emit(state, 'wall', { side: 'right' }); }
    if (b.y - BALL.RADIUS < 0) { b.y = BALL.RADIUS; b.vy = Math.abs(b.vy); emit(state, 'wall', { side: 'top' }); }

    // 方块 / 挡板
    for (const block of state.blocks) {
      if (!block.alive) continue;
      if (block.type === 'bumper') {
        if (collideBumper(state, block)) {
          state.score += SCORING.BUMPER;
          emit(state, 'bumper', { x: block.x, y: block.y });
        }
        continue;
      }
      if (collideRect(state, block)) {
        block.alive = false;
        state.combo += 1;
        const mult = comboMult(state);
        const base = block.type === 'rubber' ? SCORING.RUBBER : SCORING.BRICK;
        state.score += base * mult;
        emit(state, block.type === 'rubber' ? 'rubber' : 'hit', {
          x: block.x,
          y: block.y,
          combo: state.combo,
          mult,
          score: base * mult,
        });
        if (state.combo >= 3) emit(state, 'combo', { combo: state.combo });
        if (block.type === 'rubber') {
          state.orbs.push({ x: block.x, y: block.y, alive: true });
        }
      }
    }

    // 加分光球
    for (const orb of state.orbs) {
      if (!orb.alive) continue;
      const dx = b.x - orb.x;
      const dy = b.y - orb.y;
      const rr = BALL.RADIUS + 16;
      if (dx * dx + dy * dy < rr * rr) {
        orb.alive = false;
        state.score += SCORING.ORB;
        emit(state, 'orb', { x: orb.x, y: orb.y, score: SCORING.ORB });
      }
    }

    // 出底
    if (b.y - BALL.RADIUS > WORLD.HEIGHT) {
      handleExit(state);
      return;
    }
  }
}

export function stepState(state, dt) {
  state.time += dt;
  if (state.phase === 'flying') {
    state.flightT += dt;
    stepPhysics(state, dt);
    // 单球飞行过久：兜底强制落底（不破坏方块进度，计一次落空）
    if (state.phase === 'flying' && state.flightT > BALL.MAX_FLIGHT_SEC) {
      state.misses += 1;
      state.combo = 0;
      emit(state, 'lose', { reason: 'timeout', misses: state.misses });
      resetBall(state);
      state.phase = 'aiming';
    }
  }
}

export function drainEvents(state) {
  const ev = state.events;
  state.events = [];
  return ev;
}

export function getHud(state) {
  return {
    level: state.levelIndex + 1,
    phase: state.phase,
    score: state.score,
    combo: state.combo,
    mult: comboMult(state),
    launches: state.launches,
    misses: state.misses,
    breakables: breakables(state).length,
  };
}

export function createRun(levelIndex, opts = {}) {
  const seed = opts.seed == null ? 1 : opts.seed;
  const state = createState(levelIndex);
  return {
    state,
    seed,
    step(dt) { stepState(state, dt); },
    drainEvents() { return drainEvents(state); },
    launch(angle) { return launchBall(state, angle); },
    getHud() { return getHud(state); },
  };
}

// 供 selfplay 搜索：在给定角度上试射一个克隆，返回「破坏数 / 是否过关」
export function trialLaunch(state, angle) {
  const st = cloneState(state);
  if (st.phase !== 'aiming') return { destroyed: 0, cleared: false };
  launchBall(st, angle);
  const before = breakables(st).length;
  const guard = Math.ceil(BALL.MAX_FLIGHT_SEC / STEP);
  let i = 0;
  while (st.phase === 'flying' && i++ < guard) stepState(st, STEP);
  const after = breakables(st).length;
  return { destroyed: before - after, cleared: st.phase === 'won' };
}
