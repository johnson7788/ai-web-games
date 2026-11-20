// src/game/sim.js — SLOT LEGENDS 纯逻辑模拟（无 DOM / 无 window / 无 Date.now）
//
// 契约（docs/report.md 事件表）：
//   createRun({ seed, tokens, spins }) → run
//   run.step(input)         推进一个固定步长（1/60s）；input = { spin, stop, bet, escort }
//   run.getHud()            { balance, bet, escort, level, tokens, freeSpins, phase, ... }
//   run.drainEvents()       [...事件]，事件名：spin/reelStop/win/bigWin/jackpot/scatter/token/
//                          nearMiss/freeSpin/pity/levelUp/milestone/settle/bankrupt/escort
//   run.phase               'idle' | 'spinning' | 'settle' | 'dead'
//
// 玩法规则（1:1 还原 spec P0 + 原创区别点）：
//   5×3 滚动轮、连续匹配判定（5→7 条赔付线）、倍率表、余额下注、
//   免费旋转（聚义厅：散布触发 + 倍率加成）、押镖（策略下注）、好汉令（5 枚保底）。

import {
  REELS, ROWS, BALANCE, BET_OPTIONS, BET_DEFAULT,
  ESCORT, SYMBOLS, PAYTABLE, PAYLINES, PAYLINES_EXTRA,
  REEL_STOP_TIMES, SPIN_DURATION, SETTLE_DURATION, FREE_SPINS, TOKEN,
  levelFor, sceneFor, paytableMult, paylineCount, freeSpinMult,
  escortCost, escortUnlocked, poolAt, freeSpinsFor, clamp,
} from '../../config/gameplay.js';
import { WORLD, STEP } from '../../config/game.config.js';
import { mulberry32, weightedPick } from './rng.js';

// ---------------------------------------------------------------- 工具
function emit(run, type, payload = {}) {
  run.events.push({ type, t: run.time, ...payload });
}

function emptyGrid() {
  const g = [];
  for (let c = 0; c < REELS; c += 1) {
    const col = [];
    for (let r = 0; r < ROWS; r += 1) col.push(SYMBOLS.OFFICIAL);
    g.push(col);
  }
  return g;
}

// ---------------------------------------------------------------- 生成目标盘面
function genTarget(run) {
  const pool = poolAt(run.level);
  const t = [];
  for (let c = 0; c < REELS; c += 1) {
    const col = [];
    for (let r = 0; r < ROWS; r += 1) col.push(weightedPick(run.rng, pool));
    t.push(col);
  }
  return t;
}

/** 第一转必中：中横线 3 连「官府」（低值，欢迎中奖）。 */
function forceWin(run) {
  for (let c = 0; c < 3; c += 1) run.target[c][1] = SYMBOLS.OFFICIAL;
}

/** 好汉令保底：中横线 5 连顶级符号（元宝 / 刀客）。 */
function forceJackpot(run) {
  const sym = run.level >= 5 ? SYMBOLS.INGOT : SYMBOLS.BLADE;
  for (let c = 0; c < REELS; c += 1) run.target[c][1] = sym;
}

/** 好汉令保底（日常）：中横线 3 连顶级符号（modest 保证赢）。 */
function forcePity(run) {
  const sym = run.level >= 5 ? SYMBOLS.INGOT : SYMBOLS.BLADE;
  for (let c = 0; c < 3; c += 1) run.target[c][1] = sym;
}

/** 调试用：强制 3 枚散布（触发免费旋转）。 */
function forceScatter(run) {
  run.target[0][0] = SYMBOLS.TOKEN;
  run.target[1][0] = SYMBOLS.TOKEN;
  run.target[2][0] = SYMBOLS.TOKEN;
}

// ---------------------------------------------------------------- 连线判定
function activePaylines(level) {
  return level >= 6 ? PAYLINES.concat(PAYLINES_EXTRA) : PAYLINES;
}

/** 单条赔付线判定：从最左列起连续匹配（wild 万能替代）；返回 { symbol, count } 或 null。 */
function evalLine(target, line) {
  const cells = line.map((row, c) => target[c][row]);
  const first = cells[0];
  if (first === SYMBOLS.TOKEN) return null; // scatter 不参与普通连线
  let base = first === SYMBOLS.WILD ? null : first;
  if (base === null) {
    for (const s of cells) {
      if (s !== SYMBOLS.WILD && s !== SYMBOLS.TOKEN) { base = s; break; }
    }
    if (base === null) base = SYMBOLS.INGOT; // 全 wild 按元宝赔
  }
  let count = 0;
  for (const s of cells) {
    if (s === base || s === SYMBOLS.WILD) count += 1;
    else break;
  }
  if (count < 3) return null;
  return { symbol: base, count };
}

