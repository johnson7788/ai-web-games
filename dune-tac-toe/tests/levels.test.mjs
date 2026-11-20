import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { X, O, winner, isFull, canForceWin, canForceDraw, winningMoves, drawingMoves } from '../src/game/sim.js';

test('关卡表：12 关、index 连续、场景三章、newElement 唯一', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => {
    assert.equal(lv.index, i + 1);
    assert.ok(['dawn', 'dusk', 'night'].includes(lv.scene));
  });
  const elements = LEVELS.map((lv) => lv.newElement);
  assert.equal(new Set(elements).size, elements.length, 'newElement 必须唯一');
});

test('关卡表：board 9 格、#X===#O（X 先手）、非终局', () => {
  for (const lv of LEVELS) {
    assert.equal(lv.board.length, 9, `L${lv.index} board 长度`);
    const nx = lv.board.filter((v) => v === X).length;
    const no = lv.board.filter((v) => v === O).length;
    assert.equal(nx, no, `L${lv.index} #X===#O（X 先手）`);
    assert.equal(winner(lv.board), null, `L${lv.index} 已是终局`);
    assert.equal(isFull(lv.board), false, `L${lv.index} 满盘`);
  }
});

test('三章换章：L1-4 dawn / L5-8 dusk / L9-12 night', () => {
  for (let i = 0; i < 4; i += 1) assert.equal(LEVELS[i].scene, 'dawn');
  for (let i = 4; i < 8; i += 1) assert.equal(LEVELS[i].scene, 'dusk');
  for (let i = 8; i < 12; i += 1) assert.equal(LEVELS[i].scene, 'night');
});

test('难度递进：goal=win 的关 winIn 恰好等于 movesLimit', () => {
  for (const lv of LEVELS) {
    if (lv.goal !== 'win') continue;
    // winIn 恰好等于 movesLimit（不更少，也不无解）
    for (let k = 1; k < lv.movesLimit; k += 1) {
      assert.equal(canForceWin(lv.board, k), false, `L${lv.index} 不应在 ${k} 步内胜`);
    }
    assert.equal(canForceWin(lv.board, lv.movesLimit), true, `L${lv.index} 应在 ${lv.movesLimit} 步内胜`);
    assert.ok(winningMoves(lv.board, lv.movesLimit).length > 0, `L${lv.index} 有必胜首步`);
  }
});

test('第 12 关：逼平完美蝎子（无法获胜但可逼平）', () => {
  const lv = LEVELS[11];
  assert.equal(lv.goal, 'draw');
  assert.equal(canForceWin(lv.board, 3), false);
  assert.equal(canForceDraw(lv.board), true);
  assert.deepEqual(drawingMoves(lv.board), [0]);
});

test('每关 movesLimit 与 goal 合法', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.movesLimit >= 1);
    assert.ok(['win', 'draw'].includes(lv.goal));
    if (lv.goal === 'draw') assert.equal(lv.index, 12, '仅第 12 关为 draw');
  }
});
