import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32, slotDelta } from '../src/game/sim.js';
import { TOWER } from '../config/game.config.js';

const T = TOWER;
const mod = (a, m) => ((a % m) + m) % m;

// 把某层第 slot 槽强制设为指定类型，并把球放到该层正上方、对准该槽
function forceSlot(run, i, slot, type) {
  const d = run.discs[i];
  d.slots = new Array(T.N_SLOTS).fill('safe');
  d.slots[slot] = type;
  d.rotOffset = mod(-(slot * T.SEG_ARC + 30), 360);
  run.state.towerRot = 0;
  run.state.ball.y = d.y + 3;
  run.state.ball.vy = 0;
  run.state.deadlock = 0;
  run.state.lastBounceDisc = -1;
  run.state.lastBounceSlot = -1;
}

function stepCollect(run, input, n) {
  const evs = [];
  for (let i = 0; i < n; i += 1) {
    if (run.state.phase !== 'playing') break;
    run.step(input || { rotate: 0 });
    evs.push(...run.drainEvents());
  }
  return evs;
}

test('初始状态：playing、0 分、球在最高层上方', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.score, 0);
  assert.ok(run.state.ball.y > run.discs[0].y);
});

test('重力让球下落', () => {
  const run = createRun({ seed: 2 });
  const y0 = run.state.ball.y;
  run.step({ rotate: 0 });
  run.drainEvents();
  assert.ok(run.state.ball.y < y0, 'y 应减小（向下）');
});

test('撞安全块会弹起', () => {
  const run = createRun({ seed: 3 });
  forceSlot(run, 0, 2, 'safe');
  const evs = stepCollect(run, { rotate: 0 }, 600);
  assert.ok(evs.some((e) => e.type === 'bounce'), '应发生弹起事件');
  assert.ok(run.state.ball.vy > 0, '弹起后速度应向上');
});

test('不操作会因停滞判死（deadlock）', () => {
  const run = createRun({ seed: 4 });
  forceSlot(run, 0, 1, 'safe');
  const evs = stepCollect(run, { rotate: 0 }, 2000);
  assert.equal(run.state.phase, 'gameover');
  const die = evs.find((e) => e.type === 'die');
  assert.ok(die, '应发出 die 事件');
  assert.equal(die.payload.reason, 'deadlock');
});

test('穿过缺口得分并推进层数', () => {
  const run = createRun({ seed: 5 });
  forceSlot(run, 0, 0, 'gap');
  const evs = stepCollect(run, { rotate: 0 }, 400);
  assert.ok(evs.some((e) => e.type === 'pass'), '应发生 pass 事件');
  assert.ok(run.state.floors >= 1, '层数应 ≥1');
  assert.ok(run.state.score >= 1, '得分应 ≥1');
});

test('撞红块即死', () => {
  const run = createRun({ seed: 6 });
  forceSlot(run, 0, 3, 'danger');
  const evs = stepCollect(run, { rotate: 0 }, 400);
  assert.equal(run.state.phase, 'gameover');
  assert.equal(evs.find((e) => e.type === 'die')?.payload.reason, 'danger');
});

test('岩石块踩一次后碎裂成缺口', () => {
  const run = createRun({ seed: 7 });
  forceSlot(run, 0, 4, 'rock');
  const evs = stepCollect(run, { rotate: 0 }, 300);
  assert.ok(evs.some((e) => e.type === 'crumble'), '应发生 crumble 事件');
  assert.equal(run.discs[0].slots[4], 'gap', '岩石槽应变缺口');
});

test('收集宝石加分加计数', () => {
  const run = createRun({ seed: 8 });
  forceSlot(run, 0, 5, 'gem');
  const evs = stepCollect(run, { rotate: 0 }, 400);
  assert.ok(evs.some((e) => e.type === 'gem'), '应发生 gem 事件');
  assert.equal(run.state.gems, 1);
  assert.ok(run.state.score >= 4, '穿缺口 1 分 + 宝石 3 分');
});

test('连续穿缺口叠加连击', () => {
  const run = createRun({ seed: 9 });
  forceSlot(run, 0, 0, 'gap');
  run.discs[1].slots = new Array(T.N_SLOTS).fill('safe');
  run.discs[1].slots[0] = 'gap';
  run.discs[1].rotOffset = run.discs[0].rotOffset;
  const evs = stepCollect(run, { rotate: 0 }, 700);
  assert.ok(run.state.bestCombo >= 2, `bestCombo 应 ≥2，实际 ${run.state.bestCombo}`);
  assert.ok(evs.some((e) => e.type === 'combo'), '应发生 combo 事件');
});

test('旋转改变球所在槽位', () => {
  const run = createRun({ seed: 10 });
  const before = run.ballSlotOnDisc(0);
  run.state.towerRot = mod(run.state.towerRot + T.SEG_ARC, 360);
  const after = run.ballSlotOnDisc(0);
  assert.notEqual(after, before, '旋转一个槽位后槽位应变化');
});

test('达到目标层通关（won + 星级）', () => {
  const run = createRun({ seed: 11, targetFloors: 10 });
  // 连续多层对齐缺口，让球一路坠落；抵达第 10 层 = 通关 + 1 星
  for (let i = 0; i < 11; i += 1) {
    run.discs[i].slots = new Array(T.N_SLOTS).fill('safe');
    run.discs[i].slots[0] = 'gap';
    run.discs[i].rotOffset = 0;
  }
  run.state.towerRot = mod(-30, 360);
  run.state.ball.y = run.discs[0].y + 3;
  const evs = stepCollect(run, { rotate: 0 }, 1800);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1);
  assert.ok(evs.some((e) => e.type === 'win'));
});

test('结算后 step 不再推进', () => {
  const run = createRun({ seed: 12 });
  forceSlot(run, 0, 2, 'danger');
  stepCollect(run, { rotate: 0 }, 400);
  const y = run.state.ball.y;
  run.step({ rotate: 0 });
  run.drainEvents();
  assert.equal(run.state.ball.y, y, '结算后位置不再变化');
});

test('slotDelta 给出最短方向', () => {
  assert.equal(slotDelta(0, 1), 1);
  assert.equal(slotDelta(0, 5), -1);
  assert.equal(slotDelta(0, 4), -2);
  assert.equal(slotDelta(4, 0), 2);
});

test('mulberry32 同 seed 确定性', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});
