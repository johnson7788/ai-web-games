import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';

function freshRun(board, types, N = 3) {
  const run = createRun({ level: 0 });
  run.N = N;
  run.board = board.map((r) => r.slice());
  run.types = types.map((r) => r.slice());
  run.charges = new Uint8Array(N * N);
  run.steps = 0;
  run.par = 99;
  run.maxSteps = 999;
  run.stars = 0;
  run.events = [];
  return run;
}

function allOnes(N) {
  return Array.from({ length: N }, () => Array(N).fill(1));
}

function typesOf(N, specials = {}) {
  const t = Array.from({ length: N }, () => Array(N).fill('node'));
  for (const [key, rc] of Object.entries(specials)) t[rc[0]][rc[1]] = key;
  return t;
}

test('createRun 初始状态符合契约', () => {
  const run = createRun({ level: 0 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.levelIndex, 0);
  assert.equal(run.steps, 0);
  assert.equal(run.stats.levelsReached, 1);
  assert.equal(run.N, 5);
  assert.ok(Array.isArray(run.solution) && run.solution.length > 0);
  assert.deepEqual(run.drainEvents().map((e) => e.type).filter((t) => t === 'levelStart'), ['levelStart']);
});

test('点普通节点：翻转自身 + 上下左右', () => {
  const run = freshRun(allOnes(3), typesOf(3), 3);
  run.press(1, 1);
  assert.equal(run.board[1][1], 0);
  assert.equal(run.board[0][1], 0);
  assert.equal(run.board[2][1], 0);
  assert.equal(run.board[1][0], 0);
  assert.equal(run.board[1][2], 0);
  assert.equal(run.board[0][0], 1);
  assert.equal(run.steps, 1);
});

test('二极管：只翻转自身 + 下方两格', () => {
  const types = typesOf(4, { diode: [1, 1] });
  const run = freshRun(allOnes(4), types, 4);
  run.press(1, 1);
  assert.equal(run.board[1][1], 0);
  assert.equal(run.board[2][1], 0);
  assert.equal(run.board[3][1], 0);
  assert.equal(run.board[0][1], 1); // 上方不受影响
  assert.equal(run.board[1][0], 1);
  assert.equal(run.board[1][2], 1);
});

test('继电器：翻转自身 + 四个对角', () => {
  const types = typesOf(3, { relay: [1, 1] });
  const run = freshRun(allOnes(3), types, 3);
  run.press(1, 1);
  assert.equal(run.board[1][1], 0);
  assert.equal(run.board[0][0], 0);
  assert.equal(run.board[0][2], 0);
  assert.equal(run.board[2][0], 0);
  assert.equal(run.board[2][2], 0);
  assert.equal(run.board[0][1], 1);
  assert.equal(run.board[1][0], 1);
});

test('电容：第一下只蓄能不翻转，第二下翻转自身+上下左右', () => {
  const types = typesOf(3, { capacitor: [1, 1] });
  const board = allOnes(3);
  board[2][2] = 0; // 初始非全亮，避免蓄能时误判过关
  const run = freshRun(board, types, 3);
  run.press(1, 1);
  assert.equal(run.board[1][1], 1, '第一下不翻转');
  assert.equal(run.charges[1 * 3 + 1], 1, '第一下进入蓄能');
  assert.equal(run.steps, 1);
  run.press(1, 1);
  assert.equal(run.charges[1 * 3 + 1], 0, '第二下放电');
  assert.equal(run.board[1][1], 0);
  assert.equal(run.board[0][1], 0);
  assert.equal(run.board[2][1], 0);
  assert.equal(run.board[1][0], 0);
  assert.equal(run.board[1][2], 0);
  assert.equal(run.steps, 2);
});

test('绝缘格：点击不翻转、不计步，发出 blocked', () => {
  const types = typesOf(3, { insulator: [1, 1] });
  const run = freshRun(allOnes(3), types, 3);
  run.press(1, 1);
  assert.equal(run.board[1][1], 1);
  assert.equal(run.steps, 0);
  assert.ok(run.drainEvents().some((e) => e.type === 'blocked'));
});

test('全亮即过关：phase=solved 且发 solved 事件', () => {
  const board = [[1, 1], [1, 1]];
  const run = freshRun(board, typesOf(2), 2);
  run.par = 1;
  // 先点成非全亮再点回全亮
  run.press(0, 0); // 翻转 (0,0),(1,0),(0,1)
  assert.notEqual(run.phase, 'solved');
  run.press(0, 0); // 点回
  assert.equal(run.phase, 'solved');
  assert.ok(run.drainEvents().some((e) => e.type === 'solved'));
});

test('星级：steps 相对 par 判定（≤par 三星 / ≤par+2 两星 / 其余一星）', () => {
  const mk = (parOffset) => {
    const run = createRun({ level: 0 });
    const solLen = run.solution.length;
    run.par = solLen + parOffset;
    for (const [r, c] of run.solution) run.press(r, c);
    assert.equal(run.phase, 'solved');
    return run.stars;
  };
  assert.equal(mk(0), 3);  // steps == par
  assert.equal(mk(-2), 2); // steps == par+2
  assert.equal(mk(-3), 1); // steps == par+3 > par+2
});

test('过载：步数到上限且未全亮 → phase=dead + overload 事件', () => {
  const run = freshRun(allOnes(3), typesOf(3), 3);
  run.maxSteps = 3;
  run.press(0, 0); // 全亮→部分灭
  run.press(1, 1);
  run.press(2, 2);
  assert.equal(run.phase, 'dead');
  assert.ok(run.drainEvents().some((e) => e.type === 'overload'));
});

test('nextLevel：推进到下一关并更新 levelsReached', () => {
  const run = createRun({ level: 0 });
  const first = run.levelIndex;
  assert.ok(run.nextLevel());
  assert.equal(run.levelIndex, first + 1);
  assert.equal(run.phase, 'playing');
  assert.equal(run.stats.levelsReached, first + 2);
});

test('hint：返回解中的一格并发 hint 事件', () => {
  const run = createRun({ level: 0 });
  const rc = run.hint();
  assert.ok(Array.isArray(rc) && rc.length === 2);
  assert.ok(run.drainEvents().some((e) => e.type === 'hint'));
});

test('同 seed 同关卡 → 同初始盘面（确定性）', () => {
  const a = createRun({ level: 0 });
  const b = createRun({ level: 0 });
  assert.deepEqual(a.board, b.board);
  assert.deepEqual(a.solution, b.solution);
});

test('press 越界不抛错且不改步数', () => {
  const run = createRun({ level: 0 });
  const before = run.steps;
  run.press(-1, 0);
  run.press(0, 99);
  assert.equal(run.steps, before);
});

test('getHud 字段齐全', () => {
  const run = createRun({ level: 0 });
  const hud = run.getHud();
  for (const k of ['level', 'chapter', 'N', 'steps', 'par', 'maxSteps', 'remaining', 'lit', 'total', 'litPercent', 'phase', 'stars', 'hintsUsed']) {
    assert.ok(k in hud, `缺字段 ${k}`);
  }
  assert.equal(hud.level, 1);
  assert.equal(hud.total, 25);
});

test('全部 36 关：解可正向重放至全亮', () => {
  for (const level of LEVELS) {
    const run = createRun({ level: level.index - 1 });
    for (const [r, c] of run.solution) {
      if (run.phase !== 'playing') break;
      run.press(r, c);
    }
    assert.equal(run.phase, 'solved', `关卡 ${level.index} 未解出`);
    assert.equal(run.board.flat().every((v) => v === 1), true, `关卡 ${level.index} 未全亮`);
  }
});

test('每关 par === solution 长度且盘面非全亮', () => {
  for (const level of LEVELS) {
    assert.equal(level.par, level.solution.length, `关卡 ${level.index} par 不一致`);
    assert.equal(level.board.flat().every((v) => v === 1), false, `关卡 ${level.index} 初始盘面应非全亮`);
  }
});

test('step 输入契约：{press:[r,c]} 触发按压并推进时间', () => {
  const run = createRun({ level: 0 });
  const [r, c] = run.solution[0];
  run.step({ press: [r, c] });
  assert.equal(run.steps, 1);
  assert.ok(run.time > 0);
  assert.ok(run.drainEvents().some((e) => e.type === 'press'));
});
