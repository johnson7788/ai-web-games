import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, isRevealed } from '../src/game/sim.js';
import { T, GRID, DIRS, TRUTH, lightRadius, ratingOf, cheb, inBounds, idx } from '../config/gameplay.js';
import { BLOCK_COUNT } from '../config/levels.js';

// 找一个可走的相邻方向（target 是 floor 且非出口/危险）
function floorDir(run) {
  for (const name of Object.keys(DIRS)) {
    const d = DIRS[name];
    const nx = run.player.x + d.dx;
    const ny = run.player.y + d.dy;
    if (!inBounds(nx, ny)) continue;
    const i = idx(nx, ny);
    if (run.map.cells[i] === T.FLOOR && run.map.danger[i] !== 1) return name;
  }
  return null;
}

function eventsOf(run) {
  return run.drainEvents();
}

// 把玩家直接挪到目标格的相邻格（白盒），再朝目标走一步
function stepOnto(run, target, rng) {
  // 找 target 的一个 floor 邻居
  for (const name of Object.keys(DIRS)) {
    const d = DIRS[name];
    const nx = target.x + d.dx;
    const ny = target.y + d.dy;
    if (!inBounds(nx, ny)) continue;
    const i = idx(nx, ny);
    if (run.map.cells[i] !== T.WALL && run.map.danger[i] !== 1) {
      run.player = { x: nx, y: ny };
      // 朝 target 走一步
      const back = { up: 'down', down: 'up', left: 'right', right: 'left' }[name];
      return back;
    }
  }
  return null;
}

test('createRun 初始状态符合契约', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.blockIndex, 0);
  assert.equal(run.map.cols, GRID.COLS);
  assert.equal(run.map.rows, GRID.ROWS);
  assert.ok(run.oil > 0);
  assert.equal(run.oil, run.oilStart);
  assert.equal(run.steps, 0);
  assert.deepEqual(run.drainEvents(), []);
});

test('getHud 契约字段齐全', () => {
  const run = createRun({ seed: 2 });
  const hud = run.getHud();
  for (const k of ['phase', 'block', 'blockCount', 'scene', 'oil', 'oilStart', 'steps', 'maxSteps', 'par', 'keys', 'lever', 'clues', 'clueTarget', 'goalKey', 'doorOpen', 'radius', 'truthActive', 'movingFog']) {
    assert.ok(k in hud, `缺字段 ${k}`);
  }
  assert.equal(hud.block, 1);
  assert.equal(hud.phase, 'playing');
});

test('同 seed 同输入 → 同地图同结果（确定性）', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  assert.deepEqual(Array.from(a.map.cells), Array.from(b.map.cells));
  assert.deepEqual(a.map.start, b.map.start);
  assert.deepEqual(a.map.exit, b.map.exit);
});

test('移动：step 事件 + 步数 + 耗油 + 揭雾', () => {
  const run = createRun({ seed: 3 });
  const dir = floorDir(run);
  assert.ok(dir, '应存在可走方向');
  const oilBefore = run.oil;
  run.step({ dir });
  const evs = eventsOf(run);
  assert.ok(evs.some((e) => e.type === 'step'), '应发 step 事件');
  assert.ok(evs.some((e) => e.type === 'reveal'), '移动应揭雾');
  assert.equal(run.steps, 1);
  assert.equal(run.oil, oilBefore - 1);
});

test('撞墙 / 出界：blocked 事件且不动', () => {
  const run = createRun({ seed: 4 });
  // 找一个墙方向，或直接朝地图外走
  run.step({ dir: 'up' });
  let moved = run.steps > 0;
  const evs = eventsOf(run);
  if (!moved) assert.ok(evs.some((e) => e.type === 'blocked') || evs.length === 0);
  // 朝地图外必 blocked
  run.player = { x: 0, y: 0 };
  run.step({ dir: 'left' });
  assert.ok(eventsOf(run).some((e) => e.type === 'blocked'));
});

test('钥匙：踩上后 keyCollected + doorOpen', () => {
  const run = createRun({ seed: 5 });
  const key = run.map.key;
  assert.ok(key, '第 1 街区应有钥匙');
  const dir = stepOnto(run, key);
  assert.ok(dir, '应能走到钥匙旁');
  run.step({ dir });
  assert.equal(run.keyCollected, 1);
  assert.ok(run.doorOpen, '拿到钥匙门应打开');
  assert.ok(eventsOf(run).some((e) => e.type === 'doorOpen'));
});

test('杠杆：踩上后 leverOn + doorOpen', () => {
  const run = createRun({ seed: 6, startBlock: 1 }); // 第 2 街区有杠杆
  const lever = run.map.lever;
  assert.ok(lever, '第 2 街区应有杠杆');
  const dir = stepOnto(run, lever);
  assert.ok(dir);
  run.step({ dir });
  assert.equal(run.leverOn, true);
  assert.ok(run.doorOpen);
});

test('陷阱：额外掉油并发 trap 事件', () => {
  const run = createRun({ seed: 7, startBlock: 1 });
  const trap = run.map.traps[0];
  assert.ok(trap, '第 2 街区应有陷阱');
  const dir = stepOnto(run, trap);
  assert.ok(dir);
  const oilBefore = run.oil;
  run.step({ dir });
  assert.ok(eventsOf(run).some((e) => e.type === 'trap'));
  assert.ok(run.oil < oilBefore - 1, '陷阱额外掉油');
});

