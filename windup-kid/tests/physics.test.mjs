import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel } from '../src/game/level.js';
import { makeBody, stepBody } from '../src/game/physics.js';

const lv = parseLevel({
  id: 'p', name: {}, theme: 'wood', timeLimit: 60, entities: [],
  // 地面 ty=0；墙块在 tx=6, ty=1；F 是旗杆占位
  terrain: ['..........', '.P.......F', '......#...', '##########'],
});
const near = (a, b, eps = 1e-3) => Math.abs(a - b) < eps;

test('自由落体停在瓦片顶面，不穿透', () => {
  const b = makeBody({ x: 2.5, y: 6.5, w: 0.72, h: 0.95 });
  for (let i = 0; i < 120; i++) stepBody(b, lv, 1 / 60);
  assert.ok(near(b.y, 1.475), `y=${b.y}`);
  assert.equal(b.grounded, true);
  assert.equal(b.vy, 0);
});

test('水平撞墙：贴边且 vx 归零', () => {
  const b = makeBody({ x: 4.5, y: 1.475, w: 0.72, h: 0.95, vx: 20 });
  for (let i = 0; i < 60; i++) stepBody(b, lv, 1 / 60);
  assert.ok(near(b.x, 6 - 0.36), `x=${b.x}`);
  assert.equal(b.vx, 0);
});

test('单向平台：侧面是实心的，不能横穿', () => {
  const plv = parseLevel({
    id: 'o2', name: {}, theme: 'wood', timeLimit: 60, entities: [],
    terrain: ['..........', '...===...F', '.P........', '##########'],
  });
  const b = makeBody({ x: 1.5, y: 2.475, w: 0.72, h: 0.95, vx: 20 });
  for (let i = 0; i < 60; i++) stepBody(b, plv, 1 / 60);
  assert.ok(near(b.x, 3 - 0.36), `x=${b.x}`);
  assert.equal(b.vx, 0);
});

test('高速下落不穿地板（子步进）', () => {
  const b = makeBody({ x: 2.5, y: 2.4, w: 0.72, h: 0.95, vy: -32 });
  stepBody(b, lv, 0.1);
  assert.ok(near(b.y, 1.475), `y=${b.y}`);
  assert.equal(b.grounded, true);
});

test('单向平台：从下面穿过去，从上面站得住', () => {
  const plv = parseLevel({
    id: 'o', name: {}, theme: 'wood', timeLimit: 60, entities: [],
    terrain: ['..........', '===.....F.', '.P........', '##########'],
  });
  const up = makeBody({ x: 1.5, y: 0.475, w: 0.72, h: 0.95, vy: 25 });
  for (let i = 0; i < 20; i++) stepBody(up, plv, 1 / 60);
  assert.ok(up.y > 2.2, '应穿过平台');
  const down = makeBody({ x: 1.5, y: 5.5, w: 0.72, h: 0.95 });
  for (let i = 0; i < 60; i++) stepBody(down, plv, 1 / 60);
  assert.ok(near(down.y, 3.475), `y=${down.y}`);
});
