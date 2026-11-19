// tools/selfplay.mjs — HEROES CHARGE · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
// greedy 策略：冲向最近敌人 → 贴脸出刀 → 被围时冲刺穿越 → 远程用光弹补刀；必须通关 3 关。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 80;

// ---------- greedy：贴脸出刀 + 被围冲刺 + 远程光弹 ----------
function greedyInput(run) {
  const p = run.player;
  const alive = run.enemies.filter((e) => !e.dead);
  // 无敌人（过关过渡期）：继续向前冲锋，保持动作，为下一街区推进
  if (!alive.length) return { left: false, right: true, jump: false, attack: false, dash: false, special: false };

  const nearest = alive.reduce((a, b) => (Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b));
  const dx = nearest.x - p.x;
  const adx = Math.abs(dx);
  const closeCount = alive.filter((e) => Math.abs(e.x - p.x) < 90).length;
  const inp = { left: false, right: false, jump: false, attack: false, dash: false, special: false };

  // 被两个以上敌人贴身 → 冲刺穿越脱困
  if (closeCount >= 2 && p.dashMeter >= 0.25) {
    inp.dash = true;
    inp.right = dx >= 0;
    inp.left = dx < 0;
    return inp;
  }

  if (adx <= 78) {
    inp.attack = true;
  } else if (adx <= 220) {
    inp.right = dx > 0;
    inp.left = dx < 0;
    // 中距离用光弹削血，攒连击
    if (p.onGround && run.projectiles.length < 1 && adx > 110) inp.special = true;
  } else {
    inp.right = dx > 0;
    inp.left = dx < 0;
    if (p.dashMeter >= 0.25) inp.dash = true;
  }

  // 空中二段跳时偶尔来一个旋转斩清群
  if (!p.onGround && p.jumpCount === 2 && closeCount >= 1 && adx <= 96) inp.special = true;
  return inp;
}

// ---------- random：随机乱逛 + 偶尔乱砍（作为基线，不计入成功率） ----------
// 不会冲刺脱困、不会走位，代表「不懂操作乱按」的玩家，会被敌人围殴致死。
function makeRandomStrategy(seed) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  let hold = 'idle';
  let holdT = 0;
  return (run) => {
    const inp = { left: false, right: false, jump: false, attack: false, dash: false, special: false };
    if (holdT <= 0) {
      holdT = 20 + Math.floor(rnd() * 40);
      const r = rnd();
      if (r < 0.3) hold = 'left';
      else if (r < 0.6) hold = 'right';
      else if (r < 0.75) hold = 'idle';
      else if (r < 0.85) hold = 'jump';
      else hold = 'attack';
    }
    holdT -= 1;
    if (hold === 'left') inp.left = true;
    else if (hold === 'right') inp.right = true;
    else if (hold === 'jump') inp.jump = true;
    else if (hold === 'attack') inp.attack = true;
    return inp;
  };
}

function noinput() {
  return { left: false, right: false, jump: false, attack: false, dash: false, special: false };
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
  let prevDir = '0,0';
  let prevAttack = false;
  let prevDash = false;
  let prevJump = false;
  let prevSpecial = false;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    const acted = !!(input.left || input.right || input.jump || input.attack || input.dash || input.special);
    if (firstInputSec < 0 && acted) firstInputSec = sec;

    // 有效操作计数：方向边沿 + 出招/冲刺/跳跃/技能边沿
    const dir = `${input.left ? -1 : input.right ? 1 : 0},0`;
    if (dir !== prevDir) { actions += 1; prevDir = dir; }
    if (input.attack && !prevAttack) actions += 1;
    if (input.dash && !prevDash) actions += 1;
    if (input.jump && !prevJump) actions += 1;
    if (input.special && !prevSpecial) actions += 1;
    prevAttack = !!input.attack;
    prevDash = !!input.dash;
    prevJump = !!input.jump;
    prevSpecial = !!input.special;

    const tickEvents = run.drainEvents();
    const idle = !acted && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if ((e.type === 'enemyDown' || e.type === 'levelClear') && firstSuccessSec < 0) firstSuccessSec = sec;
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
    firstInputSec: firstInputSec < 0 ? 0 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec < 0 ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.phase === 'dead' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.levelsReached,
    completed: run.phase !== 'dead',
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'heroes-charge', genre: 'action', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(111);
const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run) => randomInput(run), seed: 111 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(lv=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,act=${r.actions},ev=${r.uniqueEvents},gap=${r.maxEventGapSec}s,idle=${r.idleSec}s,firstSuccess=${r.firstSuccessSec}s)`).join('  '));
console.log('autoplay.json records:', all.length);
