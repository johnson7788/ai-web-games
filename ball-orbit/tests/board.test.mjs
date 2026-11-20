import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBoard, spawnRow } from '../src/game/board.js';
import { mulberry32 } from '../src/game/rng.js';
import { waveAt } from '../config/waves.js';
import { ASTEROID, WORLD } from '../config/gameplay.js';

function runStub(seed) {
  return { rng: mulberry32(seed), nextId: 1 };
}

test('初始阵：≤ 行数 × 列数（含空穴）且非空', () => {
  const wave = waveAt(1);
  const run = runStub(1);
  const board = buildBoard(run, wave);
  assert.ok(board.length > 0);
  assert.ok(board.length <= wave.rows * wave.cols);
});

test('顶行 y = TOP_Y，向下递增', () => {
  const wave = waveAt(3);
  const board = buildBoard(runStub(2), wave);
  const minY = Math.min(...board.map((a) => a.y));
  assert.equal(minY, ASTEROID.TOP_Y);
  assert.ok(board.some((a) => a.y > ASTEROID.TOP_Y));
});

test('列中心都在世界宽度内', () => {
  const wave = waveAt(6);
  const board = buildBoard(runStub(3), wave);
  for (const a of board) {
    assert.ok(a.x - ASTEROID.W / 2 >= 0, '左界内');
    assert.ok(a.x + ASTEROID.W / 2 <= WORLD.WIDTH, '右界内');
  }
});

test('硬度落在波次 value 范围内', () => {
  for (const idx of [1, 6, 12]) {
    const wave = waveAt(idx);
    const board = buildBoard(runStub(idx), wave);
    for (const a of board) {
      if (a.kind === 'addBall') assert.equal(a.hardness, 1);
      else assert.ok(a.hardness >= wave.value[0] && a.hardness <= wave.value[1], `wave${idx} 硬度越界 ${a.hardness}`);
    }
  }
});

test('kind 只能是 normal / addBall / shield', () => {
  const wave = waveAt(9);
  const board = buildBoard(runStub(4), wave);
  for (const a of board) assert.ok(['normal', 'addBall', 'shield'].includes(a.kind));
});

test('spawnRow 生成一行（≤ cols，含空穴）', () => {
  const wave = waveAt(4);
  const row = spawnRow(runStub(5), wave);
  assert.ok(row.length > 0);
  assert.ok(row.length <= wave.cols);
  assert.ok(row.every((a) => a.rowY === ASTEROID.TOP_Y));
});

test('确定性：同 seed 同 board', () => {
  const a = buildBoard(runStub(7), waveAt(8));
  const b = buildBoard(runStub(7), waveAt(8));
  assert.deepEqual(a, b);
});
