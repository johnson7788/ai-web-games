// src/game/sim.js — DICE CASCADE 玩法核心（纯逻辑，零 DOM/零依赖）
// 契约：docs/analysis.md + config/design.json。run 暴露 step/toggleBet/setBets/roll/bank/getHud/drainEvents。
import {
  DICE, BET, BOARD, ROLL_SETTLE_SEC, AUTO_ROLL_SEC, TRIPLE_BONUS, LUCKY, RUNES,
  clamp, faceToLane,
} from '../../config/gameplay.js';
import { STAGES, stageAt } from '../../config/levels.js';
import { mulberry32, randInt } from './rng.js';
import { resolveBead } from './board.js';

// ---------- 创建 run ----------
export function createRun({ seed = 0, runeLevel = 0, autoRoll = true } = {}) {
  const rng = mulberry32(seed);
  const lvl = clamp(Math.floor(Number(runeLevel) || 0), 0, RUNES.MAX_LEVEL);

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',          // playing | dead | won
    time: 0,
    stageIndex: 0,
    score: 0,                  // 已锁定总分（跨关累计）
    pot: 0,                    // 本关未锁定分（可被诅咒/押注消耗）
    rollsLeft: 0,
    diceCount: 1,
    betSel: [],                // 已押的骰位下标
    rolling: false,
    rollReadyAt: 0,
    lastInputAt: 0,
    lastRoll: null,
    runeShards: 0,
    runeLevel: lvl,
    won: false,
    autoRoll: autoRoll !== false,
    scene: 1,
    stats: { score: 0, stageReached: 1, stagesCleared: 0, rolls: 0, triples: 0, maxPot: 0 },
    events: [],
    pending: [],               // 定时视觉事件 { at, type, fields }
    _lastHeartbeatSec: 0,
    _cursedWardUsed: false,
  };

  beginStage(run, 0);

  run.step = (input) => step(run, input);
  run.toggleBet = (i) => toggleBet(run, i);
  run.setBets = (arr) => setBets(run, arr);
  run.roll = () => roll(run);
  run.bank = () => bank(run);
  run.jump = (n) => beginStage(run, n - 1);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// ---------- 每 tick（固定步长） ----------
function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  run.time += 1 / 60;
  flushPending(run);
  finishTurnIfReady(run);

  const sec = Math.floor(run.time);
  if (sec > run._lastHeartbeatSec) {
    run._lastHeartbeatSec = sec;
    emit(run, 'heartbeat', { sec });
  }

  if (run.autoRoll && !run.rolling && run.rollsLeft > 0 && run.phase === 'playing'
      && (run.time - run.lastInputAt) >= AUTO_ROLL_SEC) {
    roll(run);
  }
}

// ---------- 关卡推进 ----------
function cfg(run) {
  return stageAt(run.stageIndex);
}

function runeHas(run, id) {
  const idx = RUNES.LEVELS.findIndex((l) => l.id === id);
  return idx >= 0 && run.runeLevel >= idx + 1;
}

function beginStage(run, idx) {
  run.stageIndex = clamp(idx, 0, STAGES.length - 1);
  const c = cfg(run);
  run.diceCount = c.diceCount;
  run.rollsLeft = c.rollsMax + (runeHas(run, 'extraRoll') ? 1 : 0);
  run.betSel = [];
  run.rolling = false;
  run.rollReadyAt = 0;
  run.lastRoll = null;
  run._cursedWardUsed = false;
  run.pot = runeHas(run, 'strongStart') ? 30 : 0;
  run.scene = c.scene;
  run.stats.stageReached = Math.max(run.stats.stageReached, idx + 1);
  emit(run, 'stageStart', { stage: idx + 1, target: c.target, scene: c.scene, diceCount: c.diceCount });
}

// ---------- 押注 ----------
function setBets(run, arr) {
  if (run.phase !== 'playing' || run.rolling) return false;
  const c = cfg(run);
  const uniq = [...new Set((arr || []).filter((i) => Number.isInteger(i) && i >= 0 && i < run.diceCount))];
  if (uniq.length * c.betCost > run.pot) return false;
  run.betSel = uniq;
  run.lastInputAt = run.time;
  emit(run, 'betToggle', { slots: run.betSel.slice(), count: run.betSel.length });
  return true;
}

