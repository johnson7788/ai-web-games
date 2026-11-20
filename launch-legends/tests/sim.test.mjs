import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { WORLD, GAME } from '../config/game.config.js';

// 以 1/60 步长推进 sec 秒
function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

// 把下一次撞层判定强制推到中点（bounceT 0.49 → step 跨过 0.5）
function resolveOnce(run) {
  run.state.bounceT = 0.49;
  run._resolvedThisBounce = false;
  run.step(0.02);
}

// 贪心自动驾驶到终局
function autopilotWin(levelIndex, seed = 1) {
  const run = createRun(levelIndex, { seed });
  for (let i = 0; i < 20000 && run.state.phase === 'playing'; i += 1) {
    run.autopilotStep();
    run.step(1 / 60);
  }
  return run;
}

test('冒烟：createRun → setInput → step → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  const res = r.setInput(1);
  assert.equal(res.ok, true);
  r.step(1 / 60);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'playing');
  assert.ok(Array.isArray(r.drainEvents()));
});

test('state 形状：level/phase/x/height/layers/cols/segW', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'playing');
  assert.equal(s.height, 0);
  assert.ok(s.layers.length >= s.targetHeight + 8);
  assert.equal(s.cols, 6);
  assert.ok(Math.abs(s.segW - WORLD.WIDTH / 6) < 0.001);
  assert.equal(s.x, WORLD.WIDTH / 2);
});

test('setInput：方向变化 ok，同向 same，终局 phase', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.setInput(1).ok, true);
  assert.deepEqual(r.setInput(1), { ok: false, reason: 'same' });
  assert.equal(r.setInput(-1).ok, true);
  assert.equal(r.setInput(0).ok, true);
  r.state.phase = 'won';
  assert.deepEqual(r.setInput(1), { ok: false, reason: 'phase' });
});

test('mulberry32：同 seed 序列一致', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 10; i += 1) assert.equal(a(), b());
});

test('弹跳：一个完整弹跳周期发 bounce 事件', () => {
  const r = createRun(0, { seed: 1 });
  r.drainEvents();
  r.state.bounceT = 0.99;
  r.step(0.02); // 跨过 1 → wrap → bounce
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'bounce'));
});

test('greedy autopilot：L1 能通关，height ≥ targetHeight', () => {
  const r = autopilotWin(0, 3);
  assert.equal(r.state.phase, 'won');
  assert.ok(r.state.height >= r.state.targetHeight);
  assert.equal(r.state.result.won, true);
});

test('greedy autopilot：L2（横风）与 L3（连击）都能通关', () => {
  for (const idx of [1, 2]) {
    const r = autopilotWin(idx, 3 + idx);
    assert.equal(r.state.phase, 'won', `L${idx + 1} 应通关`);
  }
});

test('pass：空档层通过，height +1，combo 归零', () => {
  const r = createRun(0, { seed: 1 });
  r.state.layers[r.state.layerIndex] = ['empty', 'empty', 'empty', 'empty', 'empty', 'empty'];
  const before = r.state.height;
  r.state.combo = 3;
  resolveOnce(r);
  assert.equal(r.state.height, before + 1);
  assert.equal(r.state.combo, 0);
  assert.ok(r.drainEvents().some((e) => e.type === 'pass'));
});

test('cloudBreak：撞云絮 clouds++、fuse 充能、发 cloudBreak', () => {
  const r = createRun(0, { seed: 1 });
  r.state.layers[r.state.layerIndex] = ['cloud', 'cloud', 'cloud', 'cloud', 'cloud', 'cloud'];
  const before = r.state.clouds;
  resolveOnce(r);
  assert.equal(r.state.clouds, before + 1);
  assert.ok(r.state.fuse > 0);
  assert.ok(r.drainEvents().some((e) => e.type === 'cloudBreak'));
});

test('ignite：fuse 蓄满进入炽热态并发 fuseFull/ignite', () => {
  const r = createRun(0, { seed: 1 });
  r.state.layers[r.state.layerIndex] = ['cloud', 'cloud', 'cloud', 'cloud', 'cloud', 'cloud'];
  r.state.fuse = GAME.FUSE_MAX - 1;
  resolveOnce(r);
  assert.equal(r.state.incandescent, true);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'fuseFull'));
  assert.ok(ev.some((e) => e.type === 'ignite'));
});

