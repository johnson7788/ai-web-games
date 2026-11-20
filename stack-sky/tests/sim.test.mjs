import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, cameraYFor } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';
import { STACK, WORLD } from '../config/gameplay.js';
import { segmentIndex } from '../config/levels.js';

// 白盒辅助：把移动岛摆到 x 并重置上升沿，模拟「按下截停」一次
function place(r, x) {
  r.moving.x = x;
  r._prevDrop = false;
  r.step({ drop: true });
  return r.drainEvents();
}

test('createRun 初始化为 playing / score 0 / 起始宽度', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.score, 0);
  assert.equal(r.top.width, STACK.START_WIDTH);
  assert.equal(r.layers.length, 1);
  assert.equal(r.moving.width, STACK.START_WIDTH);
});

test('step 推进固定步长时间', () => {
  const r = createRun({ seed: 1 });
  r.step({ drop: false });
  assert.ok(Math.abs(r.time - (1 / 60)) < 1e-9);
});

test('移动岛左右往复且不越界', () => {
  const r = createRun({ seed: 1 });
  let moved = false;
  let prev = r.moving.x;
  for (let i = 0; i < 600; i += 1) {
    r.step({ drop: false });
    r.drainEvents();
    assert.ok(r.moving.x >= -1 && r.moving.x <= WORLD.WIDTH + 1, 'moving x 不越界');
    if (Math.abs(r.moving.x - prev) > 1) moved = true;
    prev = r.moving.x;
  }
  assert.ok(moved, '移动岛应该真的在动');
});

test('截停放置：score+1、层数+1', () => {
  const r = createRun({ seed: 1 });
  const ev = place(r, r.top.x);
  assert.equal(r.score, 1);
  assert.equal(r.layers.length, 2);
  assert.ok(ev.some((e) => e.type === 'drop'));
});

test('完美对齐：perfect + combo 递增 + 回宽', () => {
  const r = createRun({ seed: 1 });
  r.moving.x = r.top.x; // 零偏移
  r._prevDrop = false;
  r.step({ drop: true });
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'perfect'));
  assert.equal(r.perfectCombo, 1);
  assert.ok(r.top.width >= STACK.START_WIDTH - 0.001, '完美不应缩窄');
});

test('普通截停：偏移导致裁边变窄', () => {
  const r = createRun({ seed: 1 });
  const before = r.top.width;
  const ev = place(r, r.top.x + 20);
  assert.ok(r.top.width < before, '裁边后应变窄');
  assert.ok(ev.some((e) => e.type === 'cut'));
});

test('完全错失：无重叠 → 判负', () => {
  const r = createRun({ seed: 1 });
  r.moving.x = r.top.x + 400;
  r._prevDrop = false;
  r.step({ drop: true });
  assert.equal(r.phase, 'dead');
  assert.ok(r.drainEvents().some((e) => e.type === 'death'));
});

test('宽度过小 → 判负', () => {
  const r = createRun({ seed: 1 });
  r.top.width = STACK.MIN_WIDTH + 10;
  r.moving.width = STACK.MIN_WIDTH + 10;
  place(r, r.top.x + 20); // 重叠 = (MIN+10) - 20 < MIN → 窄判负
  assert.equal(r.phase, 'dead');
});

test('rising-edge：按住 drop 只截停一次', () => {
  const r = createRun({ seed: 1 });
  r.moving.x = r.top.x;
  r.step({ drop: true });
  r.step({ drop: true }); // 仍按住
  r.drainEvents();
  assert.equal(r.score, 1);
});

test('神龛层对齐恢复初始宽度', () => {
  const r = createRun({ seed: 1 });
  place(r, r.top.x + 30); // 先窄化
  const narrow = r.top.width;
  assert.ok(narrow < STACK.START_WIDTH);
  r.shrineDue = true;
  const ev = place(r, r.top.x);
  assert.ok(ev.some((e) => e.type === 'shrineSuccess'));
  assert.equal(r.top.width, STACK.START_WIDTH);
});

test('风切在接近第 10 层时触发', () => {
  const r = createRun({ seed: 1 });
  r.windTier = 1;
  let sawWind = false;
  for (let i = 0; i < 9; i += 1) {
    const ev = place(r, r.top.x);
    if (ev.some((e) => e.type === 'windGust')) sawWind = true;
  }
  assert.ok(sawWind, '叠到第 9 层时（即将第 10 层）应触发风切');
});

test('风切期间移动岛被吹偏（横漂生效）', () => {
  const r = createRun({ seed: 1 });
  r.moving.dir = 1;
  r.moving.x = 600; // 在摆动范围内、远离边界
  r.windActive = true;
  r.windDrift = 500;
  r.windDir = 1;
  const x0 = r.moving.x;
  r.step({ drop: false });
  r.drainEvents();
  assert.ok(r.moving.x > x0 + 4, '顺风时应明显向右横漂');
});

test('段位随层数推进', () => {
  const r = createRun({ seed: 1 });
  for (let i = 0; i < 10; i += 1) place(r, r.top.x);
  assert.ok(r.segment >= 3, '10 层应到段位 3 以上');
  assert.equal(r.segment, segmentIndex(r.score));
});

test('场景包随段位切换（≥20 层进雷雨层）', () => {
  const r = createRun({ seed: 1 });
  for (let i = 0; i < 20; i += 1) place(r, r.top.x);
  assert.equal(r.scene, 1, '20 层应进入雷雨层');
});

test('getHud 返回 score/width/combo/segment', () => {
  const r = createRun({ seed: 1 });
  const hud = r.getHud();
  assert.equal(hud.height, r.score);
  assert.equal(hud.width, r.top.width);
  assert.equal(hud.segment, r.segment);
  assert.equal(typeof hud.combo, 'number');
});

test('drainEvents 清空事件队列', () => {
  const r = createRun({ seed: 1 });
  const ev = place(r, r.top.x);
  assert.ok(ev.length > 0);
  assert.equal(r.drainEvents().length, 0);
});

test('rng 确定性：同 seed 序列一致', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 10; i += 1) assert.equal(a(), b());
});

test('死亡后 step 不再推进', () => {
  const r = createRun({ seed: 1 });
  r.moving.x = r.top.x + 500;
  r._prevDrop = false;
  r.step({ drop: true });
  r.drainEvents();
  assert.equal(r.phase, 'dead');
  const t = r.time;
  r.step({ drop: false });
  assert.equal(r.time, t);
});

test('cameraYFor：塔高时镜头随塔顶上移', () => {
  const r = createRun({ seed: 1 });
  for (let i = 0; i < 12; i += 1) place(r, r.top.x);
  assert.ok(cameraYFor(r) < 0, '塔够高时镜头应上移');
});
