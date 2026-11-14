import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, tick, getHud, placeTile, makeRng } from '../src/game/sim.js';
import { COLS, ROWS, BUILDINGS, RULES } from '../config/game.config.js';

const step = (run, n) => { for (let i = 0; i < n; i++) tick(run, 1 / 60); };

test('创建：网格正确，初始资金 500，人口 0', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.grid.length, ROWS);
  assert.equal(run.grid[0].length, COLS);
  assert.equal(run.money, RULES.startMoney);
  assert.equal(run.pop, 0);
  assert.equal(run.phase, 'play');
});

test('建造房屋：扣钱并增加人口', () => {
  const run = createRun({ seed: 1 });
  const res = placeTile(run, 2, 2, 2);
  assert.ok(res.ok);
  assert.equal(run.money, RULES.startMoney - BUILDINGS[2].cost);
  assert.equal(run.pop, 2);
  assert.equal(run.built, 1);
});

test('建造商店：产生每秒收入', () => {
  const run = createRun({ seed: 1 });
  placeTile(run, 3, 3, 3);
  assert.ok(run.income >= BUILDINGS[3].income);
});

test('占用：不能在已有方块上建造', () => {
  const run = createRun({ seed: 1 });
  placeTile(run, 2, 2, 2);
  const res = placeTile(run, 2, 2, 3);
  assert.equal(res.ok, false);
  assert.equal(run.grid[2][2], 2);
});

test('资金不足：无法建造', () => {
  const run = createRun({ seed: 1 });
  run.money = 10;
  const res = placeTile(run, 2, 2, 3); // shop 80
  assert.equal(res.ok, false);
  assert.equal(run.grid[2][2], 0);
});

test('铲除：移除建筑并重算人口', () => {
  const run = createRun({ seed: 1 });
  placeTile(run, 2, 2, 2);
  assert.equal(run.pop, 2);
  const res = placeTile(run, 2, 2, -1);
  assert.ok(res.ok);
  assert.equal(run.grid[2][2], 0);
  assert.equal(run.pop, 0);
});

test('经济：每秒结算收入', () => {
  const run = createRun({ seed: 1 });
  placeTile(run, 3, 3, 3); // income 3
  const m0 = run.money;
  step(run, 62);
  assert.ok(run.money >= m0 + 3);
});

test('车辆：有道路时生成车辆', () => {
  const run = createRun({ seed: 1 });
  for (let c = 0; c < 10; c++) placeTile(run, c, 5, 1);
  step(run, 60 * 4);
  assert.ok(run.cars.length >= 1);
});

test('选择：切换工具', () => {
  const run = createRun({ seed: 1 });
  run.selected = 3;
  assert.equal(getHud(run).selected, 3);
});

test('RNG：同种子可复现', () => {
  const a = makeRng(23), b = makeRng(23);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});