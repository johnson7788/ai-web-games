import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NODES, getNode, nodeCount } from '../config/story.js';
import { ENDINGS, resolveEnding, endingById } from '../config/endings.js';
import { createRun } from '../src/game/sim.js';
import { CHAPTER_COUNT } from '../config/gameplay.js';

function playPath(run, indices) {
  for (let i = 0; i < indices.length; i += 1) {
    run.step({ choice: indices[i] });
    run.step({ advance: true });
  }
}

test('剧情图无死链：每个 next 都指向存在的节点或 ending', () => {
  const ids = new Set(NODES.map((n) => n.id));
  for (const node of NODES) {
    for (const c of node.choices) {
      assert.ok(c.next === 'ending' || ids.has(c.next), `${node.id} 的 next=${c.next} 是死链`);
    }
  }
});

test('12 个章节齐全（1..12）且每个具体节点章节号合法', () => {
  const chapters = new Set(NODES.map((n) => n.chapter));
  for (let i = 1; i <= CHAPTER_COUNT; i += 1) {
    assert.ok(chapters.has(i), `缺第 ${i} 章`);
  }
  for (const n of NODES) {
    assert.ok(n.chapter >= 1 && n.chapter <= CHAPTER_COUNT);
  }
});

test('具体剧情节点数 = 18（9 线性 + 3 弧线 × 3）', () => {
  assert.equal(nodeCount(), 18);
  assert.equal(NODES.length, 18);
});

test('8 个结局齐全且 id 唯一', () => {
  assert.equal(ENDINGS.length, 8);
  const ids = new Set(ENDINGS.map((e) => e.id));
  assert.equal(ids.size, 8);
});

test('每章文本/选项/结果 en/zh 双语文案齐全且非空', () => {
  for (const n of NODES) {
    assert.ok(n.text.en && n.text.zh, `${n.id} 缺文本`);
    assert.ok(n.choices.length >= 2 && n.choices.length <= 3, `${n.id} 选项数应在 2-3`);
    for (const c of n.choices) {
      assert.ok(c.text.en && c.text.zh, `${n.id} 选项缺文本`);
      assert.ok(c.result.en && c.result.zh, `${n.id} 结果缺文本`);
    }
  }
});

test('限时节点都有 timeLimitSec 与 default', () => {
  for (const n of NODES) {
    if (n.timed) {
      assert.ok(n.timeLimitSec > 0, `${n.id} 缺 timeLimitSec`);
      assert.ok(Number.isInteger(n.default) && n.default >= 0 && n.default < n.choices.length, `${n.id} default 越界`);
    }
  }
});

test('至少 6 章文案总量（≥60 节点文本）', () => {
  let count = 0;
  for (const n of NODES) {
    count += 2; // text en+zh
    for (const c of n.choices) count += 4; // choice text + result text，各 en+zh
  }
  assert.ok(count >= 60, `节点文本总数=${count}`);
});

// ---- 8 结局可达（每条路径由 reachability 搜索确定，确定性复现）----
const ENDING_PATHS = [
  ['queen', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
  ['home', [0, 0, 1, 2, 0, 1, 1, 1, 0, 2, 1, 2]],
  ['corp_peak', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2]],
  ['corp_steady', [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2]],
  ['startup_ipo', [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 2]],
  ['startup_survivor', [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2]],
  ['partner_cofound', [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0]],
  ['partner_out', [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 1, 1]],
];

for (const [endingId, path] of ENDING_PATHS) {
  test(`结局可达：${endingId}（路径 ${path.join(',')}）`, () => {
    const run = createRun({ seed: 42 });
    playPath(run, path);
    assert.equal(run.phase, 'ended');
    assert.equal(run.ending.id, endingId);
  });
}

test('resolveEnding 对每条弧线都总能返回结局（totality）', () => {
  for (const arc of ['corp', 'startup', 'partner', null]) {
    const e = resolveEnding({ abi: 0, net: 0, sav: 0, mentor: 0, partner: 0, brand: 0, arc });
    assert.ok(e && e.id, `arc=${arc} 应有结局`);
    assert.ok(endingById(e.id));
  }
});
