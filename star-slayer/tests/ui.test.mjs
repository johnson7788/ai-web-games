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

test('教程有 4 步：移动 → 开火 → 击杀 → 相位同步', () => {
  assert.equal(TUT_STEP_IDS.length, 4);
  assert.deepEqual(TUT_STEP_IDS, ['move', 'fire', 'kill', 'sync']);
});

test('全新存档 begin() 激活，且步骤从 0 开始', () => {
  const store = makeStore();
  const m = new TutorialMachine({ save: store.save, load: store.load });
  assert.equal(m.done, false);
  assert.equal(m.begin(), true);
  const s = m.snapshot();
  assert.equal(s.active, true);
  assert.equal(s.step, 0);
  assert.equal(s.id, 'move');
});

test('4 步顺序：只有对应事件才推进', () => {
  const store = makeStore();
  const m = new TutorialMachine({ save: store.save, load: store.load });
  m.begin();
  m.onGameEvent({ type: 'shot' });
  assert.equal(m.snapshot().step, 0);
  m.onGameEvent({ type: 'move' });
  assert.equal(m.snapshot().step, 1);
  m.onGameEvent({ type: 'shot' });
  assert.equal(m.snapshot().step, 2);
  m.onGameEvent({ type: 'kill' });
  assert.equal(m.snapshot().step, 3);
  m.onGameEvent({ type: 'phaseSync' });
  assert.equal(m.snapshot().done, true);
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

test('已持久化的存档 begin() 不重复弹', () => {
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
  m.onGameEvent({ type: 'move' });
  m.onGameEvent({ type: 'shot' });
  assert.equal(m.snapshot().step, 0);
  assert.equal(m.snapshot().active, false);
});
