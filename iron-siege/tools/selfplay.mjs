// IRON SIEGE · M1 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { STEP } from '../config/game.config.js';
import { DIR, CELL, MAP } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;
const BLOCK = MAP.BLOCK;

// ---------- 策略 ----------
function anyInput(input) {
  return !!(input.up || input.down || input.left || input.right || input.fire || input.heavy || input.aimDir != null);
}

function dodgeThreat(run) {
  const p = run.player;
  for (const b of run.enemyBullets) {
    if (Math.abs(b.x - p.x) < 9) {
      const dy = b.y - p.y;
      const toward = (b.dir === DIR.UP && dy < 0 && dy > -28) || (b.dir === DIR.DOWN && dy > 0 && dy < 28);
      if (toward) return 'side';
    }
    if (Math.abs(b.y - p.y) < 9) {
      const dx = b.x - p.x;
      const toward = (b.dir === DIR.RIGHT && dx < 0 && dx > -28) || (b.dir === DIR.LEFT && dx > 0 && dx < 28);
      if (toward) return 'side';
    }
  }
  return null;
}

function hasSteelBetween(run, p, t) {
  if (Math.abs(t.x - p.x) < 10) {
    const col = Math.floor(p.x / BLOCK);
    const r0 = Math.min(p.y, t.y);
    const r1 = Math.max(p.y, t.y);
    for (let r = Math.floor(r0 / BLOCK); r <= Math.floor(r1 / BLOCK); r += 1) {
      if (run.grid[r][col] === CELL.STEEL) return true;
    }
  } else if (Math.abs(t.y - p.y) < 10) {
    const row = Math.floor(p.y / BLOCK);
    const c0 = Math.min(p.x, t.x);
    const c1 = Math.max(p.x, t.x);
    for (let c = Math.floor(c0 / BLOCK); c <= Math.floor(c1 / BLOCK); c += 1) {
      if (run.grid[row][c] === CELL.STEEL) return true;
    }
  }
  return false;
}

function greedyInput(run) {
  const p = run.player;
  const input = { up: false, down: false, left: false, right: false, fire: false, heavy: false, aimDir: null };
  if (!p.alive) return input;

  const enemies = run.enemies.filter((e) => e.alive && !e.spawning);

  // 目标：最低的敌人（离熔炉最近，威胁最大）
  let target = null;
  for (const e of enemies) if (!target || e.y < target.y) target = e;

  if (!target) {
    input.up = true;
    input.aimDir = DIR.UP;
    return input;
  }

  // 卡死检测
  if (greedyState.prevX != null && Math.abs(p.x - greedyState.prevX) < 0.5 && Math.abs(p.y - greedyState.prevY) < 0.5) {
    greedyState.stuck += 1;
  } else {
    greedyState.stuck = 0;
  }
  greedyState.prevX = p.x;
  greedyState.prevY = p.y;

  // 躲弹：横向闪避
  if (dodgeThreat(run)) {
    input.left = p.x > 104;
    input.right = p.x <= 104;
    return input;
  }

  const dx = target.x - p.x;
  const dy = target.y - p.y;

  // 逃出熔炉口袋：先在出生走廊上升到开阔区，再横向机动
  if (p.y < 40 && Math.abs(dx) > 24) {
    input.up = true;
    input.fire = true;
    input.aimDir = DIR.UP;
    return input;
  }

  // 卡死：向上脱困（走廊上方始终通畅）
  if (greedyState.stuck > 45) {
    input.up = p.y < 150;
    input.down = p.y >= 150;
    input.fire = true;
    input.aimDir = DIR.UP;
    return input;
  }

  if (Math.abs(dx) > 10) {
    // 先对齐目标列
    if (dx > 0) input.right = true;
    else input.left = true;
  } else {
    // 同列：贴近再开火，命中率优先
    input.aimDir = dy >= 0 ? DIR.UP : DIR.DOWN;
    input.fire = Math.abs(dy) < 88;
    if (dy < -8) input.down = true;               // 敌人在下方（近熔炉），下压拦截
    else if (dy > 8 && p.y < 80) input.up = true; // 向上迎击，但不高过 80
    else if (p.y > 56) input.down = true;         // 太高则回撤防守
    // 否则原地驻守
  }

  // 重炮：中间隔着钢墙时开火
  if (run.heavy > 0 && hasSteelBetween(run, p, target)) {
    input.fire = false;
    input.heavy = true;
  }

  return input;
}

const greedyState = { prevX: null, prevY: null, stuck: 0 };

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let dir = 'up';
  return (run, tick) => {
    if (tick % 40 === 0) {
      const r = rng();
      dir = r < 0.25 ? 'up' : r < 0.5 ? 'down' : r < 0.75 ? 'left' : 'right';
    }
    const input = { up: dir === 'up', down: dir === 'down', left: dir === 'left', right: dir === 'right', fire: rng() < 0.35, heavy: rng() < 0.05 };
    return input;
  };
}

function noinput() {
  return { up: false, down: false, left: false, right: false, fire: false, heavy: false };
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
  let totalTicks = 0;
  let prevSig = null;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && anyInput(input)) firstInputSec = sec;

    const sig = `${input.up}|${input.down}|${input.left}|${input.right}|${input.fire}|${input.heavy}`;
    if (prevSig !== null && sig !== prevSig) actions += 1;
    prevSig = sig;

    const tickEvents = run.drainEvents();
    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if ((e.type === 'shot' || e.type === 'shotHeavy') && firstInputSec >= 0) actions += 1; // 每次开火算一次离散操作
      if (e.type === 'kill' && firstSuccessSec < 0) firstSuccessSec = sec;
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }

    const idle = !anyInput(input) && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    if (run.pendingUpgrade) pickUpgrade(run, name);
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
    levelsReached: run.stats.maxWave || run.wave || 1,
    completed: run.phase === 'win',
    maxWave: run.stats.maxWave || run.wave,
    score: run.score,
    kills: run.stats.kills,
  };
}

function pickUpgrade(run, policy) {
  if (!run.pendingUpgrade) return;
  if (policy === 'random') {
    run.chooseUpgrade(Math.floor(run.rng() * run.pendingUpgrade.length));
    return;
  }
  const prefer = ['firepower', 'ammo', 'speed', 'armor'];
  let idx = 0;
  for (const p of prefer) {
    const i = run.pendingUpgrade.findIndex((o) => o.id === p);
    if (i >= 0) { idx = i; break; }
  }
  run.chooseUpgrade(idx);
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ runs: records, generatedAt: new Date().toISOString() }, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: greedyInput, seed: 123 },
  { name: 'random', inputFor: randomInput, seed: 456 },
  { name: 'noinput', inputFor: noinput, seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(wave=${r.maxWave},dead=${r.deaths},score=${r.score},dur=${r.durationSec}s)`).join('  '));
console.log('autoplay.json records:', all.length);
