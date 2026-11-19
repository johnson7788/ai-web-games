import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { BALANCE, levelDef } from '../config/game.config.js';

function drainAll(run) {
  const out = [];
  let batch = run.drainEvents();
  while (batch.length) { out.push(...batch); batch = run.drainEvents(); }
  return out;
}

test('创建 run 初始在标题屏', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.state.phase, 'title');
});

test('start(0) 进入游戏并生成敌人', () => {
  const r = createRun({ seed: 1 });
  r.start(0);
  assert.equal(r.state.phase, 'playing');
  assert.ok(r.state.monsters.length > 0, '有敌人');
});

test('第一关生成 3 个近战碎片 + 岩石', () => {
  const def = levelDef(0);
  const r = createRun({ seed: 1 });
  r.start(0);
  assert.equal(r.state.monsters.length, def.shards);
  assert.equal(r.state.rocks.length, def.rocks);
});

test('mulberry32 确定性：同 seed 同序列', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('setMove(1,0) 后玩家标记为移动中', () => {
  const r = createRun({ seed: 1 });
  r.start(0);
  r.setMove(1, 0);
  assert.equal(r.state.player.moving, true);
});

test('停下后 aimLock 解锁自动射击', () => {
  const r = createRun({ seed: 1 });
  r.start(0);
  r.setMove(1, 0);
  r.setMove(0, 0);
  assert.equal(r.state.player.moving, false);
  assert.equal(r.state.player.aimLock, true);
});

test('站定后自动射箭（shoot 事件 + 箭出现）', () => {
  const r = createRun({ seed: 7 });
  r.start(0);
  r.setMove(0, 1);
  r.setMove(0, 0);
  const evs = [];
  let sawArrow = false;
  for (let i = 0; i < 90; i += 1) {
    r.step(1 / 60);
    evs.push(...r.drainEvents());
    if (r.state.arrows.length > 0) sawArrow = true;
  }
  assert.ok(evs.some((e) => e.type === 'shoot'), '有 shoot 事件');
  assert.ok(sawArrow, '箭已生成过');
});

test('noinput 玩家永远不射击，最终死亡', () => {
  const r = createRun({ seed: 3 });
  r.start(0);
  let guard = 0;
  while (r.state.phase === 'playing' && guard < 600) { r.step(1 / 60); guard += 1; }
  assert.equal(r.state.phase, 'result');
  assert.equal(r.state.player.alive, false);
  assert.ok(r.state.player.hp <= 0);
});

test('箭命中敌人会扣血', () => {
  const r = createRun({ seed: 7 });
  r.start(0);
  const hp0 = r.state.monsters.reduce((s, m) => s + m.hp, 0);
  r.setMove(0, 1);
  r.setMove(0, 0);
  for (let i = 0; i < 120; i += 1) { r.step(1 / 60); drainAll(r); }
  const hp1 = r.state.monsters.reduce((s, m) => s + m.hp, 0);
  assert.ok(hp1 < hp0, '敌人总血量已下降');
});

test('击杀敌人增加连击与得分', () => {
  const r = createRun({ seed: 7 });
  r.start(0);
  r.setMove(0, 1);
  r.setMove(0, 0);
  let kills = 0;
  for (let i = 0; i < 60 * 20; i += 1) {
    r.step(1 / 60);
    for (const e of r.drainEvents()) if (e.type === 'kill') kills += 1;
    if (kills > 0) break;
  }
  assert.ok(kills > 0, '有击杀');
  assert.ok(r.state.combo >= 1, '连击 ≥1');
  assert.ok(r.state.score > 0, '得分 >0');
});

test('清空敌人触发关间升级（3 个候选）', () => {
  const r = createRun({ seed: 7 });
  r.start(0);
  r.forceKillAll();
  assert.equal(r.state.sub, 'upgrade');
  assert.equal(r.state.pendingUpgrade.length, 3);
});

test('chooseUpgrade 生效并进入下一关', () => {
  const r = createRun({ seed: 7 });
  r.start(0);
  r.forceKillAll();
  const id = r.state.pendingUpgrade[0];
  const lvl = r.state.level;
  const ok = r.chooseUpgrade(id);
  assert.equal(ok.ok, true);
  assert.equal(r.state.level, lvl + 1);
  assert.equal(r.state.phase, 'playing');
});

test('最后通关触发胜利', () => {
  const r = createRun({ seed: 7 });
  r.start(BALANCE.levelCount - 1);
  r.forceKillAll();
  assert.equal(r.state.phase, 'result');
  assert.equal(r.state.won, true);
});

test('岩石阻挡移动', () => {
  const r = createRun({ seed: 1 });
  r.start(0);
  const rock = r.state.rocks[0];
  // 把玩家放到岩石边上，朝岩石方向移动
  r.state.player.x = rock.x - rock.r - WORLD_PLAYER_R();
  r.state.player.y = rock.y;
  const x0 = r.state.player.x;
  r.setMove(1, 0);
  for (let i = 0; i < 10; i += 1) r.step(1 / 60);
  assert.ok(r.state.player.x <= rock.x - rock.r + 0.01, '被岩石挡住');
  assert.ok(r.state.player.x >= x0 - 0.01, '未穿模');
});

function WORLD_PLAYER_R() { return 0.55; }

test('岩石挡箭（箭撞岩石消失）', () => {
  const r = createRun({ seed: 1 });
  r.start(0);
  r.state.arrows.push({ x: 0, y: 0, vx: 30, vy: 0, life: 0.9, pierced: false });
  r.state.rocks = [{ x: 3, y: 0, r: 0.9 }];
  for (let i = 0; i < 30; i += 1) r.step(1 / 60);
  assert.equal(r.state.arrows.length, 0, '箭被岩石挡掉');
});
