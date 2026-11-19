import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, damageFor, mulberry32 } from '../src/game/sim.js';
import { CARDS } from '../config/cards.js';
import { GAME } from '../config/game.config.js';

function advanceTo(run, phase, maxSteps = 200) {
  for (let i = 0; i < maxSteps && run.state.phase !== phase; i += 1) run.step(0.1);
  return run.state.phase;
}

function toPlayerTurn(run) {
  return advanceTo(run, 'playerTurn');
}

function maxCard(attr) {
  let best = 0;
  let bestV = -1;
  for (let i = 0; i < CARDS.length; i += 1) {
    if (CARDS[i].stats[attr] > bestV) { bestV = CARDS[i].stats[attr]; best = i; }
  }
  return best;
}

function minCard(attr) {
  let best = 0;
  let bestV = Infinity;
  for (let i = 0; i < CARDS.length; i += 1) {
    if (CARDS[i].stats[attr] < bestV) { bestV = CARDS[i].stats[attr]; best = i; }
  }
  return best;
}

function forceWin(run, attr = 0) {
  run.state.roundAttribute = attr;
  run.state.hand = [maxCard(attr)];
  run.state.enemyHand = [minCard(attr)];
}

test('开局：5 张手牌 / 10 生命 / 0 金币 / reveal 阶段', () => {
  const run = createRun(42);
  assert.equal(run.state.hand.length, GAME.HAND_SIZE);
  assert.equal(run.state.playerHp, GAME.MAX_HEALTH);
  assert.equal(run.state.enemyHp, GAME.MAX_HEALTH);
  assert.equal(run.state.coins, 0);
  assert.equal(run.state.phase, 'reveal');
});

test('同 seed 完全可复现（手牌与属性一致）', () => {
  const a = createRun(7);
  const b = createRun(7);
  assert.deepEqual(a.state.hand, b.state.hand);
  assert.equal(a.state.roundAttribute, b.state.roundAttribute);
});

test('reveal 倒计时结束后进入 playerTurn', () => {
  const run = createRun(1);
  assert.equal(toPlayerTurn(run), 'playerTurn');
});

test('出牌后手牌保持 5 张，且记录已出牌', () => {
  const run = createRun(3);
  toPlayerTurn(run);
  const card = run.state.hand[0];
  const res = run.playCard(card);
  assert.equal(res.ok, true);
  assert.equal(run.state.hand.length, GAME.HAND_SIZE);
  assert.equal(run.state.playerPlayed, card);
  assert.equal(run.state.phase, 'resolving');
});

test('出不在手牌的卡返回失败', () => {
  const run = createRun(5);
  toPlayerTurn(run);
  const notInHand = run.state.hand[0] === 0 ? 1 : 0;
  assert.equal(run.playCard(notInHand).ok, false);
});

test('伤害分档：平局 0、差比≤20%→2、≤40%→4、否则 6', () => {
  assert.deepEqual(damageFor(100, 100), { winner: 'draw', dmg: 0 });
  assert.equal(damageFor(100, 90).dmg, 2);   // 10%
  assert.equal(damageFor(100, 70).dmg, 4);   // 30%
  assert.equal(damageFor(100, 30).dmg, 6);   // 70%
});

test('伤害归属：数值高的一方获胜', () => {
  assert.equal(damageFor(300, 200).winner, 'player');
  assert.equal(damageFor(200, 300).winner, 'enemy');
});

test('buff：出牌属性 ×1.1（四舍五入）', () => {
  const run = createRun(9);
  toPlayerTurn(run);
  run.state.coins = 1000;
  run.useAbility('buff');
  const card = run.state.hand[0];
  run.playCard(card);
  const expected = Math.round(CARDS[card].stats[run.state.roundAttribute] * GAME.BUFF_INC);
  assert.equal(run.state.playerVal, expected);
});

test('overdrive：出牌属性 ×2', () => {
  const run = createRun(11);
  toPlayerTurn(run);
  run.state.coins = 1000;
  run.useAbility('overdrive');
  const card = run.state.hand[0];
  run.playCard(card);
  const expected = Math.round(CARDS[card].stats[run.state.roundAttribute] * GAME.OVERDRIVE_INC);
  assert.equal(run.state.playerVal, expected);
});

test('debuff：敌方属性 ×0.85', () => {
  const run = createRun(13);
  toPlayerTurn(run);
  run.state.coins = 1000;
  run.useAbility('debuff');
  const card = run.state.hand[0];
  run.playCard(card);
  const expected = Math.round(CARDS[run.state.enemyPlayed].stats[run.state.roundAttribute] * GAME.DEBUFF_DEC);
  assert.equal(run.state.enemyVal, expected);
});

test('cancel：本回合双方 0 伤害', () => {
  const run = createRun(15);
  toPlayerTurn(run);
  run.state.coins = 1000;
  run.useAbility('cancel');
  run.playCard(run.state.hand[0]);
  assert.equal(run.state.lastDamage.winner, 'draw');
  assert.equal(run.state.lastDamage.total, 0);
});

test('连击：连胜 2 回合获得额外伤害', () => {
  const run = createRun(17);
  toPlayerTurn(run);
  forceWin(run, 0);
  run.playCard(run.state.hand[0]);          // 第 1 胜 → combo=1
  assert.equal(run.state.combo, 1);
  assert.equal(run.state.lastDamage.bonus, 0);
  advanceTo(run, 'playerTurn');
  forceWin(run, 0);
  run.playCard(run.state.hand[0]);          // 第 2 胜 → combo=2 → bonus=1
  assert.equal(run.state.combo, 2);
  assert.ok(run.state.lastDamage.bonus >= 1);
});

test('连击在失利后重置为 0', () => {
  const run = createRun(19);
  toPlayerTurn(run);
  run.state.combo = 3;
  run.state.hand = [minCard(0)];
  run.state.enemyHand = [maxCard(0)];
  run.state.roundAttribute = 0;
  run.playCard(run.state.hand[0]);
  assert.equal(run.state.combo, 0);
});

test('把敌方生命打到 0 → won 且按剩余生命给星', () => {
  const run = createRun(21);
  toPlayerTurn(run);
  run.state.playerHp = 9;
  run.state.enemyHp = 1;
  forceWin(run, 0);
  run.playCard(run.state.hand[0]);
  advanceTo(run, 'won');
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.stars, 3);         // 剩余 9 ≥ 8 → 3 星
});

test('超时自动出牌：playerTurn 过久会自行结算', () => {
  const run = createRun(23);
  toPlayerTurn(run);
  run.step(GAME.TURN_TIME + 0.1);
  assert.ok(run.state.phase === 'resolving' || run.state.phase === 'won' || run.state.phase === 'lost');
});

test('getHud 返回 HUD 所需字段', () => {
  const run = createRun(25);
  const hud = run.getHud();
  assert.equal(typeof hud.playerHp, 'number');
  assert.equal(typeof hud.enemyHp, 'number');
  assert.equal(typeof hud.coins, 'number');
  assert.equal(typeof hud.round, 'number');
});

test('mulberry32 稳定输出', () => {
  const a = mulberry32(99);
  const b = mulberry32(99);
  assert.equal(a(), b());
  assert.equal(a(), b());
});
