import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT, SCENE_KEYS } from '../config/levels.js';

test('关卡表：12 关、index 连续', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
});

test('关卡表：字段完整且类型合法', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.target > 0);
    assert.ok(lv.time > 0);
    assert.ok(SCENE_KEYS.includes(lv.scene));
    assert.equal(typeof lv.clam, 'boolean');
    assert.equal(typeof lv.jelly, 'boolean');
    assert.equal(typeof lv.dynamite, 'boolean');
    assert.equal(typeof lv.blackPearl, 'boolean');
    assert.equal(typeof lv.heavy, 'boolean');
    assert.ok(lv.dynamiteTool >= 1);
  }
});

test('三场景各 4 关', () => {
  for (const sc of SCENE_KEYS) {
    assert.equal(LEVELS.filter((lv) => lv.scene === sc).length, 4);
  }
});

test('目标金额单调递增', () => {
  for (let i = 1; i < LEVELS.length; i += 1) {
    assert.ok(LEVELS[i].target > LEVELS[i - 1].target, `L${i} 目标未递增`);
  }
});

test('newElement：12 关各不重复', () => {
  const elems = LEVELS.map((lv) => lv.newElement);
  assert.ok(elems.every((e) => e && e.trim().length > 0));
  assert.equal(new Set(elems).size, elems.length);
});

test('夜海场景：L9-12 均为 night-sea', () => {
  for (let i = 8; i < 12; i += 1) assert.equal(LEVELS[i].scene, 'night-sea');
});

test('特征分布：水母/炸药/珍珠贝/黑珍珠各有至少一关', () => {
  assert.ok(LEVELS.some((lv) => lv.jelly));
  assert.ok(LEVELS.some((lv) => lv.dynamite));
  assert.ok(LEVELS.some((lv) => lv.clam));
  assert.ok(LEVELS.some((lv) => lv.blackPearl));
  assert.ok(LEVELS.some((lv) => lv.heavy));
});
