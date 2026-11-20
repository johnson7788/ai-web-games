import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, ringClear, circDist } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';

test('createRun 初始为 playing，读取第 1 关配置', () => {
  const run = createRun(0);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.levelIndex, 0);
  assert.equal(run.state.core.hp, 300);
  assert.equal(run.state.rings.length, 1);
  assert.equal(run.state.turret.hearts, 3);
});

test('发射：生成气泡、消耗冷却、计入 shots', () => {
  const run = createRun(0);
  const r1 = run.fire();
  const r2 = run.fire();
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, false);
  assert.equal(run.state.shots, 1);
  assert.equal(run.state.bubbles.length, 1);
});

test('气泡向上飞行（y 递减）', () => {
  const run = createRun(0);
  run.state.rings[0].speed = 0;
  run.fire();
  const y0 = run.state.bubbles[0].y;
  for (let i = 0; i < 8; i += 1) run.step();
  assert.ok(run.state.bubbles.length === 0 || run.state.bubbles[0].y < y0);
});

test('缺口竖直时中心弹道命中核心并加分', () => {
  const run = createRun(0);
  run.state.rings[0].speed = 0;
  run.state.rings[0].angle = Math.PI / 2;
  run.fire();
  for (let i = 0; i < 50; i += 1) run.step();
  assert.ok(run.state.core.hp < 300);
  assert.equal(run.state.hits, 1);
  assert.ok(run.state.gaps >= 1);
});

test('缺口水平时气泡反弹并砸到自己掉血', () => {
  const run = createRun(0);
  run.state.rings[0].speed = 0;
  run.state.rings[0].angle = 0;
  run.fire();
  for (let i = 0; i < 60; i += 1) run.step();
  assert.equal(run.state.turret.hearts, 2);
  assert.equal(run.state.combo, 0);
});

test('滑动躲开反弹气泡可免伤', () => {
  const run = createRun(0);
  run.state.rings[0].speed = 0;
  run.state.rings[0].angle = 0;
  run.fire();
  run.move(-1);
  for (let i = 0; i < 60; i += 1) run.step();
  assert.equal(run.state.turret.hearts, 3);
});

test('noinput 被核心尖刺击倒（失败存在性）', () => {
  const run = createRun(0);
  for (let i = 0; i < 60 * 15; i += 1) run.step();
  assert.equal(run.state.phase, 'lost');
});

test('连续命中叠加连击', () => {
  const run = createRun(0);
  run.state.rings[0].speed = 0;
  run.state.rings[0].angle = Math.PI / 2;
  run.fire();
  for (let i = 0; i < 50; i += 1) run.step();
  run.fire();
  for (let i = 0; i < 50; i += 1) run.step();
  assert.ok(run.state.combo >= 2);
  assert.equal(run.state.hits, 2);
});

test('击破核心进入 won 并产出星级', () => {
  const run = createRun(0);
  run.state.rings[0].speed = 0;
  run.state.rings[0].angle = Math.PI / 2;
  run.state.core.hp = 10;
  run.fire();
  for (let i = 0; i < 50; i += 1) run.step();
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1 && run.state.stars <= 3);
});

test('第 3 关有岩石障碍', () => {
  const run = createRun(2);
  assert.ok(run.state.rocks.length >= 2);
  assert.equal(run.state.rings.length, 2);
});

test('ringClear 缺口竖直放行、水平阻挡', () => {
  const ring = { radius: 250, angle: Math.PI / 2, gapArc: (70 * Math.PI) / 180 };
  assert.equal(ringClear(ring, 0), true);
  ring.angle = 0;
  assert.equal(ringClear(ring, 0), false);
});

test('circDist 圆周角距离在 [0, π] 内', () => {
  const d = circDist(Math.PI / 2, Math.PI / 2);
  assert.ok(d >= 0 && d <= Math.PI);
  assert.equal(d, 0);
});

test('关卡总数至少 8', () => {
  assert.ok(LEVELS.length >= 8);
});
