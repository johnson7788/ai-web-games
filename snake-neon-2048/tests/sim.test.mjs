import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

test('三关都已定义且 12×13', () => {
  assert.equal(LEVEL_COUNT, 3);
  for (const lv of LEVELS) {
    assert.equal(lv.cols, 12);
    assert.equal(lv.rows, 13);
    assert.equal(lv.tiles.length, 13);
    assert.ok(lv.tiles.every((row) => row.length === 12));
    assert.ok(lv.snake.parts.length >= 3);
  }
});

test('初始状态基线：idle / 蛇长 / 水果已生成', () => {
  const run = createRun(0, { seed: 1 });
  const s = run.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'idle');
  assert.equal(s.snake.length, 4);
  assert.ok(s.fruit, '应当生成了一个普通核心');
  assert.equal(s.golden, null);
  assert.equal(s.score, 0);
  assert.equal(s.target, 5);
});

test('无输入时 2 秒内不自动起步（idle 保持）', () => {
  const run = createRun(0, { seed: 1 });
  for (let i = 0; i < 120; i += 1) run.step(1 / 60); // 2s
  assert.equal(run.state.phase, 'idle');
});

test('超时自动起步（AUTO_LAUNCH）会让 noinput 基线死亡', () => {
  const run = createRun(0, { seed: 1 });
  for (let i = 0; i < 60 * 30; i += 1) run.step(1 / 60); // 30s
  assert.equal(run.state.phase, 'dead');
});

test('首次输入启动游戏并发出 start 事件', () => {
  const run = createRun(0, { seed: 1 });
  const res = run.setDir(0, -1);
  assert.equal(res.ok, true);
  assert.equal(run.state.phase, 'running');
  const ev = run.drainEvents();
  assert.ok(ev.some((e) => e.type === 'start'));
});

test('反向与同向输入被拒绝', () => {
  const run = createRun(0, { seed: 1 });
  run.setDir(0, -1); // 启动，方向向上
  assert.equal(run.setDir(0, -1).ok, false); // 同向
  assert.equal(run.setDir(0, 1).ok, false);  // 反向
  assert.equal(run.setDir(1, 0).ok, true);   // 合法转向
});

test('移动一格：头部按方向前进、尾巴让位（长度不变）', () => {
  const run = createRun(0, { seed: 1 });
  run.setDir(0, -1);
  const headBefore = { ...run.state.snake[0] };
  run.step(0.3);
  const headAfter = run.state.snake[0];
  assert.deepEqual(headAfter, { x: headBefore.x, y: headBefore.y - 1 });
  assert.equal(run.state.snake.length, 4);
});

test('吃到普通核心：分数 +1、生长、目标进度 +1', () => {
  const run = createRun(0, { seed: 1 });
  run.setDir(0, -1);
  const head = run.state.snake[0];
  run.state.fruit = { x: head.x, y: head.y - 1 };
  run.step(0.3);
  assert.equal(run.state.fruits, 1);
  assert.equal(run.state.score, 1);
  assert.equal(run.state.snake.length, 5);
  assert.ok(run.state.fruit, '吃完应立即生成下一个核心');
});

test('3 秒内连续进食累积连击，分数按连击加成', () => {
  const run = createRun(0, { seed: 1 });
  run.setDir(0, -1);
  // 第一次
  run.state.fruit = { x: run.state.snake[0].x, y: run.state.snake[0].y - 1 };
  run.step(0.3);
  assert.equal(run.state.combo, 1);
  assert.equal(run.state.score, 1);
  // 第二次（同方向继续）
  const h2 = run.state.snake[0];
  run.state.fruit = { x: h2.x, y: h2.y - 1 };
  run.step(0.3);
  assert.equal(run.state.combo, 2);
  assert.equal(run.state.score, 3); // 1 + 2
  assert.equal(run.state.maxCombo, 2);
});

test('撞墙死亡并发出 lose 事件', () => {
  const run = createRun(0, { seed: 1 });
  run.setDir(0, -1);
  // 直接把蛇头移到顶行边缘，向上一步即出界
  run.state.snake = [{ x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }];
  run.state.dir = { x: 0, y: -1 };
  run.state.moveAccum = 0;
  run.step(0.3);
  assert.equal(run.state.phase, 'dead');
  assert.ok(run.drainEvents().some((e) => e.type === 'lose'));
});

test('咬尾死亡（增长时尾巴不让位）', () => {
  const run = createRun(0, { seed: 1 });
  run.debug.forceDie();
  assert.equal(run.state.phase, 'dead');
});

test('吃满目标即胜利，并按最高连击结算星级', () => {
  const run = createRun(0, { seed: 1 });
  run.setDir(0, -1);
  run.state.maxCombo = 3;
  run.debug.forceWin();
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.stars, 3);
});

test('黄金核心：分数 +5 并触发慢动作', () => {
  const run = createRun(0, { seed: 1 });
  run.setDir(0, -1);
  run.debug.spawnGolden();
  assert.ok(run.state.golden, '应生成黄金核心');
  const head = run.state.snake[0];
  run.state.golden = { x: head.x, y: head.y - 1 };
  run.state.fruit = null;
  run.step(0.3);
  assert.equal(run.state.score, 5);
  assert.ok(run.state.slowUntil > run.state.time, '应进入慢动作');
});

test('mulberry32 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('L2/L3 含能量墙', () => {
  const l2 = createRun(1, { seed: 1 });
  const l3 = createRun(2, { seed: 1 });
  const walls = (s) => s.grid.flat().filter((c) => c.type === 1).length;
  assert.ok(walls(l2.state) > 0);
  assert.ok(walls(l3.state) > walls(l2.state));
});
