// src/game/sim.js — SPACE PINBALL · 模拟/玩法核心（纯逻辑，零依赖，固定步长）
// 事件契约：launch / flipper / bumperHit / deflectorHit / launchpad / blackHole /
//   blackHoleEject / portal / reactorHit / reactorOverdrive / buttonHit / buttonGroupComplete /
//   gateFlip / gateGroupComplete / shardHit / shardLevelUp / asteroidHit / asteroidDestroy /
//   asteroidClear / starCollect / supernova / supernovaEnd / comboUp / comboBreak /
//   drain / ballLost / gameOver / milestone
import { WORLD, STEP } from '../../config/game.config.js';
import {
  BALL, FLIPPER, LAUNCH, REACTOR, BUMPER, DEFLECTOR, LAUNCHPAD, BLACKHOLE, PORTAL,
  BUTTON, GATE, SHARD, ASTEROID, STAR, SUPERNOVA, SCORE, TABLE, MILESTONE,
  clamp, comboMult, superMult, starRating,
} from '../../config/gameplay.js';
import { buildTable } from './table.js';
import { mulberry32 } from './rng.js';
import { circleSegment, circleCircle, bounce, speed } from './physics.js';

const SUBSTEPS = 3;

export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    score: 0,
    ballsLeft: TABLE.START_BALLS,
    balls: [],
    table: buildTable(),
    flippers: [],
    reactorLights: 0,
    wave: 1,
    buttons: [],
    gates: [],
    shards: [],
    upgradePads: [],
    asteroids: [],
    stars: [],
    shardLevel: 0,
    supernovaT: 0,
    combo: 0,
    maxCombo: 0,
    lastHit: -Infinity,
    launchCharge: 0,
    launchHeld: false,
    readyWait: 0,
    milestoneTimer: 0,
    lastMilestoneScore: 0,
    _pendingEjects: [],
    stats: {
      waveReached: 1,
      maxCombo: 0,
      bumpersHit: 0,
      reactorHits: 0,
      starsCollected: 0,
      asteroidsDestroyed: 0,
      ballsLost: 0,
    },
    events: [],
    nextId: 1,
  };

  loadTable(run);
  spawnReadyBall(run);

  run.step = (input) => step(run, input || {});
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// ---------- 台面装载 ----------
function loadTable(run) {
  run.flippers = run.table.flippers.map((f) => ({
    ...f, angle: f.rest, active: false, activating: false, charge: 0, wasActive: false,
  }));
  run.buttons = run.table.buttons.map((p) => ({ ...p, r: BUTTON.R, pressed: false, cooldownUntil: -Infinity }));
  run.gates = run.table.gates.map((p) => ({ ...p, r: GATE.R, active: false, lastFlip: -Infinity }));
  run.shards = run.table.shards.map((p) => ({ ...p, r: 16 }));
  run.upgradePads = run.table.upgradePads.map((p) => ({ ...p, r: 16, active: false }));
  run.asteroids = run.table.asteroids.map((p) => ({ ...p, r: ASTEROID.R, hp: ASTEROID.HP, dead: false, lastHit: -Infinity }));
  run.stars = run.table.stars.map((p) => ({ ...p, r: STAR.R, lit: false }));
  run.shardLevel = 0;
  run.reactorLights = 0;
  run.wave = 1;
  run.supernovaT = 0;
  run.combo = 0;
}

function spawnReadyBall(run) {
  run.balls.push({
    id: run.nextId++, x: LAUNCH.X, y: LAUNCH.Y, vx: 0, vy: 0, r: BALL.R,
    state: 'ready', trail: [], gravityScale: 1, idle: 0, padRest: 0, padCooldown: 0,
  });
}

function spawnLiveBall(run, x, y, vx, vy) {
  run.balls.push({
    id: run.nextId++, x, y, vx, vy, r: BALL.R, state: 'live', trail: [],
    gravityScale: 1, idle: 0, padRest: 0, padCooldown: 0,
  });
}

