// src/game/sim.js — WATER RITUAL 玩法核心（纯逻辑，零依赖，不碰 DOM/Date/localStorage）。
// 契约：
//   createRun({ seed, day }) → run
//   run.step(input)         input = { pouring: bool, skip: bool }
//   run.getHud() / run.drainEvents() / run.skip() / run.nextDay() / run.buyUpgrade(id) / run.autoShop()
// 事件名（drainEvents 消费）：customerEnter / orderStart / pourStart / pourTick / levelNear /
//   tempWindowEnter / pourFeather / pourAbort / orderScored / perfect / spill / orderExpired /
//   orderFailed / heartLost / rushWave / fullHouse / dayStart / dayEnd / upgradeUnlock / win / death
import { TEA, SCENES } from '../../config/tea.js';
import { mulberry32, randInt, pick, clamp } from './rng.js';

const clamp01 = (v) => clamp(v, 0, 1);

// ---------- 有效速率（受升级影响） ----------
function effRates(run) {
  const pourRate = TEA.pourRate * (run.upgrades.slowPour ? 0.8 : 1);
  const coolRate = TEA.coolRate * (run.upgrades.iceReserve ? 0.72 : 1);
  return { pourRate, coolRate };
}

function tempDist(temp, window) {
  const [lo, hi] = window;
  if (temp >= lo && temp <= hi) return 0;
  return temp < lo ? lo - temp : temp - hi;
}

// ---------- 创建 run ----------
export function createRun({ seed = 0, day = 1 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    seed: seed >>> 0,
    rng,
    phase: 'playing',            // playing | shop | dead | won
    time: 0,
    day: clamp(day, 1, TEA.daysTotal),
    scene: sceneForDay(clamp(day, 1, TEA.daysTotal)),
    coins: 0,
    hearts: TEA.heartsMax,
    dayOrdersFilled: 0,
    dayTarget: dayTargetFor(clamp(day, 1, TEA.daysTotal)),
    dayCoins: 0,
    orderIndex: 0,               // 本局累计上客数（用于高峰节奏）
    untilRush: TEA.rushEvery,
    rushActive: false,
    rushRemaining: 0,
    rushStreak: 0,
    combo: 0,
    maxCombo: 0,
    lastOrderAt: -Infinity,
    perfects: 0,
    fullHouses: 0,
    failedOrders: 0,
    forgivenToday: false,
    upgrades: {},                // id -> true
    currentOrder: null,
    spawnDelay: 0,
    pour: { state: 'idle', level: 0, temp: TEA.startTemp, startedAt: 0, pendingSince: 0, levelNear: false, tempInWindow: false },
    stats: { maxDay: clamp(day, 1, TEA.daysTotal), perfects: 0, fullHouses: 0, maxCombo: 0 },
    events: [],
    nextId: 1,
  };
  run.step = (input) => step(run, input || {});
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.skip = () => skipOrder(run);
  run.nextDay = () => nextDay(run);
  run.buyUpgrade = (id) => buyUpgrade(run, id);
  run.autoShop = () => autoShop(run);
  emit(run, 'dayStart', { day: run.day });
  maybeSpawn(run);
  return run;
}

function dayTargetFor(day) {
  return Math.round(TEA.dayTargetBase + (day - 1) * TEA.dayTargetGrowth);
}
function sceneForDay(day) {
  return TEA.sceneByDay[clamp(day, 1, TEA.daysTotal) - 1] || 1;
}

// ---------- 每 tick ----------
function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = 1 / 60;
  run.time += dt;

  const pouring = !!input.pouring;
  if (input.skip) skipOrder(run);

  updatePour(run, pouring, dt);

  // 耐心流失
  if (run.currentOrder) {
    run.currentOrder.patience -= dt;
    if (run.currentOrder.patience <= 0) {
      failOrder(run, 'expired');
      return;
    }
  }

  maybeSpawn(run);
}

