import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, STAGE_COUNT, stageAt, stageDef, radiusAt, zoneAtStage, nextMassTarget, FINAL_STAGE } from '../config/stages.js';
import { makeFish, makeFood, makeJelly } from '../src/game/spawner.js';
import { mulberry32 } from '../src/game/rng.js';
import { WORLD } from '../config/gameplay.js';

test('12 阶段推进结构', () => {
  assert.equal(STAGES.length, 12);
  assert.equal(STAGE_COUNT, 12);
  assert.equal(FINAL_STAGE, 11);
});

test('stageAt 单调递增', () => {
  for (let i = 0; i < STAGE_COUNT - 1; i += 1) {
    assert.equal(stageAt(STAGES[i].massTarget), i);
  }
  assert.equal(stageAt(STAGES[FINAL_STAGE].massTarget), FINAL_STAGE);
  assert.equal(stageAt(999999), FINAL_STAGE);
});

test('radiusAt 严格递增（阶段越大越大）', () => {
  for (let i = 1; i < STAGE_COUNT; i += 1) {
    assert.ok(radiusAt(i) > radiusAt(i - 1));
  }
});

test('三场景包：光合 / 中层 / 热泉', () => {
  assert.equal(zoneAtStage(0), 0);
  assert.equal(zoneAtStage(3), 0);
  assert.equal(zoneAtStage(4), 1);
  assert.equal(zoneAtStage(7), 1);
  assert.equal(zoneAtStage(8), 2);
  assert.equal(zoneAtStage(11), 2);
});

test('nextMassTarget：返回下一阶段目标', () => {
  assert.equal(nextMassTarget(0), STAGES[1].massTarget);
  assert.equal(nextMassTarget(999999), STAGES[FINAL_STAGE].massTarget);
});

test('makeFood 在世界边界内', () => {
  const rng = mulberry32(1);
  for (let i = 0; i < 50; i += 1) {
    const f = makeFood(rng, i);
    assert.ok(f.x > 0 && f.x < WORLD.WIDTH && f.y > 0 && f.y < WORLD.HEIGHT);
  }
});

test('makeFish：毒刺鱼阶段 ≤ 玩家阶段', () => {
  const rng = mulberry32(2);
  for (let i = 0; i < 200; i += 1) {
    const f = makeFish(rng, i, 5);
    assert.ok(f.stage >= 0 && f.stage <= 11);
    if (f.toxic) assert.ok(f.stage <= 5);
  }
});

test('makeJelly 在世界边界内', () => {
  const rng = mulberry32(3);
  for (let i = 0; i < 20; i += 1) {
    const j = makeJelly(rng, i);
    assert.ok(j.x > 0 && j.x < WORLD.WIDTH && j.y > 0 && j.y < WORLD.HEIGHT);
  }
});
