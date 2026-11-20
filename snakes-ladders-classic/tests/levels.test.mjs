import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD, LEVELS, cellToRC } from '../config/levels.js';

test('棋盘共 48 格，终点 47', () => {
  assert.equal(BOARD.CELLS, 48);
  assert.equal(BOARD.MAX, 47);
  assert.equal(BOARD.COLS, 8);
  assert.equal(BOARD.ROWS, 6);
});

test('有 3 关，且每关 4 梯 4 蛇', () => {
  assert.equal(LEVELS.length, 3);
  for (const lv of LEVELS) {
    assert.equal(Object.keys(lv.ladders).length, 4, `${lv.name} 应有 4 个梯子`);
    assert.equal(Object.keys(lv.snakes).length, 4, `${lv.name} 应有 4 条蛇`);
  }
});

test('梯子都向上、蛇都向下', () => {
  for (const lv of LEVELS) {
    for (const [k, v] of Object.entries(lv.ladders)) {
      assert.ok(Number(v) > Number(k), `梯子 ${k}→${v} 应向上`);
    }
    for (const [k, v] of Object.entries(lv.snakes)) {
      assert.ok(Number(v) < Number(k), `蛇 ${k}→${v} 应向下`);
    }
  }
});

test('梯子头与蛇头不重叠、不指向蛇头', () => {
  for (const lv of LEVELS) {
    const ladderHeads = new Set(Object.keys(lv.ladders).map(Number));
    const snakeHeads = new Set(Object.keys(lv.snakes).map(Number));
    for (const k of ladderHeads) assert.ok(!snakeHeads.has(k), `格 ${k} 同时是梯子和蛇`);
    for (const v of Object.values(lv.ladders)) {
      assert.ok(!snakeHeads.has(Number(v)), `梯子指向蛇头 ${v}`);
    }
  }
});

test('蛇形编号 cellToRC', () => {
  assert.deepEqual(cellToRC(0), { r: 0, col: 0 });
  assert.deepEqual(cellToRC(7), { r: 0, col: 7 });
  assert.deepEqual(cellToRC(8), { r: 1, col: 7 });
  assert.deepEqual(cellToRC(15), { r: 1, col: 0 });
  assert.deepEqual(cellToRC(47), { r: 5, col: 0 });
  assert.deepEqual(cellToRC(40), { r: 5, col: 7 });
});

test('第 2 关有岩石，第 3 关有宝石和连击', () => {
  assert.ok(LEVELS[1].rocks.length > 0);
  assert.equal(LEVELS[2].combo, true);
  assert.ok(LEVELS[2].gems.length > 0);
  assert.equal(LEVELS[0].combo, false);
});
