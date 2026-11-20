import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { PLAYER, SYNC } from '../config/gameplay.js';
import { WAVE_COUNT } from '../config/levels.js';

function stepN(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
}

function types(events) {
  return events.map((e) => e.type);
}

function addEnemy(run, type, x, y, hp = 1) {
  run.enemies.push({
    id: run.nextId++,
    type, x, y, r: 14, hp, maxHp: hp,
    speed: 0, touchDmg: 15, color: '#f00', score: 1,
    dashCd: 99, dashT: 0, dashDirx: 0, dashDiry: 0, fireCd: 99, spawnT: 0,
  });
}

test('createRun 初始状态符合契约', () => {
  const run = createRun({ seed: 1 });
  run.drainEvents();
  assert.equal(run.phase, 'playing');
  assert.equal(run.wave, 1);
  assert.equal(run.player.hp, PLAYER.HP);
  assert.equal(run.player.armor, PLAYER.MAX_ARMOR);
  assert.equal(run.core.online, true);
  assert.equal(run.stats.kills, 0);
  assert.equal(run.stats.waveReached, 1);
});

test('getHud 契约字段齐全', () => {
  const run = createRun({ seed: 2 });
  const hud = run.getHud();
  assert.deepEqual(Object.keys(hud).sort(), [
    'aim', 'armor', 'bossHp', 'bossMax', 'cardChoices', 'cardOffer', 'coreOfflineSec',
    'coreOnline', 'hostiles', 'hp', 'kills', 'maxArmor', 'maxHp', 'overloadReady', 'phase',
    'scene', 'syncReady', 'wave', 'waveReached',
  ]);
  assert.equal(hud.phase, 'playing');
  assert.equal(hud.wave, 1);
});

test('同 seed 同输入 → 同结果（随机种子确定性）', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  stepN(a, 120, { mx: 1, my: 0, fire: true });
  stepN(b, 120, { mx: 1, my: 0, fire: true });
  assert.equal(a.player.x, b.player.x);
  assert.equal(a.player.y, b.player.y);
  assert.equal(a.wave, b.wave);
  assert.equal(a.stats.kills, b.stats.kills);
});

test('移动：mx=1 向右，且被世界边界钳制', () => {
  const run = createRun({ seed: 3 });
  const x0 = run.player.x;
  stepN(run, 30, { mx: 1, my: 0 });
  assert.ok(run.player.x > x0);
  stepN(run, 600, { mx: 1, my: 0 });
  assert.ok(run.player.x <= 1280 - 26 - PLAYER.R + 1e-6);
});

test('开火：fire 生成子弹并计数', () => {
  const run = createRun({ seed: 4 });
  run.step({ fire: true });
  assert.equal(run.stats.shots, 1);
  assert.equal(run.bullets.length, 1);
  assert.ok(types(run.drainEvents()).includes('shot'));
});

test('击杀：子弹命中弱敌 → kill 事件 + 击杀计数', () => {
  const run = createRun({ seed: 5 });
  run.spawnQueue = [];
  addEnemy(run, 'turret', 640, 300, 1);
  const evs = [];
  for (let i = 0; i < 20; i += 1) {
    run.step({ fire: true });
    evs.push(...run.drainEvents());
  }
  assert.ok(evs.some((e) => e.type === 'kill'));
  assert.equal(run.stats.kills, 1);
});

test('护甲先于血量吸收伤害', () => {
  const run = createRun({ seed: 6 });
  run.spawnQueue = [];
  addEnemy(run, 'raider', run.player.x, run.player.y, 9999);
  run.step({});
  assert.equal(run.player.armor, PLAYER.MAX_ARMOR - 15);
  assert.equal(run.player.hp, PLAYER.HP);
});

