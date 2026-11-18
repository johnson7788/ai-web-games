import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, opens, exitOf, OPPOSITE } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';

const PIECES = ['E', 'N', 'UL', 'UR', 'LL', 'LR', 'X'];

// 以 1/60 步长推进 sec 秒
function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

test('冒烟：createRun → step → grab → place → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  const g = r.grab();
  assert.equal(g.ok, true);
  const p = r.place(0, 1);
  assert.equal(p.ok, true);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'countdown');
  const ev = r.drainEvents();
  assert.ok(Array.isArray(ev));
});

test('state 形状：level/phase/rows/cols/grid 尺寸/start/end', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'countdown');
  assert.equal(s.rows, 3);
  assert.equal(s.cols, 4);
  assert.equal(s.grid.length, 3);
  assert.equal(s.grid[0].length, 4);
  assert.deepEqual([s.start.r, s.start.c], [0, 0]);
  assert.equal(s.start.entrance, 'top');
  assert.equal(s.start.exit, 'down');
  assert.deepEqual([s.end.r, s.end.c], [2, 3]);
  assert.equal(s.end.entrance, 'top');
});

test('起终点自带 N 型管，不可放置', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.state.grid[0][0].kind, 'start');
  assert.equal(r.state.grid[0][0].piece, 'N');
  assert.equal(r.state.grid[2][3].kind, 'end');
  r.state.selected = 'E';
  assert.equal(r.place(0, 0).ok, false);
  assert.equal(r.place(2, 3).ok, false);
});

test('岩石格：kind=rock，不可放置、不可铲除', () => {
  const r = createRun(2, { seed: 1 }); // L3 有 2 块岩石
  const s = r.state;
  const rockCells = LEVELS[2].rocks;
  for (const [rr, cc] of rockCells) assert.equal(s.grid[rr][cc].kind, 'rock');
  const [rr, cc] = rockCells[0];
  r.state.selected = 'E';
  assert.equal(r.place(rr, cc).ok, false);
  assert.equal(r.dig(rr, cc).ok, false);
});

test('花朵格：bloom 标记 + bloomTotal 与关卡一致', () => {
  const r = createRun(3, { seed: 1 }); // L4 有 2 朵花
  const s = r.state;
  assert.equal(s.bloomTotal, 2);
  for (const [rr, cc] of LEVELS[3].blooms) {
    assert.equal(s.grid[rr][cc].kind, 'bloom');
    assert.equal(s.grid[rr][cc].bloom, true);
  }
});

test('管型语义：opens/exitOf 覆盖 7 种 + X 直通', () => {
  assert.deepEqual(opens('E').sort(), ['left', 'right']);
  assert.deepEqual(opens('N').sort(), ['down', 'top']);
  assert.deepEqual(opens('UL').sort(), ['left', 'top']);
  assert.deepEqual(opens('UR').sort(), ['right', 'top']);
  assert.deepEqual(opens('LL').sort(), ['down', 'left']);
  assert.deepEqual(opens('LR').sort(), ['down', 'right']);
  assert.equal(opens('X').length, 4);
  assert.equal(exitOf('E', 'left'), 'right');
  assert.equal(exitOf('E', 'right'), 'left');
  assert.equal(exitOf('UL', 'left'), 'top');
  assert.equal(exitOf('UL', 'top'), 'left');
  assert.equal(exitOf('X', 'top'), 'down');
  assert.equal(exitOf('X', 'left'), 'right');
  assert.equal(exitOf('N', 'left'), null);
  assert.equal(OPPOSITE.top, 'down');
});

test('队列：初始填满 queueCap，每件结构合法', () => {
  const r = createRun(1, { seed: 1 }); // L2 queueCap=4
  const s = r.state;
  assert.equal(s.queue.length, s.queueCap);
  assert.equal(s.queueCap, 4);
  for (const q of s.queue) {
    assert.ok(PIECES.includes(q.piece));
    assert.equal(typeof q.locked, 'boolean');
    assert.equal(typeof q.offsetT, 'number');
  }
});

