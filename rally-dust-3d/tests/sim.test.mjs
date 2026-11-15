import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, updateSim, drainEvents, getHud, ratingFor } from '../src/game/sim.js';
import { createStage } from '../src/game/track.js';
import { STAGES, CAR, DAMAGE, SCORE } from '../config/game.config.js';

const IN = { throttle: false, brake: false, steer: 0, handbrake: false, shiftDown: false };

test('赛道：createStage 产生有效长度与采样', () => {
  const t = createStage(STAGES[0]);
  assert.ok(t.length > 500, '赛道长度应 >500m');
  assert.ok(t.count >= 48, '采样点足够');
  assert.equal(t.samples[0].s, 0);
});

test('赛道：toWorld(s,0) 落在中心线上', () => {
  const t = createStage(STAGES[0]);
  const mid = t.at(t.length / 2);
  const w = t.toWorld(t.length / 2, 0);
  assert.ok(Math.abs(w.x - mid.x) < 1e-6 && Math.abs(w.z - mid.z) < 1e-6);
});

test('赛道：曲率数值有限', () => {
  const t = createStage(STAGES[1]);
  for (let s = 0; s < t.length; s += 50) {
    assert.ok(Number.isFinite(t.curvatureAt(s)));
  }
});

test('赛道：泥地抓地低于柏油（漂移窗口更大）', () => {
  const mud = createStage(STAGES[1]);   // 中段泥地
  const tarmac = createStage(STAGES[3]); // 全柏油
  assert.ok(mud.gripAt(mud.length * 0.5) < tarmac.gripAt(tarmac.length * 0.5));
});

test('赛道：路书按 s 排序且非空', () => {
  const t = createStage(STAGES[1]);
  assert.ok(t.notes.length > 0, '泥地发夹弯赛段应有路书');
  for (let i = 1; i < t.notes.length; i++) assert.ok(t.notes[i].s >= t.notes[i - 1].s);
});

test('赛道：障碍数量与 spec 一致', () => {
  const t = createStage(STAGES[2]);
  assert.equal(t.obstacles.length, STAGES[2].trees + STAGES[2].rocks);
});

test('物理：油门加速', () => {
  const s = createSim();
  const v0 = s.player.speed;
  for (let i = 0; i < 30; i++) updateSim(s, { ...IN, throttle: true });
  assert.ok(s.player.speed > v0 + 3, '油门应明显加速');
});

test('物理：刹车减速', () => {
  const s = createSim();
  s.player.speed = 30;
  for (let i = 0; i < 20; i++) updateSim(s, { ...IN, brake: true });
  assert.ok(s.player.speed < 25, '刹车应减速');
});

test('物理：转向改变侧滑角', () => {
  const s = createSim();
  s.player.speed = 25;
  for (let i = 0; i < 30; i++) updateSim(s, { ...IN, throttle: true, steer: 1 });
  assert.ok(Math.abs(s.player.angle) > 0.02, '转向应产生侧滑角');
});

test('物理：手刹+转向进入漂移', () => {
  const s = createSim();
  s.player.speed = 30;
  let drifting = false;
  for (let i = 0; i < 90; i++) {
    updateSim(s, { ...IN, throttle: true, steer: 1, handbrake: true });
    if (s.player.drifting) drifting = true;
  }
  assert.ok(drifting, '手刹应触发漂移');
});

test('车损：撞树掉血掉速并发射 hit 事件', () => {
  const s = createSim({ stage: 3 });
  const tree = s.track.obstacles.find((o) => o.kind === 'tree');
  assert.ok(tree, '赛段 3 应有树');
  s.player.s = tree.s; s.player.t = tree.t; s.player.speed = 30;
  const dmg0 = s.damage;
  updateSim(s, { ...IN, throttle: true });
  assert.ok(s.damage > dmg0, '撞树应增加车损');
  assert.ok(s.player.speed < 30, '撞树应掉速');
  assert.ok(drainEvents(s).some((e) => e.type === 'hit'));
});