test('crash：非炽热态撞钢 → lost + crash/lose 事件', () => {
  const r = createRun(0, { seed: 1 });
  r.state.layers[r.state.layerIndex] = ['steel', 'steel', 'steel', 'steel', 'steel', 'steel'];
  resolveOnce(r);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'crash'));
  assert.ok(ev.some((e) => e.type === 'lose'));
});

test('steelBreak：炽热态撞钢不死亡，发 steelBreak', () => {
  const r = createRun(0, { seed: 1 });
  r.state.layers[r.state.layerIndex] = ['steel', 'steel', 'steel', 'steel', 'steel', 'steel'];
  r.state.incandescent = true;
  r.state.incandescentT = 2;
  resolveOnce(r);
  assert.equal(r.state.phase, 'playing');
  assert.ok(r.drainEvents().some((e) => e.type === 'steelBreak'));
});

test('win：通关发 win 事件且星级 ≥1', () => {
  const r = autopilotWin(0, 7);
  assert.ok(r.state.stars >= 1);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'win'));
});

test('墙弹：wallBounce 关卡贴墙时 height 额外 +1', () => {
  const r = createRun(4, { seed: 1 }); // L5 wallBounce
  r.state.layers[r.state.layerIndex] = ['empty', 'empty', 'empty', 'empty', 'empty', 'empty'];
  r.state.x = 0;
  const before = r.state.height;
  resolveOnce(r);
  assert.equal(r.state.height, before + 2);
  assert.ok(r.drainEvents().some((e) => e.type === 'wallBounce'));
});

test('阵雨减速：rain band 内弹跳周期变长', () => {
  const r = createRun(5, { seed: 1 }); // L6 rainBands [[8,15]]
  r.state.layerIndex = 10;
  assert.ok(r._bounceDuration() > r.state.bounceDuration);
  r.state.layerIndex = 2;
  assert.ok(Math.abs(r._bounceDuration() - r.state.bounceDuration) < 0.0001);
});

test('横风：wind 使 x 持续漂移', () => {
  const r = createRun(1, { seed: 1 }); // L2 wind=140
  const x0 = r.state.x;
  r.step(0.1);
  assert.ok(r.state.x > x0, '横风应把 x 向右推');
});

test('移动云台：movingClouds 使 cloudShift 随时间变化', () => {
  const r = createRun(6, { seed: 1 }); // L7 movingClouds
  assert.equal(r.state.cloudShift, 0);
  r.step(0.1);
  assert.notEqual(r.state.cloudShift, 0);
});

test('revive：lost 后 revive → playing + 炽热态', () => {
  const r = createRun(0, { seed: 1 });
  r.state.layers[r.state.layerIndex] = ['steel', 'steel', 'steel', 'steel', 'steel', 'steel'];
  resolveOnce(r);
  assert.equal(r.state.phase, 'lost');
  const res = r.revive();
  assert.equal(res.ok, true);
  assert.equal(r.state.phase, 'playing');
  assert.equal(r.state.incandescent, true);
  assert.equal(r.state.revived, true);
  assert.ok(r.drainEvents().some((e) => e.type === 'revive'));
});

test('drainEvents：取出后清空', () => {
  const r = createRun(0, { seed: 1 });
  r._emit({ type: 'x' });
  const ev = r.drainEvents();
  assert.equal(ev.length, 1);
  assert.equal(r.drainEvents().length, 0);
});

test('关卡表一致性：12 关 index 连续、难度递增', () => {
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => {
    assert.equal(lv.index, i + 1);
    assert.ok(lv.targetHeight > 0);
    assert.ok(lv.cols >= 3 && lv.cols <= 6);
    assert.ok(lv.cloudStar <= lv.targetHeight);
  });
  for (let i = 1; i < LEVELS.length; i += 1) {
    assert.ok(LEVELS[i].difficulty > LEVELS[i - 1].difficulty, '难度应递增');
  }
});
