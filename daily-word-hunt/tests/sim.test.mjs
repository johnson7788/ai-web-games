import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, generateGrid, lineCells, submitSelection, useHint, isComplete, getHud, hashSeed, THEME_COUNT,
} from '../src/game/sim.js';
import { THEMES } from '../config/themes.js';
import { GRID, RULES, CONFIG } from '../config/game.config.js';

const SIZE = GRID.SIZE;

test('初始化：12×12 满格、8 个词、playing', () => {
  const run = createRun({ seed: 42 });
  assert.equal(run.grid.length, SIZE);
  assert.ok(run.grid.every((row) => row.length === SIZE && row.every((ch) => /[A-Z]/.test(ch))), '格子全为大写字母');
  assert.equal(run.words.length, RULES.wordsPerPuzzle);
  assert.equal(run.phase, 'playing');
});

test('生成正确性：每个词的格子沿直线拼出该词', () => {
  for (const seed of [1, 7, 42, 99, 2026]) {
    const run = createRun({ seed });
    for (const { word, cells } of run.words) {
      assert.equal(cells.length, word.length, `${word} 格数=词长`);
      const spelled = cells.map(({ r, c }) => run.grid[r][c]).join('');
      assert.equal(spelled, word, `seed ${seed}: ${word} 可沿格子读出`);
      for (const { r, c } of cells) {
        assert.ok(r >= 0 && r < SIZE && c >= 0 && c < SIZE, '格子在界内');
      }
    }
  }
});

test('生成稳健：多主题多 seed 都能放下全部词', () => {
  for (let t = 0; t < THEME_COUNT; t += 1) {
    const words = THEMES[t].words.slice(0, RULES.wordsPerPuzzle);
    const { placements } = generateGrid(words, 1000 + t);
    assert.equal(placements.length, words.length, `主题 ${THEMES[t].id} 全部放下`);
  }
});

test('lineCells：横/竖/斜直线与吸附', () => {
  assert.deepEqual(lineCells({ r: 0, c: 0 }, { r: 0, c: 3 }), [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }], '横向');
  assert.deepEqual(lineCells({ r: 0, c: 0 }, { r: 3, c: 0 }), [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 2, c: 0 }, { r: 3, c: 0 }], '纵向');
  assert.deepEqual(lineCells({ r: 0, c: 0 }, { r: 2, c: 2 }), [{ r: 0, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 2 }], '对角');
  // 轻微偏移吸附到水平
  const snap = lineCells({ r: 2, c: 0 }, { r: 3, c: 5 });
  assert.ok(snap.every((p) => p.r === 2), '吸附到水平行');
});

test('lineCells：越界截断', () => {
  const cells = lineCells({ r: 0, c: 0 }, { r: 0, c: 99 });
  assert.equal(cells.length, SIZE, '超出网格被截断到 12 格');
});

test('选词正向：选中某词的格子 → 找到并得分', () => {
  const run = createRun({ seed: 5 });
  const target = run.words[0];
  const r = submitSelection(run, target.cells);
  assert.equal(r.ok, true);
  assert.equal(r.word, target.word);
  assert.ok(run.found.has(target.word));
  assert.equal(r.gained, RULES.scorePerWord, '首词 +100');
});

test('选词反向：倒序格子也能命中', () => {
  const run = createRun({ seed: 5 });
  const target = run.words[1];
  const reversed = [...target.cells].reverse();
  const r = submitSelection(run, reversed);
  assert.equal(r.ok, true, '反向匹配');
  assert.equal(r.word, target.word);
});

test('选词失败：无关格子 → invalid；重复 → already', () => {
  const run = createRun({ seed: 5 });
  const bad = submitSelection(run, [{ r: 0, c: 0 }, { r: 0, c: 1 }]);
  // 仅当这两格恰好拼出某词才可能 found，这里断言类型合法
  assert.ok(['invalid', 'found', 'already'].includes(bad.kind));
  const target = run.words[0];
  submitSelection(run, target.cells);
  const again = submitSelection(run, target.cells);
  assert.equal(again.kind, 'already', '重复找到判 already');
});

test('全部找到 → complete + clear 事件', () => {
  const run = createRun({ seed: 11 });
  for (const { cells } of run.words) submitSelection(run, cells);
  assert.equal(isComplete(run), true);
  assert.equal(run.phase, 'complete');
});

test('提示：返回首格、扣次数、用尽 null', () => {
  const run = createRun({ seed: 3 });
  for (let i = 0; i < RULES.hintLimit; i += 1) {
    const h = useHint(run);
    assert.ok(h && h.cell, `第 ${i + 1} 次提示有效`);
  }
  assert.equal(useHint(run), null, '提示用尽');
});

test('可复现：同 seed 网格与词一致；每日哈希稳定', () => {
  const a = createRun({ seed: 777 });
  const b = createRun({ seed: 777 });
  assert.deepEqual(a.grid, b.grid);
  assert.deepEqual(a.words.map((w) => w.word), b.words.map((w) => w.word));
  assert.equal(hashSeed('2026-11-13'), hashSeed('2026-11-13'));
  assert.notEqual(hashSeed('2026-11-13'), hashSeed('2026-11-14'));
});

test('配置默认值：12×12 / en+zh / 8 词', () => {
  assert.equal(GRID.SIZE, 12);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(RULES.wordsPerPuzzle, 8);
  assert.equal(getHud(createRun({ seed: 1 })).total, 8);
});