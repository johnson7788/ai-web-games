import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TutorialMachine, TUT_STEP_IDS } from '../src/ui/tutorial.js';

function makeMachine(done = false) {
  const store = { done };
  return new TutorialMachine({
    save: (k, v) => { store.done = v; },
    load: (k, d) => store.done,
  });
}

test('引导共 3 步', () => {
  const m = makeMachine();
  assert.equal(m.total, 3);
  assert.equal(TUT_STEP_IDS.length, 3);
});

test('begin 后 active 且从第 0 步开始', () => {
  const m = makeMachine();
  assert.equal(m.begin(), true);
  assert.equal(m.active, true);
  assert.equal(m.step, 0);
});

test('已持久化则 begin 不再自动弹', () => {
  const m = makeMachine(true);
  assert.equal(m.begin(), false);
  assert.equal(m.active, false);
});

test('任意泡泡点击（对或错）推进第 1 步', () => {
  const m = makeMachine();
  m.begin();
  m.onGameEvent({ type: 'bubbleMiss' });
  assert.equal(m.step, 1);
});

test('第 2 步需要点对才推进', () => {
  const m = makeMachine();
  m.begin();
  m.onGameEvent({ type: 'bubblePop' }); // 第 0 步：任意点击
  assert.equal(m.step, 1);
  m.onGameEvent({ type: 'bubbleMiss' }); // 第 1 步：点错不推进
  assert.equal(m.step, 1);
  m.onGameEvent({ type: 'bubblePop' }); // 点对推进
  assert.equal(m.step, 2);
});

test('第 3 步清关后完成并持久化', () => {
  const m = makeMachine();
  let saved = false;
  m.save = () => { saved = true; };
  m.begin();
  m.onGameEvent({ type: 'bubblePop' });
  m.onGameEvent({ type: 'bubblePop' });
  m.onGameEvent({ type: 'roundClear' });
  assert.equal(m.done, true);
  assert.equal(m.active, false);
});

test('skip 立即完成并持久化', () => {
  const m = makeMachine();
  let saved = false;
  m.save = () => { saved = true; };
  m.begin();
  m.skip();
  assert.equal(m.done, true);
  assert.equal(saved, true);
});

test('replay 强制重看', () => {
  const m = makeMachine(true);
  assert.equal(m.replay(), true);
  assert.equal(m.active, true);
  assert.equal(m.step, 0);
});
