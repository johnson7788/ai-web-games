import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, slideGrid, hasMoves, maxTile, cloneGrid, loadBoardValues,
} from '../src/game/sim.js';
import { LEVELS, levelAt } from '../config/levels.js';
import { mulberry32 } from '../src/game/rng.js';

const zeros = (rows, cols) => Array.from({ length: rows }, () => new Array(cols).fill(0));
const countTiles = (run) => run.grid.flat().filter(Boolean).length;
const board = (run, rows, cols, values) => {
  const g = [];
  for (let r = 0; r < rows; r += 1) g.push(values.slice(r * cols, (r + 1) * cols));
  loadBoardValues(run, g);
};

test('createRun：初始正好 2 艘舰', () => {
  const run = createRun({ seed: 1 });
  assert.equal(countTiles(run), 2);
});

test('slideGrid：同值向左合并，值翻倍', () => {
  const g = [[{ value: 2, id: 1 }, { value: 2, id: 2 }, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]];
  const res = slideGrid(g, 'left', { rows: 4, cols: 4, blocked: new Set(), gravity: null });
  assert.equal(res.grid[0][0].value, 4);
  assert.ok(res.moved);
  assert.equal(res.merges.length, 1);
  assert.equal(res.merges[0].value, 4);
});

test('slideGrid：不同值不合并', () => {
  const g = [[{ value: 2, id: 1 }, { value: 4, id: 2 }, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]];
  const res = slideGrid(g, 'left', { rows: 4, cols: 4, blocked: new Set(), gravity: null });
  assert.equal(res.moved, false);
  assert.equal(res.merges.length, 0);
});

