import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TutorialMachine, TUTORIAL_KEY, TUT_STEP_IDS } from '../src/ui/tutorial.js';

function makeStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    save(k, v) { map.set(k, v); },
    load(k, d) { return map.has(k) ? map.get(k) : d; },
  };
}

test('教程有 4 步：aim → shot → catch → tier', () => {
  assert.equal(TUT_STEP_IDS.length, 4);
  assert.deepEqual(TUT_STEP_IDS, ['aim', 'shot', 'catch', 'tier']);
});

test('全新存档 begin() 激活，步骤从 0 开始', () => {
  const store = makeStore();
  const m = new TutorialMachine({ save: store.save, load: store.load });
  assert.equal(m.done, false);
  assert.equal(m.begin(), true);
  assert.equal(m.snapshot().step, 0);
  assert.equal(m.snapshot().id, 'aim');
});

test('只有对应事件才推进步骤', () => {
  const store = makeStore();
  const m = new TutorialMachine({ save: store.save, load: store.load });
  m.begin();
  m.onGameEvent({ type: 'shot' }, 0);
  m.onGameEvent({ type: 'catch' }, 0);
  assert.equal(m.snapshot().step, 0);
  m.onGameEvent({ type: 'aim' }, 0);
  assert.equal(m.snapshot().step, 1);
  m.onGameEvent({ type: 'shot' }, 0);
  assert.equal(m.snapshot().step, 2);
  m.onGameEvent({ type: 'catch' }, 0);
  assert.equal(m.snapshot().step, 3);
  assert.equal(m.snapshot().done, false);
  m.onGameEvent({ type: 'tierChange' }, 0);
  assert.equal(m.snapshot().done, true);
});

test('全部完成：done=true 并持久化', () => {
  const store = makeStore();
  const m = new TutorialMachine({ save: store.save, load: store.load });
  m.begin();
  m.onGameEvent({ type: 'aim' }, 0);
  m.onGameEvent({ type: 'shot' }, 0);
  m.onGameEvent({ type: 'catch' }, 0);
  m.onGameEvent({ type: 'tierChange' }, 0);
  assert.equal(m.snapshot().done, true);
  assert.equal(m.snapshot().active, false);
  assert.equal(store.map.get(TUTORIAL_KEY), true);
});

test('跳过：done=true 并持久化', () => {
  const store = makeStore();
  const m = new TutorialMachine({ save: store.save, load: store.load });
  m.begin();
  m.skip();
  assert.equal(m.snapshot().done, true);
  assert.equal(m.snapshot().active, false);
  assert.equal(store.map.get(TUTORIAL_KEY), true);
});

test('已有 done 的存档，begin() 不重复弹', () => {
  const store = makeStore({ [TUTORIAL_KEY]: true });
  const m = new TutorialMachine({ save: store.save, load: store.load });
  assert.equal(m.done, true);
  assert.equal(m.begin(), false);
});

test('完成后仍可 replay() 强制重看', () => {
  const store = makeStore();
  const m = new TutorialMachine({ save: store.save, load: store.load });
  m.begin();
  m.skip();
  assert.equal(m.done, true);
  assert.equal(m.replay(), true);
  assert.equal(m.snapshot().active, true);
  assert.equal(m.snapshot().step, 0);
});

test('未激活时事件不推进', () => {
  const store = makeStore();
  const m = new TutorialMachine({ save: store.save, load: store.load });
  m.onGameEvent({ type: 'aim' }, 0);
  assert.equal(m.snapshot().step, 0);
  assert.equal(m.snapshot().active, false);
});
