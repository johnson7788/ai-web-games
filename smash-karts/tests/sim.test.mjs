// SMASH KARTS · M1 纯逻辑测试：物理/漂移/加速/命中/击杀/重生/箱子/危险地形/AI/回合/升级/评分
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createRun, tick, nextRound, getHud, drainEvents, upgradeChoices, applyUpgrade,
  scoreOf, rankOf, SMOKE,
} from '../src/game/sim.js';
import {
  WORLD, TUNING, WEAPONS, CRATE_WEAPONS, ARENAS, RULES, UPGRADES, RANKS, CONFIG, PLAYER_KART,
} from '../config/game.config.js';

const DT = 1 / 60;
const K = TUNING.kart;
const B = TUNING.boost;
const WALL = 28;
const CENTER = { x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2 };

/** 只留玩家 + 1 台静止靶车的隔离场景。 */
function duel(opts = {}) {
  const run = createRun({ seed: opts.seed ?? 7, playerKart: opts.playerKart });
  skipCountdown(run);
  for (let i = 2; i < run.karts.length; i += 1) {
    run.karts[i].dead = true;
    run.karts[i].respawn = 1e6;
  }
  const p = run.karts[0];
  const b = run.karts[1];
  p.x = 200; p.y = CENTER.y; p.angle = 0; p.vAngle = 0; p.speed = 0;
  b.x = 500; b.y = CENTER.y; b.angle = Math.PI; b.vAngle = Math.PI; b.speed = 0;
  freezeAi(b);
  run.crates.length = 0;
  run.crateTimer = 1e9;
  drainEvents(run);
  return run;
}
/** 冻住一台电脑：不再决策，且原地停住（plan 就是自己脚下）。 */
function freezeAi(k) {
  k.ai.think = 1e9;
  k.ai.plan = { x: k.x, y: k.y };
  k.ai.rangeMin = 0;
  k.ai.wantFire = false;
  k.ai.wantDrift = false;
  k.ai.unstick = 0;
}
function silenceBots(run) {
  for (let i = 1; i < run.karts.length; i += 1) {
    run.karts[i].dead = true;
    run.karts[i].respawn = 1e6;
  }
  return run;
}
function noCrates(run) {
  run.crates.length = 0;
  run.crateTimer = 1e9;
  return run;
}
function botIdle(run) {
  drainEvents(run);
  return noCrates(silenceBots(run));
}
function skipCountdown(run) {
  for (let i = 0; i < 200 && run.phase === 'countdown'; i += 1) tick(run, DT, {});
  drainEvents(run);
  return run;
}
/** 直接把本局判成结束（真实的 target/time 判定另有专测）。 */
function endRoundNow(run) {
  run.phase = 'roundover';
  run.roundsPlayed += 1;
  run.playerRoundsWon += 1;
  return run;
}
function drive(run, n, input) {
  for (let i = 0; i < n; i += 1) tick(run, DT, input);
  return run;
}
/** 跑步机：边跑边把玩家放回场心，专测「与位置无关」的力学量（充能/加速/上限）。 */
function treadmill(run, n, input) {
  const p = run.karts[0];
  for (let i = 0; i < n; i += 1) {
    tick(run, DT, input);
    p.x = CENTER.x;
    p.y = CENTER.y;
    for (let j = run.projectiles.length - 1; j >= 0; j -= 1) {
      if (run.projectiles[j].owner === p.id) run.projectiles.splice(j, 1);
    }
  }
  return run;
}
/** 直接塞一发子弹到目标脸上，用来可控地制造伤害/击杀。 */
function shootAtTarget(run, victimIdx, damage, ownerIdx = 0) {
  const v = run.karts[victimIdx];
  run.projectiles.push({
    id: 90000 + v.id, x: v.x - 1, y: v.y, vx: 0, vy: 0, damage,
    owner: run.karts[ownerIdx].id, life: 1, splash: 0, color: '#fff', kind: 'bullet', bounces: 0, weapon: 'gun',
  });
  drive(run, 1, {});
}
function typesOf(run) { return drainEvents(run).map((e) => e.type); }
function eventsOf(run) { return drainEvents(run); }
function hpOf(k) { return k.hp; }

// ---------------------------------------------------------------- 初始化 / 契约

test('初始化：5 台车、玩家在最前、默认 mint、倒计时开局', () => {
  const run = createRun({ seed: 3 });
  assert.equal(run.karts.length, 1 + RULES.botCount);
  assert.equal(run.karts[0].isPlayer, true);
  assert.equal(run.karts[0].kartId, PLAYER_KART);
  assert.equal(run.phase, 'countdown');
  assert.equal(run.roundIndex, 0);
  assert.ok(run.karts.every((k) => k.hp === RULES.hp && k.weapon === 'gun'));
  assert.deepEqual(run.karts.map((k) => k.kartId), ['mint', 'cherry', 'blu', 'sunny', 'grape']);
  assert.deepEqual(run.karts.slice(1).map((k) => k.ai.mode), ['aggressive', 'sniper', 'brawler', 'camper']);
});

test('playerKart 可换车身，且不会和电脑撞同款', () => {
  const run = createRun({ seed: 3, playerKart: 'cherry' });
  assert.equal(run.karts[0].kartId, 'cherry');
  assert.equal(run.karts[0].name, 'Cherry');
  assert.ok(!run.karts.slice(1).some((k) => k.kartId === 'cherry'));
  assert.equal(run.karts.length, 5);
});

test('rand 是 seeded：同 seed 两次跑出完全一致的轨迹', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  drive(a, 240, { throttle: 1, steer: 0.4, drift: true, fire: true });
  drive(b, 240, { throttle: 1, steer: 0.4, drift: true, fire: true });
  assert.equal(a.karts[0].x, b.karts[0].x);
  assert.equal(a.karts[1].y, b.karts[1].y);
  assert.equal(a.karts[0].kills, b.karts[0].kills);
});

