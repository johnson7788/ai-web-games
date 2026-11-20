import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TutorialMachine, TUT_STEP_IDS } from '../src/ui/tutorial.js';

function makeMachine() {
  return new TutorialMachine({ save: null, load: null });
}

test('TutorialMachine：步骤 id 至少 3 步', () => {
  assert.ok(TUT_STEP_IDS.length >= 3);
});

test('TutorialMachine：steer→clear→chain 推进并完成', () => {
  const m = makeMachine();
  m.begin();
  assert.equal(m.active, true);
  assert.equal(m.step, 0);

  m.onGameEvent({ type: 'steer' }, 0);
  assert.equal(m.step, 1);

  m.onGameEvent({ type: 'ringClear', kind: 'match' }, 0);
  assert.equal(m.step, 2);

  m.onGameEvent({ type: 'ringClear', kind: 'match' }, 0);
  assert.equal(m.step, 2);

  m.onGameEvent({ type: 'ringClear', kind: 'match' }, 0);
  assert.equal(m.done, true);
  assert.equal(m.active, false);
});

test('TutorialMachine：白环不计入同色链', () => {
  const m = makeMachine();
  m.begin();
  m.onGameEvent({ type: 'steer' }, 0);
  m.onGameEvent({ type: 'ringClear', kind: 'white' }, 0);
  assert.equal(m.step, 1, '白环不应推进到 chain 步');
});

test('TutorialMachine：skip 后 done 且持久化回调', () => {
  let saved = null;
  const m = new TutorialMachine({ save: (k, v) => { saved = [k, v]; }, load: null });
  m.begin();
  m.skip();
  assert.equal(m.done, true);
  assert.deepEqual(saved, ['tutorial-done', true]);
});

test('TutorialMachine：done 后 begin 不再自动弹', () => {
  const m = makeMachine();
  m.done = true;
  assert.equal(m.begin(), false);
});
