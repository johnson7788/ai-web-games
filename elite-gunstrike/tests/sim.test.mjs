// ELITE GUNSTRIKE · 纯逻辑测试（node --test）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { PLAYER, BOLT, CAPTIVE, comboMult } from '../config/gameplay.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

function steps(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
  return run.drainEvents();
}

function fireAt(run, ax, ay) {
  run.step({ aimX: ax, aimY: ay, fire: true });
  run.step({ aimX: ax, aimY: ay, fire: false });
  return run.drainEvents();
}

function boltAt(x, y, vx = 600, vy = 0) {
  return { id: 99999, x, y, vx, vy, life: 1 };
}

test('createRun 初始：第 1 关 / 满血 / 满弹 / 有敌人', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.level, 1);
  assert.equal(r.player.hp, PLAYER.HP);
  assert.equal(r.ammo, LEVELS[0].ammo);
  assert.equal(r.maxAmmo, LEVELS[0].ammo);
  assert.ok(r.enemies.length > 0);
  assert.equal(r.stats.levelsReached, 1);
});

test('发射：拖拽释放消耗弹药并生成弹体 + shot 事件', () => {
  const r = createRun({ seed: 1 });
  const before = r.ammo;
  const evs = fireAt(r, 640, 300);
  assert.equal(r.ammo, before - 1);
  assert.equal(r.shotsUsed, 1);
  assert.equal(r.bolts.length, 1);
  assert.ok(evs.some((e) => e.type === 'shot'));
});

test('瞄准死区：拖拽距离太短不发射', () => {
  const r = createRun({ seed: 1 });
  const before = r.ammo;
  fireAt(r, PLAYER.X + 5, PLAYER.Y); // 5px < 24px 死区
  assert.equal(r.ammo, before);
  assert.equal(r.bolts.length, 0);
});

test('弹体受重力下坠', () => {
  const r = createRun({ seed: 1 });
  r.bolts.push(boltAt(640, 300, 400, 0));
  const y0 = r.bolts[0].y;
  steps(r, 10);
  assert.ok(r.bolts.length === 1);
  assert.ok(r.bolts[0].vy > 0, '重力让 vy 增大（向下为正）');
  assert.ok(r.bolts[0].y > y0);
});

test('弹体命中敌机扣血并发出 hit 事件', () => {
  const r = createRun({ seed: 1 });
  const e = r.enemies[0];
  const hp0 = e.hp;
  r.bolts.push(boltAt(e.x, e.y, 600, 0));
  const evs = steps(r, 1);
  assert.ok(evs.some((x) => x.type === 'hit'));
  assert.equal(e.hp, hp0 - 1);
});

test('击杀：连击递增 + 分数 + kill 事件', () => {
  const r = createRun({ seed: 1 });
  const e = r.enemies[0];
  e.hp = 1;
  const kills0 = r.stats.kills;
  r.bolts.push(boltAt(e.x, e.y, 600, 0));
  const evs = steps(r, 1);
  assert.ok(evs.some((x) => x.type === 'kill'));
  assert.equal(r.stats.kills, kills0 + 1);
  assert.ok(r.combo >= 1);
  assert.ok(r.score > 0);
  assert.equal(r.enemies.length, 1, '击杀后该敌人被清理（剩 1 个）');
});

test('连击窗口超时后 combo 归零', () => {
  const r = createRun({ seed: 1 });
  r.combo = 4;
  r.lastKill = r.time - 3.0;
  const evs = steps(r, 1);
  assert.ok(evs.some((x) => x.type === 'comboBreak'));
  assert.equal(r.combo, 0);
});

test('noinput 在熔毁倒计时结束后失败', () => {
  const r = createRun({ seed: 789 });
  let t = 0;
  while (r.phase === 'playing' && t < 60 * 60) {
    r.step({});
    r.drainEvents();
    t += 1;
  }
  assert.equal(r.phase, 'dead');
  assert.equal(r.deathReason, 'meltdown');
});

test('命中俘虏立即失败（reason=captive）', () => {
  const r = createRun({ seed: 1 });
  r.captives.push({ id: 1, x: 640, y: 300, radius: CAPTIVE.RADIUS, alive: true });
  r.bolts.push(boltAt(640, 300, 600, 0));
  const evs = steps(r, 1);
  assert.ok(evs.some((x) => x.type === 'captiveHit'));
  assert.equal(r.phase, 'dead');
  assert.equal(r.deathReason, 'captive');
});

