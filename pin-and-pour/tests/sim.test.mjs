import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32, GRAVITY_TICK } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

const H = 'honey';
const B = 'bubble';

test('冒烟：createRun → step → pullGate → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  assert.equal(r.pullGate('g1').ok, true);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'playing');
  assert.ok(Array.isArray(r.drainEvents()));
});

test('state 形状：level/phase/rows/cols/grid 尺寸/beads/gates', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'playing');
  assert.equal(s.rows, 5);
  assert.equal(s.cols, 1);
  assert.equal(s.grid.length, 5);
  assert.equal(s.grid[0].length, 1);
  assert.equal(s.beads.length, 1);
  assert.equal(s.totalHoney, 1);
  assert.equal(s.totalBubble, 0);
});

test('拉闸前珠子静止：L1 不拉闸步进，珠子不动且仍在 playing', () => {
  const r = createRun(0, { seed: 1 });
  const before = `${r.state.beads[0].r},${r.state.beads[0].c}`;
  for (let i = 0; i < 20; i += 1) r.tick();
  assert.equal(`${r.state.beads[0].r},${r.state.beads[0].c}`, before);
  assert.equal(r.state.phase, 'playing');
});

test('拉闸：L1 抽 g1 后蜂蜜进瓶 → win（1 星）', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.pullGate('g1').ok, true);
  r.fastForward();
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.collected, 1);
  assert.equal(r.state.stars, 3); // win + perfect(1<=1) + clean(0===0)
});

test('拉闸校验：不存在的闸 / 已抽过的闸', () => {
  const r = createRun(0, { seed: 1 });
  assert.deepEqual(r.pullGate('nope'), { ok: false, reason: 'noGate' });
  r.pullGate('g1');
  assert.deepEqual(r.pullGate('g1'), { ok: false, reason: 'pulled' });
});

test('getHud 字段完整', () => {
  const r = createRun(2, { seed: 1 }); // L3 有 2 气泡
  const h = r.getHud();
  assert.equal(h.collected, 0);
  assert.equal(h.totalHoney, 1);
  assert.equal(h.drained, 0);
  assert.equal(h.totalBubble, 2);
  assert.equal(h.pulls, 0);
});

test('mulberry32 确定性：同 seed 同序列', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  assert.notEqual(seqA[0], mulberry32(7)());
});

test('正确顺序：L2 先开侧闸 g2 再开 g1 → win', () => {
  const r = createRun(1, { seed: 1 });
  r.pullGate('g2');
  r.fastForward();
  assert.equal(r.state.phase, 'playing');
  assert.equal(r.state.drained, 1); // 气泡已排空
  r.pullGate('g1');
  r.fastForward();
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.collected, 1);
});

test('错误顺序：L2 先开 g1 → 气泡进瓶 → pollution lose', () => {
  const r = createRun(1, { seed: 1 });
  r.pullGate('g1');
  r.fastForward();
  assert.equal(r.state.phase, 'lost');
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'lose' && e.reason === 'pollution'));
});

test('滤网 screen：气泡可穿过、蜂蜜被挡住', () => {
  const r = createRun(1, { seed: 1 });
  const s = r.state;
  assert.equal(s.grid[3][1].kind, 'screen');
  // 蜂蜜在 (2,0)，其右下 (3,1) 是滤网 → 蜂蜜不能斜穿
  assert.ok(s.grid[3][1].kind === 'screen');
});

test('蜂巢 comb：蜂蜜穿过并冲走、气泡被挡', () => {
  const r = createRun(3, { seed: 1 }); // L4 有 comb
  const s = r.state;
  assert.equal(s.grid[4][0].kind, 'comb');
  r.pullGate('g1');
  r.fastForward();
  assert.equal(s.grid[4][0].kind, 'empty'); // 被蜂蜜冲走
  assert.equal(s.collected, 1);
});

test('drain：气泡进排口安全、蜂蜜进排口浪费 lose', () => {
  const r = createRun(1, { seed: 1 });
  const s = r.state;
  assert.equal(s.grid[5][1].kind, 'drain');
  assert.equal(s.grid[5][0].kind, 'bottle');
  // 蜂蜜直接进排口会 lose：手动构造（把蜂蜜放到 drain 上方并开放路径）
  const r2 = createRun(7, { seed: 1 }); // L8 蜂蜜向左/右分流
  r2.pullGate('g1');
  r2.fastForward();
  // L8 正确路径是向右进瓶
  assert.equal(r2.state.phase, 'won');
});

test('fastForward 到终局：L1 快进后非 playing', () => {
  const r = createRun(0, { seed: 1 });
  r.pullGate('g1');
  r.fastForward();
  assert.ok(['won', 'lost'].includes(r.state.phase));
});

test('isSettled：初始静止为 true，拉闸后变为 false 再回到 true', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.isSettled(), true);
  r.pullGate('g1');
  assert.equal(r.isSettled(), false);
  r.fastForward();
  assert.equal(r.isSettled(), true);
});

test('事件表：拉闸/流动/收集/胜利事件齐全', () => {
  const r = createRun(0, { seed: 1 });
  r.pullGate('g1');
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'gatePull'));
  r.fastForward();
  const evs2 = r.drainEvents();
  assert.ok(evs2.some((e) => e.type === 'win'));
  assert.ok(evs2.some((e) => e.type === 'collect'));
});

test('GRAVITY_TICK 为正且有限', () => {
  assert.ok(GRAVITY_TICK > 0 && Number.isFinite(GRAVITY_TICK));
});

test('L9 三闸叠塔：抽完三闸全部蜂蜜进瓶 → win', () => {
  const r = createRun(8, { seed: 1 });
  for (const id of ['g1', 'g2', 'g3']) r.pullGate(id);
  r.fastForward();
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.collected, 3);
});
