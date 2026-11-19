import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, COLS, ROWS, MAX_VALUE, BOMB_COST } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

// 推进到当前落块/合并动画结算完
function settle(run, cap = 500) {
  let guard = cap;
  while (guard-- > 0 && run.state.busy > 0 && run.state.phase === 'playing') run.step(1 / 60);
}

test('冒烟：createRun → place → step → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.place(0);
  assert.equal(p.ok, true);
  r.step(1 / 60);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.target, LEVELS[0].target);
  const ev = r.drainEvents();
  assert.ok(Array.isArray(ev));
});

test('state 形状：5 列 7 行，目标 32，初始空盘', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.phase, 'playing');
  assert.equal(s.cols, COLS);
  assert.equal(s.rows, ROWS);
  assert.equal(s.target, 32);
  assert.equal(s.grid.length, COLS);
  assert.ok(s.grid.every((col) => col.length === 0));
  assert.ok(s.nextValue === 2 || s.nextValue === 4);
});

test('place：落块到列底，placements 递增，nextValue 更新', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.place(0);
  assert.equal(p.ok, true);
  assert.equal(r.state.grid[0].length, 1);
  assert.equal(r.state.grid[0][0].v, p.value);
  assert.equal(r.state.placements, 1);
  assert.ok([2, 4].includes(r.state.nextValue));
});

test('place：越界 / 非数字 / busy 中 校验', () => {
  const r = createRun(0, { seed: 1 });
  assert.deepEqual(r.place(-1), { ok: false, reason: 'bounds' });
  assert.deepEqual(r.place(5), { ok: false, reason: 'bounds' });
  assert.deepEqual(r.place(1.5), { ok: false, reason: 'bounds' });
  assert.equal(r.place(0).ok, true);
  assert.deepEqual(r.place(1), { ok: false, reason: 'busy' });
});

test('满列：第 8 块落同一列触发 lose', () => {
  const r = createRun(0, { seed: 1 });
  // 直接铺满一列（交替 2/4 避免同值相邻被提前合并）
  for (let i = 0; i < ROWS; i += 1) r.state.grid[0].push({ v: i % 2 ? 4 : 2 });
  assert.equal(r.state.grid[0].length, ROWS);
  const p = r.place(0);
  assert.equal(p.ok, false);
  assert.equal(r.state.phase, 'lost');
  assert.ok(r.drainEvents().some((e) => e.type === 'lose' && e.reason === 'full'));
});

test('垂直合并：2 叠 2 → 4', () => {
  const r = createRun(0, { seed: 1 });
  r.state.grid[0].push({ v: 2 });
  r.state.nextValue = 2;
  assert.equal(r.place(0).ok, true);
  settle(r);
  assert.equal(r.state.grid[0].length, 1);
  assert.equal(r.state.grid[0][0].v, 4);
  assert.ok(r.drainEvents().some((e) => e.type === 'merge' && e.value === 4));
});

test('横向合并：2 旁 2 → 4（底行）', () => {
  const r = createRun(0, { seed: 1 });
  r.state.grid[0].push({ v: 2 });
  r.state.grid[1].push({ v: 2 });
  r.state.nextValue = 4;
  assert.equal(r.place(1).ok, true); // 4 落在 col1 顶，不与 2 合并
  settle(r);
  // 触发 col0/col1 底行两个 2 相邻合并
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'merge' && e.value === 4));
});

test('重力：炸弹清底后上方方块下落（列内压实）', () => {
  const r = createRun(0, { seed: 1 });
  r.state.diamonds = BOMB_COST;
  r.state.grid[0].push({ v: 2 }, { v: 4 }, { v: 8 });
  assert.equal(r.bomb(0).ok, true);
  assert.deepEqual(r.state.grid[0].map((c) => c.v), [4, 8]); // 底 2 被清，4/8 下沉
});

