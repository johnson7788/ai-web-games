import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { GAME, STEP } from '../config/game.config.js';
import { LEVELS } from '../config/levels.js';

test('初始状态：卡车停在起点平台、墨量正确、倒计时为正', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.level, 1);
  assert.equal(run.state.inkLeft, LEVELS[0].ink);
  assert.ok(run.state.timeLeft > 0);
  assert.ok(run.state.truck.onGround);
});

test('画一笔会消耗一格墨并生成一条路', () => {
  const run = createRun(0, { seed: 1 });
  const r = run.drawPath([{ x: 200, y: 470 }, { x: 400, y: 470 }]);
  assert.equal(r.ok, true);
  assert.equal(run.state.tracks.length, 1);
  assert.equal(run.state.strokes, 1);
  assert.equal(run.state.inkLeft, LEVELS[0].ink - 1);
});

test('单击（不足两点）不消耗墨也不生成路', () => {
  const run = createRun(0, { seed: 1 });
  run.beginStroke(200, 470);
  const r = run.endStroke();
  assert.equal(r.ok, false);
  assert.equal(run.state.tracks.length, 0);
  assert.equal(run.state.inkLeft, LEVELS[0].ink);
});

test('墨用完后再画会失败', () => {
  const run = createRun(0, { seed: 1 });
  run.state.inkLeft = 0;
  const r = run.drawPath([{ x: 200, y: 470 }, { x: 400, y: 470 }]);
  assert.equal(r.ok, false);
});

test('直线通路 + 向右发车 → 到达终点并胜出', () => {
  const run = createRun(0, { seed: 1 });
  run.drawPath([{ x: 200, y: 470 }, { x: 1085, y: 470 }]);
  run.setDrive(1);
  let guard = 2000;
  while (guard-- > 0 && run.state.phase === 'playing') run.step(STEP);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1);
});

test('路在中途断开 → 卡车坠入火池（fell）', () => {
  const run = createRun(0, { seed: 1 });
  run.drawPath([{ x: 200, y: 470 }, { x: 600, y: 470 }]);
  run.setDrive(1);
  let guard = 2000;
  while (guard-- > 0 && run.state.phase === 'playing') run.step(STEP);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.reason, 'fell');
});

test('路穿过火花束 → 烧毁（spark）', () => {
  const run = createRun(1, { seed: 1 });
  run.drawPath([{ x: 200, y: 470 }, { x: 1085, y: 470 }]);
  run.setDrive(1);
  let guard = 3000;
  while (guard-- > 0 && run.state.phase === 'playing') run.step(STEP);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.reason, 'spark');
});

test('无输入 → 倒计时归零（time）', () => {
  const run = createRun(0, { seed: 1 });
  let guard = 3000;
  while (guard-- > 0 && run.state.phase === 'playing') run.step(STEP);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.reason, 'time');
});

test('L3 绕行路径能吃到两颗核心并得到 3 星', () => {
  const run = createRun(2, { seed: 1 });
  run.drawPath([
    { x: 200, y: 470 }, { x: 350, y: 260 }, { x: 560, y: 260 },
    { x: 700, y: 540 }, { x: 860, y: 540 }, { x: 1085, y: 470 },
  ]);
  run.setDrive(1);
  let guard = 4000;
  while (guard-- > 0 && run.state.phase === 'playing') run.step(STEP);
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.collected, 2);
  assert.equal(run.state.stars, 3);
});

test('事件流：draw / drive / tick / win 都能被 drainEvents 取出', () => {
  const run = createRun(0, { seed: 1 });
  run.drawPath([{ x: 200, y: 470 }, { x: 1085, y: 470 }]);
  run.setDrive(1);
  let guard = 2000;
  while (guard-- > 0 && run.state.phase === 'playing') run.step(STEP);
  const evs = run.drainEvents();
  const types = new Set(evs.map((e) => e.type));
  assert.ok(types.has('draw'));
  assert.ok(types.has('drive'));
  assert.ok(types.has('tick'));
  assert.ok(types.has('win'));
});

test('surfaceY 在无路处返回 null，有路处返回路面 y', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.surfaceY(500), null);
  run.drawPath([{ x: 400, y: 300 }, { x: 600, y: 300 }]);
  assert.equal(run.surfaceY(500), 300);
});

test('mulberry32 是确定性随机源', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});
