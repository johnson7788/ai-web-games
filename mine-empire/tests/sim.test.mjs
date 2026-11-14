import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, click, tick, buy, upgradeCost, clickPower, digRate, incomeMult,
  layerAt, getHud, serialize, LAYER_COUNT,
} from '../src/game/sim.js';
import { LAYERS, UPGRADES, RULES, CONFIG } from '../config/game.config.js';

test('初始化：0 资金、0 深度、升级 0 级', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.money, 0);
  assert.equal(run.depth, 0);
  assert.equal(clickPower(run), 1);
  assert.equal(digRate(run), 0);
});

test('点击：挖 1 米、泥土层赚 1', () => {
  const run = createRun({ seed: 1 });
  const r = click(run);
  assert.equal(r.meters, 1);
  assert.equal(run.depth, 1);
  assert.ok(Math.abs(run.money - 1) < 1e-9);
});

test('矿层判定：按深度返回对应层', () => {
  assert.equal(layerAt(0).id, 'dirt');
  assert.equal(layerAt(60).id, 'coal');
  assert.equal(layerAt(250).id, 'iron');
  assert.equal(layerAt(600).id, 'gold');
  assert.equal(layerAt(1500).id, 'diamond');
});

test('钻机：提供自动挖掘速率', () => {
  const run = createRun({ seed: 1 });
  run.levels.drill = 3;
  assert.equal(digRate(run), 3 * RULES.drillPerLevel);
});

test('tick：挂机挖掘赚钱', () => {
  const run = createRun({ seed: 1 });
  run.levels.drill = 1; // 2 m/s
  tick(run, 5); // 10 米（泥土）
  assert.ok(Math.abs(run.depth - 10) < 1e-9);
  assert.ok(Math.abs(run.money - 10) < 1e-9);
});

test('购买：扣资金、升级；不够失败', () => {
  const run = createRun({ seed: 1 });
  run.money = 1000;
  const c0 = upgradeCost(run, 'pick');
  assert.equal(buy(run, 'pick'), true);
  assert.equal(run.levels.pick, 1);
  assert.equal(run.money, 1000 - c0);
  run.money = 0;
  assert.equal(buy(run, 'pick'), false);
});

test('精炼厂：提升收益倍率', () => {
  const run = createRun({ seed: 1 });
  run.levels.refinery = 2;
  assert.equal(incomeMult(run), 1 + 2 * RULES.refineryPerLevel);
});

test('跨层触发 layer 事件', () => {
  const run = createRun({ seed: 1 });
  run.depth = 49;
  run.levels.pick = 5; // 一次挖 6 米 → 跨过 50
  click(run);
  const ev = run.events.filter((e) => e.type === 'layer');
  assert.ok(ev.length >= 1, '进入煤矿层');
  assert.equal(layerAt(run.depth).id, 'coal');
});

test('深层更值钱：金矿点击收益高于泥土', () => {
  const dirt = createRun({ seed: 1 });
  const gold = createRun({ seed: 1 });
  gold.depth = 600;
  const d = click(dirt).earned;
  const g = click(gold).earned;
  assert.ok(g > d, '金矿收益更高');
});

test('存档往返：serialize → createRun(saved)', () => {
  const run = createRun({ seed: 1 });
  run.money = 800;
  run.depth = 300;
  run.levels = { pick: 3, drill: 2, refinery: 1 };
  const restored = createRun({ seed: 1, saved: serialize(run) });
  assert.equal(restored.money, 800);
  assert.equal(restored.depth, 300);
  assert.deepEqual(restored.levels, { pick: 3, drill: 2, refinery: 1 });
});

test('配置默认值：5 矿层 / en+zh', () => {
  assert.equal(LAYER_COUNT, 5);
  assert.equal(LAYER_COUNT, LAYERS.length);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun({ seed: 1 })).layer, 'dirt');
});