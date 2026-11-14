// 纯逻辑：1v1 街头篮球。无 DOM / window / Date.now；RNG 可注入。
// P1(索引0,蓝) 攻右筐；P2(索引1,红,bot) 攻左筐。右筐进球记 P1，左筐记 P2。
import { WORLD, COURT, BALL, PLAYER, RULES } from '../../config/game.config.js';

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
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function mkPlayer(i) {
  return {
    i,
    x: i === 0 ? 420 : 860,
    y: WORLD.GROUND_Y,       // 脚底 y
    vx: 0, vy: 0,
    onGround: true,
    facing: i === 0 ? 1 : -1,
    hasBall: false,
    charging: false,
    charge: 0,
    stealCd: 0,
  };
}

export function createRun({ seed = 1 } = {}) {
  const run = {
    phase: 'play',           // play | over
    scores: [0, 0],
    winner: null,
    players: [mkPlayer(0), mkPlayer(1)],
    ball: { x: WORLD.WIDTH / 2, y: 180, vx: 0, vy: 0, holder: null, pickupCd: 0.6, prevY: 180, lastShooter: null },
    time: 0,
    scoreFlash: 0,
    lastScorer: null,
    events: [],
    rng: makeRng(seed),
    bot: { wantShoot: false, chargeT: 0, decideT: 0 },
  };
  return run;
}

function targetHoop(i) { return i === 0 ? COURT.right : COURT.left; }

// ---- 投篮：弹道解算 + 误差（蓄力/防守/随机） --------------------------------
export function doShoot(run, i, charge) {
  const p = run.players[i];
  if (!p.hasBall) return { ok: false };
  p.hasBall = false;
  p.charging = false;
  const b = run.ball;
  b.holder = null;
  b.x = p.x + p.facing * 22;
  b.y = p.y - 52;
  b.prevY = b.y;
  const hoop = targetHoop(i);
  const G = WORLD.GRAVITY;
  const T = clamp(dist(b.x, b.y, hoop.x, hoop.y) / 560, 0.55, 1.05);
  let vx = (hoop.x - b.x) / T;
  let vy = (hoop.y - b.y - 0.5 * G * T * T) / T;

  const chargeErr = Math.abs(charge - RULES.idealCharge);
  const chargePenalty = charge < 0.35 ? 0.34 : clamp(chargeErr * 0.9, 0.03, 0.3);
  const opp = run.players[1 - i];
  const contested = dist(p.x, p.y, opp.x, opp.y) < PLAYER.CONTEST_RANGE && (opp.y < p.y - 8 || dist(p.x, p.y, opp.x, opp.y) < 70);
  const contestPenalty = contested ? 0.22 : 0;
  const errMag = chargePenalty + contestPenalty + 0.03;
  const ang = run.rng() * Math.PI * 2;
  vx += Math.cos(ang) * errMag * 180;
  vy += Math.sin(ang) * errMag * 110 - errMag * 30;

  b.vx = vx; b.vy = vy;
  b.pickupCd = RULES.shotPickupCd;
  b.lastShooter = i;
  run.events.push({ type: 'shoot', i });
  return { ok: true };
}

