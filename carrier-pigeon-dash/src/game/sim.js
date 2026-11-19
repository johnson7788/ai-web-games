// Carrier Pigeon Dash · 模拟层（纯逻辑，零 DOM / window / canvas / Date.now）
// 玩法骨架 1:1 取自信鸽快飞（Flappy 变体）：重力 + 振翅爬升 + 塔阵自右向左 + 过塔得分 + 撞塔/地面死亡。
// 换皮改造：霓虹中继塔（原管道）、邮件信封（收集物）、连击里程碑、漂浮岩石、星级结算、难度分区。
// 随机：注入 seed 的 mulberry32，可复现。

import {
  WORLD, PLAYER, TOWER, LEVELS, COMBO_STEPS, MAIL_PER_DELIVERY, DELIVERY_BONUS,
  ROCK, TOKEN, NEARMISS_CLEARANCE, STAR_THRESHOLDS,
} from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AUTO_START_SEC = 3; // ready 态 3s 无输入自动起飞（保证 noinput 会死亡）
const READY_BASE = 320;

export function levelForScore(score) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (score >= LEVELS[i].threshold) idx = i;
  }
  return idx;
}

export function starsForScore(score) {
  let s = 0;
  for (const t of STAR_THRESHOLDS) if (score >= t) s += 1;
  return s;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function createRun(opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    phase: 'ready',      // 'ready' | 'playing' | 'dead'
    score: 0,
    best: (opts.best ?? 0) | 0,
    level: 1,            // 1 基（区域）
    levelIndex: 0,
    combo: 0,
    maxCombo: 0,
    mail: 0,
    deliveries: 0,
    time: 0,
    distance: 0,
    deaths: 0,
  };

  const bird = { y: READY_BASE, vy: 0 };

  const run = {
    state,
    bird,
    towers: [],
    rocks: [],
    _events: [],
    _rng: rng,
    _readyTime: 0,
    _nextDist: 0,
    _lastGapY: null,
    _towersSinceRock: 0,
    _bestEmitted: false,

    levelConfig() {
      return LEVELS[state.levelIndex] || LEVELS[0];
    },

    start() {
      if (state.phase !== 'ready') return { ok: false };
      state.phase = 'playing';
      emit(run, 'start', {});
      return { ok: true };
    },

    flap() {
      if (state.phase === 'ready') run.start();
      if (state.phase !== 'playing') return { ok: false };
      bird.vy = PLAYER.FLAP_VY;
      emit(run, 'flap', { y: bird.y });
      return { ok: true };
    },

    // 供测试 / 自对弈兜底：直接判死
    die(reason = 'force') {
      doDie(run, reason);
    },

    step(dt) {
      if (state.phase === 'dead') return;

      if (state.phase === 'ready') {
        run._readyTime += dt;
        bird.y = READY_BASE + Math.sin(run._readyTime * 4) * 8;
        if (run._readyTime >= AUTO_START_SEC) run.start();
        return;
      }

      // ---- playing ----
      const cfg = run.levelConfig();
      const speed = cfg.speed;
      state.time += dt;
      state.distance += speed * dt;

      // 信鸽物理
      bird.vy = Math.min(PLAYER.MAX_FALL, bird.vy + PLAYER.GRAVITY * dt);
      bird.y += bird.vy * dt;
      if (bird.y < PLAYER.TOP_CLAMP) {
        bird.y = PLAYER.TOP_CLAMP;
        bird.vy = Math.max(bird.vy, 0);
      }

      // 世界滚动
      for (const t of run.towers) t.x -= speed * dt;
      for (const r of run.rocks) {
        r.x -= speed * dt;
        r.y = r.baseY + Math.sin(state.time * ROCK.DRIFT_FREQ + r.phase) * ROCK.DRIFT_AMP;
      }

      // 生成塔 / 岩石 / 信封
      spawnWorld(run);

      // 碰撞
      if (bird.y + PLAYER.R >= WORLD.GROUND_Y) { doDie(run, 'ground'); return; }
      if (hitTower(run) || hitRock(run)) return; // doDie 内部处理

      // 得分 / 收集
      scorePassed(run);

      // 清理越界
      run.towers = run.towers.filter((t) => t.x + TOWER.W > -40);
      run.rocks = run.rocks.filter((r) => r.x + ROCK.R > -40);
    },

    drainEvents() {
      const ev = run._events;
      run._events = [];
      return ev;
    },

    getHud() {
      return {
        score: state.score,
        best: state.best,
        level: state.level,
        levelIndex: state.levelIndex,
        combo: state.combo,
        mail: state.mail,
        deliveries: state.deliveries,
        time: state.time,
      };
    },
  };

  return run;
}

function emit(run, type, payload = {}) {
  run._events.push({ type, ...payload });
}

function levelIndexForScore(score) {
  return levelForScore(score);
}

function updateLevel(run) {
  const idx = levelIndexForScore(run.state.score);
  if (idx !== run.state.levelIndex) {
    run.state.levelIndex = idx;
    run.state.level = idx + 1;
    emit(run, 'levelup', { level: run.state.level });
  }
}

