import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { WORLD, STEP, BIRD, PIPE, ORB, SHIELD } from '../config/game.config.js';

function playingRun(seed = 7) {
  const run = createRun({ seed, best: 0 });
  run.start();
  return run;
}

test('start 后 phase 为 playing', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.state.phase, 'ready');
  const res = run.start();
  assert.equal(res.ok, true);
  assert.equal(run.state.phase, 'playing');
});

test('拍翼后 vy 为负（向上）', () => {
  const run = playingRun();
  const res = run.flap();
  assert.equal(res.ok, true);
  assert.ok(run.state.bird.vy < 0, 'vy 应该向上');
});

test('重力把 vy 逐渐拉回向下', () => {
  const run = playingRun();
  run.flap();
  const v0 = run.state.bird.vy;
  for (let i = 0; i < 30; i += 1) run.step(STEP);
  assert.ok(run.state.bird.vy > v0, '重力应该让 vy 变大（向下）');
});

test('随机数 mulberry32 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('越过管道后得分 +1', () => {
  const run = playingRun();
  const pipe = run.state.pipes[0];
  pipe.x = BIRD.X - 1;
  pipe.gapY = run.state.bird.y;
  pipe.gapH = 200;
  pipe.orbActive = false;
  run.step(STEP);
  assert.equal(run.state.score, 1);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'score'), '应该发出 score 事件');
});

test('擦边过管触发 nearMiss 且 combo 递增', () => {
  const run = playingRun();
  const pipe = run.state.pipes[0];
  pipe.x = BIRD.X - 1;
  pipe.gapH = 200;
  pipe.gapY = pipe.gapH / 2 + 40; // 顶部间隙很靠上
  run.state.bird.y = pipe.gapY - pipe.gapH / 2 + 5; // 贴近顶部边缘
  pipe.orbActive = false;
  run.step(STEP);
  assert.ok(run.state.combo >= 2, '擦边应该让 combo 递增');
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'nearMiss'), '应该发出 nearMiss 事件');
});

test('收集光珠 +2 分并充能护盾', () => {
  const run = playingRun();
  const pipe = run.state.pipes[0];
  pipe.x = BIRD.X;
  pipe.gapY = run.state.bird.y; // 间隙中心对准小鸟，确保不撞柱
  pipe.gapH = 400;
  pipe.orbX = BIRD.X;
  pipe.orbY = run.state.bird.y;
  pipe.orbActive = true;
  pipe.orbTaken = false;
  pipe.scored = true; // 已过管，避免同帧把过管 +1 也算进去
  const s0 = run.state.score;
  run.step(STEP);
  assert.equal(run.state.score, s0 + ORB.SCORE);
  assert.equal(run.state.shield, 1);
});

test('护盾可抵消一次撞管', () => {
  const run = playingRun();
  run.state.shield = SHIELD.MAX;
  run.state.bird.y = 200;
  const pipe = run.state.pipes[0];
  pipe.x = BIRD.X;
  pipe.gapY = 400;
  pipe.gapH = 100; // 顶部管道覆盖 200 高度的小鸟
  pipe.orbActive = false;
  run.step(STEP);
  assert.equal(run.state.phase, 'playing', '护盾抵消后应仍存活');
  assert.equal(run.state.shield, 0);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'shieldBreak'), '应该发出 shieldBreak 事件');
});

test('无护盾撞管死亡', () => {
  const run = playingRun();
  run.state.bird.y = 200;
  const pipe = run.state.pipes[0];
  pipe.x = BIRD.X;
  pipe.gapY = 400;
  pipe.gapH = 100;
  pipe.orbActive = false;
  run.step(STEP);
  assert.equal(run.state.phase, 'dead');
  assert.equal(run.state.reason, 'pipe');
});

test('落地死亡', () => {
  const run = playingRun();
  run.state.bird.y = WORLD.GROUND_Y - BIRD.R + 2;
  run.step(STEP);
  assert.equal(run.state.phase, 'dead');
  assert.equal(run.state.reason, 'ground');
});

test('飞出天花板死亡', () => {
  const run = playingRun();
  run.state.bird.y = BIRD.R - 1;
  run.step(STEP);
  assert.equal(run.state.phase, 'dead');
  assert.equal(run.state.reason, 'ceiling');
});

test('难度阶梯：score 到 8 升到 SECTOR 2', () => {
  const run = playingRun();
  run.state.score = 7;
  const pipe = run.state.pipes[0];
  pipe.x = BIRD.X - 1;
  pipe.gapY = run.state.bird.y;
  pipe.gapH = 200;
  pipe.orbActive = false;
  run.step(STEP); // score 7 → 8
  assert.equal(run.state.score, 8);
  assert.equal(run.state.level, 2);
});

test('死亡后 step 不再推进', () => {
  const run = playingRun();
  run.state.bird.y = WORLD.GROUND_Y - BIRD.R + 2;
  run.step(STEP);
  const t = run.state.time;
  run.step(STEP);
  assert.equal(run.state.time, t, '死亡后时间应冻结');
});

test('新纪录发出 best 事件', () => {
  const run = createRun({ seed: 3, best: 2 });
  run.start();
  run.state.bird.y = WORLD.GROUND_Y - BIRD.R + 2;
  run.step(STEP);
  assert.equal(run.state.newBest, false); // score 0 < best 2
  const run2 = createRun({ seed: 4, best: 0 });
  run2.start();
  run2.state.score = 5; // 5 > best(0)，才构成新纪录
  run2.state.bird.y = WORLD.GROUND_Y - BIRD.R + 2;
  run2.step(STEP);
  assert.equal(run2.state.newBest, true);
  const evs = run2.drainEvents();
  assert.ok(evs.some((e) => e.type === 'best'), '应该发出 best 事件');
});
