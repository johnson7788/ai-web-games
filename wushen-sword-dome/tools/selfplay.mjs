// WUSHEN SWORD DOME · 自对弈（bot 遥测）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun } from '../src/game/sim.js';
import { WORLD, STEP } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const MAX_SEC = 120;

function makeTracker(run, policy, seed) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    seen: new Set(),
    eventTimes: [0],
    step(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'hit' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
      return res;
    },
  };
}

function finish(tel, run) {
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
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.stage,
    completed: run.state.phase === 'won',
  };
}

function incomingProjectile(run) {
  for (const p of run.state.projectiles) {
    if (p.owner !== 'other' || p.dead || p.lag > 0) continue;
    const dist = Math.abs(p.endX - p.startX);
    const x = p.startX + p.dir * p.t * dist;
    if (Math.abs(x - WORLD.SELF_X) < 300) return true;
  }
  return false;
}

function bestWeapon(run) {
  let best = -1;
  let bestAtk = -1;
  run.state.selfWeapons.forEach((w, i) => {
    if (w.cdLeft <= 0 && run.state.self.mp >= w.cost && w.attack > bestAtk) {
      best = i;
      bestAtk = w.attack;
    }
  });
  return best;
}

function skillReady(run, n) {
  const s = run.state.selfSkills[n];
  return s && s.cdLeft <= 0 && run.state.self.mp >= s.cost;
}

// greedy：闪避 + 回血 + 大招 + 最高伤害兵器，稳定通关三连战
function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  const maxSteps = MAX_SEC * 60;
  for (let s = 0; s < maxSteps; s += 1) {
    if (run.state.phase !== 'playing') break;
    if (incomingProjectile(run) && run.state.selfDodge.cdLeft <= 0) {
      tel.act(() => run.playerDodge());
    } else if (run.state.self.hp < run.state.self.maxHp * 0.55 && skillReady(run, 1)) {
      tel.act(() => run.playerUseSkill(1));
    } else if (skillReady(run, 0)) {
      tel.act(() => run.playerUseSkill(0));
    } else {
      const i = bestWeapon(run);
      if (i >= 0) tel.act(() => run.playerLaunchWeapon(i));
    }
    tel.step(STEP);
  }
  return finish(tel, run);
}

// random：乱按，验证输入鲁棒（会输，提供死亡样本）
function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const maxSteps = MAX_SEC * 60;
  let nextAct = 0.3;
  for (let s = 0; s < maxSteps; s += 1) {
    if (run.state.phase !== 'playing') break;
    if (tel.simTime >= nextAct) {
      const roll = Math.random();
      if (roll < 0.55) tel.act(() => run.playerLaunchWeapon(Math.floor(Math.random() * 3)));
      else if (roll < 0.75) tel.act(() => run.playerDodge());
      else if (roll < 0.9) tel.act(() => run.playerUseSkill(Math.floor(Math.random() * 2)));
      else tel.act(() => run.playerLaunchWeapon(0));
      nextAct = tel.simTime + 0.3 + Math.random() * 0.5;
    }
    tel.step(STEP);
  }
  return finish(tel, run);
}

// noinput：只推进时间，测死时间/自动推进基线（会被击败）
function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  const maxSteps = MAX_SEC * 60;
  for (let s = 0; s < maxSteps; s += 1) {
    if (run.state.phase !== 'playing') break;
    tel.step(STEP);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'wushen-sword-dome',
  genre: 'action',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
