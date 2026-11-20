import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { ATTRS, FLAGS, STEP, CHAPTER_COUNT } from '../config/gameplay.js';

// 跑完整 12 章：每章选 index，再 advance；最后一章 advance 后进入结局。
function playPath(run, indices) {
  for (let i = 0; i < indices.length; i += 1) {
    assert.equal(run.stage, 'choice', `第 ${i + 1} 章应在 choice 阶段`);
    run.step({ choice: indices[i] });
    assert.equal(run.stage, 'result', `第 ${i + 1} 章选择后应进 result 阶段`);
    run.step({ advance: true });
  }
}

function drain(run) {
  return run.drainEvents();
}

function types(events) {
  return events.map((e) => e.type);
}

test('createRun 初始状态符合契约', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.stage, 'choice');
  assert.equal(run.chapter, 1);
  assert.deepEqual(run.attrs, ATTRS.START);
  assert.deepEqual(run.flags, FLAGS.START);
  assert.equal(run.arc, null);
  assert.equal(run.ending, null);
  assert.ok(types(drain(run)).includes('nodeEnter'), '开局应已入队 nodeEnter');
});

test('getHud 契约字段齐全', () => {
  const run = createRun({ seed: 2 });
  const hud = run.getHud();
  for (const k of ['phase', 'stage', 'chapter', 'totalChapters', 'nodeId', 'scene', 'timed', 'timer', 'attrs', 'flags', 'arc', 'endingId', 'curChoice']) {
    assert.ok(k in hud, `缺字段 ${k}`);
  }
  assert.equal(hud.totalChapters, CHAPTER_COUNT);
  assert.equal(hud.chapter, 1);
  assert.equal(hud.scene, 'town');
});

test('nodeEnter 事件在开局入队（含首章与场景）', () => {
  const run = createRun({ seed: 3 });
  const evs = drain(run);
  const ne = evs.find((e) => e.type === 'nodeEnter');
  assert.ok(ne, '应有 nodeEnter');
  assert.equal(ne.chapter, 1);
  assert.equal(ne.scene, 'town');
  assert.equal(ne.nodeId, 'n1');
});

test('选择应用属性与 flag 效果（能力+、存款−）', () => {
  const run = createRun({ seed: 4 });
  run.step({ choice: 0 }); // n1 choice0: abi+1, sav-1
  const hud = run.getHud();
  assert.equal(hud.attrs.abi, ATTRS.START.abi + 1);
  assert.equal(hud.attrs.sav, ATTRS.START.sav - 1);
  const evs = drain(run);
  assert.ok(types(evs).includes('choiceMade'));
  assert.ok(types(evs).includes('attrChange'));
});

test('属性 clamp 在 [0,12] 边界内', () => {
  const run = createRun({ seed: 5 });
  run.attrs.abi = 11;
  run.attrs.net = -2;
  run.step({ choice: 0 }); // abi+1 → clamp 12；net 保持 clamp 到 0
  assert.equal(run.attrs.abi, 12);
  assert.ok(run.attrs.net >= 0);
});

test('限时节点倒计时并超时选默认保守项', () => {
  const run = createRun({ seed: 6 });
  // 快进到第 5 章（限时）
  playPath(run, [0, 0, 0, 0]); // n1..n4 后进入 n5（timed）
  drain(run); // 清掉前面 4 章的事件
  const n5 = run.currentNode();
  assert.equal(n5.id, 'n5');
  assert.equal(n5.timed, true);
  assert.ok(run.timer > 0, '进入限时节点应有倒计时');

  // 不输入，跑满倒计时
  const limit = Math.ceil(run.timer / STEP) + 5;
  for (let i = 0; i < limit; i += 1) run.step({});
  assert.equal(run.stage, 'result', '超时应自动进入 result');
  const evs = drain(run);
  const made = evs.find((e) => e.type === 'choiceMade');
  assert.ok(made, '超时应发 choiceMade');
  assert.equal(made.timedOut, true);
  assert.equal(made.choiceIndex, n5.default, '默认保守项 = n5.default');
});

