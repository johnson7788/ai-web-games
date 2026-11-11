import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSave, recordClear, updateSettings, levelStars, totalStars, resetSave } from '../src/core/save.js';

test('默认存档：解锁第 1 关、无星级', () => {
  resetSave();
  const s = loadSave();
  assert.equal(s.unlocked, 1);
  assert.deepEqual(s.levels, {});
  assert.equal(s.settings.music, 0.7);
});

test('三星规则：通关 1 星 + 齿轮 80% + 零死亡', () => {
  resetSave();
  assert.equal(recordClear('1-1', { time: 60, gears: 5, total: 20, deaths: 3 }, 2).stars, 1);
  assert.equal(recordClear('1-1', { time: 50, gears: 16, total: 20, deaths: 2 }, 2).stars, 2);
  assert.equal(recordClear('1-1', { time: 40, gears: 16, total: 20, deaths: 0 }, 2).stars, 3);
});

test('星级只升不降，最佳用时取更小值', () => {
  resetSave();
  recordClear('1-1', { time: 40, gears: 20, total: 20, deaths: 0 }, 2);
  const again = recordClear('1-1', { time: 30, gears: 0, total: 20, deaths: 5 }, 2);
  assert.equal(again.stars, 3);
  assert.equal(levelStars('1-1'), 3);
  assert.equal(loadSave().levels['1-1'].best, 30);
  assert.equal(loadSave().levels['1-1'].gears, 20);
});

test('解锁进度只增不减，总星数正确', () => {
  resetSave();
  recordClear('1-1', { time: 30, gears: 20, total: 20, deaths: 0 }, 2);
  recordClear('1-2', { time: 30, gears: 20, total: 20, deaths: 0 }, 3);
  recordClear('1-1', { time: 30, gears: 20, total: 20, deaths: 0 }, 2);
  assert.equal(loadSave().unlocked, 3);
  assert.equal(totalStars(), 6);
});

test('设置可局部更新', () => {
  resetSave();
  updateSettings({ music: 0.2 });
  assert.equal(loadSave().settings.music, 0.2);
  assert.equal(loadSave().settings.sfx, 0.8);
});
