import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TutorialMachine, TUT_STEP_IDS } from '../src/ui/tutorial.js';

function makeMachine(saved = false) {
  let store = saved;
  return new TutorialMachine({
    load: () => store,
    save: (k, v) => { store = v; },
  });
}

test('教程步骤：aim → shot → kill → tracer 逐级推进', () => {
  const m = makeMachine();
  m.begin();
  assert.equal(m.step, 0);
  m.onGameEvent({ type: 'aim' });
  assert.equal(m.step, 1);
  m.onGameEvent({ type: 'shot' });
  assert.equal(m.step, 2);
  m.onGameEvent({ type: 'kill' });
  assert.equal(m.step, 3);
  m.onGameEvent({ type: 'tracerFired' });
  assert.equal(m.step, 4);
  assert.ok(m.done);
});

test('步骤数 ≥3 且 id 唯一', () => {
  assert.ok(TUT_STEP_IDS.length >= 3);
  assert.equal(new Set(TUT_STEP_IDS).size, TUT_STEP_IDS.length);
});

test('未匹配事件不推进', () => {
  const m = makeMachine();
  m.begin();
  m.onGameEvent({ type: 'shot' }); // 第 0 步只看 aim
  assert.equal(m.step, 0);
});

test('skip 持久化并 done', () => {
  const m = makeMachine();
  m.begin();
  m.skip();
  assert.ok(m.done);
  assert.ok(!m.active);
});

test('已持久化：再次构造不再自动弹', () => {
  const m = makeMachine(true);
  assert.ok(m.done);
  assert.equal(m.begin(), false);
});

test('replay 重置并重新激活', () => {
  const m = makeMachine(true);
  m.replay();
  assert.ok(m.active);
  assert.equal(m.step, 0);
});

test('snapshot 返回 active/done/step/total/id', () => {
  const m = makeMachine();
  m.begin();
  const s = m.snapshot();
  for (const k of ['active', 'done', 'step', 'total', 'id']) {
    assert.ok(k in s);
  }
});
