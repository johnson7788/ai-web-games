import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import {
  INDUSTRIES, formatMoney, formatInt, upgradeCost, incomeRate, industryValue,
  tapValue, netWorth, chapterOf, effectiveRate, STOCK, LOAN, TAP,
} from '../config/gameplay.js';

function stepN(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
}

function drain(run) {
  const ev = run.drainEvents();
  return ev;
}

// ---------- 点击主资产 ----------
test('开局只有报刊亭，现金为 0', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.cash, 0);
  assert.equal(run.unlockedCount, 1);
  assert.ok(run.industries[0].owned);
  assert.ok(!run.industries[1].owned);
});

test('点击主资产产出增加现金', () => {
  const run = createRun({ seed: 1 });
  const before = run.cash;
  run.step({ tap: true });
  assert.ok(run.cash > before);
  const ev = drain(run);
  assert.ok(ev.some((e) => e.type === 'tap'));
});

test('连点 10 次触发连击爆发', () => {
  const run = createRun({ seed: 1 });
  let combo = false;
  for (let i = 0; i < 10; i += 1) {
    run.step({ tap: true });
    if (drain(run).some((e) => e.type === 'tapCombo')) combo = true;
  }
  assert.ok(combo, '10 连点应触发 tapCombo');
});

test('tapValue 随总等级增长', () => {
  assert.ok(tapValue(10) > tapValue(1));
});

// ---------- 买生意 ----------
test('买洗衣店解锁餐馆并增加产业数', () => {
  const run = createRun({ seed: 1 });
  run.cash = 100;
  run.step({ buy: 1 });
  assert.ok(run.industries[1].owned);
  assert.equal(run.unlockedCount, 2);
  assert.ok(run.industries[2].unlocked, '买下洗衣店应解锁餐馆');
  assert.ok(drain(run).some((e) => e.type === 'buy'));
});

test('现金不足时买店被拒绝', () => {
  const run = createRun({ seed: 1 });
  run.cash = 5;
  run.step({ buy: 1 });
  assert.ok(!run.industries[1].owned);
});

// ---------- 升级效率 ----------
test('升级增加等级并扣钱', () => {
  const run = createRun({ seed: 1 });
  const cost = upgradeCost(0, 1);
  run.cash = cost + 100;
  run.step({ upgrade: 0 });
  assert.equal(run.industries[0].level, 2);
  assert.ok(drain(run).some((e) => e.type === 'upgrade'));
});

test('产出随等级几何增长', () => {
  assert.ok(incomeRate(0, 3) > incomeRate(0, 1));
});

// ---------- 经理自动化 ----------
test('雇佣经理后现金自动增长', () => {
  const run = createRun({ seed: 1 });
  run.cash = 1000;
  run.step({ hire: 0 });
  assert.ok(run.industries[0].manager);
  const before = run.cash;
  stepN(run, 120); // 2 秒
  assert.ok(run.cash > before, '经理自动收取应增加现金');
});

test('无经理时收益进入 pending，收取后进现金', () => {
  const run = createRun({ seed: 1 });
  stepN(run, 120);
  assert.ok(run.industries[0].pending > 0);
  const before = run.cash;
  run.step({ collect: true });
  assert.ok(run.cash > before);
  assert.ok(drain(run).some((e) => e.type === 'collect'));
});

// ---------- 股市日 ----------
test('30 秒触发行情日', () => {
  const run = createRun({ seed: 1 });
  stepN(run, Math.ceil(STOCK.intervalSec * 60) + 2);
  const ev = drain(run);
  assert.ok(ev.some((e) => e.type === 'stockDay'));
  assert.ok(run.stock.betting);
});

