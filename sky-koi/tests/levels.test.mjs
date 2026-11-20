import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

const SCENES = ['dawn', 'sakura', 'night'];

test('关卡表：12 关、index 连续、场景三包轮换', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
  for (const lv of LEVELS) assert.ok(SCENES.includes(lv.scene));
});

test('关卡表：字段完整且类型合法', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.targetGates >= 3);
    assert.ok(lv.speed > 0);
    assert.ok(lv.gap > 0);
    assert.ok(lv.spacing > 0);
    assert.ok(Array.isArray(lv.gapRange) && lv.gapRange.length === 2 && lv.gapRange[0] < lv.gapRange[1]);
    assert.equal(typeof lv.pearl, 'boolean');
    assert.ok(lv.pearlTarget >= 0);
    assert.ok(lv.skimTarget >= 0);
    assert.equal(typeof lv.narrow, 'boolean');
    assert.equal(typeof lv.moving, 'boolean');
    assert.equal(typeof lv.wind, 'number');
    assert.equal(typeof lv.double, 'boolean');
    assert.equal(typeof lv.wave, 'number');
    assert.equal(typeof lv.dash, 'boolean');
    assert.ok(lv.newElement && typeof lv.newElement === 'string');
  }
});

test('每关 newElement 唯一（不重复）', () => {
  const elements = LEVELS.map((lv) => lv.newElement);
  assert.equal(new Set(elements).size, elements.length);
});

test('场景包：每章 4 关且不越界（dawn 1-3,11 / sakura 4-6 / night 7-10,12）', () => {
  const expectScene = (idx, scene) => assert.equal(LEVELS[idx - 1].scene, scene);
  [1, 2, 3, 11].forEach((i) => expectScene(i, 'dawn'));
  [4, 5, 6].forEach((i) => expectScene(i, 'sakura'));
  [7, 8, 9, 10, 12].forEach((i) => expectScene(i, 'night'));
});

test('珍珠关：pearl=true 时 pearlPerGate≥1', () => {
  for (const lv of LEVELS) {
    if (lv.pearl) assert.ok(lv.pearlPerGate >= 1, `L${lv.index} 珍珠关但无珍珠`);
  }
});

test('dash 关必须同时是珍珠关', () => {
  for (const lv of LEVELS) {
    if (lv.dash) assert.equal(lv.pearl, true, `L${lv.index} dash 但非珍珠关`);
  }
});

test('移动门/窄门/双门/侧风/巨浪至少各出现一次', () => {
  assert.ok(LEVELS.some((lv) => lv.moving));
  assert.ok(LEVELS.some((lv) => lv.narrow));
  assert.ok(LEVELS.some((lv) => lv.double));
  assert.ok(LEVELS.some((lv) => lv.wind > 0));
  assert.ok(LEVELS.some((lv) => lv.wave > 0));
});

test('难度递增：speed 大致逐关提升', () => {
  for (let i = 1; i < LEVELS.length; i += 1) {
    assert.ok(LEVELS[i].speed >= LEVELS[i - 1].speed, `L${i + 1} 速度不应低于 L${i}`);
  }
});
