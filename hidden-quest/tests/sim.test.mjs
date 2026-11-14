import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, objectAt, clickAt, useHint, nextLevel, getHud } from '../src/game/sim.js';
import { OBJECT_TYPES } from '../config/objects.js';
import { RULES, CONFIG } from '../config/game.config.js';

test('初始化：5 个目标 + 干扰物，目标都在场景中', () => {
  const run = createRun({ level: 1, seed: 1 });
  assert.equal(run.targets.length, RULES.targetsPerLevel);
  const targetObjs = run.objects.filter((o) => o.isTarget);
  assert.equal(targetObjs.length, RULES.targetsPerLevel);
  assert.ok(run.objects.length > RULES.targetsPerLevel);
  for (const t of run.targets) {
    assert.ok(targetObjs.some((o) => o.type === t), `目标 ${t} 存在`);
  }
});

test('场景物体不重叠', () => {
  const run = createRun({ level: 1, seed: 5 });
  for (let i = 0; i < run.objects.length; i += 1) {
    for (let j = i + 1; j < run.objects.length; j += 1) {
      const a = run.objects[i];
      const b = run.objects[j];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= RULES.objectRadius * 2, '物体间距足够');
    }
  }
});

test('点击目标：找到 + 得分', () => {
  const run = createRun({ level: 1, seed: 1 });
  const target = run.objects.find((o) => o.isTarget);
  const r = clickAt(run, target.x, target.y);
  assert.equal(r.kind, 'find');
  assert.equal(target.found, true);
  assert.equal(run.score, RULES.scorePerFind);
});

test('点击干扰物：错误 + 扣分', () => {
  const run = createRun({ level: 1, seed: 1 });
  run.score = 100;
  const decoy = run.objects.find((o) => !o.isTarget);
  const r = clickAt(run, decoy.x, decoy.y);
  assert.equal(r.kind, 'wrong');
  assert.equal(run.score, 100 - RULES.wrongPenalty);
});

test('点击空白：无效果', () => {
  const run = createRun({ level: 1, seed: 1 });
  const r = clickAt(run, -100, -100);
  assert.equal(r.kind, 'empty');
});

test('找全目标 → 过关', () => {
  const run = createRun({ level: 1, seed: 1 });
  for (const o of run.objects.filter((x) => x.isTarget)) clickAt(run, o.x, o.y);
  assert.equal(run.phase, 'clear');
  assert.equal(run.found.size, run.targets.length);
});

test('提示：返回未找到目标、扣次数、用尽 null', () => {
  const run = createRun({ level: 1, seed: 1 });
  for (let i = 0; i < RULES.hintLimit; i += 1) {
    const h = useHint(run);
    assert.ok(h && h.isTarget && !h.found);
  }
  assert.equal(useHint(run), null);
});

test('下一关：关卡+1、新场景、保留分数', () => {
  const run = createRun({ level: 1, seed: 1 });
  run.score = 200;
  nextLevel(run);
  assert.equal(run.level, 2);
  assert.equal(run.score, 200);
  assert.equal(run.phase, 'playing');
  assert.equal(run.found.size, 0);
});

test('可复现：同 seed+level 场景一致', () => {
  const a = createRun({ level: 1, seed: 42 });
  const b = createRun({ level: 1, seed: 42 });
  assert.deepEqual(a.objects.map((o) => [o.type, Math.round(o.x), Math.round(o.y)]),
    b.objects.map((o) => [o.type, Math.round(o.x), Math.round(o.y)]));
});

test('配置默认值：12 物类型 / en+zh / 5 目标', () => {
  assert.equal(OBJECT_TYPES.length, 12);
  assert.equal(RULES.targetsPerLevel, 5);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun({ level: 1, seed: 1 })).total, 5);
});