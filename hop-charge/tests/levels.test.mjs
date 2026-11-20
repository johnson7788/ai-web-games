import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT, PLATFORM_W } from '../config/levels.js';
import { createRun, greedyCharge } from '../src/game/sim.js';

const SCENES = ['dusk-town', 'rainy-street', 'misty-peak'];
const TYPES = ['normal', 'moving', 'spring', 'ice', 'narrow'];

test('关卡表：12 关、index 连续', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
});

test('关卡表：字段完整且类型合法', () => {
  for (const lv of LEVELS) {
    assert.ok(SCENES.includes(lv.scene), `L${lv.index} scene 非法`);
    assert.ok(lv.goalJumps >= 3);
    assert.ok(lv.timeLimit > 0);
    assert.ok(lv.spacing && typeof lv.spacing.base === 'number');
    assert.ok(lv.spacing.min < lv.spacing.max);
    assert.ok(lv.spacing.base >= lv.spacing.min && lv.spacing.base <= lv.spacing.max);
    assert.ok(Array.isArray(lv.typeCycle) && lv.typeCycle.length > 0);
    for (const t of lv.typeCycle) assert.ok(TYPES.includes(t), `L${lv.index} 非法台型 ${t}`);
    assert.equal(typeof lv.wind, 'boolean');
    assert.ok(lv.newElement && lv.newElement.length > 0);
  }
});

test('三场景包：按章换景（L1-4 暮色瓦镇 / L5-8 雨夜灯笼街 / L9-12 晨雾山顶）', () => {
  for (const lv of LEVELS) {
    const expect = lv.index <= 4 ? 'dusk-town' : lv.index <= 8 ? 'rainy-street' : 'misty-peak';
    assert.equal(lv.scene, expect, `L${lv.index} 场景应随章切换`);
  }
});

test('每关新元素唯一', () => {
  const els = LEVELS.map((l) => l.newElement);
  assert.equal(new Set(els).size, els.length);
});

test('目标跳数单调递增（3→10）', () => {
  for (let i = 1; i < LEVELS.length; i += 1) {
    assert.ok(LEVELS[i].goalJumps >= LEVELS[i - 1].goalJumps, `L${LEVELS[i].index} goalJumps 不应回退`);
  }
  assert.equal(LEVELS[0].goalJumps, 3);
  assert.equal(LEVELS[11].goalJumps, 10);
});

test('逆风只出现在 L8/L11/L12', () => {
  for (const lv of LEVELS) {
    assert.equal(lv.wind, [8, 11, 12].includes(lv.index), `L${lv.index} wind 与设计不符`);
  }
});

test('平台宽表：断头台明显更窄', () => {
  assert.ok(PLATFORM_W.narrow < PLATFORM_W.normal);
  for (const t of TYPES) assert.ok(PLATFORM_W[t] > 0);
  assert.ok(PLATFORM_W.start > 0);
});

test('特性台型与关卡设计对应', () => {
  assert.ok(LEVELS[3].typeCycle.includes('moving'), 'L4 移动台');
  assert.ok(LEVELS[4].typeCycle.includes('spring'), 'L5 弹簧台');
  assert.ok(LEVELS[5].typeCycle.includes('ice'), 'L6 冰面台');
  assert.ok(LEVELS[6].typeCycle.includes('narrow'), 'L7 断头台');
  assert.ok(LEVELS[11].typeCycle.includes('narrow'), 'L12 大师关含断头台');
});

test('每关都可由贪心助手给出合法第一跳', () => {
  for (let i = 0; i < LEVELS.length; i += 1) {
    const r = createRun(i, { seed: 1 });
    const gc = greedyCharge(r);
    assert.ok(gc, `L${i + 1} 贪心助手失败`);
    assert.ok(gc.charge > 0 && gc.charge <= 1.6 + 1e-9, `L${i + 1} charge=${gc.charge}`);
  }
});

test('平台间距不越界（min≤间距≤max）', () => {
  for (const lv of LEVELS) {
    const r = createRun(lv.index - 1, { seed: 1 });
    for (let i = 1; i < r.state.platforms.length; i += 1) {
      const d = r.state.platforms[i].x - r.state.platforms[i - 1].x;
      assert.ok(d >= lv.spacing.min - 1e-6 && d <= lv.spacing.max + 1e-6, `L${lv.index} 间距 ${d} 越界`);
    }
  }
});
