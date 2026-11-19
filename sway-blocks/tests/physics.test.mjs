import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeWorld, makeBody, makeBox, makeCircle, makePoly, makeDistanceJoint, V,
} from '../src/game/physics.js';

test('箱体落到地面并静止', () => {
  const world = makeWorld(V(0, 2000));
  world.addBody(makeBody(makeBox(400, 20), 0, 600, { isStatic: true }));
  const box = makeBody(makeBox(50, 50), 0, 100, {});
  world.addBody(box);
  for (let i = 0; i < 240; i += 1) world.step(1 / 60);
  assert.ok(Math.abs(box.vy) < 30, `vy 应接近 0，实际 ${box.vy}`);
  assert.ok(box.y > 500 && box.y < 560, `箱体应停在地面附近，实际 y=${box.y}`);
  assert.ok(Math.abs(box.angle) < 0.05, '箱体应保持正立');
});

test('圆落到地面并静止', () => {
  const world = makeWorld(V(0, 2000));
  world.addBody(makeBody(makeBox(400, 20), 0, 600, { isStatic: true }));
  const c = makeBody(makeCircle(50), 0, 100, {});
  world.addBody(c);
  for (let i = 0; i < 240; i += 1) world.step(1 / 60);
  assert.ok(Math.abs(c.vy) < 30, `vy 应接近 0，实际 ${c.vy}`);
  assert.ok(Math.abs(c.y - 530) < 30, `圆应停在地面附近，实际 y=${c.y}`);
});

test('三角形落到地面并静止', () => {
  const world = makeWorld(V(0, 2000));
  world.addBody(makeBody(makeBox(400, 20), 0, 600, { isStatic: true }));
  const tri = makeBody(makePoly([V(0, -40), V(40, 30), V(-40, 30)]), 0, 100, {});
  world.addBody(tri);
  for (let i = 0; i < 240; i += 1) world.step(1 / 60);
  assert.ok(Math.abs(tri.vy) < 30, `vy 应接近 0，实际 ${tri.vy}`);
  assert.ok(tri.y > 500, `三角应停在地面附近，实际 y=${tri.y}`);
});

test('两块箱体堆叠稳定', () => {
  const world = makeWorld(V(0, 2000));
  world.addBody(makeBody(makeBox(400, 20), 0, 600, { isStatic: true }));
  const a = makeBody(makeBox(60, 60), 0, 100, {});
  const b = makeBody(makeBox(60, 60), 0, 30, {});
  world.addBody(a);
  world.addBody(b);
  for (let i = 0; i < 400; i += 1) world.step(1 / 60);
  assert.ok(a.y > 500 && a.y < 560, `下层应在地面，实际 ${a.y}`);
  assert.ok(b.y < a.y, '上层应叠在下层上方');
  assert.ok(Math.abs(a.x) < 15 && Math.abs(b.x) < 15, `堆叠应保持居中，a.x=${a.x} b.x=${b.x}`);
});

test('距离关节：摆锤绕锚点摆动', () => {
  const world = makeWorld(V(0, 2000));
  const anchor = makeBody(makeCircle(2), 0, 100, { isStatic: true });
  world.addBody(anchor);
  const bob = makeBody(makeCircle(20), 300, 400, {});
  world.addBody(bob);
  world.addJoint(makeDistanceJoint(anchor, bob, V(0, 0), V(0, 0), 500));
  for (let i = 0; i < 60; i += 1) world.step(1 / 60);
  const dist = Math.hypot(bob.x - anchor.x, bob.y - anchor.y);
  assert.ok(Math.abs(dist - 500) < 2, `绳长应保持 500，实际 ${dist}`);
});

test('圆与多边形（圆落箱上）', () => {
  const world = makeWorld(V(0, 2000));
  const plat = makeBody(makeBox(200, 30), 0, 600, { isStatic: true });
  world.addBody(plat);
  const c = makeBody(makeCircle(50), 0, 200, {});
  world.addBody(c);
  for (let i = 0; i < 240; i += 1) world.step(1 / 60);
  assert.ok(Math.abs(c.vy) < 30, `圆应静止，vy=${c.vy}`);
  assert.ok(Math.abs(c.y - 520) < 30, `圆应停在平台顶，y=${c.y}`);
});
