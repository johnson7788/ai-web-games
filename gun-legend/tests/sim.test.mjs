// GUN LEGEND · M1 纯逻辑测试（node --test）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { comboMult, PLAYER } from '../config/gameplay.js';

function steps(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
  return run.drainEvents();
}

function makeKnife(x = 640, y = 300, hp = 40) {
  return {
    id: Math.floor(Math.random() * 1e6), type: 'knife', x, y, hp, radius: 16, speed: 0,
    holdRange: 40, meleeRange: 40, meleeDamage: 14, meleeInterval: 0.9, meleeTimer: 0,
    fireInterval: 999, fireTimer: 999, bulletSpeed: 0, bulletDamage: 0, volley: 1,
    throwInterval: 999, throwTimer: 999, grenadeSpeed: 0, fuseSec: 0, explosionRadius: 0, explosionDamage: 0, score: 100,
  };
}

test('createRun 初始：第 1 场 / 左轮 / 满血 / 满弹', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.round, 1);
  assert.equal(r.scene, 1);
  assert.equal(r.weapon.id, 'revolver');
  assert.equal(r.player.hp, PLAYER.HP);
  assert.equal(r.guns.left, 6);
  assert.equal(r.guns.right, 6);
});

test('开火消耗弹匣并发出 shot 事件', () => {
  const r = createRun({ seed: 1 });
  r.fireCd = 0;
  r.step({ fire: true });
  const all = r.drainEvents();
  assert.equal(r.guns.left, 5);
  assert.ok(all.some((e) => e.type === 'shot'));
});

test('双枪无缝切换：左轮打空自动切右轮', () => {
  const r = createRun({ seed: 1 });
  for (let i = 0; i < 6; i += 1) {
    r.fireCd = 0;
    r.step({ fire: true });
    r.drainEvents();
  }
  assert.equal(r.guns.left, 0);
  assert.equal(r.guns.right, 6);
  assert.equal(r.guns.active, 1);
});

test('双枪同时清空触发白鸽时刻（免费满膛 + 连杀 +3）', () => {
  const r = createRun({ seed: 1 });
  let dove = 0;
  for (let i = 0; i < 12; i += 1) {
    r.fireCd = 0;
    r.step({ fire: true });
    dove += r.drainEvents().filter((e) => e.type === 'dove').length;
  }
  assert.equal(dove, 1);
  assert.equal(r.guns.left, 6);
  assert.equal(r.guns.right, 6);
  assert.equal(r.combo, 3);
  assert.ok(r.score >= 300);
});

test('手动换弹填满双枪', () => {
  const r = createRun({ seed: 1 });
  r.guns.left = 0;
  r.guns.right = 1;
  r.step({ reload: true });
  r.drainEvents();
  assert.equal(r.reloading, true);
  steps(r, 100);
  assert.equal(r.reloading, false);
  assert.equal(r.guns.left, 6);
  assert.equal(r.guns.right, 6);
});

test('换弹舞：节奏点内点击立即完成', () => {
  const r = createRun({ seed: 1 });
  r.guns.left = 0;
  r.guns.right = 0;
  r.step({ reload: true });
  r.drainEvents();
  steps(r, 55); // 进度 ≈ 0.70，进入 sweet spot
  r.step({ fire: true });
  const after = r.drainEvents();
  assert.equal(r.reloading, false);
  assert.ok(after.some((e) => e.type === 'reloadDance'));
  assert.equal(r.guns.left, 6);
});

test('换弹舞：节奏点外乱点打空弹匣并重来', () => {
  const r = createRun({ seed: 1 });
  r.guns.left = 0;
  r.guns.right = 0;
  r.step({ reload: true });
  r.drainEvents();
  steps(r, 20); // 进度 ≈ 0.26，未到 sweet spot
  r.step({ fire: true });
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'reloadFail'));
  assert.equal(r.reloading, true);
  assert.equal(r.guns.left, 0);
  assert.equal(r.guns.right, 0);
});

test('翻滚：位移 + 无敌 + 冷却', () => {
  const r = createRun({ seed: 1 });
  r.aim.x = 900;
  r.step({ roll: true });
  r.drainEvents();
  assert.equal(r.player.rolling, true);
  assert.ok(r.player.invulnUntil > r.time);
  assert.ok(r.player.rollCd > 2.9 && r.player.rollCd <= PLAYER.ROLL_CD);
  steps(r, 40);
  assert.ok(r.player.x > PLAYER.X);
});

test('翻滚冷却内无法再次翻滚', () => {
  const r = createRun({ seed: 1 });
  r.step({ roll: true });
  r.drainEvents();
  r.player.rolling = false;
  r.step({ roll: true });
  const evs = r.drainEvents();
  assert.ok(!evs.some((e) => e.type === 'rollStart'));
});

test('玩家子弹命中敌人扣血', () => {
  const r = createRun({ seed: 1 });
  r.enemies.push(makeKnife(640, 300, 40));
  r.aim.x = 640;
  r.aim.y = 300;
  r.bullets.push({ id: 1, x: 640, y: 310, vx: 0, vy: -1000, damage: 34, radius: 4, life: 1 });
  r.step({});
  r.drainEvents();
  assert.equal(r.enemies[0].hp, 6);
});

