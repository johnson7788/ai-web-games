import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, kindForNum, mulberry32 } from '../src/game/sim.js';
import { ORBIT } from '../config/game.config.js';

// 直接把旋转球放到下一节点上，模拟「命中窗口内点击」
function forceCapture(run) {
  const s = run.state;
  s.orbiter.x = s.nodes[1].x;
  s.orbiter.y = s.nodes[1].y;
  return run.tap();
}

test('初始状态：8 个节点（1 锚点 + 7 可见目标），phase=playing', () => {
  const run = createRun(1);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.nodes.length, ORBIT.VISIBLE_TARGETS + 1);
  assert.equal(run.state.anchor.x, 0);
  assert.equal(run.state.anchor.y, 0);
  assert.equal(run.state.captures, 0);
});

test('旋转球始终与锚点保持 BALL_DISTANCE 半径', () => {
  const run = createRun(2);
  for (let i = 0; i < 60; i += 1) run.step();
  const { anchor, orbiter } = run.state;
  const d = Math.hypot(orbiter.x - anchor.x, orbiter.y - anchor.y);
  assert.ok(Math.abs(d - ORBIT.BALL_DISTANCE) < 0.001, `半径应为 120，实际 ${d}`);
});

test('step 固定步长：时间每次 +1/60', () => {
  const run = createRun(3);
  run.step();
  run.step();
  assert.equal(run.state.time, 2 / 60);
});

test('命中窗口外点击 → 判负 miss', () => {
  const run = createRun(4);
  const res = run.tap(); // 初始距离 120 > 20
  assert.equal(res.ok, false);
  assert.equal(run.state.phase, 'over');
  assert.equal(run.state.overReason, 'miss');
});

test('noinput：不输入最终因 overshoot 判负（宽限期后自动死亡）', () => {
  const run = createRun(5);
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 60 * 10) {
    run.step();
    guard += 1;
  }
  assert.equal(run.state.phase, 'over');
  assert.equal(run.state.overReason, 'overshoot');
});

test('命中窗口内点击 → 捕获成功，captures+1，节点链前移', () => {
  const run = createRun(6);
  const before = run.state.nodes.length;
  const res = forceCapture(run);
  assert.equal(res.ok, true);
  assert.equal(run.state.captures, 1);
  assert.equal(run.state.nodes.length, before); // shift + addTarget 保持长度
});

test('自然旋转到窗口内也能捕获', () => {
  const run = createRun(7);
  let captured = false;
  for (let i = 0; i < 400; i += 1) {
    run.step();
    if (run.state.phase === 'over') break;
    if (run.nextDistance() < ORBIT.CAPTURE_DIST) {
      const res = run.tap();
      if (res.ok) { captured = true; break; }
    }
  }
  assert.equal(captured, true);
  assert.ok(run.state.captures >= 1);
});

test('连击与得分：普通节点按连击递增，金核+3，岩核清零（确定性序列）', () => {
  const run = createRun(8);
  forceCapture(run); // num1 普通 → +1, combo1
  forceCapture(run); // num2 普通 → +2, combo2
  forceCapture(run); // num3 普通 → +3, combo3
  forceCapture(run); // num4 普通 → +4, combo4
  assert.equal(run.state.score, 10);
  assert.equal(run.state.combo, 4);
  forceCapture(run); // num5 岩核 → +0, combo 清零
  assert.equal(run.state.score, 10);
  assert.equal(run.state.combo, 0);
  forceCapture(run); // num6 普通 → +1
  forceCapture(run); // num7 金核 → +3, combo2
  assert.equal(run.state.score, 14);
  assert.equal(run.state.combo, 2);
});

test('kindForNum：num%7 金核，num%5 岩核，其余普通', () => {
  assert.equal(kindForNum(7), 'golden');
  assert.equal(kindForNum(14), 'golden');
  assert.equal(kindForNum(5), 'rock');
  assert.equal(kindForNum(10), 'rock');
  assert.equal(kindForNum(1), 'normal');
  assert.equal(kindForNum(6), 'normal');
});

test('升级：每 5 次捕获升一级，并发出 levelUp 事件', () => {
  const run = createRun(9);
  for (let i = 0; i < 5; i += 1) forceCapture(run);
  assert.equal(run.state.level, 2);
  const types = run.drainEvents().map((e) => e.type);
  assert.ok(types.includes('levelUp'), '应包含 levelUp 事件');
});

test('狂热：第 8 次捕获触发 frenzyStart', () => {
  const run = createRun(10);
  for (let i = 0; i < 8; i += 1) forceCapture(run);
  assert.ok(run.state.frenzyUntil > run.state.time);
  const types = run.drainEvents().map((e) => e.type);
  assert.ok(types.includes('frenzyStart'));
});

test('drainEvents 消费后清空，且事件类型用字符串 type 字段', () => {
  const run = createRun(11);
  forceCapture(run);
  const evs = run.drainEvents();
  assert.ok(evs.length > 0);
  assert.equal(typeof evs[0].type, 'string');
  assert.equal(run.drainEvents().length, 0);
});

test('相机跟随锚点：多帧后 camX/camY 逼近锚点', () => {
  const run = createRun(12);
  run.state.anchor.x = 500;
  run.state.anchor.y = 300;
  for (let i = 0; i < 300; i += 1) run.step();
  assert.ok(Math.abs(run.state.camX - 500) < 30, `camX 应逼近锚点，实际 ${run.state.camX}`);
});

test('mulberry32 种子确定性：同种子同序列', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('getHud 返回分数/连击/等级/时间', () => {
  const run = createRun(13);
  const h = run.getHud();
  assert.equal(h.score, 0);
  assert.equal(h.level, 1);
  assert.equal(h.combo, 0);
  assert.equal(typeof h.time, 'number');
});
