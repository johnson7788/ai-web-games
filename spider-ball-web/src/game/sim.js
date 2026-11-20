// 纯逻辑 sim（无 DOM / 无 canvas）：瞄准 → 发球 → 弹跳 → 数字砖扣血碎裂 → 过关/失败。
// 固定步长驱动，全确定性（除 seed 随机），可被 node --test 与 tools/selfplay.mjs 直接驱动。
import { WORLD, GAME } from '../../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';

// 稳定的 mulberry32 PRNG（selfplay 复现用）
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

const POWER_TYPES = new Set(['addBall', 'laser', 'violet']);

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function makeBrick(type, col, row, hp) {
  return {
    id: `${col}-${row}-${type}`,
    type,
    col,
    row,
    x: WORLD.GRID_COL_X[col],
    y: WORLD.GRID_ROW_Y[row],
    r: WORLD.BRICK_R,
    hp: type === 'rock' ? Infinity : hp,
    maxHp: type === 'rock' ? Infinity : hp,
    alive: true,
    indestructible: type === 'rock',
    isPower: POWER_TYPES.has(type),
    rot: (col * 37 + row * 61) % 360, // 视觉旋转，无碰撞意义
  };
}

function aliveNormalBricks(s) {
  return s.bricks.filter((b) => b.alive && !b.indestructible);
}

function comboBonus(combo) {
  if (combo >= 9) return 3;
  if (combo >= 6) return 2;
  if (combo >= 3) return 1;
  return 0;
}

