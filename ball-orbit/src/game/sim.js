// BALL ORBIT · 模拟/玩法核心（纯逻辑，零依赖，零 DOM）
//
// 契约（事件名 / 接口签名一字不差）：
//   createRun({ seed, startWave }) → run
//   run.step(input)     input = { aimAngle?: number|null, fire?: boolean }
//   run.getHud()        → { wave, scene, score, ballsPerShot, comets, cometProgress, planets, phase }
//   run.drainEvents()   → [{ type, ... }]
//
// 事件表（sim 发，render/audio/ui 消费）：
//   shot / aim / ballBounce / ballHit / asteroidBreak / rowClear / addBall /
//   cometCharge / cometFire / shieldBlock / waveEnter / descend / idleDescend /
//   ballReturn / death
import {
  WORLD, STEP, CANNON, BALL, ASTEROID, PLANET, COMET, RIPPLE, SHOT, IDLE_DESCEND,
  BOUNCE_BAND, WAVES as WAVES_CFG, COMBO, clamp,
} from '../../config/gameplay.js';
import { WAVES, waveAt, sceneForWave } from '../../config/waves.js';
import { mulberry32 } from './rng.js';
import { buildBoard, spawnRow } from './board.js';

// ---------- 创建 run ----------
export function createRun({ seed = 0, startWave = 1 } = {}) {
  const rng = mulberry32(seed);
  const wave = clamp(startWave, 1, WAVES.length);

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    wave,
    scene: sceneForWave(wave),
    score: 0,
    rowsCleared: 0,
    ballsPerShot: SHOT.BALLS_START,
    cometCharge: 0,
    comets: 0,
    asteroids: [],
    planets: [],
    balls: [],
    pending: [],           // { delay, isComet }
    aimAngle: null,
    canFire: true,
    lastFireTime: 0,
    _idleAccum: 0,
    combo: 0,
    lastBreakTime: -Infinity,
    stats: {
      waveReached: wave,
      hardnessCleared: 0,
      asteroidsBroken: 0,
      shots: 0,
      maxCombo: 0,
    },
    events: [],
    nextId: 1,
    _removeAsteroids: new Set(),
  };

  run.asteroids = buildBoard(run, waveAt(wave));
  run.planets = buildPlanets(run, waveAt(wave));

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// 兼容旧骨架别名
export function createSim() {
  return createRun({ seed: 0 });
}
export function updateSim(run, input = {}) {
  run.step({ aimAngle: input.aimAngle, fire: !!input.fire });
}

// ---------- 行星 ----------
function buildPlanets(run, wave) {
  const n = wave.planets || 0;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const x = (WORLD.WIDTH * (i + 1)) / (n + 1);
    const y = i % 2 === 0 ? 300 : 430;
    out.push({ id: run.nextId++, x, y, r: PLANET.R, gm: PLANET.GM });
  }
  return out;
}

// ---------- 每 tick ----------
function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  // 1 瞄准
  const rawAim = input.aimAngle == null ? null : input.aimAngle;
  const aimAngle = rawAim == null ? run.aimAngle : clamp(rawAim, -CANNON.AIM_MAX_ANGLE, CANNON.AIM_MAX_ANGLE);
  if (aimAngle !== run.aimAngle) {
    run.aimAngle = aimAngle;
    emit(run, 'aim', { angle: aimAngle });
  }

  // 2 发射
  if (input.fire && run.canFire && run.balls.length === 0 && run.pending.length === 0) {
    launchShot(run);
  }

  // 3 待发队列
  processPending(run, dt);

  // 4 陨石移动 + 涟漪衰减
  updateAsteroids(run, dt);

  // 5 球物理
  updateBalls(run, dt);

  // 6 回合结束 → 下坠
  maybeEndShot(run);

  // 7 空闲自动下坠
  idleDescend(run, dt);

  // 8 清理
  flushRemovals(run);
  run.stats.hardnessCleared = run.score;
}

