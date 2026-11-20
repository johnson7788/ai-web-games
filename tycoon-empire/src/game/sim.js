// src/game/sim.js — 经营模拟核心（纯逻辑，零依赖、无 DOM/Date.now/localStorage）。
// 契约：createRun({seed, saveData, offlineSec}) → { step, getHud, drainEvents, serialize, ... }
// 事件名（供 UI/音频/遥测消费）：tap / tapCombo / buy / upgrade / hire / collect / income /
//   milestone / buildingUp / stockDay / stockResolve / allIn / loan / loanInterest / repay /
//   bankrupt / offlineIncome / newRecord
import { STEP } from '../../config/game.config.js';
import {
  INDUSTRIES, INDUSTRY_COUNT, TAP, STOCK, LOAN, OFFLINE,
  upgradeCost, incomeRate, industryValue, tapValue, netWorth, chapterOf, effectiveRate,
} from '../../config/gameplay.js';
import { mulberry32, randInt } from './rng.js';

export function createRun({ seed = 0, saveData = null, offlineSec = 0 } = {}) {
  const rng = mulberry32(seed);

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    cash: 0,
    debt: 0,
    nextInterestAt: Infinity,
    industries: INDUSTRIES.map((ind, i) => ({
      index: i,
      id: ind.id,
      owned: i === 0,
      unlocked: i === 0,
      level: i === 0 ? 1 : 0,
      manager: false,
      pending: 0,
      nextDouble: 2,
    })),
    unlockedCount: 1,
    stock: {
      nextDayAt: STOCK.intervalSec,
      betting: false,
      active: false,
      target: 0,
      up: true,
      betUp: null,
      resolveAt: 0,
    },
    totalTaps: 0,
    tapStreak: 0,
    lastTapAt: -Infinity,
    lastIncomeSec: -1,
    lastChapter: 0,
    signature: null,          // { at, dur, industry } 金链落成动画状态
    stats: {
      bankrupts: 0,
      highestNetWorth: 0,
      totalBought: 0,
      totalUpgrades: 0,
      totalManagers: 0,
    },
    events: [],
  };

  syncUnlocks(run);
  if (saveData) restore(run, saveData);
  if (offlineSec > 0) applyOffline(run, offlineSec);

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.serialize = () => serialize(run);
  return run;
}

// 兼容旧骨架别名（无实际调用，保留契约）
export function createSim() {
  return createRun({ seed: 0 });
}

// ---------- 每 tick ----------
function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  if (input.tap) doTap(run);
  if (Number.isInteger(input.buy) && input.buy >= 0) doBuy(run, input.buy);
  if (Number.isInteger(input.upgrade) && input.upgrade >= 0) doUpgrade(run, input.upgrade);
  if (Number.isInteger(input.hire) && input.hire >= 0) doHire(run, input.hire);
  if (input.collect) doCollect(run);
  if (input.allIn) doAllIn(run, input.allInUp === true);
  if (input.loan) doLoan(run);
  if (input.repay) doRepay(run);

  accrueIncome(run, dt);
  updateStock(run);
  updateLoan(run);
  updateMilestones(run);
}

// ---------- 动作 ----------
function doTap(run) {
  const totalLevel = totalLevels(run);
  let val = tapValue(totalLevel);

  // 连点爆发：窗口内连续点击 comboN 次 → 本次产出 ×comboMult
  if (run.time - run.lastTapAt <= TAP.comboWindow) run.tapStreak += 1;
  else run.tapStreak = 1;
  run.lastTapAt = run.time;
  if (run.tapStreak >= TAP.comboN) {
    val *= TAP.comboMult;
    run.tapStreak = 0;
    emit(run, 'tapCombo', { mult: TAP.comboMult });
  }

  run.cash += val;
  run.totalTaps += 1;
  emit(run, 'tap', { value: val });
}

function doBuy(run, i) {
  const ind = run.industries[i];
  if (!ind || !ind.unlocked || ind.owned) return;
  const cost = INDUSTRIES[i].cost;
  if (run.cash < cost) return;
  run.cash -= cost;
  ind.owned = true;
  ind.level = 1;
  run.unlockedCount += 1;
  run.stats.totalBought += 1;
  syncUnlocks(run);
  emit(run, 'buy', { industry: i, name: `ind.${ind.id}` });
  emit(run, 'milestone', { unlocked: run.unlockedCount, name: `ind.${ind.id}` });
}

function doUpgrade(run, i) {
  const ind = run.industries[i];
  if (!ind || !ind.owned) return;
  const cost = upgradeCost(i, ind.level);
  if (run.cash < cost) return;
  run.cash -= cost;
  ind.level += 1;
  run.stats.totalUpgrades += 1;
  emit(run, 'upgrade', { industry: i, level: ind.level });
}

function doHire(run, i) {
  const ind = run.industries[i];
  if (!ind || !ind.owned || ind.manager) return;
  const cost = INDUSTRIES[i].managerCost;
  if (run.cash < cost) return;
  run.cash -= cost;
  ind.manager = true;
  run.stats.totalManagers += 1;
  emit(run, 'hire', { industry: i });
}