function toggleBet(run, i) {
  if (run.phase !== 'playing' || run.rolling) return false;
  if (!Number.isInteger(i) || i < 0 || i >= run.diceCount) return false;
  const next = run.betSel.includes(i) ? run.betSel.filter((x) => x !== i) : [...run.betSel, i];
  const c = cfg(run);
  if (next.length * c.betCost > run.pot) return false;
  run.betSel = next;
  run.lastInputAt = run.time;
  emit(run, 'betToggle', { slots: run.betSel.slice(), count: run.betSel.length });
  return true;
}

// ---------- 掷骰 + 弹珠落桶 ----------
function roll(run) {
  if (run.phase !== 'playing' || run.rolling || run.rollsLeft <= 0) return false;
  const c = cfg(run);
  const cost = run.betSel.length * c.betCost;
  if (cost > run.pot) return false;

  run.lastInputAt = run.time;
  run.pot -= cost;
  run.stats.rolls += 1;
  run.rolling = true;
  run.rollReadyAt = run.time + ROLL_SETTLE_SEC;

  // 1) 掷骰（公平、可 seed）
  const faces = [];
  for (let d = 0; d < run.diceCount; d += 1) faces.push(randInt(run.rng, 1, DICE.SIDES));

  // 2) 骰面 → 入珠区 → 落桶
  const beads = faces.map((face) => {
    const lane = faceToLane(face);
    const { bucket, bounces } = resolveBead(lane, run.rng);
    const mult = BOARD.BUCKET_MULT[bucket];
    let faceValue = face;
    if (c.cursed && face === DICE.CURSED_FACE) {
      if (runeHas(run, 'cursedWard') && !run._cursedWardUsed) {
        run._cursedWardUsed = true;
        faceValue = 0; // 本关第一次诅咒被抵消
      } else {
        faceValue = c.cursedValue;
      }
    }
    return { face, lane, bucket, bounces, mult, faceValue };
  });

  // 3) 幸运轮
  let luckyBonus = 0;
  if (c.lucky && run.rng() < LUCKY.CHANCE) {
    luckyBonus = randInt(run.rng, LUCKY.BONUS_MIN, LUCKY.BONUS_MAX);
    if (runeHas(run, 'luckyCharm')) luckyBonus *= 2;
  }

  // 4) 基础收益
  const gain = beads.reduce((s, b) => s + b.faceValue * b.mult, 0) + luckyBonus;

  // 5) 三连符文（signature）：需要 3 颗骰同面
  const triple = faces.length >= 3 && faces.every((f) => f === faces[0]);
  let tripleBonus = 0;
  if (triple) {
    tripleBonus = TRIPLE_BONUS;
    if (runeHas(run, 'tripleBoost')) tripleBonus *= 2;
    run.stats.triples += 1;
  }

  // 6) 押注命中倍率（押中 1 → ×2，≥2 → ×3）
  const hits = run.betSel.filter((i) => faces[i] >= DICE.WIN_FACE_MIN).length;
  const betMult = betMultFor(hits);

  // 7) 押注返还
  let rebate = 0;
  if (hits > 0 && runeHas(run, 'betRebate')) rebate = Math.round(cost * 0.2);

  // 8) 符文碎片（中央桶）
  let shards = 0;
  for (const b of beads) {
    if (b.bucket === BOARD.RUNE_BUCKET) shards += 1 + (runeHas(run, 'runeAffinity') ? 1 : 0);
  }

  const total = Math.round((gain * betMult) + tripleBonus + rebate);
  run.pot = Math.max(0, run.pot + total);
  run.stats.maxPot = Math.max(run.stats.maxPot, run.pot);

  let runeUp = false;
  if (shards > 0) {
    run.runeShards += shards;
    if (run.runeShards >= RUNES.SHARDS_PER_LEVEL && run.runeLevel < RUNES.MAX_LEVEL) {
      run.runeShards -= RUNES.SHARDS_PER_LEVEL;
      run.runeLevel += 1;
      runeUp = true;
    }
  }

  run.rollsLeft -= 1;
  run.lastRoll = {
    faces, beads, betMult, hits, total, triple, tripleBonus, luckyBonus, rebate, shards, cost,
    startTime: run.time, runeUp,
  };

  emit(run, 'rollStart', { faces: faces.slice(), diceCount: run.diceCount, betCount: run.betSel.length });
  if (hits > 0) emit(run, 'betHit', { hits, betMult });

  beads.forEach((b, i) => {
    schedule(run, run.time + 0.3 + i * 0.28, 'beadSettled', { die: i, face: b.face, bucket: b.bucket, gain: b.faceValue * b.mult });
  });
  if (luckyBonus > 0) schedule(run, run.time + 0.5, 'luckyWheel', { bonus: luckyBonus });
  if (triple) schedule(run, run.time + 0.7, 'triple', { bonus: tripleBonus });
  if (shards > 0) schedule(run, run.time + 0.85, 'runeGain', { shards });
  if (runeUp) schedule(run, run.time + 1.0, 'runeLevelUp', { level: run.runeLevel });

  return true;
}