test('合并计入分数（翻倍值）', () => {
  const run = createRun({ seed: 1 });
  board(run, 4, 4, [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  run.step({ dir: 'left' });
  assert.equal(run.score, 4);
});

test('有效步后生成新舰', () => {
  const run = createRun({ seed: 1 });
  board(run, 4, 4, [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  run.step({ dir: 'left' });
  assert.equal(countTiles(run), 2); // 1 艘 4 + 1 艘新生成
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'spawn'));
});

test('无效步：blocked 事件，步数不变，未死局', () => {
  const run = createRun({ seed: 1 });
  board(run, 4, 4, [2, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  run.step({ dir: 'left' });
  assert.equal(run.moves, 0);
  assert.equal(run.phase, 'playing');
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'blocked'));
});

test('死局：满盘无合并则判定 dead', () => {
  const run = createRun({ seed: 1 });
  board(run, 4, 4, [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]);
  run.step({ dir: 'left' });
  assert.equal(run.phase, 'dead');
});

test('过关：best 达到 target 后推进到下一关', () => {
  const run = createRun({ seed: 1 });
  board(run, 4, 4, [16, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  run.step({ dir: 'left' });
  assert.equal(run.levelIndex, 2);
  assert.ok(run.stats.maxLevel >= 2);
});

test('胜利：达到 2048 判定 won', () => {
  const run = createRun({ seed: 1 });
  board(run, 4, 4, [1024, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  run.step({ dir: 'left' });
  assert.equal(run.phase, 'won');
});

test('引力井：每 N 步生成', () => {
  const run = createRun({ seed: 1 });
  run.gravityEvery = 1;
  board(run, 4, 4, [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  run.step({ dir: 'right' });
  assert.ok(run.gravity);
  assert.ok(run.drainEvents().some((e) => e.type === 'gravitySpawn'));
});

test('引力井：滑入的数字被锁定', () => {
  const run = createRun({ seed: 1 });
  run.gravityEvery = 0;
  board(run, 4, 4, [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  run.gravity = { row: 0, col: 3, movesLeft: 3 };
  run.step({ dir: 'right' });
  assert.equal(run.grid[0][3].value, 2);
  assert.equal(run.grid[0][3].locked, true);
});

test('锁定舰不可合并（作为墙挡住滑行）', () => {
  const run = createRun({ seed: 1 });
  run.gravityEvery = 0;
  board(run, 4, 4, [0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  run.grid[0][0] = { id: 999, value: 2, locked: true };
  run.step({ dir: 'left' });
  assert.equal(run.grid[0][1].value, 2); // 仍为 2，未合并
  assert.equal(run.grid[0][0].value, 2); // 锁定舰原位
});

test('引力井到期后解锁', () => {
  const run = createRun({ seed: 1 });
  run.gravityEvery = 0;
  board(run, 4, 4, [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  run.gravity = { row: 0, col: 3, movesLeft: 3 };
  run.step({ dir: 'right' });
  assert.ok(run.grid[0][3].locked);
  run.gravity.movesLeft = 1;
  run.grid[3][0] = { id: 777, value: 2, locked: false };
  run.step({ dir: 'right' });
  assert.equal(run.gravity, null);
  assert.equal(run.grid[0][3].locked, false);
});

test('跃迁引擎：任意两个同值格强制合并（含不相邻）', () => {
  const run = createRun({ seed: 1 });
  board(run, 4, 4, [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0]);
  run.step({ warp: [0, 0, 3, 2] });
  assert.equal(run.grid[0][0], null);
  assert.equal(run.grid[3][2].value, 4);
  assert.equal(run.warpLeft, 0);
});

test('跃迁引擎：每关仅 1 次', () => {
  const run = createRun({ seed: 1 });
  board(run, 4, 4, [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0]);
  run.step({ warp: [0, 0, 3, 2] });
  assert.equal(run.warpLeft, 0);
  const before = countTiles(run);
  run.step({ warp: [0, 0, 3, 2] }); // 已用完，应忽略
  assert.equal(countTiles(run), before);
});

test('镜像盘：left 实际向右滑', () => {
  const run = createRun({ seed: 1 });
  board(run, 4, 4, [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  run.mirror = true;
  run.step({ dir: 'left' });
  assert.equal(run.grid[0][3].value, 2);
  assert.equal(run.grid[0][0], null);
});

test('窄盘：3×4 关卡的网格尺寸', () => {
  const run = createRun({ seed: 1, levelIndex: 3 });
  assert.equal(run.cols, 3);
  assert.equal(run.rows, 4);
  assert.equal(run.grid.length, 4);
  assert.equal(run.grid[0].length, 3);
});

test('障碍格：关卡 4 有 4 个障碍', () => {
  const run = createRun({ seed: 1, levelIndex: 4 });
  assert.equal(run.blocked.size, 4);
});

test('生成集：只生成 4 / 狂野 8', () => {
  const only4 = createRun({ seed: 1, levelIndex: 5 });
  assert.deepEqual(only4.spawnSet, [4]);
  const wild = createRun({ seed: 1, levelIndex: 6 });
  assert.deepEqual(wild.spawnSet, [2, 4, 8]);
});

test('hasMoves：有空位为 true，满盘无合并为 false', () => {
  const run = createRun({ seed: 1 });
  board(run, 4, 4, [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(hasMoves(run), true);
  board(run, 4, 4, [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]);
  assert.equal(hasMoves(run), false);
});

test('maxTile / cloneGrid', () => {
  const g = [[{ value: 2 }, null, { value: 8 }, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]];
  assert.equal(maxTile(g), 8);
  const c = cloneGrid(g);
  c[0][0].value = 99;
  assert.equal(g[0][0].value, 2);
});

test('rng：同 seed 同结果', () => {
  const a = mulberry32(123)();
  const b = mulberry32(123)();
  assert.equal(a, b);
});

test('关卡表：12 关且目标递增', () => {
  assert.equal(LEVELS.length, 12);
  for (let i = 1; i < LEVELS.length; i += 1) {
    assert.ok(levelAt(i + 1).target >= levelAt(i).target);
  }
});
