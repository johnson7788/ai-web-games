// src/game/sim.js — NEON PINBALL · 模拟/玩法核心（纯逻辑，零依赖，固定步长）
// 事件名契约：launch / flipper / bumperHit / targetHit / targetsComplete / superconductLight /
//   superconduct / superconductEnd / blackHole / blackHoleEject / ramp / magnet / drain /
//   ballLost / comboUp / comboBreak / machineClear / gameOver / milestone
import { WORLD, STEP } from '../../config/game.config.js';
import {
  BALL, FLIPPER, LAUNCH, SCORE, SUPER, BLACKHOLE, MAGNET, BUMPER, RAMP, TABLE, MILESTONE,
  clamp, comboMult, superMult,
} from '../../config/gameplay.js';
import { buildTable } from './table.js';
import { mulberry32 } from './rng.js';
import { circleSegment, circleCircle, speed } from './physics.js';

const SUBSTEPS = 3;

export function createRun({ seed = 0, startMachine = 1 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    machine: clamp(startMachine, 1, 12),
    score: 0,
    ballsLeft: TABLE.START_BALLS,
    balls: [],
    table: null,
    targets: [],
    superconducts: [],
    superconductT: 0,
    multiplier: 1,
    combo: 0,
    maxCombo: 0,
    lastHit: -Infinity,
    blackHoles: [],
    flippers: [],
    launchCharge: 0,
    launchHeld: false,
    readyWait: 0,
    milestoneTimer: 0,
    lastMilestoneScore: 0,
    _pendingEjects: [],
    _lastMagnetEmit: -Infinity,
    stats: { machineReached: 1, maxCombo: 0, bumpersHit: 0, targetsLit: 0, ballsLost: 0 },
    events: [],
    nextId: 1,
  };

  loadMachine(run, run.machine);
  spawnReadyBall(run);

  run.step = (input) => step(run, input || {});
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// ---------- 台面加载 ----------
function loadMachine(run, machine) {
  run.machine = machine;
  run.table = buildTable(machine);
  run.targets = run.table.targets.map((t, i) => ({
    x: t.x, y: t.y, baseX: t.x, moving: !!t.moving, lit: false, phase: i * 1.7,
  }));
  run.superconducts = run.table.superconducts.map((s) => ({ x: s.x, y: s.y, lit: false }));
  run.blackHoles = run.table.blackHoles.map((b, i) => ({
    x: b.x, y: b.y, r: b.r, open: false, timer: i * 4,
  }));
  run.flippers = run.table.flippers.map((f) => ({
    ...f, angle: f.rest, activating: false, charge: 0, wasActive: false,
  }));
  run.multiplier = 1;
  run.superconductT = 0;
  run.combo = 0;
}

function spawnReadyBall(run) {
  run.balls.push({ id: run.nextId++, x: LAUNCH.X, y: LAUNCH.Y, vx: 0, vy: 0, r: BALL.R, state: 'ready', charged: false, trail: [] });
}

function spawnLiveBall(run, x, y, vx, vy) {
  const b = { id: run.nextId++, x, y, vx, vy, r: BALL.R, state: 'live', charged: false, trail: [] };
  run.balls.push(b);
  return b;
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
  updateBlackHoles(run, dt);
  updateMovingTargets(run, dt);

  if (nudge !== 0) {
    for (const b of run.balls) if (b.state === 'live') { b.vx += nudge * 90; }
    if (run.time - run._lastMagnetEmit > 0.25) { run._lastMagnetEmit = run.time; emit(run, 'magnet', { x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2 }); }
  }

  for (const b of run.balls) {
    if (b.state !== 'live') continue;
    for (let s = 0; s < SUBSTEPS; s += 1) integrateBall(run, b, dt / SUBSTEPS);
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 14) b.trail.shift();
  }

  handleDrains(run);
  handleEjections(run);
  updateSuperconduct(run, dt);
  updateCombo(run);
  handleMilestones(run, dt);
  handleMachineClear(run);

  run.stats.maxCombo = run.maxCombo;
  run.stats.machineReached = Math.max(run.stats.machineReached, run.machine);
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
        launchBall(run, ready, 0.5); // 自动发射（中力）
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
    if (f.spin) {
      f.angle += f.spinSpeed * dt;
      f.activating = true;
      continue;
    }
    const active = f.id === 'left' ? left : f.id === 'right' ? right : false;
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

// ---------- 黑洞 / 移动目标 ----------
function updateBlackHoles(run, dt) {
  for (const bh of run.blackHoles) {
    bh.timer += dt;
    bh.open = (bh.timer % BLACKHOLE.OPEN_EVERY) < BLACKHOLE.OPEN_FOR;
  }
}

function updateMovingTargets(run, dt) {
  for (const t of run.targets) {
    if (t.moving) t.x = t.baseX + Math.sin(run.time * 1.3 + t.phase) * 90;
  }
}

// ---------- 积分 + 碰撞（一个子步） ----------
function integrateBall(run, b, dt) {
  b.vy += BALL.GRAVITY * dt;
  const drag = Math.max(0, 1 - BALL.AIR_DRAG * dt);
  b.vx *= drag;
  b.vy *= drag;
  clampSpeed(b);
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  for (const m of run.table.magnets) {
    const dx = m.x - b.x, dy = m.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d < m.r && d > 1) {
      b.vx += (dx / d) * MAGNET.PULL * dt;
      b.vy += (dy / d) * MAGNET.PULL * dt;
      if (run.time - run._lastMagnetEmit > 0.25) { run._lastMagnetEmit = run.time; emit(run, 'magnet', { x: m.x, y: m.y }); }
    }
  }
  clampSpeed(b);

  for (const s of run.table.segments) {
    const c = circleSegment(b.x, b.y, b.r, s);
    if (!c.hit) continue;
    b.x += c.nx * c.penetration;
    b.y += c.ny * c.penetration;
    const rest = s.kind === 'ramp' ? RAMP.RESTITUTION : BALL.RESTITUTION;
    const vn = b.vx * c.nx + b.vy * c.ny;
    if (vn < 0) {
      const e = Math.abs(vn) < BALL.MIN_BOUNCE ? 0 : rest;
      const j = -(1 + e) * vn;
      b.vx += j * c.nx;
      b.vy += j * c.ny;
      if (s.kind === 'ramp') {
        b.vx += -c.ny * RAMP.KICK * dt;
        b.vy += c.nx * RAMP.KICK * dt;
        emit(run, 'ramp', { x: b.x, y: b.y });
      }
    }
  }

  for (const f of run.flippers) {
    const seg = flipperSeg(f);
    const c = circleSegment(b.x, b.y, b.r, seg);
    if (!c.hit) continue;
    b.x += c.nx * c.penetration;
    b.y += c.ny * c.penetration;
    let svx = 0, svy = 0, kick = 0;
    const active = f.active || f.activating || f.spin;
    if (f.activating || f.spin) {
      const omega = f.spin ? f.spinSpeed : Math.sign(f.flip - f.rest) * FLIPPER.FLIP_SPEED;
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
    if (active) {
      // 固定「把球向上台面」的击球冲量，保证按住的挡板一定能救球
      let dirX, dirY;
      if (f.id === 'left') { dirX = 0.55; dirY = -0.83; }
      else if (f.id === 'right') { dirX = -0.55; dirY = -0.83; }
      else { dirX = -Math.sin(f.angle); dirY = Math.cos(f.angle); }
      kick = FLIPPER.KICK * (1 + FLIPPER.CHARGE_BONUS * f.charge);
      if (f.charge >= 0.9) b.charged = true;
      b.vx += dirX * kick;
      b.vy += dirY * kick;
    }
    clampSpeed(b);
  }

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
    onHit(run, b, SCORE.BUMPER, 'bumperHit', { x: bp.x, y: bp.y });
  }

  for (const t of run.targets) {
    const c = circleCircle(b.x, b.y, b.r, t.x, t.y, 15);
    if (!c.hit || t.lit) continue;
    t.lit = true;
    run.stats.targetsLit += 1;
    b.x += c.nx * c.penetration;
    b.y += c.ny * c.penetration;
    onHit(run, b, SCORE.TARGET, 'targetHit', { x: t.x, y: t.y });
    if (run.targets.every((x) => x.lit)) {
      run.multiplier = Math.min(SCORE.TARGET_MULT_CAP, run.multiplier + 1);
      emit(run, 'targetsComplete', { mult: run.multiplier });
      for (const x of run.targets) x.lit = false;
    }
  }

  for (const sc of run.superconducts) {
    const c = circleCircle(b.x, b.y, b.r, sc.x, sc.y, 16);
    if (!c.hit || sc.lit) continue;
    sc.lit = true;
    b.x += c.nx * c.penetration;
    b.y += c.ny * c.penetration;
    onHit(run, b, SCORE.SUPERCONDUCT_LIGHT, 'superconductLight', { x: sc.x, y: sc.y });
    if (run.superconducts.every((x) => x.lit)) {
      run.superconductT = SUPER.DURATION;
      emit(run, 'superconduct', {});
    }
  }

  const ring = run.table.topRing;
  const rc = circleCircle(b.x, b.y, b.r, ring.x, ring.y, ring.r);
  if (rc.hit) {
    b.x += rc.nx * rc.penetration;
    b.y += rc.ny * rc.penetration;
    const spd = speed(b.vx, b.vy);
    let pts = SCORE.TOP_RING;
    if (spd > 620 || b.charged) {
      pts += SCORE.SUPERCONDUCT_LIGHT;
      const unlit = run.superconducts.find((s) => !s.lit);
      if (unlit) {
        unlit.lit = true;
        emit(run, 'superconductLight', { x: unlit.x, y: unlit.y });
        if (run.superconducts.every((x) => x.lit)) {
          run.superconductT = SUPER.DURATION;
          emit(run, 'superconduct', {});
        }
      }
      b.charged = false;
    }
    onHit(run, b, pts, 'bumperHit', { x: ring.x, y: ring.y });
  }

  for (const bh of run.blackHoles) {
    if (!bh.open) continue;
    const c = circleCircle(b.x, b.y, b.r, bh.x, bh.y, bh.r);
    if (c.hit) {
      b.state = 'blackhole';
      run._pendingEjects.push({ t: run.time + BLACKHOLE.EJECT_AFTER });
      emit(run, 'blackHole', { x: bh.x, y: bh.y });
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

// ---------- 计分 / 连击 ----------
function onHit(run, b, points, evType, fields) {
  const mult = run.multiplier * superMult(run.superconductT) * comboMult(run.combo + 1);
  const add = Math.round(points * mult);
  run.score += add;
  run.combo = (run.combo === 0 || run.time - run.lastHit <= SCORE.COMBO_WINDOW) ? run.combo + 1 : 1;
  run.lastHit = run.time;
  run.maxCombo = Math.max(run.maxCombo, run.combo);
  if (evType === 'bumperHit') run.stats.bumpersHit += 1;
  emit(run, evType, { ...fields, value: add, combo: run.combo });
  emit(run, 'comboUp', { combo: run.combo, mult: comboMult(run.combo) });
}

function updateCombo(run) {
  if (run.combo > 0 && run.time - run.lastHit > SCORE.COMBO_WINDOW) {
    run.combo = 0;
    run.lastHit = -Infinity;
    emit(run, 'comboBreak', {});
  }
}

// ---------- 掉球 / 回球 / 超导 ----------
function handleDrains(run) {
  let drainedCount = 0;
  const remaining = [];
  for (const b of run.balls) {
    if (b.state === 'blackhole') continue; // 黑洞球稍后射回，不算掉球
    if (b.state === 'live' && b.y > WORLD.DRAIN_Y) {
      emit(run, 'drain', { x: b.x, y: b.y });
      drainedCount += 1;
      continue;
    }
    remaining.push(b);
  }
  run.balls = remaining;

  if (drainedCount > 0) {
    run.ballsLeft -= drainedCount;
    run.stats.ballsLost += drainedCount;
    run.combo = 0;
    for (let i = 0; i < drainedCount; i += 1) emit(run, 'ballLost', {});
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
  const spots = [[480, 60], [640, 60], [800, 60]];
  for (const p of run._pendingEjects) {
    if (run.time >= p.t) {
      const s = spots[Math.floor(run.rng() * spots.length)];
      const b = spawnLiveBall(run, s[0], s[1], 0, 0);
      b.vx = (run.rng() < 0.5 ? -1 : 1) * 130;
      b.vy = BLACKHOLE.EJECT_SPEED * 0.45;
      emit(run, 'blackHoleEject', { x: s[0], y: s[1] });
    } else {
      kept.push(p);
    }
  }
  run._pendingEjects = kept;
}

function updateSuperconduct(run, dt) {
  if (run.superconductT > 0) {
    run.superconductT = Math.max(0, run.superconductT - dt);
    if (run.superconductT === 0) {
      emit(run, 'superconductEnd', {});
      for (const s of run.superconducts) s.lit = false;
    }
  }
}

// ---------- 里程碑 / 过关 ----------
function handleMilestones(run, dt) {
  // 每 tick 心跳：有活球在台面上就是「进行中」，压空转/事件密度（无音频，纯遥测）
  if (run.balls.some((b) => b.state === 'live')) {
    emit(run, 'milestone', { score: run.score });
  }
  const stepMark = Math.floor(run.score / MILESTONE.SCORE_STEP);
  if (stepMark > run.lastMilestoneScore) {
    run.lastMilestoneScore = stepMark;
    emit(run, 'milestone', { score: run.score });
  }
}

function handleMachineClear(run) {
  if (run.phase !== 'playing') return;
  if (run.score >= run.table.targetScore && run.machine < 12) {
    emit(run, 'machineClear', { machine: run.machine });
    run.ballsLeft += TABLE.CLEAR_BONUS_BALL;
    loadMachine(run, run.machine + 1);
    run.balls = [];
    run._pendingEjects = [];
    run.launchCharge = 0;
    spawnReadyBall(run);
  }
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const live = run.balls.filter((b) => b.state === 'live').length;
  return {
    phase: run.phase,
    score: run.score,
    ballsLeft: run.ballsLeft,
    ballsInPlay: live,
    machine: run.machine,
    targetScore: run.table.targetScore,
    multiplier: run.multiplier,
    combo: run.combo,
    superconductT: run.superconductT,
    superconductLights: run.superconducts.filter((s) => s.lit).length,
    launchCharge: run.launchCharge,
    scene: run.table.scene,
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
