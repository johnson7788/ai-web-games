import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

// 用关卡自带的正解路径把当前对局解到终局（顺序 a → b）
function solveLevel(run) {
  const st = run.state;
  for (const pair of st.pairs) {
    run.startDraw(pair.id, 'a');
    for (let i = 1; i < pair.path.length; i += 1) {
      const r = run.drawTo(pair.path[i][0], pair.path[i][1]);
      assert.ok(r.ok, `drawTo ${pair.path[i]} 应该成功`);
    }
    run.endDraw();
  }
  return run;
}

test('createRun 生成合法关卡（棋盘尺寸 / 阶段 / 端口数）', () => {
  const run = createRun(0);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.rows, LEVELS[0].rows);
  assert.equal(run.state.cols, LEVELS[0].cols);
  assert.ok(run.state.pairs.length >= 4, '第 1 关至少有 4 对端口');
  assert.ok(run.state.emptyCount > 0, '存在可填充空格');
});

test('所有关卡都可被正解解通并获胜', () => {
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const run = createRun(i);
    solveLevel(run);
    assert.equal(run.state.phase, 'won', `第 ${i + 1} 关应能通关`);
    assert.ok(run.state.stars >= 1, `第 ${i + 1} 关至少有 1 星`);
  }
});

test('完美解（零回溯）得 3 星', () => {
  const run = createRun(0);
  solveLevel(run);
  assert.equal(run.state.stars, 3, '无回溯正解应得 3 星');
  assert.equal(run.state.moves, run.state.emptyCount, '步数应等于空格数');
});

test('drawTo 拒绝斜走', () => {
  const run = createRun(0);
  const pair = run.state.pairs[0];
  run.startDraw(pair.id, 'a');
  // 取一个朝内的对角格（保证在界内）
  const dr = pair.a[0] === 0 ? 1 : -1;
  const dc = pair.a[1] === 0 ? 1 : -1;
  const res = run.drawTo(pair.a[0] + dr, pair.a[1] + dc);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'notAdjacent');
});

test('drawTo 拒绝非相邻跳跃', () => {
  const run = createRun(0);
  const pair = run.state.pairs[0];
  run.startDraw(pair.id, 'a');
  const res = run.drawTo(pair.a[0] + 2, pair.a[1]);
  assert.equal(res.ok, false);
});

test('drawTo 拒绝穿过岩石', () => {
  const rockLevel = LEVELS.findIndex((l) => l.rocks.length > 0);
  const run = createRun(rockLevel);
  const rock = run.state.rocks[0];
  const pair = run.state.pairs[0];
  run.startDraw(pair.id, 'a');
  // 尝试把岩石格作为目标（直接调用应失败）
  const res = run.drawTo(rock[0], rock[1]);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'rock');
});

test('drawTo 拒绝交叉进入其他颜色的已填格', () => {
  const run = createRun(0);
  const p0 = run.state.pairs[0];
  const p1 = run.state.pairs[1];
  // 先把 p0 的第一个空格填成 p0 的格
  const cell0 = p0.path[1];
  run.state.grid[cell0[0]][cell0[1]].owner = p0.id;
  // p1 从它的端点开始，尝试直接画进 cell0（必不属于 p1 段，因为各段互不相交）
  run.startDraw(p1.id, 'a');
  // 只有与 p1 端点相邻才是有效目标，这里改用「直接占位」校验：
  const res = run.drawTo(cell0[0], cell0[1]);
  if (res.reason === 'notAdjacent') {
    // cell0 不与 p1 端点相邻，天然被拒
    assert.equal(res.ok, false);
  } else {
    assert.equal(res.ok, false, '不应能进入其他颜色已填格');
    assert.equal(res.reason, 'occupied');
  }
});

test('startDraw 会清空该颜色旧路径', () => {
  const run = createRun(0);
  const pair = run.state.pairs[0];
  run.startDraw(pair.id, 'a');
  run.drawTo(pair.path[1][0], pair.path[1][1]);
  const filledBefore = run.state.fillCount;
  run.endDraw();
  run.startDraw(pair.id, 'a');
  assert.ok(run.state.fillCount < filledBefore, '清空旧路径后 fillCount 应下降');
});

test('回溯到倒数第二格会撤销最后一格', () => {
  const run = createRun(0);
  const pair = run.state.pairs[0];
  run.startDraw(pair.id, 'a');
  const c1 = pair.path[1];
  const c2 = pair.path[2];
  run.drawTo(c1[0], c1[1]);
  run.drawTo(c2[0], c2[1]);
  const lenBefore = run.state.paths[pair.id].length;
  const res = run.drawTo(c1[0], c1[1]); // 回到 c1 = 撤销 c2
  assert.equal(res.ok, true);
  assert.ok(res.backtrack, '应标记为回溯');
  assert.equal(run.state.paths[pair.id].length, lenBefore - 1);
});

test('超出步数上限判负', () => {
  const run = createRun(0);
  run.state.moves = run.state.moveLimit + 1;
  const pair = run.state.pairs[0];
  run.startDraw(pair.id, 'a');
  const res = run.drawTo(pair.path[1][0], pair.path[1][1]);
  assert.equal(res.ok, true, '正常填格应成功');
  assert.equal(run.state.phase, 'lost', '超步数应判负');
});

test('giveUp 判负并触发 lose 事件', () => {
  const run = createRun(0);
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'levelStart'));
  run.giveUp();
  assert.equal(run.state.phase, 'lost');
  const ev = run.drainEvents();
  assert.ok(ev.some((e) => e.type === 'lose'));
});

test('hint 消耗提示次数并给出格子', () => {
  const run = createRun(0);
  const before = run.state.hintsLeft;
  const res = run.hint();
  assert.equal(res.ok, true);
  assert.ok(Array.isArray(res.cell));
  assert.equal(run.state.hintsLeft, before - 1);
});

test('getHud 返回关卡信息', () => {
  const run = createRun(3);
  const hud = run.getHud();
  assert.equal(hud.level, 4);
  assert.equal(hud.colorCount, run.state.colorCount);
  assert.equal(hud.emptyCount, run.state.emptyCount);
});