test('车损：达到 100 退赛', () => {
  const s = createSim({ stage: 3 });
  s.damage = 99;
  const tree = s.track.obstacles.find((o) => o.kind === 'tree');
  s.player.s = tree.s; s.player.t = tree.t; s.player.speed = 30;
  updateSim(s, { ...IN });
  assert.equal(s.phase, 'busted');
  assert.ok(drainEvents(s).some((e) => e.type === 'busted'));
});

test('出界：t 被夹紧到软边界且减速', () => {
  const s = createSim();
  s.player.speed = 30; s.player.t = s.track.halfWidth + 20;
  updateSim(s, { ...IN });
  assert.ok(Math.abs(s.player.t) <= s.track.halfWidth + 8 + 1e-6);
  assert.ok(s.player.speed < 30);
});

test('赛段：冲线后进入下一赛段', () => {
  const s = createSim({ seed: 1 });
  s.player.s = s.track.length - 5; s.player.speed = 40;
  const st0 = s.stage;
  for (let i = 0; i < 60; i++) updateSim(s, { ...IN, throttle: true });
  assert.equal(s.stage, st0 + 1, '应推进到下一赛段');
  assert.ok(drainEvents(s).some((e) => e.type === 'stageClear'));
});

test('完赛：第 5 赛段冲线进入 finished', () => {
  const s = createSim({ stage: 5, seed: 9 });
  s.player.s = s.track.length - 5; s.player.speed = 40;
  for (let i = 0; i < 60; i++) updateSim(s, { ...IN, throttle: true });
  assert.equal(s.phase, 'finished');
  assert.ok(drainEvents(s).some((e) => e.type === 'finished' && e.rating));
});

test('路书：接近弯道发射 paceNote', () => {
  const s = createSim({ stage: 2 });
  const note = s.track.notes[0];
  s.player.s = Math.max(0, note.s - 50); s.player.speed = 20;
  updateSim(s, { ...IN, throttle: true });
  assert.ok(drainEvents(s).some((e) => e.type === 'paceNote'));
});

test('计分：漂移累积分数', () => {
  const s = createSim();
  s.player.speed = 30;
  for (let i = 0; i < 60; i++) updateSim(s, { ...IN, throttle: true, steer: 1, handbrake: true });
  assert.ok(s.score > 0, '漂移应得分');
});

test('评级：阈值判定正确', () => {
  assert.equal(ratingFor(10000, false), 'S');
  assert.equal(ratingFor(7000, false), 'A');
  assert.equal(ratingFor(4000, false), 'B');
  assert.equal(ratingFor(100, false), 'C');
  assert.equal(ratingFor(10000, true), 'B', '退赛评级封顶 B');
});

test('seed 回归：同 seed 赛道一致', () => {
  const a = createSim({ seed: 42 });
  const b = createSim({ seed: 42 });
  assert.equal(a.track.length, b.track.length);
  assert.equal(a.track.samples[10].x, b.track.samples[10].x);
});

test('档位：速度映射到档位 1-4', () => {
  const s = createSim();
  s.player.speed = 0; assert.equal(getHud(s).gear, 1);
  s.player.speed = CAR.gearSpeeds[2] + 1; assert.equal(getHud(s).gear, 3);
  s.player.speed = CAR.maxSpeed; assert.equal(getHud(s).gear, 4);
});

test('车损：颠簸近路高速压过持续伤车', () => {
  const s = createSim({ stage: 4 });
  const bump = STAGES[3].bumpy[0];
  s.player.s = (bump.from + 0.02) * s.track.length;
  s.player.speed = 40;
  const d0 = s.damage;
  for (let i = 0; i < 30; i++) updateSim(s, { ...IN, throttle: true });
  assert.ok(s.damage > d0, '颠簸路段应伤悬挂');
});

test('车损：衰减最高速度', () => {
  const s = createSim();
  const v0 = s.player.speed;
  s.damage = 60;
  s.player.speed = 0;
  let top = 0;
  for (let i = 0; i < 600; i++) { updateSim(s, { ...IN, throttle: true }); top = Math.max(top, s.player.speed); }
  assert.ok(top < CAR.maxSpeed, '满伤时最高速度应被衰减');
  assert.ok(v0 === 0);
});
