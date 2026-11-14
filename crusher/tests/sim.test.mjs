import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, click, tick, buy, upgradeCost, clickPower, dps, critChance,
  tierIndex, objectMaxHp, getHud, serialize, TIER_COUNT,
} from '../src/game/sim.js';
import { TIERS, UPGRADES, RULES, CONFIG } from '../config/game.config.js';

test('初始化：0 金币、岩石满血、升级 0 级', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.coins, 0);
  assert.equal(run.crushed, 0);
  assert.equal(run.maxHp, TIERS[0].hp);
  assert.equal(run.hp, run.maxHp);
  assert.equal(clickPower(run), 1);
  assert.equal(dps(run), 0);
});

test('点击：造成点击力伤害并扣血', () => {
  const run = createRun({ seed: 1 });
  const r = click(run);
  assert.equal(r.damage, 1);
  assert.equal(run.hp, run.maxHp - 1);
});

test('粉碎：打空血 → 得金币、计数+1、重生满血', () => {
  const run = createRun({ seed: 1 });
  const hp = run.maxHp; // 固定初始血量，避免循环中 maxHp 增长
  for (let i = 0; i < hp; i += 1) click(run);
  assert.equal(run.crushed, 1, '粉碎 1 个');
  assert.equal(run.coins, TIERS[0].value, '获得岩石价值');
  assert.equal(run.hp, run.maxHp, '重生满血');
});

test('暴击：rng 恒 0 且暴击率>0 → 伤害×3', () => {
  const run = createRun({ seed: 1 });
  run.levels.crit = 1;
  run.rng = () => 0; // 必暴击
  const r = click(run);
  assert.equal(r.crit, true);
  assert.equal(r.damage, clickPower(run) * RULES.critMult);
});

test('放置：自动粉碎随时间扣血并可粉碎', () => {
  const run = createRun({ seed: 1 });
  run.levels.auto = 1; // dps=2
  assert.equal(dps(run), 2);
  tick(run, 1); // 2 伤害
  assert.equal(run.hp, run.maxHp - 2);
  for (let i = 0; i < 20; i += 1) tick(run, 1);
  assert.ok(run.crushed >= 1, '挂机也能粉碎');
});

test('购买：扣金币、升等级、成本递增；不够则失败', () => {
  const run = createRun({ seed: 1 });
  run.coins = 1000;
  const c0 = upgradeCost(run, 'click');
  assert.equal(buy(run, 'click'), true);
  assert.equal(run.levels.click, 1);
  assert.equal(run.coins, 1000 - c0);
  assert.ok(upgradeCost(run, 'click') > c0, '成本递增');
  run.coins = 0;
  assert.equal(buy(run, 'click'), false, '金币不足失败');
});

test('升阶：粉碎满 10 个进入下一材料', () => {
  const run = createRun({ seed: 1 });
  run.crushed = RULES.objectsPerTier - 1;
  run.maxHp = objectMaxHp(run);
  run.hp = 1;
  click(run); // 粉碎第 10 个
  assert.equal(run.crushed, RULES.objectsPerTier);
  assert.equal(tierIndex(run), 1, '进入铜矿');
});

test('成本公式：floor(base × growth^level)', () => {
  const run = createRun({ seed: 1 });
  const up = UPGRADES[0];
  run.levels.click = 3;
  assert.equal(upgradeCost(run, 'click'), Math.floor(up.base * Math.pow(up.growth, 3)));
});

test('存档往返：serialize → createRun(saved) 恢复', () => {
  const run = createRun({ seed: 1 });
  run.coins = 500;
  run.crushed = 12;
  run.levels = { click: 3, auto: 2, crit: 1 };
  const restored = createRun({ seed: 1, saved: serialize(run) });
  assert.equal(restored.coins, 500);
  assert.equal(restored.crushed, 12);
  assert.deepEqual(restored.levels, { click: 3, auto: 2, crit: 1 });
});

test('配置默认值：8 材料 / en+zh / 暴击上限', () => {
  assert.equal(TIER_COUNT, 8);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  const run = createRun({ seed: 1 });
  run.levels.crit = 100;
  assert.equal(critChance(run), RULES.critCap, '暴击率封顶');
  assert.equal(getHud(run).coins, 0);
});