import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { GAME, CAR_LV, STAGE_MIX } from '../config/game.config.js';

function mkEnemy(lv, x, y) {
  const c = CAR_LV[lv - 1];
  return {
    id: Math.random(), kind: 'enemy', lv,
    x, y, heading: 0, velAng: 0,
    speed: GAME.PLAYER_SPEED * c.speed,
    rotate: GAME.PLAYER_ROTATE * c.rotate,
    r: c.r, color: c.color, score: c.score,
    cooldown: 0, speedVarDt: 0, speedVar: 1,
    alive: true,
  };
}

function mkProp(propKind, x, y) {
  return { id: Math.random(), kind: 'prop', propKind, x, y, alive: true, age: 0, points: 100 };
}

test('初始状态：朝上、满血、阶段 1', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.hp, 3);
  assert.equal(run.state.stage, 1);
  assert.equal(run.state.mode, 'idle');
});

test('右转：车头 heading 增大', () => {
  const run = createRun({ seed: 1 });
  const before = run.player.heading;
  run.setSteer(1);
  run.step(1 / 60);
  assert.ok(run.player.heading > before);
});

test('漂移：转向后速度方向滞后于车头', () => {
  const run = createRun({ seed: 1 });
  run.setSteer(1);
  for (let i = 0; i < 20; i += 1) run.step(1 / 60);
  const d = Math.abs(((run.player.heading - run.player.velAng) % 360 + 540) % 360 - 180);
  assert.ok(d > 1, '转向时车头与速度方向应有夹角');
});

test('前进：自动向前移动', () => {
  const run = createRun({ seed: 1 });
  const x0 = run.player.x;
  const y0 = run.player.y;
  run.step(1 / 60);
  assert.ok(run.player.x !== x0 || run.player.y !== y0);
});

test('漂移充能：持续转向会让氮气上升', () => {
  const run = createRun({ seed: 1 });
  const b0 = run.state.boost;
  run.setSteer(1);
  for (let i = 0; i < 60; i += 1) run.step(1 / 60);
  assert.ok(run.state.boost > b0);
});

test('狂暴：氮气满后主动狂暴', () => {
  const run = createRun({ seed: 1 });
  run.state.boost = GAME.BOOST_MAX;
  run.pressBoost();
  run.step(1 / 60);
  assert.equal(run.state.mode, 'hit');
});

test('狂暴击杀：hit 模式撞敌车直接击杀', () => {
  const run = createRun({ seed: 1 });
  run.state.mode = 'hit';
  run.state.modeTime = 8;
  run.enemies.push(mkEnemy(1, run.player.x + 5, run.player.y));
  run.step(1 / 60);
  assert.equal(run.enemies.length, 0);
  assert.equal(run.state.kills, 1);
});

test('连击：连续击杀提升 combo', () => {
  const run = createRun({ seed: 1 });
  run.state.mode = 'hit';
  run.state.modeTime = 8;
  run.enemies.push(mkEnemy(1, run.player.x + 5, run.player.y));
  run.step(1 / 60);
  run.enemies.push(mkEnemy(2, run.player.x + 5, run.player.y));
  run.step(1 / 60);
  assert.ok(run.state.combo >= 2);
});

test('星星：拾取后加分并充能', () => {
  const run = createRun({ seed: 1 });
  const s0 = run.state.score;
  run.props.push(mkProp('star', run.player.x + 10, run.player.y));
  run.step(1 / 60);
  assert.equal(run.state.stars, 1);
  assert.ok(run.state.score > s0);
  assert.equal(run.state.boost, 1);
});

test('炸弹：拾取后清空敌车', () => {
  const run = createRun({ seed: 1 });
  run.enemies.push(mkEnemy(1, 400, 0));
  run.enemies.push(mkEnemy(2, -400, 0));
  run.props.push(mkProp('bomb', run.player.x + 10, run.player.y));
  run.step(1 / 60);
  assert.equal(run.enemies.length, 0);
});

test('护盾：拾取后获得无敌', () => {
  const run = createRun({ seed: 1 });
  run.props.push(mkProp('shield', run.player.x + 10, run.player.y));
  run.step(1 / 60);
  assert.ok(run.player.invuln > 0);
});

test('受伤：撞敌车扣血', () => {
  const run = createRun({ seed: 1 });
  run.player.invuln = 0;
  run.enemies.push(mkEnemy(1, run.player.x + 5, run.player.y));
  run.step(1 / 60);
  assert.equal(run.state.hp, 2);
});

test('死亡：血量归零进入 dead', () => {
  const run = createRun({ seed: 1 });
  run.state.hp = 1;
  run.player.invuln = 0;
  run.enemies.push(mkEnemy(1, run.player.x + 5, run.player.y));
  run.step(1 / 60);
  assert.equal(run.state.phase, 'dead');
});

test('阶段推进：超过阶段时长升到阶段 2', () => {
  const run = createRun({ seed: 1 });
  run.state.time = GAME.STAGE_SECONDS - 0.01;
  run.step(0.05);
  assert.equal(run.state.stage, 2);
});

test('同种子确定性：两个 run 刷怪一致', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  for (let i = 0; i < 90; i += 1) { a.step(1 / 60); b.step(1 / 60); }
  assert.equal(a.enemies.length, b.enemies.length);
});

test('事件：drainEvents 返回并清空', () => {
  const run = createRun({ seed: 1 });
  for (let i = 0; i < 70; i += 1) run.step(1 / 60);
  const evs = run.drainEvents();
  assert.ok(evs.length > 0);
  assert.equal(run.drainEvents().length, 0);
});

test('mulberry32 稳定', () => {
  const r1 = mulberry32(7);
  const r2 = mulberry32(7);
  assert.equal(r1(), r2());
});
