import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { STEP } from '../config/game.config.js';
import { neighbors } from '../src/game/hex.js';

function singleShape(run) {
  run.shapes = [{ offsets: [[0, 0]], rot: 0, pollen: false }];
  run.selected = 0;
  return run;
}

function fillLine(run, line, skip = null) {
  for (const i of line) {
    if (i === skip) continue;
    run.cells[i].filled = true;
    run.cells[i].color = 1;
  }
}

test('createRun 初始状态：61 格 / 27 线 / 3 形状 / 第 1 档', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.cells.length, 61);
  assert.equal(r.lines.length, 27);
  assert.equal(r.shapes.length, 3);
  assert.equal(r.tier, 1);
  assert.equal(r.phase, 'playing');
  assert.equal(r.score, 0);
});

test('step 每次推进 1/60 秒', () => {
  const r = createRun({ seed: 1 });
  r.step({});
  assert.ok(Math.abs(r.time - STEP) < 1e-9);
});

test('放单格块到空格会填充', () => {
  const r = singleShape(createRun({ seed: 1 }));
  const idx = r.cells.findIndex((c) => !c.filled && !c.wall);
  r.step({ hover: idx, drop: true });
  assert.equal(r.cells[idx].filled, true);
  assert.equal(r.placements, 1);
});

test('放到已占格会产生 blocked 事件且不填充', () => {
  const r = singleShape(createRun({ seed: 1 }));
  const idx = r.cells.findIndex((c) => !c.filled && !c.wall);
  r.cells[idx].filled = true;
  r.step({ hover: idx, drop: true });
  assert.equal(r.drainEvents().some((e) => e.type === 'blocked'), true);
  assert.equal(r.placements, 0);
});

test('整线填满会消除', () => {
  const r = createRun({ seed: 1 });
  const line = r.lines.find((l) => l.length === 5);
  fillLine(r, line);
  r._debug.eliminate();
  for (const i of line) assert.equal(r.cells[i].filled, false);
});

test('计分：放块 +10/格，消除 +50/格', () => {
  const r = singleShape(createRun({ seed: 1 }));
  const idx = r.cells.findIndex((c) => !c.filled && !c.wall);
  const before = r.score;
  r.step({ hover: idx, drop: true });
  assert.equal(r.score - before, 10);
  const line = r.lines.find((l) => l.length === 5 && l.every((i) => !r.cells[i].filled));
  fillLine(r, line);
  r._debug.eliminate();
  assert.equal(r.score, before + 10 + 5 * 50);
});

test('一次消 3 线触发金瀑 cascade', () => {
  const r = createRun({ seed: 1 });
  const rows = [4, 3, 2].map((rr) => r.lines.find((l) => {
    const cells = l.map((i) => r.cells[i]);
    return cells.every((c) => c.r === rr);
  })).filter(Boolean);
  assert.equal(rows.length, 3);
  for (const line of rows) fillLine(r, line);
  r._debug.eliminate();
  const events = r.drainEvents();
  assert.equal(events.some((e) => e.type === 'cascade'), true);
  assert.ok(r.stats.cascadeCount >= 1);
});

test('封蜡格需消两次', () => {
  const r = createRun({ seed: 1 });
  const line = r.lines.find((l) => l.length === 5);
  const waxCell = line[2];
  fillLine(r, line, waxCell); // 其余填满，蜡格留空
  r.cells[waxCell].wax = 2;    // 空蜡帽
  r._debug.eliminate();        // 还没填满，不消
  assert.equal(r.cells[waxCell].filled, false);

  // 放到蜡格 → 填满整线 → 第一次消除只破蜡
  r.cells[waxCell].filled = true;
  r.cells[waxCell].color = 1;
  r._debug.eliminate();
  assert.equal(r.cells[waxCell].filled, true, '蜡格第一次只破蜡不消失');
  assert.equal(r.cells[waxCell].wax, 1);
  assert.equal(r.cells[line[0]].filled, false, '同线其他格被消除');

  // 再次填满整线 → 第二次消除蜡格消失
  fillLine(r, line, waxCell);
  r._debug.eliminate();
  assert.equal(r.cells[waxCell].filled, false);
  assert.equal(r.cells[waxCell].wax, 0);
});

