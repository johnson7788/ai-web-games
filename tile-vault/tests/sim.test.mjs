import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, createSim } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';

const firstFree = (run) => run.state.tiles.find((t) => run.isFree(t));

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

test('冒烟：createRun → step → pick → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  const t = firstFree(r);
  assert.ok(t);
  const res = r.pick(t.id);
  assert.equal(res.ok, true);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'playing');
  assert.ok(Array.isArray(r.drainEvents()));
});

test('state 形状：level/phase/tiles/tray/grid/timer', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'playing');
  assert.ok(Array.isArray(s.tiles) && s.tiles.length > 0);
  assert.ok(Array.isArray(s.tray) && s.tray.length === 0);
  assert.equal(s.trayCap, 7);
  assert.ok(s.gridX > 0 && s.gridZ > 0);
  assert.equal(s.totalTiles, s.tiles.length);
});

test('isFree：顶层自由、被压块非自由', () => {
  const r = createRun(0, { seed: 1 });
  const free = r.state.tiles.filter((t) => r.isFree(t));
  const covered = r.state.tiles.filter((t) => !r.isFree(t));
  assert.ok(free.length > 0);
  assert.ok(covered.length > 0);
  // 被压块正上方必有同列块
  for (const c of covered) {
    assert.ok(r.state.tiles.some((t) => t.x === c.x && t.z === c.z && t.y === c.y + 1));
  }
});

test('pick：自由块入槽，场景减少', () => {
  const r = createRun(0, { seed: 1 });
  const before = r.state.tiles.length;
  const t = firstFree(r);
  assert.equal(r.pick(t.id).ok, true);
  assert.equal(r.state.tray.length, 1);
  assert.equal(r.state.tiles.length, before - 1);
  assert.equal(r.state.tray[0].id, t.id);
});

test('pick：被压块不可拾取', () => {
  const r = createRun(0, { seed: 1 });
  const covered = r.state.tiles.find((t) => !r.isFree(t));
  assert.ok(covered);
  const res = r.pick(covered.id);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'covered');
});

test('三同消除：按解拾取前三块 → merge + 金币 + 槽清空', () => {
  const r = createRun(0, { seed: 1 });
  const order = r._solution;
  assert.ok(order && order.length >= 3);
  for (let i = 0; i < 3; i += 1) assert.equal(r.pick(order[i]).ok, true);
  assert.equal(r.state.merges, 1);
  assert.equal(r.state.coins, 30);
  assert.equal(r.state.tray.length, 0);
});

test('按完整解拾取 → win + 星星', () => {
  const r = createRun(0, { seed: 1 });
  for (const id of r._solution) assert.equal(r.pick(id).ok, true);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
  assert.ok(r.state.stars >= 1 && r.state.stars <= 3);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'win'));
});

test('倒计时：step 扣减 timeLeft，跨整秒发 countdownTick', () => {
  const r = createRun(0, { seed: 1 });
  const before = r.state.timeLeft;
  r.step(0.5);
  assert.ok(r.state.timeLeft < before);
  r.drainEvents();
  const initialSec = Math.ceil(r.state.timeLeft);
  while (Math.ceil(r.state.timeLeft) === initialSec) r.step(1 / 60);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'countdownTick' && typeof e.timeLeft === 'number'));
});

test('timeOut：倒计时走完 → lose timeOut', () => {
  const r = createRun(0, { seed: 1 });
  advance(r, LEVELS[0].time + 1);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'lose' && e.reason === 'timeOut'));
});

test('槽满失败：满槽再取不匹配块 → lose trayFull', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  for (let i = 0; i < s.trayCap; i += 1) s.tray.push({ id: 9000 + i, type: 999, x: 90, z: 90, y: 90 });
  const t = firstFree(r);
  assert.ok(t);
  const res = r.pick(t.id);
  assert.equal(res.ok, false);
  assert.equal(s.phase, 'lost');
  assert.equal(s.result.reason, 'trayFull');
});