test('能量核心爆炸：对范围内敌人造成伤害并发出 explosion 事件', () => {
  const r = createRun({ seed: 1 });
  const e = r.enemies[0];
  e.x = 400; e.y = 240; e.hp = 3; e.alive = true;
  r.obstacles = [{ id: 2, type: 'core', x: 400, y: 120, w: 34, h: 34, hp: 1, maxHp: 1, fragile: false, explosive: true, alive: true }];
  const hp0 = e.hp;
  r.bolts.push(boltAt(400, 120, 600, 0));
  const evs = steps(r, 1);
  assert.ok(evs.some((x) => x.type === 'explosion'));
  assert.ok(e.hp < hp0, '爆炸使敌人掉血');
});

test('能量核心链式引爆相邻核心', () => {
  const r = createRun({ seed: 1 });
  r.obstacles = [
    { id: 1, type: 'core', x: 400, y: 120, w: 34, h: 34, hp: 1, maxHp: 1, fragile: false, explosive: true, alive: true },
    { id: 2, type: 'core', x: 500, y: 120, w: 34, h: 34, hp: 1, maxHp: 1, fragile: false, explosive: true, alive: true },
  ];
  r.bolts.push(boltAt(400, 120, 600, 0));
  const evs = steps(r, 1);
  assert.ok(evs.some((x) => x.type === 'chainExplosion'), '相邻核心被连锁引爆');
  assert.equal(r.obstacles.length, 0, '两个核心都被清除');
});

test('玻璃掩体一碰即碎且弹体穿透', () => {
  const r = createRun({ seed: 1 });
  r.obstacles = [{ id: 3, type: 'glass', x: 640, y: 300, w: 96, h: 14, hp: 1, maxHp: 1, fragile: true, explosive: false, alive: true }];
  r.bolts.push(boltAt(640, 300, 600, 0));
  steps(r, 1);
  assert.equal(r.obstacles.length, 0, '玻璃被击碎');
  assert.equal(r.bolts.length, 1, '弹体穿透继续存在');
});

test('清空敌人触发过关 + 星级 + 推进到下一关', () => {
  const r = createRun({ seed: 1 });
  r.shotsUsed = 1;
  r.enemies = [];
  const evs = steps(r, 1);
  assert.ok(evs.some((x) => x.type === 'levelCleared'));
  assert.equal(r.stars, 3, '1 发清场 = 三星');
  assert.ok(r.clearingUntil != null);
  steps(r, 60);
  assert.equal(r.level, 2);
  assert.equal(r.player.hp, PLAYER.HP, '过关回血到满');
});

test('通关最后一关进入 won', () => {
  const r = createRun({ seed: 1 });
  r.level = LEVEL_COUNT;
  r.enemies = [];
  let t = 0;
  while (r.phase === 'playing' && t < 60 * 5) {
    r.step({});
    r.drainEvents();
    t += 1;
  }
  assert.equal(r.phase, 'won');
});

test('炮塔机会发射敌弹并伤害玩家', () => {
  const r = createRun({ seed: 1 });
  r.enemies = [{ id: 1, type: 'turret', x: 640, y: 200, radius: 28, hp: 2, maxHp: 2, fire: true, fireInterval: 0.1, fireTimer: 0.01, bulletDamage: 12, score: 150, alive: true }];
  const hp0 = r.player.hp;
  steps(r, 60 * 3); // 让炮塔开火且弹体飞抵玩家
  assert.ok(r.enemyBolts.length > 0 || r.player.hp < hp0, '产生敌弹或玩家已掉血');
});

test('comboMult 封顶 3 倍', () => {
  assert.equal(comboMult(0), 1);
  assert.equal(comboMult(100), 3.0);
  assert.ok(comboMult(100) <= 3.0);
});

test('getHud 返回完整字段', () => {
  const r = createRun({ seed: 1 });
  const h = r.getHud();
  for (const k of ['phase', 'level', 'scene', 'hp', 'maxHp', 'ammo', 'score', 'combo', 'enemies', 'meltdown', 'stars', 'totalStars']) {
    assert.ok(k in h, `缺 ${k}`);
  }
});

test('弹尽且敌机仍在时无法再发射（炮塔空转）', () => {
  const r = createRun({ seed: 1 });
  r.ammo = 0;
  fireAt(r, 640, 300);
  assert.equal(r.bolts.length, 0);
});

test('弹尽且敌机仍在且最后一发落地 → 失败（reason=outOfAmmo）', () => {
  const r = createRun({ seed: 1 });
  r.ammo = 0;
  r.bolts = [];
  assert.ok(r.enemies.length > 0);
  const evs = steps(r, 1);
  assert.equal(r.phase, 'dead');
  assert.equal(r.deathReason, 'outOfAmmo');
  assert.ok(evs.some((x) => x.type === 'death'));
});
