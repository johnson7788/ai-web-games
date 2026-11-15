import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSim, updateSim, getHud, drainEvents, ratingFor, gateCenterY,
} from '../src/game/sim.js';
import { TUNNEL, SHIP, SCORE } from '../config/game.config.js';

function gate(over = {}) {
  return { x: 0, gapY: 0, gapH: 3, level: 1, phase: 0, kind: 'ring', passed: false, ...over };
}

test('初始状态：playing / 盾 1 / 倍率 1 / 距离 0', () => {
  const r = createSim({ seed: 1 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.shield, SCORE.shieldMax);
  assert.equal(r.mult, 1);
  assert.equal(r.dist, 0);
});

test('按住上升：vy 变正、y 上升', () => {
  const r = createSim({ seed: 2 });
  for (let i = 0; i < 30; i++) updateSim(r, { hold: true });
  assert.ok(r.vy > 0, 'vy 应为正');
  assert.ok(r.y > 0, 'y 应上升');
});

test('松开下落：从高处释放后 vy 变负', () => {
  const r = createSim({ seed: 3 });
  r.y = 5; r.vy = 0;
  updateSim(r, { hold: false });
  assert.ok(r.vy < 0, 'vy 应为负');
});

test('垂直位置被夹在隧道范围内', () => {
  const r = createSim({ seed: 4 });
  r.y = TUNNEL.range - 0.1; r.vy = SHIP.vmax;
  for (let i = 0; i < 60; i++) updateSim(r, { hold: true });
  assert.ok(r.y <= TUNNEL.range + 1e-9);
  r.y = -TUNNEL.range + 0.1; r.vy = -SHIP.vmax;
  for (let i = 0; i < 60; i++) updateSim(r, { hold: false });
  assert.ok(r.y >= -TUNNEL.range - 1e-9);
});

test('距离持续推进、分数随距离增长', () => {
  const r = createSim({ seed: 5 });
  updateSim(r, { hold: false });
  assert.ok(r.dist > 0);
  assert.ok(r.score > 0);
});

test('首次输入打点 first_input 事件', () => {
  const r = createSim({ seed: 6 });
  updateSim(r, { hold: true });
  const evs = drainEvents(r);
  assert.ok(evs.some((e) => e.type === 'first_input'));
});

test('前进速度随里程爬升', () => {
  const a = createSim({ seed: 7 });
  const b = createSim({ seed: 8 });
  b.dist = 2000;
  updateSim(a, { hold: false });
  updateSim(b, { hold: false });
  assert.ok(b.speed > a.speed);
});

test('会向前生成障碍（门）', () => {
  const r = createSim({ seed: 9 });
  for (let i = 0; i < 60 * 5; i++) updateSim(r, { hold: false });
  assert.ok(r.obstacles.length > 0);
});

test('完美穿越：连击 +1、加分、发 perfect 事件', () => {
  const r = createSim({ seed: 10 });
  r.obstacles = [gate({ x: r.dist, gapY: 0, gapH: 3 })];
  r.y = 0;
  updateSim(r, { hold: false });
  const evs = drainEvents(r);
  assert.equal(r.combo, 1);
  assert.equal(r.mult, 1);
  assert.ok(evs.some((e) => e.type === 'perfect'));
  assert.ok(r.score >= SCORE.perfect);
});

test('普通穿越（非中心）断开连击链', () => {
  const r = createSim({ seed: 11 });
  r.combo = 3; r.mult = 3;
  r.obstacles = [gate({ x: r.dist, gapY: 0, gapH: 3 })];
  r.y = 2; // 中心偏移 2m，非完美但非碰撞
  updateSim(r, { hold: false });
  const evs = drainEvents(r);
  assert.equal(r.combo, 0);
  assert.equal(r.mult, 1);
  assert.ok(evs.some((e) => e.type === 'pass'));
});

test('无护盾碰撞：死亡 + fail 事件', () => {
  const r = createSim({ seed: 12 });
  r.shield = 0;
  r.obstacles = [gate({ x: r.dist, gapY: 5, gapH: 0.5 })];
  r.y = 0;
  updateSim(r, { hold: false });
  assert.equal(r.phase, 'dead');
  assert.ok(r.events.some((e) => e.type === 'fail') || drainEvents(r).some((e) => e.type === 'fail'));
});

test('护盾挡一次碰撞：不死、盾归零、发 shield 事件', () => {
  const r = createSim({ seed: 13 });
  r.obstacles = [gate({ x: r.dist, gapY: 5, gapH: 0.5 })];
  r.y = 0;
  updateSim(r, { hold: false });
  const evs = drainEvents(r);
  assert.equal(r.phase, 'playing');
  assert.equal(r.shield, 0);
  assert.ok(evs.some((e) => e.type === 'shield'));
});

test('能量球回充护盾', () => {
  const r = createSim({ seed: 14 });
  r.shield = 0;
  r.orbs = [{ x: r.dist, y: 0, taken: false }];
  r.y = 0;
  updateSim(r, { hold: false });
  assert.equal(r.shield, 1);
});

test('每 500m 切换段：level 递增 + segment 事件', () => {
  const r = createSim({ seed: 15 });
  r.dist = 499.9;
  updateSim(r, { hold: false });
  const evs = drainEvents(r);
  assert.equal(r.level, 2);
  assert.ok(evs.some((e) => e.type === 'segment' && e.level === 2));
});

test('倍率上限为 ×8', () => {
  const r = createSim({ seed: 16 });
  r.combo = 100;
  r.obstacles = [gate({ x: r.dist, gapY: 0, gapH: 3 })];
  r.y = 0;
  updateSim(r, { hold: false });
  assert.equal(r.mult, SCORE.multMax);
});

test('seed 回归：同 seed 生成相同的第一道缝隙中心', () => {
  const a = createSim({ seed: 42 });
  const b = createSim({ seed: 42 });
  for (let i = 0; i < 20; i++) { updateSim(a, { hold: false }); updateSim(b, { hold: false }); }
  assert.equal(a.obstacles[0].gapY, b.obstacles[0].gapY);
  assert.equal(a.obstacles[0].gapH, b.obstacles[0].gapH);
});

test('移动柱缝隙中心随时间摆动', () => {
  const g = gate({ kind: 'moving', level: 2, gapY: 0, phase: 0 });
  const c1 = gateCenterY(g, 0.1);
  const c2 = gateCenterY(g, 1.0);
  assert.notEqual(c1, c2);
});

test('极限窄缝完美穿越触发慢动作', () => {
  const r = createSim({ seed: 17 });
  r.dist = 2000; r.level = 5;
  r.obstacles = [gate({ x: r.dist, gapY: 0, gapH: 1.3, level: 5, kind: 'extreme' })];
  r.y = 0;
  updateSim(r, { hold: false });
  assert.ok(r.slowmo > 0, '应进入慢动作');
});

test('drainEvents 清空队列', () => {
  const r = createSim({ seed: 18 });
  const evs = drainEvents(r);
  assert.ok(evs.length > 0); // 至少有 start
  assert.equal(r.events.length, 0);
});

test('getHud 暴露核心数值', () => {
  const r = createSim({ seed: 19 });
  r.dist = 123; r.score = 500; r.mult = 4;
  const h = getHud(r);
  assert.equal(h.dist, 123);
  assert.equal(h.score, 500);
  assert.equal(h.mult, 4);
});

test('ratingFor 阈值判定', () => {
  assert.equal(ratingFor(0), 'C');
  assert.equal(ratingFor(1200), 'B');
  assert.equal(ratingFor(2500), 'A');
  assert.equal(ratingFor(4000), 'S');
});