function finishTurnIfReady(run) {
  if (!run.rolling || run.time < run.rollReadyAt) return;
  run.rolling = false;
  emit(run, 'turnEnd', { total: run.lastRoll ? run.lastRoll.total : 0, pot: run.pot });
  const c = cfg(run);
  if (run.rollsLeft <= 0) {
    if (run.pot >= c.target) doBank(run, true);
    else stageFail(run);
  }
}

// ---------- 收手保分 / 结算 ----------
function bank(run) {
  if (run.phase !== 'playing' || run.rolling) return false;
  const c = cfg(run);
  if (run.pot < c.target) return false;
  run.lastInputAt = run.time;
  return doBank(run, false);
}

function doBank(run, auto) {
  const c = cfg(run);
  if (run.pot < c.target) return false;
  const scoreFocus = runeHas(run, 'scoreFocus') ? 0.05 : 0;
  const add = Math.round(run.pot * (1 + scoreFocus));
  run.score += add;
  run.pot = 0;
  run.stats.stagesCleared += 1;
  run.stats.score = run.score;
  emit(run, 'stageClear', { stage: run.stageIndex + 1, gained: add, score: run.score, auto });
  if (run.stageIndex + 1 >= STAGES.length) {
    run.phase = 'won';
    run.won = true;
    emit(run, 'win', { score: run.score });
    return true;
  }
  beginStage(run, run.stageIndex + 1);
  return true;
}

function stageFail(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  run.won = false;
  run.stats.score = run.score;
  emit(run, 'stageFail', { stage: run.stageIndex + 1, pot: run.pot, score: run.score });
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const c = cfg(run);
  return {
    phase: run.phase,
    score: run.score,
    pot: run.pot,
    target: c.target,
    rollsLeft: run.rollsLeft,
    diceCount: run.diceCount,
    betCount: run.betSel.length,
    betCost: c.betCost,
    betSel: run.betSel.slice(),
    runeShards: run.runeShards,
    runeNeed: RUNES.SHARDS_PER_LEVEL,
    runeLevel: run.runeLevel,
    scene: c.scene,
    stage: run.stageIndex + 1,
    stageName: `scene.${c.scene}`,
    rolling: run.rolling,
    won: run.won,
    lastRoll: run.lastRoll,
  };
}

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function schedule(run, at, type, fields = {}) {
  run.pending.push({ at, type, fields });
}

function flushPending(run) {
  const remaining = [];
  for (const p of run.pending) {
    if (p.at <= run.time) emit(run, p.type, p.fields);
    else remaining.push(p);
  }
  run.pending = remaining;
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

// 押注命中倍率（纯函数，供测试）
export function betMultFor(hits) {
  return hits >= 2 ? BET.MULT_MULTI : hits === 1 ? BET.MULT_ONE : 1;
}

export { beginStage };