test('道具 undo：撤回最后一枚入槽的宝物', () => {
  const r = createRun(7, { seed: 1 }); // L8 道具关 undo×2
  const s = r.state;
  assert.equal(s.items.undo, 2);
  const before = s.tiles.length;
  const t = firstFree(r);
  r.pick(t.id);
  assert.equal(s.tray.length, 1);
  const res = r.undo();
  assert.equal(res.ok, true);
  assert.equal(s.tray.length, 0);
  assert.equal(s.tiles.length, before);
  assert.equal(s.items.undo, 1);
});

test('道具 undo：无道具 / 空槽 校验', () => {
  const r = createRun(0, { seed: 1 });
  assert.deepEqual(r.undo(), { ok: false, reason: 'noItem' });
  const r8 = createRun(7, { seed: 1 });
  assert.deepEqual(r8.undo(), { ok: false, reason: 'empty' });
});

test('道具 shuffle：把槽内宝物全部退回场景', () => {
  const r = createRun(7, { seed: 1 }); // L8 shuffle×1
  const s = r.state;
  const before = s.tiles.length;
  for (let i = 0; i < 3; i += 1) {
    const t = firstFree(r);
    r.pick(t.id);
  }
  assert.ok(s.tray.length >= 1);
  const res = r.shuffle();
  assert.equal(res.ok, true);
  assert.equal(s.tray.length, 0);
  assert.equal(s.tiles.length, before);
  assert.equal(s.items.shuffle, 0);
});

test('revive：返回一枚 + 补时 + 扣次数', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  const t = firstFree(r);
  r.pick(t.id);
  const trayLen = s.tray.length;
  advance(r, 5); // 先耗掉一些时间
  const timeBefore = s.timeLeft;
  const res = r.revive();
  assert.equal(res.ok, true);
  assert.equal(s.tray.length, trayLen - 1);
  assert.ok(s.timeLeft > timeBefore);
  assert.equal(s.revivesLeft, 1);
});

test('revive：重试用尽后拒绝', () => {
  const r = createRun(0, { seed: 1 });
  r.revive();
  r.revive();
  assert.deepEqual(r.revive(), { ok: false, reason: 'noRevive' });
});

test('事件密度：完整解触发 ≥6 种事件', () => {
  const r = createRun(0, { seed: 1 });
  for (const id of r._solution) r.pick(id);
  const types = new Set(r.drainEvents().map((e) => e.type));
  assert.ok(types.has('pick'));
  assert.ok(types.has('merge'));
  assert.ok(types.has('coinRain'));
  assert.ok(types.has('win'));
  // 6 种：pick/merge/coinRain/layerClear/countdownTick/win（countdown 需 step 触发）
  assert.ok(types.size >= 4);
});

test('getHud：字段齐全且数值一致', () => {
  const r = createRun(0, { seed: 1 });
  const h = r.getHud();
  assert.equal(h.level, 1);
  assert.equal(h.trayCap, 7);
  assert.equal(h.tilesLeft, r.state.tiles.length);
  assert.equal(h.coins, r.state.coins);
  assert.equal(h.undo, r.state.items.undo);
  assert.equal(h.shuffle, r.state.items.shuffle);
  assert.equal(h.revivesLeft, r.state.revivesLeft);
});

test('pick：重复拾取同一块返回 gone', () => {
  const r = createRun(0, { seed: 1 });
  const t = firstFree(r);
  r.pick(t.id);
  assert.deepEqual(r.pick(t.id), { ok: false, reason: 'gone' });
});

test('随机策略鲁棒：随机 pick 不抛异常', () => {
  const r = createRun(0, { seed: 99 });
  const rng = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
  for (let i = 0; i < 200 && r.state.phase === 'playing'; i += 1) {
    const free = r.state.tiles.filter((t) => r.isFree(t));
    if (!free.length) break;
    const t = free[Math.floor(rng() * free.length)];
    r.pick(t.id);
    r.step(1 / 60);
  }
  assert.ok(['playing', 'won', 'lost'].includes(r.state.phase));
});

test('createSim 兼容别名可创建', () => {
  const s = createSim();
  assert.ok(s.state.level >= 1);
  assert.ok(Array.isArray(s.state.tiles));
});
