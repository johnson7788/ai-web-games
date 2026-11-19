// 纯逻辑：霓虹光点无人机的一键飞行（无 DOM，Node 可测 / selfplay 可直接驱动）
// 玩法骨架 1:1 还原参考源码（拍翼升力 + 重力下坠 + 左移管道 + 过管得分 + 撞管/落地/出顶死亡），
// 再叠加原创机制：能量光珠（收集物 + 护盾）、擦边连击、星级结算、速度阶梯。
import {
  WORLD, STEP, BIRD, PIPE, ORB, SHIELD, NEAR, STARS, LEVELS,
} from '../../config/game.config.js';

// 可复现随机数（seed 驱动；selfplay / 测试用）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

function levelForScore(score) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (score >= LEVELS[i].score) idx = i;
  }
  return idx; // 0-based
}

function starsForScore(score) {
  let s = STARS[0];
  for (const tier of STARS) {
    if (score >= tier.min) s = tier;
  }
  return s;
}

function spawnPipe(state, rng, x) {
  const gapH = state.gapH;
  const minY = gapH / 2 + 34;
  const maxY = WORLD.GROUND_Y - gapH / 2 - 40;
  const gapY = minY + rng() * (maxY - minY);
  const orbActive = rng() < ORB.CHANCE;
  const off = (rng() < 0.5 ? -1 : 1) * gapH * ORB.OFFSET;
  const orbY = clamp(gapY + off, gapY - gapH * 0.4, gapY + gapH * 0.4);
  state.pipes.push({
    x,
    gapY,
    gapH,
    scored: false,
    orbActive,
    orbTaken: false,
    orbX: x,
    orbY,
  });
}

