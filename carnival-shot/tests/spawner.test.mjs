import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnTarget, spawnKind } from '../src/game/spawner.js';
import { mulberry32 } from '../src/game/rng.js';
import { TARGETS } from '../config/gameplay.js';
import { levelAt } from '../config/levels.js';

test('spawnTarget 产出合法目标实体', () => {
  const rng = mulberry32(1);
  const level = levelAt(1);
  const kinds = ['kite', 'lantern', 'moving', 'dive', 'golden', 'ghost', 'red'];
  for (const kind of kinds) {
    const e = spawnTarget(kind, level, rng);
    assert.equal(e.kind, kind);
    assert.ok(e.r > 0);
    assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y));
    assert.ok(Number.isFinite(e.life) && e.life > 0);
  }
});

test('spawnTarget 同 seed 同结果', () => {
  const a = spawnTarget('kite', levelAt(2), mulberry32(9));
  const b = spawnTarget('kite', levelAt(2), mulberry32(9));
  assert.deepEqual(a, b);
});

test('spawnKind 只返回关卡 spawns 里的种类', () => {
  const rng = mulberry32(3);
  const level = levelAt(3);
  const allowed = new Set(level.spawns.map((s) => s[0]));
  for (let i = 0; i < 40; i += 1) {
    assert.ok(allowed.has(spawnKind(rng, level)));
  }
});

test('移动靶 fly=slide 且初始在界内', () => {
  const e = spawnTarget('moving', levelAt(2), mulberry32(5));
  assert.equal(e.fly, 'slide');
  assert.ok(e.x >= 0 && e.x <= 1280);
});

test('俯冲鸭 fly=dive 且 vy 向下', () => {
  const e = spawnTarget('dive', levelAt(4), mulberry32(6));
  assert.equal(e.fly, 'dive');
  assert.ok(e.vy > 0);
});
