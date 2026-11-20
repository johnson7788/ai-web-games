import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TutorialMachine, TUT_STEP_IDS, TUTORIAL_KEY } from '../src/ui/tutorial.js';

function makeMachine(store = {}) {
  return new TutorialMachine({
    save: (k, v) => { store[k] = v; },
    load: (k, d) => (k in store ? store[k] : d),
  });
}

test('教程：4 步、默认未完成', () => {
  const m = makeMachine();
  assert.equal(m.total, 4);
  assert.deepEqual(TUT_STEP_IDS, ['move', 'food', 'prey', 'avoid']);
  assert.equal(m.done, false);
});

test('begin 首次自动弹，重复 begin 不重弹', () => {
  const m = makeMachine();
  assert.equal(m.begin(), true);
  assert.equal(m.active, true);
  assert.equal(m.begin(), false);
});

test('事件推进：移动→吃3浮游→吃鱼→被追存活', () => {
  const m = makeMachine();
  m.begin();
  m.onGameEvent({ type: 'steer' }, 0);
  assert.equal(m.step, 1);
  m.onGameEvent({ type: 'eatFood' }, 0);
  m.onGameEvent({ type: 'eatFood' }, 0);
  m.onGameEvent({ type: 'eatFood' }, 0);
  assert.equal(m.step, 2);
  m.onGameEvent({ type: 'eatPrey' }, 0);
  assert.equal(m.step, 3);
  m.onGameEvent({ type: 'danger' }, 100);
  m.tick(100 + 2500);
  assert.equal(m.done, true);
});

test('skip 持久化：save 写入 tutorial-done', () => {
  const store = {};
  const m = makeMachine(store);
  m.begin();
  m.skip();
  assert.equal(m.done, true);
  assert.equal(store[TUTORIAL_KEY], true);
});

test('持久化后新机器不再自动弹', () => {
  const store = { [TUTORIAL_KEY]: true };
  const m = makeMachine(store);
  assert.equal(m.done, true);
  assert.equal(m.begin(), false);
});
