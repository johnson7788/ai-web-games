// MERGE BASKETBALL · sim 纯逻辑测试（node --test）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, ballSize, rankFor, starsFor, mulberry32 } from '../src/game/sim.js';
import { GAME, DROP_VALUES } from '../config/game.config.js';

test('ballSize 公式符合 (log2(v)-1)*12+30', () => {
  assert.equal(ballSize(2), 30);
  assert.equal(ballSize(4), 42);
  assert.equal(ballSize(1024), 138);
});

test('rankFor 映射最大球到 1-6 档', () => {
  assert.equal(rankFor(2), 1);
  assert.equal(rankFor(8), 3);
  assert.equal(rankFor(1024), 6);
  assert.equal(rankFor(2048), 6);
});

test('starsFor 按最大球给星', () => {
  assert.equal(starsFor(2), 1);
  assert.equal(starsFor(256), 2);
  assert.equal(starsFor(1024), 3);
});

test('createRun 初始状态正确', () => {
  const run = createRun(1);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.won, false);
  assert.equal(run.state.nextValue, 2);
  assert.equal(run.state.nextKind, 'ball');
  assert.equal(run.state.score, 0);
  assert.equal(run.state.balls.length, 0);
  assert.deepEqual(run.drainEvents().map((e) => e.type), ['start']);
});

test('drop 落下后生成一个球并刷新下一球', () => {
  const run = createRun(2);
  const res = run.drop(100);
  assert.equal(res.ok, true);
  assert.equal(run.state.balls.length, 1);
  assert.equal(run.state.inFlight, 1);
  assert.ok(DROP_VALUES.includes(run.state.nextValue));
  const events = run.drainEvents().map((e) => e.type);
  assert.ok(events.includes('drop'));
});

test('DROP_MAX 在途球上限限制连续落球', () => {
  const run = createRun(3);
  assert.equal(run.drop(80).ok, true);
  for (let i = 0; i < 20; i += 1) run.step(1 / 60); // 满足 0.3s 间隔，球仍在空中
  assert.equal(run.drop(120).ok, true);
  for (let i = 0; i < 20; i += 1) run.step(1 / 60);
  assert.equal(run.drop(160).ok, false); // 第 3 颗被在途上限拦截
});

test('step 施加重力使球下坠', () => {
  const run = createRun(4);
  run.drop(180);
  const before = run.state.balls[0].y;
  run.step(1 / 60);
  run.step(1 / 60);
  assert.ok(run.state.balls[0].y > before);
});

test('同数值球碰撞合成翻倍并加分', () => {
  const run = createRun(5);
  run.debug.spawnBall(2, 100, 300);
  run.debug.spawnBall(2, 100, 300);
  run.step(1 / 60);
  const balls = run.state.balls;
  assert.equal(balls.length, 1);
  assert.equal(balls[0].value, 4);
  assert.equal(run.state.score, 4);
  const types = run.drainEvents().map((e) => e.type);
  assert.ok(types.includes('merge'));
  assert.ok(types.includes('grow'));
});

test('不同数值球碰撞不合成', () => {
  const run = createRun(6);
  run.debug.spawnBall(2, 100, 300);
  run.debug.spawnBall(4, 100, 300);
  run.step(1 / 60);
  assert.equal(run.state.balls.length, 2);
});

test('岩石球不合成', () => {
  const run = createRun(7);
  run.debug.spawnRock(100, 300);
  run.debug.spawnRock(100, 300);
  run.step(1 / 60);
  assert.equal(run.state.balls.length, 2);
});

test('合成到 1024 触发 win', () => {
  const run = createRun(8);
  run.debug.spawnBall(512, 100, 300);
  run.debug.spawnBall(512, 100, 300);
  run.step(1 / 60);
  assert.equal(run.state.won, true);
  assert.equal(run.state.biggest, 1024);
  const events = run.drainEvents().map((e) => e.type);
  assert.ok(events.includes('win'));
});

test('球顶越过危险线并停留判负', () => {
  const run = createRun(9);
  run.debug.spawnBall(2, 100, -100);
  run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  const events = run.drainEvents().map((e) => e.type);
  assert.ok(events.includes('lose'));
});

test('自动落球在超时后触发', () => {
  const run = createRun(10);
  run.state.autoDropTimer = GAME.AUTO_DROP_SEC;
  run.step(1 / 60);
  assert.equal(run.state.balls.length, 1);
  const events = run.drainEvents().map((e) => e.type);
  assert.ok(events.includes('autoDrop'));
});

test('连击窗口内连续合成递增 combo', () => {
  const run = createRun(11);
  run.debug.spawnBall(2, 100, 300);
  run.debug.spawnBall(2, 100, 300);
  run.step(1 / 60); // 合成出 4，combo=1
  run.debug.spawnBall(4, 140, 300);
  run.debug.spawnBall(4, 140, 300);
  run.step(1 / 60); // 窗口内再合成 8，combo=2
  assert.equal(run.state.combo, 2);
  assert.equal(run.state.score >= 12, true); // 4 + (8 + 8) 加分
});

test('相同 seed 结果确定', () => {
  const a = createRun(42);
  const b = createRun(42);
  const seq = (run) => {
    run.drop(100);
    const v1 = run.state.nextValue;
    const k1 = run.state.nextKind;
    run.step(1 / 60);
    return `${v1}:${k1}`;
  };
  assert.equal(seq(a), seq(b));
});

test('mulberry32 是确定性 PRNG', () => {
  const r1 = mulberry32(7);
  const r2 = mulberry32(7);
  for (let i = 0; i < 100; i += 1) assert.equal(r1(), r2());
});
