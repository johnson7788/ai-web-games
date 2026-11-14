// 纯逻辑：俯视角车辆足球（蓝方玩家 vs 红方 bot）。无 DOM / window / Date.now；RNG 可注入。
import { WORLD, ARENA, GOAL, CAR, BALL, RULES } from '../../config/game.config.js';

export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CY = (ARENA.y0 + ARENA.y1) / 2;

function mkCar(id) {
  return {
    id,
    x: id === 0 ? ARENA.x0 + 150 : ARENA.x1 - 150,
    y: CY,
    heading: id === 0 ? 0 : Math.PI,
    speed: 0, boost: 1, isBot: id === 1,
  };
}

export function createRun({ seed = 1 } = {}) {
  return {
    phase: 'kickoff',
    phaseT: RULES.kickoffPause,
    scores: [0, 0],
    winner: null,
    cars: [mkCar(0), mkCar(1)],
    ball: { x: WORLD.WIDTH / 2, y: CY, vx: 0, vy: 0 },
    lastScorer: null,
    events: [],
    rng: makeRng(seed),
  };
}

function resetKickoff(run) {
  const car0Bot = run.cars[0].isBot;
  run.cars = [mkCar(0), mkCar(1)];
  run.cars[0].isBot = car0Bot;
  run.ball = { x: WORLD.WIDTH / 2, y: CY, vx: 0, vy: 0 };
  run.phase = 'kickoff';
  run.phaseT = RULES.kickoffPause;
}

function inMouth(y) { return y > CY - GOAL.half && y < CY + GOAL.half; }

function stepCar(run, car, input, dt) {
  const boosting = input.boost && car.boost > 0 && input.up;
  const accel = boosting ? CAR.BOOST_ACCEL : CAR.ACCEL;
  const maxS = boosting ? CAR.BOOST_MAX : CAR.MAX_SPEED;
  if (input.up) car.speed += accel * dt;
  if (input.down) car.speed -= CAR.BRAKE * dt;
  car.speed -= car.speed * CAR.DRAG * dt;
  car.speed = clamp(car.speed, CAR.REVERSE_MAX, maxS);
  if (!input.up && !input.down && Math.abs(car.speed) < 5) car.speed = 0;
  if (boosting) car.boost = Math.max(0, car.boost - CAR.BOOST_DRAIN * dt);
  else car.boost = Math.min(1, car.boost + CAR.BOOST_REGEN * dt);

  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const sf = clamp(Math.abs(car.speed) / CAR.MAX_SPEED, 0.15, 1);
  car.heading += steer * CAR.TURN * sf * dt * (car.speed < 0 ? -1 : 1);

  car.x += Math.cos(car.heading) * car.speed * dt;
  car.y += Math.sin(car.heading) * car.speed * dt;
  const m = 26;
  if (car.x < ARENA.x0 + m) { car.x = ARENA.x0 + m; car.speed *= 0.4; }
  if (car.x > ARENA.x1 - m) { car.x = ARENA.x1 - m; car.speed *= 0.4; }
  if (car.y < ARENA.y0 + m) { car.y = ARENA.y0 + m; car.speed *= 0.4; }
  if (car.y > ARENA.y1 - m) { car.y = ARENA.y1 - m; car.speed *= 0.4; }
}

function botInput(run, car) {
  const b = run.ball;
  const tx = b.x + 60, ty = b.y;     // 绕到球右侧，把球推向左门
  const want = Math.atan2(ty - car.y, tx - car.x);
  let da = want - car.heading;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const inp = { up: true, down: false, left: da < -0.08, right: da > 0.08, boost: false };
  const d = Math.hypot(tx - car.x, ty - car.y);
  if (d > 240 && Math.abs(da) < 0.4) inp.boost = true;
  if (d < 30 && Math.abs(da) > 1.2) { inp.up = false; inp.down = true; }
  return inp;
}

