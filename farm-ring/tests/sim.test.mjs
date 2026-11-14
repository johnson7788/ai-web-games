import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, tick, harvest, buy, upgradeCost, upgradeMaxed, growRate, cropValue, unlockedCount, getHud, serialize, PLOT_COUNT,
} from '../src/game/sim.js';
import { RING, RULES, CONFIG } from '../config/game.config.js';

test('初始化：4 块解锁、共 12 块、0 金币', () => {
  const run = createRun({ seed: 1 });
  assert.equal(unlockedCount(run), RULES.startPlots);
  assert.equal(run.plots.length, RING.PLOTS);
  assert.equal(run.coins, 0);
});

test('tick 使作物生长', () => {
  const run = createRun({ seed: 1 });
  tick(run, 1);
  assert.ok(run.plots[0].growth > 0);
  assert.ok(run.plots[0].growth < 1);
});

test('收割成熟作物得金币', () => {
  const run = createRun({ seed: 1 });
  run.plots[0].growth = 1;
  const r = harvest(run, 0);
  assert.equal(r.ok, true);
  assert.equal(run.coins, cropValue(run));
  assert.equal(run.plots[0].growth, 0);
  assert.equal(run.totalHarvested, 1);
});

test('未成熟/未解锁不可收割', () => {
  const run = createRun({ seed: 1 });
  assert.equal(harvest(run, 0).ok, false, '未成熟');
  assert.equal(harvest(run, 10).ok, false, '未解锁');
});

test('自动收割：auto 升级后成熟自动收', () => {
  const run = createRun({ seed: 1 });
  run.levels.auto = 1;
  run.plots[0].growth = 1;
  tick(run, 0.1);
  assert.equal(run.plots[0].growth, 0);
  assert.ok(run.coins > 0);
});

test('购买生长/价值升级', () => {
  const run = createRun({ seed: 1 });
  run.coins = 1000;
  const rate0 = growRate(run);
  assert.equal(buy(run, 'growth'), true);
  assert.ok(growRate(run) > rate0, '生长更快');
  const val0 = cropValue(run);
  assert.equal(buy(run, 'value'), true);
  assert.ok(cropValue(run) > val0, '价值更高');
});

test('购买地块解锁新地', () => {
  const run = createRun({ seed: 1 });
  run.coins = 1000;
  const before = unlockedCount(run);
  assert.equal(buy(run, 'plot'), true);
  assert.equal(unlockedCount(run), before + 1);
});

test('地块解锁上限 12', () => {
  const run = createRun({ seed: 1 });
  run.coins = 1e9;
  for (let i = 0; i < 20; i += 1) buy(run, 'plot');
  assert.equal(unlockedCount(run), RING.PLOTS);
  assert.equal(upgradeMaxed(run, 'plot'), true);
  assert.equal(buy(run, 'plot'), false);
});

test('金币不足购买失败', () => {
  const run = createRun({ seed: 1 });
  run.coins = 0;
  assert.equal(buy(run, 'growth'), false);
});

test('存档往返', () => {
  const run = createRun({ seed: 1 });
  run.coins = 500;
  run.levels = { growth: 2, value: 1, auto: 1, plot: 3 };
  const restored = createRun({ seed: 1, saved: serialize(run) });
  assert.equal(restored.coins, 500);
  assert.equal(unlockedCount(restored), RULES.startPlots + 3);
  assert.deepEqual(restored.levels, { growth: 2, value: 1, auto: 1, plot: 3 });
});

test('配置默认值：12 地块 / en+zh', () => {
  assert.equal(PLOT_COUNT, 12);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun({ seed: 1 })).totalPlots, 12);
});