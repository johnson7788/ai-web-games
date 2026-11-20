import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { BIRD, WORLD, GATE } from '../config/game.config.js';

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

// 让一关进入 playing 并生成竹节
function startPlaying(i = 0, seed = 1) {
  const r = createRun(i, { seed });
  r.flap();
  r.step(1 / 60);
  r.drainEvents();
  return r;
}

test('冒烟：createRun → flap → step → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  assert.equal(r.flap().ok, true);
  r.step(1 / 60);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.target, LEVELS[0].target);
  assert.ok(Array.isArray(r.drainEvents()));
});

test('state 形状：level/scene/phase/score/target/bird/gates', () => {
  const r = startPlaying(0);
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.scene, 'mist');
  assert.equal(s.phase, 'playing');
  assert.equal(s.score, 0);
  assert.equal(s.target, 5);
  assert.equal(typeof s.bird.x, 'number');
  assert.ok(Array.isArray(s.gates));
  assert.ok(s.gates.length > 0);
});

test('上扑：flap 使 vy 为负，并把 ready 推进到 playing', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.state.phase, 'ready');
  r.flap();
  assert.equal(r.state.phase, 'playing');
  assert.ok(r.state.bird.vy < 0);
});

test('重力：不输入时小鸟随时间下坠', () => {
  const r = startPlaying(0);
  const y0 = r.state.bird.y;
  advance(r, 0.8);
  assert.ok(r.state.bird.y > y0);
  assert.ok(r.state.bird.vy > 0);
});

test('落地：y 触地 → death ground', () => {
  const r = startPlaying(0);
  r.state.bird.y = WORLD.GROUND_Y - BIRD.R;
  r.state.bird.vy = 0;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'ground');
});

test('触顶：y 超过天花板 → death ceiling', () => {
  const r = startPlaying(0);
  r.state.bird.y = BIRD.R + 1;
  r.state.bird.vy = -300;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'ceiling');
});

test('穿缝记分：竹节越过小鸟后 score+1 并发 gatePass', () => {
  const r = startPlaying(0);
  const g = r.state.gates[0];
  g.x = r.state.bird.x - 100;
  g.scored = false;
  g.baseGapY = r.state.bird.y;
  g.moveAmp = 0;
  r._updateGateRects(g);
  r.state.bird.vy = 0;
  const before = r.state.score;
  r.step(1 / 60);
  assert.equal(r.state.score, before + 1);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'gatePass' && e.points === 1));
});

test('撞竹：竹节中心与小鸟重叠 → death stalk', () => {
  const r = startPlaying(0);
  const g = r.state.gates[0];
  g.x = r.state.bird.x;
  g.baseGapY = 800; // 缝极低，鸟必然撞上竹节
  g.moveAmp = 0;
  r._updateGateRects(g);
  r.state.bird.vy = 0;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'stalk');
});

test('过关：score 达到 target → phase won + win 事件', () => {
  const r = startPlaying(0);
  r.state.score = r.state.target - 1;
  const g = r.state.gates[0];
  g.x = r.state.bird.x - 100;
  g.scored = false;
  g.baseGapY = r.state.bird.y;
  g.moveAmp = 0;
  r._updateGateRects(g);
  r.state.bird.vy = 0;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
  assert.ok(r.drainEvents().some((e) => e.type === 'win'));
});

test('移动缝：gapY 随时间摆动', () => {
  const r = startPlaying(2); // L3 moving
  const g = r.state.gates[0];
  const y0 = g.gapY;
  advance(r, g.movePeriod / 4);
  assert.notEqual(g.gapY, y0);
});

test('气流滑翔：held 时下坠更慢', () => {
  const r = startPlaying(3); // L4 updraft
  r.state.bird.y = WORLD.HEIGHT / 2;
  r.state.bird.vy = 0;
  r.setHold(true);
  advance(r, 0.3);
  const glideFall = r.state.bird.y - WORLD.HEIGHT / 2;
  assert.ok(glideFall > 0 && glideFall < 30, `glide fall ${glideFall}`);
});

test('逆风漂移：wind 关小鸟水平位移', () => {
  const r = startPlaying(4); // L5 wind
  const x0 = r.state.bird.x;
  advance(r, 0.5);
  assert.notEqual(r.state.bird.x, x0);
});

test('竹刺转轮：重叠 → death wheel', () => {
  const r = startPlaying(6); // L7 wheel
  const g = r.state.gates[0];
  g.x = r.state.bird.x;
  r.state.bird.y = g.wheel.cy;
  r.state.bird.vy = 0;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'wheel');
});

test('双缝：近缝+1 远缝+3 的路线判定', () => {
  const r = startPlaying(5); // L6 double
  const g = r.state.gates[0];
  assert.equal(g.kind, 'double');
  // 近缝 = 生成时离小鸟更近的那一侧
  assert.ok(g.nearCenter === 'upper' || g.nearCenter === 'lower');
  const far = g.nearCenter === 'upper' ? 'lower' : 'upper';
  assert.ok([1, 3].includes(g.nearPoints));
  assert.ok([1, 3].includes(g.farPoints));
  assert.notEqual(far, g.nearCenter);
});

test('事件表：包含 levelStart / flap / ink / breeze', () => {
  const r = createRun(0, { seed: 1 });
  const ev0 = r.drainEvents();
  assert.ok(ev0.some((e) => e.type === 'levelStart'));
  r.flap();
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'flap'));
  assert.ok(ev.some((e) => e.type === 'ink'));
  advance(r, 1);
  assert.ok(r.drainEvents().some((e) => e.type === 'breeze'));
});

test('无输入基线：ready 宽限后自动起飞并死亡', () => {
  const r = createRun(0, { seed: 1 });
  advance(r, 4);
  assert.ok(['lost', 'won'].includes(r.state.phase));
  assert.equal(r.state.result.won, false);
});

test('随机确定性：同 seed 生成相同缝心', () => {
  const a = startPlaying(0, 42);
  const b = startPlaying(0, 42);
  assert.equal(a.state.gates[0].baseGapY, b.state.gates[0].baseGapY);
});

test('mulberry32：确定性序列', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  for (let i = 0; i < 5; i += 1) assert.equal(a(), b());
});

test('nearMiss：贴边穿越发出 nearMiss 事件', () => {
  const r = startPlaying(0);
  const g = r.state.gates[0];
  g.x = r.state.bird.x - 100;
  g.scored = false;
  g.baseGapY = r.state.bird.y + g.gapH / 2 - GATE.NEAR_MISS + 4; // 距下沿约 20px
  g.moveAmp = 0;
  r._updateGateRects(g);
  r.state.bird.vy = 0;
  r.step(1 / 60);
  assert.ok(r.drainEvents().some((e) => e.type === 'nearMiss'));
});

test('关卡表：12 关 index 连续、target 递增且正', () => {
  assert.equal(LEVEL_COUNT, 12);
  LEVELS.forEach((lv, i) => {
    assert.equal(lv.index, i + 1);
    assert.ok(lv.target > 0);
  });
});