function carBall(run, car) {
  const b = run.ball;
  const dx = b.x - car.x, dy = b.y - car.y;
  const d = Math.hypot(dx, dy);
  const min = 26 + BALL.R;
  if (d < min && d > 0.001) {
    const nx = dx / d, ny = dy / d;
    b.x = car.x + nx * min; b.y = car.y + ny * min;
    const cvx = Math.cos(car.heading) * car.speed;
    const cvy = Math.sin(car.heading) * car.speed;
    b.vx = cvx * BALL.KICK + nx * Math.abs(car.speed) * 0.5 + b.vx * 0.25;
    b.vy = cvy * BALL.KICK + ny * Math.abs(car.speed) * 0.5 + b.vy * 0.25;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > BALL.MAX_SPEED) { b.vx *= BALL.MAX_SPEED / sp; b.vy *= BALL.MAX_SPEED / sp; }
    run.events.push({ type: 'hit', id: car.id });
  }
}

function carCar(run) {
  const [a, b] = run.cars;
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d < 52 && d > 0.001) {
    const nx = dx / d, ny = dy / d, push = (52 - d) / 2;
    a.x -= nx * push; a.y -= ny * push;
    b.x += nx * push; b.y += ny * push;
  }
}

function stepBall(run, dt) {
  const b = run.ball;
  b.vx *= (1 - BALL.DRAG * dt); b.vy *= (1 - BALL.DRAG * dt);
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.y < ARENA.y0 + BALL.R) { b.y = ARENA.y0 + BALL.R; b.vy = -b.vy * BALL.REST; }
  if (b.y > ARENA.y1 - BALL.R) { b.y = ARENA.y1 - BALL.R; b.vy = -b.vy * BALL.REST; }
  // 左右墙 / 球门
  if (b.x < ARENA.x0 + BALL.R) {
    if (inMouth(b.y)) {
      if (b.x < ARENA.x0 - 8) { score(run, 1); return; }
    } else { b.x = ARENA.x0 + BALL.R; b.vx = -b.vx * BALL.REST; }
  }
  if (b.x > ARENA.x1 - BALL.R) {
    if (inMouth(b.y)) {
      if (b.x > ARENA.x1 + 8) { score(run, 0); return; }
    } else { b.x = ARENA.x1 - BALL.R; b.vx = -b.vx * BALL.REST; }
  }
}

function score(run, team) {
  run.scores[team] += 1;
  run.lastScorer = team;
  run.events.push({ type: 'goal', team, scores: [...run.scores] });
  run.phase = 'goal';
  run.phaseT = RULES.goalPause;
}

export function tick(run, dt, input = {}) {
  if (run.phase === 'over') return;
  if (run.phase === 'kickoff') {
    run.phaseT -= dt;
    if (run.phaseT <= 0) { run.phase = 'play'; run.events.push({ type: 'go' }); }
    return;
  }
  if (run.phase === 'goal') {
    run.phaseT -= dt;
    if (run.phaseT <= 0) {
      const champ = run.scores.findIndex((s) => s >= RULES.winScore);
      if (champ >= 0) { run.phase = 'over'; run.winner = champ; run.events.push({ type: 'win', winner: champ }); }
      else resetKickoff(run);
    }
    return;
  }
  // play
  const inputs = [input, botInput(run, run.cars[1])];
  if (run.cars[0].isBot) inputs[0] = botInput(run, run.cars[0]);
  stepCar(run, run.cars[0], inputs[0], dt);
  stepCar(run, run.cars[1], inputs[1], dt);
  carCar(run);
  carBall(run, run.cars[0]);
  carBall(run, run.cars[1]);
  stepBall(run, dt);
}

export function getHud(run) {
  return {
    phase: run.phase,
    scores: [...run.scores],
    winner: run.winner,
    winScore: RULES.winScore,
    boost: run.cars[0].boost,
    ballSpeed: Math.hypot(run.ball.vx, run.ball.vy),
  };
}

export function drainEvents(run) { const e = run.events; run.events = []; return e; }
export { resetKickoff };