export function createRun(opts = {}) {
  const seed = opts.seed == null ? (Date.now() % 2147483647) : opts.seed;
  const rng = mulberry32(seed);
  const best = (opts.best | 0) || 0;

  const state = {
    phase: 'ready',          // ready | playing | dead
    score: 0,
    best,
    newBest: false,
    combo: 1,
    nearMisses: 0,
    orbs: 0,
    shield: 0,
    invuln: 0,
    bird: { x: BIRD.X, y: WORLD.HEIGHT * 0.42, vy: 0, rot: 0 },
    pipes: [],
    time: 0,
    dist: 0,
    speed: PIPE.BASE_SPEED,
    gapH: PIPE.BASE_GAP,
    level: 1,                // 1-based tier
    reason: null,
    stars: 0,
  };

  for (let i = 0; i < 3; i += 1) {
    spawnPipe(state, rng, PIPE.FIRST_X + i * PIPE.SPACING);
  }

  const events = [];

  function emit(type, payload = {}) {
    events.push({ type, ...payload });
  }

  function die(reason) {
    if (state.phase !== 'playing') return;
    state.phase = 'dead';
    state.reason = reason;
    state.stars = starsForScore(state.score).count;
    if (state.score > state.best) {
      state.newBest = true;
      emit('best', { score: state.score, previous: state.best });
    }
    emit('lose', { reason, score: state.score, stars: state.stars, newBest: state.newBest });
  }

  function collectOrb(pipe) {
    pipe.orbTaken = true;
    state.orbs += 1;
    state.score += ORB.SCORE;
    if (state.shield < SHIELD.MAX) {
      state.shield += 1;
      emit('shieldGain', { shield: state.shield });
    }
    emit('orb', { score: state.score, shield: state.shield });
  }

  function updateDifficulty() {
    const idx = levelForScore(state.score);
    const lv = idx + 1;
    if (lv !== state.level) {
      state.level = lv;
      state.speed = LEVELS[idx].speed;
      state.gapH = LEVELS[idx].gap;
      emit('levelUp', { level: lv, speed: state.speed, gap: state.gapH });
    }
  }

  function start() {
    if (state.phase !== 'ready') return { ok: false };
    state.phase = 'playing';
    emit('start', {});
    return { ok: true };
  }

  function flap() {
    if (state.phase !== 'playing') return { ok: false };
    state.bird.vy = BIRD.FLAP_VY;
    state.bird.rot = -0.5;
    emit('flap', {});
    return { ok: true };
  }

  function step(dt) {
    if (state.phase === 'ready') {
      state.time += dt;
      return;
    }
    if (state.phase === 'dead') return;

    state.time += dt;
    state.dist += state.speed * dt;

    updateDifficulty();

    // 小鸟物理
    const b = state.bird;
    b.vy = clamp(b.vy + BIRD.GRAVITY * dt, BIRD.FLAP_VY * 2, BIRD.MAX_FALL);
    b.y += b.vy * dt;
    b.rot = clamp(b.vy / 620, -0.5, 1.15);

    // 天花板 / 地面
    if (b.y - BIRD.R <= WORLD.CEIL) {
      b.y = BIRD.R;
      die('ceiling');
      return;
    }
    if (b.y + BIRD.R >= WORLD.GROUND_Y) {
      b.y = WORLD.GROUND_Y - BIRD.R;
      b.vy = 0;
      die('ground');
      return;
    }

    if (state.invuln > 0) state.invuln = Math.max(0, state.invuln - dt);

    // 管道移动 + 收集 + 得分 + 碰撞
    for (const pipe of state.pipes) {
      pipe.x -= state.speed * dt;
      pipe.orbX = pipe.x;

      // 光珠收集
      if (pipe.orbActive && !pipe.orbTaken) {
        const dx = b.x - pipe.orbX;
        const dy = b.y - pipe.orbY;
        if (dx * dx + dy * dy <= (BIRD.R + ORB.R) * (BIRD.R + ORB.R)) {
          collectOrb(pipe);
        }
      }

      // 过管得分（管道 x 越过小鸟 x）
      if (!pipe.scored && b.x > pipe.x) {
        pipe.scored = true;
        const gapTop = pipe.gapY - pipe.gapH / 2;
        const gapBottom = pipe.gapY + pipe.gapH / 2;
        const near = (b.y - BIRD.R) < gapTop + NEAR.MARGIN
          || (b.y + BIRD.R) > gapBottom - NEAR.MARGIN;
        if (near) {
          state.combo = Math.min(state.combo + 1, NEAR.MAX_COMBO);
          state.nearMisses += 1;
          state.score += state.combo;
          emit('nearMiss', { combo: state.combo, score: state.score });
        } else {
          state.score += state.combo;
          state.combo = 1;
          emit('score', { score: state.score, combo: state.combo });
        }
        updateDifficulty();
      }

      // 碰撞（无敌期间不判）
      if (state.invuln <= 0) {
        const topH = pipe.gapY - pipe.gapH / 2;
        const botY = pipe.gapY + pipe.gapH / 2;
        const hitTop = circleRect(b.x, b.y, BIRD.R, pipe.x - PIPE.WIDTH / 2, WORLD.CEIL, PIPE.WIDTH, topH);
        const hitBot = circleRect(b.x, b.y, BIRD.R, pipe.x - PIPE.WIDTH / 2, botY, PIPE.WIDTH, WORLD.GROUND_Y - botY);
        if (hitTop || hitBot) {
          if (state.shield > 0) {
            state.shield -= 1;
            state.invuln = SHIELD.INVULN;
            emit('shieldBreak', { shield: state.shield });
          } else {
            die('pipe');
            return;
          }
        }
      }
    }

    // 回收出屏管道 + 持续生成（保持相邻管道间距 SPACING）
    state.pipes = state.pipes.filter((p) => p.x + PIPE.WIDTH / 2 > -60);
    while (
      state.pipes.length === 0
      || state.pipes[state.pipes.length - 1].x <= WORLD.WIDTH - PIPE.SPACING
    ) {
      const last = state.pipes[state.pipes.length - 1];
      spawnPipe(state, rng, last ? last.x + PIPE.SPACING : PIPE.FIRST_X);
    }
  }

  function drainEvents() {
    return events.splice(0, events.length);
  }

  function getHud() {
    return {
      score: state.score,
      best: Math.max(state.best, state.score),
      combo: state.combo,
      shield: state.shield,
      level: state.level,
    };
  }

  return {
    state,
    start,
    flap,
    step,
    drainEvents,
    getHud,
    die,
  };
}
