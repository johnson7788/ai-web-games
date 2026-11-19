import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32, STEP } from '../src/game/sim.js';
import { generateLevel } from '../src/game/level.js';
import { LEVELS } from '../config/levels.js';
import { WORLD, PHYS } from '../config/game.config.js';

function drain(run) {
  const ev = run.drainEvents();
  return ev;
}

test('开局：phase=playing，青蛙站在池底大荷叶上', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.frog.onLeaf, true);
  assert.equal(run.state.frog.leafId, 0);
  assert.equal(run.state.score, 0);
  assert.ok(run.state.goalY > 0);
});

test('跳跃：按跳后离叶、vy 为正、事件含 jump', () => {
  const run = createRun(0, { seed: 1 });
  drain(run);
  const res = run.jump();
  assert.equal(res.ok, true);
  assert.equal(run.state.frog.onLeaf, false);
  assert.ok(run.state.frog.vy > 0);
  const ev = drain(run);
  assert.ok(ev.some((e) => e.type === 'jump'));
});

test('空中不可再跳', () => {
  const run = createRun(0, { seed: 1 });
  run.jump();
  const res = run.jump();
  assert.equal(res.ok, false);
});

test('重力：起跳后 vy 递减（向下加速度）', () => {
  const run = createRun(0, { seed: 1 });
  run.jump();
  const vy0 = run.state.frog.vy;
  run.step(STEP);
  assert.ok(run.state.frog.vy < vy0);
});

test('落地：起跳后多帧会落在某片荷叶上', () => {
  const run = createRun(0, { seed: 1 });
  run.jump();
  for (let i = 0; i < 90; i += 1) run.step(STEP);
  assert.equal(run.state.frog.onLeaf, true);
});

test('萤火虫：靠近即收集，得分=基础分×连击', () => {
  const run = createRun(0, { seed: 1 });
  const f = run.state.frog;
  run.state.fireflyList.push({ id: 't', x: f.x, y: f.y, taken: false });
  run.step(STEP);
  assert.equal(run.state.fireflies, 1);
  assert.equal(run.state.combo, 1);
  assert.equal(run.state.score, 10);
});

test('连击：连续抓萤火虫叠加倍率', () => {
  const run = createRun(0, { seed: 1 });
  const f = run.state.frog;
  run.state.fireflyList.push({ id: 'a', x: f.x, y: f.y, taken: false });
  run.state.fireflyList.push({ id: 'b', x: f.x + 1, y: f.y, taken: false });
  run.step(STEP);
  assert.equal(run.state.combo, 2);
  assert.equal(run.state.score, 30); // 10×1 + 10×2
});

test('落地清空连击', () => {
  const run = createRun(0, { seed: 1 });
  const f = run.state.frog;
  run.state.fireflyList.push({ id: 'a', x: f.x, y: f.y, taken: false });
  run.step(STEP);
  assert.equal(run.state.combo, 1);
  run.jump();
  for (let i = 0; i < 90; i += 1) run.step(STEP);
  assert.equal(run.state.combo, 0);
});

test('撞瓢虫判负并计死亡', () => {
  const run = createRun(0, { seed: 1 });
  const f = run.state.frog;
  run.state.enemies = [{ id: 'e', kind: 'ladybug', leafId: -1, x: f.x, y: f.y, dir: 1, speed: 0, w: 30, h: 18, minX: 0, maxX: 1000, pauseT: 0 }];
  run.step(STEP);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.deaths, 1);
});

test('抵达莲花门判胜', () => {
  const run = createRun(0, { seed: 1 });
  run.state.frog.onLeaf = false;
  run.state.frog.leafId = -1;
  run.state.frog.vy = 0;
  run.state.frog.y = run.state.goalY + 10;
  run.step(STEP);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.result.won);
});

test('跌到相机下方判负', () => {
  const run = createRun(0, { seed: 1 });
  run.state.camAlt = 400;
  run.state.frog.y = 350; // 低于 camAlt-24
  run.state.frog.onLeaf = false;
  run.state.frog.leafId = -1;
  run.state.frog.vy = -100;
  run.step(STEP);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.reason, 'fall');
});

test('同一 seed 关卡布局可复现', () => {
  const a = generateLevel(LEVELS[0], 7);
  const b = generateLevel(LEVELS[0], 7);
  assert.equal(a.goalY, b.goalY);
  assert.deepEqual(a.leaves.map((l) => l.x), b.leaves.map((l) => l.x));
  assert.deepEqual(a.enemies.map((e) => e.leafId), b.enemies.map((e) => e.leafId));
});

test('相邻荷叶 x 重叠 ≥ 最小重叠，保证可攀爬', () => {
  const layout = generateLevel(LEVELS[0], 42);
  for (let i = 1; i < layout.leaves.length; i += 1) {
    const p = layout.leaves[i - 1];
    const c = layout.leaves[i];
    const overlap = Math.min(p.x + p.w, c.x + c.w) - Math.max(p.x, c.x);
    assert.ok(overlap >= 92 - 1e-6, `叶 ${i} 重叠 ${overlap}`);
  }
});

test('弹簧叶落地会弹起（vy 变大）', () => {
  const run = createRun(1, { seed: 5 });
  // 找到弹簧叶，把青蛙放到它正上方，自由落体落上后应被弹起
  const spring = run.state.leaves.find((l) => l.kind === 'spring');
  assert.ok(spring, '第二关应有弹簧叶');
  run.state.enemies = []; // 清掉敌人，隔离测试弹簧弹跳本身
  run.state.thorns = [];
  run.state.frog.onLeaf = false;
  run.state.frog.leafId = -1;
  run.state.frog.x = spring.x + spring.w / 2;
  run.state.frog.y = spring.y + 40;
  run.state.frog.vy = 0;
  for (let i = 0; i < 60 && !(run.state.frog.vy > 0); i += 1) run.step(STEP);
  assert.ok(run.state.frog.vy > 0, '弹起');
});

test('getHud 返回必要字段', () => {
  const run = createRun(0, { seed: 1 });
  const h = run.getHud();
  assert.equal(h.level, 1);
  assert.equal(typeof h.score, 'number');
  assert.equal(typeof h.combo, 'number');
  assert.equal(typeof h.fireflies, 'number');
  assert.ok(h.goalY > 0);
});

test('mulberry32 可复现', () => {
  const r1 = mulberry32(99);
  const r2 = mulberry32(99);
  assert.equal(r1(), r2());
  assert.equal(r1(), r2());
});