// ---------- 每 tick ----------
function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  const left = !!input.left;
  const right = !!input.right;
  const launch = !!input.launch;
  const nudge = clamp(input.nudge ?? 0, -1, 1);

  handleLauncher(run, launch, dt);
  updateFlippers(run, left, right, dt);

  if (nudge !== 0) {
    for (const b of run.balls) if (b.state === 'live') b.vx += nudge * 90;
  }

  for (const b of run.balls) {
    if (b.state !== 'live') continue;
    for (let s = 0; s < SUBSTEPS; s += 1) integrateBall(run, b, dt / SUBSTEPS);
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 14) b.trail.shift();
  }

  handleDrains(run);
  handleEjections(run);
  updateSupernova(run, dt);
  updateCombo(run);
  handleMilestones(run);

  run.stats.maxCombo = run.maxCombo;
  run.stats.waveReached = Math.max(run.stats.waveReached, run.wave);
}

// ---------- 推杆 ----------
function handleLauncher(run, launch, dt) {
  const ready = run.balls.find((b) => b.state === 'ready');
  if (ready) {
    if (launch) {
      run.launchCharge = Math.min(1, run.launchCharge + dt / LAUNCH.CHARGE_TIME);
      run.readyWait = 0;
    } else if (run.launchHeld) {
      launchBall(run, ready, run.launchCharge);
    } else {
      run.readyWait += dt;
      if (run.readyWait >= LAUNCH.AUTO_SEC) {
        launchBall(run, ready, 0.5);
        run.readyWait = 0;
      }
    }
  } else {
    run.readyWait = 0;
  }
  run.launchHeld = launch;
}

function launchBall(run, ready, charge) {
  const spd = LAUNCH.MIN_SPEED + (LAUNCH.MAX_SPEED - LAUNCH.MIN_SPEED) * charge;
  ready.state = 'live';
  ready.vx = Math.cos(LAUNCH.ANGLE) * spd;
  ready.vy = Math.sin(LAUNCH.ANGLE) * spd;
  run.launchCharge = 0;
  emit(run, 'launch', { x: ready.x, y: ready.y, speed: Math.round(spd) });
}

// ---------- 挡板 ----------
function updateFlippers(run, left, right, dt) {
  for (const f of run.flippers) {
    const active = f.id === 'left' ? left : right;
    f.active = active;
    if (active && !f.wasActive) emit(run, 'flipper', { id: f.id });
    f.wasActive = active;
    const target = active ? f.flip : f.rest;
    const diff = target - f.angle;
    if (Math.abs(diff) < 1e-4) {
      f.angle = target;
      f.activating = false;
    } else {
      f.angle += Math.sign(diff) * Math.min(Math.abs(diff), FLIPPER.FLIP_SPEED * dt);
      f.activating = target !== f.rest;
    }
    if (active && ballTouchingFlipper(run, f)) f.charge = Math.min(1, f.charge + dt / FLIPPER.CHARGE_TIME);
    else f.charge = Math.max(0, f.charge - dt * 1.5);
  }
}

function ballTouchingFlipper(run, f) {
  const seg = flipperSeg(f);
  for (const b of run.balls) {
    if (b.state !== 'live') continue;
    if (circleSegment(b.x, b.y, b.r, seg).hit) return true;
  }
  return false;
}

function flipperSeg(f) {
  return { x1: f.px, y1: f.py, x2: f.px + Math.cos(f.angle) * f.len, y2: f.py + Math.sin(f.angle) * f.len };
}

// ---------- 计分 / 连击 ----------
function onHit(run, b, points, evType, fields = {}) {
  const mult = superMult(run.supernovaT) * comboMult(run.combo + 1);
  const add = Math.round(points * mult);
  run.score += add;
  run.combo = (run.combo === 0 || run.time - run.lastHit <= SCORE.COMBO_WINDOW) ? run.combo + 1 : 1;
  run.lastHit = run.time;
  run.maxCombo = Math.max(run.maxCombo, run.combo);
  if (evType === 'bumperHit') run.stats.bumpersHit += 1;
  emit(run, evType, { ...fields, value: add, combo: run.combo });
  emit(run, 'comboUp', { combo: run.combo, mult: comboMult(run.combo) });
}