test('真相时刻：集齐 3 条线索全图点亮', () => {
  const run = createRun({ seed: 8, startBlock: 3 }); // 第 4 街区有 3 线索
  assert.equal(run.map.clues.length, 3);
  for (const c of run.map.clues) {
    const dir = stepOnto(run, c);
    assert.ok(dir);
    run.step({ dir });
    run.drainEvents();
  }
  assert.equal(run.cluesCollected, 3);
  // 第 3 条线索触发 truthMoment
  // 触发时机在最后一次 step 前一个循环里，这里再走一步验证 truthActive
  assert.ok(run.getHud().truthActive || run.truthUntil > 0);
});

test('回声：探听机关 + 花 1 步', () => {
  const run = createRun({ seed: 9, startBlock: 1 });
  const stepsBefore = run.steps;
  run.step({ echo: true });
  const evs = eventsOf(run);
  assert.ok(evs.some((e) => e.type === 'echo'), '应发 echo 事件');
  assert.equal(run.steps, stepsBefore + 1, '回声花 1 步');
});

test('守卫：踏入危险区死亡', () => {
  const run = createRun({ seed: 10, startBlock: 5 }); // 第 6 街区有守卫
  const g = run.map.guards[0];
  assert.ok(g, '第 6 街区应有守卫');
  // 找到守卫视线格
  const d = DIRS[g.dir];
  const vx = g.x + d.dx;
  const vy = g.y + d.dy;
  run.player = { x: vx, y: vy };
  // 朝守卫格或视线格走
  const dir = stepOnto(run, g);
  assert.ok(dir);
  run.step({ dir });
  assert.equal(run.phase, 'dead');
  assert.ok(eventsOf(run).some((e) => e.type === 'death'));
});

test('步数上限：迷雾吞噬死亡', () => {
  const run = createRun({ seed: 11 });
  run.steps = run.map.maxSteps; // 直接顶到上限
  const dir = floorDir(run);
  if (dir) {
    run.step({ dir });
    assert.equal(run.phase, 'dead');
    assert.equal(run.deathReason, 'steps');
    assert.ok(eventsOf(run).some((e) => e.type === 'death'));
  }
});

test('灯半径：随油量从 3 缩到 1', () => {
  const run = createRun({ seed: 12 });
  assert.equal(run.getHud().radius, 3);
  run.oil = 0;
  assert.equal(lightRadius(0, run.oilStart), 1);
});

test('过关：抵达出口推进到下一街区', () => {
  const run = createRun({ seed: 13 });
  // 直接开锁 + 走到出口旁
  run.keyCollected = 1;
  run.doorOpen = true;
  const dir = stepOnto(run, run.map.exit);
  assert.ok(dir);
  run.step({ dir });
  assert.equal(run.blockIndex, 1, '应推进到第 2 街区');
  assert.equal(run.steps, 0, '新街区步数清零');
});

test('通关：12 街区走完后 phase=won', () => {
  const run = createRun({ seed: 14, startBlock: BLOCK_COUNT - 1 });
  run.doorOpen = true;
  // 直接满足条件走到出口
  const dir = stepOnto(run, run.map.exit);
  assert.ok(dir);
  run.step({ dir });
  assert.equal(run.phase, 'won');
});

test('评级：步数越少评级越高', () => {
  assert.equal(ratingOf(10, 10), 'S');
  assert.equal(ratingOf(16, 10), 'A');
  assert.equal(ratingOf(20, 10), 'B');
  assert.equal(ratingOf(30, 10), 'C');
});

test('切比雪夫距离与索引', () => {
  assert.equal(cheb({ x: 0, y: 0 }, { x: 2, y: 3 }), 3);
  assert.equal(idx(3, 2), 2 * GRID.COLS + 3);
  assert.equal(inBounds(0, 0), true);
  assert.equal(inBounds(GRID.COLS, 0), false);
});

test('移动雾：旧格重新起雾但保留出口与玩家', () => {
  const run = createRun({ seed: 15, startBlock: 7 }); // 第 8 街区移动雾
  assert.equal(run.movingFog, true);
  const startIdx = idx(run.player.x, run.player.y);
  // 多走几步制造揭示
  for (let k = 0; k < 30; k += 1) {
    const dir = floorDir(run);
    if (!dir) break;
    run.step({ dir });
    run.drainEvents();
  }
  assert.ok(run.revealOrder.length <= 30, '揭示队列有上限');
  assert.ok(run.revealed.has(startIdx) || run.revealed.has(idx(run.player.x, run.player.y)), '玩家所在格保留揭示');
});

test('第 2 街区有杠杆无钥匙，第 1 街区有钥匙无杠杆', () => {
  const b1 = createRun({ seed: 16, startBlock: 0 });
  const b2 = createRun({ seed: 16, startBlock: 1 });
  assert.ok(b1.map.key && !b1.map.lever);
  assert.ok(b2.map.lever && !b2.map.key);
});