// ---------- 发射 ----------
function launchShot(run) {
  const count = run.ballsPerShot;
  let cometUsed = false;
  if (run.comets > 0) {
    run.pending.push({ delay: 0, isComet: true });
    run.comets -= 1;
    cometUsed = true;
    emit(run, 'cometFire', { comets: run.comets });
  }
  for (let i = 0; i < count; i += 1) {
    run.pending.push({ delay: (i + (cometUsed ? 1 : 0)) * SHOT.STAGGER, isComet: false });
  }
  run.canFire = false;
  run.lastFireTime = run.time;
  run.combo = 0;
  run.stats.shots += 1;
  emit(run, 'shot', { balls: count + (cometUsed ? 1 : 0), comets: run.comets });
}

function processPending(run, dt) {
  if (!run.pending.length) return;
  const remaining = [];
  for (const p of run.pending) {
    p.delay -= dt;
    if (p.delay <= 0) spawnBall(run, p.isComet);
    else remaining.push(p);
  }
  run.pending = remaining;
}

function spawnBall(run, isComet) {
  const angle = run.aimAngle ?? 0;
  run.balls.push({
    id: run.nextId++,
    x: CANNON.X,
    y: CANNON.BALL_Y,
    px: CANNON.X,
    py: CANNON.BALL_Y,
    vx: Math.sin(angle) * BALL.SPEED,
    vy: -Math.cos(angle) * BALL.SPEED,
    isComet,
    bandBoost: false,
  });
}

// ---------- 球物理 ----------
function updateBalls(run, dt) {
  const sub = dt / BALL.SUBSTEPS;
  const remaining = [];
  for (const ball of run.balls) {
    let alive = true;
    for (let s = 0; s < BALL.SUBSTEPS; s += 1) {
      if (!integrateBall(run, ball, sub)) { alive = false; break; }
    }
    if (alive) remaining.push(ball);
    else emit(run, 'ballReturn', { x: ball.x, y: ball.y });
  }
  run.balls = remaining;
}

function integrateBall(run, ball, dt) {
  ball.px = ball.x;
  ball.py = ball.y;

  ball.vy += BALL.GRAVITY * dt;
  applyPlanetGravity(run, ball, dt);

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp > BALL.MAX_SPEED) {
    const k = BALL.MAX_SPEED / sp;
    ball.vx *= k;
    ball.vy *= k;
  }

  applyBounceBand(run, ball);

  // 墙
  if (ball.x < BALL.R) {
    ball.x = BALL.R;
    ball.vx = Math.abs(ball.vx) * BALL.WALL_REST;
    emit(run, 'ballBounce', { x: ball.x, y: ball.y, wall: 'left' });
  } else if (ball.x > WORLD.WIDTH - BALL.R) {
    ball.x = WORLD.WIDTH - BALL.R;
    ball.vx = -Math.abs(ball.vx) * BALL.WALL_REST;
    emit(run, 'ballBounce', { x: ball.x, y: ball.y, wall: 'right' });
  }
  if (ball.y < BALL.R) {
    ball.y = BALL.R;
    ball.vy = Math.abs(ball.vy) * BALL.WALL_REST;
    emit(run, 'ballBounce', { x: ball.x, y: ball.y, wall: 'top' });
  }

  // 底界回收
  if (ball.y > WORLD.HEIGHT + BALL.R) return false;

  collideAsteroids(run, ball);
  return true;
}

function applyPlanetGravity(run, ball, dt) {
  for (const p of run.planets) {
    const dx = p.x - ball.x;
    const dy = p.y - ball.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > PLANET.INFLUENCE * PLANET.INFLUENCE) continue;
    const d = Math.sqrt(d2) || 1;
    const acc = Math.min(PLANET.MAX_ACC, p.gm / Math.max(d2, p.r * p.r));
    const k = acc / d;
    ball.vx += dx * k * dt;
    ball.vy += dy * k * dt;
  }
}

