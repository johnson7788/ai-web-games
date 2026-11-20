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

test('教程有 4 步：拖动 → 吃珠 → 破墙 → 冲刺', () => {
  assert.equal(TUT_STEP_IDS.length, 4);
  assert.deepEqual(TUT_STEP_IDS, ['steer', 'orb', 'wall', 'dash']);
});

test('全新存档 begin() 激活，且步骤从 0 开始', () => {
  const store = makeStore();
  const m = new TutorialMachine({ save: store.save, load: store.load });
  assert.equal(m.done, false);
  assert.equal(m.begin(), true);
  const s = m.snapshot();
  assert.equal(s.active, true);
  assert.equal(s.step, 0);
  assert.equal(s.id, 'steer');
});

test('4 步顺序：只有对应事件才推进', () => {
  const store = makeStore();
  const m = new TutorialMachine({ save: store.save, load: store.load });
  m.begin();

  // 步骤 0：吃珠/破墙不能推进，只有 steer 能
  m.onGameEvent({ type: 'orbGain' }, 0);
  m.onGameEvent({ type: 'wallBreak' }, 0);
  assert.equal(m.snapshot().step, 0);
  m.onGameEvent({ type: 'steer' }, 0);
  assert.equal(m.snapshot().step, 1);

  // 步骤 1：吃 2 珠不推进，第 3 珠推进到破墙
  m.onGameEvent({ type: 'orbGain' }, 0);
  m.onGameEvent({ type: 'orbGain' }, 0);
  assert.equal(m.snapshot().step, 1);
  m.onGameEvent({ type: 'orbGain' }, 0);
  assert.equal(m.snapshot().step, 2);

  // 步骤 2：破 1 墙推进到冲刺
  m.onGameEvent({ type: 'wallBreak' }, 0);
  assert.equal(m.snapshot().step, 3);
});

test('冲刺需按住满 1s：松手不足 1s 重新计时', () => {
  const store = makeStore();
  const m = new TutorialMachine({ save: store.save, load: store.load, holdMs: 1000 });
  m.begin();
  m.onGameEvent({ type: 'steer' }, 0);
  m.onGameEvent({ type: 'orbGain' }, 0);
  m.onGameEvent({ type: 'orbGain' }, 0);
  m.onGameEvent({ type: 'orbGain' }, 0);
  m.onGameEvent({ type: 'wallBreak' }, 0);

  // 按住 400ms 松手：不完成，且重新计时
  m.onGameEvent({ type: 'dashStart' }, 1000);
  m.tick(1400);
  assert.equal(m.snapshot().done, false);
  m.onGameEvent({ type: 'dashEnd' }, 1400);
  m.tick(2000);
  assert.equal(m.snapshot().done, false);

  // 重新按住满 1000ms：完成
  m.onGameEvent({ type: 'dashStart' }, 3000);
  m.tick(4000);
  assert.equal(m.snapshot().done, true);
  assert.equal(store.map.get(TUTORIAL_KEY), true);
});

test('全部完成：done=true，且不再 active', () => {
  const store = makeStore();
  const m = new TutorialMachine({ save: store.save, load: store.load });
  m.begin();
  m.onGameEvent({ type: 'steer' }, 0);
  m.onGameEvent({ type: 'orbGain' }, 0);
  m.onGameEvent({ type: 'orbGain' }, 0);
  m.onGameEvent({ type: 'orbGain' }, 0);
  m.onGameEvent({ type: 'wallBreak' }, 0);
  m.onGameEvent({ type: 'dashStart' }, 5000);
  m.tick(6000);

  const s = m.snapshot();
  assert.equal(s.done, true);
  assert.equal(s.active, false);
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

test('持久化标志：已有 done 的存档，begin() 不重复弹', () => {
  const store = makeStore({ [TUTORIAL_KEY]: true });
  const m = new TutorialMachine({ save: store.save, load: store.load });
  assert.equal(m.done, true);
  assert.equal(m.begin(), false);
  assert.equal(m.snapshot().active, false);
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
  m.onGameEvent({ type: 'steer' }, 0);
  m.onGameEvent({ type: 'orbGain' }, 0);
  assert.equal(m.snapshot().step, 0);
  assert.equal(m.snapshot().active, false);
});
