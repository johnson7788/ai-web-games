import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { PLAYER, PHYSICS, GAME } from '../config/game.config.js';

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step({});
}

function landOn(run, pl) {
  const p = run.state.player;
  p.x = pl.x + pl.w / 2 - PLAYER.W / 2;
  p.y = pl.y - PLAYER.H;
  p.vy = 0;
  p.onGround = false;
  run.step({});
}

test('冒烟：createRun → step → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step({});
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'running');
  const ev = r.drainEvents();
  assert.ok(Array.isArray(ev));
  assert.ok(ev.some((e) => e.type === 'runStart'));
});

test('state 形状：level/scene/phase/player/platforms/finishX 合法', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.scene, 'dusk-tower');
  assert.equal(s.phase, 'running');
  assert.ok(s.player.x > 0 && s.player.y > 0);
  assert.ok(s.player.vx > 0);
  assert.ok(Array.isArray(s.platforms) && s.platforms.length > 0);
  assert.ok(s.finishX > s.player.x);
});

test('跳跃：输入 jump 后 vy<0 且离开地面', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.state.player;
  assert.equal(p.onGround, true);
  r.step({ jump: true });
  assert.equal(p.onGround, false);
  assert.ok(p.vy < 0);
});

test('落地：起跳后多次推进会回到地面', () => {
  const r = createRun(0, { seed: 1 });
  r.step({ jump: true });
  advance(r, 1.5);
  assert.equal(r.state.player.onGround, true);
});

test('土狼时间：离开边缘后短窗口内仍可起跳', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.state.player;
  // 直接在空中设 coyote，模拟刚离开边缘
  p.onGround = false;
  p.coyote = GAME.COYOTE_SEC;
  r.step({ jump: true });
  assert.ok(p.vy < 0);
});

test('符文砖：踩踏后立即虚化（solid → phantom）', () => {
  const r = createRun(1, { seed: 1 }); // L2 有符文砖
  const rune = r.state.platforms.find((pl) => pl.kind === 'rune');
  assert.ok(rune);
  assert.equal(rune.state, 'solid');
  landOn(r, rune);
  assert.equal(rune.state, 'phantom');
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'runeToggle'));
});

test('符文砖：虚化后 revertSec 内恢复实体', () => {
  const r = createRun(1, { seed: 1 });
  const rune = r.state.platforms.find((pl) => pl.kind === 'rune');
  landOn(r, rune);
  assert.equal(rune.state, 'phantom');
  // 移到安全起点再等计时，避免途中掉坑把 phase 冻结
  const p = r.state.player;
  p.x = 60; p.y = 554; p.vy = 0; p.onGround = true;
  advance(r, rune.revertSec + 0.1);
  assert.equal(rune.state, 'solid');
});

test('双符文互锁：一虚一实，踩 A 使 A 虚化、B 实体', () => {
  const r = createRun(2, { seed: 1 }); // L3 双符文
  const a = r.state.platforms.find((pl) => pl.name === 'a');
  const b = r.state.platforms.find((pl) => pl.name === 'b');
  assert.ok(a && b);
  assert.equal(a.state, 'solid');
  assert.equal(b.state, 'phantom');
  landOn(r, a);
  assert.equal(a.state, 'phantom');
  assert.equal(b.state, 'solid');
});

test('塌陷檐：踩踏 0.8s 后落空（state → phantom）', () => {
  const r = createRun(7, { seed: 1 }); // L8 塌陷檐
  const col = r.state.platforms.find((pl) => pl.kind === 'collapse');
  assert.ok(col);
  landOn(r, col);
  assert.equal(col.state, 'solid');
  const p = r.state.player;
  p.x = 60; p.y = 554; p.vy = 0; p.onGround = true;
  advance(r, GAME.COLLAPSE_SEC + 0.1);
  assert.equal(col.state, 'phantom');
});

test('移动吊篮：竖直位置随正弦摆动', () => {
  const r = createRun(6, { seed: 1 }); // L7 吊篮
  const mov = r.state.platforms.find((pl) => pl.kind === 'moving');
  assert.ok(mov);
  const y0 = mov.y;
  advance(r, 0.4);
  assert.notEqual(mov.y, y0);
});

test('月光斑：拾取后 form=corporeal 且计时结束回到 phantom', () => {
  const r = createRun(3, { seed: 1 }); // L4 有月光斑
  const p = r.state.player;
  const m = r.state.moons[0];
  p.x = m.x - PLAYER.W / 2;
  p.y = m.y - PLAYER.H / 2;
  r.step({});
  assert.equal(p.form, 'corporeal');
  // 移到安全起点再等计时结束，避免撞墙/掉坑把 phase 冻结
  p.x = 60; p.y = 554; p.vy = 0; p.onGround = true;
  advance(r, GAME.CORPOREAL_SEC + 0.2);
  assert.equal(p.form, 'phantom');
});

test('符文墙：虚影撞墙判负，现身可穿', () => {
  const r = createRun(3, { seed: 1 }); // L4
  const p = r.state.player;
  const w = r.state.walls[0];
  // 虚影撞墙
  p.form = 'phantom';
  p.x = w.x - PLAYER.W + 2;
  p.y = 554;
  r.step({});
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'wallHit');
  // 现身可穿
  const r2 = createRun(3, { seed: 1 });
  r2.state.player.form = 'corporeal';
  r2.state.player.corporealT = 1;
  r2.state.player.x = w.x - PLAYER.W + 2;
  r2.state.player.y = 554;
  r2.step({});
  assert.equal(r2.state.phase, 'running');
});

test('尖刺：撞上判负', () => {
  const r = createRun(1, { seed: 1 }); // L2 有尖刺
  const p = r.state.player;
  const sp = r.state.spikes[0];
  p.x = sp.x;
  p.y = 554;
  r.step({});
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'spike');
});

test('掉坑：越过底线判负', () => {
  const r = createRun(0, { seed: 1 });
  r.state.player.y = 900;
  r.step({});
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'pit');
});

test('星屑：拾取后 starsGot 递增并发事件', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.state.player;
  const st = r.state.stars[0];
  p.x = st.x - PLAYER.W / 2;
  p.y = st.y - PLAYER.H / 2;
  r.step({});
  assert.equal(r.state.starsGot, 1);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'starPickup'));
});

test('通关：到达 finishX 后 win 且结算星级', () => {
  const r = createRun(0, { seed: 1 });
  r.state.player.x = r.state.finishX - 1;
  r.step({});
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
  assert.ok(r.state.result.stars >= 1);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'win'));
});

test('mulberry32：同 seed 序列确定', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  const xa = [a(), a(), a()];
  const xb = [b(), b(), b()];
  assert.deepEqual(xa, xb);
});
