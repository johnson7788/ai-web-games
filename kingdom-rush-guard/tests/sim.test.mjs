import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';
import { TOWER_DEFS } from '../config/levels.js';

test('初始状态：phase=playing、金币、基地血量、关卡', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.gold, GAME.START_GOLD);
  assert.equal(run.state.baseHp, GAME.BASE_HP);
  assert.equal(run.state.level, 1);
});

test('建造：空地建塔成功并扣金币', () => {
  const run = createRun(0, { seed: 1 });
  const r = run.buildTower(0, 'laser');
  assert.equal(r.ok, true);
  assert.equal(run.state.gold, GAME.START_GOLD - TOWER_DEFS.laser.cost);
  assert.equal(run.state.towers.length, 1);
});

test('建造：同一建造点不能重复建造', () => {
  const run = createRun(0, { seed: 1 });
  run.buildTower(0, 'laser');
  const r = run.buildTower(0, 'tesla');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'occupied');
});

test('建造：岩石封锁点不能建造', () => {
  const run = createRun(1, { seed: 1 }); // 第 2 关有封锁点
  const blocked = run.buildSpots().find((s) => s.blocked);
  assert.ok(blocked, '第 2 关应有封锁点');
  const r = run.buildTower(blocked.id, 'laser');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'blocked');
});

test('建造：金币不足不能建造', () => {
  const run = createRun(0, { seed: 1 });
  run.state.gold = 0;
  const r = run.buildTower(0, 'laser');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'gold');
});

test('升级：塔升级成功并扣金币', () => {
  const run = createRun(0, { seed: 1 });
  run.buildTower(0, 'laser');
  const goldBefore = run.state.gold;
  const r = run.upgradeTower(0);
  assert.equal(r.ok, true);
  assert.equal(run.state.towers[0].level, 2);
  assert.ok(run.state.gold < goldBefore);
});

test('升级：满级不能再升级', () => {
  const run = createRun(0, { seed: 1 });
  run.buildTower(0, 'laser');
  run.state.towers[0].level = 4;
  const r = run.upgradeTower(0);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'max');
});

test('出售：塔被移除并返还金币', () => {
  const run = createRun(0, { seed: 1 });
  run.buildTower(0, 'laser');
  const goldBefore = run.state.gold;
  const r = run.sellTower(0);
  assert.equal(r.ok, true);
  assert.equal(run.state.towers.length, 0);
  assert.ok(run.state.gold > goldBefore);
});

test('敌人：随时间推进会从出生点生成', () => {
  const run = createRun(0, { seed: 1 });
  for (let i = 0; i < 10; i += 1) run.step(0.5);
  assert.ok(run.state.enemies.length > 0, '应生成敌人');
});

test('敌人：会沿路径向基地方向移动', () => {
  const run = createRun(0, { seed: 1 });
  for (let i = 0; i < 8; i += 1) run.step(0.5);
  const e = run.state.enemies[0];
  assert.ok(e, '应有敌人');
  const x0 = e.x;
  run.step(0.5);
  assert.ok(e.x < x0, '敌人应向左（基地）移动');
});

test('漏怪：无输入最终会失守（lose）', () => {
  const run = createRun(0, { seed: 1 });
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 240) { run.step(0.5); guard += 1; }
  assert.equal(run.state.phase, 'lost');
  assert.ok(run.state.baseHp < GAME.BASE_HP);
});

test('击杀：激光塔能击杀敌人并触发连击', () => {
  const run = createRun(0, { seed: 1 });
  run.buildTower(0, 'laser');
  let guard = 0;
  while (run.state.killCount === 0 && guard < 120) { run.step(0.5); guard += 1; }
  assert.ok(run.state.killCount >= 1, '应至少击杀一个敌人');
  assert.ok(run.state.combo >= 1, '击杀应产生连击');
});

test('轨道炮：集满充能可清屏并消耗充能', () => {
  const run = createRun(0, { seed: 1 });
  run.state.orbitalCharges = GAME.ORBITAL_CHARGES_NEEDED;
  const r = run.useOrbital();
  assert.equal(r.ok, true);
  assert.equal(run.state.orbitalCharges, 0);
});

test('核心：拾取核心加金币并充能', () => {
  const run = createRun(0, { seed: 1 });
  run.state.cores.push({ id: 1, spotIdx: 3, x: 400, y: 200 });
  const goldBefore = run.state.gold;
  const r = run.collectCore();
  assert.equal(r.ok, true);
  assert.ok(run.state.gold > goldBefore);
  assert.equal(run.state.orbitalCharges, 1);
});

test('通关：全部波次结束且无敌人 → won 并结算星级', () => {
  const run = createRun(0, { seed: 1 });
  run.state.wavesSpawned = true;
  run.state.enemies = [];
  run.state.baseHp = GAME.STAR_HP_3;
  run.step(0.1);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1);
});

test('星级：剩余血量越高星级越高', () => {
  const a = createRun(0, { seed: 1 });
  a.state.wavesSpawned = true;
  a.state.enemies = [];
  a.state.baseHp = GAME.STAR_HP_3;
  a.step(0.1);

  const b = createRun(0, { seed: 1 });
  b.state.wavesSpawned = true;
  b.state.enemies = [];
  b.state.baseHp = GAME.STAR_HP_2;
  b.step(0.1);

  assert.ok(a.state.stars >= b.state.stars, '高血量星级不低于低血量');
});
