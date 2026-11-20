import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TutorialMachine, TUT_STEP_IDS } from '../src/ui/tutorial.js';

test('教程：3 步，初始未激活', () => {
  const m = new TutorialMachine({});
  assert.equal(m.total, 3);
  assert.equal(TUT_STEP_IDS.length, 3);
  assert.equal(m.active, false);
});

test('教程：begin 激活并持久化状态可查', () => {
  const m = new TutorialMachine({});
  assert.equal(m.begin(), true);
  assert.equal(m.active, true);
  assert.equal(m.step, 0);
  assert.equal(m.begin(), false, '已激活不应重复开始');
});

test('教程：aim → shot → asteroidBreak 依次推进', () => {
  const m = new TutorialMachine({});
  m.begin();
  m.onGameEvent({ type: 'aim' });
  assert.equal(m.step, 1);
  m.onGameEvent({ type: 'shot' });
  assert.equal(m.step, 2);
  m.onGameEvent({ type: 'asteroidBreak' });
  assert.equal(m.step, 3);
  assert.equal(m.done, true);
  assert.equal(m.active, false);
});

test('教程：无关事件不推进', () => {
  const m = new TutorialMachine({});
  m.begin();
  m.onGameEvent({ type: 'ballBounce' });
  assert.equal(m.step, 0);
});

test('教程：skip 持久化并标记 done', () => {
  let saved = null;
  const m = new TutorialMachine({ save: (k, v) => { saved = [k, v]; } });
  m.begin();
  m.skip();
  assert.equal(m.done, true);
  assert.deepEqual(saved, ['tutorial-done', true]);
});

test('教程：load 已持久化则 begin 返回 false', () => {
  const m = new TutorialMachine({ load: () => true });
  assert.equal(m.begin(), false);
  assert.equal(m.done, true);
});
