// 纯逻辑：乒乓球（球物理 + 球拍碰撞 + AI + 计分）。
// 不碰 DOM / window / localStorage / Date.now；固定步长 tick(dt, input)。
import { TABLE, PADDLE, BALL_R, RULES } from '../../config/game.config.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const LEFT = TABLE.X;
const RIGHT = TABLE.X + TABLE.W;
const TOP = TABLE.Y;
const BOTTOM = TABLE.Y + TABLE.H;
const CX = TABLE.X + TABLE.W / 2;
const CY = TABLE.Y + TABLE.H / 2;

function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun({ seed = 1 } = {}) {
  return {
    ball: { x: CX, y: CY, vx: 0, vy: 0, speed: RULES.ballSpeed },
    player: { x: CX },
    ai: { x: CX },
    scores: [0, 0],
    phase: 'serve', // serve | play | over
    serveTimer: RULES.serveDelay,
    server: 0,
    winner: null,
    events: [],
    rng: makeRng(seed),
  };
}

function resetBall(run, server) {
  run.ball.x = CX;
  run.ball.y = CY;
  run.ball.vx = 0;
  run.ball.vy = 0;
  run.ball.speed = RULES.ballSpeed;
  run.phase = 'serve';
  run.serveTimer = RULES.serveDelay;
  run.server = server;
}

function launch(run) {
  const dir = run.server === 0 ? -1 : 1; // 玩家发球向上（朝 AI）
  const angle = (run.rng() - 0.5) * 0.8; // 随机横向
  run.ball.vx = Math.sin(angle) * run.ball.speed;
  run.ball.vy = dir * Math.cos(angle) * run.ball.speed;
  run.phase = 'play';
  run.events.push({ type: 'serve' });
}

function bouncePaddle(run, paddleX, isPlayer) {
  const b = run.ball;
  const offset = clamp((b.x - paddleX) / (PADDLE.W / 2), -1, 1);
  b.speed = Math.min(RULES.maxBallSpeed, b.speed + RULES.ballSpeedInc);
  const angle = offset * 0.9; // 最大约 51°
  b.vx = Math.sin(angle) * b.speed;
  b.vy = (isPlayer ? -1 : 1) * Math.cos(angle) * b.speed;
  run.events.push({ type: 'hit', player: isPlayer ? 0 : 1 });
}

function score(run, who) {
  run.scores[who] += 1;
  run.events.push({ type: 'point', who, scores: [...run.scores] });
  if (run.scores[who] >= RULES.winScore) {
    run.phase = 'over';
    run.winner = who;
    run.events.push({ type: 'win', winner: who });
  } else {
    resetBall(run, who);
  }
}

export function tick(run, dt, input = {}) {
  if (run.phase === 'over') return;

  // 玩家球拍
  const halfW = PADDLE.W / 2;
  if (input.targetX != null) {
    run.player.x = clamp(input.targetX, LEFT + halfW, RIGHT - halfW);
  } else {
    run.player.x = clamp(run.player.x + (input.move || 0) * RULES.paddleSpeed * dt, LEFT + halfW, RIGHT - halfW);
  }

  // AI 球拍
  const b = run.ball;
  const aiTarget = (run.phase === 'play' && b.vy < 0) ? b.x : CX;
  const dx = aiTarget - run.ai.x;
  const step = RULES.aiSpeed * dt;
  run.ai.x = clamp(run.ai.x + clamp(dx, -step, step), LEFT + halfW, RIGHT - halfW);

  if (run.phase === 'serve') {
    run.serveTimer -= dt;
    if (run.serveTimer <= 0) launch(run);
    return;
  }

  // 球移动
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // 左右墙
  if (b.x - BALL_R < LEFT) { b.x = LEFT + BALL_R; b.vx = Math.abs(b.vx); run.events.push({ type: 'wall' }); }
  if (b.x + BALL_R > RIGHT) { b.x = RIGHT - BALL_R; b.vx = -Math.abs(b.vx); run.events.push({ type: 'wall' }); }

  // 玩家球拍（下）
  if (b.vy > 0 && b.y + BALL_R >= PADDLE.PLAYER_Y && b.y + BALL_R <= PADDLE.PLAYER_Y + PADDLE.H + 14
    && Math.abs(b.x - run.player.x) <= halfW + BALL_R) {
    b.y = PADDLE.PLAYER_Y - BALL_R;
    bouncePaddle(run, run.player.x, true);
  }
  // AI 球拍（上）
  if (b.vy < 0 && b.y - BALL_R <= PADDLE.AI_Y + PADDLE.H && b.y - BALL_R >= PADDLE.AI_Y - 14
    && Math.abs(b.x - run.ai.x) <= halfW + BALL_R) {
    b.y = PADDLE.AI_Y + PADDLE.H + BALL_R;
    bouncePaddle(run, run.ai.x, false);
  }

  // 得分
  if (b.y - BALL_R > BOTTOM + 20) score(run, 1); // 玩家漏球 → AI 得分
  else if (b.y + BALL_R < TOP - 20) score(run, 0); // AI 漏球 → 玩家得分
}

export function getHud(run) {
  return {
    scores: [...run.scores],
    phase: run.phase,
    winner: run.winner,
    ballSpeed: Math.round(run.ball.speed),
    winScore: RULES.winScore,
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export const WIN_SCORE = RULES.winScore;