function spawnWorld(run) {
  const gap = run.levelConfig().gap;
  // 以飞行距离推进塔生成：固定 300px 间距，塔从右缘进入
  while (run._nextDist <= run.state.distance) {
    spawnTower(run, WORLD.WIDTH + 60, gap);
    run._nextDist += TOWER.SPACING;
  }
}

function spawnTower(run, x, gap) {
  const topMin = TOWER.TOP_MARGIN + gap / 2;
  const bottomMax = WORLD.GROUND_Y - TOWER.BOTTOM_MARGIN - gap / 2;
  let gapY;
  if (run._lastGapY == null) {
    gapY = topMin + run._rng() * (bottomMax - topMin);
  } else {
    gapY = clamp(run._lastGapY + (run._rng() * 2 - 1) * TOWER.MAX_GAP_DELTA, topMin, bottomMax);
  }
  run._lastGapY = gapY;
  const tower = { x, gapY, gap, passed: false, token: null };
  run.towers.push(tower);
  emit(run, 'tower', { x, gapY });

  // 新机制 1：缺口中心概率出现信封（穿过缺口即送达）
  if (run._rng() < TOKEN.PROB) {
    tower.token = { y: gapY, collected: false };
  }

  // 新机制 2：岩石（区域 4 起，每 N 塔一块）
  run._towersSinceRock += 1;
  if (run.state.level >= ROCK.FROM_LEVEL && run._towersSinceRock >= ROCK.EVERY) {
    run._towersSinceRock = 0;
    spawnRock(run, x - 200);
  }
}

function spawnRock(run, x) {
  const baseY = 140 + run._rng() * (WORLD.GROUND_Y - 240);
  run.rocks.push({ x, baseY, y: baseY, phase: run._rng() * Math.PI * 2, r: ROCK.R });
  emit(run, 'rock', { x });
}

function hitTower(run) {
  const b = run.bird;
  const bx = PLAYER.X;
  for (const t of run.towers) {
    if (t.passed) continue;
    const horizOverlap = bx + PLAYER.R > t.x && bx - PLAYER.R < t.x + TOWER.W;
    if (!horizOverlap) continue;
    const topHit = b.y - PLAYER.R < t.gapY - t.gap / 2;
    const bottomHit = b.y + PLAYER.R > t.gapY + t.gap / 2;
    if (topHit || bottomHit) {
      doDie(run, 'tower');
      return true;
    }
  }
  return false;
}

function hitRock(run) {
  const b = run.bird;
  for (const r of run.rocks) {
    const dx = PLAYER.X - r.x;
    const dy = b.y - r.y;
    const rr = PLAYER.R + r.r;
    if (dx * dx + dy * dy < rr * rr) {
      doDie(run, 'rock');
      return true;
    }
  }
  return false;
}

function scorePassed(run) {
  const b = run.bird;
  for (const t of run.towers) {
    if (t.passed) continue;
    if (t.x + TOWER.W < PLAYER.X - PLAYER.R) {
      t.passed = true;
      run.state.score += 1;
      run.state.combo += 1;
      run.state.maxCombo = Math.max(run.state.maxCombo, run.state.combo);

      // 新机制 3：差一点（near-miss）判定
      const clearance = Math.min(
        b.y - (t.gapY - t.gap / 2),
        (t.gapY + t.gap / 2) - b.y,
      );
      if (clearance < NEARMISS_CLEARANCE) emit(run, 'nearmiss', { clearance: Math.max(0, Math.round(clearance)) });

      // 连击里程碑 +1
      if (COMBO_STEPS.includes(run.state.combo)) {
        run.state.score += 1;
        emit(run, 'combo', { combo: run.state.combo });
      }

      // 新机制 1：穿过带信封的缺口 = 送达一封信
      if (t.token && !t.token.collected) {
        t.token.collected = true;
        run.state.mail += 1;
        emit(run, 'collect', { mail: run.state.mail });
        if (run.state.mail % MAIL_PER_DELIVERY === 0) {
          run.state.deliveries += 1;
          run.state.score += DELIVERY_BONUS;
          emit(run, 'delivery', { deliveries: run.state.deliveries });
        }
      }

      emit(run, 'score', { score: run.state.score, combo: run.state.combo });
      updateLevel(run);
      if (run.state.score > run.state.best) run.state.best = run.state.score;
    }
  }
}

function doDie(run, reason) {
  if (run.state.phase === 'dead') return;
  run.state.phase = 'dead';
  run.state.deaths += 1;
  run.state.combo = 0;
  const newBest = run.state.score > run.state.best;
  if (newBest) run.state.best = run.state.score;
  emit(run, 'death', { reason, score: run.state.score, level: run.state.level });
  if (newBest && !run._bestEmitted) {
    run._bestEmitted = true;
    emit(run, 'best', { best: run.state.best });
  }
}
