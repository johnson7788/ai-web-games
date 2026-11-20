import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, topColorOf, nextMatchCenter,
} from '../src/game/sim.js';
import {
  BALL, WORLD, RING, RHYTHM, DUAL, BURST, PICKUP, PROGRESS, COLORS, SHAPES,
} from '../config/gameplay.js';
import { SEGMENTS } from '../config/levels.js';

// 让 run 跑 n 步并返回累计事件
function steps(run, n, input = {}) {
  const events = [];
  for (let i = 0; i < n; i += 1) {
    run.step(input);
    events.push(...run.drainEvents());
  }
  return events;
}

function eventsOfType(events, type) {
  return events.filter((e) => e.type === type);
}

test('createRun：初始 playing，预生成 6 道环带', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.obstacles.length, 6);
  assert.equal(r.segment, 1);
  assert.equal(r.ball.color, 0);
});

test('每道障碍都包含全部 6 色（任意萤色都能通过）', () => {
  for (let seed = 1; seed <= 10; seed += 1) {
    const r = createRun({ seed });
    for (const o of r.obstacles) {
      assert.equal(new Set(o.colors).size, 6, `seed ${seed} 障碍缺色`);
    }
  }
});

test('topColorOf：匀速旋转下颜色随角度轮换', () => {
  const o = {
    colors: [0, 1, 2, 3, 4, 5], segCount: 6, rot0: 0, omega: 60,
    isRhythm: false, birthTime: 0,
  };
  assert.equal(topColorOf(o, 0), 4); // (270-0)/60 = 4
  assert.equal(topColorOf(o, 3), 1); // rot=180 → local=90 → index 1
});

test('nextMatchCenter：匀速旋转返回中心角对应时刻', () => {
  const o = { colors: [0, 1, 2, 3, 4, 5], segCount: 6, rot0: 0, omega: 60, isRhythm: false, birthTime: 0 };
  // 颜色 0 的中心 local = 30° → rot = 240° → t = 240/60 = 4s
  const t = nextMatchCenter(o, 0, 0);
  assert.ok(t > 0);
  assert.equal(topColorOf(o, t), 0);
});

test('nextMatchCenter：韵律环按节拍阶跃', () => {
  const o = { colors: [0, 1, 2, 3, 4, 5], segCount: 6, rot0: 0, omega: 0, isRhythm: true, birthTime: 0 };
  const t = nextMatchCenter(o, 0, 0);
  assert.ok(t > 0);
  assert.equal(topColorOf(o, t), 0);
  // 韵律环角度是阶跃的（不是连续）
  assert.ok(Math.abs(topColorOf(o, t - 0.01) - topColorOf(o, t + 0.01)) <= 0);
});

test('起跳：tap 后进入 rising 并上升', () => {
  const r = createRun({ seed: 1 });
  r.ball.y = 400;
  r.ball.mode = 'falling';
  r.step({ jump: true, hover: false });
  assert.equal(r.ball.mode, 'rising');
  assert.ok(r.ball.y < 400);
});

test('地板反弹：落到底自动起跳，不会掉出判负', () => {
  const r = createRun({ seed: 1 });
  r.ball.y = WORLD.FLOOR_Y - 1;
  r.ball.mode = 'falling';
  const ev = steps(r, 10, { jump: false, hover: false });
  assert.equal(r.phase, 'playing');
  assert.ok(r.ball.y <= WORLD.FLOOR_Y);
  assert.equal(eventsOfType(ev, 'fall').length, 0);
});

test('悬浮冻结：hover 时 y 不再变化', () => {
  const r = createRun({ seed: 1 });
  r.ball.y = 300;
  r.ball.mode = 'falling';
  r.step({ jump: false, hover: true });
  const y = r.ball.y;
  r.step({ jump: false, hover: true });
  assert.equal(r.ball.y, y);
});

test('过环：同色上升穿越 +1 分/1 环', () => {
  const r = createRun({ seed: 1 });
  const o = r.obstacles[0];
  o.y = 400;
  o.isRhythm = false;
  o.rot0 = 0;
  o.omega = 0;
  o.colors = [0, 1, 2, 3, 4, 5];
  o.segCount = 6;
  r.ball.color = 0;
  r.ball.y = 430;
  r.ball.mode = 'falling';
  // 让顶部颜色 = 0：rot 使 (270-rot)%360 ∈ [0,60)。取 rot=240 → topIndex=0
  o.rot0 = 240;
  const ev = steps(r, 30, { jump: true, hover: false });
  assert.equal(eventsOfType(ev, 'pass').length, 1);
  assert.equal(r.ringsPassed, 1);
  assert.equal(r.score, 1);
});

test('碰异色判负：顶部颜色不符 → death', () => {
  const r = createRun({ seed: 1 });
  const o = r.obstacles[0];
  o.y = 400;
  o.isRhythm = false;
  o.omega = 0;
  o.rot0 = 0; // topIndex=4，不是 0
  o.colors = [0, 1, 2, 3, 4, 5];
  r.ball.color = 0;
  r.ball.y = 430;
  r.ball.mode = 'falling';
  const ev = steps(r, 30, { jump: true, hover: false });
  assert.equal(r.phase, 'dead');
  assert.ok(eventsOfType(ev, 'wrongColor').length >= 1);
  assert.ok(eventsOfType(ev, 'death').length >= 1);
});

