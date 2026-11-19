import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { WORLD, PLAYER, ENEMY_TYPES } from '../config/game.config.js';

function stepN(run, n) {
  for (let i = 0; i < n; i += 1) run.step();
}

function eventsOf(run) {
  return run.drainEvents();
}

function makeEnemy(typeKey, x, y) {
  const t = ENEMY_TYPES[typeKey];
  return {
    type: typeKey,
    x,
    y,
    hp: t.hp,
    maxHp: t.hp,
    attack: t.attack,
    speed: t.speed,
    meleeRange: t.meleeRange,
    attackCd: t.attackCd,
    attackTimer: 0,
    ranged: t.ranged,
    range: t.range,
    bulletSpeed: t.bulletSpeed,
    radius: t.radius,
    score: t.score,
    shield: t.shield,
    boss: t.boss,
    hitFlash: 0,
  };
}

test('createRun 初始为 playing 且第 1 关', () => {
  const run = createRun(0);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.levelIndex, 0);
  assert.equal(run.state.player.hp, PLAYER.MAX_HP);
  assert.equal(run.state.totalEnemies > 0, true);
});

test('按住右移 x 增加', () => {
  const run = createRun(0);
  const startX = run.state.player.x;
  run.setInput({ right: true });
  stepN(run, 10);
  assert.ok(run.state.player.x > startX);
});

test('左移撞左墙被钳制', () => {
  const run = createRun(0);
  run.state.player.x = WORLD.LEFT_WALL + 2;
  run.setInput({ left: true });
  stepN(run, 20);
  assert.ok(run.state.player.x >= WORLD.LEFT_WALL);
});

test('跳跃后 vy < 0 且离开地面', () => {
  const run = createRun(0);
  run.setInput({ jump: true });
  run.step();
  assert.ok(run.state.player.vy < 0);
  assert.equal(run.state.player.onGround, false);
});

test('二段跳：地面跳后再空中跳一次', () => {
  const run = createRun(0);
  run.setInput({ jump: true });
  run.step();
  assert.equal(run.state.player.onGround, false);
  assert.equal(run.state.player.airJumps, 1);
  run.setInput({ jump: true });
  run.step();
  assert.ok(run.state.player.vy < 0, '空中二段跳后仍向上');
  assert.equal(run.state.player.airJumps, 0, '空中跳用完后 airJumps 归零');
});

test('重力会把玩家拉回地面', () => {
  const run = createRun(0);
  run.setInput({ jump: true });
  run.step();
  stepN(run, 120);
  assert.equal(run.state.player.onGround, true);
  assert.equal(run.state.player.y, WORLD.GROUND_Y - PLAYER.HEIGHT);
});

test('开火命中范围内的敌人并扣血', () => {
  const run = createRun(0);
  run.state.enemies.push(makeEnemy('drone', 400, WORLD.GROUND_Y - 26));
  run.setInput({ fire: true });
  run.step();
  const evs = eventsOf(run);
  assert.ok(evs.some((e) => e.type === 'shoot'));
  // 子弹命中后敌人扣血
  let hit = false;
  for (let i = 0; i < 60 && !hit; i += 1) {
    run.step();
    if (eventsOf(run).some((e) => e.type === 'hit')) hit = true;
  }
  assert.equal(hit, true);
});

test('击杀敌人触发 kill 事件与得分/连击', () => {
  const run = createRun(0);
  const e = makeEnemy('drone', 400, WORLD.GROUND_Y - 26);
  run.state.enemies.push(e);
  run.state.bullets.push({ x: e.x, y: e.y, vx: 0, vy: 0, speed: 0, damage: 999, pierce: 0, radius: 0, range: 999, from: 'player', weapon: 0 });
  run.step();
  const evs = eventsOf(run);
  assert.ok(evs.some((x) => x.type === 'kill'));
  assert.ok(run.state.score > 0);
  assert.ok(run.state.combo >= 1);
});

test('连续击杀 5 个触发 combo 事件', () => {
  const run = createRun(0);
  for (let i = 0; i < 5; i += 1) {
    const e = makeEnemy('drone', 500, WORLD.GROUND_Y - 26);
    run.state.enemies.push(e);
  }
  run.state.bullets.push({ x: 500, y: WORLD.GROUND_Y - 26, vx: 0, vy: 0, speed: 0, damage: 999, pierce: 0, radius: 200, range: 999, from: 'player', weapon: 3 });
  run.step();
  const evs = eventsOf(run);
  assert.ok(evs.some((x) => x.type === 'combo'));
});

test('切换武器循环 4 把', () => {
  const run = createRun(0);
  const w0 = run.state.player.weapon;
  run.switchWeapon();
  assert.equal(run.state.player.weapon, (w0 + 1) % 4);
});

test('玩家被近战攻击会掉血', () => {
  const run = createRun(0);
  const e = makeEnemy('striker', run.state.player.x + 10, WORLD.GROUND_Y - 26);
  e.attackTimer = 99;
  run.state.enemies.push(e);
  const hp0 = run.state.player.hp;
  run.step();
  const evs = eventsOf(run);
  assert.ok(evs.some((x) => x.type === 'hurt'));
  assert.ok(run.state.player.hp < hp0);
});

test('HP 归零进入 lost 并触发 lose 事件', () => {
  const run = createRun(0);
  run.state.player.hp = 1;
  const e = makeEnemy('striker', run.state.player.x + 10, WORLD.GROUND_Y - 26);
  e.attackTimer = 99;
  e.attack = 50;
  run.state.enemies.push(e);
  run.step();
  assert.equal(run.state.phase, 'lost');
  assert.ok(run.drainEvents().some((x) => x.type === 'lose'));
});

test('清空所有敌人进入 won 并触发 win 事件', () => {
  const run = createRun(0);
  run.state.spawnList.forEach((w) => { w.done = true; });
  run.state.enemies.length = 0;
  run.step();
  assert.equal(run.state.phase, 'won');
  assert.ok(run.drainEvents().some((x) => x.type === 'win'));
});

test('能量蓄满后 triggerBlast 造成范围伤害', () => {
  const run = createRun(0);
  run.state.duoReady = true;
  const e = makeEnemy('drone', run.state.player.x + 100, WORLD.GROUND_Y - 26);
  run.state.enemies.push(e);
  const res = run.triggerBlast();
  assert.equal(res.ok, true);
  assert.ok(eventsOf(run).some((x) => x.type === 'duo'));
});

test('无目标时按住开火不发射子弹', () => {
  const run = createRun(0);
  run.setInput({ fire: true });
  run.step();
  assert.equal(run.state.bullets.length, 0);
});