function updatePour(run, pouring, dt) {
  const p = run.pour;
  const rates = effRates(run);

  if (p.state === 'idle' && pouring && run.currentOrder) {
    p.state = 'pouring';
    p.level = 0;
    p.temp = TEA.startTemp;
    p.startedAt = run.time;
    p.levelNear = false;
    p.tempInWindow = false;
    emit(run, 'pourStart', {});
  }

  if (p.state === 'pouring') {
    if (!pouring) {
      p.state = 'pending';
      p.pendingSince = run.time;
      return;
    }
    p.level += rates.pourRate * dt;
    p.temp = Math.max(TEA.minTemp, p.temp - rates.coolRate * dt);
    // 细粒度里程碑事件：倒水过程每 tick 都有可感知反馈（水位/水温都在动）
    emit(run, 'pourTick', { level: p.level, temp: p.temp });

    const o = run.currentOrder;
    if (o && !p.levelNear && Math.abs(p.level - o.line) <= TEA.goodLevelTol) {
      p.levelNear = true;
      emit(run, 'levelNear', { level: p.level });
    }
    if (o && !p.tempInWindow && tempDist(p.temp, o.tempWindow) === 0) {
      p.tempInWindow = true;
      emit(run, 'tempWindowEnter', { temp: p.temp });
    }
    if (p.level >= TEA.maxLevel) {
      failOrder(run, 'spill');
    }
  } else if (p.state === 'pending') {
    if (pouring) {
      p.state = 'pouring';
      emit(run, 'pourFeather', { level: p.level });
    } else {
      // 松手宽限期内保持细粒度反馈（水位/水温悬停），压掉空转
      emit(run, 'pourTick', { level: p.level, temp: p.temp, settling: true });
      if (run.time - p.pendingSince >= TEA.featherMs / 1000) {
        commitPour(run);
      }
    }
  }
}

// ---------- 结算 ----------
function commitPour(run) {
  const p = run.pour;
  const o = run.currentOrder;
  p.state = 'idle';

  if (!o) { resetPour(run); return; }
  if (p.level < TEA.minPourLevel) {
    emit(run, 'pourAbort', { level: p.level });
    resetPour(run);
    return; // 没倒到水位，订单仍等待
  }

  const levelError = Math.abs(p.level - o.line);
  const tErr = tempDist(p.temp, o.tempWindow);
  const levelScore = levelError <= TEA.perfectLevelTol
    ? 1
    : clamp01(1 - (levelError - TEA.perfectLevelTol) / (TEA.goodLevelTol - TEA.perfectLevelTol));
  const tempScore = tErr <= 0 ? 1 : clamp01(1 - tErr / TEA.goodTempTol);
  const accuracy = Math.round(100 * (TEA.levelWeight * levelScore + TEA.tempWeight * tempScore));
  const rating = accuracy >= TEA.perfectAccuracy ? 'perfect'
    : accuracy >= TEA.goodAccuracy ? 'good'
      : accuracy >= 50 ? 'ok' : 'poor';
  const reward = computeReward(run, o, rating);

  run.coins += reward;
  run.dayCoins += reward;
  run.dayOrdersFilled += 1;
  run.orderIndex += 1;
  run.combo = (run.time - run.lastOrderAt <= TEA.comboWindowSec) ? run.combo + 1 : 1;
  run.lastOrderAt = run.time;
  run.maxCombo = Math.max(run.maxCombo, run.combo);
  const perfect = rating === 'perfect';
  if (perfect) {
    run.perfects += 1;
    if (run.rushActive) run.rushStreak += 1;
  } else if (run.rushActive) {
    run.rushStreak = 0;
  }

  run.stats.perfects = run.perfects;
  run.stats.fullHouses = run.fullHouses;
  run.stats.maxCombo = run.maxCombo;
  run.stats.maxDay = Math.max(run.stats.maxDay, run.day);

  emit(run, 'orderScored', { accuracy, rating, reward, perfect });
  if (perfect) emit(run, 'perfect', { accuracy, reward });
  run.currentOrder = null;
  run.spawnDelay = run.rushActive ? TEA.rushSpawnDelay : TEA.spawnDelay;
  emit(run, 'customerApproaching', {});
  resetPour(run);

  rushBookkeeping(run, perfect);

  if (run.dayOrdersFilled >= run.dayTarget) endDay(run);
}

