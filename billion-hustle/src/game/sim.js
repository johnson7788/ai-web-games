// src/game/sim.js — BILLION HUSTLE · 玩法核心（纯逻辑，零依赖，不碰 DOM/window/Date）
// 契约：createRun({seed}) → { step(), click(), buyUpgrade(id), hirePartner(id),
//   placeBet(idx), toggleBurn(), drainEvents(), getHud(), stats, phase, time }
// 事件名：click / income / upgrade / hire / bet / betWin / betLose / windfall /
//   burnStart / burnEnd / fund / valuationFlip / milestone / won。
import {
  ECO, UPGRADES, PARTNERS, ROUNDS, SECTORS, WINDFALL, BURN,
  clamp, roundTarget, sceneIdForRound,
} from '../../config/gameplay.js';
import { mulberry32 } from './rng.js';

const STEP = 1 / 60;

// ---------------------------------------------------------------------------
// 数值工具
// ---------------------------------------------------------------------------

export function formatMoney(n) {
  const v = Math.max(0, Math.floor(n));
  if (v < 1000) return String(v);
  if (v < 1e6) return trimZeros((v / 1e3).toFixed(1)) + 'K';
  if (v < 1e9) return trimZeros((v / 1e6).toFixed(1)) + 'M';
  return trimZeros((v / 1e9).toFixed(2)) + 'B';
}

export function formatMoneyFull(n) {
  const v = Math.max(0, Math.floor(n));
  const s = String(v);
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return out;
}

function trimZeros(s) {
  return s.replace(/\.0$/, '').replace(/(\.\d*?)0+$/, '$1');
}

// ---------------------------------------------------------------------------
// 创建 run
// ---------------------------------------------------------------------------

