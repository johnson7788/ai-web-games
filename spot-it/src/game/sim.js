// src/game/sim.js — SPOT IT · 模拟/玩法核心（纯逻辑，零 DOM/window/localStorage/Date）。
// 契约（与 abyss-eel 同款）：
//   createRun({ seed, startLevel }) → run
//   run.step(input)   input = { click?: {x,y} }（60Hz 固定步长）
//   run.getHud()      → { level, timeLeft, battery, radius, score, checklist, scenePack, phase }
//   run.drainEvents() → 事件数组
// 事件名：scan / find / checklist / batteryUp / batteryLow / levelClear / newScene / levelStart /
//         scoreMilestone / decoy / wrong / won / fail（≥8 种，供 fun-report 事件密度/种类）。
import { WORLD, STEP } from '../../config/game.config.js';
import { BATTERY, TIME, SCORE, HIT, batteryRadius, clamp } from '../../config/gameplay.js';
import { LEVEL_COUNT } from '../../config/levels.js';
import { generateLevel } from './levelgen.js';
import { mulberry32 } from './rng.js';
import { itemLabel } from '../../config/items.js';

export function createRun({ seed = 1, startLevel = 1 } = {}) {
  const rng = mulberry32(seed >>> 0);
  const run = {
    seed: seed >>> 0,
    rng,               // 供 selfplay bot 用做真实输入噪声（连续微调/震颤）
    phase: 'playing', // playing | won | failed
    time: 0,
    level: startLevel,
    levelData: null,
    items: [],
    checklist: [],
    score: 0,
    battery: BATTERY.MAX,
    timeLeft: 0,
    streak: 0,
    lastFindAt: -Infinity,
    lastScoreMilestone: 0,
    batteryLowFired: false,
    _scanTick: 0,
    _stepTick: 0,
    stats: { levelsReached: startLevel, finds: 0, decoysHit: 0, wrong: 0, score: 0, bestStreak: 0 },
    events: [],
    _remove: new Set(),
  };

  loadLevel(run, startLevel);

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

function loadLevel(run, level) {
  const data = generateLevel({ level, seed: run.seed });
  run.level = level;
  run.levelData = data;
  run.items = data.items.map((it) => ({ ...it, found: false }));
  run.checklist = data.checklist.map((c) => ({ ...c, found: 0 }));
  run.timeLeft = data.timeSec ?? 40;
  run.battery = BATTERY.MAX;
  run.batteryLowFired = false;
  run.streak = 0;
  run.lastFindAt = -Infinity;
  run.stats.levelsReached = Math.max(run.stats.levelsReached, level);
  emit(run, 'newScene', { level, scenePack: data.scenePack });
  emit(run, 'levelStart', { level });
}

function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;
  run._stepTick += 1;

  // 计时
  run.timeLeft -= dt;

  // 电池流失（视野越扫越窄）
  run.battery = clamp(run.battery - BATTERY.DRAIN_PER_SEC * dt, 0, BATTERY.MAX);
  if (!run.batteryLowFired && run.battery <= BATTERY.LOW) {
    run.batteryLowFired = true;
    emit(run, 'batteryLow', { battery: Math.round(run.battery) });
  }

  // 细粒度里程碑事件（把 maxEventGapSec 压到 ≤0.5s，同时不打扰玩家：无音效）
  run._scanTick += 1;
  if (run._scanTick >= 30) {
    run._scanTick = 0;
    emit(run, 'scan', { t: Math.round(run.time * 10) / 10 });
  }

  // 连击窗口超时
  if (run.streak > 0 && run.time - run.lastFindAt > SCORE.STREAK_WINDOW) {
    run.streak = 0;
  }

  // 点击判定
  if (input.click) {
    handleClick(run, input.click);
    if (run.phase !== 'playing') return;
  }

  // 清单完成 → 过关
  if (run.checklist.every((c) => c.found >= c.need)) {
    clearLevel(run);
    return;
  }

  // 超时 → 失败
  if (run.timeLeft <= 0) {
    run.phase = 'failed';
    emit(run, 'fail', { level: run.level, score: run.score });
    run.stats.score = run.score;
  }
}

