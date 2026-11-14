import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, click, tick, buy, upgradeCost, throughput, bottleneck,
  valuePerLeek, cps, stationRate, getHud, serialize,
} from '../src/game/sim.js';
import { STATIONS, UPGRADES, RULES, CONFIG } from '../config/game.config.js';

test('初始化：0 金币、初始等级、吞吐=最慢站 0.6', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.coins, 0);
  assert.deepEqual(run.levels, RULES.startLevels);
  assert.equal(throughput(run), 0.6, 'pack 0.6 是瓶颈');
  assert.equal(bottleneck(run), 'pack');
});

test('吞吐取各站最小值（瓶颈）', () => {
  const run = createRun({ seed: 1 });
  run.levels.grow = 5; // 5.0
  run.levels.process = 2; // 1.6
  run.levels.pack = 3; // 1.8
  assert.equal(throughput(run), 1.6, 'process 1.6 最慢');
  assert.equal(bottleneck(run), 'process');
});

test('手动收割：+clickBase×单价 金币', () => {
  const run = createRun({ seed: 1 });
  const r = click(run);
  assert.equal(r.gained, RULES.clickBase * valuePerLeek(run));
  assert.equal(run.coins, 5);
  assert.equal(run.totalSold, RULES.clickBase);
});

test('放置：tick 按 cps 累积金币', () => {
  const run = createRun({ seed: 1 });
  assert.equal(cps(run), 0.6);
  tick(run, 10); // 0.6×10 = 6 金币
  assert.ok(Math.abs(run.coins - 6) < 1e-9, '10 秒产 6 金币');
});

test('购买：扣金币、升级、成本递增；不够失败', () => {
  const run = createRun({ seed: 1 });
  run.coins = 1000;
  const c0 = upgradeCost(run, 'grow');
  assert.equal(buy(run, 'grow'), true);
  assert.equal(run.levels.grow, 2);
  assert.equal(run.coins, 1000 - c0);
  assert.ok(upgradeCost(run, 'grow') > c0);
  run.coins = 0;
  assert.equal(buy(run, 'grow'), false);
});

test('升级瓶颈提升吞吐并转移瓶颈', () => {
  const run = createRun({ seed: 1 });
  run.coins = 100;
  assert.equal(bottleneck(run), 'pack');
  buy(run, 'pack'); // pack 速率 0.6→1.2
  assert.equal(throughput(run), 0.8, '瓶颈转为 process 0.8');
  assert.equal(bottleneck(run), 'process');
});

test('品牌升级提高单价与 cps', () => {
  const run = createRun({ seed: 1 });
  run.coins = 1000;
  const before = cps(run);
  buy(run, 'value');
  assert.equal(valuePerLeek(run), 2);
  assert.equal(cps(run), before * 2, '单价翻倍 → cps 翻倍');
});

test('成本公式：floor(base × growth^level)', () => {
  const run = createRun({ seed: 1 });
  const up = UPGRADES[0];
  run.levels.grow = 4;
  assert.equal(upgradeCost(run, 'grow'), Math.floor(up.base * Math.pow(up.growth, 4)));
});

test('存档往返：serialize → createRun(saved)', () => {
  const run = createRun({ seed: 1 });
  run.coins = 888;
  run.totalSold = 100;
  run.levels = { grow: 3, process: 2, pack: 2, value: 4 };
  const restored = createRun({ seed: 1, saved: serialize(run) });
  assert.equal(restored.coins, 888);
  assert.deepEqual(restored.levels, { grow: 3, process: 2, pack: 2, value: 4 });
});

test('配置默认值：3 站 / en+zh / 单价基数', () => {
  assert.equal(STATIONS.length, 3);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(RULES.valueBase, 1);
  assert.equal(getHud(createRun({ seed: 1 })).bottleneck, 'pack');
});