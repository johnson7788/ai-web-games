// CHEF MARIE SERVE · 自对弈（Node 无头，直接 import sim，无 DOM）。
// 用固定 seed 驱动 greedy / random / noinput 三策略，串行打 L1→L2→L3，
// 写出 tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
import { createRun, mulberry32 } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function newTel(policy, seed) {
  return {
    id: `${policy}-1`, policy, seed,
    simTime: 0, firstInputAt: null, firstSuccessAt: null,
    deaths: 0, actions: 0, seen: new Set(), eventTimes: [0], levelReached: 1,
  };
}

function drain(tel, run) {
  for (const e of run.drainEvents()) {
    tel.seen.add(e.type);
    tel.eventTimes.push(tel.simTime);
    if (e.type === 'win' && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
    if (e.type === 'death') tel.deaths += 1;
  }
}

function finish(tel, run, completed) {
  const times = tel.eventTimes.slice().sort((a, b) => a - b);
  let maxGap = 0;
  let idleSec = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
    if (gap > 3) idleSec += gap - 3;
  }
  return {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: tel.levelReached,
    completed,
  };
}

// ---------------- greedy：贴地向右跑，遇到缺口/敌人/危害/食材就跳 ----------------
function groundAt(st, x) {
  return st.platforms.some((p) => p.y === 560 && x >= p.x && x <= p.x + p.w);
}

function decideJump(st) {
  const p = st.player;
  if (!p.onGround) return false;
  const right = p.x + p.w;
  // 贴地向右跑；在离危险足够近、但又有完整起跳跑道时才跳。
  // 走地食材/香料会自然被「跑过」收集，不需要跳；悬空食材是奖励分，跳过也不影响过关。
  if (!groundAt(st, right + 40)) return true; // 缺口（40px 提前量，避免跳太早落回坑里）
  if (st.enemies.some((e) => e.alive && e.kind === 'rat' && e.x > p.x && e.x < p.x + 170)) return true;
  if (st.enemies.some((e) => e.alive && e.kind === 'fly' && e.x > p.x && e.x < p.x + 200)) return true;
  if (st.hazards.some((h) => h.x > p.x && h.x < p.x + 200)) return true;
  return false;
}

function greedyOnce(run, tel) {
  const st = run.state;
  let steps = 0;
  while (st.phase === 'playing' && steps < 3600) {
    const jump = decideJump(st);
    st.input.right = true;
    st.input.left = false;
    st.input.jump = jump;
    if (jump) {
      tel.actions += 1;
      if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
    }
    run.step(1 / 60);
    tel.simTime += 1 / 60;
    drain(tel, run);
    steps += 1;
  }
  return st.phase === 'won';
}

function greedy(seed) {
  const tel = newTel('greedy', seed);
  let completed = false;
  for (let li = 0; li < 3; li += 1) {
    const run = createRun(li, { seed: seed + li * 7 });
    const won = greedyOnce(run, tel);
    if (!won) { completed = false; break; }
    completed = true;
    tel.levelReached = li + 2; // 已开始下一关（1 基）
  }
  // 完成三关后，levelReached 停在 3
  tel.levelReached = Math.min(3, completed ? 3 : tel.levelReached);
  return finish(tel, null, completed);
}

// ---------------- random：一路向右，低概率跳（验证会死/输入鲁棒） ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = newTel('random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 30;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const jump = rng() < 0.12;
    run.state.input.right = true;
    run.state.input.left = false;
    run.state.input.jump = jump;
    if (jump) {
      tel.actions += 1;
      if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
    }
    run.step(1 / 60);
    tel.simTime += 1 / 60;
    drain(tel, run);
  }
  return finish(tel, run, run.state.phase === 'won');
}

// ---------------- noinput：只推进时间（基线） ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = newTel('noinput', seed);
  const MAX_SEC = 30;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    run.step(1 / 60);
    tel.simTime += 1 / 60;
    drain(tel, run);
  }
  return finish(tel, run, run.state.phase === 'won');
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'chef-marie-serve',
  genre: 'default',
  source: 'bot',
  version: 'm1',
  runs,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${OUT} (${runs.length} runs)`);
for (const r of runs) {
  console.log(
    `${r.id.padEnd(10)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed} ` +
    `events=${r.uniqueEvents} gap=${r.maxEventGapSec}s idle=${r.idleSec}s`,
  );
}
