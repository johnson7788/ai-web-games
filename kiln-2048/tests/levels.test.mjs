import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT, SPAWN_TABLES } from '../config/levels.js';

const SCENES = ['morning-workshop', 'dusk-kiln', 'night-fire'];

test('关卡表：12 关、index 连续、三章各 4 关', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
  assert.deepEqual(
    LEVELS.map((l) => l.scene),
    ['morning-workshop', 'morning-workshop', 'morning-workshop', 'morning-workshop',
      'dusk-kiln', 'dusk-kiln', 'dusk-kiln', 'dusk-kiln',
      'night-fire', 'night-fire', 'night-fire', 'night-fire'],
  );
});

test('关卡表：字段完整且类型合法', () => {
  for (const lv of LEVELS) {
    assert.ok(SCENES.includes(lv.scene));
    assert.ok(lv.goal && ['mergeTo', 'eliminate', 'score'].includes(lv.goal.type));
    assert.ok(typeof lv.eliminateAt === 'number' && lv.eliminateAt >= 256 && lv.eliminateAt <= 2048);
    assert.ok(typeof lv.hammer === 'number' && lv.hammer >= 0 && lv.hammer <= 2);
    assert.ok(lv.preview >= 1 && lv.preview <= 3);
    assert.ok(typeof lv.kilnInset === 'number' && lv.kilnInset >= 0);
    assert.ok(SPAWN_TABLES[lv.spawn], `L${lv.index} spawn 表存在`);
    assert.ok(lv.newElement && typeof lv.newElement === 'string');
    assert.ok(lv.name.en && lv.name.zh);
  }
});

test('目标数值与出窑阈值一致（eliminate 关的 target == eliminateAt）', () => {
  for (const lv of LEVELS) {
    if (lv.goal.type === 'eliminate') {
      assert.equal(lv.goal.target, lv.eliminateAt, `L${lv.index} eliminate target 应与 eliminateAt 一致`);
    }
  }
});

test('每关新元素不重复', () => {
  const els = LEVELS.map((l) => l.newElement.trim());
  assert.equal(new Set(els).size, els.length);
});

test('前 3 关无特性（教学），第 4 关起逐步加机制', () => {
  for (let i = 0; i < 3; i += 1) {
    assert.deepEqual(LEVELS[i].features, {}, `L${i + 1} 应为常规关`);
  }
  assert.equal(LEVELS[3].features.distract, true);
  assert.equal(LEVELS[4].features.frozen, true);
  assert.equal(LEVELS[5].features.dualGlaze, true);
  assert.equal(LEVELS[7].features.narrow, true);
});

test('第 9 关起为夜焰章，窑火更旺（fire 投放表）', () => {
  for (let i = 8; i < 12; i += 1) {
    assert.equal(LEVELS[i].spawn, 'fire');
    assert.equal(LEVELS[i].scene, 'night-fire');
  }
});

test('重锤：第 4 关解锁 1 次，第 10 关起 2 次', () => {
  assert.equal(LEVELS[0].hammer, 0);
  assert.equal(LEVELS[3].hammer, 1);
  assert.equal(LEVELS[9].hammer, 2);
  assert.equal(LEVELS[11].hammer, 2);
});

test('spawn 表：权重为正且总和≈100，值含 2..1024', () => {
  for (const [name, table] of Object.entries(SPAWN_TABLES)) {
    const total = table.reduce((s, [, w]) => s + w, 0);
    assert.ok(Math.abs(total - 100) < 0.01, `${name} 权重和=${total}`);
    const vals = table.map(([v]) => v);
    assert.ok(vals.includes(2) && vals.includes(1024));
    assert.ok(!vals.includes(2048), `${name} 不应直接投放 2048`);
    assert.ok(vals.every((v, i) => i === 0 || v > vals[i - 1]), `${name} 应升序`);
  }
});
