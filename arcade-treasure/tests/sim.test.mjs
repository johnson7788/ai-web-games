import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { ECONOMY, MACHINES, MOLE, RAIN, SWARM, rankTarget } from '../config/gameplay.js';
import { STEP } from '../config/game.config.js';

function drain(run) { return run.drainEvents(); }

function endMachine(run) {
  run.machineTime = (MACHINES.DURATION[run.machine] || 24) + 1;
  run.step({});
}
function continueHall(run) {
  if (run.phase === 'result') run.step({ continue: true });
}

test('createRun：大厅开局，代币为起始值', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'hall');
  assert.equal(r.tokens, ECONOMY.START_TOKENS);
  assert.equal(r.rank, 1);
  assert.equal(r.machine, null);
});

test('选台：扣 1 币并进入 playing', () => {
  const r = createRun({ seed: 1 });
  r.step({ pick: 0 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.machine, 0);
  assert.equal(r.tokens, ECONOMY.START_TOKENS - 1);
});

test('打地鼠：命中安全目标加分并发 hit 事件', () => {
  const r = createRun({ seed: 1 });
  r.step({ pick: 0 });
  const h = r.sub.holes[0];
  h.up = true; h.hazard = false; h.t = 1;
  drain(r);
  r.step({ tapX: h.x, tapY: h.y });
  assert.equal(r.score, MOLE.HIT_SCORE);
  assert.ok(drain(r).some((e) => e.type === 'hit'));
});

test('打地鼠：命中危险物倒扣分并发 badHit', () => {
  const r = createRun({ seed: 1 });
  r.step({ pick: 0 });
  const h = r.sub.holes[1];
  h.up = true; h.hazard = true; h.t = 1;
  r.score = 50;
  drain(r);
  r.step({ tapX: h.x, tapY: h.y });
  assert.equal(r.score, 50 + MOLE.HAZARD_SCORE);
  assert.ok(drain(r).some((e) => e.type === 'badHit'));
});

test('接金币：篮筐接住金币加分', () => {
  const r = createRun({ seed: 1 });
  r.step({ pick: 1 });
  // 先推进几步让物品生成
  for (let i = 0; i < 40; i += 1) r.step({});
  const it = r.sub.items[0] || null;
  assert.ok(it, '应有掉落物');
  if (it) {
    it.kind = 'coin';
    r.sub.basketX = it.x;
    it.y = RAIN.BASKET_Y - 10;
    drain(r);
    r.step({ steerX: it.x });
    assert.ok(r.score >= RAIN.COIN_SCORE);
  }
});

test('接金币：接到雷击扣血并发 loseLife', () => {
  const r = createRun({ seed: 1 });
  r.step({ pick: 1 });
  const it = r.sub.items[0] || null;
  if (it) {
    it.kind = 'hazard';
    r.sub.basketX = it.x;
    it.y = RAIN.BASKET_Y - 10;
    drain(r);
    const lives = r.lives;
    r.step({ steerX: it.x });
    assert.equal(r.lives, lives - 1);
    assert.ok(drain(r).some((e) => e.type === 'loseLife'));
  }
});

test('蜂群：移动+开火能命中蜜蜂', () => {
  const r = createRun({ seed: 1 });
  r.step({ pick: 2 });
  const bee = r.sub.bees[0];
  r.sub.shipX = bee.x;
  r.sub.fireT = 0;
  drain(r);
  // 连续开火直到命中（冷却 0.26s）
  let hit = false;
  for (let i = 0; i < 60 && !hit; i += 1) {
    r.step({ steerX: bee.x, fire: true });
    hit = drain(r).some((e) => e.type === 'hit');
  }
  assert.ok(hit, '应命中蜜蜂');
});

test('蜂群：清屏后刷新下一波并发 waveClear', () => {
  const r = createRun({ seed: 1 });
  r.step({ pick: 2 });
  for (const b of r.sub.bees) b.alive = false;
  drain(r);
  r.step({});
  const ev = drain(r);
  assert.ok(ev.some((e) => e.type === 'waveClear'));
  assert.ok(r.sub.bees.length > 0 && r.sub.bees.every((b) => b.alive));
});

test('热度：同台连玩 +1，换台清零', () => {
  const r = createRun({ seed: 1 });
  r.step({ pick: 0 });
  assert.equal(r.heat, 0);
  endMachine(r); continueHall(r);
  r.step({ pick: 0 });
  assert.equal(r.heat, 1);
  endMachine(r); continueHall(r);
  r.step({ pick: 1 });
  assert.equal(r.heat, 0);
});

test('代币公式：达标=1 币，热度 ×1.5', () => {
  const r = createRun({ seed: 1 });
  r.step({ pick: 0 });
  const target = rankTarget(1, 0);
  r.score = target;
  r.heat = 0;
  endMachine(r);
  assert.equal(r.result.tokens, 1);
  continueHall(r);
  r.step({ pick: 0 }); // heat 1
  r.score = target;
  endMachine(r);
  assert.equal(r.result.tokens, Math.floor(ECONOMY.HEAT_MULT[1]));
});

test('升段：三台全达标 → rank+1 且清空位图', () => {
  const r = createRun({ seed: 1 });
  r.tokens = 99;
  for (const m of [0, 1, 2]) {
    r.step({ pick: m });
    r.score = rankTarget(r.rank, m) + 1;
    endMachine(r);
    continueHall(r);
  }
  assert.equal(r.rank, 2);
  assert.equal(r.clearedMask, 0);
  assert.equal(r.stats.bestRank, 2);
});

test('打烊：大厅空置超时 → gameover', () => {
  const r = createRun({ seed: 1 });
  const ticks = Math.ceil(ECONOMY.HALL_IDLE_LIMIT / STEP) + 1;
  for (let i = 0; i < ticks; i += 1) r.step({});
  assert.equal(r.phase, 'gameover');
});

test('币尽：先赠币兜底，再投币 → gameover', () => {
  const r = createRun({ seed: 1 });
  r.tokens = 0;
  r.step({ pick: 0 });
  assert.equal(r.phase, 'hall');
  assert.equal(r.tokens, ECONOMY.PITY_TOKEN);
  r.tokens = 0;
  r.step({ pick: 0 });
  assert.equal(r.phase, 'gameover');
});

test('GRAND PRIX：12 段全通 → grandprix 亮灯', () => {
  const r = createRun({ seed: 1 });
  r.tokens = 9999;
  let guard = 0;
  while (r.phase !== 'grandprix' && guard < 40) {
    guard += 1;
    for (const m of [0, 1, 2]) {
      if (r.phase === 'grandprix') break;
      r.step({ pick: m });
      r.score = rankTarget(r.rank, m) + 1;
      endMachine(r);
      continueHall(r);
    }
  }
  assert.equal(r.phase, 'grandprix');
  assert.equal(r.signLit, true);
});

test('rng：同 seed 可复现', () => {
  const a = createRun({ seed: 42 }).rng();
  const b = createRun({ seed: 42 }).rng();
  const c = createRun({ seed: 43 }).rng();
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('getHud：返回完整 HUD 形状', () => {
  const r = createRun({ seed: 1 });
  const h = r.getHud();
  for (const k of ['phase', 'machine', 'tokens', 'rank', 'score', 'target', 'heat', 'time', 'lives', 'combo', 'clearedMask', 'signLit']) {
    assert.ok(k in h, `缺 ${k}`);
  }
});

test('机台限时：时间到 → result', () => {
  const r = createRun({ seed: 1 });
  r.step({ pick: 0 });
  endMachine(r);
  assert.equal(r.phase, 'result');
});

test('事件被清空：drainEvents 后为空', () => {
  const r = createRun({ seed: 1 });
  r.step({ pick: 0 });
  drain(r);
  assert.equal(r.events.length, 0);
});
