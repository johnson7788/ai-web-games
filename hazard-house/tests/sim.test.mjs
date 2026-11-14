import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, tick, getHud, tileIdx, makeRng } from '../src/game/sim.js';
import { GRID, PLAYER, RULES, ARENA } from '../config/game.config.js';

const step = (run, n, inputs = []) => { for (let i = 0; i < n; i++) tick(run, 1 / 60, inputs); };
const tileCenter = (idx) => ({
  x: GRID.ox + (idx % GRID.cols) * GRID.tw + GRID.tw / 2,
  y: GRID.oy + Math.floor(idx / GRID.cols) * GRID.th + GRID.th / 2,
});

test('创建：4 名玩家，倒计时阶段，1 人类 3  bot', () => {
  const run = createRun({ seed: 1, humans: 1 });
  assert.equal(run.players.length, 4);
  assert.equal(run.phase, 'countdown');
  assert.deepEqual(run.scores, [0, 0, 0, 0]);
  assert.equal(run.players[0].isBot, false);
  assert.equal(run.players[1].isBot, true);
});

test('倒计时结束后进入 play', () => {
  const run = createRun({ seed: 1 });
  step(run, Math.ceil(RULES.countdown * 60) + 2, []);
  assert.equal(run.phase, 'play');
});

test('移动：人类输入使 P1 位移', () => {
  const run = createRun({ seed: 1, humans: 1 });
  run.phase = 'play';
  const x0 = run.players[0].x;
  step(run, 30, [{ right: true }]);
  assert.ok(run.players[0].x > x0);
});

test('尖刺：站在激活尖刺格上掉血', () => {
  const run = createRun({ seed: 1 });
  run.phase = 'play';
  const c = tileCenter(0);
  run.players[0].x = c.x; run.players[0].y = c.y; run.players[0].invuln = 0;
  run.traps = [{ type: 'spike', tiles: [0], t: 0, phase: 'active' }];
  run.trapT = 999;
  tick(run, 1 / 60, []);
  assert.equal(run.players[0].hp, PLAYER.HP - 1);
});

test('炸弹：激活爆炸范围内掉血', () => {
  const run = createRun({ seed: 1 });
  run.phase = 'play';
  const p = run.players[0];
  p.invuln = 0;
  run.traps = [{ type: 'bomb', x: p.x, y: p.y, t: 0, phase: 'active' }];
  run.trapT = 999;
  tick(run, 1 / 60, []);
  assert.equal(p.hp, PLAYER.HP - 1);
});

test('无敌帧：受击后短暂无敌不再掉血', () => {
  const run = createRun({ seed: 1 });
  run.phase = 'play';
  const c = tileCenter(0);
  const p = run.players[0];
  p.x = c.x; p.y = c.y; p.invuln = 0;
  run.traps = [{ type: 'spike', tiles: [0], t: 0, phase: 'active' }];
  run.trapT = 999;
  tick(run, 1 / 60, []);
  const hpAfter = p.hp;
  tick(run, 1 / 60, []);
  assert.equal(p.hp, hpAfter);
  assert.ok(p.invuln > 0);
});

test('淘汰：血量归零则出局', () => {
  const run = createRun({ seed: 1 });
  run.phase = 'play';
  const c = tileCenter(0);
  const p = run.players[0];
  p.x = c.x; p.y = c.y; p.hp = 1; p.invuln = 0;
  run.traps = [{ type: 'spike', tiles: [0], t: 0, phase: 'active' }];
  run.trapT = 999;
  tick(run, 1 / 60, []);
  assert.equal(p.alive, false);
});

test('回合结束：仅剩一人时记分并进入 roundend', () => {
  const run = createRun({ seed: 1 });
  run.phase = 'play';
  run.players[1].alive = false;
  run.players[2].alive = false;
  run.players[3].alive = false;
  tick(run, 1 / 60, []);
  assert.equal(run.phase, 'roundend');
  assert.equal(run.scores[0], 1);
});

test('比赛结束：先赢 3 回合夺冠', () => {
  const run = createRun({ seed: 1 });
  run.phase = 'play';
  run.scores[0] = RULES.roundWins - 1;
  run.players[1].alive = false;
  run.players[2].alive = false;
  run.players[3].alive = false;
  tick(run, 1 / 60, []);            // roundend, scores[0]=3
  step(run, Math.ceil(RULES.roundEndDelay * 60) + 2, []);
  assert.equal(run.phase, 'over');
  assert.equal(run.matchWinner, 0);
});

test('Bot 自跑：全 bot 能完成比赛不崩溃', () => {
  const run = createRun({ seed: 4, humans: 0 });
  let guard = 0;
  while (run.phase !== 'over' && guard < 60 * 400) { tick(run, 1 / 60, []); guard++; }
  assert.equal(run.phase, 'over');
  assert.ok(run.matchWinner >= 0 && run.matchWinner <= 3);
});

test('RNG：同种子可复现', () => {
  const a = makeRng(11), b = makeRng(11);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});