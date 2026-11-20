// tools/selfplay.mjs — 无头自玩：3 策略（greedy/random/noinput）各跑一局远征
// 直接 node 循环 step（不需要 playwright），遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { HERO_IDS } from '../config/gameplay.js';
import { nodeById } from '../config/levels.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- greedy：打弱节点 + 残血休整；战斗内军势→合击、低血治疗、技能优先 ----------
function greedyInput(run, tick) {
  if (tick < 20) return {}; // 人类反应延迟 ~0.33s
  const m = run.mode;
  if (m === 'formation') return { confirmFormation: ['vanguard', 'ranger', 'seer'] };
  if (m === 'map') return { chooseNode: pickNode(run, true) };
  if (m === 'battle') return battleAction(run, true);
  if (m === 'event') return { choice: pickEventChoice(run) };
  if (m === 'rest') return { continue: true };
  if (m === 'upgrade') return { upgrade: pickUpgrade(run) };
  return {};
}

function pickNode(run, smart) {
  const choices = run.choices;
  if (!choices.length) return null;
  if (!smart) return choices[Math.floor(run.rng() * choices.length)];
  // 残血 → 优先休整；否则优先战斗（抢粮草/推进）
  const anyLow = run.heroes.some((h) => h.alive && h.hp < h.maxHp * 0.45);
  const prefer = anyLow ? 'rest' : 'battle';
  for (const want of [prefer, 'rest', 'battle', 'event', 'elite', 'boss']) {
    const hit = choices.find((id) => nodeById(id)?.type === want);
    if (hit) return hit;
  }
  return choices[0];
}

function battleAction(run, smart) {
  const b = run.battle;
  if (!b || !b.waiting) return {};
  const pending = b.units.find((u) => u.id === b.pending);
  if (!pending) return {};
  if (run.signature >= run.signatureMax) return { action: { skill: 'signature' } };

  if (smart) {
    const low = run.heroes.find((h) => h.alive && h.hp < h.maxHp * 0.45);
    if (pending.id === 'seer' && low && pending.skillCd.heal === 0) return { action: { skill: 'heal', target: low.id } };
    const dmg = (pending.skills || []).find((s) => (s.kind === 'aoe' || s.kind === 'multi') && pending.skillCd[s.id] === 0);
    const enemies = b.units.filter((u) => u.side === 'enemy' && u.alive).sort((a, c) => a.hp - c.hp);
    if (dmg && enemies.length) return { action: { skill: dmg.id } };
    if (enemies.length) return { action: { skill: 'basic', target: enemies[0].id } };
    return {};
  }

  // 乱按：随机技能 + 随机目标
  const enemies = b.units.filter((u) => u.side === 'enemy' && u.alive);
  const heroes = b.units.filter((u) => u.side === 'hero' && u.alive);
  const pool = ['basic', ...(pending.skills || []).map((s) => s.id)];
  if (run.rng() < 0.2 && run.signature >= run.signatureMax) return { action: { skill: 'signature' } };
  const skill = pool[Math.floor(run.rng() * pool.length)];
  if (skill === 'heal') return { action: { skill: 'heal', target: heroes[Math.floor(run.rng() * heroes.length)]?.id } };
  if (skill === 'basic' || skill === 'mark') return { action: { skill, target: enemies[Math.floor(run.rng() * enemies.length)]?.id } };
  return { action: { skill } };
}

function pickEventChoice(run) {
  const ev = run.event;
  if (!ev) return 0;
  // 粮草低选粮草，血低选治疗，否则选军势
  const idx = ev.choices.findIndex((c) => run.supplies < 4 && c.effect.supplies > 0);
  if (idx >= 0) return idx;
  const heal = ev.choices.findIndex((c) => c.effect.healPct && run.heroes.some((h) => h.alive && h.hp < h.maxHp * 0.6));
  if (heal >= 0) return heal;
  return 0;
}

function pickUpgrade(run) {
  const rule = run.upgradeChoices.find((id) => ['vanguardBulwark', 'backlineAegis', 'rangerRapid', 'seerOverflow', 'signatureFervor', 'supplyRaider', 'starvingVigor', 'firstStrike'].includes(id));
  return rule || run.upgradeChoices[0];
}

function randomInput(run, tick) {
  if (tick < 30) return {};
  const m = run.mode;
  if (m === 'formation') {
    const order = [...HERO_IDS].sort(() => run.rng() - 0.5);
    return { confirmFormation: order };
  }
  if (m === 'map') return { chooseNode: pickNode(run, false) };
  if (m === 'battle') return battleAction(run, false);
  if (m === 'event') return { choice: Math.floor(run.rng() * (run.event ? run.event.choices.length : 1)) };
  if (m === 'rest') return { continue: true };
  if (m === 'upgrade') return { upgrade: run.upgradeChoices[Math.floor(run.rng() * run.upgradeChoices.length)] };
  return {};
}

function noinput() { return {}; }

// ---------- 跑一局 ----------
// 空转（idle）按「死时间」衡量：两次可感知反馈（事件或有效操作）之间超过 1s 的
// 间隔才累计为空转。回合制里速度条/敌方回合是持续反馈，不因 60Hz 逐 tick 无事件而算空转。
const IDLE_GAP = 1.0;

function play(name, inputFor, seed) {
  const run = createRun({ seed });
  const maxTicks = Math.round(MAX_SEC / STEP);
  let firstInputSec = -1;
  let firstSuccessSec = null;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleSec = 0;
  let lastActivitySec = 0;
  let hadInput = false;

  const noteActivity = (sec) => {
    if (sec - lastActivitySec > IDLE_GAP) idleSec += (sec - lastActivitySec - IDLE_GAP);
    lastActivitySec = sec;
  };

  for (let tick = 0; tick < maxTicks && run.mode !== 'victory' && run.mode !== 'defeat'; tick += 1) {
    const input = inputFor(run, tick) || {};
    const secBefore = run.time;
    run.step(input);
    const sec = run.time;

    const acted = !!(input.confirmFormation || input.chooseNode || input.action || input.choice != null || input.upgrade || input.continue);
    if (acted) {
      actions += 1;
      noteActivity(secBefore);
      if (!hadInput) { firstInputSec = secBefore; hadInput = true; }
    }

    const events = run.drainEvents();
    if (events.length) noteActivity(sec);

    for (const e of events) {
      eventKinds.add(e.type);
      if ((e.type === 'battleWin' || e.type === 'victory') && firstSuccessSec === null) firstSuccessSec = sec;
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }
  }

  const durationSec = run.time;
  if (durationSec - lastActivitySec > IDLE_GAP) idleSec += (durationSec - lastActivitySec - IDLE_GAP);

  return {
    id: `${name}-${seed}`,
    policy: name,
    seed: seed >>> 0,
    durationSec: Math.round(durationSec * 10) / 10,
    actions,
    firstInputSec: firstInputSec < 0 ? -1 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec === null ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.mode === 'defeat' ? 1 : 0,
    idleSec: Math.round(idleSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.levelsReached,
    completed: run.mode === 'victory',
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'heroes-quest', genre: 'puzzle', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const strategies = [
  { name: 'greedy', inputFor: (r, t) => greedyInput(r, t), seed: 123 },
  { name: 'random', inputFor: (r, t) => randomInput(r, t), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(nodes=${r.levelsReached},deaths=${r.deaths},win=${r.completed},dur=${r.durationSec}s,actions=${r.actions},events=${r.uniqueEvents})`).join('  '));
