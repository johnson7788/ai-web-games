import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { generateBoard, tileIsFree, mulberry32 } from '../src/game/board.js';
import { GAME } from '../config/game.config.js';

test('createRun：初始状态正确', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.level, 1);
  assert.equal(run.state.slotCap, 7);
  assert.equal(run.state.slot.length, 0);
  assert.equal(run.state.totalTiles, LEVELS[0].totalTiles);
  assert.ok(run.state.stacks.length > 0);
});

test('tapTile：拾取自由顶牌入槽', () => {
  const run = createRun(0, { seed: 1 });
  const free = run.state.stacks.findIndex((s) => tileIsFree(run.state.stacks, s.id));
  assert.ok(free >= 0);
  const before = run.state.slot.length;
  const res = run.tapTile(free);
  assert.equal(res.ok, true);
  assert.equal(run.state.slot.length, before + 1);
});

test('tapTile：空堆返回 empty', () => {
  const run = createRun(0, { seed: 1 });
  // 找一个空堆
  const empty = run.state.stacks.find((s) => s.tiles.length === 0);
  if (empty) {
    const res = run.tapTile(empty.id);
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'empty');
  }
});

test('tapTile：三同消除后槽位清空', () => {
  const run = createRun(0, { seed: 1 });
  // 内置解前 3 步 = 第一组三同
  const sol = run.solution();
  run.tapTile(sol[0]);
  run.tapTile(sol[1]);
  run.tapTile(sol[2]);
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'clear'));
  assert.equal(run.state.cleared, 3);
  assert.equal(run.state.slot.length, 0);
});

test('tapTile：槽满判负', () => {
  const run = createRun(0, { seed: 1 });
  run.state.slotCap = 1; // 压缩容量：拾取 1 张即满
  const free = run.state.stacks.find((s) => tileIsFree(run.state.stacks, s.id));
  run.tapTile(free.id);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.result.reason, 'slotFull');
});

test('tapTile：清空全部牌判胜', () => {
  const run = createRun(0, { seed: 1 });
  for (const sid of run.solution()) {
    if (run.state.phase !== 'playing') break;
    run.tapTile(sid);
  }
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1);
});

test('undo：撤回最近一张牌', () => {
  const run = createRun(0, { seed: 1 });
  const free = run.state.stacks.find((s) => tileIsFree(run.state.stacks, s.id));
  const beforeSlot = run.state.slot.length;
  run.tapTile(free.id);
  assert.equal(run.state.slot.length, beforeSlot + 1);
  const res = run.undo();
  assert.equal(res.ok, true);
  assert.equal(run.state.slot.length, beforeSlot);
  assert.equal(run.state.undoLeft, LEVELS[0].undo - 1);
});

test('undo：次数用尽返回 noUndo', () => {
  const run = createRun(0, { seed: 1 });
  run.state.undoLeft = 0;
  run.state.slot = [{ id: -1, type: 0, lockAnchor: null, fromStack: 0 }];
  const res = run.undo();
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'noUndo');
});

test('shuffle：重排板上牌但品类总数不变', () => {
  const run = createRun(1, { seed: 1 });
  run.state.shuffleLeft = 1;
  const counts = new Map();
  for (const s of run.state.stacks) for (const t of s.tiles) counts.set(t.type, (counts.get(t.type) || 0) + 1);
  const res = run.shuffle();
  assert.equal(res.ok, true);
  const after = new Map();
  for (const s of run.state.stacks) for (const t of s.tiles) after.set(t.type, (after.get(t.type) || 0) + 1);
  assert.deepEqual(after, counts);
});

test('限时关：超时判负 timeOut', () => {
  const lv = LEVELS.find((l) => l.timeLimit != null);
  const idx = LEVELS.indexOf(lv);
  const run = createRun(idx, { seed: 1 });
  for (let i = 0; i < (lv.timeLimit + 2) * 60; i += 1) run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.result.reason, 'timeOut');
});

test('星级：无道具 + 高效 = 3 星', () => {
  const run = createRun(0, { seed: 1 });
  for (const sid of run.solution()) {
    if (run.state.phase !== 'playing') break;
    run.tapTile(sid);
  }
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.stars, 3);
});

test('getHud：返回剩余数与槽位', () => {
  const run = createRun(0, { seed: 1 });
  const hud = run.getHud();
  assert.equal(hud.remaining, run.state.totalTiles);
  assert.equal(hud.slotLen, 0);
  assert.equal(hud.slotCap, 7);
});

test('drainEvents：清空事件队列', () => {
  const run = createRun(0, { seed: 1 });
  const free = run.state.stacks.find((s) => tileIsFree(run.state.stacks, s.id));
  run.tapTile(free.id);
  const ev = run.drainEvents();
  assert.ok(ev.length > 0);
  assert.equal(run.drainEvents().length, 0);
});

test('事件种类：一次拾取发出 pick + slotAdd', () => {
  const run = createRun(0, { seed: 1 });
  const free = run.state.stacks.find((s) => tileIsFree(run.state.stacks, s.id));
  run.tapTile(free.id);
  const types = new Set(run.drainEvents().map((e) => e.type));
  assert.ok(types.has('pick'));
  assert.ok(types.has('slotAdd'));
});

test('mulberry32：可复现', () => {
  const a = mulberry32(42); const b = mulberry32(42);
  for (let i = 0; i < 5; i += 1) assert.equal(a(), b());
});

test('GAME：三同消除常量 = 3', () => {
  assert.equal(GAME.TRIPLE_CLEAR, 3);
});