function computeReward(run, o, rating) {
  let reward = o.reward;
  if (rating === 'perfect' && run.upgrades.goldenRipple) reward *= 2;
  if (run.rushActive && run.upgrades.rushMaster) reward *= 2;
  if (run.upgrades.coinUp) reward = Math.round(reward * 1.3);
  return reward;
}

function rushBookkeeping(run, perfect) {
  if (run.rushActive) {
    if (run.rushStreak >= TEA.fullHouseStreak) {
      run.fullHouses += 1;
      run.rushStreak = 0;
      emit(run, 'fullHouse', {});
    }
    run.rushRemaining -= 1;
    if (run.rushRemaining <= 0) run.rushActive = false;
  }
  run.untilRush -= 1;
  if (run.untilRush <= 0) {
    run.rushActive = true;
    run.rushRemaining = TEA.rushEvery;
    run.rushStreak = 0;
    run.untilRush = TEA.rushEvery;
    emit(run, 'rushWave', {});
  }
}

function failOrder(run, reason) {
  if (run.phase !== 'playing') return;
  const o = run.currentOrder;
  emit(run, reason === 'spill' ? 'spill' : 'orderExpired', {});
  emit(run, 'orderFailed', { reason });

  run.failedOrders += 1;
  run.currentOrder = null;
  resetPour(run);
  run.spawnDelay = run.rushActive ? TEA.rushSpawnDelay : TEA.spawnDelay;
  emit(run, 'customerApproaching', {});

  // 二次机会：每天第一次失败不扣心
  let forgiven = false;
  if (run.upgrades.secondChance && !run.forgivenToday) {
    run.forgivenToday = true;
    forgiven = true;
  }
  if (!forgiven) {
    run.hearts -= 1;
    emit(run, 'heartLost', { hearts: run.hearts });
    if (run.hearts <= 0) {
      run.phase = 'dead';
      emit(run, 'death', {});
    }
  }
}

function resetPour(run) {
  run.pour = { state: 'idle', level: 0, temp: TEA.startTemp, startedAt: 0, pendingSince: 0, levelNear: false, tempInWindow: false };
}

function skipOrder(run) {
  if (run.phase !== 'playing' || !run.currentOrder) return;
  emit(run, 'orderSkipped', {});
  run.currentOrder = null;
  resetPour(run);
  run.spawnDelay = run.rushActive ? TEA.rushSpawnDelay : TEA.spawnDelay;
  emit(run, 'customerApproaching', {});
}

// ---------- 上客 ----------
function maybeSpawn(run) {
  if (run.phase !== 'playing') return;
  if (run.currentOrder) return;
  if (run.dayOrdersFilled >= run.dayTarget) return; // 等 endDay 切走
  if (run.spawnDelay > 0) {
    run.spawnDelay -= 1 / 60;
    if (run.spawnDelay > 0) return;
  }
  genOrder(run);
}

function genOrder(run) {
  const rates = effRates(run);
  const tea = pick(run.rng, Object.values(TEA.teas));
  const guestKey = TEA.guestRotation[run.orderIndex % TEA.guestRotation.length];
  const guest = TEA.guests[guestKey] || TEA.guests.regular;

  const line = +(guest.levelRange[0] + run.rng() * (guest.levelRange[1] - guest.levelRange[0])).toFixed(3);
  const targetTime = line / rates.pourRate;
  const centerTemp = TEA.startTemp - rates.coolRate * targetTime;
  const windowHalf = tea.windowHalf * guest.windowMul;
  const tempWindow = [Math.max(TEA.minTemp, centerTemp - windowHalf), centerTemp + windowHalf];

  let patience = TEA.patienceBase * guest.patienceMul;
  if (guestKey === 'regular' && run.upgrades.regularFriend) patience *= 1.35;

  const reward = Math.round(tea.reward * guest.rewardMul);

  emit(run, 'customerEnter', { guest: guestKey, tea: tea.id });

  run.currentOrder = {
    id: run.nextId++,
    teaId: tea.id,
    teaKey: tea.key,
    teaColor: tea.color,
    guestKey,
    guestNameKey: guest.key,
    line,
    tempWindow,
    patience,
    patienceMax: patience,
    reward,
    rush: run.rushActive,
  };
  emit(run, 'orderStart', { orderId: run.currentOrder.id, line, tempWindow, patience, reward, guest: guestKey, tea: tea.id });
}

