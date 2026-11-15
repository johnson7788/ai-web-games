// src/game/sim.js — ROCKET DERBY 纯逻辑核心：2v2 火箭车足球。
// 无 DOM/window/localStorage/Date.now；随机用 seed（mulberry32）。60Hz 由 main 调用。
import { STEP, ARENA, MATCH, BALL, CAR, PICKUP, AI, SCORE } from '../../config/game.config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hypot = (x, z) => Math.hypot(x, z);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 目标角度与当前朝向的夹角，归一化到 [-PI, PI]
function angleDiff(target, cur) {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function makeCar(id, team, isPlayer, x, z, heading) {
  return {
    id, team, isPlayer,
    x, z, y: 0, vy: 0,
    heading, speed: 0, steer: 0, throttle: 0,
    boostOn: false, boostMeter: isPlayer ? CAR.BOOST_MAX : 0.6,
    onGround: true, jumped: false, doubleJumped: false,
    demoed: false, demoT: 0, spin: 0,
    in: { throttle: 0, steer: 0, jump: false, boost: false },
  };
}

export function createSim(opts = {}) {
  const seed = opts.seed ?? 1;
  const level = clamp(opts.level ?? 1, 1, MATCH.MAX_LEVELS);
  const run = {
    seed, level, rng: mulberry32(seed),
    phase: 'kickoff',          // kickoff | play | goalReplay | overtime | end
    result: null,              // 'win' | 'lose' | null
    time: 0,
    clock: MATCH.DURATION,
    kickoffT: MATCH.KICKOFF_T,
    replayT: 0,
    scoreP: 0, scoreO: 0,       // 己方 / 对方进球数
    score: 0,                   // 本场累计分（球速×100 + 胜场奖励）
    bestGoalSpeed: 0,
    lastGoal: null,             // { team, speed, x, z }
    stats: { hits: 0, boosts: 0, demos: 0, pickups: 0, aerial: 0, shots: 0 },
    ball: { x: 0, z: 0, vx: 0, vz: 0, y: 0, vy: 0, prevX: 0, prevZ: 0 },
    pickups: [],
    cars: [
      makeCar(0, 'p', true, -24, 0, 0),
      makeCar(1, 'p', false, -30, -10, 0),
      makeCar(2, 'o', false, 24, 0, Math.PI),
      makeCar(3, 'o', false, 30, 10, Math.PI),
    ],
    events: [],
  };
  run.player = run.cars[0];
  run.teammate = run.cars[1];
  run.opponents = [run.cars[2], run.cars[3]];
  setupPickups(run);
  resetKickoff(run, false);
  emit(run, 'start', { level });
  emit(run, 'kickoff', { n: level });
  return run;
}

function emit(run, type, extra = {}) {
  run.events.push({ type, t: run.time, ...extra });
}

export function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

export function getHud(run) {
  return {
    phase: run.phase, result: run.result,
    time: run.time, clock: Math.max(0, run.clock),
    scoreP: run.scoreP, scoreO: run.scoreO, score: Math.round(run.score),
    level: run.level, bestGoalSpeed: run.bestGoalSpeed,
    boost: run.player.boostMeter, boostOn: run.player.boostOn,
    demoed: run.player.demoed, overtime: run.phase === 'overtime',
  };
}

export function ratingFor(score) {
  let r = 'C';
  for (const [name, min] of SCORE.ratings) if (score >= min) { r = name; break; }
  return r;
}

// ---------------------------------------------------------------- 开球
function setupPickups(run) {
  run.pickups = [];
  if (run.level < PICKUP.LEVEL_MIN) return;
  for (const [x, z] of PICKUP.SPOTS) run.pickups.push({ x, z, active: true, t: 0 });
}

function resetKickoff(run, emitKickoff = true) {
  run.phase = 'kickoff';
  run.kickoffT = MATCH.KICKOFF_T;
  run.lastKickoffCeil = MATCH.KICKOFF_T;
  run.ball = { x: 0, z: 0, vx: 0, vz: 0, y: 0, vy: 0, prevX: 0, prevZ: 0 };
  const spots = [
    [-24, 0, 0], [-30, -10, 0], [24, 0, Math.PI], [30, 10, Math.PI],
  ];
  run.cars.forEach((c, i) => {
    const [x, z, h] = spots[i];
    c.x = x; c.z = z; c.heading = h;
    c.speed = 0; c.steer = 0; c.throttle = 0; c.y = 0; c.vy = 0;
    c.boostOn = false; c.demoed = false; c.demoT = 0;
    c.jumped = false; c.doubleJumped = false; c.onGround = true;
    c.in = { throttle: 0, steer: 0, jump: false, boost: false };
  });
  if (emitKickoff) emit(run, 'kickoff', {});
}

// ---------------------------------------------------------------- 输入
function readInput(car, input) {
  const in_ = input || {};
  car.in.throttle = clamp(Math.round(in_.throttle || 0), -1, 1);
  car.in.steer = clamp(in_.steer || 0, -1, 1);
  car.in.boost = !!in_.boost;
  car.in.jump = !!in_.jump;
}

// ---------------------------------------------------------------- AI
// 固定角色：队友=清道夫守门，对手一号=守门员，对手二号=进攻（攻 -X 球门）。
function computeAI(run, car) {
  const lvl = AI.perLevel[run.level] || AI.perLevel[1];
  // 加时金球：全员进攻，快速分出胜负
  if (run.phase === 'overtime') {
    const target = car.team === 'o' ? -ARENA.HX : ARENA.HX;
    return attackerAI(run, car, target, lvl);
  }
  // 队友：球在对方半场 → 助攻；否则回防守 -X（玩家球门）
  if (car.id === 1) {
    if (run.ball.x > 0) return attackerAI(run, car, ARENA.HX, lvl);
    return sweeperAI(run, car, -ARENA.HX, lvl);
  }
  if (car.id === 2) return goalieAI(run, car, ARENA.HX, lvl);     // 对手守 +X
  return attackerAI(run, car, -ARENA.HX, lvl);                    // 对手攻 -X
}

// 追踪目标点：转向 + 大角度时减速；贴近后不再转（避免绕圈/自旋）
function seek(car, tx, tz) {
  const dx = tx - car.x, dz = tz - car.z;
  const dist = hypot(dx, dz);
  let err = 0;
  if (dist > 0.4) {
    const desired = Math.atan2(dz, dx);
    err = angleDiff(desired, car.heading);
  }
  return {
    steer: clamp(err * 2.0, -1, 1),
    throttle: Math.abs(err) > 1.1 ? 0.25 : 1,
    err,
    dist,
  };
}

function attackerAI(run, car, targetGoalX, lvl) {
  const b = run.ball;
  // 若车已位于球背向目标球门的一侧 → 直接穿过球；否则绕到球后
  const dir = Math.sign(targetGoalX - b.x) || 1;
  const correctSide = Math.sign(b.x - car.x) === dir;
  const tx = correctSide ? b.x : b.x - dir * 4;
  const tz = b.z;
  const s = seek(car, tx, tz);
  const aligned = Math.abs(s.err) < 0.3;
  const boost = car.boostMeter > 0.3 && s.dist > 12 && aligned && run.rng() < 0.5;
  return { throttle: s.throttle, steer: s.steer, boost, jump: false };
}

function goalieAI(run, car, ownGoalX, lvl) {
  const b = run.ball;
  const gx = ownGoalX + Math.sign(b.x - ownGoalX || 1) * 4;
  const gz = clamp(b.z * 0.7, -ARENA.GOAL_W / 2 - 4, ARENA.GOAL_W / 2 + 4);
  const dist = hypot(gx - car.x, gz - car.z);
  const s = seek(car, gx, gz);
  const throttle = dist > 3 ? s.throttle : 0;
  const danger = Math.abs(b.x - ownGoalX) < 14 && Math.abs(b.z) < ARENA.GOAL_W / 2 + 6;
  const boost = danger && car.boostMeter > 0.3 && run.rng() < 0.4;
  return { throttle, steer: s.steer, boost, jump: false };
}

function sweeperAI(run, car, ownGoalX, lvl) {
  const b = run.ball;
  const gx = ownGoalX + Math.sign(b.x - ownGoalX || 1) * 18;
  const gz = clamp(b.z * 0.75, -ARENA.GOAL_W / 2 - 6, ARENA.GOAL_W / 2 + 6);
  const dist = hypot(gx - car.x, gz - car.z);
  const s = seek(car, gx, gz);
  const danger = Math.abs(b.x - ownGoalX) < 22 && Math.abs(b.z) < ARENA.GOAL_W / 2 + 8;
  // 危险球 → 主动冲出去解围
  if (danger && dist < 14) return { throttle: 1, steer: s.steer, boost: car.boostMeter > 0.3 && run.rng() < 0.4, jump: false };
  return { throttle: dist > 5 ? s.throttle : 0, steer: s.steer, boost: false, jump: false };
}

// ---------------------------------------------------------------- 车辆物理
function updateCar(run, car, dt) {
  const c = CAR;
  const aiIn = car.in;

  car.hitCd = Math.max(0, (car.hitCd || 0) - dt);

  // 翻车：无法操控，打转减速
  if (car.demoed) {
    car.demoT -= dt;
    car.speed = Math.max(0, car.speed - 26 * dt);
    car.heading += car.spin * dt;
    car.x += Math.cos(car.heading) * car.speed * dt;
    car.z += Math.sin(car.heading) * car.speed * dt;
    if (car.demoT <= 0) { car.demoed = false; car.spin = 0; }
    // 翻车也受墙约束
    car.x = clamp(car.x, -ARENA.HX + c.R, ARENA.HX - c.R);
    car.z = clamp(car.z, -ARENA.HZ + c.R, ARENA.HZ - c.R);
    return;
  }

  // 跳跃
  if (aiIn.jump) {
    if (car.onGround) { car.vy = c.JUMP_V; car.onGround = false; car.jumped = true; }
    else if (!car.doubleJumped) { car.vy = c.DOUBLE_JUMP_V; car.doubleJumped = true; }
  }
  car.vy -= c.GRAVITY * dt;
  car.y += car.vy * dt;
  if (car.y <= 0) { car.y = 0; car.vy = 0; car.onGround = true; car.jumped = false; car.doubleJumped = false; }

  // 油门 / 刹车 / boost
  const lvl = AI.perLevel[run.level] || AI.perLevel[1];
  const baseMax = car.isPlayer ? c.MAX_SPEED : (car.team === 'o' ? lvl.oppMax : AI.teammate.maxSpeed);
  let maxSpeed = baseMax;
  const wantBoost = aiIn.boost && car.boostMeter > 0;
  if (wantBoost) {
    if (!car.boostOn) { car.boostOn = true; if (car.isPlayer) { emit(run, 'boostStart', {}); run.stats.boosts++; } }
    car.boostMeter = Math.max(0, car.boostMeter - c.BOOST_DRAIN * dt);
    maxSpeed *= c.BOOST_MUL;
    if (car.boostMeter <= 0) { car.boostOn = false; if (car.isPlayer) emit(run, 'boostEnd', {}); }
  } else {
    if (car.boostOn) { car.boostOn = false; if (car.isPlayer) emit(run, 'boostEnd', {}); }
    // boost 回充：玩家缓慢自回充，AI 也缓慢回充
    const regen = car.isPlayer ? c.PASSIVE_REGEN : c.AI_REGEN;
    car.boostMeter = Math.min(c.BOOST_MAX, car.boostMeter + regen * dt);
  }

  const want = aiIn.throttle;
  if (want > 0) car.speed += c.ACCEL * dt * (1 - 0.4 * (car.speed / maxSpeed));
  else if (want < 0) car.speed -= c.BRAKE * dt;
  else car.speed -= c.BRAKE * 0.6 * dt * Math.sign(car.speed || 1);
  if (want === 0 && Math.abs(car.speed) < 0.5) car.speed = 0;
  car.speed = clamp(car.speed, -c.REVERSE, maxSpeed);

  // 转向（高速减弱）
  const spdF = clamp(Math.abs(car.speed) / c.MAX_SPEED, 0, 1);
  const rate = c.STEER * (1 - c.STEER_SPD_DAMP * spdF);
  car.heading += aiIn.steer * rate * dt;

  // 位置沿朝向推进
  const dir = Math.sign(car.speed) || 1;
  car.x += Math.cos(car.heading) * car.speed * dt;
  car.z += Math.sin(car.heading) * car.speed * dt;

  // 墙约束
  car.x = clamp(car.x, -ARENA.HX + c.R, ARENA.HX - c.R);
  car.z = clamp(car.z, -ARENA.HZ + c.R, ARENA.HZ - c.R);
}

// ---------------------------------------------------------------- 球物理
function updateBall(run, dt) {
  const b = run.ball, c = BALL;
  b.prevX = b.x; b.prevZ = b.z;
  b.vy -= c.GRAVITY * dt;
  b.y += b.vy * dt;
  if (b.y <= 0) { b.y = 0; b.vy = Math.abs(b.vy) > 4 ? -b.vy * 0.4 : 0; }
  const friction = b.y > 0 ? c.AIR_FRICTION : c.FRICTION;
  const f = Math.max(0, 1 - friction * dt);
  b.vx *= f; b.vz *= f;
  const sp = Math.hypot(b.vx, b.vz);
  if (sp > c.MAX_SPEED) { b.vx *= c.MAX_SPEED / sp; b.vz *= c.MAX_SPEED / sp; }
  b.x += b.vx * dt;
  b.z += b.vz * dt;
}

function inGoalMouth(z) {
  return Math.abs(z) < ARENA.GOAL_W / 2 - BALL.R * 0.4;
}

function collideBallWalls(run) {
  const b = run.ball, c = BALL;
  // 左右球门线
  if (b.x > ARENA.HX) {
    if (inGoalMouth(b.z) && b.y < ARENA.GOAL_H) return 'goalP'; // 右门 = 己方得分
    b.x = ARENA.HX - c.R; b.vx = -Math.abs(b.vx) * c.RESTITUTION;
  } else if (b.x < -ARENA.HX) {
    if (inGoalMouth(b.z) && b.y < ARENA.GOAL_H) return 'goalO';
    b.x = -ARENA.HX + c.R; b.vx = Math.abs(b.vx) * c.RESTITUTION;
  }
  // 侧墙
  if (b.z > ARENA.HZ - c.R) { b.z = ARENA.HZ - c.R; b.vz = -Math.abs(b.vz) * c.RESTITUTION; }
  else if (b.z < -ARENA.HZ + c.R) { b.z = -ARENA.HZ + c.R; b.vz = Math.abs(b.vz) * c.RESTITUTION; }
  return null;
}

function collideCarBall(run) {
  const b = run.ball;
  for (const car of run.cars) {
    if (car.demoed || car.hitCd > 0) continue;
    const dx = b.x - car.x, dz = b.z - car.z;
    const d = hypot(dx, dz);
    const minD = CAR.R + BALL.R;
    if (d >= minD || d === 0) continue;
    // 推出重叠
    const nx = dx / d, nz = dz / d;
    b.x = car.x + nx * minD;
    b.z = car.z + nz * minD;
    car.hitCd = 0.25;
    // 球速 = 车速方向给速
    const carSpeed = Math.abs(car.speed);
    let hitSpeed = Math.max(carSpeed * BALL.HIT_POWER, BALL.MIN_HIT);
    const cx = Math.cos(car.heading), cz = Math.sin(car.heading);
    b.vx = nx * hitSpeed + cx * carSpeed * 0.25;
    b.vz = nz * hitSpeed + cz * carSpeed * 0.25;
    // 空中撞球
    if (car.y > 0.5) {
      b.y = Math.max(b.y, 1.2);
      b.vy = Math.max(b.vy, BALL.AERIAL_VY);
      emit(run, 'aerial', { team: car.team, speed: Math.round(hitSpeed) });
      run.stats.aerial++;
    }
    const sp = Math.hypot(b.vx, b.vz);
    run.bestGoalSpeed = Math.max(run.bestGoalSpeed, sp);
    run.stats.hits++;
    run.stats.shots += car.team === 'p' ? 1 : 0;
    emit(run, 'hit', { team: car.team, speed: Math.round(sp), aerial: car.y > 0.5 });
  }
}

function collideCarCar(run) {
  const cars = run.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.demoed || b.demoed) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = hypot(dx, dz);
      const minD = CAR.R * 2;
      if (d >= minD || d === 0) continue;
      const nx = dx / d, nz = dz / d;
      const push = (minD - d) / 2;
      a.x -= nx * push; a.z -= nz * push;
      b.x += nx * push; b.z += nz * push;
      // 撞车判定：boost 满速撞对手 → 翻车 2s
      const rel = Math.abs(a.speed) + Math.abs(b.speed);
      const aFast = a.boostOn && Math.abs(a.speed) > CAR.DEMO_SPEED;
      const bFast = b.boostOn && Math.abs(b.speed) > CAR.DEMO_SPEED;
      if (aFast && !bFast) { demo(b, run, a); }
      else if (bFast && !aFast) { demo(a, run, b); }
      else if (rel > CAR.DEMO_SPEED * 2.4) {
        // 硬碰硬：都弹开减速
        a.speed *= 0.4; b.speed *= 0.4;
      }
    }
  }
}