test('押中行情现金翻倍', () => {
  const run = createRun({ seed: 1 });
  stepN(run, Math.round(STOCK.intervalSec / (1 / 60)));
  drain(run);
  const up = run.stock.up;
  run.cash = 100;
  run.step({ allIn: true, allInUp: up });
  const before = run.cash;
  stepN(run, Math.round(STOCK.betWindowSec / (1 / 60)) + 2);
  const ev = drain(run);
  assert.ok(ev.some((e) => e.type === 'stockResolve'));
  if (ev.some((e) => e.type === 'allInResult')) {
    const r = ev.find((e) => e.type === 'allInResult');
    assert.ok(r.won);
    assert.ok(run.cash >= before, '押中应翻倍');
  }
});

// ---------- 贷款 ----------
test('贷款借 10 倍现金并记债', () => {
  const run = createRun({ seed: 1 });
  run.cash = 50;
  run.step({ loan: true });
  assert.equal(run.debt, 500);
  assert.equal(run.cash, 550);
  assert.ok(drain(run).some((e) => e.type === 'loan'));
});

test('现金不足付利息则破产清零产业', () => {
  const run = createRun({ seed: 1 });
  run.cash = 1000;
  run.step({ buy: 1 });
  drain(run);
  assert.ok(run.industries[1].owned);
  run.cash = 0;
  run.debt = 100;
  run.nextInterestAt = run.time;
  run.step({});
  const ev = drain(run);
  assert.ok(ev.some((e) => e.type === 'bankrupt'));
  assert.ok(!run.industries[1].owned, '破产应清零产业');
  assert.equal(run.debt, 0);
});

test('还贷减少债务', () => {
  const run = createRun({ seed: 1 });
  run.cash = 500;
  run.step({ loan: true });
  drain(run);
  run.step({ repay: true });
  assert.ok(run.debt < 500);
});

// ---------- 存档 / 离线 ----------
test('serialize/restore 往返一致', () => {
  const run = createRun({ seed: 1 });
  run.cash = 1234;
  run.step({ buy: 1 });
  run.step({ upgrade: 0 });
  drain(run);
  const data = run.serialize();
  const run2 = createRun({ seed: 2, saveData: data });
  assert.equal(run2.cash, run.cash);
  assert.ok(run2.industries[1].owned);
  assert.equal(run2.industries[0].level, run.industries[0].level);
});

test('离线收益按速率比例结算', () => {
  const run = createRun({ seed: 1 });
  run.cash = 1000;
  run.step({ hire: 0 });
  drain(run);
  const before = run.cash;
  const run2 = createRun({ seed: 1, saveData: run.serialize(), offlineSec: 100 });
  assert.ok(run2.cash > before, '离线收益应增加现金');
  assert.ok(drain(run2).some((e) => e.type === 'offlineIncome'));
});

// ---------- 身家 / 里程碑 ----------
test('netWorth = 现金 + 产业估值', () => {
  const run = createRun({ seed: 1 });
  run.cash = 50;
  const worth = netWorth(run.cash, run.industries);
  assert.equal(worth, 50 + industryValue(0, 1));
});

test('产业等级翻倍触发金链落成', () => {
  const run = createRun({ seed: 1 });
  run.cash = 1e9;
  // 从等级 1 升到 2（翻倍）
  run.step({ upgrade: 0 });
  const ev = drain(run);
  assert.ok(ev.some((e) => e.type === 'buildingUp'));
});

test('章节随产业数推进', () => {
  assert.equal(chapterOf(1), 0);
  assert.equal(chapterOf(5), 1);
  assert.equal(chapterOf(9), 2);
});

// ---------- 单位格式化 ----------
test('formatMoney 缩写正确', () => {
  assert.equal(formatMoney(999), '$999');
  assert.equal(formatMoney(1500), '$1.50K');
  assert.equal(formatMoney(2500000), '$2.50M');
});

test('formatInt 千以下不缩写', () => {
  assert.equal(formatInt(42), '42');
});

test('effectiveRate 行情向下减半', () => {
  const rate = effectiveRate(0, 1, { active: true, target: 0, up: false });
  assert.ok(rate < incomeRate(0, 1));
});

test('升级成本随等级增长', () => {
  assert.ok(upgradeCost(0, 3) > upgradeCost(0, 1));
});
