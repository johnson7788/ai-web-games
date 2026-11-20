// tests/tutorial.test.mjs — 首次引导状态机：步骤推进 / 跳过 / 持久化 / 重看
import test from 'node:test';
import assert from 'node:assert/strict';
import { TutorialMachine, TUT_STEP_IDS, TUTORIAL_KEY } from '../src/ui/tutorial.js';

test('步骤至少 3 步，且每步有对应事件', () => {
  assert.ok(TUT_STEP_IDS.length >= 3);
});

test('begin：未完成时激活并回到第 0 步', () => {
  const m = new TutorialMachine({ save: () => {}, load: () => false });
  assert.equal(m.begin(), true);
  assert.equal(m.active, true);
  assert.equal(m.step, 0);
});

test('已完成存档：begin 不激活', () => {
  const m = new TutorialMachine({ save: () => {}, load: () => true });
  assert.equal(m.begin(), false);
  assert.equal(m.active, false);
});

test('onGameEvent 逐步推进到完成并回调', () => {
  let done = null;
  const m = new TutorialMachine({ save: () => {}, load: () => false });
  m.onDone = (r) => { done = r; };
  m.begin();
  const events = ['jump', 'obstacleClear', 'jarGain', 'jarDrop'];
  for (const ev of events) m.onGameEvent({ type: ev });
  assert.equal(m.step, TUT_STEP_IDS.length);
  assert.equal(m.done, true);
  assert.equal(m.active, false);
  assert.ok(done && done.done === true && done.skipped === false);
});

test('跳过：立即完成并标记 skipped、持久化', () => {
  let saved = null;
  const m = new TutorialMachine({ save: (k, v) => { saved = [k, v]; }, load: () => false });
  m.begin();
  m.skip();
  assert.equal(m.done, true);
  assert.equal(m.active, false);
  assert.deepEqual(saved, [TUTORIAL_KEY, true]);
});

test('replay：无视完成状态强制重看', () => {
  const m = new TutorialMachine({ save: () => {}, load: () => true });
  assert.equal(m.replay(), true);
  assert.equal(m.active, true);
  assert.equal(m.step, 0);
});

test('snapshot 反映 active/step/id', () => {
  const m = new TutorialMachine({ save: () => {}, load: () => false });
  m.begin();
  m.onGameEvent({ type: 'jump' });
  const s = m.snapshot();
  assert.equal(s.active, true);
  assert.equal(s.step, 1);
  assert.equal(s.id, TUT_STEP_IDS[1]);
});
