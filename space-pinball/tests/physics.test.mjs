import { test } from 'node:test';
import assert from 'node:assert/strict';
import { circleSegment, circleCircle, bounce, speed } from '../src/game/physics.js';

test('circleSegment 命中：返回法线指向圆心、穿透深度 >0', () => {
  const c = circleSegment(50, 5, 10, { x1: 0, y1: 0, x2: 100, y2: 0 });
  assert.equal(c.hit, true);
  assert.ok(Math.abs(c.penetration - 5) < 1e-6, `penetration=${c.penetration}`);
  assert.ok(Math.abs(c.nx) < 1e-6, '水平墙法线应垂直');
  assert.equal(c.ny, 1, '法线应从墙指向圆（+y）');
});

test('circleSegment 未命中：距离大于半径', () => {
  const c = circleSegment(50, 50, 10, { x1: 0, y1: 0, x2: 100, y2: 0 });
  assert.equal(c.hit, false);
});

test('circleSegment 端点外：投影钳制到端点', () => {
  const c = circleSegment(100, 8, 10, { x1: 0, y1: 0, x2: 100, y2: 0 });
  assert.equal(c.hit, true);
  assert.ok(Math.abs(c.px - 100) < 1e-6 && Math.abs(c.py) < 1e-6);
});

test('circleCircle 命中与法线方向', () => {
  const c = circleCircle(29, 0, 10, 0, 0, 20);
  assert.equal(c.hit, true);
  assert.equal(c.nx, 1);
  assert.equal(c.ny, 0);
});

test('circleCircle 未命中', () => {
  const c = circleCircle(40, 0, 10, 0, 0, 20);
  assert.equal(c.hit, false);
});

test('bounce：restitution<1 时能量衰减', () => {
  const before = speed(100, 0);
  const r = bounce(100, 0, -1, 0, 0.72);
  const after = speed(r.vx, r.vy);
  assert.ok(after < before, `after=${after} should < before=${before}`);
  assert.ok(r.vx < 0, '应反向');
});

test('bounce：法向反弹角对称（垂直墙，切向不变）', () => {
  const r = bounce(80, 40, -1, 0, 0.9);
  assert.ok(Math.abs(r.vy - 40) < 1e-9, '切向速度不变');
  assert.ok(r.vx < 0, '法向反向');
  assert.ok(Math.abs(r.vx + 72) < 1e-9, '法向速度按 restitution 反转（80*0.9=72）');
});

test('bounce：正在远离时原样返回', () => {
  const r = bounce(100, 0, 1, 0, 0.72);
  assert.equal(r.vx, 100);
  assert.equal(r.vy, 0);
});

test('bounce：带表面速度时相对速度参与反射', () => {
  const r = bounce(0, 0, 1, 0, 0.5, 200, 0);
  assert.ok(r.vx > 0, '应被表面推出');
});
