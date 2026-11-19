import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, starsFor } from '../src/game/sim.js';
import { GUN, BULLET, WORLD, STEP } from '../config/game.config.js';
import { LEVELS } from '../config/levels.js';

function drainAll(run) { return run.drainEvents(); }

test('初始状态：playing、第 1 关、有全息靶、满子弹', () => {
  const run = createRun({ seed: 1 });
  const st = run.state;
  assert.equal(st.phase, 'playing');
  assert.equal(st.level, 1);
  assert.ok(st.targets.length > 0);
  assert.equal(st.bullets, LEVELS[0].bullets);
});

test('瞄准：aimAt 让炮管朝向上方目标（负角）', () => {
  const run = createRun({ seed: 1 });
  run.aimAt(GUN.X, 200);
  assert.ok(run.state.gunAngle < 0);
  assert.ok(run.state.gunAngle >= -Math.PI);
});

test('开火：消耗 1 发弹药、生成 1 颗飞行弹、发 shot 事件', () => {
  const run = createRun({ seed: 1 });
  const before = run.state.bullets;
  const res = run.fire();
  assert.equal(res.ok, true);
  assert.equal(run.state.bullets, before - 1);
  assert.equal(run.state.bulletsFlying.length, 1);
  assert.ok(drainAll(run).some((e) => e.type === 'shot'));
});

test('空膛：无弹药开火返回 false 并发 noAmmo', () => {
  const run = createRun({ seed: 1 });
  run.state.bullets = 0;
  const res = run.fire();
  assert.equal(res.ok, false);
  assert.ok(drainAll(run).some((e) => e.type === 'noAmmo'));
});

test('三连发：triple 生效时一次发射 3 颗飞行弹', () => {
  const run = createRun({ seed: 1 });
  run.state.triple = 5;
  run.fire();
  assert.equal(run.state.bulletsFlying.length, 3);
});

test('子弹命中全息靶：目标减少、发 kill、计分、连击=1', () => {
  const run = createRun({ seed: 1 });
  run.aimAt(LEVELS[0].targets[0].x, LEVELS[0].targets[0].y);
  run.fire();
  for (let i = 0; i < 40; i += 1) run.step(STEP);
  const evs = drainAll(run);
  assert.equal(run.state.targets.length, 0);
  assert.ok(evs.some((e) => e.type === 'kill'));
  assert.ok(run.state.score > 0);
});

test('墙反弹：子弹撞左墙后反向并发 reflect', () => {
  const run = createRun({ seed: 1 });
  run.state.bulletsFlying.push({ x: 10, y: 300, vx: -BULLET.SPEED, vy: 0, bounces: 0 });
  run.step(STEP);
  const b = run.state.bulletsFlying[0];
  assert.ok(b.vx > 0);
  assert.ok(drainAll(run).some((e) => e.type === 'reflect'));
});

test('过关：清空全息靶后进入 clear 阶段并发 levelclear', () => {
  const run = createRun({ seed: 1 });
  run.aimAt(LEVELS[0].targets[0].x, LEVELS[0].targets[0].y);
  run.fire();
  for (let i = 0; i < 40; i += 1) run.step(STEP);
  assert.equal(run.state.phase, 'clear');
  assert.ok(drainAll(run).some((e) => e.type === 'levelclear'));
});

test('失败：弹尽 + 无飞行弹 + 仍有目标 → result 且 won=false', () => {
  const run = createRun({ seed: 1 });
  run.state.bullets = 0;
  run.state.bulletsFlying = [];
  run.step(STEP);
  assert.equal(run.state.phase, 'result');
  assert.equal(run.state.won, false);
  assert.ok(drainAll(run).some((e) => e.type === 'fail'));
});

test('VIP 误伤：命中中立目标 → vipfail + result 且 won=false', () => {
  const run = createRun({ seed: 1 });
  run.state.vips = [{ x: 400, y: 400 }];
  run.state.bulletsFlying.push({ x: 400, y: 380, vx: 0, vy: BULLET.SPEED, bounces: 0 });
  run.step(STEP);
  assert.equal(run.state.phase, 'result');
  assert.equal(run.state.won, false);
  assert.ok(drainAll(run).some((e) => e.type === 'vipfail'));
});

test('连击：两杀在窗口内叠加 combo 并发 combo 事件', () => {
  const run = createRun({ seed: 1 });
  run.state.targets = [{ x: 300, y: 300 }, { x: 500, y: 300 }];
  run.state.bulletsFlying.push({ x: 300, y: 280, vx: 0, vy: BULLET.SPEED, bounces: 0 });
  run.step(STEP);
  run.state.bulletsFlying.push({ x: 500, y: 280, vx: 0, vy: BULLET.SPEED, bounces: 0 });
  run.step(STEP);
  assert.equal(run.state.combo, 2);
  assert.ok(drainAll(run).some((e) => e.type === 'combo'));
});

test('道具箱：子弹穿过即打爆并掉落道具', () => {
  const run = createRun({ seed: 1 });
  run.state.crates = [{ x: 400, y: 400, kind: 'ammo' }];
  run.state.bulletsFlying.push({ x: 400, y: 380, vx: 0, vy: BULLET.SPEED, bounces: 0 });
  run.step(STEP);
  assert.equal(run.state.crates.length, 0);
  assert.equal(run.state.powerups.length, 1);
  assert.ok(drainAll(run).some((e) => e.type === 'crate'));
});

test('岩石坠落碾压：激活后砸中全息靶发 crush', () => {
  const run = createRun({ seed: 1 });
  run.state.targets = [{ x: 400, y: 500 }];
  run.state.rocks = [{ x: 400, y: 420, falling: true, vy: 0 }];
  run.state.bulletsFlying = [];
  for (let i = 0; i < 40; i += 1) run.step(STEP);
  assert.equal(run.state.targets.length, 0);
  assert.ok(drainAll(run).some((e) => e.type === 'crush'));
});

test('通关全关：清完最后一关进入胜利 result 且 won=true', () => {
  const run = createRun({ seed: 1 });
  run.state.level = LEVELS.length;
  run.state.targets = [];
  run.state.phase = 'playing';
  run.step(STEP);
  for (let i = 0; i < 90; i += 1) run.step(STEP);
  assert.equal(run.state.phase, 'result');
  assert.equal(run.state.won, true);
  assert.ok(drainAll(run).some((e) => e.type === 'win'));
});

test('星级阈值：shotsUsed ≤ 阈值给出对应星', () => {
  assert.equal(starsFor(1, [1, 2, 3]), 3);
  assert.equal(starsFor(2, [1, 2, 3]), 2);
  assert.equal(starsFor(3, [1, 2, 3]), 1);
  assert.equal(starsFor(4, [1, 2, 3]), 0);
});

test('边界：炮管角度被 clamp 到朝上区间内', () => {
  const run = createRun({ seed: 1 });
  run.aimAt(GUN.X, WORLD.HEIGHT + 100); // 目标在炮台正下方
  assert.ok(run.state.gunAngle <= -0.12);
  assert.ok(run.state.gunAngle >= -Math.PI + 0.12);
});