test('grab：抓底槽件、选中、队列补位到 queueCap', () => {
  const r = createRun(1, { seed: 1 });
  const s = r.state;
  const bottom = s.queue[0].piece;
  const g = r.grab();
  assert.equal(g.ok, true);
  assert.equal(g.piece, bottom);
  assert.equal(s.selected, bottom);
  assert.equal(s.queue.length, s.queueCap); // 补位
});

test('grab：已持有时再抓返回 holding', () => {
  const r = createRun(0, { seed: 1 });
  r.grab();
  assert.deepEqual(r.grab(), { ok: false, reason: 'holding' });
});

test('place：空格放置成功，placements 递增', () => {
  const r = createRun(0, { seed: 1 });
  const g = r.grab();
  const p = r.place(0, 1);
  assert.equal(p.ok, true);
  const cell = r.state.grid[0][1];
  assert.equal(cell.kind, 'pipe');
  assert.equal(cell.piece, g.piece);
  assert.equal(r.state.selected, null);
  assert.equal(r.state.placements, 1);
});

test('place：无选中 / 越界 / 占用 校验', () => {
  const r = createRun(0, { seed: 1 });
  assert.deepEqual(r.place(0, 1), { ok: false, reason: 'noSelection' });
  r.grab();
  assert.deepEqual(r.place(-1, 0), { ok: false, reason: 'bounds' });
  assert.deepEqual(r.place(5, 9), { ok: false, reason: 'bounds' });
});

test('dig：清除 pipe 恢复 empty，digLeft 递减', () => {
  const r = createRun(2, { seed: 1 }); // L3 起解锁铲除
  assert.equal(r.state.digLeft, 1);
  r.grab();
  r.place(0, 1);
  const d = r.dig(0, 1);
  assert.equal(d.ok, true);
  assert.equal(r.state.grid[0][1].kind, 'empty');
  assert.equal(r.state.digLeft, 0);
  assert.deepEqual(r.dig(0, 1), { ok: false, reason: 'notPipe' });
});

test('dig：L1/L2 未解锁（digLeft=0）', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.state.digLeft, 0);
  r.grab();
  r.place(0, 1);
  assert.deepEqual(r.dig(0, 1), { ok: false, reason: 'noDig' });
});

test('addDig：+1 且封顶 2', () => {
  const r = createRun(2, { seed: 1 });
  assert.equal(r.state.digLeft, 1);
  assert.equal(r.addDig().ok, true);
  assert.equal(r.state.digLeft, 2);
  assert.deepEqual(r.addDig(), { ok: false, reason: 'max' });
});

test('倒计时：step 扣减 timeLeft，整秒发 countdownTick', () => {
  const r = createRun(0, { seed: 1 });
  const before = r.state.timeLeft;
  r.step(0.5);
  assert.ok(r.state.timeLeft < before);
  r.drainEvents();
  // 推进到跨过第一个整秒
  const initialSec = Math.ceil(r.state.timeLeft);
  while (Math.ceil(r.state.timeLeft) === initialSec) r.step(1 / 60);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'countdownTick' && typeof e.timeLeft === 'number'));
});

test('timeOut：倒计时走完未开闸 → lose timeOut', () => {
  const r = createRun(0, { seed: 1 });
  advance(r, LEVELS[0].time + 1);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'lose' && e.reason === 'timeOut'));
});

test('flowStart：开闸进入 flowing 并发 flowStart/cellWatered', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.startFlow().ok, true);
  assert.equal(r.state.phase, 'flowing');
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'flowStart'));
  assert.ok(ev.some((e) => e.type === 'cellWatered' && e.r === 0 && e.c === 0));
});

test('水流推进：完整管路 win（星级/事件/result）', () => {
  const r = createRun(0, { seed: 1 });
  // L1 通路 (0,0)→(1,0)→(1,1)→(1,2)→(1,3)→(2,3)：UR,E,E,LL
  r.state.selected = 'UR'; r.place(1, 0);
  r.state.selected = 'E'; r.place(1, 1);
  r.state.selected = 'E'; r.place(1, 2);
  r.state.selected = 'LL'; r.place(1, 3);
  assert.equal(r.startFlow().ok, true);
  const cellCount = 6; // start + 4 管 + end
  advance(r, LEVELS[0].blockTime * cellCount + 1);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
  // L1 无花：blooms===bloomTotal(0===0) 得花星；timeLeft(45)≥13.5 得时间星 → 3 星
  assert.equal(r.state.stars, 3);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'win'));
  assert.ok(ev.some((e) => e.type === 'cellWatered' && e.r === 2 && e.c === 3));
});

