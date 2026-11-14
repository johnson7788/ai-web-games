import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, selectColor, tapCell, useHint, getHud, PICTURE_COUNT } from '../src/game/sim.js';
import { PICTURES } from '../config/pictures.js';
import { PALETTE, RULES, CONFIG } from '../config/game.config.js';

test('初始化：16×16 网格、有可填格、选中首色', () => {
  const run = createRun({ pictureIndex: 0 });
  assert.equal(run.size, 16);
  assert.ok(run.totalCells > 0);
  assert.equal(run.selectedColor, run.colors[0]);
  assert.equal(run.phase, 'playing');
});

test('图库完整性：每幅 16×16、字符合法、至少 2 色', () => {
  for (const pic of PICTURES) {
    assert.equal(pic.rows.length, 16, `${pic.name.en} 16 行`);
    for (const row of pic.rows) {
      assert.equal(row.length, 16, `${pic.name.en} 每行 16 列`);
      assert.ok(/^[0-9]+$/.test(row), '仅数字');
    }
    const colors = new Set(pic.rows.join('').split('').filter((x) => x !== '0'));
    assert.ok(colors.size >= 2, `${pic.name.en} 至少 2 色`);
    for (const c of colors) assert.ok(PALETTE[Number(c)], `颜色 ${c} 在调色板中`);
  }
});

test('正确填色：选中颜色点匹配格 → 填充', () => {
  const run = createRun({ pictureIndex: 0 });
  const color = run.selectedColor;
  let target = null;
  for (let r = 0; r < 16 && !target; r += 1) {
    for (let c = 0; c < 16 && !target; c += 1) {
      if (run.grid[r][c] === color) target = { r, c };
    }
  }
  const before = run.filledCount;
  const res = tapCell(run, target.r, target.c);
  assert.equal(res.ok, true);
  assert.equal(run.filled[target.r][target.c], true);
  assert.equal(run.filledCount, before + 1);
});

test('错误颜色：不填充并提示需要的颜色', () => {
  const run = createRun({ pictureIndex: 0 });
  // 找一个非当前颜色的格
  let target = null;
  for (let r = 0; r < 16 && !target; r += 1) {
    for (let c = 0; c < 16 && !target; c += 1) {
      if (run.grid[r][c] > 0 && run.grid[r][c] !== run.selectedColor) target = { r, c, v: run.grid[r][c] };
    }
  }
  const res = tapCell(run, target.r, target.c);
  assert.equal(res.kind, 'wrong');
  assert.equal(res.need, target.v);
  assert.equal(run.filled[target.r][target.c], false);
});

test('背景格（0）不可填', () => {
  const run = createRun({ pictureIndex: 0 });
  const res = tapCell(run, 0, 0); // 左上角为背景
  assert.equal(res.ok, false);
});

test('填完当前颜色自动切换下一色', () => {
  const run = createRun({ pictureIndex: 0 });
  const color = run.selectedColor;
  for (let r = 0; r < 16; r += 1) {
    for (let c = 0; c < 16; c += 1) {
      if (run.grid[r][c] === color) tapCell(run, r, c);
    }
  }
  assert.equal(run.remaining[color], 0);
  assert.notEqual(run.selectedColor, color, '切换到其它颜色');
});

test('填满整幅 → complete', () => {
  const run = createRun({ pictureIndex: 1 });
  for (let r = 0; r < 16; r += 1) {
    for (let c = 0; c < 16; c += 1) {
      const v = run.grid[r][c];
      if (v > 0) { selectColor(run, v); tapCell(run, r, c); }
    }
  }
  assert.equal(run.phase, 'complete');
  assert.equal(run.filledCount, run.totalCells);
});

test('提示：填一格、扣次数、用尽 null', () => {
  const run = createRun({ pictureIndex: 0 });
  for (let i = 0; i < RULES.hintLimit; i += 1) {
    const h = useHint(run);
    assert.ok(h, `第 ${i + 1} 次提示`);
    assert.equal(run.filled[h.r][h.c], true);
  }
  assert.equal(useHint(run), null);
});

test('配置默认值：6 幅 / en+zh', () => {
  assert.equal(PICTURE_COUNT, 6);
  assert.equal(PICTURE_COUNT, PICTURES.length);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun({ pictureIndex: 0 })).phase, 'playing');
});