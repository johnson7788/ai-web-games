import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { findValidSwaps, hasValidMove, findAllMatches, idx } from '../src/game/board.js';
import { LEVEL_COUNT } from '../config/levels.js';
import { GRAVITY, LENS } from '../config/gameplay.js';

function validSwap(run) {
  const swaps = findValidSwaps(run.grid);
  assert.ok(swaps.length > 0, '应有有效交换');
  return swaps[0];
}

test('createRun 生成可玩棋盘', () => {
  const run = createRun({ seed: 42 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.level, 1);
  assert.equal(findAllMatches(run.grid).length, 0);
  assert.ok(hasValidMove(run.grid));
  assert.equal(run.moves, run.movesMax);
  assert.equal(run.lensLeft, LENS.CHARGES_PER_LEVEL);
});

test('无效交换不消耗步数', () => {
  const run = createRun({ seed: 1 });
  const moves = run.moves;
  // 找一对相邻但无效的交换：随便挑一个格与其右邻（大多数无效）
  const a = idx(0, 0); const b = idx(0, 1);
  run.step({ swap: { a, b } });
  run.drainEvents();
  assert.equal(run.moves, moves, '无效交换不应消耗步数');
});

test('有效交换消耗步数并产生消除', () => {
  const run = createRun({ seed: 7 });
  const [a, b] = validSwap(run);
  const moves = run.moves;
  run.step({ swap: { a, b } });
  const ev = run.drainEvents();
  assert.equal(run.moves, moves - 1);
  assert.ok(ev.some((e) => e.type === 'match'));
  assert.ok(ev.some((e) => e.type === 'clearStar'));
});

test('步数耗尽且未达标 → 失败', () => {
  const run = createRun({ seed: 3 });
  // 只剩 1 步且分数远低于目标：一次有效交换后应失败
  run.moves = 1;
  run.score = 0;
  const [a, b] = validSwap(run);
  run.step({ swap: { a, b } });
  run.drainEvents();
  assert.equal(run.phase, 'dead');
});

test('达标过关并推进到下一关', () => {
  const run = createRun({ seed: 5 });
  run.score = run.target; // 直接达标
  run.moves = 5;
  const [a, b] = validSwap(run);
  run.step({ swap: { a, b } });
  const ev = run.drainEvents();
  assert.ok(ev.some((e) => e.type === 'levelClear'));
  assert.equal(run.level, 2);
  assert.equal(run.score, 0, '新关卡分数归零');
});

test('第 7 关重力反转', () => {
  const run = createRun({ seed: 8, startLevel: 7 });
  assert.equal(run.gravity, GRAVITY.UP);
});

test('通关第 12 关 → win', () => {
  const run = createRun({ seed: 9, startLevel: LEVEL_COUNT });
  run.score = run.target;
  run.moves = 1;
  const [a, b] = validSwap(run);
  run.step({ swap: { a, b } });
  run.drainEvents();
  assert.equal(run.phase, 'win');
});
