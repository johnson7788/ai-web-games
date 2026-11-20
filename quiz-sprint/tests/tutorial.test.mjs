import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TutorialMachine, TUT_STEP_IDS } from '../src/ui/tutorial.js';

function makeMachine(done = false) {
  const store = { 'tutorial-done': done };
  return {
    machine: new TutorialMachine({
      save: (k, v) => { store[k] = v; },
      load: (k, d) => (store[k] ?? d),
    }),
    store,
  };
}

test('引导 ≥3 步', () => {
  assert.ok(TUT_STEP_IDS.length >= 3);
});

test('初始状态 step=0 且未完成', () => {
  const { machine } = makeMachine();
  const s = machine.snapshot();
  assert.equal(s.step, 0);
  assert.equal(s.done, false);
  assert.equal(s.id, 'answer');
});

test('answer → correct → comboUp(≥2) 完成', () => {
  const { machine, store } = makeMachine();
  machine.begin();
  machine.onGameEvent({ type: 'answer', correct: true });
  assert.equal(machine.step, 1);
  machine.onGameEvent({ type: 'answerCorrect', combo: 1 });
  assert.equal(machine.step, 2);
  machine.onGameEvent({ type: 'comboUp', combo: 2 });
  assert.equal(machine.done, true);
  assert.equal(store['tutorial-done'], true);
});

test('skip 持久化并标记完成', () => {
  const { machine, store } = makeMachine();
  machine.begin();
  machine.skip();
  assert.equal(machine.done, true);
  assert.equal(store['tutorial-done'], true);
});

test('已持久化则 begin 不再激活', () => {
  const { machine } = makeMachine(true);
  const began = machine.begin();
  assert.equal(began, false);
  assert.equal(machine.active, false);
});