function demo(victim, run, by) {
  if (victim.demoed) return;
  victim.demoed = true;
  victim.demoT = CAR.DEMO_TIME;
  victim.spin = (run.rng() < 0.5 ? 1 : -1) * 6;
  victim.boostOn = false;
  if (victim.isPlayer) emit(run, 'demoed', { by: by.id });
  else if (by.isPlayer) { emit(run, 'demo', { victim: victim.id }); run.stats.demos++; }
}

// ---------------------------------------------------------------- 拾取点
function updatePickups(run, dt) {
  for (const p of run.pickups) {
    if (!p.active) { p.t -= dt; if (p.t <= 0) p.active = true; continue; }
    for (const car of run.cars) {
      if (car.demoed) continue;
      if (hypot(p.x - car.x, p.z - car.z) < CAR.R + PICKUP.R) {
        p.active = false; p.t = PICKUP.RESPAWN_T;
        car.boostMeter = Math.min(CAR.BOOST_MAX, car.boostMeter + CAR.PICKUP_REFILL);
        if (car.isPlayer) { run.stats.pickups++; emit(run, 'pickup', { x: p.x, z: p.z }); }
      }
    }
  }
}

// ---------------------------------------------------------------- 进球 / 结束
function onGoal(run, team) {
  const sp = Math.hypot(run.ball.vx, run.ball.vz);
  run.bestGoalSpeed = Math.max(run.bestGoalSpeed, sp);
  const pts = Math.round(sp * SCORE.SPEED_MUL);
  if (team === 'p') { run.scoreP++; run.score += pts; }
  else { run.scoreO++; }
  run.lastGoal = { team, speed: sp, x: run.ball.x, z: run.ball.z };
  run.goalInOT = run.phase === 'overtime';
  run.phase = 'goalReplay';
  run.replayT = MATCH.REPLAY_T;
  emit(run, team === 'p' ? 'goal' : 'concede', { speed: Math.round(sp), points: pts });
}