test('出生点合法：在边界内、不埋进障碍', () => {
  const run = createRun({ seed: 9 });
  for (const k of run.karts) {
    assert.ok(k.x > WALL && k.x < WORLD.WIDTH - WALL && k.y > WALL && k.y < WORLD.HEIGHT - WALL);
    for (const o of run.arena.obstacles) {
      if (o.shape === 'circle') assert.ok(Math.hypot(k.x - o.x, k.y - o.y) > o.r);
      else assert.ok(k.x < o.x || k.x > o.x + o.w || k.y < o.y || k.y > o.y + o.h);
    }
  }
});

test('sim 是纯逻辑：不引用 DOM / window / 时间 / Math.random', () => {
  const raw = readFileSync(fileURLToPath(new URL('../src/game/sim.js', import.meta.url)), 'utf8');
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  for (const bad of ['Math.random', 'document.', 'window.', 'localStorage', 'performance.', 'Date.now']) {
    assert.ok(!src.includes(bad), `源码不应出现 ${bad}`);
  }
  assert.ok(src.includes('../../config/game.config.js'), '只 import config');
  assert.equal(raw.match(/^import /gm).length, 1, '只有一个 import');
});

// ---------------------------------------------------------------- 物理 / 驾驶

test('油门：从静止加速并封顶在极速', () => {
  const run = botIdle(duel());
  const p = run.karts[0];
  const x0 = p.x;
  drive(run, 180, { throttle: 1, steer: 0 });
  assert.ok(p.x > x0 + 100, '向前移动');
  assert.ok(p.speed <= K.maxSpeed + 1e-6 && p.speed > K.maxSpeed * 0.9, `极速 ${p.speed}`);
});

test('松油门后靠摩擦减速到接近 0', () => {
  const run = botIdle(duel());
  drive(run, 120, { throttle: 1 });
  drive(run, 240, { throttle: 0 });
  assert.ok(Math.abs(run.karts[0].speed) < 5, `速度应衰减：${run.karts[0].speed}`);
});

test('倒车：上限是 reverseMax，且能后退', () => {
  const run = botIdle(duel());
  const p = run.karts[0];
  const x0 = p.x;
  drive(run, 60, { throttle: -1 });
  assert.ok(p.x < x0, '位置后退');
  treadmill(run, 240, { throttle: -1 });
  assert.ok(p.speed >= -K.reverseMax - 1e-6 && p.speed < -K.reverseMax * 0.9, `倒车极速 ${p.speed}`);
});

test('转向：需要速度，angle 随 steer 变化', () => {
  const run = botIdle(duel());
  const p = run.karts[0];
  drive(run, 60, { throttle: 1 });
  const a0 = p.angle;
  treadmill(run, 30, { throttle: 1, steer: 1 });
  assert.ok(p.angle > a0, '右转');
  const a1 = p.angle;
  treadmill(run, 30, { throttle: 1, steer: -1 });
  assert.ok(p.angle < a1, '左转');
  const still = botIdle(skipCountdown(createRun({ seed: 1 })));
  const s0 = still.karts[0].angle;
  drive(still, 30, { throttle: 0, steer: 1 });
  assert.ok(Math.abs(still.karts[0].angle - s0) < 1e-9, '停着转不动（转向权限来自速度）');
});

test('撞墙：反弹减速、发 wallBump、不会越界', () => {
  const run = botIdle(duel());
  const p = run.karts[0];
  p.x = 400; p.y = CENTER.y; p.angle = Math.PI; p.vAngle = Math.PI; p.speed = K.maxSpeed;
  drainEvents(run);
  drive(run, 90, { throttle: 1 });
  const evs = eventsOf(run);
  assert.ok(p.x >= WALL + K.radius - 1e-6, '没有穿过左墙');
  assert.ok(evs.some((e) => e.type === 'wallBump' && typeof e.speed === 'number'), 'wallBump');
  assert.ok(p.speed < K.maxSpeed * 0.9, `撞墙后掉速 ${p.speed}`);
});

test('障碍：bounce 障碍会弹开、不可穿透', () => {
  const run = botIdle(skipCountdown(createRun({ seed: 5 })));
  const mush = run.arena.obstacles.find((o) => o.shape === 'circle' && o.bounce);
  const p = run.karts[0];
  p.y = mush.y; p.x = mush.x - mush.r - 90; p.angle = 0; p.vAngle = 0; p.speed = 0;
  drainEvents(run);
  drive(run, 200, { throttle: 1 });
  assert.ok(Math.hypot(p.x - mush.x, p.y - mush.y) > mush.r, '没有被弹进障碍内部');
  assert.ok(typesOf(run).includes('wallBump'), '弹开有反馈');
});

// ---------------------------------------------------------------- 漂移 / 加速

test('漂移：需要速度+转向才充能，charge 每秒约 perSec', () => {
  const run = botIdle(duel());
  const p = run.karts[0];
  drive(run, 120, { throttle: 1 });                    // 先提速
  drainEvents(run);
  treadmill(run, 60, { throttle: 1, steer: 0.6, drift: true });
  assert.ok(p.drift.active, '漂移已进入');
  assert.ok(p.drift.charge > B.perSec * 0.8 && p.drift.charge <= 1, `充能 ${p.drift.charge}`);
  assert.ok(typesOf(run).includes('driftStart'));
  const no = botIdle(duel());
  drive(no, 120, { throttle: 1 });
  treadmill(no, 60, { throttle: 1, steer: 0.1, drift: true });
  assert.equal(no.karts[0].drift.charge, 0, '不转方向就不充能');
});

test('漂移：低速按 Shift 不充能也不进入漂移', () => {
  const run = botIdle(duel());
  const p = run.karts[0];
  p.speed = B.driftMinSpeed - 40;
  drainEvents(run);
  drive(run, 20, { throttle: 0, steer: 0.6, drift: true });
  assert.equal(p.drift.active, false);
  assert.equal(p.drift.charge, 0);
  assert.ok(!typesOf(run).includes('driftStart'));
});

