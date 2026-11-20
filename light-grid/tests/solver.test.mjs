import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../config/levels.js';
import {
  buildPressMatrix, solveGauss, targetFor, solveLinearLevel, applyPressesLinear, levelHasCapacitor, isAllLit,
} from '../src/game/solver.js';
import { createRun } from '../src/game/sim.js';

test('Gauss：2×2 可解系统找到解', () => {
  // 按压矩阵（每个格翻转自身+正交邻格），目标=把 [1,0,0,0] 翻成全亮
  const M = [
    [1, 1, 1, 0],
    [1, 1, 0, 1],
    [1, 0, 1, 1],
    [0, 1, 1, 1],
  ];
  const x = solveGauss(M, [1, 0, 0, 0]);
  assert.ok(x, '应找到解');
  // 校验 M·x === target
  const out = M.map((row) => row.reduce((s, v, j) => s ^ (v & x[j]), 0));
  assert.deepEqual(out, [1, 0, 0, 0]);
});

test('Gauss：无解系统返回 null', () => {
  const M = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 0],
  ];
  assert.equal(solveGauss(M, [0, 0, 1]), null);
});

test('buildPressMatrix：node 按压模式正确（中心格翻转自身+上下左右）', () => {
  const types = [
    ['node', 'node', 'node'],
    ['node', 'node', 'node'],
    ['node', 'node', 'node'],
  ];
  const M = buildPressMatrix(types);
  // 按压中心 (1,1)=idx 4，影响的格：4,1,7,3,5
  const affected = [];
  for (let i = 0; i < 9; i += 1) if (M[i][4] === 1) affected.push(i);
  assert.deepEqual(affected.sort((a, b) => a - b), [1, 3, 4, 5, 7]);
});

test('每个线性格型关卡：Gauss 有解且解能翻到全亮', () => {
  let linearCount = 0;
  for (const level of LEVELS) {
    if (levelHasCapacitor(level)) continue;
    linearCount += 1;
    const { solvable, presses } = solveLinearLevel(level);
    assert.equal(solvable, true, `关卡 ${level.index} Gauss 无解`);
    const solved = applyPressesLinear(level, presses);
    assert.equal(isAllLit(solved), true, `关卡 ${level.index} Gauss 解未翻到全亮`);
  }
  assert.ok(linearCount > 0, '应至少存在若干线性格型关卡');
});

test('每个关卡（含电容）：正向重放生成解必然全亮', () => {
  for (const level of LEVELS) {
    const run = createRun({ level: level.index - 1 });
    for (const [r, c] of run.solution) {
      if (run.phase !== 'playing') break;
      run.press(r, c);
    }
    assert.equal(run.phase, 'solved', `关卡 ${level.index} 重放未解出`);
    assert.equal(run.board.flat().every((v) => v === 1), true, `关卡 ${level.index} 未全亮`);
  }
});

test('关卡库规模与尺寸覆盖满足规格（≥36，每尺寸≥8）', () => {
  assert.equal(LEVELS.length, 36);
  for (const size of [5, 6, 7]) {
    const count = LEVELS.filter((l) => l.size === size).length;
    assert.equal(count, 12, `尺寸 ${size} 应有 12 关`);
  }
});

test('三章各 12 关且色板区分', () => {
  for (const ch of ['motherboard', 'gpu', 'neon']) {
    const count = LEVELS.filter((l) => l.chapter === ch).length;
    assert.equal(count, 12, `章节 ${ch} 应有 12 关`);
  }
});

test('buildLevels 确定性：两次构建结果一致', async () => {
  const a = (await import('../config/levels.js')).buildLevels();
  const b = (await import('../config/levels.js')).buildLevels();
  assert.deepEqual(a, b);
});