function doCollect(run) {
  let total = 0;
  for (const ind of run.industries) {
    if (ind.owned) {
      total += ind.pending;
      ind.pending = 0;
    }
  }
  if (total > 0) {
    run.cash += total;
    emit(run, 'collect', { value: total });
  }
}

function doAllIn(run, up) {
  if (!run.stock.betting) return;
  run.stock.betUp = up;
  emit(run, 'allIn', { up });
}

function doLoan(run) {
  if (run.debt > 0) return;
  if (run.cash < LOAN.minCashToBorrow) return;
  const amount = run.cash * LOAN.borrowMult;
  run.cash += amount;
  run.debt = amount;
  run.nextInterestAt = run.time + LOAN.interestSec;
  emit(run, 'loan', { amount });
}

function doRepay(run) {
  if (run.debt <= 0) return;
  const pay = Math.min(run.cash, run.debt);
  run.cash -= pay;
  run.debt -= pay;
  if (run.debt <= 0) {
    run.debt = 0;
    run.nextInterestAt = Infinity;
  }
  emit(run, 'repay', { amount: pay });
}

// ---------- 系统推进 ----------
function accrueIncome(run, dt) {
  for (const ind of run.industries) {
    if (!ind.owned) continue;
    const rate = effectiveRate(ind.index, ind.level, run.stock);
    const gain = rate * dt;
    if (ind.manager) {
      run.cash += gain;
    } else {
      ind.pending += gain;
    }
  }
  // 每秒发一次 income 事件（只要有一个经理在自动收取，保证反馈密度）
  const sec = Math.floor(run.time);
  if (sec > run.lastIncomeSec) {
    run.lastIncomeSec = sec;
    if (run.industries.some((ind) => ind.owned && ind.manager)) {
      emit(run, 'income', { value: totalRate(run) });
    }
  }
}

function updateStock(run) {
  const s = run.stock;
  if (!s.betting && !s.active && run.time >= s.nextDayAt) {
    // 行情日开始：选目标产业 + 真实方向（玩家只知道目标，方向要押注）
    const pool = run.unlockedCount;
    s.betting = true;
    s.target = randInt(run.rng, 0, Math.max(0, pool - 1));
    s.up = run.rng() < 0.5;
    s.betUp = null;
    s.resolveAt = run.time + STOCK.betWindowSec;
    emit(run, 'stockDay', { industry: s.target, name: `ind.${INDUSTRIES[s.target].id}` });
  } else if (s.betting && run.time >= s.resolveAt) {
    s.betting = false;
    s.active = true;
    s.nextDayAt = run.time + STOCK.intervalSec;
    emit(run, 'stockResolve', { industry: s.target, up: s.up });
    if (s.betUp !== null) {
      const won = s.betUp === s.up;
      run.cash *= won ? STOCK.winMult : STOCK.loseMult;
      emit(run, 'allInResult', { won, up: s.betUp });
      s.betUp = null;
    }
  } else if (s.active && run.time >= s.nextDayAt) {
    // 下一个行情日：清掉上一个加成
    s.active = false;
  }
}

function updateLoan(run) {
  if (run.debt > 0 && run.time >= run.nextInterestAt) {
    const interest = run.debt * LOAN.interestRate;
    if (run.cash < interest) {
      bankrupt(run);
    } else {
      run.cash -= interest;
      emit(run, 'loanInterest', { amount: interest });
    }
    run.nextInterestAt = run.time + LOAN.interestSec;
  }
}

function bankrupt(run) {
  run.stats.bankrupts += 1;
  run.cash = 0;
  run.debt = 0;
  run.nextInterestAt = Infinity;
  run.unlockedCount = 1;
  run.stock.betting = false;
  run.stock.active = false;
  run.stock.betUp = null;
  run.stock.nextDayAt = run.time + STOCK.intervalSec;
  for (let i = 0; i < run.industries.length; i += 1) {
    const ind = run.industries[i];
    if (i === 0) {
      ind.owned = true;
      ind.level = 1;
    } else {
      ind.owned = false;
      ind.level = 0;
    }
    ind.manager = false;
    ind.pending = 0;
    ind.nextDouble = 2;
  }
  syncUnlocks(run);
  emit(run, 'bankrupt', {});
}

function updateMilestones(run) {
  // 场景章节切换
  const chapter = chapterOf(run.unlockedCount);
  if (chapter !== run.lastChapter) {
    run.lastChapter = chapter;
    emit(run, 'milestone', { chapter, scene: `scene.${chapter}` });
  }

  // 金链落成：产业等级翻倍（跨越 2 的幂）
  for (const ind of run.industries) {
    if (!ind.owned) continue;
    while (ind.level >= ind.nextDouble) {
      emit(run, 'buildingUp', { industry: ind.index, floors: ind.nextDouble });
      run.signature = { at: run.time, dur: 2.0, industry: ind.index };
      ind.nextDouble *= 2;
    }
  }

  // 新身家纪录
  const worth = netWorth(run.cash, run.industries);
  if (worth > run.stats.highestNetWorth) {
    run.stats.highestNetWorth = worth;
    emit(run, 'newRecord', { worth });
  }
}