test('击杀：连杀递增 + 统计击杀数', () => {
  const r = createRun({ seed: 1 });
  r.combo = 2;
  r.lastKill = r.time;
  r.enemies.push(makeKnife(640, 300, 1));
  r.bullets.push({ id: 2, x: 640, y: 300, vx: 0, vy: 0, damage: 34, radius: 4, life: 1 });
  r.step({});
  const evs = r.drainEvents();
  assert.ok(evs.some((x) => x.type === 'kill'));
  assert.equal(r.combo, 3);
  assert.equal(r.stats.kills, 1);
});

test('连杀窗口超时后 combo 归零', () => {
  const r = createRun({ seed: 1 });
  r.combo = 4;
  r.lastKill = r.time - 3.0;
  r.step({});
  const evs = r.drainEvents();
  assert.ok(evs.some((x) => x.type === 'comboBreak'));
  assert.equal(r.combo, 0);
});

test('敌人子弹命中玩家扣血', () => {
  const r = createRun({ seed: 1 });
  r.enemyBullets.push({ id: 1, x: 640, y: 545, vx: 0, vy: 500, damage: 11, radius: 5, life: 2 });
  r.step({});
  r.drainEvents();
  assert.ok(r.player.hp < PLAYER.HP);
});

test('无敌期间子弹擦身不受伤', () => {
  const r = createRun({ seed: 1 });
  r.player.invulnUntil = r.time + 1;
  const hp = r.player.hp;
  r.enemyBullets.push({ id: 1, x: 640, y: 500, vx: 0, vy: 500, damage: 11, radius: 5, life: 2 });
  r.step({});
  r.drainEvents();
  assert.equal(r.player.hp, hp);
});

test('手雷爆炸伤害玩家', () => {
  const r = createRun({ seed: 1 });
  r.grenades.push({ id: 1, x: 640, y: 500, tx: 640, ty: 560, speed: 200, fuse: 0.01, radius: 90, damage: 24 });
  r.step({});
  r.drainEvents();
  assert.ok(r.player.hp < PLAYER.HP);
});

test('波次清空后推进到下一波', () => {
  const r = createRun({ seed: 1 });
  steps(r, 40); // 第一波已生成（0.5s）
  assert.ok(r.enemies.length > 0);
  r.enemies = [];
  r.wave.waiting = false;
  steps(r, 5);
  assert.equal(r.wave.waiting, true); // 进入清空延迟
  steps(r, 80); // 延迟结束，生成第二波
  assert.equal(r.wave.spawned, 2);
});

test('清完全部波次后过关并回血', () => {
  const r = createRun({ seed: 1 });
  r.player.hp = 50;
  r.wave = { timer: 0, spawned: 99, waiting: false };
  r.enemies = [];
  steps(r, 150);
  assert.equal(r.round, 2);
  assert.ok(r.player.hp > 50);
});

test('第 5 场解锁散弹、第 9 场解锁冲锋', () => {
  const r = createRun({ seed: 1 });
  r.round = 4;
  r.roundClearing = true;
  r.roundClearUntil = r.time;
  steps(r, 3);
  assert.equal(r.round, 5);
  assert.equal(r.weapon.id, 'shotgun');
  r.round = 8;
  r.roundClearing = true;
  r.roundClearUntil = r.time;
  steps(r, 3);
  assert.equal(r.round, 9);
  assert.equal(r.weapon.id, 'smg');
});

test('场景随场次切换：1-4 雨巷 / 5-8 天台 / 9-12 酒楼', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.scene, 1);
  r.round = 4;
  r.roundClearing = true;
  r.roundClearUntil = r.time;
  steps(r, 3);
  assert.equal(r.scene, 2);
  r.round = 8;
  r.roundClearing = true;
  r.roundClearUntil = r.time;
  steps(r, 3);
  assert.equal(r.scene, 3);
});

test('noinput 会被刀手近战杀死', () => {
  const r = createRun({ seed: 789 });
  let t = 0;
  while (r.phase === 'playing' && t < 60 * 60) {
    r.step({});
    r.drainEvents();
    t += 1;
  }
  assert.equal(r.phase, 'dead');
  assert.equal(r.stats.roundReached, 1);
});

test('getHud 返回完整字段', () => {
  const r = createRun({ seed: 1 });
  const h = r.getHud();
  for (const k of ['phase', 'round', 'scene', 'hp', 'maxHp', 'ammoL', 'ammoR', 'combo', 'score', 'rollReady', 'reloading', 'reloadProgress']) {
    assert.ok(k in h, `缺 ${k}`);
  }
});

test('comboMult 封顶 3 倍', () => {
  assert.equal(comboMult(0), 1);
  assert.equal(comboMult(100), 3.0);
  assert.ok(comboMult(100) <= 3.0);
});

test('翻滚位移受世界边界钳制', () => {
  const r = createRun({ seed: 1 });
  r.player.x = 100;
  r.aim.x = 10; // 朝左
  r.step({ roll: true });
  r.drainEvents();
  steps(r, 40);
  assert.ok(r.player.x >= PLAYER.ROLL_MIN_X);
});

test('玩家子弹离线即清理', () => {
  const r = createRun({ seed: 1 });
  r.bullets.push({ id: 1, x: 640, y: -50, vx: 0, vy: -1000, damage: 10, radius: 4, life: 0.01 });
  r.step({});
  r.drainEvents();
  assert.equal(r.bullets.length, 0);
});
