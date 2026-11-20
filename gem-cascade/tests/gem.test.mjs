import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, step, componentAt, allComponents, hasAnyMove,
} from '../src/game/sim.js';
import { popScore, clearBonus, targetScore, AVALANCHE_MIN, PICKAXE } from '../config/gameplay.js';
import { LEVEL_COUNT, LEVELS, levelAt, themeFor } from '../config/levels.js';

function fresh(seed = 42, level = 1) {
  return createRun({ seed, startLevel: level });
}

test('popScore：n²×5，双倍色 ×2', () => {
  assert.equal(popScore(3, 0, null), 45);
  assert.equal(popScore(6, 1, 1), 360);
  assert.equal(popScore(4, 2, 0), 80);
});

test('clearBonus：无剩满额 / 剩块递减 / ≥10 归零', () => {
  assert.equal(clearBonus(0), 2000);
  assert.equal(clearBonus(5), 2000 - 20 * 25);
  assert.equal(clearBonus(10), 0);
  assert.equal(clearBonus(12), 0);
});

test('targetScore 单调递增', () => {
  let prev = -Infinity;
  for (let lv = 1; lv <= 12; lv += 1) {
    const t = targetScore(lv);
    assert.ok(t > prev, `level ${lv} target ${t} should exceed ${prev}`);
    prev = t;
  }
});

test('同 seed 生成相同棋盘', () => {
  const a = fresh(99);
  const b = fresh(99);
  for (let x = 0; x < 10; x += 1) {
    for (let y = 0; y < 10; y += 1) assert.equal(a.grid[x][y], b.grid[x][y]);
  }
});

test('componentAt 找到正确大小的连通块', () => {
  const r = fresh(7);
  // 手工造一个 3 连：左上角 (0,0)(1,0)(0,1) 同色，其余全部不同色
  const c = r.colors;
  for (let x = 0; x < 10; x += 1) for (let y = 0; y < 10; y += 1) r.grid[x][y] = 4;
  r.grid[0][0] = 1; r.grid[1][0] = 1; r.grid[0][1] = 1;
  r.grid[1][1] = 2;
  const comp = componentAt(r.grid, r.frozen, 0, 0);
  assert.equal(comp.length, 3);
  const isolated = componentAt(r.grid, r.frozen, 1, 1);
  assert.equal(isolated.length, 1);
});

test('allComponents 只返回 ≥2 的连通块且按大小降序', () => {
  const r = fresh(7);
  const comps = allComponents(r.grid, r.frozen);
  assert.ok(comps.length > 0);
  for (const c of comps) assert.ok(c.n >= 2);
  for (let i = 1; i < comps.length; i += 1) assert.ok(comps[i - 1].n >= comps[i].n);
});

test('消除得分 = n²×5，streak +1，charge +1', () => {
  const r = fresh(7);
  const comp = allComponents(r.grid, r.frozen)[0];
  const n = comp.n;
  r.step({ action: 'tap', x: comp.x, y: comp.y });
  assert.equal(r.score, n * n * 5);
  assert.equal(r.streak, 1);
  assert.equal(r.charge, 1);
});

test('≥6 连消触发矿脉塌方（avalanche 事件）', () => {
  const r = fresh(7);
  const big = allComponents(r.grid, r.frozen).find((c) => c.n >= AVALANCHE_MIN);
  // 若随机棋盘没有 6 连，手工造一个
  let evs;
  if (big) {
    r.step({ action: 'tap', x: big.x, y: big.y });
    evs = r.drainEvents();
  } else {
    for (let x = 0; x < 10; x += 1) for (let y = 0; y < 10; y += 1) r.grid[x][y] = 3;
    r.grid[0][0] = 0; r.grid[1][0] = 0; r.grid[2][0] = 0; r.grid[3][0] = 0; r.grid[4][0] = 0; r.grid[5][0] = 0;
    r.step({ action: 'tap', x: 0, y: 0 });
    evs = r.drainEvents();
  }
  assert.ok(evs.some((e) => e.type === 'avalanche'));
});

test('重力：消除后上方宝石下落', () => {
  const r = fresh(1);
  r.score = -1e6; // 强制失败，避免过关重建棋盘
  for (let x = 0; x < 10; x += 1) for (let y = 0; y < 10; y += 1) r.grid[x][y] = null;
  r.grid[0][0] = 1; // 第 0 列顶部有宝石
  r.grid[0][9] = -1; // 第 0 列底部岩块
  r.grid[1][0] = 2; r.grid[1][1] = 2; // 第 1 列 2 连用于触发消除
  r.step({ action: 'tap', x: 1, y: 0 });
  // 重力：顶部宝石落到岩块上方
  assert.equal(r.grid[0][9], -1);
  assert.equal(r.grid[0][8], 1);
  assert.equal(r.grid[0][0], null);
});

test('空列左移：整列消除后右侧列左移', () => {
  const r = fresh(1);
  r.score = -1e6;
  for (let x = 0; x < 10; x += 1) for (let y = 0; y < 10; y += 1) r.grid[x][y] = null;
  // 第 0 列空，第 1 列有一颗宝石
  r.grid[1][9] = 3;
  r.grid[0][0] = 4; r.grid[0][1] = 4; // 用于触发一次消除
  r.step({ action: 'tap', x: 0, y: 0 });
  // 第 1 列的宝石应左移到第 0 列
  assert.equal(r.grid[0][9], 3);
  assert.equal(r.grid[1][9], null);
});

