import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { generateLevel } from '../src/game/level.js';

test('关卡表：12 关、index 连续、场景合法', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  const scenes = ['town', 'clouds', 'rings'];
  LEVELS.forEach((lv, i) => {
    assert.equal(lv.index, i + 1);
    assert.ok(scenes.includes(lv.scene), `L${lv.index} 场景非法`);
    assert.ok(lv.targetHeight > 0);
    assert.ok(lv.cols >= 3 && lv.cols <= 6);
  });
});

test('关卡表：每关 newElement 唯一且非空', () => {
  const elements = LEVELS.map((lv) => lv.newElement);
  assert.ok(elements.every((e) => typeof e === 'string' && e.trim().length > 0));
  assert.equal(new Set(elements).size, elements.length);
});

test('关卡表：三场景覆盖（1-4 town / 5-8 clouds / 9-12 rings）', () => {
  for (let i = 0; i < 4; i += 1) assert.equal(LEVELS[i].scene, 'town');
  for (let i = 4; i < 8; i += 1) assert.equal(LEVELS[i].scene, 'clouds');
  for (let i = 8; i < 12; i += 1) assert.equal(LEVELS[i].scene, 'rings');
});

test('可解性：每一非全钢棚层，安全通道列都不是 steel', () => {
  for (let idx = 0; idx < LEVEL_COUNT; idx += 1) {
    const lv = LEVELS[idx];
    const gen = generateLevel(idx, 11 + idx);
    for (let i = 0; i < gen.targetHeight; i += 1) {
      const isBarrier = lv.steelBarrierEvery && i > 0 && (i % lv.steelBarrierEvery) === 0;
      if (isBarrier) {
        // 全钢棚层整层都是 steel（这是设计：只有炽热态能穿）
        assert.ok(gen.layers[i].every((s) => s === 'steel'), `L${lv.index} 第 ${i} 层应为全钢棚`);
      } else {
        const col = gen.corridor[i];
        assert.notEqual(gen.layers[i][col], 'steel', `L${lv.index} 第 ${i} 层安全列 ${col} 不应为 steel`);
      }
    }
  }
});

test('生成确定性：同 seed 生成完全一致的层与通道', () => {
  const a = generateLevel(0, 42);
  const b = generateLevel(0, 42);
  assert.deepEqual(a.layers, b.layers);
  assert.deepEqual(a.corridor, b.corridor);
});

test('L1 教学关：无风、无钢棚、无阵雨、无移动云台', () => {
  const lv = LEVELS[0];
  assert.equal(lv.wind, 0);
  assert.equal(lv.steelBarrierEvery, 0);
  assert.equal(lv.rainBands.length, 0);
  assert.equal(lv.movingClouds, false);
  assert.equal(lv.wallBounce, false);
});

test('L4 有全钢棚、L5 有贴墙弹、L6 有阵雨、L7 有移动云台、L8 窄井 3 列', () => {
  assert.ok(LEVELS[3].steelBarrierEvery > 0);
  assert.equal(LEVELS[4].wallBounce, true);
  assert.ok(LEVELS[5].rainBands.length > 0);
  assert.equal(LEVELS[6].movingClouds, true);
  assert.equal(LEVELS[7].cols, 3);
});

test('目标高度非递减', () => {
  for (let i = 1; i < LEVEL_COUNT; i += 1) {
    assert.ok(LEVELS[i].targetHeight >= LEVELS[i - 1].targetHeight);
  }
});
