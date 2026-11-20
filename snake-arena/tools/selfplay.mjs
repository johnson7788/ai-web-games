// SNAKE ARENA · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD, STEP } from '../config/game.config.js';
import { PULSE, SNAKE } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const MAX_SEC = 400;
const INPUT_LATENCY_MS = 90;

function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

// ---------- greedy：吃近食 + 远离蛇头 + 贴墙回中（稳健版，把生存放在吃食之前） ----------
function greedyInput(run) {
  const p = run.player;
  const head = p.segments[0];

  // 危险：所有敌蛇身体/头在 200px 内按 1/d² 聚合出逃逸方向，同时记最近距离
  let rx = 0;
  let ry = 0;
  let minDanger = Infinity;
  for (const s of run.snakes) {
    if (s === p || !s.alive) continue;
    for (let k = 0; k < s.segments.length; k += 1) {
      const dx = head.x - s.segments[k].x;
      const dy = head.y - s.segments[k].y;
      const d = Math.hypot(dx, dy);
      if (d < 200 && d > 0.001) {
        const w = 1 / (d * d);
        rx += (dx / d) * w;
        ry += (dy / d) * w;
        if (d < minDanger) minDanger = d;
      }
    }
  }
  const dangerAngle = (rx !== 0 || ry !== 0) ? Math.atan2(ry, rx) : null;

  // 墙：离墙近就朝中心（顶部额外留 HUD 带余量）
  const m = 180;
  let wallAngle = null;
  if (head.x < m) wallAngle = 0;
  else if (head.x > WORLD.WIDTH - m) wallAngle = Math.PI;
  else if (head.y < m + 20) wallAngle = Math.PI / 2;
  else if (head.y > WORLD.HEIGHT - m) wallAngle = -Math.PI / 2;

  // 最近「安全」食物（离敌蛇身体别太近，也别贴墙太近）
  let food = null;
  let fd = Infinity;
  for (const f of run.foods) {
    const d = (f.x - head.x) * (f.x - head.x) + (f.y - head.y) * (f.y - head.y);
    if (d >= fd) continue;
    if (f.x < 70 || f.x > WORLD.WIDTH - 70 || f.y < 110 || f.y > WORLD.HEIGHT - 70) continue;
    let nearEnemy = false;
    for (const s of run.snakes) {
      if (s === p || !s.alive) continue;
      if ((s.segments[0].x - f.x) * (s.segments[0].x - f.x) + (s.segments[0].y - f.y) * (s.segments[0].y - f.y) < 80 * 80) { nearEnemy = true; break; }
    }
    if (nearEnemy) continue;
    fd = d;
    food = f;
  }
  const foodAngle = food ? Math.atan2(food.y - head.y, food.x - head.x) : null;

  const centerAngle = Math.atan2(WORLD.HEIGHT / 2 - head.y, WORLD.WIDTH / 2 - head.x);
  let aim = p.heading;
  if (wallAngle != null) aim = wallAngle;
  else if (minDanger < 160 && dangerAngle != null) aim = dangerAngle;
  else if (p.segments.length > 34) {
    const dCenter = dist(head.x, head.y, WORLD.WIDTH / 2, WORLD.HEIGHT / 2);
    aim = dCenter > 90 ? centerAngle : p.heading;
  } else if (foodAngle != null) aim = foodAngle;

  // 真实转向模型：手指朝目标连续微调 + 生理震颤（不 settle-and-hold）
  const finger = run._botFinger ?? p.heading;
  let diff = aim - finger;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const toward = Math.max(-0.15, Math.min(0.15, diff));
  const tremor = (run.rng() - 0.5) * 0.3;
  let steer = finger + toward + tremor;
  while (steer > Math.PI) steer -= Math.PI * 2;
  while (steer < -Math.PI) steer += Math.PI * 2;
  run._botFinger = steer;

  const boost = p.segments.length > 26 && p.segments.length <= 34 && minDanger > 230 && fd > 160;
  const pulse = false;
  return { steerAngle: steer, boost, pulse };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let angle = rng() * Math.PI * 2;
  return (run, tick) => {
    if (tick % 30 === 0) angle = rng() * Math.PI * 2;
    return { steerAngle: angle, boost: rng() < 0.1, pulse: false };
  };
}

function noinput() {
  return { steerAngle: null, boost: false, pulse: false };
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
  let prevAngle = null;
  let prevBoost = false;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks; tick += 1) {
    if (run.phase === 'choosing') {
      run.chooseUpgrade(0);
      if (prevAngle != null) actions += 1;
      continue;
    }
    if (run.phase !== 'playing') break;

    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (input.steerAngle != null || input.boost || input.pulse)) firstInputSec = sec;

    const steerChanged = input.steerAngle != null && (prevAngle == null || Math.abs(input.steerAngle - prevAngle) > 0.02);
    const boostToggled = !!input.boost !== prevBoost;
    if (steerChanged || boostToggled || input.pulse) actions += 1;
    const tickEvents = run.drainEvents();
    const idle = !input.boost && !steerChanged && !input.pulse && tickEvents.length === 0;
    if (idle) idleTicks += 1;
    prevAngle = input.steerAngle;
    prevBoost = !!input.boost;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if ((e.type === 'grow' || e.type === 'kill') && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: run.round,
    completed: run.phase === 'won',
    maxLength: run.player ? run.player.segments.length : 0,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ game: 'snake-arena', genre: 'action', runs: records, generatedAt: new Date().toISOString() }, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(round=${r.levelsReached},len=${r.maxLength},dead=${r.deaths},dur=${r.durationSec}s,gap=${r.maxEventGapSec}s)`).join('  '));
console.log('autoplay.json records:', records.length);
