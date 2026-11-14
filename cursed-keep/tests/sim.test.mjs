import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, tick, placeTower, upgradeTower, sellTower, sendWave, towerStats,
  upgradeCost, towerAtSpot, getHud, WAVE_COUNT, SPOT_COUNT,
} from '../src/game/sim.js';
import { RULES, TOWERS, CONFIG } from '../config/game.config.js';

function simulate(run, seconds) {
  const steps = Math.ceil(seconds * 60);
  for (let i = 0; i < steps; i += 1) tick(run, 1 / 60);
}

test('初始化：120 金币 / 20 生命 / 无塔无敌人', () => {
  const run = createRun();
  assert.equal(run.gold, RULES.startGold);
  assert.equal(run.lives, RULES.startLives);
  assert.equal(run.towers.length, 0);
  assert.equal(run.enemies.length, 0);
  assert.equal(run.phase, 'playing');
});

test('建塔：扣金币、占塔位；重复/缺钱失败', () => {
  const run = createRun();
  const r = placeTower(run, 0, 'arrow');
  assert.equal(r.ok, true);
  assert.equal(run.gold, RULES.startGold - TOWERS[0].cost);
  assert.ok(towerAtSpot(run, 0));
  assert.equal(placeTower(run, 0, 'arrow').ok, false, '塔位已占');
  run.gold = 0;
  assert.equal(placeTower(run, 1, 'cannon').reason, 'gold', '缺钱');
});

test('塔属性随等级提升', () => {
  const run = createRun();
  const { tower } = placeTower(run, 0, 'arrow');
  const d1 = towerStats(tower).damage;
  upgradeTower(run, tower.id);
  const d2 = towerStats(tower).damage;
  assert.ok(d2 > d1, '升级后伤害更高');
  assert.equal(tower.level, 2);
});

test('升级封顶与出售回收', () => {
  const run = createRun();
  run.gold = 10000;
  const { tower } = placeTower(run, 0, 'arrow');
  upgradeTower(run, tower.id);
  upgradeTower(run, tower.id);
  assert.equal(tower.level, RULES.maxTowerLevel);
  assert.equal(upgradeTower(run, tower.id).reason, 'max', '满级不能再升');
  const before = run.gold;
  assert.equal(sellTower(run, tower.id).ok, true);
  assert.ok(run.gold > before, '出售回收金币');
  assert.equal(towerAtSpot(run, 0), null);
});

test('波次：间歇后自动生成敌人', () => {
  const run = createRun();
  assert.equal(run.enemies.length, 0);
  simulate(run, RULES.waveDelay + 1.5);
  assert.ok(run.enemies.length > 0 || run.kills > 0 || run.inWave, '第一波已开始');
});

test('sendWave 立即开波', () => {
  const run = createRun();
  sendWave(run);
  tick(run, 1 / 60);
  assert.equal(run.inWave, true);
});

test('塔能击杀敌人并赚金币', () => {
  const run = createRun();
  run.gold = 1000;
  placeTower(run, 0, 'arrow'); // (160,80) 覆盖路径 y160
  placeTower(run, 2, 'arrow');
  sendWave(run);
  simulate(run, 20);
  assert.ok(run.kills >= 1, '应有击杀');
  assert.ok(run.gold > 1000 - 100, '击杀赚金币');
});

test('无塔时敌人抵达终点扣生命', () => {
  const run = createRun();
  sendWave(run);
  simulate(run, 60);
  assert.ok(run.lives < RULES.startLives, '有敌人漏过扣血');
});

test('生命耗尽 → lost', () => {
  const run = createRun();
  simulate(run, 400); // 不建塔，长期漏怪
  assert.equal(run.phase, 'lost');
  assert.equal(run.lives, 0);
});

test('清完一波进入下一波', () => {
  const run = createRun();
  run.gold = 10000;
  for (let i = 0; i < SPOT_COUNT; i += 1) placeTower(run, i, 'cannon');
  sendWave(run);
  simulate(run, 40);
  assert.ok(run.waveIndex >= 1, '至少清完第一波');
});

test('配置默认值：10 波 / en+zh / 3 塔种', () => {
  assert.equal(WAVE_COUNT, 10);
  assert.equal(TOWERS.length, 3);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun()).lives, 20);
});