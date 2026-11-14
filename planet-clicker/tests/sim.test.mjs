import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, click, tick, buy, upgradeCost, clickPower, eps, planetMult,
  currentPlanet, getHud, serialize, PLANET_COUNT,
} from '../src/game/sim.js';
import { PLANETS, UPGRADES, CONFIG } from '../config/game.config.js';

test('初始化：0 能量、地球、升级 0 级', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.energy, 0);
  assert.equal(run.planetIndex, 0);
  assert.equal(currentPlanet(run).id, 'earth');
  assert.equal(clickPower(run), 1);
});

test('点击：产生点击力能量', () => {
  const run = createRun({ seed: 1 });
  const r = click(run);
  assert.equal(r.gained, 1);
  assert.equal(run.energy, 1);
  assert.equal(run.totalEnergy, 1);
});

test('点击力随等级与星球倍率增长', () => {
  const run = createRun({ seed: 1 });
  run.levels.click = 4; // 基础 5
  assert.equal(clickPower(run), 5);
  run.planetIndex = 1; // 火星 ×2
  assert.equal(clickPower(run), 10);
});

test('自动产出：太阳能板提供 eps', () => {
  const run = createRun({ seed: 1 });
  run.levels.solar = 3;
  assert.equal(eps(run), 3);
  run.levels.drone = 2; // +10
  assert.equal(eps(run), 13);
});

test('tick：按 eps 累积能量', () => {
  const run = createRun({ seed: 1 });
  run.levels.solar = 2; // eps 2
  tick(run, 5);
  assert.ok(Math.abs(run.energy - 10) < 1e-9);
});

test('购买：扣能量、升级、成本递增；不够失败', () => {
  const run = createRun({ seed: 1 });
  run.energy = 1000;
  const c0 = upgradeCost(run, 'click');
  assert.equal(buy(run, 'click'), true);
  assert.equal(run.levels.click, 1);
  assert.equal(run.energy, 1000 - c0);
  assert.ok(upgradeCost(run, 'click') > c0);
  run.energy = 0;
  assert.equal(buy(run, 'click'), false);
});

test('星球解锁：累计能量达阈值 → 火星 ×2', () => {
  const run = createRun({ seed: 1 });
  run.totalEnergy = 999;
  run.energy = 999;
  click(run); // +1 → 1000
  assert.equal(run.planetIndex, 1);
  assert.equal(planetMult(run), 2);
  assert.equal(currentPlanet(run).id, 'mars');
});

test('星球倍率影响自动产出', () => {
  const run = createRun({ seed: 1 });
  run.levels.solar = 1;
  run.planetIndex = 2; // 木星 ×5
  assert.equal(eps(run), 5);
});

test('存档往返：serialize → createRun(saved)', () => {
  const run = createRun({ seed: 1 });
  run.energy = 5000;
  run.totalEnergy = 20000;
  run.levels = { click: 3, solar: 2, drone: 1, fusion: 0 };
  run.planetIndex = 2;
  const restored = createRun({ seed: 1, saved: serialize(run) });
  assert.equal(restored.energy, 5000);
  assert.equal(restored.planetIndex, 2);
  assert.deepEqual(restored.levels, { click: 3, solar: 2, drone: 1, fusion: 0 });
});

test('配置默认值：6 星球 / en+zh', () => {
  assert.equal(PLANET_COUNT, 6);
  assert.equal(PLANET_COUNT, PLANETS.length);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun({ seed: 1 })).planetMult, 1);
});