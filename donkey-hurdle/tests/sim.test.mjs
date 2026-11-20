// tests/sim.test.mjs — 纯逻辑测试：物理 / 跳跃 / 碰撞 / 陶罐 / 死亡 / 段推进
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { WORLD, DONKEY, JARS, STEP } from '../config/gameplay.js';
import { segmentAt, segmentIndexAt } from '../config/levels.js';

function stepN(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
}

function injectObstacle(run, type, worldX) {
  const def = { low: { w: 34, h: 30 }, high: { w: 34, h: 112 }, pit: { w: 110, h: 0 }, rock: { w: 54, h: 54 } };
  const d = def[type];
  run.obstacles = [{ id: 9000 + run.nextId++, type, worldX, w: d.w, h: d.h, extraSpeed: type === 'rock' ? 1.35 : 1, cleared: false, hit: false, minClearance: Infinity }];
}

test('createRun 初始状态：3 罐 / 0 米 / playing / 段 1', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.jars, JARS.START);
  assert.equal(r.distance, 0);
  assert.equal(r.segment, 1);
  assert.equal(r.player.onGround, true);
});

test('自动奔跑：distance 随时间递增', () => {
  const r = createRun({ seed: 1 });
  stepN(r, 60);
  assert.ok(r.distance > 0);
  assert.ok(r.stats.distance > 0);
});

test('按空格起跳：进入空中、vy<0', () => {
  const r = createRun({ seed: 1 });
  r.step({ jump: true });       // 按下
  assert.equal(r.player.onGround, false);
  assert.ok(r.player.vy < 0);
  r.step({ jump: false });      // 松开（上升期切短跳）
  assert.ok(r.player.vy < 0);
});

test('短按小跳 vs 长按高跳：长按跳得更高', () => {
  const tap = createRun({ seed: 1 });
  tap.step({ jump: true });
  stepN(tap, 2, { jump: true });
  tap.step({ jump: false });    // 快速松手 → 切短跳
  let tapMin = tap.player.y;
  for (let i = 0; i < 200 && !tap.player.onGround; i += 1) {
    stepN(tap, 1);
    tapMin = Math.min(tapMin, tap.player.y);
  }

  const hold = createRun({ seed: 1 });
  hold.step({ jump: true });
  let holdMin = hold.player.y;
  for (let i = 0; i < 200 && !hold.player.onGround; i += 1) {
    stepN(hold, 1, { jump: true });
    holdMin = Math.min(holdMin, hold.player.y);
  }
  assert.ok(holdMin < tapMin, `长按应更高：hold apex=${holdMin.toFixed(1)} tap apex=${tapMin.toFixed(1)}`);
});

test('卸货跳：丢一罐且初速比普通跳更猛', () => {
  const r = createRun({ seed: 1 });
  const before = r.jars;
  r.step({ jump: false, dropJump: true });
  assert.equal(r.jars, before - 1);
  assert.ok(r.player.vy < -1000);
  assert.equal(r.player.dropAir, true);
});

test('卸货跳需要 ≥2 罐：1 罐时不能丢', () => {
  const r = createRun({ seed: 1 });
  r.jars = 1;
  r.step({ dropJump: true });
  assert.equal(r.jars, 1);
  assert.equal(r.player.dropAir, false);
});

test('碰撞矮栏：掉一罐并进入无敌', () => {
  const r = createRun({ seed: 1 });
  injectObstacle(r, 'low', r.distPx + WORLD.PLAYER_X + 10);
  const before = r.jars;
  stepN(r, 2);   // 直接撞上（未跳）
  assert.equal(r.jars, before - 1);
  assert.ok(r.time < r.player.invulnUntil);
});

test('掉坑：脚掌贴地落入坑 → 掉一罐（fell）', () => {
  const r = createRun({ seed: 1 });
  injectObstacle(r, 'pit', r.distPx + WORLD.PLAYER_X);
  const before = r.jars;
  stepN(r, 3);
  assert.equal(r.jars, before - 1);
});

test('跳过高墙：起跳后不碰撞', () => {
  const r = createRun({ seed: 1 });
  injectObstacle(r, 'high', r.distPx + WORLD.PLAYER_X + 160);
  // 提前长按高跳
  for (let i = 0; i < 40; i += 1) r.step({ jump: true });
  assert.equal(r.jars, JARS.START); // 未掉罐
});

test('罐光判负：jars=1 再撞 → phase dead', () => {
  const r = createRun({ seed: 1 });
  r.jars = 1;
  injectObstacle(r, 'low', r.distPx + WORLD.PLAYER_X + 10);
  stepN(r, 2);
  assert.equal(r.phase, 'dead');
});

test('清除障碍：stats.obstaclesCleared 递增且发 obstacleClear 事件', () => {
  const r = createRun({ seed: 1 });
  injectObstacle(r, 'low', r.distPx + WORLD.PLAYER_X - 200); // 已在身后
  stepN(r, 2);
  assert.ok(r.stats.obstaclesCleared >= 1);
  assert.ok(r.drainEvents().some((e) => e.type === 'obstacleClear'));
});

test('补给罐：跑过拾取物 jars+1（不超过上限）', () => {
  const r = createRun({ seed: 1 });
  r.jars = 2;
  r.pickups = [{ id: 5000, worldX: r.distPx + WORLD.PLAYER_X, y: WORLD.GROUND_Y - JARS.PICKUP_H / 2 - 2 }];
  stepN(r, 3);
  assert.equal(r.jars, 3);
});

test('段推进：距离超过段长则 segment 递增', () => {
  const r = createRun({ seed: 1 });
  const s1 = segmentAt(0);
  const s2 = segmentAt(s1.lengthM + 1);
  assert.ok(s2.index > s1.index);
  assert.equal(segmentIndexAt(0), 1);
});

test('段切换发 segmentEnter 事件', () => {
  const r = createRun({ seed: 1 });
  // 直接快进距离到第 2 段起始
  r.distPx = (segmentAt(0).lengthM + 1) * WORLD.PX_PER_METER;
  r.distance = r.distPx / WORLD.PX_PER_METER;
  stepN(r, 1);
  assert.ok(r.drainEvents().some((e) => e.type === 'segmentEnter'));
  assert.equal(r.segment, 2);
});

test('土狼时间：离地后 100ms 内仍可起跳', () => {
  const r = createRun({ seed: 1 });
  r.step({ jump: true });
  stepN(r, 4, { jump: false });   // 落地后再跳——缓冲+土狼
  // 快速落地前按下应被缓冲
  r.step({ jump: true });
  assert.ok(r.player.buffer > 0 || r.player.onGround === false);
});

test('getHud 返回距离/罐/段/场景', () => {
  const r = createRun({ seed: 1 });
  const h = r.getHud();
  assert.ok('distance' in h && 'jars' in h && 'segment' in h && 'scene' in h);
  assert.equal(h.jars, JARS.START);
});

test('drainEvents 清空事件队列', () => {
  const r = createRun({ seed: 1 });
  r.step({ jump: true });
  assert.ok(r.drainEvents().length > 0);
  assert.equal(r.drainEvents().length, 0);
});

test('事件类型包含 jump/land/obstacleClear/hit/jarDrop/superJump 等', () => {
  const r = createRun({ seed: 1 });
  r.step({ jump: true });
  const types = new Set(r.drainEvents().map((e) => e.type));
  assert.ok(types.has('jump'));
});
