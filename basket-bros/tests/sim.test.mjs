import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, tick, doShoot, getHud, drainEvents, makeRng } from '../src/game/sim.js';
import { WORLD, COURT, BALL, RULES, PLAYER } from '../config/game.config.js';

const step = (run, n, input = {}) => { for (let i = 0; i < n; i++) tick(run, 1 / 60, input); };

test('创建：初始比分 0-0，球自由，两玩家就位', () => {
  const run = createRun({ seed: 7 });
  assert.deepEqual(run.scores, [0, 0]);
  assert.equal(run.ball.holder, null);
  assert.equal(run.players.length, 2);
  assert.equal(run.phase, 'play');
});

test('移动：右移使 P1 x 增大，且不能越界', () => {
  const run = createRun({ seed: 1 });
  const x0 = run.players[0].x;
  step(run, 30, { right: true });
  assert.ok(run.players[0].x > x0);
  step(run, 600, { right: true });
  assert.ok(run.players[0].x <= WORLD.WIDTH - 40);
});

test('跳跃：跳起后离开地面，最终落回', () => {
  const run = createRun({ seed: 1 });
  step(run, 2, { jump: true });
  assert.ok(run.players[0].y < WORLD.GROUND_Y);
  step(run, 120, {});
  assert.equal(run.players[0].y, WORLD.GROUND_Y);
  assert.equal(run.players[0].onGround, true);
});

test('拾取：自由球落到玩家附近会被持有', () => {
  const run = createRun({ seed: 1 });
  const p = run.players[0];
  run.ball.x = p.x; run.ball.y = p.y - 40; run.ball.vx = 0; run.ball.vy = 0; run.ball.pickupCd = 0;
  step(run, 1, {});
  assert.equal(run.ball.holder, 0);
  assert.equal(p.hasBall, true);
});

test('投篮：持球蓄力后释放，球变自由并朝目标筐方向', () => {
  const run = createRun({ seed: 3 });
  const p = run.players[0];
  p.hasBall = true; run.ball.holder = 0;
  doShoot(run, 0, RULES.idealCharge);
  assert.equal(p.hasBall, false);
  assert.equal(run.ball.holder, null);
  // 攻右筐 → 水平速度应为正
  assert.ok(run.ball.vx > 0);
  assert.ok(run.ball.vy < 0); // 向上出手
});

test('得分：球从上方穿过右筐口记 P1 两分', () => {
  const run = createRun({ seed: 1 });
  const h = COURT.right;
  run.ball.holder = null;
  run.ball.x = h.x; run.ball.y = h.y - 20; run.ball.prevY = h.y - 20;
  run.ball.vx = 0; run.ball.vy = 200; run.ball.pickupCd = 1;
  step(run, 20, {});
  assert.ok(run.scores[0] >= RULES.scoreValue);
});

test('得分：穿过左筐口记 P2 两分', () => {
  const run = createRun({ seed: 1 });
  const h = COURT.left;
  run.ball.holder = null;
  run.ball.x = h.x; run.ball.y = h.y - 20; run.ball.prevY = h.y - 20;
  run.ball.vx = 0; run.ball.vy = 200; run.ball.pickupCd = 1;
  step(run, 20, {});
  assert.ok(run.scores[1] >= RULES.scoreValue);
});

test('胜负：先到 11 分结束并记录胜者', () => {
  const run = createRun({ seed: 1 });
  run.scores[0] = RULES.winScore - 2;
  const h = COURT.right;
  run.ball.holder = null;
  run.ball.x = h.x; run.ball.y = h.y - 20; run.ball.prevY = h.y - 20;
  run.ball.vx = 0; run.ball.vy = 200; run.ball.pickupCd = 1;
  step(run, 20, {});
  assert.equal(run.phase, 'over');
  assert.equal(run.winner, 0);
});

test('抢断：靠近持球对手抢断可把球打落', () => {
  const run = createRun({ seed: 2 });
  const opp = run.players[1], me = run.players[0];
  opp.hasBall = true; run.ball.holder = 1;
  me.x = opp.x - 30; me.y = opp.y; me.stealCd = 0;
  // 多种子尝试，至少一次成功
  let succeeded = false;
  for (let s = 1; s <= 20 && !succeeded; s++) {
    const r = createRun({ seed: s });
    const o = r.players[1], m = r.players[0];
    o.hasBall = true; r.ball.holder = 1;
    m.x = o.x - 30; m.y = o.y; m.stealCd = 0;
    tick(r, 1 / 60, { steal: true });
    if (!o.hasBall && r.ball.holder === null) succeeded = true;
  }
  assert.ok(succeeded);
});

test('物理：球落地反弹且不超过地面', () => {
  const run = createRun({ seed: 1 });
  run.ball.holder = null; run.ball.pickupCd = 5;
  run.ball.x = 640; run.ball.y = 100; run.ball.vx = 0; run.ball.vy = 0;
  step(run, 240, {});
  assert.ok(run.ball.y <= WORLD.GROUND_Y - BALL.R + 1);
});

test('Bot：长时间自跑不崩溃，能得分直至终局', () => {
  const run = createRun({ seed: 5 });
  for (let i = 0; i < 60 * 60; i++) tick(run, 1 / 60, {});
  assert.ok(run.time > 0);
  // P1 挂机，bot 应能得分并取胜（或仍在进行）
  assert.ok(run.scores[1] > 0 || run.phase === 'over');
  assert.ok(['play', 'over'].includes(run.phase));
  if (run.phase === 'over') assert.ok(run.winner === 0 || run.winner === 1);
});

test('RNG：同种子可复现', () => {
  const a = makeRng(42), b = makeRng(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});