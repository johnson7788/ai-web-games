import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { buildBricks, parseChar, angleTo, solveRun, greedyAngle } from '../src/game/level.js';
import { createRun } from '../src/game/sim.js';
import { GRID, AIM } from '../config/game.config.js';

const VALID_CHARS = new Set(['.', 'r', 'h', 'v', 'b', '+', 's', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

test('关卡表：8 关、index 连续', () => {
  assert.equal(LEVEL_COUNT, 8);
  assert.equal(LEVELS.length, 8);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
});

test('关卡表：行列尺寸合法、字符合法', () => {
  for (const lv of LEVELS) {
    assert.equal(lv.rows.length, GRID.ROWS, `L${lv.index} 行数`);
    for (const row of lv.rows) {
      assert.equal(row.length, GRID.COLS, `L${lv.index} 列数`);
      for (const ch of row) assert.ok(VALID_CHARS.has(ch), `L${lv.index} 非法字符 ${ch}`);
    }
    assert.ok(lv.balls > 0);
    assert.ok(lv.par >= 1);
    assert.ok(typeof lv.name.en === 'string' && typeof lv.name.zh === 'string');
  }
});

test('每关至少有 1 块可清砖', () => {
  for (const lv of LEVELS) {
    const bricks = buildBricks(lv);
    assert.ok(bricks.some((b) => b.clearable), `L${lv.index} 无可清砖`);
  }
});

test('解析：字符映射正确', () => {
  assert.equal(parseChar('3').type, 'num');
  assert.equal(parseChar('3').hp, 3);
  assert.equal(parseChar('r').type, 'rock');
  assert.equal(parseChar('r').clearable, false);
  assert.equal(parseChar('h').type, 'h');
  assert.equal(parseChar('+').type, 'plus');
  assert.equal(parseChar('.'), null);
});

test('坐标：砖块位置按网格递增', () => {
  const bricks = buildBricks(LEVELS[0]);
  for (const b of bricks) {
    assert.equal(b.x, GRID.X0 + b.c * (GRID.CELL_W + GRID.GAP));
    assert.equal(b.y, GRID.Y0 + b.r * (GRID.CELL_H + GRID.GAP));
    assert.ok(b.x >= GRID.X0 && b.x + b.w <= GRID.X0 + GRID.COLS * GRID.CELL_W + (GRID.COLS - 1) * GRID.GAP);
  }
});

test('angleTo：正上方 0 度、右为正', () => {
  const up = angleTo(640, 0);
  assert.ok(Math.abs(up) < 0.001);
  const right = angleTo(1280, 636);
  assert.ok(right > 0);
  const left = angleTo(0, 636);
  assert.ok(left < 0);
});

test('greedyAngle 所有关卡都在合法范围内', () => {
  for (const lv of LEVELS) {
    const r = createRun(lv.index - 1, { seed: 1 });
    const a = greedyAngle(r.state);
    assert.ok(Number.isFinite(a) && a >= AIM.MIN && a <= AIM.MAX, `L${lv.index} angle ${a}`);
  }
});

test('贪心求解：前三关均可通关（可解性）', () => {
  for (let i = 0; i < 3; i += 1) {
    const r = createRun(i, { seed: 1 });
    assert.equal(solveRun(r), 'won', `L${i + 1} 贪心未通关`);
  }
});