function applyBounceBand(run, ball) {
  if (!waveAt(run.wave).bounceBand) return;
  const inside = ball.y > BOUNCE_BAND.Y1 && ball.y < BOUNCE_BAND.Y2;
  if (inside && !ball.bandBoost) {
    ball.bandBoost = true;
    ball.vx *= BOUNCE_BAND.MULT;
    ball.vy *= BOUNCE_BAND.MULT;
    emit(run, 'ballBounce', { x: ball.x, y: ball.y, band: true });
  } else if (!inside && (ball.y <= BOUNCE_BAND.Y1 - 20 || ball.y >= BOUNCE_BAND.Y2 + 20)) {
    ball.bandBoost = false;
  }
}

// ---------- 陨石碰撞 ----------
function collideAsteroids(run, ball) {
  for (const a of run.asteroids) {
    if (run._removeAsteroids.has(a.id)) continue;
    const ax = a.x + a.ox;
    const halfW = ASTEROID.W / 2;
    const halfH = ASTEROID.H / 2;
    const left = ax - halfW;
    const right = ax + halfW;
    const top = a.y - halfH;
    const bottom = a.y + halfH;
    const cx = clamp(ball.x, left, right);
    const cy = clamp(ball.y, top, bottom);
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= BALL.R * BALL.R) continue;

    const d = Math.sqrt(d2);
    let nx;
    let ny;
    if (d > 1e-6) {
      nx = dx / d;
      ny = dy / d;
    } else {
      // 球心在盒内：用最小穿透轴
      const penL = ball.x - left;
      const penR = right - ball.x;
      const penT = ball.y - top;
      const penB = bottom - ball.y;
      const m = Math.min(penL, penR, penT, penB);
      if (m === penL) { nx = -1; ny = 0; }
      else if (m === penR) { nx = 1; ny = 0; }
      else if (m === penT) { nx = 0; ny = -1; }
      else { nx = 0; ny = 1; }
    }

    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) {
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
    }
    ball.x = cx + nx * BALL.R;
    ball.y = cy + ny * BALL.R;

    hitAsteroid(run, ball, a);
    break; // 一个子步最多处理一颗陨石
  }
}

function hitAsteroid(run, ball, a) {
  const isComet = !!ball.isComet;
  const impact = isComet ? COMET.IMPACT : 1;
  emit(run, 'ballHit', { x: a.x + a.ox, y: a.y, value: a.hardness, isComet });

  if (a.kind === 'addBall') {
    run.ballsPerShot = Math.min(SHOT.BALLS_MAX, run.ballsPerShot + 1);
    emit(run, 'addBall', { x: a.x + a.ox, y: a.y, ballsPerShot: run.ballsPerShot });
    removeAsteroid(run, a);
    return;
  }

  if (a.kind === 'shield' && !isComet) {
    emit(run, 'shieldBlock', { x: a.x + a.ox, y: a.y });
    return;
  }

  a.hardness -= impact;
  if (a.hardness <= 0) {
    const gained = a.initial;
    run.score += gained;
    run.cometCharge += gained;
    run.stats.asteroidsBroken += 1;
    if (run.time - run.lastBreakTime <= COMBO.WINDOW) run.combo += 1;
    else run.combo = 1;
    run.lastBreakTime = run.time;
    run.stats.maxCombo = Math.max(run.stats.maxCombo, run.combo);
    emit(run, 'asteroidBreak', { x: a.x + a.ox, y: a.y, value: a.initial, combo: run.combo });
    removeAsteroid(run, a);

    while (run.cometCharge >= COMET.CHARGE_PER && run.comets < COMET.MAX) {
      run.cometCharge -= COMET.CHARGE_PER;
      run.comets += 1;
      emit(run, 'cometCharge', { comets: run.comets });
    }
    checkRowClear(run, a.rowY);
  }
}

function removeAsteroid(run, a) {
  run._removeAsteroids.add(a.id);
}

