import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { FISH_TYPES } from '../config/game.config.js';

const SCENES = ['coral-dawn', 'reef-dusk', 'phosphor-night'];

test('关卡表：12 关、index 连续', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
});

test('关卡表：字段完整且类型合法', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.target > 0, `L${lv.index} target`);
    assert.ok(lv.time > 0, `L${lv.index} time`);
    assert.ok(lv.startCoins > 0, `L${lv.index} startCoins`);
    assert.ok(lv.spawnInterval > 0, `L${lv.index} spawnInterval`);
    assert.ok(lv.maxFish >= 3, `L${lv.index} maxFish`);
    assert.ok(lv.speedMult > 0, `L${lv.index} speedMult`);
    assert.ok(SCENES.includes(lv.scene), `L${lv.index} scene`);
    assert.ok(Array.isArray(lv.pool) && lv.pool.length >= 1, `L${lv.index} pool`);
    for (const p of lv.pool) assert.ok(FISH_TYPES[p], `L${lv.index} pool ${p}`);
    assert.ok(Array.isArray(lv.reef), `L${lv.index} reef`);
    assert.ok(Number.isInteger(lv.rare) && lv.rare >= 0 && lv.rare <= 2, `L${lv.index} rare`);
    assert.equal(typeof lv.combo, 'boolean');
    assert.equal(typeof lv.ghost, 'boolean');
    assert.equal(typeof lv.boss, 'boolean');
  }
});

test('关卡表：每关 newElement 唯一且非空', () => {
  const els = LEVELS.map((l) => (l.newElement || '').trim());
  assert.ok(els.every(Boolean));
  assert.equal(new Set(els).size, els.length);
});

test('章节：1-4 珊瑚晨光，5-8 岩礁黄昏，9-12 磷光夜海', () => {
  for (const lv of LEVELS) {
    const expect = lv.index <= 4 ? 'coral-dawn' : lv.index <= 8 ? 'reef-dusk' : 'phosphor-night';
    assert.equal(lv.scene, expect, `L${lv.index} 章节错误`);
  }
});

test('金币紧缩：L6/L10 半资', () => {
  assert.equal(LEVELS[5].startCoins, 50);
  assert.equal(LEVELS[9].startCoins, 50);
});

test('终局：L12 boss=true 且目标分 500', () => {
  assert.equal(LEVELS[11].boss, true);
  assert.equal(LEVELS[11].target, 500);
});

test('暗礁：仅 L5/L8 有暗礁', () => {
  assert.ok(LEVELS[4].reef.length > 0);
  assert.ok(LEVELS[7].reef.length > 0);
  for (let i = 0; i < 12; i += 1) {
    if (i !== 4 && i !== 7) assert.equal(LEVELS[i].reef.length, 0, `L${i + 1} 不应有暗礁`);
  }
});

test('鱼速关：L2/L8 speedMult 提升', () => {
  assert.ok(LEVELS[1].speedMult > 1);
  assert.ok(LEVELS[7].speedMult > 1);
});
