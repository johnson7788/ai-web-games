// BILLION HUSTLE · 纯逻辑测试（node:test，无 DOM）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, formatMoney, formatMoneyFull } from '../src/game/sim.js';
import { ECO, UPGRADES, PARTNERS, ROUNDS, roundTarget, sceneIdForRound } from '../config/gameplay.js';

function argmaxHeat(run) {
  let best = 0;
  for (let i = 1; i < run.sectors.length; i += 1) {
    if (run.sectors[i].heat > run.sectors[best].heat) best = i;
  }
  return best;
}

test('初始状态：playing / 启动金 / 第一轮 / 估值 0', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.cash, ECO.startCash);
  assert.equal(r.totalEarned, 0);
  assert.equal(r.round, 1);
});

test('点击：同时增加现金与估值', () => {
  const r = createRun({ seed: 2 });
  r.click();
  assert.equal(r.cash, ECO.startCash + 1);
  assert.equal(r.totalEarned, 1);
  assert.equal(r.stats.clicks, 1);
});

test('点击力随 tap 等级按 1.5 幂增长', () => {
  const r = createRun({ seed: 3 });
  const before = r.clickPowerOf();
  r.cash = 1e9;
  r.buyUpgrade('tap');
  assert.ok(r.clickPowerOf() > before);
  assert.ok(Math.abs(r.clickPowerOf() - before * UPGRADES[0].mult) < 1e-9);
});

test('购买升级：扣现金、升等级', () => {
  const r = createRun({ seed: 4 });
  r.cash = 100;
  const ok = r.buyUpgrade('tap');
  assert.equal(ok, true);
  assert.equal(r.tapLevel, 1);
  assert.equal(r.cash, 100 - UPGRADES[0].baseCost);
});

test('购买升级：现金不足则失败', () => {
  const r = createRun({ seed: 5 });
  r.cash = 1;
  assert.equal(r.buyUpgrade('auto'), false);
  assert.equal(r.autoLevel, 0);
});

test('雇佣伙伴：增加被动收入，且不可重复雇佣', () => {
  const r = createRun({ seed: 6 });
  r.cash = 1e9;
  assert.equal(r.hirePartner('intern'), true);
  const income = r.incomePerSecOf();
  assert.ok(income > ECO.baseAuto);
  assert.equal(r.hirePartner('intern'), false);
});

test('被动收入随 tick 累积', () => {
  const r = createRun({ seed: 7 });
  for (let i = 0; i < 60; i += 1) r.step();
  assert.ok(r.cash > ECO.startCash);
  assert.ok(r.totalEarned > 0);
});

test('烧钱模式：开启后倍率 ×2', () => {
  const r = createRun({ seed: 8 });
  assert.equal(r.multOf(), 1);
  assert.equal(r.toggleBurn(), true);
  assert.equal(r.multOf(), 2);
  assert.equal(r.toggleBurn(), false); // 已激活不可重复
});

test('烧钱模式：结束后进入冷却', () => {
  const r = createRun({ seed: 9 });
  r.toggleBurn();
  r.burn.activeRemaining = 0.01;
  r.step();
  assert.equal(r.burn.active, false);
  assert.ok(r.burn.cooldownRemaining > 0);
  assert.equal(r.toggleBurn(), false); // 冷却中不可再开
});

test('押注：每轮只能押一次', () => {
  const r = createRun({ seed: 10 });
  assert.equal(r.placeBet(0), true);
  assert.equal(r.bet, 0);
  assert.equal(r.placeBet(2), false);
});

test('风口押中：开启 ×3 收益窗口', () => {
  const r = createRun({ seed: 11 });
  const hot = argmaxHeat(r);
  r.placeBet(hot);
  r.windfall.cycleRemaining = 0.01;
  r.step();
  assert.equal(r.windfall.active, true);
  assert.equal(r.multOf(), 3);
});

test('风口押错：不开启 ×3，记录失败', () => {
  const r = createRun({ seed: 12 });
  const hot = argmaxHeat(r);
  const wrong = (hot + 1) % r.sectors.length;
  r.placeBet(wrong);
  r.windfall.cycleRemaining = 0.01;
  r.step();
  assert.equal(r.windfall.active, false);
  assert.equal(r.stats.betsLost, 1);
});

test('估值达种子轮目标后进入天使轮', () => {
  const r = createRun({ seed: 13 });
  r.totalEarned = roundTarget(1) - 1;
  r.cash = 1e6;
  r.click();
  assert.equal(r.round, 2);
  assert.ok(r.drainEvents().some((e) => e.type === 'fund'));
});

test('场景包映射：1→车库 / 5→孵化器 / 9→摩天', () => {
  assert.equal(sceneIdForRound(1), 'garage');
  assert.equal(sceneIdForRound(5), 'incubator');
  assert.equal(sceneIdForRound(9), 'skyscraper');
});

test('估值达 IPO 目标后结算 won', () => {
  const r = createRun({ seed: 14 });
  r.totalEarned = ROUNDS[ROUNDS.length - 1].target - 1;
  r.cash = 1e9;
  r.click();
  assert.equal(r.phase, 'won');
  assert.ok(r.drainEvents().some((e) => e.type === 'won'));
});

test('估值里程碑：跨 10 倍边界发事件', () => {
  const r = createRun({ seed: 15 });
  r.totalEarned = 9;
  r.cash = 100;
  r.click(); // 10 → 触发 milestone
  assert.ok(r.drainEvents().some((e) => e.type === 'milestone'));
});

test('formatMoney：K/M/B 缩写', () => {
  assert.equal(formatMoney(999), '999');
  assert.equal(formatMoney(1500), '1.5K');
  assert.equal(formatMoney(2500000), '2.5M');
  assert.equal(formatMoney(1500000000), '1.5B');
});

test('formatMoneyFull：千分位', () => {
  assert.equal(formatMoneyFull(1234567), '1,234,567');
  assert.equal(formatMoneyFull(0), '0');
});

test('getHud 形状完整', () => {
  const r = createRun({ seed: 16 });
  const h = r.getHud();
  for (const k of ['cash', 'valuation', 'incomePerSec', 'mult', 'clickPower', 'round', 'roundName', 'roundProgress', 'sceneId', 'burnActive', 'windfallCycleRemaining', 'sectors', 'partners']) {
    assert.ok(k in h, `缺 ${k}`);
  }
  assert.equal(h.sectors.length, 6);
});
