import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState,
  launchBall,
  stepState,
  isCleared,
  breakables,
  createRun,
  drainEvents,
} from '../src/game/sim.js';
import { BALL } from '../config/game.config.js';

test('初始状态：待发射', () => {
  const s = createState(0);
  assert.equal(s.phase, 'aiming');
  assert.equal(s.ball.active, false);
  assert.equal(s.ball.x, BALL.LAUNCH_X);
  assert.equal(s.ball.y, BALL.LAUNCH_Y);
});

test('发射：进入飞行并计数', () => {
  const s = createState(0);
  const ok = launchBall(s, -Math.PI / 2);
  assert.equal(ok, true);
  assert.equal(s.phase, 'flying');
  assert.equal(s.launches, 1);
  assert.equal(s.ball.active, true);
  assert.notEqual(s.ball.vy, 0);
});

test('飞行中不能重复发射', () => {
  const s = createState(0);
  launchBall(s, 0);
  assert.equal(launchBall(s, Math.PI), false);
});

test('重力：向上发射后最终向下加速', () => {
  const s = createState(0);
  launchBall(s, -Math.PI / 2); // 向上
  let vy = s.ball.vy;
  for (let i = 0; i < 120; i += 1) stepState(s, 1 / 60);
  assert.ok(s.ball.vy > vy, 'vy 应该因重力增大');
});

test('落空：球出底后回到待发射并计 1 次落空', () => {
  const s = createState(0);
  launchBall(s, -Math.PI / 2);
  let guard = 0;
  while (s.phase === 'flying' && guard++ < 4000) stepState(s, 1 / 60);
  assert.equal(s.phase, 'aiming');
  assert.ok(s.misses >= 1);
});

test('方块：命中后破坏并得分', () => {
  const s = createState(0);
  s.phase = 'flying';
  s.ball.active = true;
  s.ball.x = 400;
  s.ball.y = 300;
  s.ball.vx = 0;
  s.ball.vy = 0;
  stepState(s, 1 / 60);
  assert.equal(s.blocks[0].alive, false);
  assert.equal(s.combo, 1);
  assert.ok(s.score >= 100);
});

test('挡板：命中后不破坏，只加分', () => {
  const s = createState(0);
  const bumper = s.blocks.find((b) => b.type === 'bumper');
  assert.ok(bumper, 'level 1 有挡板');
  s.phase = 'flying';
  s.ball.active = true;
  s.ball.x = bumper.x;
  s.ball.y = bumper.y;
  s.ball.vx = 0;
  s.ball.vy = 0;
  stepState(s, 1 / 60);
  assert.equal(bumper.alive, true);
  assert.ok(s.score >= 50);
});

test('清空判定：所有可破坏方块消失即为过关', () => {
  const s = createState(0);
  for (const b of s.blocks) if (b.type !== 'bumper') b.alive = false;
  assert.equal(breakables(s).length, 0);
  assert.equal(isCleared(s), true);
});

test('连击倍率：连续破坏提升倍率', () => {
  const s = createState(0);
  s.phase = 'flying';
  s.ball.active = true;
  // 命中第一块
  s.ball.x = 400; s.ball.y = 300; s.ball.vx = 0; s.ball.vy = 0;
  stepState(s, 1 / 60);
  // 命中第二块
  s.ball.x = 880; s.ball.y = 300; s.ball.vx = 0; s.ball.vy = 0;
  stepState(s, 1 / 60);
  assert.equal(s.combo, 2);
  assert.equal(Math.min(s.combo, 5), 2);
});

test('过关：清空后球落底触发 win 事件', () => {
  const s = createState(0);
  for (const b of s.blocks) if (b.type !== 'bumper') b.alive = false;
  s.phase = 'aiming';
  s.ball.active = false;
  launchBall(s, -Math.PI / 2);
  let guard = 0;
  while (s.phase === 'flying' && guard++ < 4000) stepState(s, 1 / 60);
  assert.equal(s.phase, 'won');
  const evs = drainEvents(s);
  assert.ok(evs.some((e) => e.type === 'win'));
});

test('run 包装：step/drainEvents/getHud 可用', () => {
  const run = createRun(0, { seed: 1 });
  run.step(1 / 60);
  const hud = run.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'aiming');
  assert.equal(hud.score, 0);
  assert.deepEqual(run.drainEvents(), []);
});
