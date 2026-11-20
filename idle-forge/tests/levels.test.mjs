// IDLE FORGE · 关卡数据测试（node --test，零 DOM）
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT, SCENES } from '../config/levels.js';
import { allLevelsValid, tierCoverage, mechanicsValid, levelByIndex } from '../src/game/level.js';

test('共 12 关，且与 LEVEL_COUNT 一致', () => {
  assert.equal(LEVELS.length, 12);
  assert.equal(LEVEL_COUNT, 12);
});

test('关卡索引连续且从 1 开始', () => {
  assert.deepEqual(LEVELS.map((l) => l.index), Array.from({ length: 12 }, (_, i) => i + 1));
});

test('所有关卡数据合法（target/yield/场景/名称）', () => {
  assert.equal(allLevelsValid(), true);
});

test('机制字段全部合法', () => {
  assert.equal(mechanicsValid(), true);
});

test('覆盖 4 个装备品类（铜/铁/秘银/龙鳞）', () => {
  assert.deepEqual(tierCoverage(), [0, 1, 2, 3]);
});

test('三个场景包都出现（乡村/城塞/火山）', () => {
  const scenes = new Set(LEVELS.map((l) => l.scene));
  for (const s of SCENES) assert.ok(scenes.has(s), `${s} 未出现`);
});

test('产量随关卡单调递增（价格/收益曲线向上）', () => {
  for (let i = 1; i < LEVELS.length; i += 1) {
    assert.ok(LEVELS[i].yield >= LEVELS[i - 1].yield);
  }
});

test('大师之作目标随关卡递增（推进曲线向上）', () => {
  for (let i = 1; i < LEVELS.length; i += 1) {
    assert.ok(LEVELS[i].target > LEVELS[i - 1].target);
  }
});

test('终章第 12 关是屠龙圣剑（all 机制）', () => {
  const lv = levelByIndex(11);
  assert.match(lv.name.en, /Slayer/);
  assert.equal(lv.mechanic, 'all');
});

test('每关都有中英文名称', () => {
  for (const l of LEVELS) {
    assert.ok(l.name.en && l.name.zh && l.tierName.en && l.tierName.zh);
  }
});