function endMatch(run, result) {
  run.phase = 'end';
  run.result = result;
  if (result === 'win') {
    run.score += SCORE.WIN_BONUS;
    emit(run, 'levelClear', { level: run.level, score: Math.round(run.score), rating: ratingFor(run.score) });
  } else {
    emit(run, 'matchLost', { level: run.level });
  }
}

// ---------------------------------------------------------------- 主更新
export function updateSim(run, input = {}) {
  const dt = STEP;
  run.time += dt;

  if (run.phase === 'kickoff') {
    run.kickoffT -= dt;
    const ceil = Math.ceil(run.kickoffT);
    if (ceil !== run.lastKickoffCeil && ceil >= 1) { run.lastKickoffCeil = ceil; emit(run, 'countdown', { n: ceil }); }
    if (run.kickoffT <= 0) { run.phase = 'play'; emit(run, 'whistle', {}); }
    return run;
  }

  if (run.phase === 'goalReplay') {
    updateBall(run, dt);
    collideBallWalls(run);
    // 球进网后停在球门内
    if (run.ball.x > ARENA.HX + ARENA.GOAL_D) { run.ball.x = ARENA.HX + ARENA.GOAL_D; run.ball.vx *= 0.3; }
    if (run.ball.x < -ARENA.HX - ARENA.GOAL_D) { run.ball.x = -ARENA.HX - ARENA.GOAL_D; run.ball.vx *= 0.3; }
    run.replayT -= dt;
    if (run.replayT <= 0) {
      if (run.goalInOT) endMatch(run, run.lastGoal.team === 'p' ? 'win' : 'lose');
      else resetKickoff(run, true);
    }
    return run;
  }

  if (run.phase === 'end') return run;

  // play / overtime 全量更新
  readInput(run.player, input);
  for (const car of run.cars) {
    if (!car.isPlayer) {
      const ai = computeAI(run, car);
      car.in.throttle = ai.throttle; car.in.steer = ai.steer;
      car.in.boost = ai.boost; car.in.jump = ai.jump;
    }
  }
  for (const car of run.cars) updateCar(run, car, dt);
  updateBall(run, dt);
  const goalWall = collideBallWalls(run);
  if (goalWall) {
    onGoal(run, goalWall === 'goalP' ? 'p' : 'o');
    return run;
  }
  collideCarBall(run);
  collideCarCar(run);
  updatePickups(run, dt);

  if (run.phase === 'play') {
    run.clock -= dt;
    if (run.clock <= 0) {
      run.clock = 0;
      if (run.scoreP > run.scoreO) endMatch(run, 'win');
      else if (run.scoreP < run.scoreO) endMatch(run, 'lose');
      else { run.phase = 'overtime'; run.clock = 0; emit(run, 'overtime', {}); }
    }
  }
  return run;
}
