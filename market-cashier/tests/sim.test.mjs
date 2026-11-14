import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, newCustomer, scanItem, addMoney, resetChange, giveChange, tick,
  getHud, getTarget, chooseUpgrade, retryDay, getUpgradeChoices, suggestChange, createTutorialRun,
  getRank, multiplier,
} from '../src/game/sim.js';
import { RULES, DAYS } from '../config/game.config.js';
import { DENOMINATIONS } from '../config/products.js';

function scanAll(run) {
  run.customer.items.forEach((_, i) => scanItem(run, i));
}
function serve(run) {
  scanAll(run);
  resetChange(run);
  addMoney(run, run.customer.change);
  return giveChange(run);
}
function serveMany(run, n) {
  for (let i = 0; i < n; i += 1) {
    if (run.phase !== 'scan' && run.phase !== 'change') break;
    serve(run);
  }
}

test('创建一局：第 1 天、扫码阶段、3–5 件商品、金额以分计', () => {
  const run = createRun({ seed: 7 });
  const hud = getHud(run);
  assert.equal(hud.day, 1);
  assert.equal(hud.phase, 'scan');
  assert.ok(hud.items.length >= RULES.minItems && hud.items.length <= RULES.maxItems);
  assert.equal(hud.total, hud.items.reduce((a, x) => a + x.price, 0));
  assert.ok(hud.change > 0);
  assert.equal(hud.change, hud.payment - hud.total);
});

test('扫码：逐件推进，全部扫完切到找零阶段', () => {
  const run = createRun({ seed: 11 });
  const n = run.customer.items.length;
  for (let i = 0; i < n; i += 1) {
    assert.equal(run.phase, 'scan');
    scanItem(run, i);
  }
  assert.equal(run.phase, 'change');
  assert.equal(getHud(run).scanned, n);
  assert.equal(scanItem(run, 0).ok, false);
});

test('精确找零：得分 + 小费 + 进入下一位顾客', () => {
  const run = createRun({ seed: 3 });
  const change = run.customer.change;
  scanAll(run);
  addMoney(run, change);
  const res = giveChange(run);
  assert.equal(res.correct, true);
  assert.ok(run.score >= RULES.scorePerCorrect);
  assert.equal(run.served, 1);
  assert.equal(run.customerIndex, 1);
  assert.equal(run.combo, 1);
});

test('错误找零：扣分 + 连击清零 + 顾客耐心下降，不换人', () => {
  const run = createRun({ seed: 4 });
  serve(run);
  const before = run.score;
  const combo = run.combo;
  scanAll(run);
  addMoney(run, run.customer.change + 1);
  const patience = run.patience;
  const res = giveChange(run);
  assert.equal(res.correct, false);
  assert.equal(run.combo, 0);
  assert.ok(run.score <= before);
  assert.ok(run.patience < patience);
  assert.equal(run.customerIndex, 1);
  assert.ok(combo > 0);
});

test('重置找零：已找零归零', () => {
  const run = createRun({ seed: 5 });
  scanAll(run);
  addMoney(run, 100);
  assert.equal(getHud(run).givenChange, 100);
  resetChange(run);
  assert.equal(getHud(run).givenChange, 0);
});

test('耐心耗尽：扣分 + 换下一位', () => {
  const run = createRun({ seed: 6 });
  const score = run.score;
  tick(run, RULES.patience + 5);
  assert.equal(run.customerIndex, 1);
  assert.ok(run.score <= score);
  assert.equal(run.combo, 0);
});

test('一天 5 位顾客：达标进入 dayClear，可三选一升级', () => {
  const run = createRun({ seed: 8 });
  serveMany(run, 5);
  assert.equal(run.phase, 'dayClear');
  assert.ok(run.dayScore >= DAYS[0].target);
  const choices = getUpgradeChoices(run, 3);
  assert.equal(choices.length, 3);
  assert.equal(chooseUpgrade(run, choices[0].id).ok, true);
  assert.equal(run.dayIndex, 1);
  assert.equal(run.phase, 'scan');
  assert.ok(run.upgrades.includes(choices[0].id));
  assert.equal(chooseUpgrade(run, choices[0].id).ok, false);
});

test('一天失败：可重试，分数回到当天开始，保留升级', () => {
  const run = createRun({ seed: 9 });
  run.upgrades.push('quick-hands');
  for (let i = 0; i < 5; i += 1) tick(run, 40);
  assert.equal(run.phase, 'dayFail');
  assert.ok(run.dayScore < DAYS[0].target);
  const res = retryDay(run);
  assert.equal(res.ok, true);
  assert.equal(run.phase, 'scan');
  assert.equal(run.dayScore, 0);
  assert.equal(run.score, run.dayStartScore);
  assert.ok(run.upgrades.includes('quick-hands'));
  assert.equal(run.retries, 1);
});

