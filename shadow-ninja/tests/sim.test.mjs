import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, generateCourse, mulberry32, CELL_W } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { GAME } from '../config/game.config.js';

function playing(run) {
  run.state.phase = 'playing';
  run.state.countdown = 0;
}

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

function firstCell(run, type) {
  return run.state.course.findIndex((c) => c.t === type);
}

function greedyToEnd(run, maxSteps = 6000) {
  const s = run.state;
  let t = 0;
  while (s.phase !== 'won' && s.phase !== 'lost' && t < maxSteps) {
    const front = Math.floor(s.x / CELL_W);
    const gh = (c) => c && (c.t === 'gap' || c.t === 'spike' || c.t === 'enemy');
    if ((gh(s.course[front]) || gh(s.course[front + 1]) || gh(s.course[front + 2])) && s.onGround) run.jump();
    else if (!s.onGround && s.y > 60 && !gh(s.course[front]) && !gh(s.course[front + 1])) run.dive();
    run.step(1 / 60);
    t += 1;
  }
}

test('冒烟：createRun → step → jump → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  playing(r);
  const j = r.jump();
  assert.equal(j.ok, true);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.ok(Array.isArray(r.drainEvents()));
});

test('state 形状：level/phase/course/goalDist/chimeGoal', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'countdown');
  assert.ok(Array.isArray(s.course));
  assert.ok(s.course.length >= 50);
  assert.ok(s.goalDist > 0);
  assert.ok(s.chimeGoal > 0);
  assert.ok(s.chimeTotal >= s.chimeGoal, '风铃总量应不低于目标');
});

test('关卡生成确定性：同 seed 同关卡', () => {
  const a = generateCourse(LEVELS[0], mulberry32(5));
  const b = generateCourse(LEVELS[0], mulberry32(5));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('12 关全部可生成且目标递增', () => {
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const r = createRun(i, { seed: 1 });
    assert.ok(r.state.course.length > 0);
    assert.equal(r.state.level, i + 1);
  }
  for (let i = 1; i < LEVEL_COUNT; i += 1) {
    assert.ok(LEVELS[i].speed >= LEVELS[i - 1].speed, `第 ${i + 1} 关速度应递增`);
  }
});

test('倒计时：走完进入 playing 并发 go', () => {
  const r = createRun(0, { seed: 1 });
  advance(r, GAME.COUNTDOWN + 0.1);
  assert.equal(r.state.phase, 'playing');
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'go'));
});

test('跳跃：离地且 vy>0', () => {
  const r = createRun(0, { seed: 1 });
  playing(r);
  assert.equal(r.jump().ok, true);
  assert.equal(r.state.onGround, false);
  assert.ok(r.state.vy > 0);
});

test('二段跳：斗篷解锁后空中可再跳', () => {
  const r = createRun(0, { seed: 1, abilities: { cloak: true } });
  playing(r);
  r.jump();
  assert.equal(r.state.onGround, false);
  const j2 = r.jump();
  assert.equal(j2.ok, true);
  assert.equal(r.state.doubleJumpUsed, true);
});

test('无斗篷：空中不能二段跳', () => {
  const r = createRun(0, { seed: 1 });
  playing(r);
  r.jump();
  assert.equal(r.jump().ok, false);
});

test('俯冲：空中 vy 变负', () => {
  const r = createRun(0, { seed: 1 });
  playing(r);
  r.jump();
  assert.equal(r.dive().ok, true);
  assert.ok(r.state.vy < 0);
});

test('跳跃后落地：落回地面', () => {
  const r = createRun(0, { seed: 1 });
  playing(r);
  r.jump();
  advance(r, 1.0);
  assert.equal(r.state.onGround, true);
  assert.equal(r.state.y, 0);
});

test('断口：不跳会掉进深渊判死 fell', () => {
  const r = createRun(0, { seed: 1 });
  playing(r);
  advance(r, 30);
  assert.equal(r.state.phase, 'lost');
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'lose' && e.reason === 'fell'));
});

test('尖刺：贴地撞刺判死', () => {
  const r = createRun(1, { seed: 1 }); // L2 有尖刺
  playing(r);
  const idx = firstCell(r, 'spike');
  assert.ok(idx >= 0);
  r.state.x = idx * CELL_W + 10;
  r.state.y = 0;
  r.state.onGround = true;
  r.state.vy = 0;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'lost');
});

