// BATTLE ROYALE MINI · M1 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { weaponById, clamp, dist } from '../config/gameplay.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 420; // 单局上限 7 分钟（12 场排位，够 greedy 推 3+ 场）
const INPUT_LATENCY_MS = 90;

// ---------- 工具 ----------
function nearestEnemy(run, p) {
  let best = null, bd = Infinity;
  for (const o of run.players) {
    if (o === p || !o.alive) continue;
    const d = dist(o.x, o.y, p.x, p.y);
    if (d < bd) { bd = d; best = o; }
  }
  return { enemy: best, d: bd };
}

function nearestItem(run, p, kind) {
  let best = null, bd = Infinity;
  for (const it of run.items) {
    if (!it.alive) continue;
    if (kind && it.kind !== kind) continue;
    if (dist(it.x, it.y, run.gas.cx, run.gas.cy) > run.gas.r) continue;
    const d = dist(it.x, it.y, p.x, p.y);
    if (d < bd) { bd = d; best = it; }
  }
  return { item: best, d: bd };
}

// ---------- greedy：进圈 + 捡好枪 + 遇敌拉打 ----------
function greedyInput(run, tick) {
  const p = run.players.find((e) => e.isPlayer);
  if (!p || !p.alive) return { moveX: 0, moveY: 0, aimX: 1, aimY: 0, shoot: false, reload: false, med: false };
  const gas = run.gas;
  const inGas = dist(p.x, p.y, gas.cx, gas.cy) > gas.r;
  const { enemy, d } = nearestEnemy(run, p);
  const range = p.weapon ? weaponById(p.weapon).range : 400;
  const haveGoodGun = p.weapon && p.weapon !== 'pistol';
  const lowHp = p.hp < 40;
  let shoot = false, reload = false, med = false;
  let aimX = 0, aimY = 0;
  let moveX = 0, moveY = 0;

  // 目标点（默认毒圈中心）
  let tx = gas.cx, ty = gas.cy;

  if (!haveGoodGun) {
    // 先找好枪，绝不用手枪硬拼（原作箭头指向最近枪）
    const w = nearestItem(run, p, 'weapon');
    if (w.item) { tx = w.item.x; ty = w.item.y; }
    // 有敌人贴脸就反向拉开
    if (enemy && d < 90) { tx = p.x - (enemy.x - p.x); ty = p.y - (enemy.y - p.y); }
  } else if (enemy && p.weapon && d < range * 1.4) {
    // 拉打：瞄准 + 射击；残血就后撤，否则靠近或保持
    aimX = enemy.x - p.x; aimY = enemy.y - p.y;
    shoot = true;
    const nx = aimX / d, ny = aimY / d;
    if (lowHp) { tx = p.x - nx * 90; ty = p.y - ny * 90; }
    else if (d > range * 0.6) { tx = enemy.x; ty = enemy.y; }
    else { tx = p.x - nx * 70; ty = p.y - ny * 70; }
  } else if (enemy && d < range * 1.2) {
    // 有枪但目标略超射程：朝敌人靠近
    aimX = enemy.x - p.x; aimY = enemy.y - p.y;
    tx = enemy.x; ty = enemy.y;
  }

  // 毒圈外优先回圈（高于一切）
  if (inGas) { tx = gas.cx; ty = gas.cy; }

  // 朝目标移动（连续微调 + 轻微震颤，避免 settle-and-hold）
  const dx = tx - p.x, dy = ty - p.y;
  const dd = Math.hypot(dx, dy) || 1;
  const steer = clamp(dd * 0.02, 0, 1);
  const orbit = 0.35;
  const a = Math.atan2(dy, dx) + orbit * Math.sin(tick * 0.03);
  moveX = Math.cos(a) * steer;
  moveY = Math.sin(a) * steer;
  if (dd < 12) { moveX = Math.cos(tick * 0.11); moveY = Math.sin(tick * 0.11); } // 原地巡逻

  if (p.ammo <= 0 && p.weapon) reload = true;
  if (p.hp < 55 && p.meds > 0) med = true;

  return { moveX, moveY, aimX, aimY, shoot, reload, med };
}

function makeRandomStrategy(seed) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  let dirA = 0, shoot = false;
  return (run, tick) => {
    const p = run.players.find((e) => e.isPlayer);
    if (!p || !p.alive) return { moveX: 0, moveY: 0, aimX: 1, aimY: 0, shoot: false, reload: false, med: false };
    if (tick % 24 === 0) { dirA = rnd() * Math.PI * 2; shoot = rnd() < 0.4; }
    return {
      moveX: Math.cos(dirA), moveY: Math.sin(dirA),
      aimX: Math.cos(dirA + 0.6), aimY: Math.sin(dirA + 0.6),
      shoot,
      reload: rnd() < 0.02,
      med: rnd() < 0.02,
    };
  };
}

function noinput() {
  return { moveX: 0, moveY: 0, aimX: 0, aimY: 0, shoot: false, reload: false, med: false };
}

// ---------- 跑一局 ----------
function play(name, inputFor, seed) {
  const run = createRun({ seed });
  const maxTicks = Math.round(MAX_SEC / STEP);

  let firstInputSec = -1;
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let prevMove = null;
  let prevShoot = false;
  let totalTicks = 0;
  let wonMatch = 0;

  for (let tick = 0; tick < maxTicks && (run.phase === 'playing' || run.phase === 'won'); tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    const prevMatch = run.match;
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (Math.hypot(input.moveX || 0, input.moveY || 0) > 0.05 || input.shoot)) firstInputSec = sec;

    const moveChanged = prevMove == null || Math.abs((input.moveX || 0) - prevMove.x) + Math.abs((input.moveY || 0) - prevMove.y) > 1e-6;
    const shootToggled = !!input.shoot !== prevShoot;
    if (moveChanged || shootToggled || input.reload || input.med) actions += 1;
    const tickEvents = run.drainEvents();
    const idle = !moveChanged && !shootToggled && !input.reload && !input.med && tickEvents.length === 0;
    if (idle) idleTicks += 1;
    prevMove = { x: input.moveX || 0, y: input.moveY || 0 };
    prevShoot = !!input.shoot;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'kill' && e.killer === 'player' && firstSuccessSec < 0) firstSuccessSec = sec;
      if (e.type === 'win') wonMatch += 1;
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }
    if (run.match > prevMatch) { /* 进入下一场 */ }
    if (run.phase === 'dead' || run.phase === 'won') break;
  }

  const durationSec = run.time;
  return {
    id: `${name}-${seed}`,
    policy: name,
    seed: seed >>> 0,
    durationSec: Math.round(durationSec * 10) / 10,
    actions,
    firstInputSec: firstInputSec < 0 ? 0 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec < 0 ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.phase === 'dead' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.match + 1,
    completed: run.phase === 'won',
    matchesWon: wonMatch,
    kills: run.stats.kills,
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { genre: 'action', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run, tick) => greedyInput(run, tick), seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(match=${r.levelsReached},won=${r.matchesWon},dead=${r.deaths},dur=${r.durationSec}s,kills=${r.kills},gap=${r.maxEventGapSec}s,ev=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