test('漂移走外线：速度方向落后于车头方向', () => {
  const run = botIdle(duel());
  const p = run.karts[0];
  drive(run, 120, { throttle: 1 });
  treadmill(run, 45, { throttle: 1, steer: 1, drift: true });
  const slip = Math.abs(((p.angle - p.vAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  assert.ok(slip > 0.05, `车头/速度方向应分离，实际差 ${slip}`);
  assert.notEqual(p.angle, p.vAngle);
});

test('松手释放加速：charge≥门槛 → boosting + 时长在 [minDur,maxDur] + 面板清空', () => {
  const run = botIdle(duel());
  const p = run.karts[0];
  drive(run, 120, { throttle: 1 });
  treadmill(run, 60, { throttle: 1, steer: 0.6, drift: true });
  const charge = p.drift.charge;
  drainEvents(run);
  treadmill(run, 1, { throttle: 1, steer: 0.6, drift: false });
  const evs = eventsOf(run);
  assert.ok(charge >= B.minToFire, `蓄力应过门槛：${charge}`);
  assert.ok(evs.some((e) => e.type === 'driftEnd' && e.charge === charge), 'driftEnd 带上释放时的 charge');
  assert.ok(evs.some((e) => e.type === 'boost' && e.charge === charge), 'boost 事件');
  assert.equal(p.drift.charge, 0, '面板清空');
  assert.ok(p.boosting && p.boost > 0 && p.boost <= 1, `加速条 0..1：${p.boost}`);
  assert.ok(p.boostTime >= B.minDur - 1e-6 && p.boostTime <= B.maxDur + 1e-6, `时长 ${p.boostTime}`);
});

test('蓄力不足松手不给加速', () => {
  const run = botIdle(duel());
  const p = run.karts[0];
  drive(run, 120, { throttle: 1 });
  treadmill(run, 6, { throttle: 1, steer: 0.6, drift: true });
  assert.ok(p.drift.charge > 0 && p.drift.charge < B.minToFire, `蓄力不足：${p.drift.charge}`);
  drainEvents(run);
  treadmill(run, 1, { throttle: 1, drift: false });
  assert.ok(!typesOf(run).includes('boost'));
  assert.equal(p.boosting, false);
});

test('加速期极速上限 ×speedMul，加速条随时间衰减', () => {
  const run = botIdle(duel());
  const p = run.karts[0];
  drive(run, 200, { throttle: 1 });
  treadmill(run, 120, { throttle: 1, steer: 0.6, drift: true });
  treadmill(run, 1, { throttle: 1 });                     // 松手
  assert.ok(p.boosting, '进入加速');
  treadmill(run, 20, { throttle: 1 });
  assert.ok(p.speed > K.maxSpeed, `加速期应突破面板极速 ${p.speed}`);
  assert.ok(p.speed <= K.maxSpeed * B.speedMul + 1);
  const before = p.boost;
  treadmill(run, 30, { throttle: 0 });
  assert.ok(p.boost < before && p.boost >= 0, '加速条衰减');
});

test('满蓄力释放 → boost 条正好满格（1）', () => {
  const run = botIdle(duel());
  const p = run.karts[0];
  drive(run, 120, { throttle: 1 });
  treadmill(run, 180, { throttle: 1, steer: 0.6, drift: true });
  assert.equal(p.drift.charge, 1, '已充满');
  treadmill(run, 1, { throttle: 1 });
  assert.ok(Math.abs(p.boost - 1) < 1e-6, `boost=${p.boost}`);
  assert.ok(Math.abs(p.boostTime - B.maxDur) < 1e-6);
});

// ---------------------------------------------------------------- 武器 / 命中

test('开火：shot 事件字段齐全 + 冷却 + 后坐减速', () => {
  const run = duel();
  const p = run.karts[0];
  p.speed = 200;
  const speed0 = p.speed;
  drainEvents(run);
  drive(run, 1, { throttle: 0, fire: true });
  const evs = eventsOf(run);
  const shot = evs.find((e) => e.type === 'shot');
  assert.ok(shot, '有 shot 事件');
  assert.deepEqual(Object.keys(shot).sort(), ['angle', 'owner', 'type', 'weapon', 'x', 'y']);
  assert.equal(shot.owner, p.id);
  assert.equal(shot.weapon, 'gun');
  assert.ok(p.cooldown > 0);
  assert.ok(p.speed < speed0, `后坐 ${p.speed} < ${speed0}`);
  assert.equal(run.projectiles.length, WEAPONS.gun.count);
  assert.ok(evs.every((e) => e.type !== 'hit'), '刚出膛不应立刻命中自己人');
  drive(run, 1, { throttle: 0, fire: true });
  assert.equal(run.projectiles.length, WEAPONS.gun.count, '冷却内不再开第二枪');
});

test('命中：弹道造成伤害并发 hit（victim/attacker/damage/weapon 齐全）', () => {
  const run = duel();
  const b = run.karts[1];
  const hp0 = hpOf(b);
  drainEvents(run);
  drive(run, 30, { throttle: 0, fire: true });
  const evs = eventsOf(run);
  const hit = evs.find((e) => e.type === 'hit' && e.victim === b.id);
  assert.ok(hit, '玩家子弹命中靶车');
  assert.deepEqual(Object.keys(hit).sort(), ['attacker', 'damage', 'type', 'victim', 'weapon', 'x', 'y']);
  assert.equal(hit.attacker, run.karts[0].id);
  assert.equal(hit.weapon, 'gun');
  assert.equal(hit.damage, WEAPONS.gun.damage);
  assert.ok(b.hp < hp0);
});

test('护盾先吸收伤害，打空后才掉血', () => {
  const run = duel();
  const b = run.karts[1];
  b.shield = 4;
  drainEvents(run);
  shootAtTarget(run, 1, WEAPONS.gun.damage);
  const evs = eventsOf(run);
  const hit = evs.find((e) => e.type === 'hit');
  assert.ok(hit, '仍然发 hit');
  assert.equal(b.shield, 0, '护盾被打空');
  assert.equal(b.hp, RULES.hp - (WEAPONS.gun.damage - 4), '只掉盾外的伤害');
});

test('弹药耗尽自动回到无限泡泡枪', async () => {
  const run = duel();
  const p = run.karts[0];
  p.weapon = 'shotgun';
  p.ammo = WEAPONS.shotgun.ammo;
  const start = p.ammo;
  for (let i = 0; i < 120; i += 1) {
    p.cooldown = 0;
    drive(run, 1, { throttle: 0, fire: true });
  }
  assert.ok(start > 0);
  assert.equal(p.weapon, 'gun');
  assert.equal(p.ammo, Infinity);
});

test('霰弹一次打出 count 颗弹丸', () => {
  const run = duel();
  const p = run.karts[0];
  p.weapon = 'shotgun';
  p.ammo = WEAPONS.shotgun.ammo;
  p.cooldown = 0;
  drainEvents(run);
  drive(run, 1, { fire: true });
  assert.equal(run.projectiles.length, WEAPONS.shotgun.count);
});

// ---------------------------------------------------------------- 击杀 / 重生

test('击杀：ko 事件 + 击杀/死亡计数 + 2 秒倒计时', () => {
  const run = duel();
  const b = run.karts[1];
  b.hp = 1;
  drainEvents(run);
  drive(run, 30, { throttle: 0, fire: true });
  const evs = eventsOf(run);
  const ko = evs.find((e) => e.type === 'ko');
  assert.ok(ko, '应有 ko');
  assert.equal(ko.victim, b.id);
  assert.equal(ko.killer, run.karts[0].id);
  assert.equal(ko.kartId, b.kartId);
  assert.equal(b.dead, true);
  assert.equal(b.hp, 0);
  assert.equal(run.karts[0].kills, 1);
  assert.equal(run.karts[0].killsTotal, 1);
  assert.equal(b.deaths, 1);
  assert.ok(b.respawn > 0 && b.respawn <= RULES.respawnSec, `重生倒计时 ${b.respawn}`);
  assert.equal(b.weapon, 'gun', '死亡时掉枪');
});

test('重生：满血 + 无敌 + 0.4 加速 + 落在最远出生点', () => {
  const run = duel();
  const b = run.karts[1];
  const p = run.karts[0];
  drainEvents(run);
  shootAtTarget(run, 1, 999);
  assert.equal(b.dead, true);
  p.x = 100; p.y = 100;
  drainEvents(run);
  drive(run, Math.round(RULES.respawnSec * 60) - 2, {});
  assert.equal(b.dead, true, '不到 2 秒不复活');
  assert.ok(!typesOf(run).includes('respawn'));
  drainEvents(run);
  drive(run, 4, {});
  const evs = eventsOf(run);
  const rb = evs.find((e) => e.type === 'respawn');
  assert.ok(rb && rb.id === b.id && rb.kartId === b.kartId, '2 秒到点 respawn 事件');
  assert.equal(b.dead, false);
  assert.equal(b.hp, b.maxHp);
  assert.ok(b.invuln > 0 && b.invuln <= TUNING.combat.respawnInvulnSec + 1e-6, `无敌 ${b.invuln}`);
  assert.ok(Math.abs(b.boost - RULES.boostStart) < 0.05, `重生附赠 boost ${b.boost}`);
  const spawns = ARENAS[0].spawns;
  const far = spawns.reduce((acc, s) => (Math.hypot(s.x - p.x, s.y - p.y) > Math.hypot(acc.x - p.x, acc.y - p.y) ? s : acc), spawns[0]);
  assert.ok(Math.hypot(b.x - far.x, b.y - far.y) < 1, `应选离敌人最远的出生点 ${b.x},${b.y}`);
});

test('无敌期内打不掉血，过后正常受伤', () => {
  const run = duel();
  const b = run.karts[1];
  b.invuln = 5;
  b.ai.think = 1e9;
  drainEvents(run);
  drive(run, 60, { throttle: 1, fire: true });
  assert.equal(b.hp, b.maxHp, '无敌免伤');
  b.invuln = 0;
  drainEvents(run);
  drive(run, 60, { throttle: 1, fire: true });
  assert.ok(b.hp < b.maxHp, '无敌结束后可被打');
});

// ---------------------------------------------------------------- 箱子

test('箱子：每 crateRespawnSec 补一个、点位来自 crateSpots、最多 maxCrates', () => {
  const run = silenceBots(skipCountdown(createRun({ seed: 11 })));
  run.crates.length = 0;
  drainEvents(run);
  drive(run, Math.round(RULES.crateRespawnSec * 60) - 2, {});
  assert.ok(!typesOf(run).includes('crate'), '还没到点不提前刷');
  drive(run, 4, {});
  const evs = eventsOf(run);
  assert.ok(evs.some((e) => e.type === 'crate'), '刷新箱子');
  const c = run.crates[0];
  assert.ok(run.arena.crateSpots.some((s) => s.x === c.x && s.y === c.y), '落在 crateSpots 上');
  assert.equal(c.weapon, null, '开箱前不决定武器');
  for (let i = 0; i < 60 * 60; i += 1) drive(run, 1, {});
  assert.ok(run.crates.length <= RULES.maxCrates, `最多 ${RULES.maxCrates} 个，实际 ${run.crates.length}`);
});

test('开箱：随机给武器箱池里的枪、发 crateOpen、箱子消失', () => {
  const run = duel();
  const p = run.karts[0];
  run.crates.length = 0;
  const spot = run.arena.crateSpots[1];
  run.crates.push({ id: 9001, x: spot.x, y: spot.y, weapon: null, t: 0 });
  p.x = spot.x; p.y = spot.y;
  drainEvents(run);
  drive(run, 1, {});
  const evs = eventsOf(run);
  const open = evs.find((e) => e.type === 'crateOpen');
  assert.ok(open, 'crateOpen');
  assert.ok(CRATE_WEAPONS.includes(open.weapon), `武器来自箱池：${open.weapon}`);
  assert.equal(open.owner, p.id);
  assert.equal(p.weapon, open.weapon);
  assert.equal(p.ammo, WEAPONS[open.weapon].ammo);
  assert.equal(run.crates.length, 0);
  assert.equal(p.expression, 'happy');
});

test('AI 会去捡箱子', () => {
  const run = skipCountdown(createRun({ seed: 13 }));
  const spot = run.arena.crateSpots.find((s) => s.x < WORLD.WIDTH / 2);
  for (let i = 0; i < 60 * 40; i += 1) {
    if (i % 600 === 0 && !run.crates.length) run.crates.push({ id: 8000 + i, x: spot.x, y: spot.y, weapon: null, t: 0 });
    tick(run, DT, { throttle: 0 });
    if (run.events.some((e) => e.type === 'crateOpen' && e.owner !== run.karts[0].id)) break;
  }
  assert.ok(eventsOf(run).some((e) => e.type === 'crateOpen' && e.owner !== run.karts[0].id), '电脑开箱');
});

// ---------------------------------------------------------------- 危险地形

test('岩浆：每 hazardTickSec 掉固定血并广播危险事件', () => {
  const run = botIdle(skipCountdown(createRun({ seed: 21, roundIndex: 2 })));
  const lava = run.arena.hazards.find((h) => h.type === 'lava');
  const p = run.karts[0];
  p.x = lava.x; p.y = lava.y; p.invuln = 0;
  drainEvents(run);
  drive(run, Math.round(TUNING.combat.hazardTickSec * 60), {});
  const before = p.hp;
  drive(run, Math.round(TUNING.combat.hazardTickSec * 60), {});
  const evs = eventsOf(run);
  const hz = evs.find((e) => e.type === 'hazard');
  assert.ok(hz && hz.id === p.id, 'hazard 事件');
  assert.ok(before - p.hp >= 5 && before - p.hp <= 9, `一次掉血约 7：${before - p.hp}`);
});

test('传送带：按方向推动位置，不叠加进速度', () => {
  const run = botIdle(skipCountdown(createRun({ seed: 22, roundIndex: 1 })));
  const belt = run.arena.hazards.find((h) => h.type === 'belt');
  const p = run.karts[0];
  p.x = belt.x + belt.w / 2; p.y = belt.y + belt.h / 2; p.speed = 0;
  drainEvents(run);
  drive(run, 30, {});
  assert.ok(p.x > belt.x + belt.w / 2 + 1, '被传送带推着走');
  assert.ok(Math.abs(p.speed) < 5, `传送带不进速度 ${p.speed}`);
  assert.ok(p.x < WORLD.WIDTH);
});

test('岩浆不会生成箱子点，箱子也不会卡在岩浆里', () => {
  const lava = ARENAS[2];
  for (const s of lava.crateSpots) {
    for (const h of lava.hazards) {
      assert.ok(Math.hypot(s.x - h.x, s.y - h.y) > h.r, `${s.x},${s.y} 不该在岩浆坑里`);
    }
  }
});

// ---------------------------------------------------------------- AI

test('AI 会开车也会开火：不卡墙、持续移动、打出伤害', () => {
  const run = skipCountdown(createRun({ seed: 5 }));
  const moved = run.karts.map(() => ({ x: run.karts[0].x, y: 0, prev: null, total: 0 }));
  const seen = { shot: 0, hit: 0 };
  let maxStuck = 0;
  for (let i = 0; i < 60 * 45; i += 1) {
    for (let j = 1; j < run.karts.length; j += 1) {
      const b = run.karts[j];
      const m = moved[j];
      if (m.prev) m.total += Math.hypot(b.x - m.prev.x, b.y - m.prev.y);
      m.prev = { x: b.x, y: b.y };
      maxStuck = Math.max(maxStuck, b.ai.stuckT);
    }
    tick(run, DT, { throttle: 0 });
    for (const e of run.events) {
      if (e.type === 'shot' && e.owner !== run.karts[0].id) seen.shot += 1;
      if (e.type === 'hit' && e.attacker !== run.karts[0].id) seen.hit += 1;
    }
    drainEvents(run);
  }
  for (let j = 1; j < run.karts.length; j += 1) {
    assert.ok(moved[j].total > 400, `电脑 ${j} 应该一直在跑，只走了 ${moved[j].total}`);
    assert.ok(moved[j].total < 45 * 400, '也没有瞬移');
  }
  assert.ok(seen.shot > 5, `AI 要会开火：${seen.shot}`);
  assert.ok(seen.hit > 0, 'AI 要打中人');
  assert.ok(maxStuck < 2.0, `不该长时间卡死：最大卡住 ${maxStuck}s`);
});

test('四种性格行为有差异（同 seed 跑出不同轨迹/开火次数）', () => {
  const run = skipCountdown(createRun({ seed: 8 }));
  const fire = run.karts.map(() => 0);
  const pos = run.karts.map((k) => ({ x: k.x, y: k.y }));
  for (let i = 0; i < 60 * 20; i += 1) {
    tick(run, DT, {});
    for (const e of run.events) if (e.type === 'shot') fire[e.owner - 1] += 1;
    drainEvents(run);
  }
  const d = run.karts.map((k, i) => Math.hypot(k.x - pos[i].x, k.y - pos[i].y));
  assert.ok(new Set(run.karts.slice(1).map((k) => k.ai.mode)).size === 4, '四种性格齐全');
  assert.ok(d.slice(1).some((v) => v > 100), '有人跑动很大');
  assert.ok(d[1] !== d[2] || d[2] !== d[3], '轨迹彼此不同');
  assert.ok(fire.reduce((a, b) => a + b, 0) > 0, '场上有交火');
});

test('卡住 1.2 秒会反向脱困：把车按在墙上仍能自己出来', () => {
  const run = noCrates(skipCountdown(createRun({ seed: 17 })));
  for (const k of run.karts) { k.dead = true; k.respawn = 1e6; }
  const b = run.karts[1];
  b.dead = false;
  b.respawn = 0;
  b.ai.think = 0;
  drainEvents(run);
  const INTO_WALL = { x: 0, y: CENTER.y };
  let pinned = true;
  let unstickFrames = 0;
  for (let i = 0; i < 300; i += 1) {
    // 楔在墙里：位置/车头每帧复位，位移恒为 0，只有反向脱困能把它放出来
    if (pinned) {
      b.x = WALL + K.radius; b.y = CENTER.y;
      b.angle = Math.PI; b.vAngle = Math.PI; b.speed = 0;
    }
    b.ai.plan = INTO_WALL;
    tick(run, DT, { throttle: 0 });
    if (b.ai.unstick > 0) { unstickFrames += 1; pinned = false; }
  }
  assert.ok(unstickFrames > 0, '触发过反向脱困');
  assert.ok(b.x > WALL + K.radius + 20, `脱困后离开墙边：${b.x}`);
});

// ---------------------------------------------------------------- 回合 / 局

test('击杀达标 → roundover + roundEnd(target)', () => {
  const run = duel();
  const p = run.karts[0];
  const b = run.karts[1];
  p.kills = RULES.killTarget - 1;
  b.hp = 1;
  drainEvents(run);
  drive(run, 60, { throttle: 1, fire: true });
  assert.equal(run.phase, 'roundover');
  const end = eventsOf(run).find((e) => e.type === 'roundEnd');
  assert.equal(end.playerWon, true);
  assert.equal(end.reason, 'target');
  assert.equal(run.playerRoundsWon, 1);
});

test('时间到 → roundover + roundEnd(time)，按击杀数判定', () => {
  const run = duel();
  run.karts[1].kills = 3;
  run.roundTime = RULES.roundSeconds - DT;
  drainEvents(run);
  drive(run, 2, {});
  assert.equal(run.phase, 'roundover');
  const end = eventsOf(run).find((e) => e.type === 'roundEnd');
  assert.equal(end.reason, 'time');
  assert.equal(end.playerWon, false);
});

test('roundover / matchover 期间 sim 不再推进', () => {
  const run = duel();
  run.phase = 'roundover';
  const snapshot = JSON.stringify(run.karts.map((k) => [k.x, k.y, k.hp]));
  drive(run, 30, { throttle: 1, fire: true, drift: true });
  assert.equal(JSON.stringify(run.karts.map((k) => [k.x, k.y, k.hp])), snapshot);
});

test('nextRound：换地图、重置击杀与箱子、保留 mods、重新倒计时', () => {
  const run = duel();
  const p = run.karts[0];
  p.kills = 4;
  p.killsTotal = 6;
  p.mods.speedMul = 1.1;
  run.crates.push({ id: 1, x: 10, y: 10, weapon: 'rapid', t: 1 });
  endRoundNow(run);
  drainEvents(run);
  nextRound(run, 'turbo-engine');
  assert.equal(run.roundIndex, 1);
  assert.equal(run.arenaId, ARENAS[1].id);
  assert.equal(run.phase, 'countdown');
  assert.equal(p.kills, 0, '本局击杀重置');
  assert.equal(p.deaths, 0);
  assert.equal(p.killsTotal, 6, '累计击杀保留（给评分用）');
  assert.equal(p.mods.speedMul, 1.1, '升级数值保留');
  assert.ok(run.upgrades.includes('turbo-engine'));
  assert.ok(run.crates.every((c) => c.weapon === null));
  assert.equal(eventsOf(run).find((e) => e.type === 'roundStart').arenaId, ARENAS[1].id);
});

test('三局都打完：地图依次 meadow→candy→lava，第 3 局有冠军车', () => {
  const run = createRun({ seed: 4 });
  const ids = [];
  for (let i = 0; i < RULES.rounds; i += 1) {
    ids.push(run.arenaId);
    run.phase = 'roundover';
    run.roundsPlayed = i + 1;
    nextRound(run);
  }
  assert.deepEqual(ids, ARENAS.map((a) => a.id));
  const champ = run.karts.find((k) => k.isChampion);
  assert.ok(champ, '第 3 局有冠军车');
  assert.equal(champ.maxHp, ARENAS[2].champion.hp);
  assert.equal(champ.name, ARENAS[2].champion.label.en);
  assert.ok(Math.abs(champ.dmgMul - 1.15) < 1e-9);
});

test('第 3 局后 nextRound → matchover + matchEnd，三局比分定胜负', () => {
  const run = createRun({ seed: 6 });
  run.playerRoundsWon = 2;
  run.botRoundsWon = 1;
  run.roundsPlayed = 3;
  run.phase = 'roundover';
  drainEvents(run);
  nextRound(run);
  assert.equal(run.phase, 'matchover');
  assert.equal(run.winner, 'player');
  assert.deepEqual(eventsOf(run).find((e) => e.type === 'matchEnd'), { type: 'matchEnd', winner: 'player' });
  const t0 = run.time;
  drive(run, 60, { throttle: 1 });
  assert.equal(run.time, t0, 'matchover 后 sim 不再推进');
});

test('比分落后时 matchEnd 判负', () => {
  const run = createRun({ seed: 6 });
  run.playerRoundsWon = 1;
  run.botRoundsWon = 2;
  run.roundsPlayed = 3;
  run.phase = 'roundover';
  nextRound(run);
  assert.equal(run.winner, 'bots');
});

test('倒计时 3/2/1/0 依次发事件，之后才进 playing', () => {
  const run = createRun({ seed: 1 });
  drainEvents(run);
  const values = [];
  drive(run, Math.round(RULES.countdownSec * 60), { throttle: 1 });
  for (const e of eventsOf(run)) if (e.type === 'countdown') values.push(e.value);
  assert.deepEqual(values, [3, 2, 1, 0]);
  assert.equal(run.phase, 'playing');
  assert.equal(run.karts[0].speed, 0, '倒计时里不动');
  drive(run, 1, { throttle: 1 });
  assert.ok(run.karts[0].speed > 0, 'GO 之后才能动');
});

// ---------------------------------------------------------------- 升级

test('upgradeChoices：3 个、互不重复、排除已选', () => {
  const run = createRun({ seed: 9 });
  const a = upgradeChoices(run, 3);
  assert.equal(a.length, 3);
  assert.equal(new Set(a).size, 3);
  applyUpgrade(run, a[0]);
  const b = upgradeChoices(run, 3);
  assert.ok(!b.includes(a[0]), '已选不再出现');
  assert.equal(new Set(b).size, 3);
  assert.equal(UPGRADES.filter((u) => u.kind === 'rule').length, 8);
});

test('applyUpgrade：非法 id 忽略、重复不叠加、发 upgrade 事件', () => {
  const run = createRun({ seed: 2 });
  drainEvents(run);
  applyUpgrade(run, 'not-a-real-upgrade');
  assert.equal(run.upgrades.length, 0);
  applyUpgrade(run, 'armor-plate');
  applyUpgrade(run, 'armor-plate');
  assert.equal(run.upgrades.length, 1);
  assert.equal(run.karts[0].maxHp, RULES.hp + 30);
  assert.equal(run.karts[0].hp, RULES.hp + 30);
  assert.ok(eventsOf(run).some((e) => e.type === 'upgrade' && e.id === 'armor-plate'));
});

test('8 个 rule 类升级都真的改变规则', () => {
  const run = createRun({ seed: 12 });
  for (const u of UPGRADES.filter((x) => x.kind === 'rule')) applyUpgrade(run, u.id);
  const m = run.karts[0].mods;
  assert.deepEqual([m.bounce, m.triple, m.trail, m.refund, m.ram, m.ghost, m.magnet, m.lucky],
    [true, true, true, true, true, true, true, true]);

  // 1) 弹跳火箭：撞墙反弹一次后消失
  const r = botIdle(duel());
  applyUpgrade(r, 'rocket-bounce');
  const p0 = r.karts[0];
  r.projectiles.length = 0;
  r.projectiles.push({ id: 1, x: 60, y: CENTER.y, vx: -500, vy: 0, damage: 1, owner: 1 << 20, life: 2, splash: 0, color: '#fff', kind: 'rocket', bounces: 1, weapon: 'rocket' });
  drive(r, 5, {});
  assert.equal(r.projectiles.length, 1, '火箭反弹后仍在');
  assert.ok(r.projectiles[0].vx > 0, '方向翻回来');
  drive(r, 60, {});
  assert.equal(r.projectiles.length, 0, '只弹一次');

  // 2) 三连爆米花：8 颗，单发更弱
  const t = duel();
  applyUpgrade(t, 'triple-shot');
  const pt = t.karts[0];
  pt.weapon = 'shotgun';
  pt.ammo = WEAPONS.shotgun.ammo;
  pt.cooldown = 0;
  drive(t, 1, { fire: true });
  assert.equal(t.projectiles.length, WEAPONS.shotgun.count + 3);
  assert.ok(t.projectiles[0].damage < WEAPONS.shotgun.damage);

  // 3) 火花尾迹：漂移留下 trail 并烧伤别人
  const s = duel();
  applyUpgrade(s, 'drift-fire-trail');
  const ps = s.karts[0];
  const bs = s.karts[1];
  treadmill(s, 120, { throttle: 1 });
  treadmill(s, 60, { throttle: 1, steer: 0.6, drift: true });
  assert.ok(s.trails.length > 0, '有尾迹');
  const tr = s.trails[s.trails.length - 1];
  bs.x = tr.x; bs.y = tr.y; bs.invuln = 0; bs.shield = 0;
  drainEvents(s);
  drive(s, 25, { throttle: 0 });
  assert.ok(bs.hp < RULES.hp, '尾迹造成伤害');
  assert.ok(eventsOf(s).some((e) => e.type === 'hit' && e.weapon === 'trail'), 'hit 标明伤害来自尾迹');
  assert.ok(ps.hp === RULES.hp, '自己的尾迹不烧自己');

  // 4) 涡轮之心：击杀补满加速条
  const f = duel();
  applyUpgrade(f, 'turbo-refund');
  const pf = f.karts[0];
  pf.kills = RULES.killTarget - 1;
  pf.boost = 0;
  f.karts[1].hp = 1;
  drive(f, 90, { throttle: 1, fire: true });
  assert.equal(pf.boost, 1, '击杀后满加速');

  // 5) 保险杠撞击：加速撞人打出伤害
  const g = duel();
  applyUpgrade(g, 'ram-boost');
  const pg = g.karts[0];
  const bg = g.karts[1];
  pg.x = 300; bg.x = 340; bg.y = pg.y;
  pg.boost = 1; pg.boosting = true; pg.angle = 0; pg.vAngle = 0; pg.speed = K.maxSpeed * B.speedMul;
  drainEvents(g);
  drive(g, 1, {});
  const ramEv = eventsOf(g).find((e) => e.type === 'ram');
  assert.ok(ramEv, 'ram 事件');
  assert.equal(ramEv.damage, TUNING.boost.ramDamage);
  assert.ok(bg.hp < RULES.hp);
  drive(g, 10, {});
  assert.ok(RULES.hp - bg.hp < TUNING.boost.ramDamage * 2, '撞击有冷却，不会每帧刷伤害');

  // 6) 幽灵起步：重生 3 秒无敌 + 白送加速
  const h = duel();
  applyUpgrade(h, 'ghost-respawn');
  const ph = h.karts[0];
  drainEvents(h);
  shootAtTarget(h, 0, 999, 1);
  assert.equal(ph.dead, true, '玩家被打掉');
  drainEvents(h);
  drive(h, Math.round(RULES.respawnSec * 60) + 2, {});
  assert.equal(ph.dead, false);
  assert.ok(ph.invuln > 2.5, `幽灵无敌约 3s：${ph.invuln}`);
  assert.ok(ph.boost > RULES.boostStart, `幽灵起步白送加速：${ph.boost}`);

  // 7) 箱子磁铁：远处的箱子往玩家滑
  const mi = duel();
  applyUpgrade(mi, 'magnet-crate');
  const pm = mi.karts[0];
  pm.x = 640; pm.y = 360;
  mi.crates.length = 0;
  mi.crates.push({ id: 1, x: 880, y: 360, weapon: null, t: 0 });
  drainEvents(mi);
  drive(mi, 30, {});
  assert.ok(mi.crates.length === 1, '还在场上（没被别的车顺走）');
  assert.ok(mi.crates[0].x < 880 - 40, `箱子朝玩家滑：${mi.crates[0].x}`);
  assert.ok(mi.crates[0].x > pm.x, '不会直接瞬移到玩家身上');
  const far = duel();
  applyUpgrade(far, 'magnet-crate');
  far.karts[0].x = 640; far.karts[0].y = 360;
  far.crates.length = 0;
  far.crates.push({ id: 2, x: 1100, y: 360, weapon: null, t: 0 });
  drive(far, 30, {});
  assert.equal(far.crates[0].x, 1100, '超出磁铁范围不动');

  // 8) 幸运箱盖：开箱送护盾
  const lu = duel();
  applyUpgrade(lu, 'lucky-crate');
  const pl = lu.karts[0];
  lu.crates.length = 0;
  lu.crates.push({ id: 1, x: 640, y: 360, weapon: null, t: 0 });
  pl.x = 640; pl.y = 360;
  drainEvents(lu);
  drive(lu, 1, {});
  assert.ok(pl.shield > 0, '开箱给护盾');
});

test('stat 类升级只调数值：极速 / 射速 / 上限', () => {
  const run = duel();
  const p = run.karts[0];
  applyUpgrade(run, 'turbo-engine');
  drive(run, 400, { throttle: 1 });
  assert.ok(p.speed > K.maxSpeed * 1.05, `极速提升 ${p.speed}`);
  const r2 = duel();
  applyUpgrade(r2, 'quick-reload');
  r2.karts[0].cooldown = 0;
  drive(r2, 1, { fire: true });
  assert.ok(r2.karts[0].cooldown < WEAPONS.gun.fireRate, '射击间隔变短');
});

// ---------------------------------------------------------------- 评分 / HUD

test('scoreOf / rankOf 按公式与门槛', () => {
  const run = duel();
  const p = run.karts[0];
  assert.equal(scoreOf(run), 0);
  p.killsTotal = 10; p.deathsTotal = 5;
  run.playerRoundsWon = 1;
  assert.equal(scoreOf(run), 10 * 10 + 40 - 5 * 2);
  p.deathsTotal = 100;
  assert.equal(scoreOf(run), 0, '不为负');
  assert.equal(rankOf(260), 'S');
  assert.equal(rankOf(190), 'A');
  assert.equal(rankOf(120), 'B');
  assert.equal(rankOf(0), 'C');
  assert.equal(RANKS.length, 4);
});

test('getHud 给全 UI 需要的快照，不在 UI 里补算逻辑', () => {
  const run = duel();
  const hud = getHud(run);
  assert.equal(hud.killTarget, RULES.killTarget);
  assert.equal(hud.rounds, RULES.rounds);
  assert.ok(hud.timeLeft > 0 && hud.timeLeft <= RULES.roundSeconds);
  assert.equal(hud.scores.length, 5);
  assert.equal(hud.player.kartId, 'mint');
  assert.equal(typeof hud.player.hp, 'number');
  assert.deepEqual(Object.keys(hud.player.mods).sort(), Object.keys(run.karts[0].mods).sort());
  assert.equal(hud.player.weaponName.en, WEAPONS.gun.name.en);
  assert.equal(hud.karts.length, 5);
  assert.equal(hud.arenaId, ARENAS[0].id);
  assert.equal(getHud(createRun({ seed: 1 })).phase, 'countdown');
});

test('drainEvents 取完即清空', () => {
  const run = drive(createRun({ seed: 1 }), 30, { throttle: 1 });
  assert.ok(drainEvents(run).length > 0);
  assert.equal(drainEvents(run).length, 0);
});

// ---------------------------------------------------------------- 引导模式

test('tutorial：单局 meadow、AI 不开火不伤害、慢速、立刻有箱子、无危险地形', () => {
  const run = createRun({ seed: 3, tutorial: true });
  assert.equal(run.rounds, 1);
  assert.equal(run.arenaId, ARENAS[0].id);
  assert.equal(run.crates.length, 1);
  assert.deepEqual([run.crates[0].x, run.crates[0].y], [ARENAS[0].crateSpots[0].x, ARENAS[0].crateSpots[0].y]);
  skipCountdown(run);
  let shots = 0;
  let damageToPlayer = 0;
  const hp0 = run.karts[0].hp;
  run.karts[0].x = CENTER.x; run.karts[0].y = CENTER.y;
  for (let i = 0; i < 60 * 30; i += 1) {
    tick(run, DT, { throttle: 0 });
    for (const e of run.events) {
      if (e.type === 'shot' && e.owner !== run.karts[0].id) shots += 1;
      if (e.type === 'hit' && e.victim === run.karts[0].id) damageToPlayer += e.damage;
    }
    drainEvents(run);
  }
  assert.equal(shots, 0, '引导模式 AI 不开火');
  assert.equal(damageToPlayer, 0);
  assert.equal(run.karts[0].hp, hp0);
  assert.ok(run.karts.slice(1).every((b) => b.speed <= K.maxSpeed * 0.45 + 1e-6), 'AI 限速 ×0.45');
  assert.equal(run.arena.hazards.length, 0);
});

// ---------------------------------------------------------------- 长时稳定

test('600 帧冒烟：hp 合法、boost 变过、shot/hit/driftStart 都出现过', () => {
  const run = createRun({ seed: 7 });
  const seen = new Set();
  let boostSeen = 0;
  for (let i = 0; i < 600; i += 1) {
    tick(run, DT, { throttle: 1, steer: 0.3, drift: i % 90 < 40, fire: i % 20 < 6 });
    for (const e of run.events) seen.add(e.type);
    if (run.karts[0].boost > 0) boostSeen = Math.max(boostSeen, run.karts[0].boost);
    drainEvents(run);
  }
  const hud = getHud(run);
  assert.ok(hud.player.hp >= 0 && hud.player.hp <= hud.player.maxHp, `hp ${hud.player.hp}`);
  assert.ok(boostSeen > 0, 'boost 变化过');
  assert.ok(['shot', 'hit', 'driftStart'].every((t) => seen.has(t)), `缺事件：${[...seen]}`);
});

test('SMOKE 探针通过', () => {
  assert.equal(SMOKE(), true);
});
