import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignColors, spawnRing, updateRing } from '../src/game/spawner.js';
import { createRun } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';
import { COLOR } from '../config/gameplay.js';
import { WORLD } from '../config/game.config.js';

test('assignColors：目标格数恰为 targetCells 且都为 dye', () => {
  const rng = mulberry32(7);
  const colors = assignColors(rng, 2, 6, 2, 0.2, 0.1);
  assert.equal(colors.length, 6);
  assert.equal(colors.filter((c) => c === 2).length, 2);
});

test('assignColors：白/木/染色全部落在合法集合', () => {
  const rng = mulberry32(9);
  const colors = assignColors(rng, 0, 8, 1, 0.3, 0.2);
  for (const c of colors) {
    assert.ok(c === COLOR.WHITE || c === COLOR.WOOD || (c >= 0 && c < COLOR.COUNT));
  }
});

test('spawnRing：格数与颜色数一致且含安全格', () => {
  const run = createRun({ seed: 3 });
  const ring = spawnRing(run, { index: 1, cells: 6, targetCells: 2, whiteProb: 0.2, woodProb: 0.08, moving: false, swap: false }, 100);
  assert.equal(ring.cellsCount, 6);
  assert.equal(ring.colors.length, 6);
  assert.ok(ring.colors.filter((c) => c === run.dye).length >= 2);
});

test('updateRing：移动环推进 marquee 偏移', () => {
  const run = createRun({ seed: 5 });
  const ring = spawnRing(run, { index: 1, cells: 6, targetCells: 2, whiteProb: 0.2, woodProb: 0.08, moving: true, moveSpeed: 60, swap: false }, 100);
  const before = ring.xOffset;
  updateRing(run, ring, 1 / 60);
  assert.notEqual(ring.xOffset, before);
  assert.ok(ring.xOffset >= 0 && ring.xOffset < WORLD.WIDTH);
});

test('updateRing：变色环重洗后仍保持目标格数', () => {
  const run = createRun({ seed: 11 });
  const ring = spawnRing(run, { index: 1, cells: 6, targetCells: 2, whiteProb: 0.2, woodProb: 0.08, moving: false, swap: true, swapEvery: 0.1 }, 100);
  ring.swapTimer = 0.01;
  updateRing(run, ring, 1 / 60);
  assert.ok(ring.colors.filter((c) => c === run.dye).length >= 2);
});
