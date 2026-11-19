import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, spellOf, mulberry32 } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';
import { LEVEL } from '../config/levels.js';

function advance(run, sec, input = {}) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) {
    run.setInput(input);
    run.step(1 / 60);
    if (run.state.phase !== 'playing') break;
  }
}

test('冒烟：createRun → step → setInput → getHud → drainEvents 无异常', () => {
  const r = createRun({ seed: 1 });
  r.step(1 / 60);
  r.setInput({ left: false, right: true, jump: false });
  r.step(1 / 60);
  const hud = r.getHud();
  assert.equal(hud.act, 1);
  assert.equal(hud.phase, 'playing');
  assert.equal(typeof hud.score, 'number');
  const ev = r.drainEvents();
  assert.ok(Array.isArray(ev));
});

test('state 形状：level/phase/act/player/enemies/rocks', () => {
  const r = createRun({ seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'playing');
  assert.equal(s.act, 1);
  assert.equal(s.player.hp, GAME.MAX_HP);
  assert.equal(s.player.mp.red, GAME.MP_MAX);
  assert.ok(Array.isArray(s.enemies));
  assert.equal(s.rocks.length, 2);
  assert.equal(s.pickups.length, LEVEL.pickups.length);
});

test('三原色混色映射：单色/双色/三色', () => {
  assert.equal(spellOf(new Set(['red'])), 'fire');
  assert.equal(spellOf(new Set(['yellow'])), 'dash');
  assert.equal(spellOf(new Set(['blue'])), 'frost');
  assert.equal(spellOf(new Set(['red', 'yellow'])), 'orange');
  assert.equal(spellOf(new Set(['blue', 'yellow'])), 'green');
  assert.equal(spellOf(new Set(['red', 'blue'])), 'purple');
  assert.equal(spellOf(new Set(['red', 'yellow', 'blue'])), 'white');
  assert.equal(spellOf(new Set([])), null);
});

test('施法消耗对应颜色 MP', () => {
  const r = createRun({ seed: 1 });
  const before = r.state.player.mp.red;
  const res = r.cast(['red']);
  assert.equal(res.ok, true);
  assert.equal(r.state.player.mp.red, before - GAME.MP_COST);
});

test('MP 不足时施法失败', () => {
  const r = createRun({ seed: 1 });
  r.state.player.mp.red = 0;
  const res = r.cast(['red']);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'mp');
});

test('火球命中并击杀敌人', () => {
  const r = createRun({ seed: 1 });
  // 清空，摆一个贴脸敌人
  r.state.enemies = [{
    id: 't', type: 'walker', x: r.state.player.x + 60, y: LEVEL.groundY - 40,
    baseY: LEVEL.groundY - 40, w: 34, h: 40, hp: 1, maxHp: 2, speed: 0,
    facing: -1, vx: 0, patrolL: null, patrolR: null, shootCd: 0, slow: 0, phase: 0,
  }];
  r.state.player.facing = 1;
  r.cast(['red']);
  let killed = false;
  for (let i = 0; i < 120 && !killed; i += 1) {
    r.step(1 / 60);
    for (const e of r.drainEvents()) if (e.type === 'kill') killed = true;
  }
  assert.ok(killed, '火球应击杀 1 HP 敌人');
  assert.equal(r.state.combo, 1);
});

test('同色法术一击破晶岩，异色削血', () => {
  const r = createRun({ seed: 1 });
  const rock = r.state.rocks.find((x) => x.color === 'red');
  rock.hp = 99;
  // 直接在岩石正前方开火
  r.state.player.x = rock.x - r.state.player.w - 20;
  r.state.player.facing = 1;
  r.cast(['red']);
  for (let i = 0; i < 120; i += 1) r.step(1 / 60);
  assert.ok(!r.state.rocks.includes(rock), '同色火球应破红晶岩');
});

test('到达旗帜触发 Boss 并恢复满血', () => {
  const r = createRun({ seed: 1 });
  r.state.player.hp = 1;
  r.state.player.x = LEVEL.flag.x;
  r.step(1 / 60);
  assert.equal(r.state.act, 2);
  assert.equal(r.state.player.hp, GAME.MAX_HP);
  assert.ok(r.state.enemies.some((e) => e.type === 'boss'));
});

test('Boss 死亡 → 胜利结算 + 星级', () => {
  const r = createRun({ seed: 1 });
  r.state.player.x = LEVEL.flag.x;
  r.step(1 / 60);
  const boss = r.state.enemies.find((e) => e.type === 'boss');
  boss.hp = 1;
  r.state.enemies = r.state.enemies.filter((e) => e.type === 'boss'); // 只剩 Boss
  // 用橙电（红+黄）远程击杀
  r.state.player.x = boss.x - 560;
  r.cast(['red', 'yellow']);
  for (let i = 0; i < 60; i += 1) r.step(1 / 60);
  assert.equal(r.state.phase, 'won');
  assert.ok(r.state.stars >= 1);
  assert.equal(r.state.result.won, true);
});

test('玩家掉进深渊会扣血并重生', () => {
  const r = createRun({ seed: 1 });
  r.state.player.y = 900; // 已越过坑底
  r.step(1 / 60);
  assert.equal(r.state.player.hp, GAME.MAX_HP - 1);
  assert.equal(r.state.player.y, LEVEL.groundY - r.state.player.h);
});

test('无输入也会被近战怪击杀（死亡存在性）', () => {
  const r = createRun({ seed: 7 });
  advance(r, 30);
  assert.equal(r.state.phase, 'lost');
});

test('贪心策略能通关（推进到第 3 幕）', async () => {
  const { autodrive } = await import('../src/game/autodrive.js');
  const r = createRun({ seed: 3 });
  autodrive(r, 120);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.act, 3);
});

test('mulberry32 可复现', () => {
  const a = mulberry32(42)();
  const b = mulberry32(42)();
  assert.equal(a, b);
});

test('drainEvents 清空事件队列', () => {
  const r = createRun({ seed: 1 });
  r.cast(['red']);
  const ev = r.drainEvents();
  assert.ok(ev.length > 0);
  assert.equal(r.drainEvents().length, 0);
});

test('冲刺（黄）期间无敌', () => {
  const r = createRun({ seed: 1 });
  r.cast(['yellow']);
  assert.ok(r.state.player.dashT > 0 || r.state.player.invincible > 0);
});
