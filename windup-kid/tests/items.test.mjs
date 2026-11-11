import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel, T } from '../src/game/level.js';
import { Match } from '../src/game/match.js';
import { Mushroom, Flower } from '../src/game/items.js';

const W = 20;
function makeLevel(patch = {}) {
  const rows = [];
  for (let i = 0; i < 5; i++) rows.push('.'.repeat(W));
  let r3 = '.P' + '.'.repeat(W - 2);
  r3 = r3.slice(0, W - 2) + 'F' + r3.slice(W - 1);
  rows[3] = r3;
  rows[4] = '#'.repeat(W);
  for (const [key, ch] of Object.entries(patch)) {
    const [x, ty] = key.split(',').map(Number);
    const r = 4 - ty;
    rows[r] = rows[r].slice(0, x) + ch + rows[r].slice(x + 1);
  }
  return parseLevel({ id: 'i', name: {}, theme: 'wood', timeLimit: 60, entities: [], terrain: rows });
}

function jumpUnder(m, x, frames = 50) {
  m.player.body.x = x;
  for (let i = 0; i < 30; i++) m.update({}, 1 / 60);
  for (let i = 0; i < frames; i++) m.update({ jumpPressed: i === 3, jumpHeld: true }, 1 / 60);
}

test('顶问号砖：变硬砖并掉出发条', () => {
  const lv = makeLevel({ '4,2': '?' });
  const m = new Match(lv);
  let bumped = false;
  m.on('bump', (d) => { if (d.question) bumped = true; });

  jumpUnder(m, 4.5);
  assert.equal(bumped, true);
  assert.equal(lv.tileAt(4, 2), T.HARD);
  assert.equal(m.items.length, 1);
  assert.equal(m.items[0].kind, 'mushroom');
});

test('吃到发条变大：碰撞盒从 0.95 变成 1.9，脚底不动', () => {
  const lv = makeLevel();
  const m = new Match(lv);
  for (let i = 0; i < 10; i++) m.update({}, 1 / 60);
  const feet = m.player.body.y - m.player.body.hh;
  m.items.push(new Mushroom(m.player.body.x, m.player.body.y));
  m.update({}, 1 / 60);
  assert.equal(m.player.state, 'big');
  assert.ok(Math.abs(m.player.body.hh - 0.95) < 1e-6);
  assert.ok(Math.abs((m.player.body.y - m.player.body.hh) - feet) < 1e-6);
});

test('大身能顶碎木箱，小身不能', () => {
  const big = makeLevel({ '4,4': 'B' });
  const mb = new Match(big);
  mb.player.grow();
  let broke = 0;
  mb.on('break', () => { broke++; });
  jumpUnder(mb, 4.5, 60);
  assert.equal(broke, 1);
  assert.equal(big.tileAt(4, 4), T.EMPTY);

  const small = makeLevel({ '4,4': 'B' });
  const ms = new Match(small);
  let brokeSmall = 0;
  ms.on('break', () => { brokeSmall++; });
  jumpUnder(ms, 4.5, 60);
  assert.equal(brokeSmall, 0);
  assert.equal(small.tileAt(4, 4), T.BRICK);
});

test('弹簧把玩家弹起来', () => {
  const lv = makeLevel({ '8,1': 'S' });
  const m = new Match(lv);
  let springs = 0;
  m.on('spring', () => { springs++; });
  m.player.body.x = 8.5;
  m.player.body.y = 2.5;
  let maxY = 0;
  for (let i = 0; i < 90; i++) {
    m.update({}, 1 / 60);
    maxY = Math.max(maxY, m.player.body.y);
  }
  assert.ok(springs >= 1);
  assert.ok(maxY > 4.0, `maxY=${maxY}`);
});

test('受伤从大变小，不会直接死', () => {
  const lv = makeLevel();
  const m = new Match(lv);
  m.player.grow();
  m.player.invuln = 0;
  m.update({}, 1 / 60);
  m.hurt();
  assert.equal(m.player.state, 'small');
  assert.equal(m.deaths, 0);
  m.player.invuln = 0;
  m.hurt();
  assert.equal(m.deaths, 1);
});

test('大身顶问号砖掉火油灯，小身掉发条', () => {
  const bigLv = makeLevel({ '4,3': '?' });
  const mb = new Match(bigLv);
  mb.player.grow();
  jumpUnder(mb, 4.5, 70);
  assert.equal(mb.items.length, 1);
  assert.equal(mb.items[0].kind, 'flower');

  const smallLv = makeLevel({ '4,2': '?' });
  const ms = new Match(smallLv);
  jumpUnder(ms, 4.5, 50);
  assert.equal(ms.items[0].kind, 'mushroom');
});

test('吃到火油灯进入火焰形态', () => {
  const lv = makeLevel();
  const m = new Match(lv);
  m.items.push(new Flower(m.player.body.x, m.player.body.y));
  m.update({}, 1 / 60);
  assert.equal(m.player.state, 'fire');
  assert.ok(Math.abs(m.player.body.hh - 0.95) < 1e-6, '小身吃火油灯应同时变大');
});

test('火焰形态发射火球，火球能打死敌人', () => {
  const lv = makeLevel({ '10,1': 'E' });
  const m = new Match(lv);
  m.player.powerUp('fire');
  m.player.body.x = 5.5;
  m.update({ firePressed: true }, 1 / 60);
  assert.equal(m.fireballs.length, 1, '应发射一颗火球');

  for (let i = 0; i < 90; i++) m.update({}, 1 / 60);
  assert.equal(m.enemies[0].alive, false, '火球应打死甲虫');
});

test('火球有冷却，不能连发', () => {
  const lv = makeLevel();
  const m = new Match(lv);
  m.player.powerUp('fire');
  for (let i = 0; i < 5; i++) m.update({ firePressed: true }, 1 / 60);
  assert.equal(m.fireballs.length, 1);
});

test('火焰形态受伤退成变大，而不是直接变小', () => {
  const lv = makeLevel();
  const m = new Match(lv);
  m.player.powerUp('fire');
  m.player.invuln = 0;
  m.hurt();
  assert.equal(m.player.state, 'big');
  assert.equal(m.deaths, 0);
});
