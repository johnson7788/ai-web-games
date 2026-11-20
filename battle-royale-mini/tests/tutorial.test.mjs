import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TutorialMachine, TUT_STEP_IDS } from '../src/ui/tutorial.js';
import { themeFor, THEMES } from '../src/render/theme.js';

test('教程：4 步（move/shoot/loot/kill）', () => {
  assert.equal(TUT_STEP_IDS.length, 4);
  assert.deepEqual(TUT_STEP_IDS, ['move', 'shoot', 'loot', 'kill']);
});

test('教程：begin 后 active，重复 begin 无效', () => {
  const m = new TutorialMachine({});
  assert.equal(m.begin(), true);
  assert.equal(m.active, true);
  assert.equal(m.begin(), false);
});

test('教程：move 事件推进到第 2 步', () => {
  const m = new TutorialMachine({});
  m.begin();
  m.onGameEvent({ type: 'move' });
  assert.equal(m.step, 1);
});

test('教程：完整事件序列完成引导', () => {
  const m = new TutorialMachine({});
  m.begin();
  m.onGameEvent({ type: 'move' });
  m.onGameEvent({ type: 'shot' });
  m.onGameEvent({ type: 'pickup' });
  assert.equal(m.step, 3);
  m.onGameEvent({ type: 'kill' });
  assert.equal(m.done, true);
  assert.equal(m.active, false);
});

test('教程：skip 持久化 done', () => {
  let saved = null;
  const m = new TutorialMachine({ save: (k, v) => { saved = [k, v]; } });
  m.begin();
  m.skip();
  assert.equal(m.done, true);
  assert.deepEqual(saved, ['tutorial-done', true]);
});

test('教程：replay 可重看', () => {
  const m = new TutorialMachine({});
  m.begin();
  m.skip();
  assert.equal(m.replay(), true);
  assert.equal(m.active, true);
  assert.equal(m.step, 0);
});

test('教程：已持久化则不自动 begin', () => {
  const m = new TutorialMachine({ load: (k, d) => true });
  assert.equal(m.begin(), false);
  assert.equal(m.done, true);
});

test('主题：三套场景色板互不相同', () => {
  assert.equal(THEMES.length, 3);
  assert.notEqual(THEMES[0].floor, THEMES[1].floor);
  assert.notEqual(THEMES[1].floor, THEMES[2].floor);
  assert.notEqual(THEMES[0].floor, THEMES[2].floor);
});

test('主题：1-4 书桌 / 5-8 玩具城 / 9-12 夜库', () => {
  assert.equal(themeFor(1).id, 'desk');
  assert.equal(themeFor(4).id, 'desk');
  assert.equal(themeFor(5).id, 'toy');
  assert.equal(themeFor(8).id, 'toy');
  assert.equal(themeFor(9).id, 'night');
  assert.equal(themeFor(12).id, 'night');
});
