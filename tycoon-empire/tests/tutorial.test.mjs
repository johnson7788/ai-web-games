import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TutorialMachine, TUT_STEP_IDS, TAP_TARGET, BUY_TARGET } from '../src/ui/tutorial.js';

function mem() {
  const store = new Map();
  return {
    save: (k, v) => store.set(k, v),
    load: (k, d) => (store.has(k) ? store.get(k) : d),
  };
}

test('引导共 3 步', () => {
  assert.equal(TUT_STEP_IDS.length, 3);
  assert.ok(TAP_TARGET >= 1);
  assert.equal(BUY_TARGET, 1);
});

test('首次 begin 进入 active，重复 begin 不生效', () => {
  const m = new TutorialMachine({ ...mem() });
  assert.ok(m.begin());
  assert.ok(m.active);
  assert.ok(!m.begin());
});

test('点楼 3 次推进到第 2 步', () => {
  const m = new TutorialMachine({ ...mem() });
  m.begin();
  m.onGameEvent({ type: 'tap' });
  m.onGameEvent({ type: 'tap' });
  assert.equal(m.step, 0);
  m.onGameEvent({ type: 'tap' });
  assert.equal(m.step, 1);
  assert.equal(m.currentId, 'buy');
});

test('买洗衣店推进到第 3 步，收取后完成', () => {
  const m = new TutorialMachine({ ...mem() });
  m.begin();
  m.onGameEvent({ type: 'tap' });
  m.onGameEvent({ type: 'tap' });
  m.onGameEvent({ type: 'tap' });
  m.onGameEvent({ type: 'buy', industry: 1 });
  assert.equal(m.step, 2);
  m.onGameEvent({ type: 'collect' });
  assert.ok(m.done);
  assert.ok(!m.active);
});

test('买错产业不推进', () => {
  const m = new TutorialMachine({ ...mem() });
  m.begin();
  m.onGameEvent({ type: 'tap' });
  m.onGameEvent({ type: 'tap' });
  m.onGameEvent({ type: 'tap' });
  m.onGameEvent({ type: 'buy', industry: 0 });
  assert.equal(m.step, 1);
});

test('skip 直接完成并持久化', () => {
  const s = mem();
  const m = new TutorialMachine({ ...s });
  m.begin();
  m.skip();
  assert.ok(m.done);
  assert.ok(s.load('tutorial-done', false));
});

test('已持久化则 begin 不弹', () => {
  const s = mem();
  s.save('tutorial-done', true);
  const m = new TutorialMachine({ ...s });
  assert.ok(!m.begin());
});
