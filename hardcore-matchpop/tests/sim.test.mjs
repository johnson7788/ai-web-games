// HARDCORE MATCHPOP · sim 纯逻辑测试（node --test）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun,
  createRushRun,
  ROCK,
  EMPTY,
  connectedGroup,
  hasMove,
  mulberry32,
} from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';

const N = GAME.N;

function emptyBoard() {
  return Array.from({ length: N }, () => Array(N).fill(EMPTY));
}

function countGems(g) {
  let n = 0;
  for (let r = 0; r < N; r += 1) for (let c = 0; c < N; c += 1) if (g[r][c] >= 0) n += 1;
  return n;
}

function setGrid(run, grid) {
  run.state.grid = grid;
  run.state.gems = countGems(grid);
}

test('L1 初始：10×10 / 100 晶石 / 0 岩块 / 目标 600', () => {
  const run = createRun(0, { seed: 7 });
  assert.equal(run.state.grid.length, 10);
  assert.equal(run.state.grid[0].length, 10);
  assert.equal(run.state.gems, 100);
  assert.equal(run.state.rocks, 0);
  assert.equal(run.state.target, 600);
  assert.equal(run.state.phase, 'playing');
});

test('单晶石点爆：size=1，基础分 = 1×10−5 = 5', () => {
  const run = createRun(0, { seed: 7 });
  const g = emptyBoard();
  g[9][0] = 4;
  setGrid(run, g);
  const res = run.tap(9, 0);
  assert.ok(res.ok);
  assert.equal(res.size, 1);
  assert.equal(res.base, 5);
  assert.equal(run.state.score, 5);
  assert.equal(run.state.gems, 0);
});

test('连通块整块消除：三个相邻同色一次点爆', () => {
  const run = createRun(0, { seed: 7 });
  const g = emptyBoard();
  g[0][0] = 0;
  g[0][1] = 0;
  g[1][0] = 0;
  g[5][5] = 3;
  setGrid(run, g);
  const res = run.tap(0, 0);
  assert.ok(res.ok);
  assert.equal(res.size, 3);
  assert.equal(res.base, 25);
  assert.equal(run.state.gems, 1);
});

test('点岩块返回失败且不消耗操作', () => {
  const run = createRun(1, { seed: 7 });
  assert.equal(run.state.rocks, 1);
  let rr = -1;
  let cc = -1;
  outer: for (let r = 0; r < N; r += 1) for (let c = 0; c < N; c += 1) if (run.state.grid[r][c] === ROCK) { rr = r; cc = c; break outer; }
  assert.ok(rr >= 0, '岩块存在');
  const scoreBefore = run.state.score;
  const res = run.tap(rr, cc);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'rock');
  assert.equal(run.state.score, scoreBefore);
});

test('重力：晶石落到所在列最低空位', () => {
  const run = createRun(0, { seed: 7 });
  const g = emptyBoard();
  g[0][0] = 2;
  g[9][1] = 3;
  setGrid(run, g);
  run._applyGravity();
  assert.equal(g[9][0], 2);
  assert.equal(g[0][0], EMPTY);
  assert.equal(g[9][1], 3);
});

test('整列左移：空列塌缩，右列晶石补左', () => {
  const run = createRun(0, { seed: 7 });
  const g = emptyBoard();
  g[9][1] = 4;
  setGrid(run, g);
  run._applyGravity();
  assert.equal(g[9][0], 4);
  assert.equal(g[9][1], EMPTY);
});

test('岩块是墙：段内左移不跨岩块列', () => {
  const run = createRun(0, { seed: 7 });
  const g = emptyBoard();
  g[5][1] = ROCK;
  g[9][2] = 1;
  setGrid(run, g);
  run._applyGravity();
  assert.equal(g[9][2], 1, '岩块右侧列不跨过岩块');
  assert.equal(g[9][0], EMPTY);
});

test('连击：3 秒内连续两次消除 combo=2', () => {
  const run = createRun(0, { seed: 7 });
  const g = run.state.grid;
  let r = 0;
  let c = 0;
  outer: for (r = 0; r < N; r += 1) for (c = 0; c < N; c += 1) if (g[r][c] >= 0) break outer;
  assert.ok(run.tap(r, c).ok);
  let r2 = 0;
  let c2 = 0;
  outer2: for (r2 = 0; r2 < N; r2 += 1) for (c2 = 0; c2 < N; c2 += 1) if (g[r2][c2] >= 0) break outer2;
  const res = run.tap(r2, c2);
  assert.ok(res.ok);
  assert.equal(run.state.combo, 2);
});

test('连击加成：combo=2 时单块 bonus=floor(5×1×0.5)=2', () => {
  const run = createRun(0, { seed: 7 });
  const g = emptyBoard();
  g[9][9] = 1;
  g[9][0] = 2;
  setGrid(run, g);
  const r1 = run.tap(9, 9);
  assert.equal(r1.combo, 1);
  const r2 = run.tap(9, 0);
  assert.equal(r2.combo, 2);
  assert.equal(r2.base, 5);
  assert.equal(r2.bonus, 2);
  assert.equal(r2.gain, 7);
});

test('炸弹：清空 3×3 并消耗 1 枚', () => {
  const run = createRun(0, { seed: 7 });
  const g = emptyBoard();
  for (let r = 0; r < 3; r += 1) for (let c = 0; c < 3; c += 1) g[r][c] = (r + c) % 5;
  setGrid(run, g);
  const res = run.bomb(1, 1);
  assert.ok(res.ok);
  assert.equal(run.state.bombLeft, 0);
  assert.equal(run.state.gems, 0);
  assert.equal(res.size, 9);
});

test('洗牌：晶石数不变，消耗 1 次', () => {
  const run = createRun(0, { seed: 7 });
  const before = run.state.gems;
  const res = run.shuffle();
  assert.ok(res.ok);
  assert.equal(run.state.shuffleLeft, 0);
  assert.equal(run.state.gems, before);
});

test('胜利：清空且达目标 → won', () => {
  const run = createRun(0, { seed: 7 });
  run.state.score = run.state.target + 1;
  for (let r = 0; r < N; r += 1) for (let c = 0; c < N; c += 1) if (run.state.grid[r][c] >= 0) run.state.grid[r][c] = EMPTY;
  run.state.gems = 0;
  run._checkEnd();
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1);
});

test('失败：时间耗尽 → lost', () => {
  const run = createRun(0, { seed: 7 });
  run.state.timeLeft = 0.05;
  run.step(0.2);
  assert.equal(run.state.phase, 'lost');
});

test('冲刺模式：对手每秒涨分', () => {
  const run = createRushRun({ seed: 7 });
  const r0 = run.state.rival;
  run.step(1.0);
  assert.ok(run.state.rival > r0, '对手分数应上涨');
});

test('connectedGroup：返回全部同色连通坐标', () => {
  const g = emptyBoard();
  g[0][0] = 2;
  g[0][1] = 2;
  g[1][0] = 2;
  const cells = connectedGroup(g, 0, 0);
  assert.equal(cells.length, 3);
});

test('hasMove：有相邻同色为 true，孤立为 false', () => {
  const g = emptyBoard();
  g[0][0] = 1;
  g[0][1] = 1;
  assert.equal(hasMove(g), true);
  const g2 = emptyBoard();
  g2[0][0] = 1;
  g2[0][2] = 1;
  assert.equal(hasMove(g2), false);
});

test('mulberry32：同 seed 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 5; i += 1) assert.equal(a(), b());
});
