import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, evalHand, mulberry32, featuresForRound,
  GAME, JOKER, CHIP_SIZES, HAND_ORDER,
} from '../src/game/sim.js';

// 强制发牌并结算一轮（在 afterSettle 重置前抓取结算快照，供确定性断言）
function settleRound(run, hands, bets) {
  run.state.bets = { ...bets };
  run.state.chips = GAME.START_CHIPS - (bets.sun + bets.moon + bets.star);
  run.forceHands(hands);
  run.state.timers.reveal = 0.001;
  run.step(0.01); // reveal -> doSettle -> settle
  const snapshot = {
    results: { ...run.state.results },
    net: run.state.net,
    comboBonus: run.state.comboBonus,
    chips: run.state.chips,
    streak: run.state.streak,
  };
  run.step(2);    // settle -> afterSettle
  return { run, snapshot };
}

test('evalHand：点数 = (a+b)%10', () => {
  const h = evalHand(3, 4);
  assert.equal(h.kind, 'point');
  assert.equal(h.power, 7);
});

test('evalHand：对子 power = 20 + 牌面', () => {
  const h = evalHand(7, 7);
  assert.equal(h.kind, 'pair');
  assert.equal(h.power, 27);
});

test('evalHand：万能牌 + 任意 = 对子', () => {
  const h = evalHand(JOKER, 5);
  assert.equal(h.kind, 'pair');
  assert.equal(h.power, 25);
  assert.equal(h.hasJoker, true);
});

test('evalHand：双万能牌最高', () => {
  const h = evalHand(JOKER, JOKER);
  assert.equal(h.kind, 'doubleJoker');
  assert.equal(h.power, 100);
});

test('初始状态：50000 筹码、第 1 轮、betting', () => {
  const run = createRun(7);
  assert.equal(run.state.chips, GAME.START_CHIPS);
  assert.equal(run.state.round, 1);
  assert.equal(run.state.phase, 'betting');
});

test('mulberry32 可复现', () => {
  assert.equal(mulberry32(42)(), mulberry32(42)());
});

test('featuresForRound：第 2 轮开万能牌，第 3 轮开连胜', () => {
  assert.equal(featuresForRound(1).joker, false);
  assert.equal(featuresForRound(2).joker, true);
  assert.equal(featuresForRound(3).streak, true);
  assert.equal(featuresForRound(4).combo, true);
});

test('下注扣筹码并累加到门', () => {
  const run = createRun(1);
  const r = run.bet('sun');
  assert.equal(r.ok, true);
  assert.equal(run.state.bets.sun, CHIP_SIZES[0]);
  assert.equal(run.state.chips, GAME.START_CHIPS - CHIP_SIZES[0]);
});

test('未下注时不能开牌', () => {
  const run = createRun(1);
  const r = run.roll();
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'nobet');
});

test('开牌后发四手并进入 rolling', () => {
  const run = createRun(1);
  run.bet('sun');
  const r = run.roll();
  assert.equal(r.ok, true);
  assert.equal(run.state.phase, 'rolling');
  for (const who of HAND_ORDER) assert.ok(run.state.hands[who]);
  assert.ok(run.state.dice[0] >= 1 && run.state.dice[0] <= 6);
});

test('门点数大于庄家 → 门赢、筹码增加', () => {
  const run = createRun(1);
  const { snapshot } = settleRound(run, { house: [1, 2], sun: [9, 9], moon: [3, 5], star: [2, 2] }, { sun: 100, moon: 0, star: 0 });
  assert.equal(snapshot.results.sun, 'win');
  assert.ok(snapshot.chips > GAME.START_CHIPS);
});

test('平局庄家通吃 → 门输', () => {
  const run = createRun(1);
  const { snapshot } = settleRound(run, { house: [3, 4], sun: [2, 5], moon: [1, 1], star: [1, 1] }, { sun: 100, moon: 0, star: 0 });
  assert.equal(snapshot.results.sun, 'lose');
  assert.ok(snapshot.chips < GAME.START_CHIPS);
});

test('连胜倍率：streak=2 时赢门赔付 ×1.5', () => {
  const run = createRun(1);
  run.state.round = 3;
  run.state.streak = 2;
  const { snapshot } = settleRound(run, { house: [1, 2], sun: [9, 9], moon: [1, 1], star: [1, 1] }, { sun: 1000, moon: 0, star: 0 });
  assert.equal(snapshot.results.sun, 'win');
  assert.equal(snapshot.net, 1500);
});

test('多门连击：赢两门给额外奖励', () => {
  const run = createRun(1);
  run.state.round = 4;
  const { snapshot } = settleRound(run, { house: [1, 2], sun: [9, 9], moon: [8, 8], star: [1, 1] }, { sun: 500, moon: 500, star: 0 });
  assert.equal(snapshot.results.sun, 'win');
  assert.equal(snapshot.results.moon, 'win');
  assert.ok(snapshot.comboBonus > 0);
});

test('破产 → 结算为 lost', () => {
  const run = createRun(1);
  run.state.chips = GAME.MIN_BET - 1;
  run.state.round = 1;
  run.state.bets = { sun: 0, moon: 0, star: 0 };
  run.forceHands({ house: [1, 2], sun: [3, 4], moon: [5, 6], star: [7, 8] });
  run.state.timers.reveal = 0.001;
  run.step(0.01);
  run.step(2);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.bankrupt, true);
});

test('第 8 轮结束 → 结算为 won 且给星级', () => {
  const run = createRun(1);
  run.state.round = GAME.MAX_ROUNDS;
  const { run: r } = settleRound(run, { house: [1, 2], sun: [9, 9], moon: [8, 8], star: [7, 7] }, { sun: 100, moon: 100, star: 100 });
  assert.equal(r.state.phase, 'won');
  assert.ok(r.state.stars >= 1);
  assert.equal(r.state.completed, true);
});

test('事件流：下注-开牌-发牌产生可感知事件', () => {
  const run = createRun(1);
  run.bet('sun');
  run.roll();
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'bet'));
  assert.ok(evs.some((e) => e.type === 'roll'));
  assert.ok(evs.some((e) => e.type === 'dice'));
});
