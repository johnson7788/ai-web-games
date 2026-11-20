// tests/sim.test.mjs — 模拟核心：走边 / 走错重置段 / 过关 / 失败 / 流星 / 双星图 / 计分。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, flattenLevel } from '../src/game/sim.js';
import { getLevel, LEVELS } from '../config/levels.js';

function drain(run) {
  const evs = run.drainEvents();
  run.events = [];
  return evs;
}

test('createRun：初始状态与起点', () => {
  const run = createRun({ levelIndex: 0 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.current, run.compStartGlobal[0]);
  assert.equal(run.steps, 0);
  assert.equal(run.mistakes, 0);
  assert.equal(run.time, 0);
});

test('step 走一条有效边：轨迹与已用边更新', () => {
  const run = createRun({ levelIndex: 0 });
  run.step({ to: 1 });
  assert.equal(run.current, 1);
  assert.deepEqual(run.trail, [0, 1]);
  assert.ok(run.usedEdges.has('0-1'));
  assert.equal(run.steps, 1);
});

test('走错（无邻接边）重置当前段并记失误', () => {
  const run = createRun({ levelIndex: 0 });
  run.beginSegment();
  run.step({ to: 1 });
  run.step({ to: 2 });
  run.step({ to: 0 }); // 0-2 无边 → 走错
  assert.equal(run.mistakes, 1);
  assert.equal(run.current, 0);       // 段锚点回到 0
  assert.equal(run.trail.length, 1);  // 段被撤销
  assert.equal(run.usedEdges.size, 0);
});

test('过关：连完所有边 → won + 计分', () => {
  const run = createRun({ levelIndex: 0 });
  for (const to of [1, 2, 3, 4]) run.step({ to });
  assert.equal(run.phase, 'won');
  assert.ok(run.stats.score > 0);
  assert.ok(run.stats.stars >= 1 && run.stats.stars <= 3);
  const types = drain(run).map((e) => e.type);
  assert.ok(types.includes('win'));
});

test('超时失败：time 超过时限 → failed', () => {
  const run = createRun({ levelIndex: 0 });
  run.time = run.level.timeLimitSec;
  run.step({});
  assert.equal(run.phase, 'failed');
});

test('event 事件：edge 携带进度与步数', () => {
  const run = createRun({ levelIndex: 0 });
  drain(run); // 清掉 levelStart
  run.step({ to: 1 });
  const evs = drain(run);
  assert.equal(evs[0].type, 'edge');
  assert.equal(evs[0].used, 1);
  assert.equal(evs[0].total, 4);
});

test('waypoint 关卡：到达北极星发 waypoint 事件', () => {
  const run = createRun({ levelIndex: 5 }); // Cassiopeia Crown（waypoint）
  const wp = run.level.waypoint;
  const wpGlobal = run.localToGlobal[0][wp];
  // 沿 hierholzer 轨迹走到必经点
  const sol = run.solution()[0].trail;
  let reached = false;
  for (let i = 1; i < sol.length; i += 1) {
    run.step({ to: sol[i] });
    if (sol[i] === wpGlobal) reached = true;
  }
  assert.ok(reached, '必经点应在轨迹上');
  assert.ok(run.waypointVisited);
});

test('流星干扰：遮住边时走该边算走错', () => {
  const run = createRun({ levelIndex: 9 }); // Cygnus Wing（meteor）
  assert.ok(run.level.meteor);
  const [a, b] = run.level.meteor.edge;
  const ga = run.localToGlobal[0][a];
  const gb = run.localToGlobal[0][b];
  run.step({}); // 推进时间，让流星状态更新
  const blocked = run.meteorBlockedKey;
  assert.ok(blocked, '开局应在流星遮挡窗口内');
  run.beginSegment();
  run.step({ to: gb }); // 0→弦端点（被遮）→ 走错
  assert.equal(run.mistakes, 1);
  void ga;
});

test('双星图：画完当前子图后可切笔到另一子图', () => {
  const run = createRun({ levelIndex: 3 }); // Lyra Twin（dual，3+3 回路）
  // 子图 0（全局 0,1,2）
  run.step({ to: 1 });
  run.step({ to: 2 });
  run.step({ to: 0 });
  assert.equal(run.usedEdges.size, 3);
  // 切笔到子图 1 起点（全局 3）
  run.step({ to: 3 });
  assert.equal(run.current, 3);
  const types = drain(run).map((e) => e.type);
  assert.ok(types.includes('brushSwitch'));
  // 画完子图 1 → 过关
  run.step({ to: 4 });
  run.step({ to: 5 });
  run.step({ to: 3 });
  assert.equal(run.phase, 'won');
});

test('flattenLevel：多分量拍平成全局索引', () => {
  const flat = flattenLevel(getLevel(3));
  assert.equal(flat.compOffsets.length, 2);
  assert.equal(flat.nodes.length, 6);
  assert.equal(flat.edges.length, 6);
  assert.equal(flat.compStartGlobal[1], 3);
});

test('solution()：贪心 bot 可用轨迹覆盖全边', () => {
  for (const L of LEVELS) {
    const run = createRun({ levelIndex: L.id - 1 });
    for (const compSol of run.solution()) {
      const c = run.level.components[compSol.component];
      assert.equal(compSol.trail.length, c.edges.length + 1);
    }
  }
});

test('计分：失误与步数惩罚使分数下降', () => {
  const clean = createRun({ levelIndex: 0 });
  for (const to of [1, 2, 3, 4]) clean.step({ to });
  const messy = createRun({ levelIndex: 0 });
  messy.beginSegment();
  messy.step({ to: 2 }); // 0→2 无边，走错一次
  messy.beginSegment();
  for (const to of [1, 2, 3, 4]) messy.step({ to });
  assert.equal(messy.mistakes, 1);
  assert.ok(messy.stats.score < clean.stats.score, `${messy.stats.score} < ${clean.stats.score}`);
});