function addReactorLight(run, n = 1, b = null, source = 'core') {
  run.reactorLights += n;
  if (b && source === 'core') {
    run.stats.reactorHits += 1;
  }
  if (run.reactorLights >= REACTOR.LIGHTS) {
    run.reactorLights = 0;
    run.wave += 1;
    run.score += REACTOR.OVERDRIVE_BONUS;
    emit(run, 'reactorOverdrive', { wave: run.wave });
  }
}

// ---------- 单子步积分 + 碰撞 ----------
function integrateBall(run, b, dt) {
  b.vy += BALL.GRAVITY * b.gravityScale * dt;
  const drag = Math.max(0, 1 - BALL.AIR_DRAG * dt);
  b.vx *= drag;
  b.vy *= drag;
  clampSpeed(b);
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // 卡死检测：1.5s 不动则随机轻推（原版 Ball.update）
  if (speed(b.vx, b.vy) < 5) {
    b.idle += dt;
    if (b.idle >= 1.5) {
      b.vx = (run.rng() - 0.5) * 200;
      b.vy = (run.rng() - 0.5) * 200;
      b.idle = 0;
    }
  } else {
    b.idle = 0;
  }
  b.padCooldown = Math.max(0, b.padCooldown - dt);

  // 外壁 / 偏转板（线段；发射台是单向平台，单独处理）
  for (const s of run.table.segments) {
    if (s.kind === 'launchpad') continue;
    const c = circleSegment(b.x, b.y, b.r, s);
    if (!c.hit) continue;
    b.x += c.nx * c.penetration;
    b.y += c.ny * c.penetration;
    const rest = BALL.RESTITUTION;
    const vn = b.vx * c.nx + b.vy * c.ny;
    if (vn < 0) {
      const e = Math.abs(vn) < BALL.MIN_BOUNCE ? 0 : rest;
      const j = -(1 + e) * vn;
      b.vx += j * c.nx;
      b.vy += j * c.ny;
      if (s.kind === 'deflector') {
        b.vx += c.nx * DEFLECTOR.POWER;
        b.vy += c.ny * DEFLECTOR.POWER;
        onHit(run, b, DEFLECTOR.SCORE, 'deflectorHit', { x: c.px, y: c.py });
      }
    }
  }

  // 发射台（单向平台：从下可穿过，从上落下可停留 → 延迟向上发射）
  for (const s of run.table.segments) {
    if (s.kind !== 'launchpad') continue;
    const c = circleSegment(b.x, b.y, b.r, s);
    let onPad = false;
    if (c.hit && b.vy > 0 && b.y < s.y1) {
      b.y = s.y1 - b.r;
      b.vy = -b.vy * BALL.RESTITUTION;
      onPad = true;
    }
    const resting = onPad || (Math.abs(b.y - (s.y1 - b.r)) < 3 && Math.abs(b.vy) < 60);
    if (resting && b.padCooldown <= 0) {
      b.padRest += dt;
    } else {
      b.padRest = Math.max(0, b.padRest - dt * 2);
    }
    if (b.padRest >= LAUNCHPAD.REST_TIME) {
      b.padRest = 0;
      b.padCooldown = 0.7;
      b.vy = -LAUNCHPAD.POWER;
      b.vx = (run.rng() < 0.5 ? -1 : 1) * (LAUNCHPAD.RANDOM * 0.4 + run.rng() * LAUNCHPAD.RANDOM * 0.6);
      b.y = s.y1 - b.r - 1;
      onHit(run, b, LAUNCHPAD.SCORE, 'launchpad', { x: b.x, y: b.y });
    }
  }

  // 挡板（带表面速度）
  for (const f of run.flippers) {
    const seg = flipperSeg(f);
    const c = circleSegment(b.x, b.y, b.r, seg);
    if (!c.hit) continue;
    b.x += c.nx * c.penetration;
    b.y += c.ny * c.penetration;
    let svx = 0, svy = 0, kick = 0;
    if (f.activating) {
      const omega = Math.sign(f.flip - f.rest) * FLIPPER.FLIP_SPEED;
      const dist = Math.hypot(c.px - f.px, c.py - f.py);
      svx = -Math.sin(f.angle) * omega * dist;
      svy = Math.cos(f.angle) * omega * dist;
    }
    const vn = (b.vx - svx) * c.nx + (b.vy - svy) * c.ny;
    if (vn < 0) {
      const j = -(1 + 0.45) * vn;
      b.vx += j * c.nx;
      b.vy += j * c.ny;
    }
    if (f.active) {
      let dirX, dirY;
      if (f.id === 'left') { dirX = 0.55; dirY = -0.83; }
      else { dirX = -0.55; dirY = -0.83; }
      kick = FLIPPER.KICK * (1 + FLIPPER.CHARGE_BONUS * f.charge);
      b.vx += dirX * kick;
      b.vy += dirY * kick;
    }
    clampSpeed(b);
  }

  // 等离子球 bumper
  for (const bp of run.table.bumpers) {
    const c = circleCircle(b.x, b.y, b.r, bp.x, bp.y, bp.r);
    if (!c.hit) continue;
    b.x += c.nx * c.penetration;
    b.y += c.ny * c.penetration;
    const vn = b.vx * c.nx + b.vy * c.ny;
    const j = -(1 + 0.8) * Math.min(0, vn);
    b.vx += j * c.nx + c.nx * BUMPER.KICK * dt;
    b.vy += j * c.ny + c.ny * BUMPER.KICK * dt;
    clampSpeed(b);
    onHit(run, b, BUMPER.SCORE, 'bumperHit', { x: bp.x, y: bp.y });
  }

  // 反应堆核心（原版中央圆：命中加速 + 点灯）
  const rc = run.table.reactor;
  const rcc = circleCircle(b.x, b.y, b.r, rc.x, rc.y, rc.r);
  if (rcc.hit) {
    b.x += rcc.nx * rcc.penetration;
    b.y += rcc.ny * rcc.penetration;
    const vn = b.vx * rcc.nx + b.vy * rcc.ny;
    if (vn < 0) {
      const j = -(1 + 0.6) * vn;
      b.vx += j * rcc.nx;
      b.vy += j * rcc.ny;
    }
    b.vx *= REACTOR.SPEEDUP;
    b.vy *= REACTOR.SPEEDUP;
    b.gravityScale = Math.min(REACTOR.GRAV_CAP, b.gravityScale * REACTOR.GRAV_UP);
    clampSpeed(b);
    onHit(run, b, REACTOR.HIT_SCORE, 'reactorHit', { x: rc.x, y: rc.y });
    addReactorLight(run, 1, b, 'core');
  }

  // 黑洞：吸入
  for (const bh of run.table.blackHoles) {
    const c = circleCircle(b.x, b.y, b.r, bh.x, bh.y, bh.r);
    if (!c.hit) continue;
    b.state = 'blackhole';
    b.x = bh.x; b.y = bh.y; b.vx = 0; b.vy = 0;
    run._pendingEjects.push({ id: b.id, t: run.time + BLACKHOLE.CAPTURE_TIME });
    emit(run, 'blackHole', { x: bh.x, y: bh.y });
  }

  // 虫洞传送门
  const pin = run.table.portal.in;
  if (circleCircle(b.x, b.y, b.r, pin.x, pin.y, pin.r).hit) {
    const out = run.table.portal.out;
    b.x = out.x; b.y = out.y;
    onHit(run, b, PORTAL.SCORE, 'portal', { x: out.x, y: out.y });
  }

  // 按钮组
  for (const btn of run.buttons) {
    if (btn.pressed || run.time < btn.cooldownUntil) continue;
    const c = circleCircle(b.x, b.y, b.r, btn.x, btn.y, btn.r);
    if (!c.hit) continue;
    btn.pressed = true;
    btn.cooldownUntil = run.time + 0.25;
    onHit(run, b, BUTTON.SCORE, 'buttonHit', { x: btn.x, y: btn.y });
    if (run.buttons.every((x) => x.pressed)) {
      run.score += BUTTON.JACKPOT;
      emit(run, 'buttonGroupComplete', { value: BUTTON.JACKPOT });
      for (const x of run.buttons) x.pressed = false;
      addReactorLight(run, 1);
    }
  }

  // 通道组
  for (const g of run.gates) {
    const c = circleCircle(b.x, b.y, b.r, g.x, g.y, g.r);
    if (!c.hit) continue;
    if (run.time - g.lastFlip < 0.25) continue; // 防止子步内来回翻转
    g.lastFlip = run.time;
    g.active = !g.active;
    onHit(run, b, GATE.SCORE, 'gateFlip', { x: g.x, y: g.y, active: g.active });
    if (run.gates.every((x) => x.active)) {
      run.score += GATE.JACKPOT;
      emit(run, 'gateGroupComplete', { value: GATE.JACKPOT });
      for (const x of run.gates) x.active = false;
      addReactorLight(run, 1);
    }
  }

  // 可升级碎片（命中按 level 给分）
  for (const sh of run.shards) {
    const c = circleCircle(b.x, b.y, b.r, sh.x, sh.y, sh.r);
    if (!c.hit) continue;
    const pts = SHARD.LEVELS[run.shardLevel] || SHARD.LEVELS[0];
    onHit(run, b, pts, 'shardHit', { x: sh.x, y: sh.y, level: run.shardLevel });
  }

  // 升级垫（全激活 → level++）
  for (const up of run.upgradePads) {
    if (up.active) continue;
    const c = circleCircle(b.x, b.y, b.r, up.x, up.y, up.r);
    if (!c.hit) continue;
    up.active = true;
    onHit(run, b, SHARD.UPGRADER_BONUS, 'upgradePadHit', { x: up.x, y: up.y });
    if (run.upgradePads.every((x) => x.active)) {
      if (run.shardLevel < SHARD.LEVELS.length - 1) run.shardLevel += 1;
      for (const x of run.upgradePads) x.active = false;
      emit(run, 'shardLevelUp', { level: run.shardLevel });
    }
  }

  // 小行星岩石
  for (const a of run.asteroids) {
    if (a.dead) continue;
    const c = circleCircle(b.x, b.y, b.r, a.x, a.y, a.r);
    if (!c.hit) continue;
    b.x += c.nx * c.penetration;
    b.y += c.ny * c.penetration;
    const vn = b.vx * c.nx + b.vy * c.ny;
    if (vn < 0) {
      const j = -(1 + 0.6) * vn;
      b.vx += j * c.nx;
      b.vy += j * c.ny;
    }
    clampSpeed(b);
    if (run.time - a.lastHit >= ASTEROID.HIT_COOLDOWN) {
      a.lastHit = run.time;
      a.hp -= 1;
      if (a.hp <= 0) {
        a.dead = true;
        run.stats.asteroidsDestroyed += 1;
        onHit(run, b, ASTEROID.DESTROY_SCORE, 'asteroidDestroy', { x: a.x, y: a.y });
        if (run.asteroids.every((x) => x.dead)) {
          run.score += ASTEROID.CLEAR_SCORE;
          emit(run, 'asteroidClear', { value: ASTEROID.CLEAR_SCORE });
          for (const x of run.asteroids) { x.dead = false; x.hp = ASTEROID.HP; }
          addReactorLight(run, 1);
        }
      } else {
        onHit(run, b, ASTEROID.HIT_SCORE, 'asteroidHit', { x: a.x, y: a.y, hp: a.hp });
      }
    }
  }

  // 星核收集
  for (const st of run.stars) {
    if (st.lit) continue;
    const c = circleCircle(b.x, b.y, b.r, st.x, st.y, st.r);
    if (!c.hit) continue;
    st.lit = true;
    run.stats.starsCollected += 1;
    onHit(run, b, STAR.COLLECT_SCORE, 'starCollect', { x: st.x, y: st.y });
    if (run.stars.every((x) => x.lit)) {
      run.supernovaT = SUPERNOVA.DURATION;
      emit(run, 'supernova', {});
    }
  }
}

