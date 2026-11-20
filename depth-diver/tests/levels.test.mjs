import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { validateLevels, minFreeLanes } from '../src/game/level.js';
import { GAME } from '../config/game.config.js';

test('关卡表：12 关、index 连续', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
});

test('关卡表：字段完整且类型合法', () => {
  for (const lv of LEVELS) {
    assert.ok(['sunlit', 'twilight', 'abyss'].includes(lv.scene));
    assert.ok(lv.depthTarget > 0);
    assert.ok(lv.oxygen > 0);
    assert.ok(lv.sampleTotal >= 3);
    assert.ok(lv.lightRadius > 0);
    assert.ok(lv.diveSpeed > 0);
    assert.ok(lv.spawnGap > 0);
    assert.ok(['rock', 'mine', 'mix'].includes(lv.hazard));
    assert.ok(lv.maxBlocked >= 1 && lv.maxBlocked <= GAME.LANE_X.length - 1);
    assert.ok(typeof lv.newElement === 'string' && lv.newElement.trim());
    assert.ok(lv.name && lv.name.en && lv.name.zh);
  }
});

test('关卡表：每关 newElement 互不重复', () => {
  const elements = LEVELS.map((lv) => lv.newElement);
  assert.equal(new Set(elements).size, elements.length);
});

test('关卡表：validateLevels 返回空（全合法）', () => {
  assert.deepEqual(validateLevels(), []);
});

test('每波封锁至少留 1 条可通行 gap 航迹', () => {
  for (const lv of LEVELS) assert.ok(minFreeLanes(lv) >= 1);
});

test('三场景包齐全：sunlit/twilight/abyss 都有关卡', () => {
  const scenes = new Set(LEVELS.map((lv) => lv.scene));
  assert.deepEqual([...scenes].sort(), ['abyss', 'sunlit', 'twilight']);
});

test('关卡特性编排：L4 热泉 / L5 追逐者 / L8 压力 / L12 终局叠加', () => {
  assert.equal(LEVELS[3].vent, true);
  assert.equal(LEVELS[4].chaser, true);
  assert.equal(LEVELS[7].pressure, true);
  assert.equal(LEVELS[11].vent, true);
  assert.equal(LEVELS[11].chaser, true);
  assert.equal(LEVELS[11].pressure, true);
});

test('洋流关卡：L3 单向 / L10 双洋流 / L11 反向', () => {
  assert.equal(LEVELS[2].currentDir, 1);
  assert.equal(LEVELS[9].currentDir, 2);
  assert.equal(LEVELS[10].currentDir, -1);
});

test('推进：L1 最浅最深深度递增', () => {
  for (let i = 1; i < LEVELS.length; i += 1) {
    assert.ok(LEVELS[i].depthTarget > LEVELS[i - 1].depthTarget);
  }
});