test('飞镖：贴地跑安全', () => {
  const r = createRun(2, { seed: 1 }); // L3 有飞镖
  playing(r);
  const idx = firstCell(r, 'shuriken');
  assert.ok(idx >= 0);
  r.state.x = idx * CELL_W + 10;
  r.state.y = 0;
  r.state.onGround = true;
  r.state.vy = 0;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'playing');
});

test('飞镖：跳起撞镖判死', () => {
  const r = createRun(2, { seed: 1 });
  playing(r);
  const idx = firstCell(r, 'shuriken');
  r.state.x = idx * CELL_W + 10;
  r.state.y = 90;
  r.state.onGround = false;
  r.state.vy = 0;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'lost');
});

test('风铃收集：贴地经过低空风铃增加 chimes', () => {
  const r = createRun(0, { seed: 1 });
  playing(r);
  const idx = r.state.course.findIndex((c) => c.chime);
  assert.ok(idx >= 0);
  r.state.x = idx * CELL_W + 10;
  r.state.y = 0;
  r.state.onGround = true;
  r.state.vy = 0;
  r.step(1 / 60);
  assert.ok(r.state.chimes >= 1);
});

test('护盾：开场铃铛吸收一次伤害', () => {
  const r = createRun(1, { seed: 1, abilities: { bell: true } });
  playing(r);
  assert.equal(r.state.shield, 1);
  const idx = firstCell(r, 'spike');
  r.state.x = idx * CELL_W + 10;
  r.state.y = 0;
  r.state.onGround = true;
  r.state.vy = 0;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'playing');
  assert.equal(r.state.shield, 0);
  assert.equal(r.state.hits, 1);
});

test('道具：fly/magnet/double 激活并扣减', () => {
  const r = createRun(0, { seed: 1, props: { fly: 1, magnet: 1, double: 1 } });
  playing(r);
  assert.equal(r.useProp('fly').ok, true);
  assert.ok(r.state.flyT > 0);
  assert.equal(r.state.props.fly, 0);
  assert.equal(r.useProp('magnet').ok, true);
  assert.ok(r.state.magnetT > 0);
  assert.equal(r.useProp('double').ok, true);
  assert.ok(r.state.doubleT > 0);
});

test('道具为空：useProp 返回 empty', () => {
  const r = createRun(0, { seed: 1 });
  playing(r);
  assert.deepEqual(r.useProp('fly'), { ok: false, reason: 'empty' });
});

test('复活：lost 后 revive 回到 playing', () => {
  const r = createRun(0, { seed: 1 });
  playing(r);
  advance(r, 30);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.revive().ok, true);
  assert.equal(r.state.phase, 'playing');
});

test('通关：greedy 能 3 星无伤通关第 1 关', () => {
  const r = createRun(0, { seed: 3 });
  greedyToEnd(r);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.hits, 0);
  assert.equal(r.state.stars, 3);
  assert.ok(r.state.chimes >= r.state.chimeGoal);
});

test('通关：greedy 串行能到第 3 关', () => {
  for (const lv of [0, 1, 2]) {
    const r = createRun(lv, { seed: 3 + lv });
    greedyToEnd(r);
    assert.equal(r.state.phase, 'won', `第 ${lv + 1} 关应可通关`);
  }
});

test('事件表：包含多种事件类型', () => {
  const r = createRun(0, { seed: 3 });
  const seen = new Set();
  const s = r.state;
  let t = 0;
  while (s.phase !== 'won' && s.phase !== 'lost' && t < 6000) {
    const front = Math.floor(s.x / CELL_W);
    const gh = (c) => c && (c.t === 'gap' || c.t === 'spike' || c.t === 'enemy');
    if ((gh(s.course[front]) || gh(s.course[front + 1]) || gh(s.course[front + 2])) && s.onGround) r.jump();
    else if (!s.onGround && s.y > 60 && !gh(s.course[front]) && !gh(s.course[front + 1])) r.dive();
    r.step(1 / 60);
    t += 1;
    for (const e of r.drainEvents()) seen.add(e.type);
  }
  for (const t of ['countdownTick', 'go', 'cellEnter', 'jump', 'collect', 'win']) {
    assert.ok(seen.has(t), `应包含事件 ${t}`);
  }
});

test('追击犬区间：speedup 事件与加速', () => {
  const r = createRun(3, { seed: 1 }); // L4 有追击犬
  playing(r);
  const dogIdx = r.state.course.findIndex((c) => c.dog);
  assert.ok(dogIdx >= 0);
  r.state.x = dogIdx * CELL_W + 5;
  r.state.y = 0;
  r.state.onGround = true;
  const before = r.state.speed;
  r.step(1 / 60);
  assert.ok(r.state.speed > before);
});
