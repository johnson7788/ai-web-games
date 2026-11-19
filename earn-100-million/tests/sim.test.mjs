import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, computeBonuses, mulberry32 } from '../src/game/sim.js';
import { ECONOMY } from '../config/game.config.js';

test('createRun：开局 playing，年龄 20，初始现金为正', () => {
  const run = createRun({ seed: 1, initCash: 50000 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.age, 20);
  assert.ok(run.state.cash > 0);
});

test('初始市场：展示恰好 5 件商品', () => {
  const run = createRun({ seed: 2 });
  assert.equal(run.state.shownIds.length, 5);
  assert.equal(new Set(run.state.shownIds).size, 5);
});

test('buyGoods：扣钱并增加仓库占用', () => {
  const run = createRun({ seed: 3, initCash: 100000 });
  const id = run.state.shownIds[0];
  const before = run.state.cash;
  const res = run.buyGoods(id, 2);
  assert.equal(res.ok, true);
  assert.ok(run.state.cash < before);
  assert.equal(run.state.goods.find((g) => g.id === id).ownNum, 2);
});

test('buyGoods：现金不足拒绝', () => {
  const run = createRun({ seed: 4, initCash: 1 });
  const id = run.state.shownIds[0];
  const res = run.buyGoods(id, 100);
  assert.equal(res.ok, false);
});

test('buyGoods：仓库满拒绝', () => {
  const run = createRun({ seed: 5, initCash: 99999999 });
  const id = run.state.shownIds[0];
  const res = run.buyGoods(id, 1000);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'space');
});

test('sellGoods：盈利卖单连击 +1', () => {
  const run = createRun({ seed: 6, initCash: 1000000 });
  const g = run.state.goods[0];
  g.ownNum = 10;
  g.buyPrice = 50;
  g.marketPrice = 100;
  run.state.shownIds.push(g.id);
  const res = run.sellGoods(g.id, 10);
  assert.equal(res.ok, true);
  assert.equal(run.state.combo, 1);
  assert.equal(run.state.goods[0].ownNum, 0);
});

test('sellGoods：亏损卖单连击清零', () => {
  const run = createRun({ seed: 7, initCash: 1000000 });
  const g = run.state.goods[0];
  g.ownNum = 10;
  g.buyPrice = 100;
  g.marketPrice = 50;
  run.state.shownIds.push(g.id);
  run.state.combo = 3;
  run.sellGoods(g.id, 10);
  assert.equal(run.state.combo, 0);
});

test('nextYear：年龄 +1', () => {
  const run = createRun({ seed: 8 });
  const before = run.state.age;
  run.nextYear();
  assert.equal(run.state.age, before + 1);
});

test('createCompany：创办公司持有 100 股', () => {
  const run = createRun({ seed: 9, initCash: 1000000 });
  const res = run.createCompany(1);
  assert.equal(res.ok, true);
  const c = run.state.companies.find((x) => x.id === 1);
  assert.equal(c.shares, 100);
});

test('createCompany：已有公司时拒绝再创办', () => {
  const run = createRun({ seed: 10, initCash: 1000000 });
  run.createCompany(1);
  const res = run.createCompany(2);
  assert.equal(res.ok, false);
});

test('computeBonuses：空技能零加成', () => {
  const b = computeBonuses({}, null);
  assert.equal(b.cashPerYear, 0);
  assert.equal(b.retireBonus, 0);
});

test('赢：资产突破目标进入 won', () => {
  const run = createRun({ seed: 11, initCash: ECONOMY.GOAL + 1000 });
  run.nextYear();
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 4);
});

test('事件：25 岁后可能触发并可通过 answerEvent 结算', () => {
  const run = createRun({ seed: 12, initCash: 1000000 });
  run.state.age = 30;
  run.state.pendingEvent = run.state.eventPool[0];
  const res = run.answerEvent('N');
  assert.equal(res.ok, true);
  assert.equal(run.state.pendingEvent, null);
});

test('确定性：同 seed 开局现金一致', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  assert.equal(a.state.cash, b.state.cash);
  assert.deepEqual(a.state.shownIds, b.state.shownIds);
});

test('退休：超过退休年龄进入 retired', () => {
  const run = createRun({ seed: 13, initCash: 50000 });
  run.state.age = run.state.retireAge + 1;
  run.nextYear();
  assert.equal(run.state.phase, 'retired');
  assert.ok(run.state.summary);
});

test('mulberry32：稳定可复现', () => {
  const r1 = mulberry32(7);
  const r2 = mulberry32(7);
  const a = [r1(), r1(), r1()];
  const b = [r2(), r2(), r2()];
  assert.deepEqual(a, b);
});

test('赌注：赢了现金增加，输了现金减少', () => {
  const run = createRun({ seed: 14, initCash: 100000 });
  const before = run.state.cash;
  run.bet();
  assert.notEqual(run.state.cash, before);
  assert.equal(run.state.betCost, 2000);
});
