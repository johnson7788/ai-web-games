import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32, radius } from '../src/game/sim.js';
import { KILN, GAME } from '../config/game.config.js';

// 手动往场上放一枚球（用于精确构造合并/冰冻/双色场景）
function addBall(run, value, x, y, opts = {}) {
  const b = {
    id: run._nextId++,
    value,
    x,
    y,
    vx: 0,
    vy: 0,
    r: radius(value),
    held: false,
    frozen: !!opts.frozen,
    phase: opts.phase ?? 0,
    sleeping: false,
    sleepT: 0,
    stillT: 0,
    px: x,
    py: y,
    aboveT: 0,
    landed: true,
  };
  run.state.balls.push(b);
  return b;
}

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

test('冒烟：createRun → step → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'playing');
  const ev = r.drainEvents();
  assert.ok(Array.isArray(ev));
});

test('state 形状：level/sceneKey/phase/kiln/goal/held 存在', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.sceneKey, 'morning-workshop');
  assert.equal(s.phase, 'playing');
  assert.ok(s.kiln.left < s.kiln.right);
  assert.ok(s.kiln.failLineY < s.kiln.floorY);
  assert.ok(s.goal && s.goal.type);
  assert.ok(s.held, '初始应生成持球');
  assert.ok(Array.isArray(s.preview) && s.preview.length >= 1);
});

test('半径随数值对数增长且单调', () => {
  assert.ok(radius(2) > 0);
  assert.ok(radius(2048) > radius(2));
  assert.ok(radius(1024) > radius(512));
  assert.equal(Math.round(radius(2) * 10) / 10, Math.round(GAME.R_BASE * (1 + 1 / 10) * 10) / 10);
});

test('RNG：mulberry32 同 seed 可复现，不同 seed 不同', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const c = mulberry32(43);
  assert.equal(a(), b());
  assert.notEqual(a(), c());
});

test('投放：drop 后持球进入 balls，drops 递增，spawn 事件', () => {
  const r = createRun(0, { seed: 1 });
  const heldValue = r.state.held.value;
  const res = r.drop();
  assert.equal(res.ok, true);
  assert.equal(r.state.held, null);
  assert.equal(r.state.balls.length, 1);
  assert.equal(r.state.balls[0].value, heldValue);
  assert.equal(r.state.drops, 1);
});

test('投放点边界：setDropX 被 clamp 到窑壁内', () => {
  const r = createRun(0, { seed: 1 });
  const k = r.state.kiln;
  r.setDropX(-1000);
  assert.ok(r.state.held.x >= k.left);
  r.setDropX(10000);
  assert.ok(r.state.held.x <= k.right);
});

test('重力：投放后球下落并落底睡眠', () => {
  const r = createRun(0, { seed: 1 });
  r.setDropX((r.state.kiln.left + r.state.kiln.right) / 2);
  r.drop();
  advance(r, 4);
  const b = r.state.balls[0];
  assert.ok(b.sleeping, '球应最终入睡');
  assert.ok(Math.abs((b.y + b.r) - r.state.kiln.floorY) < 1.5, '球应贴底');
});

test('同值合并：两枚 2 接触 → 合为 4，score 增加', () => {
  const r = createRun(0, { seed: 1 });
  r.state.balls = [];
  const a = addBall(r, 2, 500, 600);
  const b = addBall(r, 2, 500 + radius(2) * 2 - 1, 600);
  r.step(1 / 60);
  const vals = r.state.balls.map((x) => x.value).sort((m, n) => m - n);
  assert.deepEqual(vals, [4], '应只剩一枚 4');
  assert.equal(r.state.score, 4);
  assert.equal(r.state.maxValue, 4);
});

test('异值不合并：2 与 4 接触保持不变', () => {
  const r = createRun(0, { seed: 1 });
  r.state.balls = [];
  addBall(r, 2, 500, 600);
  addBall(r, 4, 500 + radius(2) + radius(4) - 1, 600);
  r.step(1 / 60);
  assert.equal(r.state.balls.length, 2);
  assert.equal(r.state.maxValue, 2);
});

test('出窑消除：合并到 eliminateAt 阈值自动消除并加分', () => {
  const r = createRun(2, { seed: 1 }); // L3 eliminateAt=256
  r.state.balls = [];
  addBall(r, 128, 500, 600);
  addBall(r, 128, 500 + radius(128) * 2 - 1, 600);
  r.step(1 / 60);
  assert.equal(r.state.balls.length, 0, '256 应被消除');
  assert.equal(r.state.eliminated, 1);
  assert.equal(r.state.maxValue, 256);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'eliminate' && e.value === 256));
});

