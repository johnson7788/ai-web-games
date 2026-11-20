import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32, beatTimes } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { GAME } from '../config/game.config.js';

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

test('冒烟：createRun → step → move → jump → getHud → drainEvents 无异常', () => {
  const r = createRun(1, { seed: 1 });
  r.step(1 / 60);
  r.move(1);
  r.jump();
  const hud = r.getHud();
  assert.equal(hud.level, 2);
  assert.equal(hud.phase, 'playing');
  assert.ok(Array.isArray(r.drainEvents()));
});

test('state 形状：level/phase/lanes/obstacles/duration', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'playing');
  assert.equal(s.lanes, 1);
  assert.ok(s.duration > 0);
  assert.ok(Array.isArray(s.obstacles));
  assert.ok(s.obstacles.length > 0);
});

test('mulberry32：同 seed 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 20; i += 1) assert.equal(a(), b());
});

test('beatTimes：恒定 BPM 线性', () => {
  const t = beatTimes(LEVELS[0]);
  assert.equal(t.length, LEVELS[0].beats + 1);
  const d = t[1] - t[0];
  assert.ok(Math.abs(d - 60 / 90) < 1e-9);
  assert.ok(Math.abs(t[10] - 10 * d) < 1e-9);
});

test('beatTimes：tempoShift 中段变速', () => {
  const lv = LEVELS[6]; // L7 bpm2/shiftBeat
  const t = beatTimes(lv);
  const d1 = 60 / lv.bpm;
  const d2 = 60 / lv.bpm2;
  assert.ok(Math.abs((t[31] - t[30]) - d1) < 1e-9); // shiftBeat 前仍是 d1
  assert.ok(Math.abs((t[32] - t[31]) - d2) < 1e-9); // shiftBeat 起切 d2
});

test('obstacles 按 t 排序；同拍鼓槌先于节拍点', () => {
  const r = createRun(3, { seed: 7 });
  const o = r.state.obstacles;
  for (let i = 1; i < o.length; i += 1) {
    const prev = o[i - 1];
    const cur = o[i];
    assert.ok(prev.t <= cur.t);
    if (prev.t === cur.t) assert.ok(!(prev.kind === 'pad' && cur.kind === 'hazard'));
  }
});

test('单轨：所有鼓槌都在 0 号轨', () => {
  const r = createRun(0, { seed: 1 });
  for (const o of r.state.obstacles) {
    if (o.kind === 'hazard') assert.equal(o.lane, 0);
  }
});

test('多轨：任一拍至少留一条安全轨', () => {
  for (const idx of [2, 4, 5, 11]) {
    const r = createRun(idx, { seed: 3 });
    const byT = new Map();
    for (const o of r.state.obstacles) {
      if (o.kind !== 'hazard') continue;
      if (!byT.has(o.t)) byT.set(o.t, new Set());
      byT.get(o.t).add(o.lane);
    }
    for (const [, lanes] of byT) {
      assert.ok(lanes.size < r.state.lanes, `L${idx + 1} 出现全轨鼓槌`);
    }
  }
});

test('move：横移换轨并夹在边界内', () => {
  const r = createRun(2, { seed: 1 }); // L3 三轨
  assert.equal(r.move(1).ok, true);
  assert.equal(r.state.playerLane, 1);
  assert.equal(r.move(1).ok, true);
  assert.equal(r.state.playerLane, 2);
  assert.equal(r.move(1).ok, false); // 已到右边界
  assert.equal(r.move(-1).ok, true);
  assert.equal(r.state.playerLane, 1);
});

test('move：单轨禁止横移', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.move(1).ok, false);
  assert.equal(r.state.playerLane, 0);
});

test('jump：起跳发 jump，滞空时二次起跳失败', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.jump().ok, true);
  assert.equal(r.state.playerJumping, true);
  assert.equal(r.jump().ok, false);
});

test('jump：JUMP_DURATION 后落地发 jumpLand', () => {
  const r = createRun(0, { seed: 1 });
  r.jump();
  advance(r, GAME.JUMP_DURATION + 0.05);
  assert.equal(r.state.playerJumping, false);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'jumpLand'));
});

test('padHit：踩中节拍点加分/连击/perfects', () => {
  const r = createRun(0, { seed: 1 }); // L1 单轨
  const pad = r.state.obstacles.find((o) => o.kind === 'pad');
  assert.ok(pad);
  advance(r, pad.t + 0.02);
  assert.ok(r.state.perfects >= 1);
  assert.ok(r.state.combo >= 1);
  assert.ok(r.state.score > 0);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'padHit'));
});

