import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { STEP, KART } from '../config/gameplay.js';

test('createRun：6 车手（1 玩家 + 5 AI），phase 为 racing', () => {
  const run = createRun({ seed: 1, station: 7 });
  assert.equal(run.karts.length, KART.COUNT);
  assert.equal(run.player.isPlayer, true);
  assert.equal(run.phase, 'racing');
});

test('step 推进时间一个固定步长', () => {
  const run = createRun({ seed: 1, station: 7 });
  run.step({});
  assert.ok(Math.abs(run.time - STEP) < 1e-9);
});

test('满油门比无油门更快加速到更高速度', () => {
  const fast = createRun({ seed: 1, station: 7 });
  const slow = createRun({ seed: 1, station: 7 });
  for (let i = 0; i < 120; i += 1) {
    fast.step({ throttle: 1, steer: 0 });
    slow.step({ throttle: 0, steer: 0 });
  }
  assert.ok(fast.player.speed > slow.player.speed, '满油门应更快');
});

test('无障碍兜底：noinput 也会前进', () => {
  const run = createRun({ seed: 1, station: 7 });
  for (let i = 0; i < 120; i += 1) run.step({});
  assert.ok(run.player.totalProgress > 0, '不输入也应自动前进');
});

test('noinput 在弯道会冲出赛道并撞栏（deaths>0）', () => {
  const run = createRun({ seed: 789, station: 7 });
  for (let i = 0; i < 60 * 60 && run.phase === 'racing'; i += 1) run.step({});
  assert.ok(run.stats.deaths >= 1, 'noinput 应至少撞栏一次');
});

test('按住漂移会蓄力', () => {
  const run = createRun({ seed: 1, station: 7 });
  for (let i = 0; i < 30; i += 1) run.step({ throttle: 0, steer: 0, drift: true });
  assert.ok(run.player.driftCharge > 0, '蓄力应 > 0');
});

test('松开满蓄漂移会释放糖霜加速（boost 事件）', () => {
  const run = createRun({ seed: 1, station: 7 });
  for (let i = 0; i < 120; i += 1) run.step({ throttle: 0, steer: 0, drift: true });
  run.step({ throttle: 0, steer: 0, drift: false });
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'boost'), '应发出 boost 事件');
});

test('过圈：totalProgress 超过一圈时 lap+1', () => {
  const run = createRun({ seed: 1, station: 7 });
  const L = run.track.length;
  run.player.totalProgress = L - 1;
  run.player.progress = L - 1;
  run.player.speed = 600;
  run.step({ throttle: 1, steer: 0 });
  const evs = run.drainEvents();
  assert.equal(run.player.lap, 1);
  assert.ok(evs.some((e) => e.type === 'lap'));
});

test('道具箱拾取会赋予道具', () => {
  const run = createRun({ seed: 1, station: 7 });
  run.player.totalProgress = run.player.nextBoxAt - 1;
  run.player.progress = run.player.totalProgress % run.track.length;
  run.player.speed = 600;
  run.step({ throttle: 1, steer: 0 });
  assert.ok(run.player.item, '应拾取到道具');
});

test('导弹命中前车使其减速', () => {
  const run = createRun({ seed: 1, station: 7 });
  const ahead = run.karts[1];
  run.player.item = 'missile';
  run.step({ throttle: 0, steer: 0, item: true });
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'missileHit'));
  assert.ok(ahead.slowUntil > run.time, '前车应被减速');
});

test('护盾可挡下导弹', () => {
  const run = createRun({ seed: 1, station: 7 });
  const ahead = run.karts[1];
  ahead.shieldUntil = run.time + 5;
  run.player.item = 'missile';
  run.step({ throttle: 0, steer: 0, item: true });
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'shieldBlock'));
});

test('蛋糕糊住前车（blindUntil 延长）', () => {
  const run = createRun({ seed: 1, station: 7 });
  const ahead = run.karts[1];
  run.player.item = 'cake';
  run.step({ throttle: 0, steer: 0, item: true });
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'cakeBlind'));
  assert.ok(ahead.blindUntil > run.time, '前车应被糊屏');
});

test('撞栏（lane 冲出太多）计入 deaths', () => {
  const run = createRun({ seed: 1, station: 7 });
  run.player.lane = 100;
  run.player.speed = 60;
  run.step({ throttle: 1, steer: 0 });
  assert.equal(run.stats.deaths, 1);
});

test('名次按推进排序', () => {
  const run = createRun({ seed: 1, station: 7 });
  run.karts[0].totalProgress = 500;
  run.karts[1].totalProgress = 1000;
  run.karts[2].totalProgress = 300;
  run.step({});
  assert.equal(run.karts[1].rank, 1);
  assert.equal(run.karts[0].rank, 2);
});

test('完成全部圈数后 phase 变 finished', () => {
  const run = createRun({ seed: 1, station: 1 });
  const L = run.track.length;
  run.player.totalProgress = 2 * L - 1;
  run.player.progress = run.player.totalProgress % L;
  run.player.speed = 600;
  run.step({ throttle: 1, steer: 0 });
  assert.equal(run.phase, 'finished');
});

test('greedy 策略可完成 3 圈（站 7）且名次第 1、0 死亡', () => {
  const run = createRun({ seed: 123, station: 7 });
  for (let t = 0; t < 60 * 240 && run.phase === 'racing'; t += 1) {
    const s = run.track.sampleAt(run.player.progress);
    const look = run.track.sampleAt((run.player.progress + Math.max(60, run.player.speed * 0.9)) % run.track.length);
    const inside = -Math.sign(look.curvature) * 0.12 * s.halfWidth;
    const err = inside - run.player.lane;
    const steer = Math.max(-1, Math.min(1, err * 0.14));
    const sharp = Math.abs(look.curvature) > 0.0015;
    run.step({ throttle: 1, steer, drift: sharp });
  }
  assert.equal(run.phase, 'finished');
  assert.equal(run.player.lap, 3);
  assert.equal(run.player.rank, 1);
  assert.equal(run.stats.deaths, 0);
});

test('drainEvents 会清空事件队列', () => {
  const run = createRun({ seed: 1, station: 7 });
  run.step({ throttle: 1, steer: 0 });
  const first = run.drainEvents();
  assert.ok(first.length > 0);
  assert.equal(run.events.length, 0);
});

test('getHud 返回完整 HUD 字段', () => {
  const run = createRun({ seed: 1, station: 7 });
  const hud = run.getHud();
  for (const k of ['lap', 'totalLaps', 'pos', 'speed', 'driftCharge', 'item', 'scene', 'station', 'blind']) {
    assert.ok(k in hud, `缺 ${k}`);
  }
});

test('同 seed 结果可复现', () => {
  const a = createRun({ seed: 42, station: 7 });
  const b = createRun({ seed: 42, station: 7 });
  for (let i = 0; i < 60; i += 1) {
    a.step({ throttle: 1, steer: 0.5 });
    b.step({ throttle: 1, steer: 0.5 });
  }
  assert.equal(a.player.totalProgress, b.player.totalProgress);
  assert.equal(a.player.lane, b.player.lane);
});