// ---------- 派生 ----------
function totalLevels(run) {
  let t = 0;
  for (const ind of run.industries) if (ind.owned) t += ind.level;
  return t;
}

function totalRate(run) {
  let t = 0;
  for (const ind of run.industries) if (ind.owned) t += effectiveRate(ind.index, ind.level, run.stock);
  return t;
}

// 顺序解锁：产业 i 可购买 = 上一个产业已拥有（报刊亭默认解锁）。
function syncUnlocks(run) {
  for (let i = 0; i < run.industries.length; i += 1) {
    run.industries[i].unlocked = i === 0 || run.industries[i - 1].owned;
  }
}

function applyOffline(run, sec) {
  const capped = Math.min(sec, OFFLINE.capSec);
  const gain = totalRate(run) * capped * OFFLINE.rate;
  if (gain > 0) {
    run.cash += gain;
    emit(run, 'offlineIncome', { amount: gain, sec: capped });
  }
}

// ---------- HUD ----------
function getHud(run) {
  const worth = netWorth(run.cash, run.industries);
  const chapter = chapterOf(run.unlockedCount);
  const s = run.stock;
  return {
    phase: run.phase,
    time: run.time,
    cash: run.cash,
    netWorth: worth,
    incomePerSec: totalRate(run),
    debt: run.debt,
    unlockedCount: run.unlockedCount,
    totalIndustries: INDUSTRY_COUNT,
    chapter,
    sceneKey: `scene.${chapter}`,
    stock: {
      betting: s.betting,
      active: s.active,
      target: s.target,
      targetName: `ind.${INDUSTRIES[s.target].id}`,
      up: s.up,
      timeLeft: s.betting ? Math.max(0, s.resolveAt - run.time) : 0,
    },
    industries: run.industries.map((ind) => {
      const cfg = INDUSTRIES[ind.index];
      return {
        index: ind.index,
        id: ind.id,
        nameKey: `ind.${ind.id}`,
        scene: cfg.scene,
        owned: ind.owned,
        unlocked: ind.unlocked,
        level: ind.level,
        manager: ind.manager,
        pending: ind.pending,
        rate: ind.owned ? effectiveRate(ind.index, ind.level, run.stock) : 0,
        buyCost: cfg.cost,
        upgradeCost: ind.owned ? upgradeCost(ind.index, ind.level) : 0,
        managerCost: cfg.managerCost,
      };
    }),
    bestNetWorth: run.stats.highestNetWorth,
    bankrupts: run.stats.bankrupts,
    tapValue: tapValue(totalLevels(run)),
  };
}

// ---------- 事件 ----------
function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

// ---------- 存档 ----------
function serialize(run) {
  return {
    v: 1,
    cash: run.cash,
    debt: run.debt,
    unlockedCount: run.unlockedCount,
    industries: run.industries.map((ind) => ({
      owned: ind.owned,
      unlocked: ind.unlocked,
      level: ind.level,
      manager: ind.manager,
      nextDouble: ind.nextDouble,
    })),
    highestNetWorth: run.stats.highestNetWorth,
    totalTaps: run.totalTaps,
    bankrupts: run.stats.bankrupts,
  };
}

function restore(run, saveData) {
  if (!saveData || typeof saveData !== 'object') return;
  if (typeof saveData.cash === 'number') run.cash = saveData.cash;
  if (typeof saveData.debt === 'number') {
    run.debt = saveData.debt;
    if (run.debt > 0) run.nextInterestAt = run.time + LOAN.interestSec;
  }
  if (typeof saveData.unlockedCount === 'number') run.unlockedCount = saveData.unlockedCount;
  if (Array.isArray(saveData.industries)) {
    for (let i = 0; i < Math.min(saveData.industries.length, INDUSTRY_COUNT); i += 1) {
      const src = saveData.industries[i];
      const dst = run.industries[i];
      if (!src) continue;
      dst.owned = src.owned === true || i === 0;
      dst.unlocked = src.unlocked === true || i === 0;
      dst.level = Math.max(0, Number(src.level) || 0);
      if (dst.owned && dst.level < 1) dst.level = 1;
      dst.manager = src.manager === true;
      dst.nextDouble = Number(src.nextDouble) || 2;
    }
  }
  if (typeof saveData.highestNetWorth === 'number') run.stats.highestNetWorth = saveData.highestNetWorth;
  if (typeof saveData.totalTaps === 'number') run.totalTaps = saveData.totalTaps;
  if (typeof saveData.bankrupts === 'number') run.stats.bankrupts = saveData.bankrupts;
  syncUnlocks(run);
}
