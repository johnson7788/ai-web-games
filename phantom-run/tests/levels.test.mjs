import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { isClearable, validateLevel } from '../src/game/level.js';

const SCENES = ['dusk-tower', 'moon-market', 'dawn-wall'];

test('关卡表：12 关、index 连续、三章各 4 关', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => {
    assert.equal(lv.index, i + 1);
    assert.ok(SCENES.includes(lv.scene));
  });
  for (const s of SCENES) {
    assert.equal(LEVELS.filter((lv) => lv.scene === s).length, 4);
  }
});

test('关卡表：字段完整且类型合法', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.speed > 0);
    assert.ok(lv.finishX > 0);
    assert.ok(typeof lv.newElement === 'string' && lv.newElement.length > 0);
    assert.ok(Array.isArray(lv.platforms) && lv.platforms.length >= 2);
    assert.ok(Array.isArray(lv.spikes));
    assert.ok(Array.isArray(lv.walls));
    assert.ok(Array.isArray(lv.moons));
    assert.ok(Array.isArray(lv.stars));
  }
});

test('关卡表：平台 kind 合法且 rune/collapse 有 state', () => {
  for (const lv of LEVELS) {
    for (const p of lv.platforms) {
      assert.ok(['ground', 'rune', 'collapse', 'moving'].includes(p.kind));
      assert.ok(p.w > 0 && p.h > 0);
      if (p.kind === 'rune' || p.kind === 'collapse') {
        assert.ok(['solid', 'phantom'].includes(p.state));
      }
    }
  }
});

test('关卡表：符文墙之前必有月光斑（≤300px）', () => {
  for (const lv of LEVELS) {
    for (const w of lv.walls) {
      const hasMoon = lv.moons.some((m) => m.x < w.x && w.x - m.x <= 300);
      assert.ok(hasMoon, `L${lv.index} 符文墙 @x=${w.x} 前缺月光斑`);
    }
  }
});

test('关卡表：终点落在最后地面段内', () => {
  for (const lv of LEVELS) {
    const lastGround = lv.platforms.filter((p) => p.kind === 'ground').reduce((m, p) => Math.max(m, p.x + p.w), 0);
    assert.ok(lv.finishX <= lastGround, `L${lv.index} 终点超出地面`);
  }
});

test('可解性：12 关全部可由「完美跳跃」通关', () => {
  for (const lv of LEVELS) {
    assert.ok(isClearable(lv.index - 1), `L${lv.index} 无法通关`);
  }
});

test('validateLevel：12 关全部零问题', () => {
  for (const lv of LEVELS) {
    assert.deepEqual(validateLevel(lv), [], `L${lv.index} 校验失败`);
  }
});