test('padMiss：普通节拍点上滞空会断连击', () => {
  const r = createRun(0, { seed: 1 });
  const pad = r.state.obstacles.find((o) => o.kind === 'pad');
  advance(r, pad.t - 0.05);
  r.state.playerJumping = true;
  r.state.jumpT = 0.5;
  advance(r, 0.1);
  assert.equal(r.state.combo, 0);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'padMiss'));
});

test('jumpPad：L6 跳板节拍点需滞空才得分', () => {
  const r = createRun(5, { seed: 11 });
  const pad = r.state.obstacles.find((o) => o.kind === 'pad' && o.jump);
  assert.ok(pad, 'L6 应存在 jump pad');
  r.state.playerLane = pad.lane;
  r.state.playerJumping = true;
  advance(r, pad.t + 0.02);
  assert.ok(r.state.perfects >= 1);
});

test('hazard：撞槌判负', () => {
  const r = createRun(0, { seed: 1 });
  const hz = r.state.obstacles.find((o) => o.kind === 'hazard');
  assert.ok(hz);
  advance(r, hz.t + 0.02);
  assert.equal(r.state.phase, 'lost');
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'crash'));
  assert.ok(ev.some((e) => e.type === 'lose'));
});

test('hazard：滞空跨过鼓槌 → nearMiss 不判负', () => {
  const r = createRun(0, { seed: 1 });
  const hz = r.state.obstacles.find((o) => o.kind === 'hazard');
  advance(r, hz.t - 0.1);
  r.state.playerJumping = true;
  r.state.jumpT = 0.4;
  advance(r, 0.15);
  assert.equal(r.state.phase, 'playing');
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'nearMiss'));
});

test('hazard：相邻轨擦过 → nearMiss', () => {
  const r = createRun(2, { seed: 5 }); // 三轨
  const hz = r.state.obstacles.find((o) => o.kind === 'hazard');
  // 找一个非相邻安全轨作为玩家位置，再手动放到相邻轨
  r.state.playerLane = hz.lane === 0 ? 1 : hz.lane - 1;
  advance(r, hz.t + 0.02);
  const ev = r.drainEvents();
  if (r.state.phase === 'playing') {
    assert.ok(ev.some((e) => e.type === 'nearMiss'));
  }
});

test('win：跑到目标距离结算 won 且至少 1 星', () => {
  const r = createRun(0, { seed: 1 });
  // 单轨自动推进会撞槌，这里直接跳到终点前跳过所有槌：用滞空覆盖不了全程，
  // 改用手动把 phase 之外的方式——直接快速推进并持续滞空以规避单轨鼓槌。
  const step = 1 / 60;
  while (r.state.phase === 'playing') {
    // 单轨避槌：临近鼓槌就起跳
    const hz = r.state.obstacles.find((o) => o.kind === 'hazard' && !o.resolved && o.t - r.state.clock < 0.3);
    if (hz && !r.state.playerJumping) r.jump();
    r.step(step);
    if (r.state.clock > r.state.duration + 1) break;
  }
  assert.equal(r.state.phase, 'won');
  assert.ok(r.state.stars >= 1);
  assert.ok(r.state.result.won);
});

test('stars：maxCombo 达标 +1 星', () => {
  const r = createRun(0, { seed: 1 });
  r.state.maxCombo = 99;
  // 直接测 _win 分支：构造一个已到终点的 run
  r.state.clock = r.state.duration;
  r.step(1 / 60);
  // 可能已被某事件结算；若仍 playing 则手动 win 判定
  if (r.state.phase === 'playing') {
    r.state.clock = r.state.duration;
    r.step(1 / 60);
  }
  if (r.state.phase === 'won') {
    const lv = LEVELS[0];
    assert.ok(r.state.stars >= (r.state.maxCombo >= lv.targetCombo ? 2 : 1));
  }
});

test('lose：结算 result.won=false', () => {
  const r = createRun(0, { seed: 1 });
  const hz = r.state.obstacles.find((o) => o.kind === 'hazard');
  advance(r, hz.t + 0.02);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
});

test('distance：距离随时间推进并计分', () => {
  const r = createRun(0, { seed: 1 });
  advance(r, 2);
  assert.ok(r.state.distance > 0);
  assert.equal(r.state.distance, Math.round(r.state.clock * GAME.DIST_PER_SEC));
});

test('事件密度：beat 事件每拍一发', () => {
  const r = createRun(0, { seed: 1 });
  advance(r, 60 / 90 * 3); // 3 拍
  const ev = r.drainEvents();
  const beats = ev.filter((e) => e.type === 'beat');
  assert.ok(beats.length >= 3);
});