test('通关：合成到目标值 → win + 星级', () => {
  const r = createRun(0, { seed: 1 }); // 目标 32
  // 直接放一个 32 底，再叠一个 32 触发 32+32=64 >= 32
  r.state.grid[0].push({ v: 32 });
  r.state.nextValue = 32;
  assert.equal(r.place(0).ok, true);
  settle(r);
  assert.equal(r.state.phase, 'won');
  assert.ok(r.state.stars >= 1);
  assert.ok(r.drainEvents().some((e) => e.type === 'win'));
});

test('岩石：第 3 关起按节奏生成 0 值障碍', () => {
  const r = createRun(2, { seed: 1 }); // L3 rockEvery=6
  for (let i = 0; i < LEVELS[2].rockEvery; i += 1) {
    r.place(i % COLS);
    settle(r);
  }
  const flat = r.state.grid.flat().map((c) => c.v);
  assert.ok(flat.includes(0), '应生成至少一块岩石');
});

test('岩石清除：紧邻合并震碎岩石并加分', () => {
  const r = createRun(2, { seed: 1 });
  // col0 底岩石、其上 2；col1 底 2 —— 落 2 到 col1 与 col1 底 2 合并，震碎 col0 岩石
  r.state.grid[0].push({ v: 0 }, { v: 2 });
  r.state.grid[1].push({ v: 2 });
  r.state.nextValue = 2;
  assert.equal(r.place(1).ok, true);
  settle(r);
  const flat = r.state.grid.flat().map((c) => c.v);
  assert.ok(!flat.includes(0), '岩石应被震碎');
  assert.ok(r.drainEvents().some((e) => e.type === 'rockClear'));
});

test('连击：一次落块多波合并发 combo 事件', () => {
  const r = createRun(0, { seed: 1 });
  // 构造两波：底行两个 2（波1合成4），波1的 4 又与旁边 4 相邻（波2合成8）
  r.state.grid[0].push({ v: 2 });
  r.state.grid[1].push({ v: 2 });
  r.state.grid[2].push({ v: 4 });
  r.state.nextValue = 2;
  r.place(1); // 落 2 到 col1 顶
  settle(r);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'merge' && e.value === 8), '应连锁合成 8');
  assert.ok(ev.some((e) => e.type === 'combo'), '应触发连击');
});

test('炸弹：花钻石清底块', () => {
  const r = createRun(0, { seed: 1 });
  r.state.diamonds = BOMB_COST;
  r.state.grid[0].push({ v: 8 }, { v: 4 });
  const before = r.state.grid[0].length;
  const res = r.bomb(0);
  assert.equal(res.ok, true);
  assert.equal(r.state.grid[0].length, before - 1);
  assert.equal(r.state.diamonds, 0);
  assert.ok(r.drainEvents().some((e) => e.type === 'bomb'));
});

test('炸弹：钻石不足拒绝', () => {
  const r = createRun(0, { seed: 1 });
  r.state.diamonds = 0;
  r.state.grid[0].push({ v: 2 });
  assert.deepEqual(r.bomb(0), { ok: false, reason: 'noDiamonds' });
});

test('上限：合并超过 8192 目标一并销毁', () => {
  const r = createRun(0, { seed: 1 });
  r.state.grid[0].push({ v: 4096 });
  r.state.grid[1].push({ v: 4096 });
  r.state.nextValue = 4096;
  r.place(1); // col1 两个 4096 → 8192 与 col0 4096 相邻 → 再合并 >MAX
  settle(r);
  const flat = r.state.grid.flat().map((c) => c.v);
  assert.ok(flat.every((v) => v <= MAX_VALUE), '不应有超过上限的块');
});

test('关卡表：9 关、目标值依次翻倍、岩石只从第 3 关起', () => {
  assert.equal(LEVEL_COUNT, 9);
  assert.equal(LEVELS.length, 9);
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    assert.equal(LEVELS[i].target, Math.pow(2, i + 5));
    assert.equal(LEVELS[i].index, i + 1);
    if (i < 2) assert.equal(LEVELS[i].rockEvery, 0);
    else assert.ok(LEVELS[i].rockEvery > 0);
  }
});