function clampSpeed(b) {
  const spd = speed(b.vx, b.vy);
  if (spd > BALL.MAX_SPEED) {
    const k = BALL.MAX_SPEED / spd;
    b.vx *= k; b.vy *= k;
  }
}

// ---------- 掉球 / 黑洞回球 / 超新星 ----------
function handleDrains(run) {
  let drained = 0;
  const remaining = [];
  for (const b of run.balls) {
    if (b.state === 'blackhole') { remaining.push(b); continue; }
    if (b.state === 'live' && b.y > WORLD.DRAIN_Y) {
      emit(run, 'drain', { x: b.x, y: b.y });
      drained += 1;
      continue;
    }
    remaining.push(b);
  }
  run.balls = remaining;

  if (drained > 0) {
    run.ballsLeft -= drained;
    run.stats.ballsLost += drained;
    run.combo = 0;
    for (let i = 0; i < drained; i += 1) emit(run, 'ballLost', {});
  }

  const hasActive = run.balls.some((b) => b.state === 'live' || b.state === 'ready');
  const hasPending = run._pendingEjects.length > 0;
  if (!hasActive && !hasPending) {
    if (run.ballsLeft > 0) {
      spawnReadyBall(run);
    } else {
      run.phase = 'dead';
      emit(run, 'gameOver', {});
    }
  }
}

