import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { GAME, WORLD } from '../config/game.config.js';
import { LEVELS } from '../config/levels.js';
import { UPGRADE_MAP } from '../config/upgrades.js';

test('冒烟：createRun → setInput → step → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.setInput(1, 0);
  r.step(1 / 60);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'playing');
  const ev = r.drainEvents();
  assert.ok(Array.isArray(ev));
});

test('state 形状：level/scene/player/enemies/gems 齐全', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.sceneKey, 'spring');
  assert.equal(s.phase, 'playing');
  assert.ok(s.player.x > 0 && s.player.y > 0);
  assert.ok(Array.isArray(s.enemies));
  assert.ok(Array.isArray(s.gems));
  assert.ok(Array.isArray(s.projectiles));
  assert.equal(s.killTarget, LEVELS[0].killTarget);
});

test('初始第一波立即刷怪', () => {
  const r = createRun(0, { seed: 1 });
  assert.ok(r.state.enemies.length > 0, '开局应有敌人');
});

test('移动：setInput(1,0) 后 player.x 增加', () => {
  const r = createRun(0, { seed: 1 });
  r.state.enemies = [];
  const x0 = r.state.player.x;
  r.setInput(1, 0);
  r.step(0.5);
  assert.ok(r.state.player.x > x0, '向右移动 x 应增加');
});

test('边界：玩家不会越出世界', () => {
  const r = createRun(0, { seed: 1 });
  r.state.enemies = [];
  r.setInput(-1, 0);
  for (let i = 0; i < 300; i += 1) r.step(1 / 60);
  assert.ok(r.state.player.x >= 30, '不应越出左边界');
  assert.ok(r.state.player.x <= WORLD.WIDTH - 30);
  assert.ok(r.state.player.y >= 50);
  assert.ok(r.state.player.y <= WORLD.HEIGHT - 10);
});

test('mulberry32 同种子可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('近战自动攻击：贴脸敌人被击杀并掉修为光点', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.state.player;
  const e = r.state.enemies[0];
  e.x = p.x + 50; e.y = p.y;
  e.hp = 10;
  r.step(0.3);
  assert.equal(r.state.kills, 1, '近战应击杀贴脸敌人');
  assert.ok(r.state.gems.length >= 1, '击杀应掉修为光点');
});

test('拾取修为：光点落在身上 → xp 增加', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.state.player;
  r.state.gems.push({ x: p.x, y: p.y, value: 1, t: 0 });
  const xp0 = p.xp;
  r.step(0.05);
  assert.ok(p.xp > xp0, '拾取后 xp 应增加');
});

test('升级：xp 满 → phase=upgrade 且三选一', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.state.player;
  r.state.gems.push({ x: p.x, y: p.y, value: p.xpToNext + 1, t: 0 });
  r.step(0.05);
  assert.equal(r.state.phase, 'upgrade');
  assert.equal(r.state.choices.length, 3);
  assert.equal(p.level, 1);
});

test('选择升级：chooseUpgrade 后回到 playing 且剑劲生效', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.state.player;
  const dmg0 = p.meleeDamage;
  // 直接强制进入升级态并给一个剑劲选项
  r.state.phase = 'upgrade';
  r.state.choices = ['bladePower', 'bladeSpeed', 'leafDart'];
  const res = r.chooseUpgrade('bladePower');
  assert.equal(res.ok, true);
  assert.equal(r.state.phase, 'playing');
  assert.ok(p.meleeDamage > dmg0, '剑劲应提高伤害');
});

test('升级上限：满级剑意不再出现在候选中', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.state.player;
  p.abilities.leafDart = UPGRADE_MAP.leafDart.maxLevel;
  p.abilities.whirlSlash = UPGRADE_MAP.whirlSlash.maxLevel;
  r.state.phase = 'upgrade';
  const choices = r._rollChoices();
  assert.ok(!choices.includes('leafDart'), '满级剑意不应再出现');
  assert.ok(!choices.includes('whirlSlash'));
});

test('胜利：活到时间且击杀达标 → won', () => {
  const r = createRun(0, { seed: 1 });
  r.state.enemies = [];
  r.state.kills = r.state.killTarget;
  r.state.timeLeft = 0;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
});

test('失败（超时）：活到时间但击杀不足 → lost timeOut', () => {
  const r = createRun(0, { seed: 1 });
  r.state.enemies = [];
  r.state.kills = 0;
  r.state.timeLeft = 0;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'timeOut');
});

test('失败（战死）：HP 归零 → lost slain', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.state.player;
  p.hp = 5;
  const e = r.state.enemies[0];
  e.x = p.x; e.y = p.y;
  e.damage = 100;
  r.step(0.05);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'slain');
});

test('精英怪：第 3 关定时刷精英', () => {
  const r = createRun(2, { seed: 1 });
  assert.ok(LEVELS[2].elite, 'L3 应有精英配置');
  r.state.time = LEVELS[2].elite.at + 1;
  r._spawnTick(1);
  assert.equal(r.state.eliteSpawned, true);
  assert.ok(r.state.enemies.some((e) => e.elite));
});

test('Boss：第 4 关刷药王鼎', () => {
  const r = createRun(3, { seed: 1 });
  assert.equal(LEVELS[3].boss, 'bossCauldron');
  r.state.time = LEVELS[3].duration * 0.61;
  r._spawnTick(1);
  assert.equal(r.state.bossSpawned, true);
  assert.ok(r.state.enemies.some((e) => e.boss));
});

test('窄道墙：第 11 关玩家被推出墙外', () => {
  const r = createRun(10, { seed: 1 });
  assert.ok(r.state.walls.length > 0, 'L11 应有墙');
  const p = r.state.player;
  p.x = 250; p.y = 348; // 左墙内部
  r.step(1 / 60);
  assert.ok(p.y < 300, '玩家应被推出墙外');
});

test('毒沼：第 10 关有减速带且可判定', () => {
  const r = createRun(9, { seed: 1 });
  assert.ok(r.state.hazards.length > 0, 'L10 应有毒沼');
  const hz = r.state.hazards[0];
  assert.equal(r._inHazard(hz.x + 5, hz.y + 5), true);
  assert.equal(r._inHazard(0, 0), false);
});

test('签名剑意：满级剑意全开 → signature', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.state.player;
  for (const id of ['leafDart', 'whirlSlash', 'thunderBamboo', 'rootTangle', 'thousandBamboo']) {
    p.abilities[id] = UPGRADE_MAP[id].maxLevel;
  }
  r._recomputeSignature();
  assert.equal(r.state.signature, true);
});
