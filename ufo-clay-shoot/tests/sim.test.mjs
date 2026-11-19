import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { PLAYER, AMMO, COIN, ENEMIES, WORLD, WAVE_SEC } from '../config/game.config.js';

function drainAll(run) {
  return run.drainEvents();
}

test('初始状态：playing、满弹药、玩家在底部居中', () => {
  const run = createRun({ seed: 1 });
  const st = run.state;
  assert.equal(st.phase, 'playing');
  assert.equal(st.ammo, PLAYER.AMMO_START);
  assert.equal(st.alive, true);
  assert.equal(st.player.x, WORLD.WIDTH / 2);
  assert.ok(st.player.y > WORLD.HEIGHT / 2);
});

test('开火：消耗弹药并发出 shot 事件', () => {
  const run = createRun({ seed: 1 });
  const before = run.state.ammo;
  const res = run.fire();
  assert.equal(res.ok, true);
  assert.equal(run.state.ammo, before - 1);
  assert.equal(run.state.lasers.length, 1);
  const ev = drainAll(run);
  assert.ok(ev.some((e) => e.type === 'shot'));
});

test('空膛：无弹药时开火返回失败并发出 noAmmo', () => {
  const run = createRun({ seed: 1 });
  run.state.ammo = 0;
  const res = run.fire();
  assert.equal(res.ok, false);
  assert.ok(drainAll(run).some((e) => e.type === 'noAmmo'));
});

test('三连发：拾取道具后一次三发', () => {
  const run = createRun({ seed: 1 });
  run.state.triple = 5;
  run.fire();
  assert.equal(run.state.lasers.length, 3);
});

test('移动：按住右加速向右移动', () => {
  const run = createRun({ seed: 1 });
  run.input.right = true;
  const startX = run.state.player.x;
  for (let i = 0; i < 30; i += 1) run.step(1 / 60);
  assert.ok(run.state.player.x > startX);
});

test('边界：玩家不能超出左右边界', () => {
  const run = createRun({ seed: 1 });
  run.state.player.x = PLAYER.LEFT_BOUND;
  run.input.left = true;
  for (let i = 0; i < 60; i += 1) run.step(1 / 60);
  assert.ok(run.state.player.x >= PLAYER.LEFT_BOUND - 1);
});

test('激光击毁小飞碟：hp 归零、发 kill 事件、计分与连击', () => {
  const run = createRun({ seed: 1 });
  run.state.enemies.push({
    x: WORLD.WIDTH / 2, y: 200, xSpeed: 0, dir: 1, type: 'small', hp: 1,
    fireTimer: 999, burst: false, burstCount: 0, burstTimer: 0, canFire: false,
  });
  run.state.lasers.push({ x: WORLD.WIDTH / 2, y: 200, vx: 0, vy: 0 });
  run.step(1 / 60);
  assert.equal(run.state.enemies.length, 0);
  assert.equal(run.state.combo, 1);
  assert.ok(run.state.score > 0);
  assert.ok(drainAll(run).some((e) => e.type === 'kill'));
});

test('中型飞碟需要两发：一发 hit 一发 kill', () => {
  const run = createRun({ seed: 1 });
  run.state.enemies.push({
    x: 640, y: 200, xSpeed: 0, dir: 1, type: 'medium', hp: 2,
    fireTimer: 999, burst: false, burstCount: 0, burstTimer: 0, canFire: false,
  });
  run.state.lasers.push({ x: 640, y: 200, vx: 0, vy: 0 });
  run.step(1 / 60);
  assert.equal(run.state.enemies.length, 1);
  assert.equal(run.state.enemies[0].hp, 1);
  assert.ok(drainAll(run).some((e) => e.type === 'hit'));
  run.state.lasers.push({ x: 640, y: 200, vx: 0, vy: 0 });
  run.step(1 / 60);
  assert.equal(run.state.enemies.length, 0);
  assert.ok(drainAll(run).some((e) => e.type === 'kill'));
});

test('激光击毁小行星：加分并发出 kill(asteroid)', () => {
  const run = createRun({ seed: 1 });
  run.state.asteroids.push({ x: 300, y: 200, vx: 0, vy: 0, rot: 0, dir: 1 });
  run.state.lasers.push({ x: 300, y: 200, vx: 0, vy: 0 });
  run.step(1 / 60);
  assert.equal(run.state.asteroids.length, 0);
  assert.ok(drainAll(run).some((e) => e.type === 'kill' && e.kind === 'asteroid'));
});

