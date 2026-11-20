import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { WORLD, GAME } from '../config/game.config.js';
import { LEVELS } from '../config/levels.js';

function placeBallOnBrick(run, brick, vx = 0, vy = 0) {
  run.state.balls = [{ x: brick.cx, y: brick.cy, vx, vy, r: GAME.BALL_R, stuck: false, dead: false }];
}

function stepN(run, n) {
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

test('冒烟：createRun → step → setPaddleTarget → launch → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  assert.equal(r.setPaddleTarget(400).ok, true);
  assert.equal(r.launch().ok, true);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'playing');
  const ev = r.drainEvents();
  assert.ok(Array.isArray(ev));
});

test('state 形状：L1 有 24 块砖、3 条命、1 颗粘球', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'playing');
  assert.equal(s.bricksTotal, 24);
  assert.equal(s.bricksRemaining, 24);
  assert.equal(s.lives, 3);
  assert.equal(s.balls.length, 1);
  assert.equal(s.balls[0].stuck, true);
});

test('发球：launch 释放粘球并发 serve 事件', () => {
  const r = createRun(0, { seed: 1 });
  const res = r.launch();
  assert.equal(res.ok, true);
  assert.equal(r.state.balls[0].stuck, false);
  assert.ok(r.drainEvents().some((e) => e.type === 'serve'));
});

test('自动发球：无输入时 SERVE_DELAY 后自动发射', () => {
  const r = createRun(0, { seed: 1 });
  stepN(r, Math.ceil((GAME.SERVE_DELAY + 0.3) * 60));
  assert.equal(r.state.balls[0].stuck, false);
});

test('挡板追踪：targetX 被钳制在边界内', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.state.paddle;
  r.setPaddleTarget(-100);
  assert.equal(p.targetX, 0);
  r.setPaddleTarget(99999);
  assert.equal(p.targetX, WORLD.WIDTH - p.w);
});

test('键盘微调：nudge 移动 targetX', () => {
  const r = createRun(0, { seed: 1 });
  r.setPaddleTarget(500);
  r.nudge(1);
  assert.equal(r.state.paddle.targetX, 500 + GAME.KEY_NUDGE);
});

test('挡板到位：setPaddleTarget 后逐步追到目标', () => {
  const r = createRun(0, { seed: 1 });
  r.setPaddleTarget(800);
  stepN(r, 90);
  assert.ok(Math.abs(r.state.paddle.x - 800) < 5);
});

test('破砖：命中普通砖后 bricksRemaining 减少、得分增加', () => {
  const r = createRun(0, { seed: 1 });
  const brick = r.state.bricks[0];
  placeBallOnBrick(r, brick);
  r.step(1 / 60);
  assert.ok(r.state.bricksRemaining < r.state.bricksTotal);
  assert.ok(r.state.score >= 10);
});

test('硬砖三连击触发窑火全开（L10 三级硬砖）', () => {
  const r = createRun(9, { seed: 1 });
  const brick = r.state.bricks.find((b) => b.kind === 'hard' && b.maxHp === 3);
  assert.ok(brick);
  placeBallOnBrick(r, brick);
  stepN(r, 3);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'kilnFire'));
  assert.ok(r.state.kilnFire > 0);
});

test('炸窑砖连锁：击碎炸窑砖会波及邻近砖（L6）', () => {
  const r = createRun(5, { seed: 1 });
  const before = r.state.bricksRemaining;
  const brick = r.state.bricks.find((b) => b.kind === 'blast');
  assert.ok(brick);
  placeBallOnBrick(r, brick);
  r.step(1 / 60);
  assert.ok(r.state.bricksRemaining <= before - 2, `只少了 ${before - r.state.bricksRemaining} 块`);
});

test('金釉砖给高分（L9）', () => {
  const r = createRun(8, { seed: 1 });
  const brick = r.state.bricks.find((b) => b.kind === 'gold');
  assert.ok(brick);
  placeBallOnBrick(r, brick);
  r.step(1 / 60);
  assert.ok(r.state.score >= 100);
});