test('整钞顾客：payment = total，change = 0，可直接交付', () => {
  const run = createRun({ seed: 12 });
  run.customer.exact = true;
  run.customer.payment = run.customer.total;
  run.customer.change = 0;
  scanAll(run);
  assert.equal(run.phase, 'change');
  const res = giveChange(run);
  assert.equal(res.correct, true);
  assert.equal(run.served, 1);
});

test('付款向上取整到 $10，恰好整额时多付 $10', () => {
  const run = createRun({ seed: 13 });
  run.customer.total = 880;
  run.customer.payment = 1000;
  run.customer.change = 120;
  run.customer.exact = false;
  assert.equal(run.customer.change, 120);
  const run2 = createRun({ seed: 14 });
  run2.customer.total = 1000;
  run2.customer.payment = 2000;
  run2.customer.change = 1000;
  assert.equal(run2.customer.change, 1000);
});

test('耐心升级：所有顾客 patienceMax +25%', () => {
  const a = createRun({ seed: 15 });
  const base = a.customer.patienceMax;
  const b = createRun({ seed: 15 });
  b.upgrades.push('patient-customers');
  newCustomer(b);
  assert.ok(b.customer.patienceMax > base);
  assert.equal(Math.round(b.customer.patienceMax * 10) / 10, Math.round(base * 1.25 * 10) / 10);
});

test('小费上限升级：满耐心小费从 50 → 75', () => {
  const a = createRun({ seed: 16 });
  scanAll(a);
  addMoney(a, a.customer.change);
  const resA = giveChange(a);
  const tipA = a.events.filter((e) => e.type === 'sale' && e.correct).at(-1).tip;
  assert.equal(resA.correct, true);
  assert.equal(tipA, 50);

  const b = createRun({ seed: 16 });
  b.upgrades.push('generous-tips');
  scanAll(b);
  addMoney(b, b.customer.change);
  const resB = giveChange(b);
  const tipB = b.events.filter((e) => e.type === 'sale' && e.correct).at(-1).tip;
  assert.equal(resB.correct, true);
  assert.equal(tipB, 75);
});

test('连击倍率：第二次成交倍率高于第一次', () => {
  const run = createRun({ seed: 17 });
  serve(run);
  assert.equal(multiplier(run), 1.15);
  const scoreAfterFirst = run.score;
  serve(run);
  assert.ok(run.score > scoreAfterFirst);
  assert.equal(multiplier(run), 1.3);
});

test('硬币提示：能凑出与应找零相等的组合', () => {
  const run = createRun({ seed: 18 });
  run.upgrades.push('coin-hint');
  const suggest = suggestChange(run);
  assert.ok(Array.isArray(suggest));
  const sum = suggest.reduce((a, b) => a + b, 0);
  assert.equal(sum, run.customer.change);
  assert.ok(suggest.every((d) => DENOMINATIONS.includes(d)));
});

test('评级：S/A/B/C 阈值', () => {
  assert.equal(getRank(4000), 'S');
  assert.equal(getRank(3200), 'A');
  assert.equal(getRank(2500), 'B');
  assert.equal(getRank(100), 'C');
});

test('商品不重复：同一顾客 6 件以内不出现重复商品', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const run = createRun({ seed });
    run.dayIndex = 2;
    newCustomer(run);
    const names = run.customer.items.map((x) => x.name.en);
    assert.equal(new Set(names).size, names.length);
  }
});

test('配置：3 天、每天 5 位、8 个升级、至少 3 个规则升级', async () => {
  const { DAYS: D } = await import('../config/game.config.js');
  const { UPGRADES } = await import('../config/upgrades.js');
  assert.equal(D.length, 3);
  assert.equal(RULES.dayCustomers, 5);
  assert.equal(UPGRADES.length, 8);
  assert.ok(UPGRADES.filter((u) => u.kind === 'rule').length >= 3);
});

test('班次统计：完美单 / 最高连击 / 小费累计', () => {
  const run = createRun({ seed: 21 });
  serve(run);
  assert.equal(run.stats.perfect, 1);
  assert.equal(run.stats.bestCombo, 1);
  assert.ok(run.stats.tips > 0);
  serve(run);
  assert.equal(run.stats.bestCombo, 2);
  assert.ok(run.stats.tips >= 2);
});

test('交互引导：2 件商品 / $5 找零 / 交付后进入 tutorialDone', () => {
  const run = createTutorialRun();
  assert.equal(run.tutorial, true);
  assert.equal(run.customer.items.length, 2);
  assert.equal(run.customer.total, 500);
  assert.equal(run.customer.change, 500);
  assert.ok(run.customer.patienceMax >= 120);
  scanAll(run);
  addMoney(run, 500);
  const res = giveChange(run);
  assert.equal(res.correct, true);
  assert.equal(run.phase, 'tutorialDone');
  assert.equal(run.served, 1);
});
