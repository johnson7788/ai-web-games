import { test } from 'node:test';
import assert from 'node:assert/strict';
import { typeJudge, canBeat, K } from '../src/game/rules.js';

// 构造测试牌：ranks 按点数给，同点数自动分配不同花色与唯一 id
let seq = 0;
function mk(ranks) {
  const used = new Map();
  return ranks.map((r) => {
    const s = used.get(r) || 0;
    used.set(r, s + 1);
    return { id: seq++, rank: r, suit: s };
  });
}
function judge(ranks) {
  return typeJudge(mk(ranks));
}

test('单张', () => {
  assert.equal(judge([5]).kind, K.ONE);
  assert.equal(judge([14]).val, 14);
});

test('对子', () => {
  assert.equal(judge([7, 7]).kind, K.PAIRS);
});

test('三条', () => {
  assert.equal(judge([9, 9, 9]).kind, K.THREE);
});

test('三带一', () => {
  const j = judge([10, 10, 10, 4]);
  assert.equal(j.kind, K.THREE_ONE);
  assert.equal(j.val, 10);
});

test('三带一对', () => {
  const j = judge([12, 12, 12, 5, 5]);
  assert.equal(j.kind, K.THREE_PAIRS);
  assert.equal(j.val, 12);
});

test('炸弹', () => {
  assert.equal(judge([8, 8, 8, 8]).kind, K.BOMB);
});

test('王炸', () => {
  assert.equal(judge([16, 17]).kind, K.ROCKET);
});

test('顺子长度边界：5 张合法', () => {
  assert.equal(judge([3, 4, 5, 6, 7]).kind, K.STRAIGHT);
});

test('顺子长度边界：4 张不合法', () => {
  assert.equal(judge([3, 4, 5, 6]), null);
});

test('顺子长度边界：12 张合法（3..A）', () => {
  assert.equal(judge([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]).kind, K.STRAIGHT);
});

test('顺子含 2 不合法', () => {
  assert.equal(judge([11, 12, 13, 14, 15]), null);
});

test('顺子必须连续', () => {
  assert.equal(judge([3, 4, 5, 6, 8]), null);
});

test('连对：3 连对合法', () => {
  assert.equal(judge([4, 4, 5, 5, 6, 6]).kind, K.STRAIGHT_PAIRS);
});

test('连对：2 对不合法（至少 3 对）', () => {
  assert.equal(judge([4, 4, 5, 5]), null);
});

test('飞机：2 连三合法', () => {
  assert.equal(judge([6, 6, 6, 7, 7, 7]).kind, K.PLANE);
});

test('飞机带单', () => {
  const j = judge([6, 6, 6, 7, 7, 7, 9, 3]);
  assert.equal(j.kind, K.PLANE_ONE);
  assert.equal(j.val, 7);
});

test('飞机带对', () => {
  const j = judge([6, 6, 6, 7, 7, 7, 9, 9, 3, 3]);
  assert.equal(j.kind, K.PLANE_PAIRS);
  assert.equal(j.val, 7);
});

test('四带二（两个单）', () => {
  assert.equal(judge([5, 5, 5, 5, 9, 3]).kind, K.FOUR_TWO);
});

test('四带两对', () => {
  assert.equal(judge([5, 5, 5, 5, 9, 9, 3, 3]).kind, K.FOUR_TWO_PAIRS);
});

test('非法牌型返回 null', () => {
  assert.equal(judge([3, 5]), null);
  assert.equal(judge([3, 3, 5]), null);
});

test('压牌：同型同张数需更大', () => {
  assert.equal(canBeat(judge([4]), judge([6])), true);
  assert.equal(canBeat(judge([4]), judge([4])), false);
  assert.equal(canBeat(judge([6]), judge([4])), false);
});

test('压牌：对子只能对子压', () => {
  assert.equal(canBeat(judge([6, 6]), judge([7, 7])), true);
  assert.equal(canBeat(judge([6, 6]), judge([8, 8, 8])), false);
});

test('压牌：顺子须同长度', () => {
  assert.equal(canBeat(judge([3, 4, 5, 6, 7]), judge([4, 5, 6, 7, 8])), true);
  assert.equal(canBeat(judge([3, 4, 5, 6, 7]), judge([3, 4, 5, 6, 7, 8])), false);
});

test('炸弹压一切（除王炸）', () => {
  assert.equal(canBeat(judge([3, 4, 5, 6, 7]), judge([8, 8, 8, 8])), true);
  assert.equal(canBeat(judge([14, 14]), judge([8, 8, 8, 8])), true);
});

test('王炸最大', () => {
  assert.equal(canBeat(judge([8, 8, 8, 8]), judge([16, 17])), true);
  assert.equal(canBeat(judge([16, 17]), judge([8, 8, 8, 8])), false);
});

test('炸弹对炸弹比大小', () => {
  assert.equal(canBeat(judge([8, 8, 8, 8]), judge([9, 9, 9, 9])), true);
  assert.equal(canBeat(judge([9, 9, 9, 9]), judge([8, 8, 8, 8])), false);
});

test('三带一压三带一', () => {
  assert.equal(canBeat(judge([5, 5, 5, 9]), judge([6, 6, 6, 3])), true);
});