test('相位同步：L 交换位置并进入冷却，光核离线时拒绝', () => {
  const run = createRun({ seed: 7 });
  const py = run.core.y;
  run.step({ sync: true });
  assert.equal(run.player.y, py);
  assert.equal(run.syncCd, SYNC.COOLDOWN);
  assert.ok(types(run.drainEvents()).includes('phaseSync'));

  const off = createRun({ seed: 8 });
  off.core.online = false;
  off.step({ sync: true });
  assert.ok(types(off.drainEvents()).includes('syncNo'));
});

test('超载协议：血量高时拒绝，血量<30% 清屏且光核离线', () => {
  const high = createRun({ seed: 9 });
  high.step({ skill: true });
  assert.ok(types(high.drainEvents()).includes('overloadNo'));

  const low = createRun({ seed: 10 });
  low.player.hp = 20;
  low.spawnQueue = [];
  addEnemy(low, 'turret', 640, 200, 9999);
  low.step({ skill: true });
  const evs = types(low.drainEvents());
  assert.ok(evs.includes('overload'));
  assert.ok(evs.includes('coreOffline'));
  assert.equal(low.core.online, false);
  assert.equal(low.enemies.length, 0);
});

test('光核离线 20s 后自动恢复', () => {
  const run = createRun({ seed: 11 });
  run.core.online = false;
  run.core.offlineUntil = run.time;
  run.step({});
  assert.equal(run.core.online, true);
  assert.ok(types(run.drainEvents()).includes('coreOnline'));
});

test('波次结算：清空敌人 → 卡牌三选一，选卡后推进到下一波', () => {
  const run = createRun({ seed: 12 });
  run.spawnQueue = [];
  run.enemies = [];
  run.step({});
  const evs = types(run.drainEvents());
  assert.ok(evs.includes('waveClear'));
  assert.ok(evs.includes('cardOffer'));
  assert.equal(run.cardOffer, true);
  assert.equal(run.cardChoices.length, 3);

  const ok = run.chooseCard(0);
  assert.equal(ok, true);
  assert.equal(run.cardOffer, false);
  assert.equal(run.wave, 2);
  assert.equal(run.stats.waveReached, 2);
});

test('通关：第 12 波清空 → won', () => {
  const run = createRun({ seed: 13 });
  run.wave = WAVE_COUNT;
  run.spawnQueue = [];
  run.enemies = [];
  run.step({});
  assert.equal(run.phase, 'won');
  assert.ok(types(run.drainEvents()).includes('win'));
});

test('死亡：血量归零 → dead + death 事件，死后 step 无副作用', () => {
  const run = createRun({ seed: 14 });
  run.player.hp = 5;
  run.player.armor = 0;
  run.spawnQueue = [];
  addEnemy(run, 'raider', run.player.x, run.player.y, 9999);
  run.step({});
  assert.equal(run.phase, 'dead');
  assert.ok(types(run.drainEvents()).includes('death'));
  const w = run.wave;
  run.step({});
  assert.equal(run.wave, w);
});

test('Boss 波：第 3 波生成 Boss 并上报 bossHp', () => {
  const run = createRun({ seed: 15, startWave: 3 });
  stepN(run, 120); // 越过 0.9s 预警，Boss 入场
  const hud = run.getHud();
  assert.ok(run.enemies.some((e) => e.type === 'boss'));
  assert.ok(hud.bossHp > 0);
  assert.ok(hud.bossMax > 0);
});

test('光核复制：开火 0.5s 后从光核位置打出复制弹', () => {
  const run = createRun({ seed: 16 });
  run.spawnQueue = [];
  addEnemy(run, 'turret', 200, 600, 9999); // 占位敌人，防止提前结算
  run.step({ fire: true });
  assert.equal(run.copyQueue.length, 1);
  const copyCount = () => run.bullets.filter((b) => b.fromCore).length;
  stepN(run, 31); // 0.5s 后触发
  assert.ok(copyCount() >= 1);
  const evs = types(run.drainEvents());
  assert.ok(evs.includes('coreCopy'));
});
