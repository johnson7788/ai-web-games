import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { TEA } from '../config/tea.js';
import { STEP } from '../config/game.config.js';
import { TutorialMachine, TUT_STEP_IDS } from '../src/ui/tutorial.js';
import { mulberry32 } from '../src/game/rng.js';

function drainTypes(run) {
  return run.drainEvents().map((e) => e.type);
}

// 精确倒满一单：按目标时间按住，然后松手 + 等 feather 宽限过去
function stepUntilOrder(run, max = 600) {
  for (let i = 0; i < max && run.phase === 'playing' && !run.currentOrder; i += 1) run.step({});
}
function completeOrderPerfect(run) {
  stepUntilOrder(run);
  if (!run.currentOrder) return null;
  const o = run.currentOrder;
  const targetTime = o.line / TEA.pourRate;
  const ticks = Math.max(1, Math.round(targetTime / STEP));
  for (let i = 0; i < ticks; i += 1) run.step({ pouring: true });
  run.step({ pouring: false });
  for (let i = 0; i < 10; i += 1) run.step({ pouring: false });
  return o;
}

test('开局进入 playing，且第一位客人已就位', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'playing');
  assert.ok(r.currentOrder, '第一位客人应该在开局就出现');
  assert.equal(r.day, 1);
});

test('按住倒水发出 pourStart，且水位上升、水温下降', () => {
  const r = createRun({ seed: 1 });
  const beforeState = r.pour.state;
  r.step({ pouring: true });
  assert.equal(beforeState, 'idle');
  const types = drainTypes(r);
  assert.ok(types.includes('pourStart'));
  assert.ok(r.pour.level > 0, '水位应上升');
  assert.ok(r.pour.temp < TEA.startTemp, '水温应下降');
});

test('松手后经过 feather 宽限才结算（不倒水不算）', () => {
  const r = createRun({ seed: 1 });
  r.step({ pouring: true });
  for (let i = 0; i < 3; i += 1) r.step({ pouring: true });
  r.step({ pouring: false });
  // 宽限期内重按 = 续倒，不结算
  r.step({ pouring: true });
  drainTypes(r);
  assert.ok(r.currentOrder, '宽限期内重按不应结算');
  assert.equal(r.pour.state, 'pouring');
});

test('perfect 评分可达：贴线 + 入窗口 ≥90', () => {
  const r = createRun({ seed: 1 });
  completeOrderPerfect(r);
  let acc = null;
  for (const e of r.drainEvents()) if (e.type === 'orderScored') acc = e.accuracy;
  assert.ok(acc >= 90, `perfect 操作应 ≥90，实际 ${acc}`);
});

test('明显错误操作评分 ≤40', () => {
  const r = createRun({ seed: 1 });
  // 倒一点就松手（水位明显低于线、水温过高）
  r.step({ pouring: true });
  for (let i = 0; i < 11; i += 1) r.step({ pouring: true });
  r.step({ pouring: false });
  for (let i = 0; i < 10; i += 1) r.step({ pouring: false });
  let acc = 100;
  for (const e of r.drainEvents()) if (e.type === 'orderScored') acc = e.accuracy;
  assert.ok(acc <= 40, `明显错误应 ≤40，实际 ${acc}`);
});

test('溢出触发 spill 并扣心', () => {
  const r = createRun({ seed: 1 });
  const heartsBefore = r.hearts;
  for (let i = 0; i < 200; i += 1) r.step({ pouring: true });
  const types = drainTypes(r);
  assert.ok(types.includes('spill'));
  assert.ok(r.hearts < heartsBefore, '溢出应扣心');
});

test('耐心耗尽触发 orderExpired 并扣心', () => {
  const r = createRun({ seed: 1 });
  const heartsBefore = r.hearts;
  const o = r.currentOrder;
  for (let i = 0; i < Math.ceil(o.patienceMax / STEP) + 5; i += 1) r.step({});
  const types = drainTypes(r);
  assert.ok(types.includes('orderExpired'));
  assert.ok(r.hearts < heartsBefore);
});

test('心归零进入 dead', () => {
  const r = createRun({ seed: 1 });
  let guard = 0;
  while (r.phase === 'playing' && r.hearts > 0 && guard < 20000) {
    guard += 1;
    stepUntilOrder(r, 600);
    if (!r.currentOrder) break;
    const o = r.currentOrder;
    for (let k = 0; k < Math.ceil(o.patienceMax / STEP) + 2 && r.currentOrder; k += 1) r.step({});
  }
  assert.equal(r.phase, 'dead');
});