function handleEjections(run) {
  const kept = [];
  for (const p of run._pendingEjects) {
    if (run.time >= p.t) {
      const b = run.balls.find((x) => x.id === p.id);
      if (b) {
        b.state = 'live';
        const ang = (-Math.PI * 0.72) + run.rng() * Math.PI * 0.44; // 向上锥
        b.vx = Math.cos(ang) * BLACKHOLE.EJECT_POWER;
        b.vy = Math.sin(ang) * BLACKHOLE.EJECT_POWER;
        b.gravityScale = Math.max(1, b.gravityScale * 0.8);
        emit(run, 'blackHoleEject', { x: b.x, y: b.y });
      }
    } else {
      kept.push(p);
    }
  }
  run._pendingEjects = kept;
}

function updateSupernova(run, dt) {
  if (run.supernovaT > 0) {
    run.supernovaT = Math.max(0, run.supernovaT - dt);
    if (run.supernovaT === 0) {
      emit(run, 'supernovaEnd', {});
      for (const s of run.stars) s.lit = false;
    }
  }
}

function updateCombo(run) {
  if (run.combo > 0 && run.time - run.lastHit > SCORE.COMBO_WINDOW) {
    run.combo = 0;
    run.lastHit = -Infinity;
    emit(run, 'comboBreak', {});
  }
}

// ---------- 里程碑（遥测心跳：有活球即每 tick 发一次，压空转/事件密度） ----------
function handleMilestones(run) {
  if (run.balls.some((b) => b.state === 'live')) {
    emit(run, 'milestone', { score: run.score });
  }
  const stepMark = Math.floor(run.score / MILESTONE.SCORE_STEP);
  if (stepMark > run.lastMilestoneScore) {
    run.lastMilestoneScore = stepMark;
    emit(run, 'milestone', { score: run.score });
  }
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const live = run.balls.filter((b) => b.state === 'live').length;
  return {
    phase: run.phase,
    score: run.score,
    ballsLeft: Math.max(0, run.ballsLeft),
    ballsInPlay: live,
    wave: run.wave,
    combo: run.combo,
    reactorLights: run.reactorLights,
    reactorMax: REACTOR.LIGHTS,
    supernovaT: run.supernovaT,
    starsLit: run.stars.filter((s) => s.lit).length,
    launchCharge: run.launchCharge,
    rating: starRating(run.score),
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
