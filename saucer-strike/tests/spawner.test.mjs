import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPath } from '../src/game/spawner.js';
import { mulberry32 } from '../src/game/rng.js';

test('straight 路径：至少 2 点', () => {
  const rng = mulberry32(1);
  const p = buildPath(rng, 'straight');
  assert.ok(p.length >= 2);
});

test('zigzag 路径：≥4 点且折线上下摆动', () => {
  const rng = mulberry32(2);
  const p = buildPath(rng, 'zigzag');
  assert.ok(p.length >= 4);
  const ys = p.map((pt) => pt.y);
  assert.ok(new Set(ys).size >= 2, '应该有上下摆动的 y');
});

test('swoop 路径：从顶部进入再离场', () => {
  const rng = mulberry32(3);
  const p = buildPath(rng, 'swoop');
  assert.ok(p.length >= 3);
  assert.ok(p[0].y < 0);
  assert.ok(p[p.length - 1].y < 0);
});

test('hover 路径：包含悬停点 hold > 0', () => {
  const rng = mulberry32(4);
  const p = buildPath(rng, 'hover');
  assert.ok(p.some((pt) => (pt.hold || 0) > 0));
});

test('所有路径点坐标都在有限范围', () => {
  for (const type of ['straight', 'zigzag', 'swoop', 'hover']) {
    const rng = mulberry32(5);
    const p = buildPath(rng, type);
    for (const pt of p) {
      assert.ok(Number.isFinite(pt.x) && Number.isFinite(pt.y));
    }
  }
});

test('同 seed 同路径（确定性）', () => {
  const a = buildPath(mulberry32(9), 'zigzag');
  const b = buildPath(mulberry32(9), 'zigzag');
  assert.deepEqual(a, b);
});