export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',          // playing | won
    time: 0,
    cash: ECO.startCash,
    totalEarned: 0,
    round: 1,                  // 当前融资轮（1-based）
    tapLevel: 0,
    autoLevel: 0,
    partners: {},              // id -> true
    bet: -1,                   // 本周期押注的赛道下标；-1 = 未押
    hotSector: -1,             // 本周期揭晓的风口；-1 = 未揭晓
    windfall: {
      cycleRemaining: WINDFALL.cycleSec,
      active: false,
      activeRemaining: 0,
    },
    burn: {
      active: false,
      activeRemaining: 0,
      cooldownRemaining: 0,
    },
    sectors: SECTORS.map((s, i) => ({ index: i, id: s.id, heat: 30 + Math.floor(rng() * 40), vel: (rng() - 0.5) * 4 })),
    stats: {
      clicks: 0,
      upgradesBought: 0,
      partnersHired: 0,
      betsPlaced: 0,
      betsWon: 0,
      betsLost: 0,
      roundsReached: 1,
      totalEarned: 0,
      maxIncomeRate: 0,
    },
    events: [],
    _nextMilestone: 10,
    _lastIncomeEmit: -1,
    _incomeAccum: 0,
  };

  // ---- 派生数值 ----
  function clickPowerOf() {
    const u = UPGRADES.find((x) => x.id === 'tap');
    return u.base * Math.pow(u.mult, run.tapLevel);
  }
  function autoPerSecOf() {
    const u = UPGRADES.find((x) => x.id === 'auto');
    return u.base * Math.pow(u.mult, run.autoLevel);
  }
  function partnerIncomeOf() {
    let s = 0;
    for (const p of PARTNERS) if (run.partners[p.id]) s += p.income;
    return s;
  }
  function incomePerSec() {
    return autoPerSecOf() + partnerIncomeOf();
  }
  function mult() {
    return (run.burn.active ? BURN.mult : 1) * (run.windfall.active ? WINDFALL.mult : 1);
  }

  function addIncome(amount) {
    run.cash += amount;
    run.totalEarned += amount;
    run.stats.totalEarned = run.totalEarned;
    const rate = incomePerSec() * mult();
    if (rate > run.stats.maxIncomeRate) run.stats.maxIncomeRate = rate;
  }

  // ---- 估值里程碑（每 10 倍一个可感知事件） ----
  function checkMilestones() {
    while (run.totalEarned >= run._nextMilestone) {
      emit(run, 'milestone', { milestone: run._nextMilestone });
      run._nextMilestone *= 10;
      if (run._nextMilestone > 1e9) run._nextMilestone = 1e9;
    }
  }

  // ---- 融资轮推进 ----
  function checkRounds() {
    while (run.round <= ROUNDS.length && run.totalEarned >= ROUNDS[run.round - 1].target) {
      const completed = run.round;
      const key = ROUNDS[completed - 1].key;
      run.round += 1;
      if (run.round > run.stats.roundsReached) run.stats.roundsReached = run.round;
      emit(run, 'fund', { round: completed, key, valuation: run.totalEarned });
      emit(run, 'valuationFlip', { round: completed, key, valuation: run.totalEarned });
      if (completed >= ROUNDS.length) {
        run.phase = 'won';
        emit(run, 'won', { valuation: run.totalEarned });
        break;
      }
    }
  }

  // ---- 风口轮盘热度漂移 ----
  function driftHeat(dt) {
    for (const s of run.sectors) {
      s.vel = clamp(s.vel + (rng() - 0.5) * 2 * WINDFALL.heatDrift * dt, -WINDFALL.heatSpeed, WINDFALL.heatSpeed);
      s.heat = clamp(s.heat + s.vel * dt, 8, 92);
    }
  }

  // ---- 风口结算 ----
  function resolveWindfall() {
    let hot = 0;
    for (let i = 1; i < run.sectors.length; i += 1) {
      if (run.sectors[i].heat > run.sectors[hot].heat) hot = i;
    }
    run.hotSector = hot;
    if (run.bet >= 0) {
      if (run.bet === hot) {
        run.stats.betsWon += 1;
        run.windfall.active = true;
        run.windfall.activeRemaining = WINDFALL.activeSec;
        emit(run, 'betWin', { sector: run.sectors[hot].id });
      } else {
        run.stats.betsLost += 1;
        emit(run, 'betLose', { sector: run.sectors[run.bet].id, hot: run.sectors[hot].id });
      }
    }
  }

  function stepWindfall(dt) {
    if (run.windfall.active) {
      run.windfall.activeRemaining -= dt;
      if (run.windfall.activeRemaining <= 0) {
        run.windfall.active = false;
        run.windfall.activeRemaining = 0;
      }
    }
    run.windfall.cycleRemaining -= dt;
    if (run.windfall.cycleRemaining <= 0) {
      resolveWindfall();
      run.windfall.cycleRemaining = WINDFALL.cycleSec;
      run.bet = -1;
      run.hotSector = -1;
      emit(run, 'windfall', {});
    }
  }

  function stepBurn(dt) {
    if (run.burn.active) {
      run.burn.activeRemaining -= dt;
      if (run.burn.activeRemaining <= 0) {
        run.burn.active = false;
        run.burn.activeRemaining = 0;
        run.burn.cooldownRemaining = BURN.cooldownSec;
        emit(run, 'burnEnd', {});
      }
    } else if (run.burn.cooldownRemaining > 0) {
      run.burn.cooldownRemaining = Math.max(0, run.burn.cooldownRemaining - dt);
    }
  }

  // ---- 每 tick ----
  function step() {
    if (run.phase !== 'playing') return;
    const dt = STEP;
    run.time += dt;

    driftHeat(dt);
    stepWindfall(dt);
    stepBurn(dt);

    // 被动收入（自动 + 伙伴）× 倍率
    const gain = incomePerSec() * dt * mult();
    if (gain > 0) {
      addIncome(gain);
      run._incomeAccum += gain;
      const whole = Math.floor(run.time);
      if (whole > run._lastIncomeEmit) {
        run._lastIncomeEmit = whole;
        emit(run, 'income', { rate: incomePerSec() * mult(), total: run._incomeAccum });
        run._incomeAccum = 0;
      }
    }

    checkMilestones();
    checkRounds();

    // 细粒度心跳事件（静默）：每步估值都在变，保证事件密度 / 无死时间（fun-report 遥测用）
    emit(run, 'pulse', { rate: incomePerSec() * mult() });
  }

  // ---- 离散操作 ----
  function click() {
    if (run.phase !== 'playing') return false;
    const amount = clickPowerOf() * mult();
    addIncome(amount);
    run.stats.clicks += 1;
    emit(run, 'click', { amount });
    checkMilestones();
    checkRounds();
    return true;
  }

  function buyUpgrade(id) {
    if (run.phase !== 'playing') return false;
    const u = UPGRADES.find((x) => x.id === id);
    if (!u) return false;
    const level = id === 'tap' ? run.tapLevel : run.autoLevel;
    const cost = Math.floor(u.baseCost * Math.pow(u.costMult, level));
    if (run.cash < cost) return false;
    run.cash -= cost;
    if (id === 'tap') run.tapLevel += 1;
    else run.autoLevel += 1;
    run.stats.upgradesBought += 1;
    emit(run, 'upgrade', { id, level: level + 1, cost });
    return true;
  }

  function hirePartner(id) {
    if (run.phase !== 'playing') return false;
    const p = PARTNERS.find((x) => x.id === id);
    if (!p || run.partners[id]) return false;
    if (run.cash < p.cost) return false;
    run.cash -= p.cost;
    run.partners[id] = true;
    run.stats.partnersHired += 1;
    emit(run, 'hire', { id, income: p.income, cost: p.cost });
    return true;
  }

  function placeBet(index) {
    if (run.phase !== 'playing') return false;
    if (run.bet >= 0) return false;
    if (index < 0 || index >= run.sectors.length) return false;
    run.bet = index;
    run.stats.betsPlaced += 1;
    emit(run, 'bet', { sector: run.sectors[index].id });
    return true;
  }

  function toggleBurn() {
    if (run.phase !== 'playing') return false;
    if (run.burn.active) return false;
    if (run.burn.cooldownRemaining > 0) return false;
    run.burn.active = true;
    run.burn.activeRemaining = BURN.activeSec;
    emit(run, 'burnStart', {});
    return true;
  }

  // ---- HUD ----
  function getHud() {
    const currentRound = Math.min(run.round, ROUNDS.length);
    const target = roundTarget(currentRound);
    return {
      cash: run.cash,
      valuation: run.totalEarned,
      incomePerSec: incomePerSec(),
      mult: mult(),
      clickPower: clickPowerOf(),
      tapLevel: run.tapLevel,
      autoLevel: run.autoLevel,
      round: currentRound,
      roundName: `round.${ROUNDS[currentRound - 1].key}`,
      roundTarget: target,
      roundProgress: run.phase === 'won' ? 1 : clamp(run.totalEarned / target, 0, 1),
      sceneId: sceneIdForRound(currentRound),
      burnActive: run.burn.active,
      burnActiveRemaining: run.burn.activeRemaining,
      burnCooldownRemaining: run.burn.cooldownRemaining,
      windfallCycleRemaining: run.windfall.cycleRemaining,
      windfallActive: run.windfall.active,
      windfallActiveRemaining: run.windfall.activeRemaining,
      hotSector: run.hotSector,
      bet: run.bet,
      sectors: run.sectors.map((s) => ({ id: s.id, index: s.index, heat: s.heat, bet: s.index === run.bet })),
      partnersOwned: Object.keys(run.partners).length,
      partnersTotal: PARTNERS.length,
      partners: { ...run.partners },
      phase: run.phase,
    };
  }

  // ---- 事件 ----
  function emit(r, type, fields = {}) {
    r.events.push({ type, ...fields });
  }

  function drainEvents() {
    const ev = run.events;
    run.events = [];
    return ev;
  }

  run.step = step;
  run.click = click;
  run.buyUpgrade = buyUpgrade;
  run.hirePartner = hirePartner;
  run.placeBet = placeBet;
  run.toggleBurn = toggleBurn;
  run.getHud = getHud;
  run.drainEvents = drainEvents;
  run.clickPowerOf = clickPowerOf;
  run.incomePerSecOf = incomePerSec;
  run.multOf = mult;

  return run;
}

export { UPGRADES, PARTNERS, ROUNDS, SECTORS };
