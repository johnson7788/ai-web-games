import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TutorialMachine, TUT_STEP_IDS } from '../src/ui/tutorial.js';

function memStore() {
  const m = new Map();
  return {
    save: (k, v) => { m.set(k, v); },
    load: (k, d) => (m.has(k) ? m.get(k) : d),
  };
}

test('教程至少 3 步且 id 唯一', () => {
  assert.ok(TUT_STEP_IDS.length >= 3);
  assert.equal(new Set(TUT_STEP_IDS).size, TUT_STEP_IDS.length);
});

test('首次 begin 激活，已持久化则不重复', () => {
  const s = memStore();
  const m1 = new TutorialMachine({ save: s.save, load: s.load });
  assert.equal(m1.done, false);
  assert.equal(m1.begin(), true);
  assert.equal(m1.active, true);
  assert.equal(m1.step, 0);
  m1.skip();
  const m2 = new TutorialMachine({ save: s.save, load: s.load });
  assert.equal(m2.done, true);
  assert.equal(m2.begin(), false, '已完成后不再自动弹');
});

test('事件推进：step→echo→collect→exit', () => {
  const m = new TutorialMachine({});
  m.begin();
  m.onGameEvent({ type: 'step' });
  assert.equal(m.step, 1);
  m.onGameEvent({ type: 'echo' });
  assert.equal(m.step, 2);
  m.onGameEvent({ type: 'keyGain' });
  assert.equal(m.step, 3);
  const snap = m.onGameEvent({ type: 'blockClear' });
  assert.equal(snap.done, true);
  assert.equal(snap.active, false);
});

test('skip 完成并回调', () => {
  let called = null;
  const m = new TutorialMachine({});
  m.onDone = (r) => { called = r; };
  m.begin();
  m.skip();
  assert.equal(m.done, true);
  assert.equal(called.skipped, true);
});

test('replay 重置并激活', () => {
  const m = new TutorialMachine({});
  m.replay();
  assert.equal(m.active, true);
  assert.equal(m.step, 0);
  assert.equal(m.currentId, 'move');
});
