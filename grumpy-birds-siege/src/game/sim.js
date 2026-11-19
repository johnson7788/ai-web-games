// GRUMPY BIRDS SIEGE · 纯逻辑 sim（无 DOM，可测 / 可无头自对弈）
// 玩法骨架 1:1 复刻参考源码（Flappy 换皮）：
//   - 点击振翅（speed 置负上冲），重力逐帧减速（Bird.ts fly / BirdControl onTouchStart）
//   - 3 根滚动障碍（Pipes.ts initPipe/updatePosition），缺口随机 + 上下浮动（PipePrefab moveBothUpDown）
//   - 撞障碍/地面死亡（BirdControl onCollisionEnter tag0），通过缺口计数（tag1），过 10 个胜利
//   - 关卡难度随 level 提升滚动速度（Pipes updatePosition 1.0 + level/100）
// 换皮新机制（3 个）：投石车飞石 / 护盾道具（破盾清连击）/ 连击+星级结算。
import { WORLD, BIRD, WALL, ROCK, SENTRY, SHIELD_ITEM, SCORE, STEP } from '../../config/game.config.js';

const TAU = Math.PI * 2;

// ready 停留超时自动起飞（发射类兜底：无输入也会进入飞行并坠落，保证死亡基线存在）
const AUTO_LAUNCH = 2.5;

// 确定性 RNG（selfplay 复现用）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function randomGapBase(rng, gapH) {
  // 缺口随浮动仍留在 [GAP_MARGIN, GROUND_Y-GAP_MARGIN-gapH] 内
  const min = WALL.GAP_MARGIN + WALL.OSC_AMP;
  const max = WORLD.GROUND_Y - WALL.GAP_MARGIN - gapH - WALL.OSC_AMP;
  return min + rng() * (max - min);
}

function wallGapY(st, w) {
  return w.baseY + Math.sin(st.time * TAU / WALL.OSC_PERIOD) * WALL.OSC_AMP;
}

function emit(run, type, payload = {}) {
  run.state.events.push({ type, ...payload });
}

export function createRun(levelIndex = 0, opts = {}) {
  const seed = (opts.seed == null ? 1 : opts.seed) >>> 0;
  const rng = mulberry32(seed);
  const level = Math.max(0, Math.min(99, levelIndex | 0)) + 1; // 1 基
  const scrollSpeed = WALL.SPEED_BASE + (level - 1) * WALL.SPEED_PER_LEVEL;
  const gapH = Math.max(WALL.GAP_MIN, WALL.GAP_BASE - (level - 1) * 0.4);
  const rockInterval = Math.max(ROCK.INTERVAL_MIN, ROCK.INTERVAL_BASE - (level - 1) * 0.02);

  const walls = [];
  for (let i = 0; i < WALL.COUNT; i += 1) {
    walls.push({ x: WALL.FIRST_X + i * WALL.SPACING, baseY: randomGapBase(rng, gapH), passed: false });
  }

  const state = {
    level,
    seed,
    rng,
    scrollSpeed,
    gapH,
    rockInterval,
    hasRocks: level >= 3,
    hasShield: level >= 4,
    hasSentry: level >= 5,
    phase: 'ready',            // ready | playing | won | lost
    time: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    passed: 0,
    stars: 0,
    diving: false,
    bird: { y: WORLD.HEIGHT / 2, vy: 0, shielded: false },
    walls,
    rocks: [],
    sentry: level >= 5 ? { x: SENTRY.FIRST_X, y: WORLD.HEIGHT / 2, baseY: WORLD.HEIGHT / 2 } : null,
    shieldItem: level >= 4 ? { x: WORLD.WIDTH + 60, y: 0, active: false } : null,
    nextRock: level >= 3 ? 1.0 : Infinity,
    nextShield: level >= 4 ? SHIELD_ITEM.INTERVAL : Infinity,
    events: [{ type: 'levelStart', level }],
  };

  const run = { state };

  run.emit = (type, payload) => emit(run, type, payload);
  run.flap = () => flap(run);
  run.setDive = (on) => { state.diving = !!on; return state.diving; };
  run.step = (dt) => {
    const n = Math.max(1, Math.round(dt / STEP));
    for (let i = 0; i < n; i += 1) stepOnce(run);
  };
  run.drainEvents = () => { const e = state.events; state.events = []; return e; };
  run.forceWin = () => { if (state.phase === 'won' || state.phase === 'lost') return; state.phase = 'playing'; win(run); };
  run.forceLose = () => { if (state.phase === 'won' || state.phase === 'lost') return; state.phase = 'playing'; lose(run, 'debug'); };
  run.getHud = () => ({
    score: state.score,
    combo: state.combo,
    passed: state.passed,
    level: state.level,
    shield: state.bird.shielded,
    winPass: WALL.WIN_PASS,
  });

  return run;
}