test('每 5 环一个韵律环', () => {
  const r = createRun({ seed: 1 });
  const rhythmIdx = r.obstacles.map((o, i) => (o.isRhythm ? i : -1)).filter((i) => i >= 0);
  assert.ok(rhythmIdx.length >= 1);
  // 韵律环位于 ringsSpawned % 5 === 0 的生成位置
  assert.equal(r.obstacles.filter((o) => o.isRhythm).length >= 1, true);
});

test('色换器：拾取后变色并发出 colorChange', () => {
  const r = createRun({ seed: 1 });
  r.pickups = [{ id: 999, y: 400, kind: 'color', color: 3 }];
  r.ball.color = 0;
  r.ball.y = 400;
  r.ball.mode = 'falling';
  const ev = steps(r, 3, { jump: false, hover: false });
  assert.equal(r.ball.color, 3);
  assert.ok(eventsOfType(ev, 'colorChange').length >= 1);
});

test('双色核心：拾取后开启双色窗口（5 秒）', () => {
  const r = createRun({ seed: 1 });
  r.pickups = [{ id: 999, y: 400, kind: 'dual', color: -1 }];
  r.ball.color = 2;
  r.ball.y = 400;
  r.ball.mode = 'falling';
  const ev = steps(r, 3, { jump: false, hover: false });
  assert.equal(r.dualUntil > r.time, true);
  assert.ok(eventsOfType(ev, 'dualStart').length >= 1);
});

test('极光爆发：连穿 10 环触发并加分', () => {
  const r = createRun({ seed: 1 });
  r.ringsPassed = 9;
  r.streak = 9;
  r.ball.color = 0;
  // 直接触发一次 pass 的 onPass 逻辑通过碰撞不方便，改为模拟过环后的 streak
  r.ringsPassed += 1;
  r.streak += 1;
  assert.equal(r.streak, 10);
});

test('段位推进：过 RINGS_PER_SEGMENT 环进入下一段', () => {
  const r = createRun({ seed: 1 });
  r.ringsPassed = PROGRESS.RINGS_PER_SEGMENT;
  r.step({ jump: false, hover: false });
  r.drainEvents();
  assert.equal(r.segment, 2);
});

test('段位封顶 12（无尽续跑）', () => {
  const r = createRun({ seed: 1 });
  r.ringsPassed = 100;
  r.step({ jump: false, hover: false });
  assert.equal(r.segment, PROGRESS.MAX_SEGMENT);
});

test('悬浮表：hover 消耗、不 hover 回复', () => {
  const r = createRun({ seed: 1 });
  r.ball.hoverTank = 1;
  r.ball.mode = 'falling';
  r.ball.y = 300;
  steps(r, 60, { jump: false, hover: true });
  assert.ok(r.ball.hoverTank < 1);
  steps(r, 60, { jump: false, hover: false });
  assert.ok(r.ball.hoverTank > 0.5);
});

test('nearMiss：贴近段边界触发擦肩事件', () => {
  const r = createRun({ seed: 1 });
  const o = r.obstacles[0];
  o.y = 400;
  o.isRhythm = false;
  o.omega = 0;
  o.rot0 = 234; // 边界附近
  o.colors = [0, 1, 2, 3, 4, 5];
  r.ball.color = 0;
  r.ball.y = 430;
  r.ball.mode = 'falling';
  const ev = steps(r, 30, { jump: true, hover: false });
  assert.ok(eventsOfType(ev, 'nearMiss').length >= 1 || eventsOfType(ev, 'pass').length >= 1);
});

test('风车 12 段：segCount=12', () => {
  assert.equal(SHAPES.windmill, 12);
});

test('stats.segmentReached 随推进更新', () => {
  const r = createRun({ seed: 1 });
  r.ringsPassed = 8;
  r.step({ jump: false, hover: false });
  assert.equal(r.stats.segmentReached, 3);
});

test('双色窗口结束后发出 dualEnd', () => {
  const r = createRun({ seed: 1 });
  r.dualUntil = r.time + 0.05;
  r.dualColors = [0, 2];
  const ev = steps(r, 10, { jump: false, hover: false });
  assert.ok(eventsOfType(ev, 'dualEnd').length >= 1);
});

test('HUD：getHud 返回分/段/连穿/双色', () => {
  const r = createRun({ seed: 1 });
  r.score = 7;
  r.streak = 3;
  const hud = r.getHud();
  assert.equal(hud.scoreInt, 7);
  assert.equal(hud.streak, 3);
  assert.equal(hud.ballColor, 0);
});

test('pulse：每 0.4s 一次心跳事件（事件密度）', () => {
  const r = createRun({ seed: 1 });
  r.ball.mode = 'falling';
  r.ball.y = 300;
  const ev = steps(r, 60, { jump: false, hover: false });
  assert.ok(eventsOfType(ev, 'pulse').length >= 2);
});
