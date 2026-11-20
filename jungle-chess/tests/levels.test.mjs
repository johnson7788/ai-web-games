import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT, aiTierName } from '../config/levels.js';
import { setupBoard, genMoves, initialBoard, BLUE, RED, ROWS, COLS, rc, DEN, pieceSide } from '../src/game/rules.js';
import { bestMove, WIN_SCORE } from '../src/game/ai.js';

const SCENES = ['dawn-mist', 'monsoon', 'night-song'];

test('关卡表：12 关、index 连续、场景三章', () => {
  assert.equal(LEVEL_COUNT, 12);
  LEVELS.forEach((lv, i) => {
    assert.equal(lv.index, i + 1);
    assert.ok(SCENES.includes(lv.scene), `L${lv.index} 非法场景`);
    assert.ok(lv.newElement && lv.newElement.length > 0);
  });
});

test('谜题关卡字段完整且目标合法', () => {
  for (const lv of LEVELS.slice(0, 6)) {
    assert.equal(lv.kind, 'puzzle');
    assert.ok(Array.isArray(lv.setup) && lv.setup.length > 0);
    assert.ok(lv.movesToWin >= 1);
    assert.ok(lv.goal && (lv.goal.type === 'den' || (lv.goal.type === 'piece' && Number.isInteger(lv.goal.animal))));
    // 蓝方至少一子、红方至少一子
    const b = setupBoard(lv.setup);
    let blue = 0; let red = 0;
    for (let i = 0; i < b.length; i += 1) {
      if (b[i] !== 0) { if (pieceSide(b[i]) === BLUE) blue += 1; else red += 1; }
    }
    assert.ok(blue >= 1 && red >= 1, `L${lv.index} 缺少一方子力`);
  }
});

test('谜题摆放：界内、不重叠、不占兽穴', () => {
  for (const lv of LEVELS.slice(0, 6)) {
    const seen = new Set();
    for (const p of lv.setup) {
      assert.ok(p.r >= 0 && p.r < ROWS && p.c >= 0 && p.c < COLS, `L${lv.index} 越界`);
      const k = `${p.r},${p.c}`;
      assert.ok(!seen.has(k), `L${lv.index} 重叠 ${k}`);
      seen.add(k);
      const idx = rc(p.r, p.c);
      assert.notEqual(idx, DEN[BLUE], `L${lv.index} 占蓝穴`);
      assert.notEqual(idx, DEN[RED], `L${lv.index} 占红穴`);
    }
  }
});

test('对局关卡字段完整：AI 档位与深度映射', () => {
  const expect = {
    7: ['novice', 1], 8: ['novice', 1],
    9: ['senior', 2], 10: ['senior', 2],
    11: ['elder', 3], 12: ['perfect', 4],
  };
  for (const lv of LEVELS.slice(6)) {
    assert.equal(lv.kind, 'game');
    assert.deepEqual([lv.aiTier, lv.aiDepth], expect[lv.index]);
    assert.deepEqual(lv.goal, { type: 'den' });
  }
});

test('aiTierName 映射', () => {
  assert.equal(aiTierName('novice'), 'tierNovice');
  assert.equal(aiTierName('senior'), 'tierSenior');
  assert.equal(aiTierName('elder'), 'tierElder');
  assert.equal(aiTierName('perfect'), 'tierPerfect');
});

test('完整对局初始：蓝红各 8 子，蓝有 10 步走法', () => {
  const b = initialBoard();
  assert.equal(genMoves(b, BLUE).length, 10);
  assert.equal(genMoves(b, RED).length, 10);
});

test('全部谜题：AI 在 2*movesToWin+1 深度内必胜', () => {
  for (const lv of LEVELS.slice(0, 6)) {
    const b = setupBoard(lv.setup);
    const depth = lv.movesToWin * 2 + 1;
    const m = bestMove(b, BLUE, depth, lv.goal);
    assert.ok(m && m.score >= WIN_SCORE - 10, `L${lv.index} 未能在 ${depth} 深度内必胜`);
  }
});