function flap(run) {
  const st = run.state;
  if (st.phase === 'ready') {
    st.phase = 'playing';
    st.bird.vy = BIRD.FLAP_VY;
    emit(run, 'start', { level: st.level });
    emit(run, 'flap', {});
    return { ok: true };
  }
  if (st.phase !== 'playing') return { ok: false };
  st.bird.vy = BIRD.FLAP_VY;
  emit(run, 'flap', {});
  return { ok: true };
}

function passWall(run, w, gapY) {
  const st = run.state;
  st.passed += 1;
  st.combo += 1;
  st.bestCombo = Math.max(st.bestCombo, st.combo);
  const gained = SCORE.PASS_BASE + (st.combo - 1) * SCORE.COMBO_BONUS;
  st.score += gained;
  emit(run, 'score', { combo: st.combo, gained, wall: st.passed });
  if (st.combo === 5) emit(run, 'combo', { combo: 5 });
  const edgeDist = Math.min(Math.abs(st.bird.y - gapY), Math.abs(st.bird.y - (gapY + st.gapH)));
  if (edgeDist < 28) emit(run, 'nearMiss', { edgeDist: Math.round(edgeDist) });
  if (st.passed >= WALL.WIN_PASS) win(run);
}

function win(run) {
  const st = run.state;
  st.phase = 'won';
  st.stars = st.bestCombo >= SCORE.STAR3_COMBO ? 3 : st.bestCombo >= SCORE.STAR2_COMBO ? 2 : 1;
  emit(run, 'star', { stars: st.stars });
  emit(run, 'win', { stars: st.stars, score: st.score, bestCombo: st.bestCombo, passed: st.passed });
}

function lose(run, reason) {
  const st = run.state;
  if (st.phase !== 'playing') return;
  st.phase = 'lost';
  st.stars = 0;
  emit(run, 'lose', { reason, score: st.score, bestCombo: st.bestCombo, passed: st.passed });
}

