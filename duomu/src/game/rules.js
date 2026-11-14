/**
 * 《夺木》纯规则层。
 *
 * 铁律：这个文件不碰 DOM / window / localStorage / Date.now。
 * 时间一律由调用方传入 now（毫秒），随机一律走注入的 rng()。
 *
 * 核心：每一节木段分三个时间窗，出手越早分越高、死得越惨：
 *
 *   0 ── 450ms ── 900ms ────────── 1560ms
 *   │   盲劈×3   │  微光×2  │  明牌×1  │ 没出手就吃天雷
 *   │  纯赌       │ 七成准   │ 绝对安全 │
 *
 * 同一节木段两边各能砍一刀（互不剥夺），但**先出手的人 +1 先手分**。
 * 这样速度仍然值钱，又不会让手快的人把分全吃光——单人打电脑才平衡。
 * 该出手时不出手的人，自己挨天雷；出过手的人不再受罚。
 */
import { ACTS, ACT_GATES, MATCH, SUDDEN_DEATH, AI_LEVELS } from '../../config/game.config.js';

export const PHASE = { MENU: 'menu', HOWTO: 'howto', PLAYING: 'playing', PAUSED: 'paused', RESULT: 'result' };
export const SIDE = { L: 'L', R: 'R', BOTH: 'BOTH', NONE: 'NONE' };

let nextSegId = 1;

/** mulberry32：可复现的确定性随机源，测试和录像都靠它 */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePlayer(index) {
  return {
    index, hp: MATCH.hp, logs: 0, combo: 0, bestCombo: 0,
    blind: 0, first: 0, killed: 0, alive: true, stunnedUntil: 0, lastSide: null,
  };
}

export function createRun({ mode = 'solo', aiLevel = 'veteran', seed = 1 } = {}) {
  const ai = AI_LEVELS.find((l) => l.id === aiLevel) || AI_LEVELS[1];
  return {
    phase: PHASE.MENU, mode, aiLevel: ai.id, rng: makeRng(seed),
    ai: { plan: null, level: ai },
    now: 0, actIndex: 0, sudden: false,
    players: [makePlayer(0), makePlayer(1)],
    segs: [], lastSide: null, totalLogs: 0,
    gapUntil: 0, pausedAt: 0, events: [], winner: -1, round: 0,
  };
}

export function actConfig(run) {
  const base = ACTS[Math.min(run.actIndex, ACTS.length - 1)];
  if (!run.sudden) return base;
  const k = 0.62;
  return {
    ...base,
    hintMs: Math.round(base.hintMs * k),
    revealMs: Math.round(base.revealMs * k),
    idleMs: Math.round(base.idleMs * k),
    passMs: Math.round(base.passMs * k),
  };
}

function emit(run, type, data = {}) { run.events.push({ type, at: run.now, ...data }); }
export function drainEvents(run) { const out = run.events; run.events = []; return out; }

function pickBrand(run, cfg) {
  const r = run.rng();
  if (r < cfg.pBoth) return SIDE.BOTH;
  if (r < cfg.pBoth + cfg.pNone) return SIDE.NONE;
  let side = run.rng() < 0.5 ? SIDE.L : SIDE.R;
  if (side === run.lastSide && run.rng() < 0.7) side = side === SIDE.L ? SIDE.R : SIDE.L;
  run.lastSide = side;
  return side;
}

function spawnSegment(run) {
  const cfg = actConfig(run);
  const brand = pickBrand(run, cfg);
  // 微光只有七成准：它是「值得赌的线索」，不是答案
  let hint = brand === SIDE.L || brand === SIDE.R ? brand : (run.rng() < 0.5 ? SIDE.L : SIDE.R);
  if (brand !== SIDE.BOTH && run.rng() > MATCH.hintAccuracy) hint = hint === SIDE.L ? SIDE.R : SIDE.L;
  return {
    id: nextSegId++, brand, hint,
    state: 'hidden',           // hidden(蒙面) → hint(微光) → revealed(明牌)
    activeAt: 0, hintAt: 0, revealAt: 0, idleAt: 0, doneAt: 0,
    chopped: [false, false],
    order: 0,
  };
}

function activate(run, seg, at) {
  const cfg = actConfig(run);
  seg.activeAt = at;
  seg.state = 'hidden';
  seg.hintAt = at + cfg.hintMs;
  seg.revealAt = at + cfg.hintMs + cfg.revealMs;
  seg.idleAt = at + (seg.brand === SIDE.BOTH ? cfg.passMs : cfg.idleMs);
  seg.doneAt = 0;
  seg.chopped = [false, false];
  seg.order = 0;
  run.gapUntil = Math.max(run.gapUntil, at);
}

