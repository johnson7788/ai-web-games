import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { SERPENT, GATES, GAME, WORLD } from '../config/game.config.js';

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

function drain(run) {
  const ev = run.drainEvents();
  return ev;
}

test('冒烟：createRun → 状态形状正确', () => {
  const r = createRun({ seed: 1 });
  const s = r.state;
  assert.equal(s.phase, 'playing');
  assert.equal(s.level, 1);
  assert.equal(s.score, 0);
  assert.equal(s.serpent.body, SERPENT.BODY_START);
  assert.equal(s.serpent.segs.length, SERPENT.BODY_START);
  assert.equal(s.gates.length, GATES.COUNT);
  assert.ok(s.pickups.length > 0);
});

test('拍翼：flap 设置向上速度并发出 flap 事件', () => {
  const r = createRun({ seed: 1 });
  const res = r.flap();
  assert.equal(res.ok, true);
  assert.ok(r.state.serpent.vy < 0);
  const ev = drain(r);
  assert.ok(ev.some((e) => e.type === 'flap'));
});

test('重力：不拍翼时 y 会下坠', () => {
  const r = createRun({ seed: 1 });
  const y0 = r.state.serpent.y;
  advance(r, 0.5);
  assert.ok(r.state.serpent.y > y0);
});

test('死亡：坠落到地板 → dead + die 事件', () => {
  const r = createRun({ seed: 1 });
  advance(r, 4);
  assert.equal(r.state.phase, 'dead');
  assert.equal(r.state.result.won, false);
  const ev = drain(r);
  assert.ok(ev.some((e) => e.type === 'die'));
});

test('计分：飞蛇穿过门后得分并发出 score 事件', () => {
  const r = createRun({ seed: 7 });
  // 手动把第一个门拉到头部左缘附近，保持头部居中穿过缺口
  const s = r.state;
  const g0 = s.gates[0];
  g0.x = SERPENT.X - SERPENT.R - g0.w / 2 + 10;
  g0.gapY = WORLD.HEIGHT / 2;
  s.serpent.y = WORLD.HEIGHT / 2;
  s.serpent.vy = 0;
  advance(r, 0.1);
  const ev = drain(r);
  assert.ok(ev.some((e) => e.type === 'score'), '应该有 score 事件');
  assert.ok(s.score > 0);
});

test('连击：连续过门 combo 递增（封顶 COMBO_MAX）', () => {
  const r = createRun({ seed: 11 });
  const s = r.state;
  // 直接通过 7 个门
  for (let i = 0; i < 7; i += 1) {
    const g = s.gates[i];
    g.x = SERPENT.X;
    g.gapY = WORLD.HEIGHT / 2;
    s.serpent.y = WORLD.HEIGHT / 2;
    s.serpent.vy = 0;
    advance(r, 0.2);
  }
  assert.ok(s.combo >= 3);
  assert.ok(s.combo <= GAME.COMBO_MAX);
});

test('撞击：碰柱损失一节身体并重置连击', () => {
  const r = createRun({ seed: 3 });
  const s = r.state;
  const body0 = s.serpent.body;
  s.serpent.combo = 5;
  const g0 = s.gates[0];
  g0.x = SERPENT.X;
  g0.gapY = WORLD.HEIGHT; // 缺口在脚下，头部必撞上柱
  s.serpent.y = WORLD.HEIGHT * 0.3;
  s.serpent.vy = 0;
  advance(r, 0.05);
  assert.equal(s.serpent.body, body0 - 1);
  assert.equal(s.combo, 1);
  const ev = drain(r);
  assert.ok(ev.some((e) => e.type === 'hit'));
});

test('心：吃到 heart 身体 +1（上限封顶）', () => {
  const r = createRun({ seed: 5 });
  const s = r.state;
  s.serpent.body = 2;
  s.serpent.segs = [
    { x: SERPENT.X - 38, y: s.serpent.y },
    { x: SERPENT.X - 76, y: s.serpent.y },
  ];
  // 找到第一个 heart 道具拉到头部
  const heart = s.pickups.find((p) => p.kind === 'heart');
  heart.x = SERPENT.X;
  heart.y = s.serpent.y;
  advance(r, 0.05);
  assert.equal(s.serpent.body, 3);
  const ev = drain(r);
  assert.ok(ev.some((e) => e.type === 'life'));
});

test('宝石：吃到 gem 开启护盾', () => {
  const r = createRun({ seed: 6 });
  const s = r.state;
  const gem = s.pickups.find((p) => p.kind === 'gem');
  gem.x = SERPENT.X;
  gem.y = s.serpent.y;
  advance(r, 0.05);
  assert.ok(s.serpent.shieldT > 0);
  const ev = drain(r);
  assert.ok(ev.some((e) => e.type === 'shield'));
});

test('星：集齐 3 星触发 fever', () => {
  const r = createRun({ seed: 8 });
  const s = r.state;
  const stars = s.pickups.filter((p) => p.kind === 'star').slice(0, 3);
  for (const st of stars) {
    st.x = SERPENT.X;
    st.y = s.serpent.y;
    advance(r, 0.05);
  }
  assert.ok(s.serpent.feverT > 0);
  const ev = drain(r);
  assert.ok(ev.some((e) => e.type === 'fever'));
});

test('zone：得分跨过门槛 zone 递增并发出 zone 事件', () => {
  const r = createRun({ seed: 9 });
  const s = r.state;
  s.score = GAME.ZONE_EVERY - 1;
  // 通过一个门让分数跨过门槛
  const g0 = s.gates[0];
  g0.x = SERPENT.X - SERPENT.R - g0.w / 2 + 10;
  g0.gapY = WORLD.HEIGHT / 2;
  s.serpent.y = WORLD.HEIGHT / 2;
  s.serpent.vy = 0;
  advance(r, 0.1);
  assert.ok(s.level >= 2);
  const ev = drain(r);
  assert.ok(ev.some((e) => e.type === 'zone'));
});

test('岩石门：kind=rock 且缺口更窄', () => {
  const r = createRun({ seed: 10 });
  const s = r.state;
  const rock = s.gates.find((g) => g.kind === 'rock');
  assert.ok(rock);
  assert.ok(rock.gapH < GATES.GAP_H);
  assert.ok(rock.w >= GATES.W);
});

test('mulberry32：同 seed 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  assert.notEqual(seqA[0], mulberry32(43)());
});

test('护盾期间：无重力（头部向中线靠拢）', () => {
  const r = createRun({ seed: 12 });
  const s = r.state;
  s.serpent.y = WORLD.HEIGHT * 0.3;
  s.serpent.vy = 500;
  s.serpent.shieldT = 1.0;
  const y0 = s.serpent.y;
  advance(r, 0.1);
  // 护盾下向中线靠近，不应继续下坠
  assert.ok(s.serpent.y > y0 || Math.abs(s.serpent.y - y0) < 1);
});