test('冰冻球：不可合并，两次合并后解冻', () => {
  const r = createRun(4, { seed: 1 }); // L5 frozen
  r.state.balls = [];
  const f1 = addBall(r, 2, 500, 600, { frozen: true });
  const f2 = addBall(r, 2, 500 + radius(2) * 2 - 1, 600, { frozen: true });
  r.step(1 / 60);
  assert.equal(r.state.balls.length, 2, '冰冻球不应合并');
  assert.ok(f1.frozen && f2.frozen);

  // 触发 2 次合并 → 冰冻球解冻
  addBall(r, 8, 800, 600);
  addBall(r, 8, 800 + radius(8) * 2 - 1, 600);
  r.step(1 / 60);
  addBall(r, 16, 700, 400);
  addBall(r, 16, 700 + radius(16) * 2 - 1, 400);
  r.step(1 / 60);
  assert.equal(f1.frozen, false, '冰冻球应解冻');
});

test('双色釉：异色才能合，合并后翻色', () => {
  const r = createRun(5, { seed: 1 }); // L6 dualGlaze
  r.state.balls = [];
  addBall(r, 2, 500, 600, { phase: 0 });
  addBall(r, 2, 500 + radius(2) * 2 - 1, 600, { phase: 0 });
  r.step(1 / 60);
  assert.equal(r.state.balls.length, 2, '同色不应合并');

  const a = addBall(r, 2, 700, 600, { phase: 1 });
  addBall(r, 2, 700 + radius(2) * 2 - 1, 600, { phase: 0 });
  r.step(1 / 60);
  const merged = r.state.balls.find((b) => b.value === 4);
  assert.ok(merged, '异色应合并');
});

test('重锤：smash 移除任意球并扣次数', () => {
  const r = createRun(3, { seed: 1 }); // L4 hammer=1
  r.state.balls = [];
  const b = addBall(r, 32, 500, 600);
  assert.equal(r.state.hammerLeft, 1);
  const res = r.smash(b.id);
  assert.equal(res.ok, true);
  assert.equal(r.state.balls.length, 0);
  assert.equal(r.state.hammerLeft, 0);
  assert.deepEqual(r.smash(b.id), { ok: false, reason: 'noHammer' });
});

test('失败线：静止越线 → lose overflow', () => {
  const r = createRun(0, { seed: 1 });
  r.state.balls = [];
  const b = addBall(r, 2, 500, r.state.kiln.failLineY - 20);
  b.sleeping = true;
  advance(r, 1.0);
  assert.equal(r.state.phase, 'lost');
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'lose' && e.reason === 'overflow'));
});

test('mergeTo 目标：合成到目标值即 win', () => {
  const r = createRun(0, { seed: 1 }); // L1 mergeTo 128
  r.state.balls = [];
  addBall(r, 64, 500, 600);
  addBall(r, 64, 500 + radius(64) * 2 - 1, 600);
  r.step(1 / 60);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.maxValue, 128);
  assert.ok(r.drainEvents().some((e) => e.type === 'win'));
});

test('eliminate 目标：出窑计数达标即 win', () => {
  const r = createRun(2, { seed: 1 }); // L3 eliminate 1×≥256
  r.state.balls = [];
  addBall(r, 128, 500, 600);
  addBall(r, 128, 500 + radius(128) * 2 - 1, 600);
  r.step(1 / 60);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.eliminated, 1);
});

test('score 目标 + 投放耗尽判负', () => {
  const r = createRun(6, { seed: 1 }); // L7 score 3000 / dropLimit 42
  assert.equal(r.state.dropLimit, 42);
  // 模拟：投放耗尽、场上无球、分数未达标 → 结算失败
  r.state.balls = [];
  r.state.held = null;
  r._spawnClock = 0;
  r.state.drops = 42;
  r._dropsExhausted = true;
  advance(r, 2.0);
  assert.equal(r.state.phase, 'lost');
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'lose' && e.reason === 'dropsOut'));
});

test('score 目标：达标即 win（不受投放限制影响）', () => {
  const r = createRun(6, { seed: 1 }); // L7 score 3000
  r.state.balls = [];
  // 合成 512 + 512 → 1024：score 1024+1024(出窑? 2048 才消除) 直接加到目标
  r.state.score = 3000;
  r.state.maxValue = 1024;
  r._checkWin();
  assert.equal(r.state.phase, 'won');
});

test('种子确定性：同 seed 两局前 5 次投放值一致', () => {
  const seq = (seed) => {
    const r = createRun(0, { seed });
    const vals = [];
    for (let i = 0; i < 5; i += 1) {
      vals.push(r.state.held.value);
      r.drop();
      advance(r, 0.6);
      while (!r.state.held) { r.step(1 / 60); }
    }
    return vals;
  };
  assert.deepEqual(seq(9), seq(9));
  assert.notDeepEqual(seq(9), seq(10));
});

test('预览：preview 长度等于关卡 preview 数', () => {
  assert.equal(createRun(0, { seed: 1 }).state.preview.length, 1);
  assert.equal(createRun(1, { seed: 1 }).state.preview.length, 2);
  assert.equal(createRun(8, { seed: 1 }).state.preview.length, 3);
});

test('窄窑腔：kilnInset 内收左右墙', () => {
  const wide = createRun(0, { seed: 1 });
  const narrow = createRun(7, { seed: 1 }); // L8 narrow inset 70
  assert.ok(narrow.state.kiln.left > wide.state.kiln.left);
  assert.ok(narrow.state.kiln.right < wide.state.kiln.right);
});