test('穿透球：命中砖时不反弹', () => {
  const r = createRun(0, { seed: 1 });
  r.state.pierceT = 5;
  const brick = r.state.bricks[0];
  placeBallOnBrick(r, brick, 50, 0);
  r.step(1 / 60);
  assert.equal(r.state.balls[0].vx, 50);
});

test('道具加宽：接住 wide 后 paddle.w 变宽', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.state.paddle;
  r.state.powerUps = [{ kind: 'wide', x: p.x + 30, y: p.y, alive: true }];
  stepN(r, 2);
  assert.ok(r.state.wideT > 0);
  assert.equal(p.w, GAME.PADDLE_W_WIDE);
});

test('移动砖列：漂移列 x 随时间偏移（L4）', () => {
  const r = createRun(3, { seed: 1 });
  const brick = r.state.bricks.find((b) => b.move);
  assert.ok(brick);
  stepN(r, 30);
  assert.ok(Math.abs(brick.x - brick.bx) > 0.1);
});

test('下压砖墙：砖块整体缓降（L5）', () => {
  const r = createRun(4, { seed: 1 });
  const brick = r.state.bricks[0];
  const by = brick.by;
  stepN(r, 30);
  assert.ok(brick.y > by);
});

test('多球开局：L8 起始 2 颗球', () => {
  const r = createRun(7, { seed: 1 });
  assert.equal(r.state.balls.length, 2);
});

test('短挡板：L7 挡板宽度 80', () => {
  const r = createRun(6, { seed: 1 });
  assert.equal(r.state.paddle.w, 80);
});

test('失命：所有球落底后命数减一并重生粘球', () => {
  const r = createRun(0, { seed: 1 });
  r.state.balls = [{ x: 0, y: WORLD.HEIGHT + 200, vx: 0, vy: 0, r: GAME.BALL_R, stuck: false, dead: true }];
  r.step(1 / 60);
  assert.equal(r.state.lives, 2);
  assert.equal(r.state.balls.length, 1);
  assert.equal(r.state.balls[0].stuck, true);
});

test('终局失败：三条命耗尽 → phase lost', () => {
  const r = createRun(0, { seed: 1 });
  r.state.lives = 1;
  r.state.balls = [{ x: 0, y: WORLD.HEIGHT + 200, vx: 0, vy: 0, r: GAME.BALL_R, stuck: false, dead: true }];
  r.step(1 / 60);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
});

test('胜局：debugWin 清场 → phase won、三星、result.won', () => {
  const r = createRun(0, { seed: 1 });
  r.debugWin();
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
  assert.equal(r.state.result.stars, 3);
});

test('下压判负：砖墙压线触发 crushed（L5，快进模拟）', () => {
  const r = createRun(4, { seed: 1 });
  r._descendY = GAME.DESCEND_LINE - GAME.BRICK_TOP - 1; // 直接推到压线
  r.step(1 / 60);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'crushed');
});

test('mulberry32：同 seed 序列一致', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  for (let i = 0; i < 5; i += 1) assert.equal(a(), b());
});

test('getHud：返回 score/lives/bricksRemaining/balls', () => {
  const r = createRun(0, { seed: 1 });
  const h = r.getHud();
  assert.equal(typeof h.score, 'number');
  assert.equal(h.lives, 3);
  assert.equal(h.bricksRemaining, 24);
  assert.equal(h.balls, 1);
});

test('12 关均可 createRun 且 phase 初始 playing', () => {
  for (let i = 0; i < LEVELS.length; i += 1) {
    const r = createRun(i, { seed: i + 1 });
    assert.equal(r.state.phase, 'playing');
    assert.ok(r.state.bricksTotal > 0, `L${i + 1} 无砖`);
  }
});