function flushRemovals(run) {
  if (run._removeAsteroids.size) {
    run.asteroids = run.asteroids.filter((a) => !run._removeAsteroids.has(a.id));
    run._removeAsteroids.clear();
  }
}

// ---------- 引力涟漪（signature）：清整行 → 邻行吸歪 ----------
function checkRowClear(run, rowY) {
  const left = run.asteroids.some((a) => a.rowY === rowY && !run._removeAsteroids.has(a.id));
  if (left) return;
  emit(run, 'rowClear', { y: rowY });
  applyRipple(run, rowY);
}

function applyRipple(run, rowY) {
  const dir = run.rng() < 0.5 ? -1 : 1;
  for (const a of run.asteroids) {
    if (run._removeAsteroids.has(a.id)) continue;
    const dr = Math.abs(a.rowY - rowY);
    if (dr < 0.001 || Math.abs(dr - ASTEROID.DESCEND_STEP) < 0.001) {
      const sign = Math.sin(a.col * 1.1) >= 0 ? 1 : -1;
      a.ox += dir * RIPPLE.SKEW * sign;
      a.tilt += dir * 0.18;
    }
  }
}

// ---------- 陨石更新 ----------
function updateAsteroids(run, dt) {
  for (const a of run.asteroids) {
    if (a.moving) {
      a.x += a.vx * dt;
      const half = ASTEROID.W / 2;
      if (a.x < half) { a.x = half; a.vx = Math.abs(a.vx); }
      else if (a.x > WORLD.WIDTH - half) { a.x = WORLD.WIDTH - half; a.vx = -Math.abs(a.vx); }
    }
    a.ox *= RIPPLE.DECAY;
    a.tilt *= RIPPLE.DECAY;
  }
}

// ---------- 回合结束 → 下坠 + 补顶行 + 判负 + 波次 ----------
function maybeEndShot(run) {
  if (run.canFire) return;
  if (run.balls.length > 0 || run.pending.length > 0) return;
  run.canFire = true;
  descend(run);
}

function idleDescend(run, dt) {
  if (run.canFire && run.asteroids.length > 0 && run.time - run.lastFireTime > IDLE_DESCEND.DELAY) {
    run._idleAccum += dt;
    if (run._idleAccum >= IDLE_DESCEND.STEP_EVERY) {
      run._idleAccum = 0;
      emit(run, 'idleDescend', {});
      descend(run);
    }
  } else {
    run._idleAccum = 0;
  }
}

function descend(run) {
  const wave = waveAt(run.wave);
  for (const a of run.asteroids) {
    a.rowY += ASTEROID.DESCEND_STEP;
    a.y += ASTEROID.DESCEND_STEP;
  }
  run.asteroids.push(...spawnRow(run, wave));
  run.rowsCleared += 1;
  emit(run, 'descend', { rows: run.rowsCleared });

  for (const a of run.asteroids) {
    if (a.y + ASTEROID.H / 2 >= ASTEROID.DANGER_Y) {
      die(run);
      return;
    }
  }

  const newWave = clamp(1 + Math.floor(run.rowsCleared / WAVES_CFG.DESCENTS_PER_WAVE), 1, WAVES.length);
  if (newWave !== run.wave) {
    run.wave = newWave;
    run.scene = sceneForWave(newWave);
    run.planets = buildPlanets(run, waveAt(newWave));
    run.stats.waveReached = Math.max(run.stats.waveReached, newWave);
    emit(run, 'waveEnter', { wave: newWave, scene: run.scene });
  }
}

function die(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  emit(run, 'death', { score: run.score, wave: run.wave });
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  return {
    wave: run.wave,
    scene: run.scene,
    score: run.score,
    ballsPerShot: run.ballsPerShot,
    comets: run.comets,
    cometProgress: clamp(run.cometCharge / COMET.CHARGE_PER, 0, 1),
    planets: run.planets.length,
    bounceBand: !!waveAt(run.wave).bounceBand,
    phase: run.phase,
    asteroidsLeft: run.asteroids.length,
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
