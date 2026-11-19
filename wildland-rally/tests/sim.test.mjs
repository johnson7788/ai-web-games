import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { MATCH, WORLD, ENEMY } from '../config/game.config.js';

function enemyAt(run, x, y, t = 1) {
  const cfg = ENEMY[t];
  const e = { id: 9000 + Math.random() * 1000, type: t, x, y, hp: cfg.hp, maxHp: cfg.hp, speed: cfg.speed, dmg: cfg.dmg, fireCd: 0, radius: cfg.radius, shield: false, champ: false, score: cfg.score, color: cfg.color, hurt: 0 };
  run.state.enemies.push(e);
  return e;
}

function step(run, n = 1) {
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

test('createRun 初始为 playing', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.wave, 0);
  assert.equal(run.state.player.hp, 300);
});

test('step 推进时间', () => {
  const run = createRun({ seed: 1 });
  step(run, 30);
  assert.ok(run.state.time > 0.4);
  assert.ok(run.state.time < 0.6);
});

test('首波会生成敌人并发出 wave 事件', () => {
  const run = createRun({ seed: 2 });
  const evs = [];
  for (let i = 0; i < 120 && run.state.enemies.length === 0; i += 1) {
    run.step(1 / 60);
    evs.push(...run.drainEvents());
  }
  assert.equal(run.state.wave, 1);
  assert.equal(run.state.enemies.length, 3);
  assert.ok(evs.some((e) => e.type === 'wave'));
  assert.ok(evs.some((e) => e.type === 'spawn'));
});

test('move 改变玩家位置', () => {
  const run = createRun({ seed: 3 });
  const x0 = run.state.player.x;
  run.move(1, 0);
  step(run, 10);
  assert.ok(run.state.player.x > x0);
});

test('dash 使玩家瞬移并进入冷却', () => {
  const run = createRun({ seed: 4 });
  const x0 = run.state.player.x;
  const ok = run.dash();
  step(run, 1);
  assert.equal(ok.ok, true);
  assert.ok(Math.abs(run.state.player.x - x0) > 100);
  assert.ok(run.state.player.dashCd > 0);
});

test('nova 对范围内敌人造成伤害', () => {
  const run = createRun({ seed: 5 });
  const p = run.state.player;
  const e = enemyAt(run, p.x + 60, p.y, 1);
  run.nova();
  step(run, 1);
  assert.ok(run.state.player.novaCd > 0);
  assert.ok(e.hp < e.maxHp);
});

test('自动炮击：范围内敌人触发 shot 事件', () => {
  const run = createRun({ seed: 6 });
  const p = run.state.player;
  enemyAt(run, p.x + 120, p.y, 1);
  run.step(1 / 60);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'shot'));
});

test('noinput：玩家最终死亡进入 lost', () => {
  const run = createRun({ seed: 7 });
  for (let i = 0; i < 60 * 60 && run.state.phase === 'playing'; i += 1) {
    run.step(1 / 60);
  }
  assert.equal(run.state.phase, 'lost');
});

test('清完全部波次后胜利', () => {
  const run = createRun({ seed: 8 });
  run.state.wave = MATCH.waves;
  run.state.wavePending = false;
  run.state.enemies = [];
  run.step(1 / 60);
  assert.equal(run.state.phase, 'won');
});

test('确定性：同 seed 生成相同敌人位置', () => {
  const a = createRun({ seed: 99 });
  const b = createRun({ seed: 99 });
  for (let i = 0; i < 120; i += 1) { a.step(1 / 60); b.step(1 / 60); }
  assert.equal(a.state.enemies.length, b.state.enemies.length);
  for (let i = 0; i < a.state.enemies.length; i += 1) {
    assert.equal(a.state.enemies[i].x, b.state.enemies[i].x);
    assert.equal(a.state.enemies[i].y, b.state.enemies[i].y);
  }
});

test('mulberry32 确定性', () => {
  const r1 = mulberry32(42);
  const r2 = mulberry32(42);
  assert.equal(r1(), r2());
  assert.equal(r1(), r2());
});

test('击杀会累加得分与连击', () => {
  const run = createRun({ seed: 10 });
  const p = run.state.player;
  const e = enemyAt(run, p.x + 30, p.y, 1);
  e.hp = 1;
  const evs = [];
  for (let i = 0; i < 30; i += 1) { run.step(1 / 60); evs.push(...run.drainEvents()); }
  assert.ok(evs.some((ev) => ev.type === 'kill'));
  assert.ok(run.state.score >= 100);
  assert.equal(run.state.combo, 1);
});

test('getHud 返回目标数', () => {
  const run = createRun({ seed: 11 });
  const p = run.state.player;
  enemyAt(run, p.x + 200, p.y, 1);
  const hud = run.getHud();
  assert.equal(hud.targets, 1);
  assert.equal(hud.maxHp, 300);
});
