import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { countBubbles } from '../src/game/grid.js';
import { MAX_AIM } from '../config/gameplay.js';

test('createRun：初始状态正确', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.level.index, 1);
  assert.equal(run.levelIndex, 0);
  assert.ok(run.grid.length >= 3);
  assert.ok(run.current, '炮管内应有待发射泡泡');
  assert.equal(run.previewsLeft, 1);
  assert.ok(countBubbles(run.grid) > 0);
});

test('step：瞄准角度被夹到 ±MAX_AIM', () => {
  const run = createRun({ seed: 1 });
  run.step({ angle: 99 });
  assert.equal(run.aimAngle, MAX_AIM);
  run.step({ angle: -99 });
  assert.equal(run.aimAngle, -MAX_AIM);
});

test('step：发射会推进 shotsFired 并产生飞行泡泡', () => {
  const run = createRun({ seed: 1 });
  run.step({ shoot: true, angle: 0 });
  assert.equal(run.shotsFired, 1);
  assert.ok(run.flying, '应有飞行中的泡泡');
});

test('step：直射最终会落地（flying 归 null）', () => {
  const run = createRun({ seed: 1 });
  run.step({ shoot: true, angle: 0 });
  for (let i = 0; i < 500 && run.flying; i += 1) run.step({});
  assert.equal(run.flying, null);
});

test('step：drainEvents 返回并清空事件队列', () => {
  const run = createRun({ seed: 1 });
  run.step({ shoot: true, angle: 0 });
  const evs = run.drainEvents();
  assert.ok(evs.length >= 1);
  assert.equal(run.events.length, 0);
});

test('sink：整场泡泡下移一行且 parity 保持', () => {
  const run = createRun({ seed: 1 });
  const oldColor = run.grid[1][0].c;
  const oldParity = run.parities[1];
  const rowsBefore = run.grid.length;
  run.sink();
  assert.equal(run.grid.length, rowsBefore + 1);
  assert.equal(run.grid[2][0].c, oldColor);
  assert.equal(run.parities[2], oldParity);
});

test('wildcard：3 连击换一颗百搭泡并扣连击', () => {
  const run = createRun({ seed: 1 });
  run.combo = 3;
  run.step({ useWildcard: true });
  assert.equal(run.current.wildcard, true);
  assert.equal(run.combo, 0);
});

test('preview：潮汐预览扣次数并在发射后消耗', () => {
  const run = createRun({ seed: 1 });
  run.step({ usePreview: true });
  assert.equal(run.previewsLeft, 0);
  assert.equal(run.previewActive, true);
  run.step({ shoot: true, angle: 0 });
  assert.equal(run.previewActive, false);
});

test('getHud：返回通关所需字段', () => {
  const run = createRun({ seed: 1 });
  const hud = run.getHud();
  for (const k of ['score', 'level', 'combo', 'clearance', 'clearanceTarget', 'previewsLeft', 'wildcardAvailable']) {
    assert.ok(k in hud, `缺少 hud.${k}`);
  }
});

test('level：清除率达到目标后进入 cleared', () => {
  const run = createRun({ seed: 1 });
  run.clearedTotal = 10000;
  run.goldRemaining = 0;
  run.step({ shoot: true, angle: 0 });
  for (let i = 0; i < 500 && run.phase === 'playing'; i += 1) run.step({});
  assert.equal(run.phase, 'cleared');
});

test('level：cleared 停留后自动推进到下一关', () => {
  const run = createRun({ seed: 1 });
  run.clearedTotal = 10000;
  run.goldRemaining = 0;
  run.step({ shoot: true, angle: 0 });
  for (let i = 0; i < 500 && run.phase !== 'cleared'; i += 1) run.step({});
  assert.equal(run.phase, 'cleared');
  for (let i = 0; i < 100 && run.phase === 'cleared'; i += 1) run.step({});
  assert.equal(run.phase, 'playing');
  assert.equal(run.level.index, 2);
});
