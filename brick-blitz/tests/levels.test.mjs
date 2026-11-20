import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

const VALID_CHARS = new Set(['.', '1', '2', '3', 'g', 'b']);
const SCENES = ['celadon', 'jun-red', 'sky-blue'];

test('关卡表：12 关、index 连续', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
});

test('关卡表：pattern 每行长度 === cols，且只含合法字符', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.cols >= 8, `L${lv.index} cols 过小`);
    assert.ok(Array.isArray(lv.pattern) && lv.pattern.length >= 3);
    for (const line of lv.pattern) {
      assert.equal(line.length, lv.cols, `L${lv.index} 行宽不等于 cols`);
      for (const ch of line) assert.ok(VALID_CHARS.has(ch), `L${lv.index} 非法字符 ${ch}`);
    }
  }
});

test('关卡表：每关至少有一块砖，且 newElement 互不相同', () => {
  const elements = new Set();
  for (const lv of LEVELS) {
    assert.ok(lv.pattern.join('').replace(/\./g, '').length > 0, `L${lv.index} 无砖`);
    elements.add(lv.newElement);
  }
  assert.equal(elements.size, LEVELS.length, 'newElement 有重复');
});

test('章节：L1-4 青瓷窑 / L5-8 钧红窑 / L9-12 天青窑', () => {
  for (let i = 0; i < 4; i += 1) assert.equal(LEVELS[i].scene, 'celadon');
  for (let i = 4; i < 8; i += 1) assert.equal(LEVELS[i].scene, 'jun-red');
  for (let i = 8; i < 12; i += 1) assert.equal(LEVELS[i].scene, 'sky-blue');
  for (const lv of LEVELS) assert.ok(SCENES.includes(lv.scene));
});

test('关卡特性：descend 仅在 L5/L11', () => {
  assert.equal(LEVELS[4].descend, true);
  assert.equal(LEVELS[10].descend, true);
  for (const lv of LEVELS) if (![5, 11].includes(lv.index)) assert.ok(!lv.descend, `L${lv.index} 不应 descend`);
});

test('关卡特性：moveCols 在 L4/L11/L12', () => {
  assert.ok(LEVELS[3].moveCols && LEVELS[3].moveCols.length);
  assert.ok(LEVELS[10].moveCols && LEVELS[10].moveCols.length);
  assert.ok(LEVELS[11].moveCols && LEVELS[11].moveCols.length);
});

test('关卡特性：startBalls 在 L8/L12', () => {
  assert.equal(LEVELS[7].startBalls, 2);
  assert.equal(LEVELS[11].startBalls, 2);
});

test('关卡特性：paddleW 仅在 L7（窄缝防守）', () => {
  assert.equal(LEVELS[6].paddleW, 80);
  for (const lv of LEVELS) if (lv.index !== 7) assert.ok(!lv.paddleW, `L${lv.index} 不应有 paddleW`);
});

test('关卡砖型覆盖：1/2/3/g/b 五种都在 12 关中至少出现一次', () => {
  const all = LEVELS.map((lv) => lv.pattern.join('')).join('');
  for (const ch of ['1', '2', '3', 'g', 'b']) assert.ok(all.includes(ch), `缺砖型 ${ch}`);
});