test('拾取金币：10 枚触发无敌', () => {
  const run = createRun({ seed: 1 });
  const p = run.state.player;
  for (let i = 0; i < COIN.INVINCIBLE_AT - 1; i += 1) {
    run.state.coins.push({ x: p.x, y: p.y });
    run.step(1 / 60);
  }
  assert.equal(run.state.invincible, false);
  run.state.coins.push({ x: p.x, y: p.y });
  run.step(1 / 60);
  assert.equal(run.state.invincible, true);
  assert.ok(drainAll(run).some((e) => e.type === 'invincible'));
});

test('拾取弹药箱：+12 弹药', () => {
  const run = createRun({ seed: 1 });
  run.state.ammo = 3;
  run.state.ammoBoxes.push({ x: run.state.player.x, y: run.state.player.y });
  run.step(1 / 60);
  assert.equal(run.state.ammo, 3 + AMMO.PER_BOX);
  assert.ok(drainAll(run).some((e) => e.type === 'pickupAmmo'));
});

test('被敌机撞击：扣血并进入受击无敌帧，而非立刻死亡', () => {
  const run = createRun({ seed: 1 });
  const p = run.state.player;
  run.state.enemies.push({
    x: p.x, y: p.y, xSpeed: 0, dir: 1, type: 'small', hp: 1,
    fireTimer: 999, burst: false, burstCount: 0, burstTimer: 0, canFire: false,
  });
  run.step(1 / 60);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.hp, PLAYER.MAX_HP - 1);
  assert.equal(run.state.invincible, true);
  assert.ok(drainAll(run).some((e) => e.type === 'hurt'));
});

test('生命值归零后死亡（phase=over、发 lose）', () => {
  const run = createRun({ seed: 1 });
  run.state.hp = 1;
  const p = run.state.player;
  run.state.enemies.push({
    x: p.x, y: p.y, xSpeed: 0, dir: 1, type: 'small', hp: 1,
    fireTimer: 999, burst: false, burstCount: 0, burstTimer: 0, canFire: false,
  });
  run.step(1 / 60);
  assert.equal(run.state.phase, 'over');
  assert.equal(run.state.alive, false);
  assert.ok(drainAll(run).some((e) => e.type === 'lose'));
});

test('无敌时撞击敌机：敌机被撞毁、玩家存活', () => {
  const run = createRun({ seed: 1 });
  const p = run.state.player;
  run.state.invincible = true;
  run.state.invTimer = 5;
  run.state.enemies.push({
    x: p.x, y: p.y, xSpeed: 0, dir: 1, type: 'small', hp: 1,
    fireTimer: 999, burst: false, burstCount: 0, burstTimer: 0, canFire: false,
  });
  run.step(1 / 60);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.enemies.length, 0);
});

test('波次：随时间推进 1→2→3', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.state.wave, 1);
  run.state.time = WAVE_SEC;
  run.step(1 / 60);
  assert.equal(run.state.wave, 2);
  run.state.time = WAVE_SEC * 2;
  run.step(1 / 60);
  assert.equal(run.state.wave, 3);
});

test('星级：存活时间达到阈值给出对应星级', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.stars(), 0);
  run.state.time = 30;
  assert.equal(run.stars(), 1);
  run.state.time = 55;
  assert.equal(run.stars(), 2);
  run.state.time = 90;
  assert.equal(run.stars(), 3);
});

test('连击：无击杀超时后重置为 0', () => {
  const run = createRun({ seed: 1 });
  run.state.enemies.push({
    x: 640, y: 200, xSpeed: 0, dir: 1, type: 'small', hp: 1,
    fireTimer: 999, burst: false, burstCount: 0, burstTimer: 0, canFire: false,
  });
  run.state.lasers.push({ x: 640, y: 200, vx: 0, vy: 0 });
  run.step(1 / 60);
  assert.equal(run.state.combo, 1);
  run.state.comboTimer = 0;
  run.step(1 / 60);
  assert.equal(run.state.combo, 0);
});