function stepOnce(run) {
  const st = run.state;
  if (st.phase === 'ready') {
    st.time += STEP;
    if (st.time >= AUTO_LAUNCH) {
      st.phase = 'playing';
      st.bird.vy = 2;
      emit(run, 'start', { level: st.level });
    }
    return;
  }
  if (st.phase !== 'playing') return;

  st.time += STEP;
  const cx = BIRD.X;
  const cy = st.bird.y;
  const r = BIRD.R;

  // ---- 小鸟物理 ----
  const g = st.diving ? BIRD.DIVE_GRAVITY : BIRD.GRAVITY;
  st.bird.vy = clamp(st.bird.vy + g, BIRD.MAX_RISE, BIRD.MAX_FALL);
  st.bird.y += st.bird.vy;
  if (st.bird.y - r < WORLD.CEIL_Y) { st.bird.y = r; st.bird.vy = Math.max(0, st.bird.vy); }
  if (st.bird.y + r >= WORLD.GROUND_Y) {
    st.bird.y = WORLD.GROUND_Y - r;
    lose(run, 'ground');
    return;
  }

  // ---- 城墙 ----
  let maxX = -Infinity;
  for (const w of st.walls) maxX = Math.max(maxX, w.x);
  for (const w of st.walls) {
    w.x -= st.scrollSpeed;
    const gapY = wallGapY(st, w);
    const inX = cx + r > w.x && cx - r < w.x + WALL.WIDTH;
    if (inX && (cy - r < gapY || cy + r > gapY + st.gapH)) { lose(run, 'wall'); return; }
    if (!w.passed && w.x + WALL.WIDTH < cx - r) { w.passed = true; passWall(run, w, gapY); }
  }
  for (const w of st.walls) {
    if (w.x + WALL.WIDTH < -60) {
      w.x = maxX + WALL.SPACING;
      w.baseY = randomGapBase(st.rng, st.gapH);
      w.passed = false;
      maxX = Math.max(maxX, w.x);
    }
  }
  if (st.phase !== 'playing') return;

  // ---- 投石（L3+）----
  if (st.hasRocks) {
    if (st.time >= st.nextRock) {
      st.rocks.push({
        x: WORLD.WIDTH + 30,
        y: 60 + st.rng() * 240,
        vx: -(ROCK.VX_MIN + st.rng() * ROCK.VX_SPREAD),
        vy: -1.5 + st.rng() * 3,
        passedBird: false,
      });
      emit(run, 'rock', {});
      st.nextRock = st.time + st.rockInterval;
    }
    for (const rock of st.rocks) {
      rock.x += rock.vx;
      rock.y += rock.vy;
      rock.vy += ROCK.GRAVITY;
    }
    const survivors = [];
    for (const rock of st.rocks) {
      if (rock.x < -40 || rock.y > WORLD.GROUND_Y + 40) continue;
      const dx = rock.x - cx;
      const dy = rock.y - cy;
      if (dx * dx + dy * dy < (ROCK.R + r) * (ROCK.R + r)) {
        if (st.bird.shielded) {
          st.bird.shielded = false;
          st.combo = 0;
          emit(run, 'shieldUse', {});
          continue; // 护盾吃掉飞石，飞石消失
        }
        lose(run, 'rock');
        return;
      }
      if (!rock.passedBird && rock.x < cx - r) { rock.passedBird = true; emit(run, 'rockDodge', {}); }
      survivors.push(rock);
    }
    st.rocks = survivors;
    if (st.phase !== 'playing') return;
  }

  // ---- 哨兵敌机（L5+）----
  if (st.hasSentry && st.sentry) {
    const s = st.sentry;
    s.x -= SENTRY.SPEED;
    s.y = s.baseY + Math.sin(st.time * TAU / SENTRY.BOB_PERIOD) * SENTRY.BOB_AMP;
    const dx = s.x - cx;
    const dy = s.y - cy;
    if (dx * dx + dy * dy < (SENTRY.R + r) * (SENTRY.R + r)) {
      if (st.bird.shielded) { st.bird.shielded = false; st.combo = 0; emit(run, 'shieldUse', {}); }
      else { lose(run, 'sentry'); return; }
      s.x = WORLD.WIDTH + 80;
      s.baseY = 100 + st.rng() * 300;
    }
    if (s.x < -60) { s.x = WORLD.WIDTH + 80; s.baseY = 100 + st.rng() * 300; }
  }

  // ---- 护盾道具（L4+）----
  if (st.hasShield && st.shieldItem) {
    const sh = st.shieldItem;
    if (st.time >= st.nextShield && !sh.active) {
      sh.x = WORLD.WIDTH + 60;
      sh.y = 120 + st.rng() * 240;
      sh.active = true;
      emit(run, 'shield', {});
      st.nextShield = st.time + SHIELD_ITEM.INTERVAL;
    }
    if (sh.active) {
      sh.x -= SHIELD_ITEM.DRIFT;
      if (sh.x < -40) { sh.active = false; }
      else {
        const dx = sh.x - cx;
        const dy = sh.y - cy;
        if (dx * dx + dy * dy < (SHIELD_ITEM.R + r) * (SHIELD_ITEM.R + r)) {
          st.bird.shielded = true;
          sh.active = false;
          emit(run, 'shieldGet', {});
        }
      }
    }
  }
}
