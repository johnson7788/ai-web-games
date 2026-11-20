import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { solve, par, normalizeLevel } from '../src/game/solver.js';

const SCENES = ['dusk-forest', 'aurora-ice', 'deep-space'];

test('关卡表：12 关、index 连续', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
});

test('关卡表：字段完整且类型合法', () => {
  for (const lv of LEVELS) {
    assert.ok(SCENES.includes(lv.scene), `L${lv.index} scene`);
    assert.ok(['nodes', 'edges'].includes(lv.mode), `L${lv.index} mode`);
    assert.ok(Number.isInteger(lv.start) && lv.start >= 0 && lv.start < lv.nodes.length, `L${lv.index} start`);
    assert.ok(Array.isArray(lv.nodes) && lv.nodes.length >= 3, `L${lv.index} nodes`);
    assert.ok(Array.isArray(lv.edges) && lv.edges.length >= 2, `L${lv.index} edges`);
    assert.ok(lv.name && lv.name.en && lv.name.zh, `L${lv.index} name`);
    assert.ok(typeof lv.newElement === 'string' && lv.newElement.trim(), `L${lv.index} newElement`);
  }
});

test('章节：三场景包各 4 关，换章必换', () => {
  const expect = ['dusk-forest', 'dusk-forest', 'dusk-forest', 'dusk-forest',
    'aurora-ice', 'aurora-ice', 'aurora-ice', 'aurora-ice',
    'deep-space', 'deep-space', 'deep-space', 'deep-space'];
  assert.deepEqual(LEVELS.map((lv) => lv.scene), expect);
});

test('模式：L1-5/L7-10/L12 为 nodes，L6/L11 为 edges', () => {
  const edgeLevels = LEVELS.filter((lv) => lv.mode === 'edges').map((lv) => lv.index);
  assert.deepEqual(edgeLevels, [6, 11]);
});

test('节点坐标均在 [0,1] 归一化区间内', () => {
  for (const lv of LEVELS) {
    for (const n of lv.nodes) {
      assert.ok(n.x >= 0 && n.x <= 1 && n.y >= 0 && n.y <= 1, `L${lv.index} 坐标越界`);
    }
  }
});

test('边引用的节点 id 合法，且无平行重复边', () => {
  for (const lv of LEVELS) {
    const seen = new Set();
    for (const e of lv.edges) {
      const a = e.a ?? e[0];
      const b = e.b ?? e[1];
      assert.ok(a >= 0 && a < lv.nodes.length && b >= 0 && b < lv.nodes.length, `L${lv.index} 边越界`);
      assert.notEqual(a, b, `L${lv.index} 自环`);
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      assert.ok(!seen.has(key), `L${lv.index} 平行边 ${key}`);
      seen.add(key);
    }
  }
});

test('可解性：12 关全部有解，par == 解长度-1', () => {
  for (const lv of LEVELS) {
    const p = solve(lv);
    assert.ok(p, `L${lv.index} 无解`);
    assert.equal(p[0], lv.start, `L${lv.index} 起点`);
    assert.equal(par(lv), p.length - 1, `L${lv.index} par`);
  }
});

test('解的合法性：相邻步之间存在允许的丝线，且覆盖目标', () => {
  for (const lv of LEVELS) {
    const L = normalizeLevel(lv);
    const p = solve(lv);
    const edgeSet = new Set();
    for (const e of L.edges) {
      edgeSet.add(`${e.a}-${e.b}`);
      edgeSet.add(`${e.b}-${e.a}`);
    }
    for (let i = 0; i < p.length - 1; i += 1) {
      assert.ok(edgeSet.has(`${p[i]}-${p[i + 1]}`), `L${lv.index} 解中存在非法步 ${p[i]}->${p[i + 1]}`);
    }
    if (lv.mode === 'nodes') {
      assert.equal(new Set(p).size, lv.nodes.length, `L${lv.index} 应访问每个星子一次`);
    }
  }
});

test('L1 为三节点链（起手教学关）', () => {
  const lv = LEVELS[0];
  assert.equal(lv.mode, 'nodes');
  assert.equal(lv.nodes.length, 3);
  assert.equal(lv.edges.length, 2);
  assert.equal(lv.start, 0);
  assert.equal(lv.scene, 'dusk-forest');
});

test('每关新元素 12 条互不重复', () => {
  const elems = LEVELS.map((lv) => lv.newElement.trim());
  assert.equal(new Set(elems).size, 12);
});

test('第 8 关含断线 gate，第 7/9/11 含单向边', () => {
  const lv8 = LEVELS[7];
  assert.ok(lv8.edges.some((e) => (e.gate ?? -1) >= 0), 'L8 应有 gate 边');
  const lv7 = LEVELS[6];
  assert.ok(lv7.edges.some((e) => (e.dir ?? 0) !== 0), 'L7 应有单向边');
  const lv11 = LEVELS[10];
  assert.ok(lv11.edges.every((e) => (e.dir ?? 0) !== 0), 'L11 全部单向');
});