// ---- 玩家步进 --------------------------------------------------------------
function stepPlayer(run, i, input, dt) {
  const p = run.players[i];
  const speed = p.hasBall ? PLAYER.SPEED_BALL : PLAYER.SPEED;
  let target = 0;
  if (input.left) target -= speed;
  if (input.right) target += speed;
  if (target !== 0) p.facing = target > 0 ? 1 : -1;
  // 加速逼近目标速度
  const dv = target - p.vx;
  const maxDv = PLAYER.ACCEL * dt;
  p.vx += clamp(dv, -maxDv, maxDv);
  if (target === 0 && Math.abs(p.vx) < 20) p.vx = 0;

  if (input.jump && p.onGround) { p.vy = PLAYER.JUMP_V; p.onGround = false; }
  p.vy += WORLD.GRAVITY * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.y >= WORLD.GROUND_Y) { p.y = WORLD.GROUND_Y; p.vy = 0; p.onGround = true; }
  p.x = clamp(p.x, 40, WORLD.WIDTH - 40);

  if (p.stealCd > 0) p.stealCd -= dt;

  // 蓄力投篮
  if (p.hasBall) {
    if (input.shoot) {
      p.charging = true;
      p.charge = clamp(p.charge + dt / RULES.chargeTime, 0, 1);
    } else if (p.charging) {
      doShoot(run, i, p.charge);
      p.charge = 0;
    }
  } else {
    p.charging = false; p.charge = 0;
  }

  // 抢断
  if (input.steal && p.stealCd <= 0) {
    p.stealCd = PLAYER.STEAL_CD;
    const opp = run.players[1 - i];
    if (opp.hasBall && dist(p.x, p.y, opp.x, opp.y) < PLAYER.STEAL_RANGE) {
      if (run.rng() < PLAYER.STEAL_CHANCE) {
        opp.hasBall = false;
        opp.charging = false; opp.charge = 0;
        const b = run.ball;
        b.holder = null;
        b.x = opp.x; b.y = opp.y - 52; b.prevY = b.y;
        b.vx = (run.rng() - 0.5) * 220 + p.facing * 120;
        b.vy = -160;
        b.pickupCd = 0.25;
        run.events.push({ type: 'steal', i });
      } else {
        run.events.push({ type: 'stealMiss', i });
      }
    }
  }
}

// ---- 球物理 ----------------------------------------------------------------
function rimCollide(run, hx, hy) {
  const b = run.ball;
  for (const ex of [hx - COURT.rimHalf, hx + COURT.rimHalf]) {
    const d = dist(b.x, b.y, ex, hy);
    const min = BALL.R + COURT.rimR;
    if (d < min && d > 0.001) {
      const nx = (b.x - ex) / d, ny = (b.y - hy) / d;
      b.x = ex + nx * min; b.y = hy + ny * min;
      const dot = b.vx * nx + b.vy * ny;
      if (dot < 0) {
        if (-dot > 160) run.events.push({ type: 'rim' });
        b.vx -= (1 + BALL.REST) * dot * nx;
        b.vy -= (1 + BALL.REST) * dot * ny;
      }
    }
  }
}

function stepBall(run, dt) {
  const b = run.ball;
  if (b.holder !== null) {
    const p = run.players[b.holder];
    b.x = p.x + p.facing * 22;
    b.y = p.y - 52;
    b.vx = 0; b.vy = 0; b.prevY = b.y;
    return;
  }
  b.prevY = b.y;
  b.vy += WORLD.GRAVITY * dt;
  b.vx *= (1 - BALL.DRAG * dt);
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // 地面 / 墙
  if (b.y > WORLD.GROUND_Y - BALL.R) {
    if (b.vy > 180) run.events.push({ type: 'bounce' });
    b.y = WORLD.GROUND_Y - BALL.R;
    b.vy = -b.vy * BALL.REST;
    b.vx *= 0.85;
    if (Math.abs(b.vy) < 40) b.vy = 0;
  }
  if (b.x < BALL.R) { b.x = BALL.R; b.vx = -b.vx * BALL.REST; }
  if (b.x > WORLD.WIDTH - BALL.R) { b.x = WORLD.WIDTH - BALL.R; b.vx = -b.vx * BALL.REST; }

  // 篮板
  for (const side of ['left', 'right']) {
    const h = COURT[side];
    if (b.y > h.boardTop && b.y < h.boardBottom) {
      if (side === 'left' && b.vx < 0 && b.x - BALL.R < h.boardX && b.x > h.boardX - 24) {
        b.x = h.boardX + BALL.R; b.vx = -b.vx * BALL.REST;
      } else if (side === 'right' && b.vx > 0 && b.x + BALL.R > h.boardX && b.x < h.boardX + 24) {
        b.x = h.boardX - BALL.R; b.vx = -b.vx * BALL.REST;
      }
    }
  }

  // 筐沿
  rimCollide(run, COURT.left.x, COURT.left.y);
  rimCollide(run, COURT.right.x, COURT.right.y);

  if (b.pickupCd > 0) b.pickupCd -= dt;
}

