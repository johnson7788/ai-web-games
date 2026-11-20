// STAR SLAYER · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;
const W = 1280;
const H = 720;

function nearestEnemy(run) {
  let best = null;
  let bestD = Infinity;
  for (const e of run.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - run.player.x, e.y - run.player.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

// greedy：贴身后撤打提前量——持续开火，朝远离最近敌人 + 场地中心偏移的方向拉扯；
// 敌人近身时相位同步躲闪；血量告急时超载清屏。
function greedyInput(run) {
  const p = run.player;
  const nearest = nearestEnemy(run);
  let mx = 0;
  let my = 0;
  if (nearest) {
    const d = Math.hypot(nearest.x - p.x, nearest.y - p.y) || 1;
    const ax = (p.x - nearest.x) / d;
    const ay = (p.y - nearest.y) / d;
    const cx = W / 2 - p.x;
    const cy = H / 2 - p.y;
    const cl = Math.hypot(cx, cy) || 1;
    const centerPull = Math.min(0.7, cl / 380);
    let vx = ax * (1 - centerPull) + (cx / cl) * centerPull;
    let vy = ay * (1 - centerPull) + (cy / cl) * centerPull;
    const m = Math.hypot(vx, vy) || 1;
    mx = vx / m;
    my = vy / m;
  }
  // 人类运动噪声：连续微调（保证操作密度与真实手感）
  run._botTick = (run._botTick ?? 0) + 1;
  mx += (run.rng() - 0.5) * 0.16;
  my += (run.rng() - 0.5) * 0.16;
  mx = Math.max(-1, Math.min(1, mx));
  my = Math.max(-1, Math.min(1, my));

  let sync = false;
  if (nearest) {
    const d = Math.hypot(nearest.x - p.x, nearest.y - p.y);
    if (d < 95 && run.syncCd <= 0 && run.core.online) sync = true;
  }
  let skill = false;
  if (run.core.online && run.player.hp / run.player.maxHp < 0.35) skill = true;

  return { mx, my, fire: true, skill, sync };
}

function pickCard(run) {
  if (!run.cardOffer || !run.cardChoices.length) return;
  let idx = run.cardChoices.findIndex((c) => c.kind === 'rule');
  if (idx < 0) idx = 0;
  run.chooseCard(idx);
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let mx = 0;
  let my = 0;
  return (run, tick) => {
    if (tick % 24 === 0) {
      mx = (rng() - 0.5) * 2;
      my = (rng() - 0.5) * 2;
    }
    const fire = rng() < 0.55;
    let sync = false;
    if (tick % 90 === 0) sync = true;
    return { mx, my, fire, skill: false, sync };
  };
}

function noinput() {
  return { mx: 0, my: 0, fire: false, skill: false, sync: false };
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
  let prevMx = 0;
  let prevMy = 0;
  let prevFire = false;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    if (run.cardOffer) pickCard(run);
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    const fired = !!input.fire;
    const moved = Math.abs((input.mx || 0) - prevMx) > 0.05 || Math.abs((input.my || 0) - prevMy) > 0.05;
    const toggled = fired !== prevFire || !!input.skill || !!input.sync;
    const acted = moved || toggled || fired;
    if (firstInputSec < 0 && acted) firstInputSec = sec;
    if (acted) actions += 1;
    prevMx = input.mx || 0;
    prevMy = input.my || 0;
    prevFire = fired;

    const tickEvents = run.drainEvents();
    const idle = !acted && tickEvents.length === 0;
    if (idle) idleTicks += 1;

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
    levelsReached: run.stats.waveReached || run.wave || 1,
    completed: run.phase === 'won',
    wave: run.wave,
    kills: run.stats.kills,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

// ---------- 写文件 ----------
function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(wave=${r.wave},dead=${r.deaths},dur=${r.durationSec}s,kills=${r.kills})`).join('  '));
console.log('autoplay.json records:', all.length);