// ---------- 天切换 ----------
function endDay(run) {
  run.phase = 'shop';
  emit(run, 'dayEnd', { day: run.day, dayCoins: run.dayCoins });
}

function nextDay(run) {
  if (run.phase !== 'shop') return;
  if (run.day >= TEA.daysTotal) {
    run.phase = 'won';
    run.stats.maxDay = Math.max(run.stats.maxDay, run.day);
    emit(run, 'win', { coins: run.coins, days: run.day, perfects: run.perfects, fullHouses: run.fullHouses });
    return;
  }
  run.day += 1;
  run.scene = sceneForDay(run.day);
  run.dayOrdersFilled = 0;
  run.dayCoins = 0;
  run.hearts = TEA.heartsMax + (run.upgrades.heartUp ? 1 : 0);
  run.forgivenToday = false;
  run.dayTarget = dayTargetFor(run.day);
  run.untilRush = TEA.rushEvery;
  run.rushActive = false;
  run.rushRemaining = 0;
  run.rushStreak = 0;
  run.currentOrder = null;
  resetPour(run);
  run.spawnDelay = 0.6;
  run.phase = 'playing';
  run.stats.maxDay = Math.max(run.stats.maxDay, run.day);
  emit(run, 'dayStart', { day: run.day });
  maybeSpawn(run);
}

function buyUpgrade(run, id) {
  const def = TEA.upgrades.find((u) => u.id === id);
  if (!def || run.upgrades[id]) return false;
  if (run.coins < def.cost) return false;
  run.coins -= def.cost;
  run.upgrades[id] = true;
  emit(run, 'upgradeUnlock', { id });
  return true;
}

function autoShop(run) {
  // bot / 自动：买最便宜的规则型升级，然后进下一天
  if (run.phase !== 'shop') return;
  const affordable = TEA.upgrades
    .filter((u) => u.kind === 'rule' && !run.upgrades[u.id] && run.coins >= u.cost)
    .sort((a, b) => a.cost - b.cost);
  if (affordable.length) buyUpgrade(run, affordable[0].id);
  nextDay(run);
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const o = run.currentOrder;
  const scene = SCENES[run.scene] || SCENES[1];
  return {
    phase: run.phase,
    day: run.day,
    scene: run.scene,
    sceneKey: scene.key,
    coins: run.coins,
    hearts: run.hearts,
    heartsMax: TEA.heartsMax + (run.upgrades.heartUp ? 1 : 0),
    dayOrdersFilled: run.dayOrdersFilled,
    dayTarget: run.dayTarget,
    combo: run.combo,
    rushActive: run.rushActive,
    rushStreak: run.rushStreak,
    showWindow: !!run.upgrades.thermometer,
    currentOrder: o ? {
      teaKey: o.teaKey,
      teaColor: o.teaColor,
      guestNameKey: o.guestNameKey,
      line: o.line,
      tempWindow: [o.tempWindow[0], o.tempWindow[1]],
      patience: o.patience,
      patienceMax: o.patienceMax,
      reward: o.reward,
      rush: o.rush,
    } : null,
    pour: { state: run.pour.state, level: run.pour.level, temp: run.pour.temp },
    upgrades: Object.keys(run.upgrades),
    bestDays: run.stats.maxDay,
    perfects: run.perfects,
    fullHouses: run.fullHouses,
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