function countScatter(target) {
  let n = 0;
  for (let c = 0; c < REELS; c += 1) {
    for (let r = 0; r < ROWS; r += 1) {
      if (target[c][r] === SYMBOLS.TOKEN) n += 1;
    }
  }
  return n;
}

// ---------------------------------------------------------------- 状态流转
function startSpin(run) {
  const level = run.level;
  const bet = run.bet;
  const esc = run.escort && escortUnlocked(level);
  const free = run.freeSpins > 0;
  if (free) run.freeSpins -= 1;
  run.freeSpin = free;

  const cost = esc ? escortCost(bet, level) : bet;
  if (!free && run.balance < cost) {
    run.phase = 'dead';
    emit(run, 'bankrupt', { balance: run.balance, cost, bet });
    return;
  }
  if (!free) run.balance -= cost;

  run.totalSpins += 1;
  const oldLevel = run.level;
  run.level = levelFor(run.totalSpins);

  run.target = genTarget(run);
  run._forcedPity = false;
  if (run.pendingForce) {
    const f = run.pendingForce;
    run.pendingForce = null;
    if (f === 'jackpot') forceJackpot(run);
    else if (f === 'win') forceWin(run);
    else if (f === 'free') forceScatter(run);
  } else if (!free && run.tokens >= TOKEN.PITY_TARGET) {
    forcePity(run); // 好汉令保底：保证一次顶级 3 连中奖
    run.tokens -= TOKEN.PITY_TARGET;
    run._forcedPity = true;
  } else if (run._welcomeWin) {
    forceWin(run);
    run._welcomeWin = false;
  }

  run.reelStopped = [false, false, false, false, false];
  run.spinTime = 0;
  run.winLines = [];
  run.phase = 'spinning';
  emit(run, 'spin', { bet, cost: free ? 0 : cost, free, escort: esc });
  if (run.totalSpins % 5 === 0) emit(run, 'milestone', { spins: run.totalSpins });
  if (run.level > oldLevel) emit(run, 'levelUp', { level: run.level });
}

function settle(run) {
  const level = run.level;
  const bet = run.bet;
  const esc = run.escort && escortUnlocked(level);
  const free = run.freeSpin;

  let totalWin = 0;
  let anyJackpot = false;
  run.winLines = [];
  const lines = activePaylines(level);
  for (let li = 0; li < lines.length; li += 1) {
    const res = evalLine(run.target, lines[li]);
    if (!res) continue;
    let mult = PAYTABLE[res.symbol][res.count - 3];
    if (esc) mult *= ESCORT.MULT;
    mult *= paytableMult(level);
    if (free) mult *= run.freeMult;
    const amount = Math.round(bet * mult);
    if (amount > 0) {
      totalWin += amount;
      if (res.count === 5 && (res.symbol === SYMBOLS.INGOT || res.symbol === SYMBOLS.BLADE)) anyJackpot = true;
      run.winLines.push({ li, symbol: res.symbol, count: res.count, amount });
    }
  }

  if (totalWin > 0) run.balance += totalWin;
  run.lastWin = totalWin;
  run.lastJackpot = anyJackpot;
  run.stats.totalWin += totalWin;
  if (totalWin > run.stats.biggestWin) run.stats.biggestWin = totalWin;
  if (anyJackpot) run.stats.jackpots += 1;

  const scatters = countScatter(run.target);
  if (scatters > 0) {
    emit(run, 'scatter', { count: scatters });
    if (!free && !run._forcedPity) {
      run.tokens += scatters;
      emit(run, 'token', { count: scatters, tokens: run.tokens });
    }
  }
  if (scatters === 2) emit(run, 'nearMiss', { scatters: 2 });

  if (!free) {
    const eff = esc ? scatters * ESCORT.SCATTER_MULT : scatters;
    if (eff >= 3) {
      const n = freeSpinsFor(eff);
      run.freeSpins += n;
      run.freeMult = freeSpinMult(level);
      run.stats.freespins += 1;
      emit(run, 'freeSpin', { count: n });
    }
  } else if (scatters >= 3) {
    const n = freeSpinsFor(scatters);
    run.freeSpins += n;
    emit(run, 'freeSpin', { count: n, retrigger: true });
  }

  if (run._forcedPity) {
    emit(run, 'pity', { amount: totalWin });
    run._forcedPity = false;
  }

  if (totalWin > 0) {
    emit(run, 'win', { amount: totalWin });
    if (totalWin >= bet * 10) emit(run, 'bigWin', { amount: totalWin });
    if (anyJackpot) emit(run, 'jackpot', { amount: totalWin });
  }

  emit(run, 'settle', { win: totalWin, balance: run.balance });
}