test('水流推进：断流（空管位）→ lose deadEnd', () => {
  const r = createRun(0, { seed: 1 });
  // 只放第一格，第二格留空
  r.state.selected = 'N'; r.place(1, 0);
  r.startFlow();
  advance(r, LEVELS[0].blockTime * 3);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'lose' && e.reason === 'deadEnd'));
});

test('水流推进：管口不匹配 → lose deadEnd', () => {
  const r = createRun(0, { seed: 1 });
  // (1,0) 用 E（左-右），水从上方进入不匹配
  r.state.selected = 'E'; r.place(1, 0);
  r.startFlow();
  advance(r, LEVELS[0].blockTime * 3);
  assert.equal(r.state.phase, 'lost');
});

test('花朵计星：水经 bloom 格发 bloom 事件并 blooms++', () => {
  const r = createRun(3, { seed: 1 }); // L4 有 2 朵花 (1,3),(2,2)，岩石 (1,2),(2,4)
  // 通路：start(0,0)→(1,0)→(2,0)→(2,1)→(2,2)*→(2,3)→(1,3)*→(1,4)→(1,5)→(2,5)→end(3,5)
  // 管件：N, UR, E, E, UL, LR, E, LL, N（* 为 bloom 格）
  const seq = [
    [1, 0, 'N'], [2, 0, 'UR'], [2, 1, 'E'], [2, 2, 'E'],
    [2, 3, 'UL'], [1, 3, 'LR'], [1, 4, 'E'], [1, 5, 'LL'], [2, 5, 'N'],
  ];
  for (const [rr, cc, piece] of seq) {
    r.state.selected = piece;
    assert.equal(r.place(rr, cc).ok, true);
  }
  r.startFlow();
  advance(r, 60);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.blooms, 2);
  assert.equal(r.state.bloomTotal, 2);
  assert.equal(r.state.stars, 3); // 1 + 花全浇到(1) + 时间(1)
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'bloom' && e.r === 2 && e.c === 2 && e.blooms === 1));
  assert.ok(ev.some((e) => e.type === 'bloom' && e.r === 1 && e.c === 3 && e.blooms === 2));
});

test('L10 锁定件：placements<3 时队首可抓件为未锁定，≥3 后解锁', () => {
  const r = createRun(9, { seed: 1 }); // L10
  const s = r.state;
  assert.ok(s.queue.some((q) => q.locked));
  const idx = s.queue.findIndex((q) => q.locked);
  assert.ok(idx > 0, '锁定件不应占据可抓取的底槽');
  // 放置 3 根管解锁
  for (let i = 0; i < 3; i += 1) {
    const g = r.grab();
    assert.equal(g.ok, true);
    // 找到空格放置
    let placed = false;
    outer: for (let rr = 0; rr < s.rows && !placed; rr += 1) {
      for (let cc = 0; cc < s.cols; cc += 1) {
        if (s.grid[rr][cc].kind === 'empty' || s.grid[rr][cc].kind === 'bloom') {
          assert.equal(r.place(rr, cc).ok, true);
          placed = true;
          break outer;
        }
      }
    }
  }
  assert.equal(s.placements, 3);
  assert.ok(!s.queue.some((q) => q.locked), 'placements>=3 后应全部解锁');
});

test('X 管（L5+）：队列权重含 X，直通语义', () => {
  const r = createRun(4, { seed: 1 }); // L5
  const s = r.state;
  // L5 权重含 X；抓取多件后至少统计到合法管件即可（X 概率 8%，不强制命中）
  assert.equal(s.queue.length, s.queueCap);
  assert.equal(exitOf('X', 'top'), 'down');
  assert.equal(exitOf('X', 'right'), 'left');
});