export function startRun(run, now = 0) {
  run.phase = PHASE.PLAYING;
  run.now = now;
  run.actIndex = 0;
  run.sudden = false;
  run.segs = [];
  run.lastSide = null;
  run.totalLogs = 0;
  run.gapUntil = 0;
  run.winner = -1;
  run.round++;
  run.players = [makePlayer(0), makePlayer(1)];
  run.events = [];
  run.ai = { plan: null, level: run.ai.level };
  while (run.segs.length < MATCH.visibleSegs) run.segs.push(spawnSegment(run));
  activate(run, run.segs[0], now);
  emit(run, 'start', { act: run.actIndex });
  return run;
}

function nextSegment(run, now) {
  run.segs.shift();
  run.segs.push(spawnSegment(run));
  run.totalLogs += 1;
  run.gapUntil = now + MATCH.gapMs;
  activate(run, run.segs[0], run.gapUntil);
}

function checkActProgress(run) {
  let target = 0;
  for (let i = 0; i < ACT_GATES.length; i++) if (run.totalLogs >= ACT_GATES[i]) target = i + 1;
  if (target > run.actIndex) {
    run.actIndex = target;
    emit(run, 'act', { act: run.actIndex });
  }
  if (!run.sudden && run.totalLogs >= SUDDEN_DEATH.atTotalLogs) {
    run.sudden = true;
    emit(run, 'sudden', {});
  }
}

function endMatch(run, winner, reason) {
  run.phase = PHASE.RESULT;
  run.winner = winner;
  emit(run, 'end', { winner, reason });
}

function judgeAlive(run, reason) {
  const alive = run.players.filter((p) => p.alive);
  if (alive.length === 0) endMatch(run, -1, reason);
  else if (alive.length === 1) endMatch(run, alive[0].index, reason);
}

/** 该出手没出手 → 天雷只劈这个犹豫的人 */
function smitePlayer(run, p, now) {
  if (!p.alive) return;
  p.hp -= 1;
  p.combo = 0;
  p.stunnedUntil = now + MATCH.stunMs;
  if (p.hp <= 0) { p.hp = 0; p.alive = false; }
  emit(run, 'smite', { player: p.index });
}

/** 两个人都处理完（砍过 / 出局 / 被雷劈倒），这一节就可以过了 */
function everyoneSettled(run, seg) {
  for (let i = 0; i < 2; i++) {
    const p = run.players[i];
    if (p.alive && !seg.chopped[i]) return false;
  }
  return true;
}

export function step(run, now) {
  run.now = now;
  if (run.phase !== PHASE.PLAYING) return run;
  if (now < (run.gapUntil || 0)) return run;
  const seg = run.segs[0];
  if (!seg || seg.state === 'done') return run;

  if (seg.state === 'hidden' && now >= seg.hintAt) {
    seg.state = 'hint';
    emit(run, 'hint', { hint: seg.hint, segId: seg.id });
  }
  if (seg.state === 'hint' && now >= seg.revealAt) {
    seg.state = 'revealed';
    emit(run, 'reveal', { brand: seg.brand, segId: seg.id });
  }

  if (now >= seg.idleAt) {
    if (seg.brand !== SIDE.BOTH) {
      // 双雷段只能等；其余木段，谁没出手谁挨一道天雷
      for (let i = 0; i < 2; i++) {
        if (!seg.chopped[i]) smitePlayer(run, run.players[i], now);
      }
      emit(run, 'escape', { segId: seg.id });
    } else {
      emit(run, 'pass', { segId: seg.id });
    }
    judgeAlive(run, 'idle');
    if (run.phase !== PHASE.PLAYING) return run;
    nextSegment(run, now);
    checkActProgress(run);
    return run;
  }

  if (everyoneSettled(run, seg)) {
    nextSegment(run, now);
    checkActProgress(run);
  }
  return run;
}

/** 当前这一刀属于哪个档次 */
export function tierAt(seg, now) {
  if (now < seg.hintAt) return 'blind';
  if (now < seg.revealAt) return 'hint';
  return 'sure';
}

/**
 * 玩家出手。每人每节只能砍一刀。
 * @returns {'ignored'|'death'|'blind'|'hint'|'sure'}
 */