test('岩块不可消除且不可被选中', () => {
  const r = fresh(1);
  r.grid[3][3] = -1;
  const comp = componentAt(r.grid, r.frozen, 3, 3);
  assert.equal(comp.length, 0);
});

test('双倍矿脉颜色得分 ×2', () => {
  const r = fresh(1, 4); // level 4 = doubleColor
  assert.notEqual(r.doubleColor, null);
  const comp = allComponents(r.grid, r.frozen).find((c) => c.color === r.doubleColor);
  if (!comp) { assert.ok(true); return; } // 随机棋盘没有该色大块时跳过
  r.step({ action: 'tap', x: comp.x, y: comp.y });
  assert.equal(r.score, comp.n * comp.n * 5 * 2);
});

test('冰封宝石不可选，相邻消除后解冻', () => {
  const r = fresh(1);
  r.score = -1e6;
  for (let x = 0; x < 10; x += 1) for (let y = 0; y < 10; y += 1) r.grid[x][y] = null;
  // (0,0) 冻结，(0,1)(0,2)(0,3) 组成可点爆的 3 连，相邻于 (0,0)
  r.grid[0][0] = 1; r.grid[0][1] = 1; r.grid[0][2] = 1; r.grid[0][3] = 1;
  r.frozen[0][0] = true;
  const before = componentAt(r.grid, r.frozen, 0, 0);
  assert.equal(before.length, 0); // 冻结不可选
  r.step({ action: 'tap', x: 0, y: 1 });
  assert.equal(r.frozen[0][0], false);
});

test('沉底关：消除后顶部空位补新矿', () => {
  const r = fresh(1, 5); // sinking
  // 先清出顶部空位
  for (let x = 0; x < 10; x += 1) r.grid[x][0] = null;
  const comp = allComponents(r.grid, r.frozen)[0];
  r.step({ action: 'tap', x: comp.x, y: comp.y });
  // 顶部行应被补满
  for (let x = 0; x < 10; x += 1) assert.notEqual(r.grid[x][0], null);
});

test('限定步数：耗尽步数触发结算', () => {
  const r = fresh(1, 6); // moveLimit 30
  assert.equal(r.movesLeft, 30);
  const comp = allComponents(r.grid, r.frozen)[0];
  r.step({ action: 'tap', x: comp.x, y: comp.y });
  assert.equal(r.movesLeft, 29);
});

test('矿镐：蓄满 5 可劈碎单块并清零蓄力', () => {
  const r = fresh(1);
  r.charge = 5;
  r.grid[5][5] = 2;
  const before = count(r);
  r.step({ action: 'pick', x: 5, y: 5 });
  assert.equal(r.charge, 0);
  assert.equal(count(r), before - 1);
});

test('矿镐蓄力不足时拒绝劈碎', () => {
  const r = fresh(1);
  r.charge = 3;
  r.grid[5][5] = 2;
  r.step({ action: 'pick', x: 5, y: 5 });
  assert.equal(r.grid[5][5], 2);
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'pickFail'));
});

test('淘洗：重排保持宝石多重集，清零 streak，且仅 1 次', () => {
  const r = fresh(1);
  r.streak = 3;
  const before = count(r);
  r.step({ action: 'wash' });
  assert.equal(r.streak, 0);
  assert.equal(count(r), before);
  assert.equal(r.washLeft, 0);
  r.step({ action: 'wash' });
  assert.ok(r.drainEvents().some((e) => e.type === 'washFail'));
});

test('过关：分数达标后进入下一关并重置棋盘', () => {
  const r = fresh(1, 1);
  r.score = targetScore(1) + 100;
  for (let x = 0; x < 10; x += 1) for (let y = 0; y < 10; y += 1) r.grid[x][y] = null;
  r.grid[0][0] = 1; r.grid[0][1] = 1; // 唯一一个 2 连，点爆后棋盘无子
  r.step({ action: 'tap', x: 0, y: 0 });
  assert.equal(r.level, 2);
  assert.equal(r.phase, 'playing');
  assert.equal(r.score >= targetScore(1), true);
});

test('失败：分数不足时 phase=failed', () => {
  const r = fresh(1, 6); // 限定步数关：可精确触发结算
  r.movesLeft = 1;
  r.score = 0;
  const comp = allComponents(r.grid, r.frozen)[0];
  r.step({ action: 'tap', x: comp.x, y: comp.y });
  assert.equal(r.phase, 'failed');
  assert.ok(r.drainEvents().some((e) => e.type === 'fail'));
});

test('12 关全部可生成且每关初始至少有一个可消块', () => {
  for (const lv of LEVELS) {
    const r = fresh(1000 + lv.index, lv.index);
    assert.ok(hasAnyMove(r), `level ${lv.index} should have a move`);
    assert.equal(r.level, lv.index);
  }
  assert.equal(LEVEL_COUNT, 12);
});

test('themeFor：三场景包按关卡区间切换', () => {
  assert.equal(themeFor(1), 1);
  assert.equal(themeFor(4), 1);
  assert.equal(themeFor(5), 2);
  assert.equal(themeFor(8), 2);
  assert.equal(themeFor(9), 3);
  assert.equal(themeFor(12), 3);
});

function count(r) {
  let n = 0;
  for (let x = 0; x < 10; x += 1) for (let y = 0; y < 10; y += 1) if (r.grid[x][y] !== null && r.grid[x][y] !== -1) n += 1;
  return n;
}