test('花粉块被消除后传染邻格', () => {
  const r = createRun({ seed: 1 });
  const line = r.lines.find((l) => l.length === 5);
  const pollenCell = line[2];
  fillLine(r, line, pollenCell);
  r.cells[pollenCell].filled = true;
  r.cells[pollenCell].color = 1;
  r.cells[pollenCell].pollen = true;
  r.cells[pollenCell].pollenAge = 3;

  // 找一个线外的已填邻格
  const lineSet = new Set(line);
  const c = r.cells[pollenCell];
  const offLineNeighbor = neighbors(c.q, c.r)
    .map(([q, rr]) => r.indexByCoord.get(`${q},${rr}`))
    .find((i) => i != null && !lineSet.has(i));
  r.cells[offLineNeighbor].filled = true;
  r.cells[offLineNeighbor].color = 1;

  r._debug.eliminate();
  const events = r.drainEvents();
  assert.equal(events.some((e) => e.type === 'pollenSpread'), true);
  assert.equal(r.cells[offLineNeighbor].filled, false, '花粉应传染清除邻格');
});

test('窄盘：applyNarrow 封外环并重算线', () => {
  const r = createRun({ seed: 1 });
  r._debug.applyNarrow();
  const walled = r.cells.filter((c) => c.wall);
  assert.ok(walled.length > 0, '外环应有墙');
  assert.ok(r.lines.every((l) => l.every((i) => !r.cells[i].wall)));
});

test('推进：分数达标升级并触发 tierUp', () => {
  const r = createRun({ seed: 1 });
  r.score = 100000;
  r._debug.advanceTier();
  assert.equal(r.tier, 12);
  assert.equal(r.drainEvents().some((e) => e.type === 'tierUp'), true);
});

test('判负：无合法落位则 dead', () => {
  const r = createRun({ seed: 1 });
  // 把除 1 格外的所有格填满（且无单格形状可放）
  r.shapes = [{ offsets: [[0, 0], [1, 0]], rot: 0, pollen: false }];
  for (const c of r.cells) { if (!c.wall) { c.filled = true; c.color = 1; } }
  const last = r.cells.find((c) => !c.wall);
  last.filled = false;
  r._debug.checkLose();
  assert.equal(r.phase, 'dead');
});

test('enumeratePlacements 返回合法落位', () => {
  const r = createRun({ seed: 1 });
  const ps = r.enumeratePlacements();
  assert.ok(ps.length > 0);
  for (const p of ps) {
    assert.ok(Array.isArray(p.cells) && p.cells.length >= 1);
    for (const i of p.cells) assert.equal(r.cells[i].filled, false);
  }
});

test('旋转形状后落位位置随旋转变化', () => {
  const r = createRun({ seed: 1 });
  r.shapes = [{ offsets: [[0, 0], [1, 0]], rot: 0, pollen: false }];
  r.selected = 0;
  const a = r.cells.find((c) => !c.filled && !c.wall);
  const idx0 = a ? r.indexByCoord.get(`${a.q},${a.r}`) : 0;
  const cells0 = r._debug.placementCells(r.shapes[0], idx0);
  r.shapes[0].rot = 1;
  const cells1 = r._debug.placementCells(r.shapes[0], idx0);
  assert.notDeepEqual(cells0, cells1);
});

test('drainEvents 返回并清空事件', () => {
  const r = singleShape(createRun({ seed: 1 }));
  const idx = r.cells.findIndex((c) => !c.filled && !c.wall);
  r.step({ hover: idx, drop: true });
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'place'));
  assert.deepEqual(r.drainEvents(), []);
});

test('近满线触发 nearMiss 事件', () => {
  const r = singleShape(createRun({ seed: 1 }));
  const line = r.lines.find((l) => l.length === 5);
  // 留两个空位，放一块后剩一个空位 → nearMiss
  fillLine(r, line, line[0]);
  fillLine(r, line, line[1]);
  r.cells[line[0]].filled = false;
  r.cells[line[1]].filled = false;
  r.step({ hover: line[0], drop: true });
  assert.equal(r.drainEvents().some((e) => e.type === 'nearMiss'), true);
});
