// tests/euler.test.mjs — 欧拉路径纯逻辑 + 全关卡可解性验证。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT, SCENES } from '../config/levels.js';
import { edgeKey, degrees, components, hasEulerPath, oddVertices, hierholzer, solveLevel } from '../src/game/euler.js';

test('至少 24 关且 3 个场景包', () => {
  assert.ok(LEVEL_COUNT >= 24);
  assert.equal(SCENES.length, 3);
});

test('edgeKey 规范为小-大', () => {
  assert.equal(edgeKey(3, 1), '1-3');
  assert.equal(edgeKey(1, 3), '1-3');
});

test('degrees 统计每条并行边', () => {
  assert.deepEqual(degrees(3, [[0, 1], [1, 2], [0, 2]]), [2, 2, 2]);
});

test('components 识别孤立与连通', () => {
  const { comp, count } = components(4, [[0, 1], [2, 3]]);
  assert.equal(count, 2);
  assert.equal(comp[0], comp[1]);
  assert.equal(comp[2], comp[3]);
  assert.notEqual(comp[0], comp[2]);
});

test('hasEulerPath 判定奇点 0/2', () => {
  assert.equal(hasEulerPath(3, [[0, 1], [1, 2]]), true);   // 2 奇点
  assert.equal(hasEulerPath(3, [[0, 1], [1, 2], [2, 0]]), true); // 0 奇点
  assert.equal(hasEulerPath(5, [[0, 1], [1, 2], [0, 3], [0, 4]]), false); // 4 奇点
});

test('oddVertices 返回奇度节点', () => {
  assert.deepEqual(oddVertices(3, [[0, 1], [1, 2]]), [0, 2]);
  assert.deepEqual(oddVertices(3, [[0, 1], [1, 2], [2, 0]]), []);
});

test('hierholzer 解回路覆盖所有边', () => {
  const edges = [[0, 1], [1, 2], [2, 0]];
  const trail = hierholzer(3, edges, 0);
  assert.ok(trail);
  assert.equal(trail.length, 4);
  assert.equal(trail[0], 0);
  assert.equal(trail[trail.length - 1], 0);
});

// 每关：每个分量欧拉路径存在 + hierholzer 全量解出
for (const L of LEVELS) {
  test(`关卡 ${L.id} ${L.name} 每个分量可解（欧拉路径）`, () => {
    assert.ok(L.components.length >= 1);
    for (const c of L.components) {
      assert.ok(hasEulerPath(c.nodes.length, c.edges), `分量奇点不是 0/2`);
      const tr = hierholzer(c.nodes.length, c.edges, c.start);
      assert.ok(tr, 'hierholzer 无解');
      assert.equal(tr.length, c.edges.length + 1, '轨迹未覆盖所有边');
    }
    assert.ok(L.nodeCount >= 5 || L.type === 'dual' || L.nodeCount >= 5);
  });

  test(`关卡 ${L.id} ${L.name} 节点数在 5..18 之间`, () => {
    const total = L.components.reduce((s, c) => s + c.nodes.length, 0);
    assert.ok(total >= 5 && total <= 18, `总节点 ${total}`);
  });
}

test('solveLevel 返回每分量轨迹', () => {
  const L = LEVELS[0];
  const sols = solveLevel(L);
  assert.equal(sols.length, L.components.length);
  assert.ok(sols[0].trail.length === L.components[0].edges.length + 1);
});

test('四种边型齐全（open/circuit/waypoint/dual）', () => {
  const types = new Set(LEVELS.map((l) => l.type));
  for (const t of ['open', 'circuit', 'waypoint', 'dual']) assert.ok(types.has(t), `缺 ${t}`);
});

test('流星干扰只在指定边且周期合法', () => {
  const meteors = LEVELS.filter((l) => l.meteor);
  assert.ok(meteors.length >= 3);
  for (const m of meteors) {
    assert.ok(Array.isArray(m.meteor.edge) && m.meteor.edge.length === 2);
    assert.ok(m.meteor.blockedSec === 2);
  }
});