// ---- 拾取 ------------------------------------------------------------------
function handlePossession(run) {
  const b = run.ball;
  if (b.holder !== null || b.pickupCd > 0) return;
  let best = -1, bestD = 1e9;
  for (const p of run.players) {
    const d = dist(b.x, b.y, p.x, p.y - 40);
    if (d < BALL.GRAB_RADIUS && d < bestD) { bestD = d; best = p.i; }
  }
  if (best >= 0) {
    run.players[best].hasBall = true;
    b.holder = best;
    b.vx = 0; b.vy = 0;
    run.events.push({ type: 'grab', i: best });
  }
}

// ---- 得分判定 --------------------------------------------------------------
function resetBall(run) {
  const b = run.ball;
  b.x = WORLD.WIDTH / 2; b.y = 180;
  b.vx = (run.rng() - 0.5) * 60; b.vy = 0;
  b.holder = null; b.pickupCd = RULES.scoreResetCd; b.prevY = b.y; b.lastShooter = null;
  for (const p of run.players) { p.charging = false; p.charge = 0; }
}

function checkScore(run) {
  const b = run.ball;
  if (b.holder !== null || b.vy <= 0) return;
  for (const side of ['left', 'right']) {
    const h = COURT[side];
    const inX = b.x > h.x - COURT.rimHalf + BALL.R * 0.4 && b.x < h.x + COURT.rimHalf - BALL.R * 0.4;
    if (b.prevY <= h.y && b.y >= h.y && inX) {
      const scorer = side === 'right' ? 0 : 1;
      run.scores[scorer] += RULES.scoreValue;
      run.scoreFlash = 1.0;
      run.lastScorer = scorer;
      run.events.push({ type: 'score', scorer, scores: [...run.scores] });
      resetBall(run);
      return;
    }
  }
}

// ---- Bot AI ----------------------------------------------------------------
function botInput(run, dt) {
  const me = run.players[1], opp = run.players[0], b = run.ball;
  const inp = { left: false, right: false, jump: false, shoot: false, steal: false };
  const bot = run.bot;
  if (me.hasBall) {
    const spot = 560;                       // 攻左筐的舒适出手点
    if (me.x > spot + 30) inp.left = true;
    else if (me.x < spot - 30) inp.right = true;
    if (bot.wantShoot) {
      bot.chargeT += dt;
      inp.shoot = bot.chargeT < RULES.chargeTime * 0.95;
      if (!inp.shoot) { bot.wantShoot = false; bot.chargeT = 0; }
    } else if (Math.abs(me.x - spot) < 40 && (dist(me.x, me.y, opp.x, opp.y) > 130 || run.rng() < 0.012)) {
      bot.wantShoot = true; bot.chargeT = 0;
    }
  } else if (opp.hasBall) {
    if (opp.x < me.x - 26) inp.left = true;
    else if (opp.x > me.x + 26) inp.right = true;
    if (dist(me.x, me.y, opp.x, opp.y) < PLAYER.STEAL_RANGE + 8 && me.stealCd <= 0) inp.steal = true;
    if (opp.charging && dist(me.x, me.y, opp.x, opp.y) < PLAYER.CONTEST_RANGE && me.onGround) inp.jump = true;
  } else {
    if (b.x < me.x - 20) inp.left = true;
    else if (b.x > me.x + 20) inp.right = true;
    if (b.y < me.y - 90 && Math.abs(b.x - me.x) < 60 && me.onGround) inp.jump = true;
  }
  return inp;
}

// ---- 主步进 ----------------------------------------------------------------
export function tick(run, dt, input) {
  if (run.phase !== 'play') return;
  run.time += dt;
  const inputs = [input || {}, botInput(run, dt)];
  stepPlayer(run, 0, inputs[0], dt);
  stepPlayer(run, 1, inputs[1], dt);
  stepBall(run, dt);
  handlePossession(run);
  checkScore(run);
  if (run.scoreFlash > 0) run.scoreFlash -= dt;
  for (let i = 0; i < 2; i++) {
    if (run.scores[i] >= RULES.winScore) {
      run.phase = 'over';
      run.winner = i;
      run.events.push({ type: 'win', winner: i });
      return;
    }
  }
}

export function getHud(run) {
  return {
    phase: run.phase,
    scores: [...run.scores],
    winner: run.winner,
    holder: run.ball.holder,
    charge: run.players[0].charge,
    charging: run.players[0].charging,
    winScore: RULES.winScore,
    time: run.time,
  };
}

export function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}