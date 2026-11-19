import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeDeck, classify, canBeat, TYPES, legalMoves, createRun, pickGreedyMove, sortCards, shuffle, mulberry32, RANK_LABELS,
} from '../src/game/sim.js';

const c = (r, s) => ({ r, s, id: r * 100 + s });

test('makeDeck 返回 54 张：13 点数×4 + 大小王', () => {
  const deck = makeDeck();
  assert.equal(deck.length, 54);
  assert.equal(deck.filter((x) => x.r === 16).length, 1);
  assert.equal(deck.filter((x) => x.r === 17).length, 1);
  assert.equal(deck.filter((x) => x.r === 15).length, 4);
});

test('classify 单张/对子/三张/炸弹', () => {
  assert.equal(classify([c(7, 0)]).type, TYPES.SINGLE);
  assert.equal(classify([c(9, 0), c(9, 1)]).type, TYPES.PAIR);
  assert.equal(classify([c(10, 0), c(10, 1), c(10, 2)]).type, TYPES.THREE);
  assert.equal(classify([c(13, 0), c(13, 1), c(13, 2), c(13, 3)]).type, TYPES.BOMB);
});

test('classify 王炸与大小王单张', () => {
  assert.equal(classify([c(16, -1), c(17, -1)]).type, TYPES.ROCKET);
  assert.equal(classify([c(16, -1)]).type, TYPES.SINGLE);
  assert.equal(classify([c(17, -1)]).type, TYPES.SINGLE);
});

test('classify 顺子/连对/飞机，2 不进顺子', () => {
  assert.equal(classify([c(3, 0), c(4, 0), c(5, 0), c(6, 0), c(7, 0)]).type, TYPES.STRAIGHT);
  assert.equal(classify([c(3, 0), c(3, 1), c(4, 0), c(4, 1), c(5, 0), c(5, 1)]).type, TYPES.STRAIGHT_PAIR);
  assert.equal(classify([c(3, 0), c(3, 1), c(3, 2), c(4, 0), c(4, 1), c(4, 2)]).type, TYPES.PLANE);
  // 2(15) 参与的四张连续不算顺子
  assert.equal(classify([c(12, 0), c(13, 0), c(14, 0), c(15, 0), c(3, 0)]), null);
});

test('classify 三带一 / 三带对 / 四带二', () => {
  assert.equal(classify([c(8, 0), c(8, 1), c(8, 2), c(5, 0)]).type, TYPES.THREE_SINGLE);
  assert.equal(classify([c(8, 0), c(8, 1), c(8, 2), c(5, 0), c(5, 1)]).type, TYPES.THREE_PAIR);
  assert.equal(classify([c(8, 0), c(8, 1), c(8, 2), c(8, 3), c(5, 0), c(6, 0)]).type, TYPES.FOUR_TWO_SINGLE);
});

test('classify 非法牌型返回 null', () => {
  assert.equal(classify([c(3, 0), c(4, 0)]), null); // 两张非对
  assert.equal(classify([c(3, 0), c(3, 1), c(4, 0), c(4, 1)]), null); // 双对不是合法牌型
  assert.equal(classify([c(3, 0), c(3, 1), c(3, 2), c(3, 3), c(5, 0), c(6, 0), c(7, 0)]), null); // 四带三单非法
});

test('canBeat 炸弹/王炸/同型比大小', () => {
  const bomb7 = classify([c(7, 0), c(7, 1), c(7, 2), c(7, 3)]);
  const bomb9 = classify([c(9, 0), c(9, 1), c(9, 2), c(9, 3)]);
  const rocket = classify([c(16, -1), c(17, -1)]);
  const single7 = classify([c(7, 0)]);
  const single10 = classify([c(10, 0)]);
  assert.equal(canBeat(bomb9, bomb7), true);
  assert.equal(canBeat(bomb7, bomb9), false);
  assert.equal(canBeat(rocket, bomb9), true);
  assert.equal(canBeat(bomb9, rocket), false);
  assert.equal(canBeat(bomb7, single10), true);
  assert.equal(canBeat(single10, single7), true);
  assert.equal(canBeat(single7, single10), false);
  assert.equal(canBeat(single7, bomb7), false);
});

test('createRun 发牌：地主 20 / 农民各 17 / 底牌 3 张', () => {
  const run = createRun(1, { seed: 42 });
  assert.equal(run.state.players[0].hand.length, 20);
  assert.equal(run.state.players[1].hand.length, 17);
  assert.equal(run.state.players[2].hand.length, 17);
  assert.equal(run.state.bottomCards.length, 3);
  assert.equal(run.state.landlord, 0);
  assert.equal(run.state.phase, 'playing');
});

test('地主首手有合法领出（legalMoves 非空）', () => {
  const run = createRun(1, { seed: 7 });
  const moves = legalMoves(run.state.players[0].hand, null);
  assert.ok(moves.length > 0);
  assert.ok(moves.some((m) => m.type === TYPES.SINGLE));
});

test('pickGreedyMove 在可出时返回合法牌型', () => {
  const run = createRun(1, { seed: 7 });
  const m = pickGreedyMove(run.state.players[0].hand, null);
  assert.ok(m);
  assert.ok(classify(m.cards));
});

test('一整局自动打完进入 ended，且结算 winner 非空', () => {
  const run = createRun(1, { seed: 11, aiThinkMs: 0 });
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 20000) {
    guard += 1;
    if (run.state.turn === 0) run.autoPlay();
    else run.step(0.1);
  }
  assert.equal(run.state.phase, 'ended');
  assert.ok(run.state.winner === 'you' || run.state.winner === 'farmers');
  assert.ok(run.state.score > 0);
});

test('结算事件包含 win/lose 与 end', () => {
  const run = createRun(1, { seed: 11, aiThinkMs: 0 });
  let guard = 0;
  const seen = new Set();
  while (run.state.phase === 'playing' && guard < 20000) {
    guard += 1;
    if (run.state.turn === 0) run.autoPlay();
    else run.step(0.1);
    for (const e of run.drainEvents()) seen.add(e.type);
  }
  assert.ok(seen.has('win') || seen.has('lose'));
  assert.ok(seen.has('end'));
});

test('shuffle 用同一 seed 可复现同一顺序', () => {
  const a = shuffle(makeDeck(), mulberry32(99));
  const b = shuffle(makeDeck(), mulberry32(99));
  assert.deepEqual(a.map((x) => x.r), b.map((x) => x.r));
});

test('RANK_LABELS 覆盖全部点数', () => {
  for (let r = 3; r <= 17; r += 1) assert.ok(RANK_LABELS[r], `rank ${r} label`);
});

test('sortCards 按点数升序，王在最后', () => {
  const sorted = sortCards([c(17, -1), c(3, 0), c(16, -1), c(15, 0), c(4, 0)]);
  assert.deepEqual(sorted.map((x) => x.r), [3, 4, 15, 16, 17]);
});
