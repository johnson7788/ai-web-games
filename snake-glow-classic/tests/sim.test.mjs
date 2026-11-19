import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, getHud, getState, drainEvents, decorateRun, mulberry32 } from '../src/game/sim.js';
import { WORLD, SNAKE, STAGES, RUN } from '../config/game.config.js';

test('初始：长度 4、playing、有食物', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.snake.length, SNAKE.INITIAL_LENGTH);
  assert.equal(run.phase, 'playing');
  assert.ok(run.food, '初始应有一个食物');
  assert.equal(run.score, 0);
});

test('前进：蛇头按方向右移', () => {
  const run = createRun({ seed: 1 });
  const hx = run.snake[0].x;
  stepRun(run, { dir: { x: 1, y: 0 } }, 1);
  assert.ok(run.snake[0].x > hx, '蛇头应向右前进');
});

test('禁止 180° 掉头', () => {
  const run = createRun({ seed: 1 });
  const hx = run.snake[0].x;
  stepRun(run, { dir: { x: -1, y: 0 } }, 1); // 当前向右，请求向左应被拒绝
  assert.ok(run.snake[0].x >= hx, '不应反向移动');
});

test('吃食物：变长并得分', () => {
  const run = createRun({ seed: 1 });
  const head = run.snake[0];
  run.food = { x: head.x + 1, y: head.y };
  const len = run.snake.length;
  stepRun(run, { dir: { x: 1, y: 0 } }, 1);
  assert.equal(run.snake.length, len + 1, '吃食物应 +1 节');
  assert.ok(run.score > 0, '吃食物应得分');
  assert.equal(run.foodEaten, 1);
});

test('连击：窗口内连续吃提升 combo', () => {
  const run = createRun({ seed: 1 });
  const head = run.snake[0];
  run.food = { x: head.x + 1, y: head.y };
  stepRun(run, { dir: { x: 1, y: 0 } }, 1);
  assert.equal(run.combo, 1);
  // 立即再喂一颗
  const h2 = run.snake[0];
  run.food = { x: h2.x + 1, y: h2.y };
  stepRun(run, { dir: { x: 1, y: 0 } }, 1);
  assert.equal(run.combo, 2, '窗口内应连击到 2');
});

test('撞墙死亡', () => {
  const run = createRun({ seed: 1 });
  run.snake[0].x = WORLD.COLS - 1;
  stepRun(run, { dir: { x: 1, y: 0 } }, 1);
  assert.equal(run.phase, 'lost');
});

test('撞岩石死亡', () => {
  const run = createRun({ seed: 1 });
  const head = run.snake[0];
  run.rocks = [{ x: head.x + 1, y: head.y }];
  stepRun(run, { dir: { x: 1, y: 0 } }, 1);
  assert.equal(run.phase, 'lost');
});

test('咬到自己死亡', () => {
  const run = createRun({ seed: 1 });
  run.food = null;
  run.snake = [
    { x: 5, y: 5 },
    { x: 5, y: 6 },
    { x: 6, y: 6 },
    { x: 6, y: 5 },
  ];
  run.dir = { x: 0, y: 1 };
  stepRun(run, { dir: { x: 0, y: 1 } }, 1);
  assert.equal(run.phase, 'lost');
});

test('冲刺消耗能量', () => {
  const run = createRun({ seed: 1 });
  const e0 = run.energy;
  stepRun(run, { dir: null, boost: true }, 1 / 60);
  assert.ok(run.energy < e0, '冲刺应消耗能量');
  assert.equal(run.boosting, true);
});

test('第 2 段：40s 出现岩石并升段', () => {
  const run = createRun({ seed: 1 });
  run.time = 40;
  run.elapsedMs = 40000;
  stepRun(run, {}, 1 / 60);
  assert.equal(run.stage, 2);
  assert.ok(run.rocks.length > 0, '第 2 段应有岩石');
});

test('120s 计时胜利', () => {
  const run = createRun({ seed: 1 });
  run.time = RUN.TIME_LIMIT_SEC;
  run.elapsedMs = RUN.TIME_LIMIT_SEC * 1000;
  stepRun(run, {}, 1 / 60);
  assert.equal(run.phase, 'won');
});

test('事件：drainEvents 返回并清空', () => {
  const run = createRun({ seed: 1 });
  const head = run.snake[0];
  run.food = { x: head.x + 1, y: head.y };
  stepRun(run, { dir: { x: 1, y: 0 } }, 1);
  const events = drainEvents(run);
  assert.ok(events.some((e) => e.type === 'food'));
  assert.equal(run.events.length, 0);
});

test('getHud / getState 形状正确', () => {
  const run = createRun({ seed: 1 });
  const hud = getHud(run);
  assert.equal(typeof hud.score, 'number');
  assert.equal(typeof hud.length, 'number');
  assert.equal(typeof hud.timeLeft, 'number');
  const st = getState(run);
  assert.equal(st.cols, WORLD.COLS);
  assert.equal(st.rows, WORLD.ROWS);
  assert.ok(Array.isArray(st.snake));
});

test('mulberry32 确定性', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const sa = [a(), a(), a()];
  const sb = [b(), b(), b()];
  assert.deepEqual(sa, sb);
});

test('decorateRun 提供 step/getHud/drainEvents 别名', () => {
  const run = decorateRun(createRun({ seed: 1 }));
  assert.equal(typeof run.step, 'function');
  assert.equal(typeof run.getHud, 'function');
  assert.equal(typeof run.drainEvents, 'function');
  run.step({ dir: { x: 1, y: 0 } });
  assert.ok(run.getHud().timeLeft <= RUN.TIME_LIMIT_SEC);
});