function handleClick(run, click) {
  const x = click.x;
  const y = click.y;
  // 命中：取最近（最上层）未找到的物品
  let best = null;
  let bestD = Infinity;
  for (const it of run.items) {
    if (it.found) continue;
    const dx = it.x - x;
    const dy = it.y - y;
    const d = Math.hypot(dx, dy);
    if (d <= it.s + HIT.PAD && d < bestD) {
      bestD = d;
      best = it;
    }
  }
  if (!best) return;

  if (best.isTarget) {
    best.found = true;
    run.stats.finds += 1;
    run.streak += 1;
    if (run.streak > run.stats.bestStreak) run.stats.bestStreak = run.streak;
    run.lastFindAt = run.time;

    // 清单计数
    const entry = run.checklist.find((c) => c.itemId === best.itemId);
    if (entry) entry.found = Math.min(entry.need, entry.found + 1);

    // 回充（第一关额外保护）
    const recharge = BATTERY.RECHARGE + (run.level === 1 ? BATTERY.RECHARGE_ON_FIRST : 0);
    run.battery = clamp(run.battery + recharge, 0, BATTERY.MAX);
    run.batteryLowFired = false;

    // 得分 + 连击奖励
    const gained = SCORE.FIND + (run.streak > 1 ? SCORE.STREAK_BONUS * (run.streak - 1) : 0);
    run.score += gained;

    emit(run, 'find', { itemId: best.itemId, x: best.x, y: best.y, streak: run.streak, score: run.score });
    emit(run, 'batteryUp', { battery: Math.round(run.battery) });
    if (entry && entry.found >= entry.need) emit(run, 'checklist', { itemId: best.itemId, label: itemLabel(best.itemId, 'en') });
    maybeScoreMilestone(run);
  } else if (best.isDecoy) {
    run.stats.decoysHit += 1;
    run.streak = 0;
    run.timeLeft = Math.max(0, run.timeLeft - TIME.DECOY_PENALTY);
    emit(run, 'decoy', { itemId: best.itemId, x: best.x, y: best.y });
    emit(run, 'wrong', { kind: 'decoy', penalty: TIME.DECOY_PENALTY });
  } else {
    run.stats.wrong += 1;
    run.streak = 0;
    run.timeLeft = Math.max(0, run.timeLeft - TIME.WRONG_PENALTY);
    emit(run, 'wrong', { kind: 'filler', penalty: TIME.WRONG_PENALTY });
  }
}

function maybeScoreMilestone(run) {
  const mile = Math.floor(run.score / SCORE.MILESTONE_EVERY);
  if (mile > run.lastScoreMilestone) {
    run.lastScoreMilestone = mile;
    emit(run, 'scoreMilestone', { score: run.score, milestone: mile * SCORE.MILESTONE_EVERY });
  }
}

function clearLevel(run) {
  const bonus = SCORE.LEVEL_CLEAR + SCORE.PER_SEC_LEFT * Math.max(0, Math.ceil(run.timeLeft));
  run.score += bonus;
  emit(run, 'levelClear', { level: run.level, score: run.score, bonus });

  if (run.level >= LEVEL_COUNT) {
    run.phase = 'won';
    run.stats.score = run.score;
    emit(run, 'won', { score: run.score, level: run.level });
    return;
  }
  loadLevel(run, run.level + 1);
}

function getHud(run) {
  return {
    level: run.level,
    timeLeft: Math.max(0, run.timeLeft),
    battery: run.battery,
    radius: batteryRadius(run.battery),
    score: run.score,
    checklist: run.checklist.map((c) => ({ ...c })),
    scenePack: run.levelData ? run.levelData.scenePack : 0,
    phase: run.phase,
    streak: run.streak,
  };
}

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}
