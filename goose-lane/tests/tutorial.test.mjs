import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TutorialMachine, TUT_STEP_IDS } from '../src/ui/tutorial.js';

function mem() {
  const store = new Map();
  return {
    save: (k, v) => store.set(k, v),
    load: (k, d) => (store.has(k) ? store.get(k) : d),
  };
}

test('引导共 4 步且都真实交互', () => {
  assert.equal(TUT_STEP_IDS.length, 4);
  assert.ok(TUT_STEP_IDS.length >= 3);
});

test('首次 begin 激活，已持久化则不再自动弹', () => {
  const store = mem();
  const m = new TutorialMachine(store);
  assert.equal(m.done, false);
  assert.equal(m.begin(), true);
  assert.equal(m.active, true);
  m.skip(); // 持久化 tutorial-done

  const done = new TutorialMachine(store);
  assert.equal(done.done, true);
  assert.equal(done.begin(), false);
});

test('按事件逐步推进：换道→宝石→气球→停步→完成', () => {
  const m = new TutorialMachine(mem());
  m.begin();
  assert.equal(m.currentId, 'lane');
  m.onGameEvent({ type: 'laneChange' });
  assert.equal(m.currentId, 'gem');
  m.onGameEvent({ type: 'gem' });
  assert.equal(m.currentId, 'balloon');
  m.onGameEvent({ type: 'balloonGain' });
  assert.equal(m.currentId, 'stop');
  m.onGameEvent({ type: 'stopHold' });
  assert.equal(m.done, true);
  assert.equal(m.active, false);
});

test('无关事件不推进步骤', () => {
  const m = new TutorialMachine(mem());
  m.begin();
  m.onGameEvent({ type: 'gem' });
  assert.equal(m.currentId, 'lane');
});

test('skip 直接完成并持久化', () => {
  const store = mem();
  const m = new TutorialMachine(store);
  m.begin();
  m.skip();
  assert.equal(m.done, true);
  assert.equal(m.active, false);
  assert.equal(store.load('tutorial-done', false), true);
});

test('replay 强制重开引导', () => {
  const store = mem();
  const m = new TutorialMachine(store);
  m.begin();
  m.skip();
  assert.equal(m.done, true);
  assert.equal(m.replay(), true);
  assert.equal(m.active, true);
  assert.equal(m.step, 0);
});
