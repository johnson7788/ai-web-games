import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel } from '../src/game/level.js';
import { Match } from '../src/game/match.js';

function makeLevel(entities = [], coins = []) {
  const w = 24;
  const rows = ['.'.repeat(w), '.'.repeat(w), '.'.repeat(w), '#'.repeat(w)];
  const put = (x, ch) => { rows[2] = rows[2].slice(0, x) + ch + rows[2].slice(x + 1); };
  put(1, 'P');
  put(w - 2, 'F');
  for (const e of entities) put(e.x, e.type);
  for (const x of coins) put(x, 'o');
  return parseLevel({ id: 'm', name: {}, theme: 'wood', timeLimit: 60, entities: [], terrain: rows });
}

const flat = () => makeLevel();
const GROUND = 1.475;

test('踩甲虫：敌人消失、玩家反弹', () => {
  const lv = makeLevel([{ type: 'E', x: 8 }]);
  const m = new Match(lv);
  m.enemies[0].speed = 0;
  m.player.body.x = 8.5;
  m.player.body.y = 4;
  m.player.body.vy = -1;
  let maxY = 0;
  for (let i = 0; i < 60; i++) {
    m.update({}, 1 / 60);
    maxY = Math.max(maxY, m.player.body.y);
  }
  assert.equal(m.enemies[0].alive, false);
  assert.ok(maxY > 2.0, `玩家应被踩踏反弹到 2 格以上，maxY=${maxY}`);
});

test('侧面撞甲虫：小身直接死亡并回到出生点', () => {
  const lv = makeLevel([{ type: 'E', x: 6 }]);
  const m = new Match(lv);
  m.enemies[0].speed = 0;
  m.player.body.x = 4.6;
  m.player.body.y = GROUND;
  for (let i = 0; i < 60 && m.deaths === 0; i++) m.update({ right: true }, 1 / 60);
  assert.equal(m.deaths, 1);
  assert.ok(Math.abs(m.player.body.x - 1.5) < 0.2, `复活位置 x=${m.player.body.x}`);
});

test('壳怪：踩一下缩壳，再撞一下踢出去', () => {
  const lv = makeLevel([{ type: 'K', x: 8 }]);
  const m = new Match(lv);
  const enemy = m.enemies[0];
  enemy.speed = 0;
  m.player.body.x = 8.5;
  m.player.body.y = 4;
  m.player.body.vy = -1;
  for (let i = 0; i < 60 && enemy.state !== 'shell'; i++) m.update({}, 1 / 60);
  assert.equal(enemy.alive, true);
  assert.equal(enemy.state, 'shell');

  // 落地后从左侧撞壳
  m.player.body.x = 7.0;
  m.player.body.y = GROUND;
  m.player.body.vx = 0;
  m.player.body.vy = 0;
  for (let i = 0; i < 40; i++) m.update({ right: true }, 1 / 60);
  assert.equal(enemy.state, 'kicked', `state=${enemy.state}`);
  assert.ok(Math.abs(enemy.body.vx) > 1, `vx=${enemy.body.vx}`);
});

test('齿轮收集计数', () => {
  const lv = makeLevel([], [10]);
  const m = new Match(lv);
  m.player.body.x = 9.5;
  m.player.body.y = 1.5;
  for (let i = 0; i < 30; i++) m.update({ right: true }, 1 / 60);
  assert.equal(m.gears, 1);
  assert.equal(lv.pickups[0].taken, true);
});

test('掉坑死亡后从检查点复活', () => {
  const lv = makeLevel();
  const m = new Match(lv);
  lv.checkpoints.push({ x: 12.5, y: 1.5, on: false });
  m.player.body.x = 12.5;
  for (let i = 0; i < 5; i++) m.update({}, 1 / 60);
  assert.equal(lv.checkpoints[0].on, true);

  m.player.body.y = -6;
  m.update({}, 1 / 60);
  assert.equal(m.deaths, 1);
  assert.ok(Math.abs(m.player.body.x - 12.5) < 0.2, `x=${m.player.body.x}`);
});

test('到达旗杆触发过关事件', () => {
  const lv = flat();
  const m = new Match(lv);
  let cleared = null;
  m.on('clear', (d) => { cleared = d; });
  m.player.body.x = lv.goal.x - 0.2;
  m.update({}, 1 / 60);
  assert.equal(m.ended, true);
  assert.ok(cleared && cleared.total >= 0);
});

test('事件总线：跳跃与落地各触发一次', () => {
  const lv = flat();
  const m = new Match(lv);
  const seen = [];
  m.on('jump', () => seen.push('jump'));
  m.on('land', () => seen.push('land'));
  m.player.body.y = GROUND;
  for (let i = 0; i < 6; i++) m.update({}, 1 / 60);
  m.update({ jumpPressed: true, jumpHeld: true }, lv, 1 / 60);
  for (let i = 0; i < 90; i++) m.update({ jumpHeld: true }, 1 / 60);
  assert.equal(seen.filter((s) => s === 'jump').length, 1);
  assert.ok(seen.includes('land'));
});