function finishSettle(run) {
  if (run.freeSpins > 0) {
    startSpin(run); // 剩余免费旋转自动续转
  } else {
    run.freeSpin = false;
    run.phase = 'idle';
    emit(run, 'ready', {});
  }
}

// ---------------------------------------------------------------- step
function step(run, input = {}) {
  run.time += STEP;
  if (run.phase === 'dead') return run;

  const press = !!input.spin;
  const stop = !!input.stop;

  if (run.phase === 'idle') {
    if (Number.isFinite(input.bet) && BET_OPTIONS.includes(input.bet) && input.bet !== run.bet) {
      run.bet = input.bet;
      emit(run, 'bet', { bet: run.bet });
    }
    if (input.escort != null && escortUnlocked(run.level)) {
      const want = !!input.escort;
      if (want !== run.escort) {
        run.escort = want;
        emit(run, 'escort', { on: want });
      }
    }
    if (press) startSpin(run);
  } else if (run.phase === 'spinning') {
    run.spinTime += STEP;
    emit(run, 'reelSpin', { spinTime: run.spinTime }); // 细粒度里程碑：每步都在转（非空转）
    if (stop) run.spinTime = Math.max(run.spinTime, SPIN_DURATION);
    for (let c = 0; c < REELS; c += 1) {
      if (!run.reelStopped[c] && run.spinTime >= REEL_STOP_TIMES[c]) {
        run.reelStopped[c] = true;
        for (let r = 0; r < ROWS; r += 1) run.reels[c][r] = run.target[c][r];
        emit(run, 'reelStop', { reel: c });
      }
    }
    if (run.spinTime >= SPIN_DURATION) {
      run.phase = 'settle';
      run.settleTime = 0;
      settle(run);
    }
  } else if (run.phase === 'settle') {
    run.settleTime += STEP;
    if (run.settleTime >= SETTLE_DURATION) finishSettle(run);
  }
  return run;
}

function getHud(run) {
  return {
    balance: run.balance,
    bet: run.bet,
    escort: run.escort,
    escortUnlocked: escortUnlocked(run.level),
    level: run.level,
    tokens: run.tokens,
    pityReady: run.tokens >= TOKEN.PITY_TARGET,
    freeSpins: run.freeSpins,
    freeSpin: run.freeSpin,
    phase: run.phase,
    totalSpins: run.totalSpins,
    lastWin: run.lastWin,
    lastJackpot: run.lastJackpot,
    scene: sceneFor(run.level),
    maxBet: BET_OPTIONS[BET_OPTIONS.length - 1],
    width: WORLD.WIDTH,
    height: WORLD.HEIGHT,
  };
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

// ---------------------------------------------------------------- createRun
export function createRun({ seed = 1, tokens = 0, spins = 0 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    phase: 'idle',
    time: 0,
    reels: null,
    target: null,
    reelStopped: [true, true, true, true, true],
    spinTime: 0,
    settleTime: 0,
    balance: BALANCE.START,
    bet: BET_DEFAULT,
    escort: false,
    freeSpin: false,
    tokens: Math.max(0, Math.floor(tokens ?? 0)),
    totalSpins: Math.max(0, Math.floor(spins ?? 0)),
    level: levelFor(Math.max(0, Math.floor(spins ?? 0))),
    freeSpins: 0,
    freeMult: freeSpinMult(levelFor(Math.max(0, Math.floor(spins ?? 0)))),
    lastWin: 0,
    lastJackpot: false,
    winLines: [],
    pendingForce: null,
    _welcomeWin: (Math.max(0, Math.floor(spins ?? 0))) === 0,
    _forcedPity: false,
    stats: { totalWin: 0, biggestWin: 0, jackpots: 0, freespins: 0 },
    events: [],
  };
  run.reels = genTarget(run);
  run.target = run.reels;
  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

export { clamp };
