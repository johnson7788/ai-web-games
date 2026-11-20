// tests/spawner.test.mjs — 障碍生成 / 类型 / 间距 / 补给轮换
import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/game/rng.js';
import { pickType, makeObstacle, nextGap } from '../src/game/spawner.js';
import { SPAWN } from '../config/gameplay.js';
import { SEGMENTS } from '../config/levels.js';

test('makeObstacle low：w/h 符合配置', () => {
  const o = makeObstacle('low', 500);
  assert.equal(o.type, 'low');
  assert.ok(o.w > 0 && o.h > 0);
});

test('makeObstacle high 比 low 高', () => {
  assert.ok(makeObstacle('high', 0).h > makeObstacle('low', 0).h);
});

test('makeObstacle pit：h=0 且更宽', () => {
  const p = makeObstacle('pit', 0);
  assert.equal(p.h, 0);
  assert.ok(p.w > makeObstacle('low', 0).w);
});

test('makeObstacle rock 带 extraSpeed>1', () => {
  const r = makeObstacle('rock', 0);
  assert.ok(r.extraSpeed > 1);
});

test('double 展开成两个紧邻矮栏', () => {
  const made = makeObstacle('double', 1000);
  assert.ok(Array.isArray(made));
  assert.equal(made.length, 2);
  assert.equal(made[0].type, 'low');
  assert.equal(made[1].type, 'low');
  assert.ok(made[1].worldX > made[0].worldX);
});

test('pickType 只返回当前段 types 里的类型', () => {
  const rng = mulberry32(7);
  const seg = SEGMENTS[0];
  for (let i = 0; i < 200; i += 1) {
    const t = pickType(seg, rng, 0);
    assert.ok(seg.types.includes(t));
  }
});

test('nextGap 落在最小/最大间距之间', () => {
  const rng = mulberry32(9);
  for (let i = 0; i < 200; i += 1) {
    const g = nextGap(rng, 0.5);
    assert.ok(g >= SPAWN.MIN_GAP && g <= SPAWN.MAX_GAP);
  }
});

test('SEGMENTS：12 段、每段有场景与障碍轮换', () => {
  assert.equal(SEGMENTS.length, 12);
  for (const s of SEGMENTS) {
    assert.ok(['dawn', 'oasis', 'night'].includes(s.scene));
    assert.ok(s.types.length >= 1);
    assert.ok(s.lengthM > 0);
  }
});
