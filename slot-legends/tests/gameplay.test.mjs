import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  levelFor, sceneFor, paytableMult, paylineCount, freeSpinMult,
  escortCost, escortUnlocked, poolAt, freeSpinsFor, clamp,
  PAYLINES, PAYLINES_EXTRA, SCENE, BET_OPTIONS,
} from '../config/gameplay.js';

test('levelFor：spins → 等级映射', () => {
  assert.equal(levelFor(0), 1);
  assert.equal(levelFor(4), 1);
  assert.equal(levelFor(5), 2);
  assert.equal(levelFor(11), 2);
  assert.equal(levelFor(12), 3);
  assert.equal(levelFor(249), 11);
  assert.equal(levelFor(250), 12);
  assert.equal(levelFor(9999), 12);
});

test('sceneFor：章节色板切换（换章必换）', () => {
  assert.equal(sceneFor(1), SCENE.TAVERN);
  assert.equal(sceneFor(4), SCENE.TAVERN);
  assert.equal(sceneFor(5), SCENE.STRONGHOLD);
  assert.equal(sceneFor(8), SCENE.STRONGHOLD);
  assert.equal(sceneFor(9), SCENE.NIGHTMARKET);
  assert.equal(sceneFor(12), SCENE.NIGHTMARKET);
});

test('paytableMult：等级倍率', () => {
  assert.equal(paytableMult(3), 1);
  assert.equal(paytableMult(4), 1.1);
  assert.equal(paytableMult(7), 1.2);
  assert.equal(paytableMult(10), 1.3);
});

test('paylineCount：第 6 级加 2 条线', () => {
  assert.equal(paylineCount(5), PAYLINES.length);
  assert.equal(paylineCount(6), PAYLINES.length + PAYLINES_EXTRA.length);
});

test('freeSpinMult：免费旋转倍率固定 +50%', () => {
  assert.equal(freeSpinMult(10), 1.5);
  assert.equal(freeSpinMult(11), 1.5);
});

test('escortCost / escortUnlocked', () => {
  assert.equal(escortCost(10), 15);
  assert.equal(escortCost(1), 2); // 向上取整，最低 1.5 → 2
  assert.equal(escortCost(10, 11), 13); // 第 11 级起 +25% → 12.5 → 13
  assert.equal(escortUnlocked(2), false);
  assert.equal(escortUnlocked(3), true);
});

test('poolAt：新图标随等级解锁', () => {
  assert.equal(poolAt(1).blade, undefined);
  assert.equal(poolAt(1).ingot, undefined);
  assert.ok(poolAt(3).blade > 0);
  assert.ok(poolAt(5).ingot > 0);
  assert.ok(poolAt(12).ingot > poolAt(5).ingot, '第 12 级元宝权重上调');
  assert.ok(poolAt(8).token > poolAt(1).token, '第 8 级散布局权重上调');
});

test('freeSpinsFor：散布数 → 免费次数', () => {
  assert.equal(freeSpinsFor(3), 10);
  assert.equal(freeSpinsFor(4), 15);
  assert.equal(freeSpinsFor(5), 20);
});

test('clamp 边界', () => {
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
  assert.equal(clamp(5, 0, 10), 5);
});

test('BET_OPTIONS 单调递增且含最小值', () => {
  for (let i = 1; i < BET_OPTIONS.length; i += 1) {
    assert.ok(BET_OPTIONS[i] > BET_OPTIONS[i - 1]);
  }
  assert.equal(BET_OPTIONS[0], 1);
});
