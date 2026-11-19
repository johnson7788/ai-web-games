import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, WORLD, mulberry32 } from '../src/game/sim.js';

function enemyAt(x, y, type = 1) {
  return { type, x, y, w: 40, h: 40, hp: 1, maxHp: 1, speed: 130, score: 10, vx: 0, phase: 0, spawnX: x, fireTimer: 99 };
}

test('初始状态：playing / 3 命 / 0 分 / 第 1 波', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.lives, 3);
  assert.equal(run.state.score, 0);
  assert.equal(run.state.level, 1);
  assert.equal(run.state.killTarget, 12);
});

test('setTarget 把坐标 clamp 进边界', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.setTarget(-999, 999).ok, true);
  assert.equal(run.state.hero.targetX, 46 / 2);
  assert.equal(run.state.hero.targetY, WORLD.HEIGHT - 110);
});

test('自动开火：推进超过射击间隔会生成子弹且向上飞', () => {
  const run = createRun(0, { seed: 1 });
  for (let i = 0; i < 20; i += 1) run.step(1 / 60);
  assert.ok(run.state.bullets.length > 0, '应有子弹');
  assert.ok(run.state.bullets[0].vy < 0, '子弹应向上');
});

test('敌机按波次定时生成', () => {
  const run = createRun(0, { seed: 1 });
  for (let i = 0; i < 120; i += 1) run.step(1 / 60);
  assert.ok(run.state.enemies.length > 0, '2 秒内应有敌机');
});

test('子弹命中敌机：扣血并击杀得分/连击', () => {
  const run = createRun(0, { seed: 1 });
  run.state.enemies = [enemyAt(640, 400)];
  run.state.bullets = [{ x: 640, y: 407, w: 6, h: 16, vy: -760, vx: 0 }];
  run.step(1 / 60);
  assert.equal(run.state.enemies.length, 0, '敌机被击杀');
  assert.ok(run.state.score > 0, '得分增加');
  assert.equal(run.state.combo, 1, '连击 +1');
  assert.equal(run.state.kills, 1);
});

test('连击窗口超时会归零', () => {
  const run = createRun(0, { seed: 1 });
  run.state.combo = 3;
  run.state.comboTimer = 0.05;
  for (let i = 0; i < 10; i += 1) run.step(1 / 60);
  assert.equal(run.state.combo, 0);
});

test('敌机撞英雄：扣 1 命并清空连击', () => {
  const run = createRun(0, { seed: 1 });
  run.state.combo = 4;
  run.state.enemies = [enemyAt(run.state.hero.x, run.state.hero.y)];
  run.step(1 / 60);
  assert.equal(run.state.lives, 2);
  assert.equal(run.state.combo, 0);
  assert.ok(run.state.invuln > 0, '受击后进入无敌帧');
});

test('护盾抵消一次伤害', () => {
  const run = createRun(0, { seed: 1 });
  run.state.shield = true;
  run.state.enemies = [enemyAt(run.state.hero.x, run.state.hero.y)];
  run.step(1 / 60);
  assert.equal(run.state.lives, 3, '护盾挡下，不掉命');
  assert.equal(run.state.shield, false, '护盾消耗');
});

test('命归零：进入 lost 并发出 lose 事件', () => {
  const run = createRun(0, { seed: 1 });
  run.state.lives = 1;
  run.state.enemies = [enemyAt(run.state.hero.x, run.state.hero.y)];
  run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'lose'));
});

test('达成击杀目标：进入下一波', () => {
  const run = createRun(0, { seed: 1 });
  run.state.kills = run.state.killTarget - 1;
  run.state.enemies = [enemyAt(640, 400)];
  run.state.bullets = [{ x: 640, y: 407, w: 6, h: 16, vy: -760, vx: 0 }];
  run.step(1 / 60);
  assert.equal(run.state.level, 2, '升到第 2 波');
  assert.equal(run.state.kills, 0, '击杀数重置');
});

test('最后一波达成目标：胜利并给星', () => {
  const run = createRun(2, { seed: 1 });
  run.state.kills = run.state.killTarget - 1;
  run.state.score = 1500;
  run.state.enemies = [enemyAt(640, 400)];
  run.state.bullets = [{ x: 640, y: 407, w: 6, h: 16, vy: -760, vx: 0 }];
  run.step(1 / 60);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1 && run.state.stars <= 3);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'win'));
});

test('第 2 波会生成岩石', () => {
  const run = createRun(1, { seed: 1 });
  for (let i = 0; i < 60 * 8; i += 1) run.step(1 / 60);
  assert.ok(run.state.rocks.length > 0, '8 秒内应出现岩石');
});

test('拾取 spread 道具：进入散射状态', () => {
  const run = createRun(0, { seed: 1 });
  run.state.powerups = [{ type: 'spread', x: run.state.hero.x, y: run.state.hero.y, w: 34, h: 34 }];
  run.step(1 / 60);
  assert.ok(run.state.spread > 0, 'spread 计时器启动');
});

test('同种子确定性：两步后状态一致', () => {
  const a = createRun(0, { seed: 42 });
  const b = createRun(0, { seed: 42 });
  for (let i = 0; i < 30; i += 1) { a.step(1 / 60); b.step(1 / 60); }
  assert.equal(a.state.hero.x, b.state.hero.x);
  assert.equal(a.state.enemies.length, b.state.enemies.length);
});

test('mulberry32 是同种子确定性 PRNG', () => {
  const r1 = mulberry32(7);
  const r2 = mulberry32(7);
  assert.equal(r1(), r2());
});
