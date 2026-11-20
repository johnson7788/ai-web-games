// tests/levels.test.mjs — 关卡配置完整性（纯逻辑，无 DOM）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../config/levels.js';

const GLYPHS = new Set([
  'circle', 'rect', 'star', 'cloud', 'sun', 'moon', 'bottle',
  'person', 'plant', 'bird', 'key', 'gear', 'card', 'cup', 'bulb', 'arrow',
]);

test('24 关、id 连续、每章 6 关', () => {
  assert.equal(LEVELS.length, 24);
  LEVELS.forEach((l, i) => assert.equal(l.id, i + 1));
  for (let ch = 1; ch <= 4; ch += 1) {
    assert.equal(LEVELS.filter((l) => l.chapter === ch).length, 6, `chapter ${ch} 应为 6 关`);
  }
});

test('每关标题/目标/提示/吐槽 中英齐全且非空', () => {
  for (const l of LEVELS) {
    for (const field of ['title', 'goal', 'hint', 'roast']) {
      assert.ok(l[field].en && l[field].en.trim(), `L${l.id} ${field}.en 空`);
      assert.ok(l[field].zh && l[field].zh.trim(), `L${l.id} ${field}.zh 空`);
    }
  }
});

test('每关至少 1 个物体、1 步解法，且 glyph 合法', () => {
  for (const l of LEVELS) {
    assert.ok(l.objects.length >= 1, `L${l.id} 无物体`);
    assert.ok(l.solution.length >= 1, `L${l.id} 无解法`);
    for (const o of l.objects) {
      assert.ok(GLYPHS.has(o.glyph), `L${l.id} ${o.id} glyph 非法: ${o.glyph}`);
      assert.ok(o.label.en && o.label.zh, `L${l.id} ${o.id} label 缺失`);
    }
  }
});

test('解法引用的物体都存在，dragTo 目标存在且源可拖拽', () => {
  for (const l of LEVELS) {
    const ids = new Set(l.objects.map((o) => o.id));
    for (const req of l.solution) {
      if (req.kind === 'tap' || req.kind === 'tapN' || req.kind === 'shadow' || req.kind === 'dragOff') {
        assert.ok(ids.has(req.id), `L${l.id} 解法引用不存在的物体 ${req.id}`);
        if (req.kind === 'dragOff') {
          const o = l.objects.find((x) => x.id === req.id);
          assert.ok(o.draggable, `L${l.id} dragOff 目标 ${req.id} 应可拖拽`);
        }
      } else if (req.kind === 'dragTo') {
        assert.ok(ids.has(req.id), `L${l.id} dragTo 源 ${req.id} 不存在`);
        assert.ok(ids.has(req.targetId), `L${l.id} dragTo 目标 ${req.targetId} 不存在`);
        const src = l.objects.find((x) => x.id === req.id);
        assert.ok(src.draggable, `L${l.id} dragTo 源 ${req.id} 应可拖拽`);
      }
    }
  }
});

test('被遮挡物 coveredBy 引用存在的盖子；rotate 关有 handle', () => {
  for (const l of LEVELS) {
    const ids = new Set(l.objects.map((o) => o.id));
    for (const o of l.objects) {
      if (o.coveredBy) assert.ok(ids.has(o.coveredBy), `L${l.id} ${o.id} coveredBy 不存在`);
    }
    if (l.rotate) assert.ok(ids.has('handle'), `L${l.id} rotate 关缺 handle`);
  }
});

test('strict 多步关解法 ≥2 步；每个 id 在关卡内唯一', () => {
  for (const l of LEVELS) {
    if (l.strict) assert.ok(l.solution.length >= 2, `L${l.id} strict 但只有 ${l.solution.length} 步`);
    const seen = new Set();
    for (const o of l.objects) {
      assert.ok(!seen.has(o.id), `L${l.id} 重复 id ${o.id}`);
      seen.add(o.id);
    }
  }
});