test('每天目标单数达成后进入 shop', () => {
  const r = createRun({ seed: 1 });
  while (r.phase === 'playing') completeOrderPerfect(r);
  assert.equal(r.phase, 'shop');
});

test('nextDay 推进天数并重置当天状态', () => {
  const r = createRun({ seed: 1 });
  while (r.phase === 'playing') completeOrderPerfect(r);
  assert.equal(r.phase, 'shop');
  r.nextDay();
  assert.equal(r.day, 2);
  assert.equal(r.dayOrdersFilled, 0);
  assert.equal(r.phase, 'playing');
});

test('经营满 12 天进入 won', () => {
  const r = createRun({ seed: 1 });
  for (let guard = 0; guard < 4000 && r.phase !== 'won' && r.phase !== 'dead'; guard += 1) {
    if (r.phase === 'shop') { r.nextDay(); continue; }
    completeOrderPerfect(r);
  }
  assert.equal(r.phase, 'won');
  assert.equal(r.day, 12);
});

test('skip 跳过当前客人且不扣心', () => {
  const r = createRun({ seed: 1 });
  const heartsBefore = r.hearts;
  r.skip();
  const types = drainTypes(r);
  assert.ok(types.includes('orderSkipped'));
  assert.equal(r.hearts, heartsBefore);
  assert.equal(r.currentOrder, null);
});

test('buyUpgrade 扣金币并标记拥有', () => {
  const r = createRun({ seed: 1 });
  r.coins = 100;
  const ok = r.buyUpgrade('slowPour');
  assert.equal(ok, true);
  assert.equal(r.coins, 70);
  assert.ok(r.upgrades.slowPour);
  assert.equal(r.buyUpgrade('slowPour'), false, '不能重复购买');
});

test('每 5 单触发 rushWave 高峰', () => {
  const r = createRun({ seed: 1 });
  let sawRush = false;
  for (let guard = 0; guard < 40 && !sawRush; guard += 1) {
    if (r.phase === 'shop') { r.nextDay(); continue; }
    if (r.phase !== 'playing') break;
    completeOrderPerfect(r);
    if (drainTypes(r).includes('rushWave')) sawRush = true;
  }
  assert.ok(sawRush, '第 5 单后应触发高峰');
});

test('慢倒升级降低倒水速度', () => {
  const r = createRun({ seed: 1 });
  r.upgrades.slowPour = true;
  r.step({ pouring: true });
  r.step({ pouring: true });
  const slow = r.pour.level;
  const r2 = createRun({ seed: 1 });
  r2.step({ pouring: true });
  r2.step({ pouring: true });
  assert.ok(slow < r2.pour.level, '慢倒应更慢');
});

test('冰镇升级降低水温下降速度', () => {
  const r = createRun({ seed: 1 });
  r.upgrades.iceReserve = true;
  r.step({ pouring: true });
  r.step({ pouring: true });
  const cool = r.pour.temp;
  const r2 = createRun({ seed: 1 });
  r2.step({ pouring: true });
  r2.step({ pouring: true });
  assert.ok(cool > r2.pour.temp, '冰镇应保更多热量');
});

test('订单构造可解：倒到线时水温必在窗口内', () => {
  const r = createRun({ seed: 1 });
  const o = r.currentOrder;
  const targetTime = o.line / TEA.pourRate;
  const temp = TEA.startTemp - TEA.coolRate * targetTime;
  assert.ok(temp >= o.tempWindow[0] && temp <= o.tempWindow[1], '目标时刻水温应在窗口内');
});

test('rng 同种子可复现', () => {
  const a = mulberry32(42)();
  const b = mulberry32(42)();
  assert.equal(a, b);
});

test('教程状态机：3 步，事件推进，可跳过并持久化', () => {
  let saved = null;
  const m = new TutorialMachine({ save: (k, v) => { saved = v; }, load: () => false, key: 'tutorial-done' });
  assert.equal(m.total, 3);
  assert.deepEqual(TUT_STEP_IDS, ['pour', 'score', 'perfect']);
  m.begin();
  assert.equal(m.active, true);
  m.onGameEvent({ type: 'pourStart' });
  assert.equal(m.step, 1);
  m.onGameEvent({ type: 'orderScored' });
  assert.equal(m.step, 2);
  m.onGameEvent({ type: 'perfect' });
  assert.equal(m.done, true);
  assert.equal(saved, true);
});

test('教程状态机：skip 立即完成并持久化', () => {
  let saved = null;
  const m = new TutorialMachine({ save: (k, v) => { saved = v; }, load: () => false, key: 'tutorial-done' });
  m.begin();
  m.skip();
  assert.equal(m.done, true);
  assert.equal(m.active, false);
  assert.equal(saved, true);
});
