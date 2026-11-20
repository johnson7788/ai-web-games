import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIN } from '../config/game.config.js';
import { canWin, getListen, getEatOptions, getPongArray, getKongOptions } from '../src/game/mahjong.js';
import { buildWallTiles, mulberry32 } from '../src/game/tiles.js';
import { createRun } from '../src/game/sim.js';

test('平胡：4 面子 + 序数对子 → PINGHU', () => {
  const hand = [11, 11, 11, 12, 13, 14, 21, 22, 23, 31, 32, 33, 35, 35];
  assert.equal(canWin(hand, 45), WIN.PINGHU);
});

test('三头金：3 张金 → THREEJIN', () => {
  const hand = [11, 11, 11, 12, 13, 14, 21, 22, 23, 31, 31, 45, 45, 45];
  assert.equal(canWin(hand, 45), WIN.THREEJIN);
});

test('金雀：全成组 + 恰两金 → JINQUE', () => {
  const hand = [11, 11, 11, 12, 13, 14, 21, 22, 23, 31, 32, 33, 45, 45];
  assert.equal(canWin(hand, 45), WIN.JINQUE);
});

test('风箭对子不参与胡牌 → 不能胡', () => {
  const hand = [11, 11, 11, 12, 13, 14, 21, 22, 23, 31, 32, 33, 41, 41];
  assert.equal(canWin(hand, 45), WIN.NONE);
});

test('听牌：摸 11 或 14 能胡', () => {
  const hand = [11, 12, 13, 14];
  const listen = getListen(hand, 31);
  assert.ok(canWin(hand.concat(11), 31) > WIN.NONE);
  assert.ok(canWin(hand.concat(14), 31) > WIN.NONE);
  assert.ok(listen.includes(11) && listen.includes(14));
});

test('碰：两张同牌可碰，一张不可碰', () => {
  assert.deepEqual(getPongArray([11, 11, 13], 11), [11, 11, 11]);
  assert.deepEqual(getPongArray([11, 13], 11), []);
});

test('暗杠：四张同牌可杠', () => {
  const opts = getKongOptions([11, 11, 11, 11], 2, 0);
  assert.equal(opts.length, 1);
  assert.equal(opts[0].kongType, 2);
});

test('明杠：三张 + 弃牌可杠', () => {
  const opts = getKongOptions([11, 11, 11], 1, 11);
  assert.equal(opts.length, 1);
  assert.equal(opts[0].kongType, 1);
});

test('吃：能找出顺子，且排除含金的顺子', () => {
  assert.equal(getEatOptions([12, 13], 14, 45).length, 1);
  assert.equal(getEatOptions([11, 12], 13, 12).length, 0);
});

test('牌墙共 144 张', () => {
  assert.equal(buildWallTiles().length, 144);
});

test('发牌：庄家 17 张、闲家 16 张', () => {
  const run = createRun(7);
  const s = run.state;
  assert.equal(s.seats[0].hand.length, 17);
  assert.equal(s.seats[1].hand.length, 16);
  assert.equal(s.seats[2].hand.length, 16);
  assert.equal(s.seats[3].hand.length, 16);
});

test('牌数守恒：墙 + 手牌 + 花 + 金 = 144', () => {
  const run = createRun(9);
  const s = run.state;
  const flowers = s.seats.reduce((a, seat) => a + seat.flowers.length, 0);
  const hands = s.seats.reduce((a, seat) => a + seat.hand.length, 0);
  assert.equal(s.wall.length + hands + flowers + 1, 144);
});

test('金是序数牌（< 41）', () => {
  const run = createRun(11);
  assert.ok(run.state.joker >= 11 && run.state.joker < 41);
});

test('出牌推进：庄家出牌后轮到下家摸牌', () => {
  const run = createRun(13);
  // 快进到庄家（自己）可出牌
  let guard = 0;
  while (guard++ < 2000 && !(run.state.stage === 'awaitDiscard' && run.state.actor === 0)) {
    run.step(1 / 60);
  }
  const hand = run.state.seats[0].hand.slice();
  const tile = hand[hand.length - 1];
  const res = run.discard(tile);
  assert.equal(res.ok, true);
  assert.equal(run.state.seats[0].discards.length, 1);
});

test('mulberry32 同种子可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});