export function strike(run, playerIndex, side, now) {
  if (run.phase !== PHASE.PLAYING) return 'ignored';
  run.now = now;
  const p = run.players[playerIndex];
  if (!p || !p.alive) return 'ignored';
  if (now < p.stunnedUntil) return 'ignored';
  if (now < (run.gapUntil || 0)) return 'ignored';
  const seg = run.segs[0];
  if (!seg || seg.state === 'done' || seg.chopped[playerIndex]) return 'ignored';

  const unsafe = seg.brand === SIDE.BOTH || seg.brand === side;
  seg.chopped[playerIndex] = true;
  const isFirst = seg.order === 0;
  seg.order += 1;

  if (unsafe) {
    p.hp -= 1;
    p.killed += 1;
    p.combo = 0;
    p.stunnedUntil = now + MATCH.stunMs;
    if (p.hp <= 0) { p.hp = 0; p.alive = false; }
    emit(run, 'zap', { player: playerIndex, side, brand: seg.brand, segId: seg.id });
    judgeAlive(run, 'zap');
    if (run.phase !== PHASE.PLAYING) return 'death';
    if (everyoneSettled(run, seg)) { nextSegment(run, now); checkActProgress(run); }
    return 'death';
  }

  const tier = tierAt(seg, now);
  const gain = MATCH.score[tier] + (isFirst ? MATCH.firstBonus : 0);
  p.logs += gain;
  p.combo += 1;
  p.bestCombo = Math.max(p.bestCombo, p.combo);
  if (tier === 'blind') p.blind += 1;
  if (isFirst) p.first += 1;
  p.lastSide = side;
  emit(run, 'chop', { player: playerIndex, side, tier, gain, first: isFirst, combo: p.combo, segId: seg.id });

  if (p.logs >= MATCH.targetLogs || run.players[1 - playerIndex].logs >= MATCH.targetLogs) {
    endMatch(run, run.players[0].logs >= run.players[1].logs ? 0 : 1, 'target');
    return tier;
  }
  if (everyoneSettled(run, seg)) { nextSegment(run, now); checkActProgress(run); }
  return tier;
}

/** 给渲染层 / AI 用的只读快照；未到点的信息一律不外泄 */
export function getSnapshot(run) {
  const seg = run.segs[0];
  let shown = 'HIDDEN';
  if (seg) {
    if (seg.state === 'hint') shown = seg.hint;
    else if (seg.state === 'revealed' || seg.state === 'done') shown = seg.brand;
  }
  return {
    phase: run.phase,
    actIndex: run.actIndex,
    sudden: run.sudden,
    seg: seg ? { id: seg.id, shown, state: seg.state, chopped: seg.chopped.slice() } : null,
    players: run.players.map((p) => ({
      hp: p.hp, logs: p.logs, combo: p.combo, alive: p.alive, stunned: run.now < p.stunnedUntil,
    })),
    winner: run.winner,
  };
}

/**
 * 激励复活：只把「血被劈光」这种失败拉回来。
 * 对手已经到了目标木数，或自己还活着，都不给复活——避免把比赛拖成无限续命。
 * @returns {boolean} 是否真的复活了
 */
export function reviveRun(run, now, hp = 2) {
  if (run.phase !== PHASE.RESULT) return false;
  const me = run.players[0];
  const foe = run.players[1];
  if (!me || !foe) return false;
  if (foe.logs >= MATCH.targetLogs) return false;
  if (me.alive && me.hp > 0) return false;
  me.hp = Math.max(1, hp);
  me.alive = true;
  me.combo = 0;
  me.stunnedUntil = now + 420;
  run.phase = PHASE.PLAYING;
  run.winner = -1;
  run.gapUntil = now + 260;
  if (run.segs[0]) activate(run, run.segs[0], run.gapUntil);
  emit(run, 'revive', { player: 0 });
  return true;
}

export function pauseRun(run) {
  if (run.phase === PHASE.PLAYING) {
    run.pausedAt = run.now;
    run.phase = PHASE.PAUSED;
    emit(run, 'pause', {});
  }
}

export function resumeRun(run, now) {
  if (run.phase !== PHASE.PAUSED) return;
  const dt = Math.max(0, now - (run.pausedAt ?? run.now));
  const seg = run.segs[0];
  if (seg) {
    seg.activeAt += dt; seg.hintAt += dt; seg.revealAt += dt; seg.idleAt += dt;
    if (seg.doneAt) seg.doneAt += dt;
  }
  for (const p of run.players) if (p.stunnedUntil) p.stunnedUntil += dt;
  if (run.gapUntil) run.gapUntil += dt;
  run.now = now;
  run.phase = PHASE.PLAYING;
  emit(run, 'resume', {});
}