export function createRun(levelIndex = 0, opts = {}) {
  const seed = opts.seed == null ? 1 : opts.seed;
  const run = {
    _events: [],
    _rng: mulberry32(seed),
    state: null,
    step: null,
    shoot: null,
    drainEvents: null,
    getHud: null,
  };

  function emit(type, payload) {
    run._events.push({ type, ...(payload || {}) });
  }

  function loadLevel(idx) {
    const level = LEVELS[idx];
    const prevTime = run.state ? run.state.time : 0;
    run.state = {
      phase: 'aiming', // aiming | flying | levelWin | won | lost
      levelIndex: idx,
      level: idx + 1,
      levelCount: LEVEL_COUNT,
      levelName: level.name,
      shotsLeft: level.shots,
      totalShots: level.shots,
      score: 0,
      hits: 0,
      combo: 0,
      bestCombo: 0,
      starsByLevel: {},
      totalStars: 0,
      bricks: level.bricks.map((b) => makeBrick(b[0], b[1], b[2], b[3])),
      ball: null,
      aimAngle: 0,
      time: prevTime,
      autoTimer: GAME.autoLaunchDelay,
      advanceTimer: 0,
      shotsFired: 0,
    };
    emit('levelStart', { level: idx + 1 });
  }

  function shoot(angle) {
    const s = run.state;
    if (s.phase !== 'aiming') return { ok: false };
    if (s.shotsLeft <= 0) return { ok: false };
    const a = clamp(angle, -GAME.maxAngle, GAME.maxAngle);
    s.shotsLeft -= 1;
    s.shotsFired += 1;
    s.aimAngle = a;
    s.combo = 0;
    s.phase = 'flying';
    s.ball = {
      x: WORLD.LAUNCH_X,
      y: WORLD.LAUNCH_Y,
      vx: Math.sin(a) * GAME.shootSpeed,
      vy: -Math.cos(a) * GAME.shootSpeed,
      flightT: 0,
      caught: false,
    };
    emit('shot', { angle: a });
    return { ok: true };
  }

  function hitBrick(brick) {
    const s = run.state;
    if (brick.indestructible) {
      emit('rockHit', { x: brick.x, y: brick.y });
      return;
    }
    if (brick.isPower) {
      brick.alive = false;
      brick.hp = 0;
      emit('powerUp', { type: brick.type, x: brick.x, y: brick.y });
      applyPower(brick);
      return;
    }
    brick.hp -= 1;
    s.hits += 1;
    s.combo += 1;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.score += 1 + comboBonus(s.combo);
    if (GAME.comboMilestones.includes(s.combo)) emit('combo', { combo: s.combo });
    if (brick.hp <= 0) {
      brick.alive = false;
      emit('brickBreak', { type: brick.type, x: brick.x, y: brick.y });
    } else {
      emit('brickHit', { type: brick.type, x: brick.x, y: brick.y });
    }
  }

  function destroyBrick(brick) {
    if (!brick.alive || brick.indestructible) return 0;
    brick.alive = false;
    brick.hp = 0;
    s_score_add(1);
    emit('brickBreak', { type: brick.type, x: brick.x, y: brick.y });
    return 1;
  }

  function s_score_add(n) {
    const s = run.state;
    s.score += n;
    s.hits += n;
  }

  function applyPower(brick) {
    const s = run.state;
    if (brick.type === 'addBall') {
      s.shotsLeft += 1;
      s.totalShots += 1;
      emit('addBall', {});
    } else if (brick.type === 'laser') {
      for (const b of s.bricks) {
        if (b.alive && !b.indestructible && b.col === brick.col) destroyBrick(b);
      }
      emit('laser', {});
    } else if (brick.type === 'violet') {
      for (const b of s.bricks) {
        if (b.alive && !b.indestructible && Math.abs(b.col - brick.col) <= 1 && Math.abs(b.row - brick.row) <= 1) {
          destroyBrick(b);
        }
      }
      emit('violet', {});
    }
  }

  function stepBall(ball, dt) {
    const s = run.state;
    ball.flightT += dt;
    ball.vy += GAME.gravity * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // 左右墙
    if (ball.x - WORLD.BALL_R < WORLD.WALL_L) {
      ball.x = WORLD.WALL_L + WORLD.BALL_R;
      if (ball.vx < 0) ball.vx = -ball.vx;
      emit('wallBounce', {});
    } else if (ball.x + WORLD.BALL_R > WORLD.WALL_R) {
      ball.x = WORLD.WALL_R - WORLD.BALL_R;
      if (ball.vx > 0) ball.vx = -ball.vx;
      emit('wallBounce', {});
    }

    // 地面：强制向上弹，保证总能爬回顶部
    if (ball.y + WORLD.BALL_R > WORLD.FLOOR_Y) {
      ball.y = WORLD.FLOOR_Y - WORLD.BALL_R;
      if (ball.vy > 0) {
        ball.vy = -Math.max(GAME.floorBounceVy, Math.abs(ball.vy) * 0.9);
        ball.vx *= GAME.wallRestitution;
        if (Math.abs(ball.vx) < 120) ball.vx = (ball.vx >= 0 ? 1 : -1) * 120;
        emit('floorBounce', {});
      }
    }

    // 顶部回收
    if (ball.y < WORLD.TOP_Y) {
      ball.caught = true;
      emit('ballCaught', {});
      return;
    }

    // 砖块碰撞（圆-圆）
    for (const brick of s.bricks) {
      if (!brick.alive) continue;
      const dx = ball.x - brick.x;
      const dy = ball.y - brick.y;
      const dist = Math.hypot(dx, dy);
      const minDist = WORLD.BALL_R + brick.r;
      if (dist < minDist && dist > 0.0001) {
        const nx = dx / dist;
        const ny = dy / dist;
        ball.x = brick.x + nx * minDist;
        ball.y = brick.y + ny * minDist;
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          ball.vx -= 2 * dot * nx;
          ball.vy -= 2 * dot * ny;
        }
        const sp = Math.hypot(ball.vx, ball.vy);
        if (sp < GAME.minSpeed) {
          const k = GAME.minSpeed / Math.max(0.001, sp);
          ball.vx *= k;
          ball.vy *= k;
        } else {
          ball.vx *= 1.01;
          ball.vy *= 1.01;
        }
        hitBrick(brick);
        break; // 每步每球只结算一次碰撞
      }
    }

    // 防卡死：低速飞行过久则轻推
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp < 80 && ball.flightT > 0.4) {
      ball.vy = -Math.max(420, Math.abs(ball.vy));
      if (Math.abs(ball.vx) < 60) ball.vx = 120;
    }
    // 超时强制回收
    if (ball.flightT > GAME.maxFlightTime) {
      ball.caught = true;
      emit('ballCaught', {});
    }
  }

  function winLevel() {
    const s = run.state;
    if (s.phase === 'won') return;
    const stars = s.shotsLeft >= 3 ? 3 : s.shotsLeft >= 1 ? 2 : 1;
    s.starsByLevel[s.level] = stars;
    s.totalStars += stars;
    emit('levelWin', { level: s.level, stars });
    if (s.levelIndex + 1 >= LEVEL_COUNT) {
      s.phase = 'won';
      emit('win', { stars: s.totalStars, score: s.score });
    } else {
      s.phase = 'levelWin';
      s.advanceTimer = GAME.levelAdvanceDelay;
    }
  }

  function loseLevel() {
    const s = run.state;
    if (s.phase === 'lost') return;
    s.phase = 'lost';
    emit('lose', { level: s.level, score: s.score, stars: s.totalStars });
  }

  function afterBallCaught() {
    const s = run.state;
    s.combo = 0;
    s.ball = null;
    if (aliveNormalBricks(s).length === 0) {
      winLevel();
      return;
    }
    if (s.shotsLeft <= 0) {
      loseLevel();
      return;
    }
    s.phase = 'aiming';
    s.autoTimer = GAME.autoLaunchDelay;
    emit('readyShoot', {});
  }

  function step(dt) {
    const s = run.state;
    s.time += dt;

    if (s.phase === 'aiming') {
      s.autoTimer -= dt;
      if (s.autoTimer <= 0) {
        // 兜底：空闲自动直线发射（真实玩家不会干等；noinput 策略因此必然消耗球数并失败）
        shoot(0);
      }
      return;
    }

    if (s.phase === 'flying') {
      if (s.ball) {
        stepBall(s.ball, dt);
        if (s.ball.caught) afterBallCaught();
      }
      return;
    }

    if (s.phase === 'levelWin') {
      s.advanceTimer -= dt;
      if (s.advanceTimer <= 0) loadLevel(s.levelIndex + 1);
      return;
    }

    // won / lost 终态：不再推进
  }

  function getHud() {
    const s = run.state;
    return {
      phase: s.phase,
      level: s.level,
      levelCount: s.levelCount,
      levelName: s.levelName,
      shotsLeft: s.shotsLeft,
      totalShots: s.totalShots,
      score: s.score,
      combo: s.combo,
      bestCombo: s.bestCombo,
      totalStars: s.totalStars,
      bricksLeft: aliveNormalBricks(s).length,
    };
  }

  run.step = step;
  run.shoot = shoot;
  run.drainEvents = () => {
    const e = run._events;
    run._events = [];
    return e;
  };
  run.getHud = getHud;

  loadLevel(Math.min(levelIndex, LEVEL_COUNT - 1));
  return run;
}

// 供 selfplay / 调试：瞄准某块砖（含重力补偿），返回弧度角。
// 用牛顿迭代把「到达目标高度时的水平落点」收敛到目标 x，消除重力曲线造成的偏移。
export function aimAt(launchX, launchY, tx, ty) {
  const dx = tx - launchX;
  const dy = launchY - ty; // >0（目标在上方）
  if (dy <= 0) return 0;
  let angle = Math.atan2(dx, dy);
  for (let i = 0; i < 4; i += 1) {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const vx = GAME.shootSpeed * sin;
    const vy0 = -GAME.shootSpeed * cos;
    const a = 0.5 * GAME.gravity;
    const c = launchY - ty; // 目标在上方，c>0
    const disc = vy0 * vy0 - 4 * a * c;
    if (disc < 0) break;
    const t = (-vy0 - Math.sqrt(disc)) / (2 * a);
    const xAt = launchX + vx * t;
    const err = xAt - tx;
    const dxd = t * GAME.shootSpeed * cos;
    angle -= err / Math.max(0.0001, dxd);
  }
  return clamp(angle, -GAME.maxAngle, GAME.maxAngle);
}

export { LEVELS, LEVEL_COUNT };
