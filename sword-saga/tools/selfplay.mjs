// SWORD SAGA · M1 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
// greedy 策略：克属攻击 + 残血防御蓄势 + 灵狐替身；必须推进到第 3 章。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { HEROES, SKILLS, counterOf, MAP } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- greedy：克属攻击 + 残血防御蓄势 ----------
function bestCounterFor(heroId, targetElement, battle) {
  const hero = HEROES[heroId];
  const need = counterOf(targetElement);
  if (hero.element === need) return { type: 'attack' };
  const unit = battle.byId[heroId];
  for (const sid of hero.skills) {
    const s = SKILLS[sid];
    if (s.element === need && unit.mp >= s.mp) return { type: 'skill', skillId: sid };
  }
  return null;
}

function greedyBattleCommand(run) {
  const b = run.battle;
  if (!b || !b.pending) return null;
  const heroId = b.pending;
  const unit = b.byId[heroId];
  const enemies = b.units.filter((u) => u.side === 'enemy' && u.alive);
  if (!enemies.length) return null;

  // 残血防御蓄势（hero 专属：防御即进攻）
  if (heroId === 'hero' && unit.hp < unit.maxHp * 0.4 && !unit.swordIntent) {
    return { type: 'defend' };
  }
  // 更残血时吃药
  if (unit.hp < unit.maxHp * 0.22 && (run.inventory.herb || 0) > 0) {
    return { type: 'item', itemId: 'herb' };
  }

  // 优先打「本角色能克制」的敌人；否则打最残的
  let target = null;
  let counter = null;
  for (const e of enemies) {
    const c = bestCounterFor(heroId, e.element, b);
    if (c) { target = e; counter = c; break; }
  }
  if (!target) {
    target = enemies.slice().sort((a, b2) => a.hp - b2.hp)[0];
  }
  if (!counter) {
    // 自己克不了 → 换人（另一主角若能克）
    const other = heroId === 'hero' ? 'fox' : 'hero';
    if (!(other === 'fox' && b.foxCooldown > 0) && b.byId[other]?.alive) {
      const otherC = bestCounterFor(other, target.element, b);
      if (otherC) return { type: 'switch' };
    }
    // 有蓄势就放技能（×2），否则普攻
    if (unit.swordIntent) {
      const anySkill = HEROES[heroId].skills.find((sid) => unit.mp >= SKILLS[sid].mp);
      if (anySkill) return { type: 'skill', skillId: anySkill, target: target.id };
    }
    counter = { type: 'attack' };
  }
  if (counter.type === 'skill') return { ...counter, target: target.id };
  return { type: 'attack', target: target.id };
}

function greedyInput(run, tick) {
  if (run.mode === 'battle') {
    return { menu: greedyBattleCommand(run) };
  }
  if (run.mode === 'dialog') {
    return { advance: true };
  }
  if (run.mode === 'map') {
    const target = run.map.openingDone ? MAP.door : MAP.npc;
    const dx = target.x - run.map.px;
    const dy = target.y - run.map.py;
    const dir = {
      x: Math.abs(dx) > 0.2 ? Math.sign(dx) : 0,
      y: Math.abs(dy) > 0.2 ? Math.sign(dy) : 0,
    };
    return { dir };
  }
  return {};
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 0, y: 0 }];
  let dir = dirs[0];
  const menus = [{ type: 'attack' }, { type: 'defend' }, { type: 'switch' }, { type: 'item', itemId: 'herb' }];
  return (run, tick) => {
    if (tick % 24 === 0) dir = dirs[Math.floor(rng() * dirs.length)];
    if (run.mode === 'battle') {
      return run.battle?.pending ? { menu: menus[Math.floor(rng() * menus.length)] } : {};
    }
    if (run.mode === 'dialog') return { advance: rng() < 0.6 };
    if (run.mode === 'map') return { dir };
    return {};
  };
}

function noinput() { return {}; }

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
  let prevDir = null;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    const acted = !!(input.dir && (input.dir.x || input.dir.y)) || !!input.menu || !!input.advance;
    if (firstInputSec < 0 && acted) firstInputSec = sec;

    // 有效操作计数：菜单命令 / 对话推进 / 方向边沿变化
    if (input.menu) actions += 1;
    else if (input.advance) actions += 1;
    else if (input.dir) {
      const d = (input.dir.x || 0) + ',' + (input.dir.y || 0);
      if (d !== prevDir) { actions += 1; prevDir = d; }
    } else if (prevDir !== '0,0') { prevDir = '0,0'; actions += 1; }

    const tickEvents = run.drainEvents();
    const idle = !acted && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'victory' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: run.chapter,
    completed: run.phase !== 'dead',
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'sword-saga', genre: 'narrative', runs: records, generatedAt: new Date().toISOString() };
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
console.log('strategies:', records.map((r) => `${r.policy}(ch=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,act=${r.actions},ev=${r.uniqueEvents},gap=${r.maxEventGapSec}s,idle=${r.idleSec}s)`).join('  '));
console.log('autoplay.json records:', all.length);