test('限时节点主动选择不超时且不等默认', () => {
  const run = createRun({ seed: 7 });
  playPath(run, [0, 0, 0, 0]);
  drain(run); // 清掉前面 4 章的事件
  run.step({ choice: 2 });
  const evs = drain(run);
  const made = evs.find((e) => e.type === 'choiceMade');
  assert.equal(made.choiceIndex, 2);
  assert.equal(made.timedOut, false);
});

test('reveal 期间每帧发 typeTick（事件密度）', () => {
  const run = createRun({ seed: 8 });
  const evs = [];
  for (let i = 0; i < 20; i += 1) {
    run.step({});
    evs.push(...drain(run));
  }
  assert.ok(evs.filter((e) => e.type === 'typeTick').length > 5, 'reveal 期间应有大量 typeTick');
});

test('success 事件只在第一次选择发一次', () => {
  const run = createRun({ seed: 9 });
  const evs = [];
  run.step({ choice: 0 });
  evs.push(...drain(run));
  run.step({ advance: true });
  evs.push(...drain(run));
  run.step({ choice: 1 });
  evs.push(...drain(run));
  assert.equal(evs.filter((e) => e.type === 'success').length, 1);
});

test('完整 12 章走到结局：phase=ended + ending 事件', () => {
  const run = createRun({ seed: 10 });
  playPath(run, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(run.phase, 'ended');
  assert.equal(run.stage, 'ending');
  assert.ok(run.ending, '应有结局对象');
  assert.equal(run.ending.id, 'queen', '全 0 路线应达 queen（逆袭女王）');
  const evs = drain(run);
  assert.ok(types(evs).includes('ending'));
  assert.equal(run.history.length, 12);
});

test('同输入序列 → 同结局（确定性）', () => {
  const a = createRun({ seed: 11 });
  const b = createRun({ seed: 11 });
  const path = [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 2];
  playPath(a, path);
  playPath(b, path);
  assert.equal(a.ending.id, b.ending.id);
  assert.deepEqual(a.attrs, b.attrs);
});

test('非限时节点无输入会停住（noinput 基线）', () => {
  const run = createRun({ seed: 12 });
  for (let i = 0; i < 120; i += 1) run.step({});
  assert.equal(run.stage, 'choice', '无输入停在 choice');
  assert.equal(run.chapter, 1, '仍在第 1 章');
  assert.equal(run.phase, 'playing');
});

test('scaleTilt 只在限时节点选择时发出', () => {
  const run = createRun({ seed: 13 });
  playPath(run, [0, 0, 0, 0]); // n1..n4，都不限时
  const evsBefore = drain(run);
  assert.ok(!types(evsBefore).includes('scaleTilt'), '非限时节点不应发 scaleTilt');

  run.step({ choice: 1 }); // n5 限时
  const evs = drain(run);
  const tilt = evs.find((e) => e.type === 'scaleTilt');
  assert.ok(tilt, '限时节点选择应发 scaleTilt');
  assert.ok([-1, 0, 1].includes(tilt.lean));
});

test('弧线在 n9 选择后确定（corp/startup/partner）', () => {
  const corp = createRun({ seed: 14 });
  playPath(corp, [0, 0, 0, 0, 0, 0, 0, 0, 0]); // n9 choice0 → corp
  assert.equal(corp.arc, 'corp');
  assert.equal(corp.currentNode().id, 'n10a');

  const startup = createRun({ seed: 15 });
  playPath(startup, [0, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.equal(startup.arc, 'startup');
  assert.equal(startup.currentNode().id, 'n10b');

  const partner = createRun({ seed: 16 });
  playPath(partner, [0, 0, 0, 0, 0, 0, 0, 0, 2]);
  assert.equal(partner.arc, 'partner');
  assert.equal(partner.currentNode().id, 'n10c');
});
