import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { levelConfig } from '../src/game/level.js';
import { WORLD, TUNE } from '../config/game.config.js';

const DT = 1 / 60;

function pushEnemy(run, opts = {}) {
  const s = run.state;
  const e = {
    id: 1000 + s.enemies.length,
    x: opts.x ?? WORLD.W / 2,
    y: opts.y ?? 300,
    hp: opts.hp ?? TUNE.MAIN_DAMAGE,
    maxHp: opts.hp ?? TUNE.MAIN_DAMAGE,
    speed: opts.speed ?? 0,
    size: opts.size ?? 20,
    type: opts.type ?? 'drone',
    dead: false,
  };
  s.enemies.push(e);
  return e;
}

test('初始状态：playing + 第 1 波', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.level, 1);
  assert.equal(run.state.leaks, 0);
  assert.equal(run.state.energy, 0);
});

test('主炮开火产生子弹并进入冷却', () => {
  const run = createRun(0, { seed: 1 });
  const before = run.state.bullets.length;
  const res = run.fire();
  assert.equal(res.ok, true);
  assert.equal(run.state.bullets.length, before + 1);
  assert.ok(run.state.fireCooldown > 0);
  // 冷却期内再开火失败
  assert.equal(run.fire().ok, false);
});

test('子弹命中敌人扣血并击杀', () => {
  const run = createRun(0, { seed: 1 });
  run.state.enemies = [];
  run.state.spawnedCount = 0;
  run.state.totalToSpawn = 1;
  const e = pushEnemy(run, { hp: TUNE.MAIN_DAMAGE, speed: 0 });
  run.fire();
  for (let i = 0; i < 60 && run.state.kills === 0; i += 1) run.step(DT);
  assert.equal(run.state.kills, 1);
  assert.equal(e.dead, true);
  assert.ok(run.state.energy > 0, '击杀充能');
});

test('能量未满不能放大招', () => {
  const run = createRun(0, { seed: 1 });
  run.state.energy = TUNE.MAX_ENERGY - 1;
  assert.equal(run.blast().ok, false);
  run.state.energy = TUNE.MAX_ENERGY;
  assert.equal(run.blast().ok, true);
  assert.equal(run.state.energy, 0);
});

test('大招清空全场敌人', () => {
  const run = createRun(0, { seed: 1 });
  run.state.enemies = [];
  run.state.totalToSpawn = 5;
  for (let i = 0; i < 5; i += 1) pushEnemy(run, { x: 100 + i * 80, y: 100 + i * 40 });
  run.state.energy = TUNE.MAX_ENERGY;
  const res = run.blast();
  assert.equal(res.ok, true);
  assert.equal(res.cleared, 5);
  assert.equal(run.state.enemies.length, 0);
});

test('敌人漏到基座计数，超过上限判负', () => {
  const run = createRun(0, { seed: 1 });
  run.state.enemies = [];
  run.state.spawnedCount = 99;
  run.state.totalToSpawn = 99;
  const limit = run.cfg.leakLimit;
  assert.equal(limit, 5, '普通波漏限 5');
  for (let i = 0; i < limit; i += 1) pushEnemy(run, { y: WORLD.BASE_Y - 2, speed: 40 });
  run.step(DT);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.reason, 'breach');
});

test('清空全部敌人且全部已生成 → 获胜', () => {
  const run = createRun(0, { seed: 1 });
  run.state.enemies = [];
  run.state.spawnedCount = 0;
  run.state.totalToSpawn = 0;
  run.step(DT);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1 && run.state.stars <= 3);
});

test('第 5 波是 boss 波且漏限为 1', () => {
  const boss = levelConfig(4);
  assert.equal(boss.boss, true);
  assert.equal(boss.leakLimit, 1);
  const normal = levelConfig(0);
  assert.equal(normal.boss, false);
  assert.equal(normal.leakLimit, 5);
});

test('第 2 / 3 波解锁副炮', () => {
  const l1 = createRun(0, { seed: 1 });
  assert.equal(l1.state.turrets[1].unlocked, false);
  assert.equal(l1.state.turrets[2].unlocked, false);
  const l2 = createRun(1, { seed: 1 });
  assert.equal(l2.state.turrets[1].unlocked, true);
  assert.equal(l2.state.turrets[2].unlocked, false);
  const l3 = createRun(2, { seed: 1 });
  assert.equal(l3.state.turrets[1].unlocked, true);
  assert.equal(l3.state.turrets[2].unlocked, true);
});

test('护盾吸收一次漏敌', () => {
  const run = createRun(0, { seed: 1 });
  run.state.enemies = [];
  run.state.spawnedCount = 99;
  run.state.totalToSpawn = 100;
  run.state.shield = 1;
  pushEnemy(run, { y: WORLD.BASE_Y - 2, speed: 40 });
  run.step(DT);
  assert.equal(run.state.leaks, 0);
  assert.equal(run.state.shield, 0);
  assert.equal(run.state.phase, 'playing');
});

test('道具掉落并落到基座自动拾取', () => {
  const run = createRun(0, { seed: 1 });
  run.state.enemies = [];
  run.state.spawnedCount = 0;
  run.state.totalToSpawn = 0;
  run.state.powerups.push({ id: 500, x: WORLD.W / 2, y: WORLD.BASE_Y - 21, type: 'shield', dead: false });
  run.step(DT);
  assert.equal(run.state.powerups.length, 0);
  assert.equal(run.state.shield, 1);
});

test('击杀累计连击，漏敌清空连击', () => {
  const run = createRun(0, { seed: 1 });
  run.state.enemies = [];
  run.state.spawnedCount = 0;
  run.state.totalToSpawn = 1;
  pushEnemy(run, { hp: TUNE.MAIN_DAMAGE, speed: 0 });
  run.fire();
  for (let i = 0; i < 60 && run.state.kills === 0; i += 1) run.step(DT);
  assert.equal(run.state.kills, 1);
  assert.equal(run.state.combo, 1);
  assert.equal(run.state.bestCombo, 1);
  // 漏一个敌人 → combo 清零
  run.state.spawnedCount = 99;
  run.state.totalToSpawn = 99;
  pushEnemy(run, { y: WORLD.BASE_Y - 2, speed: 40 });
  run.step(DT);
  assert.equal(run.state.combo, 0);
});

test('mulberry32 同种子同序列', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 5; i += 1) assert.equal(a(), b());
});
