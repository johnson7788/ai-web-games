import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

const SCENES = ['workshop-dawn', 'glass-afternoon', 'candle-night'];
const DIFFICULTIES = [1, 1.5, 2.2, 2.8, 3.2, 3.5, 4.2, 4.6, 5, 5.4, 6, 6.5];

test('关卡表：12 关、index 连续、难度锯齿一致', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => {
    assert.equal(lv.index, i + 1);
    assert.equal(lv.difficulty, DIFFICULTIES[i]);
  });
});

test('关卡表：字段完整且类型合法', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.rows >= 3 && lv.rows <= 6);
    assert.ok(lv.cols >= 3 && lv.cols <= 6);
    assert.ok(lv.time > 0);
    assert.ok(lv.movePar > 0);
    assert.ok(lv.timePar > 0);
    assert.ok(lv.scramble > 0);
    assert.ok(SCENES.includes(lv.scene));
    assert.ok(['square', 'hex'].includes(lv.cut));
    assert.equal(typeof lv.rotate, 'boolean');
    assert.equal(typeof lv.blind, 'boolean');
    assert.equal(typeof lv.dual, 'boolean');
    assert.equal(typeof lv.timed, 'boolean');
    assert.equal(typeof lv.hex, 'boolean');
    assert.equal(typeof lv.grand, 'boolean');
    assert.ok(lv.newElement && lv.newElement.trim().length > 0);
  }
});

test('关卡表：三章各 4 关，场景与章节一致', () => {
  for (let i = 0; i < 4; i += 1) assert.equal(LEVELS[i].chapter, 1);
  for (let i = 4; i < 8; i += 1) assert.equal(LEVELS[i].chapter, 2);
  for (let i = 8; i < 12; i += 1) assert.equal(LEVELS[i].chapter, 3);
  assert.ok(LEVELS.slice(0, 4).every((l) => l.scene === 'workshop-dawn'));
  assert.ok(LEVELS.slice(4, 8).every((l) => l.scene === 'glass-afternoon'));
  assert.ok(LEVELS.slice(8, 12).every((l) => l.scene === 'candle-night'));
});

test('关卡表：推进结构 3×3 → 4×4 → 4×5 → 5×5 → 6×6', () => {
  assert.deepEqual([LEVELS[0].rows, LEVELS[0].cols], [3, 3]);
  assert.deepEqual([LEVELS[1].rows, LEVELS[1].cols], [4, 4]);
  assert.deepEqual([LEVELS[2].rows, LEVELS[2].cols], [4, 5]);
  assert.deepEqual([LEVELS[3].rows, LEVELS[3].cols], [5, 5]);
  assert.deepEqual([LEVELS[11].rows, LEVELS[11].cols], [6, 6]);
});

test('机制开关：hex 仅 L5、rotate 仅 L7/L10、blind 仅 L8/L11、dual 仅 L9/L11、grand 仅 L12', () => {
  assert.deepEqual(LEVELS.map((l) => l.hex), [false, false, false, false, true, false, false, false, false, false, false, false]);
  assert.deepEqual(LEVELS.map((l) => l.rotate), [false, false, false, false, false, false, true, false, false, true, false, false]);
  assert.deepEqual(LEVELS.map((l) => l.blind), [false, false, false, false, false, false, false, true, false, false, true, false]);
  assert.deepEqual(LEVELS.map((l) => l.dual), [false, false, false, false, false, false, false, false, true, false, true, false]);
  assert.deepEqual(LEVELS.map((l) => l.grand), [false, false, false, false, false, false, false, false, false, false, false, true]);
});

test('数值一致性：movePar ≥ scramble，旋转关 rotateCount > 0', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.movePar >= lv.scramble, `L${lv.index} movePar 应 ≥ scramble`);
    if (lv.rotate) assert.ok(lv.rotateCount > 0, `L${lv.index} rotateCount 应 >0`);
    else assert.equal(lv.rotateCount, 0);
  }
});
