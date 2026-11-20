// HERO VANGUARD · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { SKILL, HERO as HEROCFG, UPGRADES } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// ---------- 通用：朝目标移动（带人类震颤，方向每 tick 微变） ----------
function moveToward(run, hero, target, rng) {
  if (!hero) return { x: 0, y: 0 };
  const dx = target.x - hero.x;
  const dy = target.y - hero.y;
  const d = Math.hypot(dx, dy) || 1;
  let mx = dx / d;
  let my = dy / d;
  mx = clamp(mx + (rng() - 0.5) * 0.5, -1, 1);
  my = clamp(my + (rng() - 0.5) * 0.5, -1, 1);
  return { x: mx, y: my };
}

function mostDangerous(run) {
  let best = null; let bx = Infinity;
  for (const e of run.enemies) if (e.x < bx) { bx = e.x; best = e; }
  return best;
}

function nearestToBaseEnemy(run) {
  let best = null; let bd = Infinity;
  for (const e of run.enemies) {
    const d = Math.abs(e.x - 96);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function controlled(run) { return run.heroes.find((h) => h.isControlled); }
function other(run, h) { return run.heroes.find((x) => x.id !== h.id); }

// ---------- greedy：近战清杂、远程点杀、保基地 ----------
function greedyInput(run) {
  const rng = run.rng;
  const c = controlled(run);
  const o = other(run, c);
  const threat = mostDangerous(run);

  let swap = false;
  let j = false;
  let k = false;

  // 基地危急 → 换近战刃堵门清杂；远敌 → 换远程弓点杀；其余时候换位当攻击用
  if (threat && threat.x < 420 && c.kind !== 'blade' && run.skills.swap <= 0) {
    swap = true;
  } else if (threat && threat.x > 520 && c.kind !== 'bow' && run.skills.swap <= 0) {
    swap = true;
  } else if (run.skills.swap <= 0) {
    // 两英之间有 ≥2 个敌人 → 换位路径伤害
    const between = run.enemies.filter((e) => {
      const c1 = c; const c2 = other(run, c);
      const abx = c2.x - c1.x; const aby = c2.y - c1.y;
      const len2 = abx * abx + aby * aby || 1;
      const t = clamp(((e.x - c1.x) * abx + (e.y - c1.y) * aby) / len2, 0, 1);
      const px = c1.x + abx * t; const py = c1.y + aby * t;
      return Math.hypot(e.x - px, e.y - py) < 110;
    }).length;
    if (between >= 2) swap = true;
  }

  // 共鸣斩：附近 ≥2 个敌人且冷却好
  const nearCount = run.enemies.filter((e) => Math.hypot(e.x - c.x, e.y - c.y) < SKILL.resonance.radius * 1.4).length;
  if (nearCount >= 2 && run.skills.resonance <= 0) j = true;

  // 护盾充能：基地耐久明显偏低且护盾不满时才站桩（避免频繁空转不输出）
  if (run.base.hp < 30 && run.base.shield < 15 && run.skills.shield <= 0) k = true;

  // 目标优先级：近身自爆 > Boss > 最靠近基地的敌人
  const rushKamikaze = run.enemies.find((e) => e.kind === 'kamikaze' && e.x < 500);
  const boss = run.enemies.find((e) => e.kind === 'boss');
  let tx; let ty;
  const tgt = rushKamikaze || boss || threat;
  if (tgt) {
    tx = clamp(tgt.x - 90, 170, 1230);
    ty = clamp(tgt.y, 350, 690);
  } else {
    tx = c.kind === 'blade' ? 320 : 560;
    ty = c.kind === 'blade' ? 610 : 470;
  }
  const mv = moveToward(run, c, { x: tx, y: ty }, rng);

  const chooseUpgrade = run.phase === 'upgrade' ? pickUpgrade(run.upgradeChoices) : null;

  return { moveX: mv.x, moveY: mv.y, swap, j, k, chooseUpgrade };
}

function pickUpgrade(choices) {
  const order = ['resonanceRange', 'swapDamage', 'vampiric', 'twinLink', 'chainBow', 'shieldLink', 'baseMax', 'atkSpeed', 'heroSpeed', 'bladeAtk', 'bowAtk'];
  let best = 0; let bestScore = -1;
  choices.forEach((id, i) => {
    const idx = order.indexOf(id);
    const score = idx >= 0 ? (order.length - idx) : 0;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

// ---------- random：乱按（连续抖动 + 随机技能） ----------
function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let dirX = 0; let dirY = 0;
  let tick = 0;
  return (run) => {
    tick += 1;
    if (tick % 15 === 0) {
      const a = rng() * Math.PI * 2;
      dirX = Math.cos(a);
      dirY = Math.sin(a);
    }
    const mv = {
      x: clamp(dirX + (rng() - 0.5) * 0.6, -1, 1),
      y: clamp(dirY + (rng() - 0.5) * 0.6, -1, 1),
    };
    return {
      moveX: mv.x,
      moveY: mv.y,
      swap: rng() < 0.03,
      j: rng() < 0.04,
      k: rng() < 0.03,
      chooseUpgrade: run.phase === 'upgrade' ? Math.floor(rng() * run.upgradeChoices.length) : null,
    };
  };
}

function noinput() {
  return { moveX: 0, moveY: 0, swap: false, j: false, k: false, chooseUpgrade: null };
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
  let prevMoveX = null;
  let prevMoveY = null;
  let prevSwap = false;
  let prevJ = false;
  let prevK = false;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && (run.phase === 'wave' || run.phase === 'upgrade'); tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    const moving = Math.abs(input.moveX || 0) > 0.1 || Math.abs(input.moveY || 0) > 0.1;
    if (firstInputSec < 0 && (moving || input.swap || input.j || input.k)) firstInputSec = sec;

    const moveChanged = moving && (prevMoveX == null || Math.abs(input.moveX - prevMoveX) + Math.abs(input.moveY - prevMoveY) > 0.2);
    const skillChanged = (!!input.swap !== prevSwap) || (!!input.j !== prevJ) || (!!input.k !== prevK);
    if (moveChanged || skillChanged) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !moving && !skillChanged && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    prevMoveX = input.moveX ?? 0;
    prevMoveY = input.moveY ?? 0;
    prevSwap = !!input.swap;
    prevJ = !!input.j;
    prevK = !!input.k;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'kill' && firstSuccessSec < 0) firstSuccessSec = sec;
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }
  }

  const durationSec = run.time;
  return {
    id: `${name}-${seed}`,
    policy: name,
    seed: seed >>> 0,
    durationSec: Math.round(durationSec * 10) / 10,
    actions,
    firstInputSec: firstInputSec < 0 ? -1 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec < 0 ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.phase === 'dead' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.wavesReached || run.wave || 1,
    completed: run.phase === 'win',
    maxWave: run.stats.wavesReached || run.wave || 1,
    kills: run.stats.kills,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
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
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(wave=${r.maxWave},kills=${r.kills},dead=${r.deaths},win=${r.completed},dur=${r.durationSec}s,events=${r.uniqueEvents},gap=${r.maxEventGapSec}s)`).join('  '));
console.log('autoplay.json records:', records.length);
