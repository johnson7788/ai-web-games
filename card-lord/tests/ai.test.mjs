import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseBid, chooseLead, chooseFollow, bidScore, isBombPlay } from '../src/game/ai.js';
import { typeJudge, canBeat } from '../src/game/rules.js';
import { buildDeck, shuffle, sortHand } from '../src/game/cards.js';
import { mulberry32 } from '../src/game/rng.js';

let seq = 0;
function mk(ranks) {
  const used = new Map();
  return ranks.map((r) => {
    const s = used.get(r) || 0;
    used.set(r, s + 1);
    return { id: seq++, rank: r, suit: s };
  });
}

function deal(seed) {
  const deck = shuffle(buildDeck(), mulberry32(seed));
  return sortHand(deck.slice(0, 17));
}

test('叫分评分：大小王/2 计分', () => {
  const hand = mk([16, 17, 15, 15, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 3]);
  const s = bidScore(hand);
  assert.ok(s >= 8 + 4, `score=${s}`); // 王炸 8 + 两个 2 记 4
});

test('叫分：强牌倾向叫高分', () => {
  const strong = mk([16, 17, 15, 15, 15, 15, 14, 14, 14, 14, 13, 13, 12, 12, 11, 11, 10]);
  assert.ok(chooseBid(strong, 1) >= 2, `bid=${chooseBid(strong, 1)}`);
  const weak = mk([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 3, 4, 5, 6, 7, 8]);
  assert.equal(chooseBid(weak, 1), 0);
});

test('领出：总是返回合法牌型', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const hand = deal(seed);
    const lead = chooseLead(hand, 0.8);
    assert.ok(lead && lead.length > 0, `seed ${seed} 领出非空`);
    assert.ok(typeJudge(lead), `seed ${seed} 领出合法`);
    const remain = hand.filter((c) => !lead.some((x) => x.id === c.id));
    assert.equal(remain.length, hand.length - lead.length);
  }
});

test('跟牌：返回压得过的合法牌或 null', () => {
  const hand = deal(7);
  const prev = { kind: 1, val: 5, size: 1 };
  const f = chooseFollow(hand, prev, 0.8);
  if (f) {
    const j = typeJudge(f);
    assert.ok(j, '跟牌合法');
    assert.ok(canBeat(prev, j), '跟牌能压过上家');
  }
});

test('跟牌：王炸时不出', () => {
  const hand = mk([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 3, 4, 5, 6]);
  const prev = { kind: 14, val: 17, size: 2 };
  assert.equal(chooseFollow(hand, prev, 1), null);
});

test('炸弹/王炸识别', () => {
  assert.equal(isBombPlay(mk([8, 8, 8, 8])), true);
  assert.equal(isBombPlay(mk([16, 17])), true);
  assert.equal(isBombPlay(mk([3, 4, 5, 6, 7])), false);
});

test('带牌领出覆盖多种牌型（20 副随机手牌）', () => {
  for (let seed = 100; seed < 120; seed += 1) {
    const hand = deal(seed);
    const lead = chooseLead(hand, 1);
    assert.ok(typeJudge(lead), `seed ${seed} lead=${lead.map((c) => c.rank).join(',')}`);
  }
});
