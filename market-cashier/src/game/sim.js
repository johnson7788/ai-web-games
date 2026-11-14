// 纯逻辑：收银（扫码 → 合计 → 找零）+ 班次/升级/连击/耐心。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。金额单位：分。
import { PRODUCTS, DENOMINATIONS } from '../../config/products.js';
import { RULES, DAYS, RANKS } from '../../config/game.config.js';
import { CUSTOMER_TYPES, CUSTOMER_NAMES, pickCustomerType } from '../../config/customers.js';
import { UPGRADES, UPGRADE_BY_ID } from '../../config/upgrades.js';
import { TUTORIAL_SEED } from '../../config/tutorial.js';

function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function has(run, id) {
  return run.upgrades.includes(id);
}

function dayConf(run) {
  return DAYS[Math.min(run.dayIndex, DAYS.length - 1)];
}

export function getTarget(run) {
  const base = dayConf(run).target;
  return Math.round(base * (has(run, 'express-target') ? 0.9 : 1));
}

function tipCap(run) {
  return RULES.tipCap + (has(run, 'generous-tips') ? 25 : 0);
}

function comboCap(run) {
  return has(run, 'combo-master') ? RULES.comboMax + 1 : RULES.comboMax;
}

export function multiplier(run) {
  const base = 1 + Math.min(run.combo, comboCap(run)) * RULES.comboStep;
  return Math.round((base + (has(run, 'combo-master') ? 0.25 : 0)) * 100) / 100;
}

function pickItems(run, type) {
  const count = type.minItems + Math.floor(run.rng() * (type.maxItems - type.minItems + 1));
  const pool = [...PRODUCTS];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(run.rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).map((p) => ({
    name: p.name,
    price: p.price,
    emoji: p.emoji,
    color: p.color,
    scanned: false,
  }));
}

export function newCustomer(run) {
  const conf = dayConf(run);
  const type = pickCustomerType(run.rng, conf.weights);
  const items = pickItems(run, type);
  const total = items.reduce((a, x) => a + x.price, 0);
  const exact = run.rng() < conf.exactChance;
  let payment = total;
  if (!exact) {
    payment = Math.ceil(total / 1000) * 1000;
    if (payment === total) payment += 1000;
  }
  const patienceMul = type.patienceMul * (has(run, 'patient-customers') ? 1.25 : 1);
  const namePool = CUSTOMER_NAMES;
  const nameIdx = Math.floor(run.rng() * namePool.en.length);
  const patienceMax = Math.round(RULES.patience * patienceMul * 10) / 10;
  run.customer = {
    type: type.id,
    typeName: type.name,
    nameIdx,
    name: { en: namePool.en[nameIdx], zh: namePool.zh[nameIdx] },
    hair: type.hair[Math.floor(run.rng() * type.hair.length)],
    shirt: type.shirt[Math.floor(run.rng() * type.shirt.length)],
    items,
    total,
    payment,
    change: payment - total,
    exact,
    patienceMax,
  };
  run.phase = 'scan';
  run.givenChange = 0;
  run.givenStack = [];
  run.patience = patienceMax;
  run.events.push({ type: 'customer', customerType: type.id, exact });
  return run.customer;
}

export function createRun({ seed = 1 } = {}) {
  const run = {
    seed: seed >>> 0,
    rng: makeRng(seed),
    dayIndex: 0,
    dayScore: 0,
    dayStartScore: 0,
    dayMistakes: 0,
    retries: 0,
    score: 0,
    served: 0,
    customerIndex: 0,
    combo: 0,
    tutorial: false,
    upgrades: [],
    stats: { perfect: 0, bestCombo: 0, tips: 0 },
    lastBonus: 0,
    lastPerfect: false,
    customer: null,
    phase: 'scan',
    givenChange: 0,
    givenStack: [],
    patience: RULES.patience,
    events: [],
  };
  newCustomer(run);
  return run;
}

export function scanItem(run, idx) {
  if (run.phase !== 'scan') return { ok: false };
  const item = run.customer.items[idx];
  if (!item || item.scanned) return { ok: false };
  item.scanned = true;
  run.events.push({ type: 'scan', idx, name: item.name, price: item.price });
  if (run.customer.items.every((x) => x.scanned)) {
    run.phase = 'change';
    run.events.push({ type: 'allScanned', total: run.customer.total });
  }
  return { ok: true };
}

export function addMoney(run, cents) {
  if (run.phase !== 'change') return { ok: false };
  if (!Number.isFinite(cents) || cents <= 0) return { ok: false };
  run.givenChange += cents;
  run.givenStack.push(cents);
  run.events.push({ type: 'money', cents, given: run.givenChange });
  return { ok: true };
}

export function resetChange(run) {
  if (run.phase !== 'change') return { ok: false };
  run.givenChange = 0;
  run.givenStack = [];
  run.events.push({ type: 'reset' });
  return { ok: true };
}

function endCustomer(run) {
  run.customerIndex += 1;
  if (run.customerIndex < RULES.dayCustomers) {
    newCustomer(run);
    return;
  }
  const target = getTarget(run);
  if (run.dayScore >= target) {
    const perfect = run.dayMistakes === 0;
    const bonus = RULES.dayBonus
      + (has(run, 'loyalty') ? RULES.loyaltyBonus : 0)
      + (perfect ? RULES.perfectBonus : 0);
    run.dayScore += bonus;
    run.score += bonus;
    run.lastBonus = bonus;
    run.lastPerfect = perfect;
    run.events.push({ type: 'dayClear', day: run.dayIndex + 1, dayScore: run.dayScore, target, bonus, perfect });
    if (run.dayIndex >= DAYS.length - 1) {
      run.phase = 'ending';
      run.events.push({ type: 'gameOver', score: run.score, rank: getRank(run.score) });
    } else {
      run.phase = 'dayClear';
    }
  } else {
    run.phase = 'dayFail';
    run.events.push({ type: 'dayFail', day: run.dayIndex + 1, dayScore: run.dayScore, target });
  }
}

export function giveChange(run) {
  if (run.phase !== 'change') return { ok: false };
  if (run.givenChange === run.customer.change) {
    const type = CUSTOMER_TYPES[run.customer.type] || CUSTOMER_TYPES.regular;
    const patienceFrac = Math.max(0, Math.min(1, run.patience / run.customer.patienceMax));
    const tip = Math.round(patienceFrac * tipCap(run) * type.tipMul);
    const mult = multiplier(run);
    const scanBonus = has(run, 'quick-hands') ? run.customer.items.length * RULES.scanBonus : 0;
    const exactBonus = run.customer.exact && has(run, 'exact-bonus') ? RULES.exactBonus : 0;
    const gained = Math.round((RULES.scorePerCorrect + tip) * mult) + scanBonus + exactBonus;
    run.score += gained;
    run.dayScore += gained;
    run.served += 1;
    run.stats.tips += tip;
    if (patienceFrac >= 0.65) run.stats.perfect += 1;
    run.combo = Math.min(run.combo + 1, comboCap(run));
    run.stats.bestCombo = Math.max(run.stats.bestCombo, run.combo);
    if (run.tutorial) {
      run.phase = 'tutorialDone';
      run.events.push({ type: 'tutorialDone', gained });
      return { ok: true, correct: true, gained, tip, tutorial: true };
    }
    run.events.push({
      type: 'sale', correct: true, gained, tip, combo: run.combo, mult, exact: run.customer.exact,
    });
    endCustomer(run);
    return { ok: true, correct: true, gained, tip };
  }
  run.score = Math.max(run.dayStartScore, run.score - RULES.wrongPenalty);
  run.dayScore = Math.max(0, run.dayScore - RULES.wrongPenalty);
  run.dayMistakes += 1;
  run.combo = 0;
  run.patience -= 3;
  run.events.push({ type: 'sale', correct: false });
  if (run.patience <= 0) {
    run.score = Math.max(run.dayStartScore, run.score - RULES.leavePenalty);
    run.dayScore = Math.max(0, run.dayScore - RULES.leavePenalty);
    run.events.push({ type: 'left', reason: 'wrong' });
    endCustomer(run);
  }
  return { ok: true, correct: false };
}

export function tick(run, dt) {
  if (run.phase !== 'scan' && run.phase !== 'change') return;
  run.patience -= dt;
  if (run.patience <= 0) {
    run.patience = 0;
    run.score = Math.max(run.dayStartScore, run.score - RULES.leavePenalty);
    run.dayScore = Math.max(0, run.dayScore - RULES.leavePenalty);
    run.dayMistakes += 1;
    run.combo = 0;
    run.events.push({ type: 'left', reason: 'patience' });
    endCustomer(run);
  }
}

export function getUpgradeChoices(run, count = 3) {
  const available = UPGRADES.filter((u) => !has(run, u.id));
  const rng = makeRng(run.seed + run.dayIndex * 131 + run.retries * 17 + run.upgrades.length * 7);
  for (let i = available.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, count);
}

export function chooseUpgrade(run, id) {
  if (run.phase !== 'dayClear') return { ok: false };
  if (!UPGRADE_BY_ID[id] || has(run, id)) return { ok: false };
  run.upgrades.push(id);
  run.dayIndex += 1;
  run.dayStartScore = run.score;
  run.dayScore = 0;
  run.customerIndex = 0;
  run.dayMistakes = 0;
  run.retries = 0;
  run.combo = 0;
  run.phase = 'scan';
  run.events.push({ type: 'upgrade', id, day: run.dayIndex + 1 });
  newCustomer(run);
  return { ok: true };
}

export function retryDay(run) {
  if (run.phase !== 'dayFail') return { ok: false };
  run.score = run.dayStartScore;
  run.dayScore = 0;
  run.customerIndex = 0;
  run.dayMistakes = 0;
  run.retries += 1;
  run.combo = 0;
  run.phase = 'scan';
  run.events.push({ type: 'retry', day: run.dayIndex + 1 });
  newCustomer(run);
  return { ok: true };
}

export function suggestChange(run) {
  let remaining = run.customer.change - run.givenChange;
  if (remaining < 0) return [];
  const out = [];
  for (const d of DENOMINATIONS) {
    while (remaining >= d && out.length < 12) {
      out.push(d);
      remaining -= d;
    }
  }
  return remaining === 0 ? out : [];
}

export function getRank(score) {
  return (RANKS.find((r) => score >= r.min) || RANKS[RANKS.length - 1]).id;
}

export function createTutorialRun() {
  const run = createRun({ seed: TUTORIAL_SEED });
  run.tutorial = true;
  run.events = [];
  const items = [
    {
      name: { en: 'Apple', zh: '苹果' }, price: 200, emoji: '🍎', color: '#ef4444', scanned: false,
    },
    {
      name: { en: 'Bread', zh: '面包' }, price: 300, emoji: '🍞', color: '#d97706', scanned: false,
    },
  ];
  const total = 500;
  run.customer = {
    type: 'regular',
    typeName: CUSTOMER_TYPES.regular.name,
    nameIdx: 0,
    name: { en: 'Sam', zh: '小萨' },
    hair: '#3b2f2f',
    shirt: '#5eead4',
    items,
    total,
    payment: 1000,
    change: 500,
    exact: false,
    patienceMax: 300,
  };
  run.phase = 'scan';
  run.givenChange = 0;
  run.givenStack = [];
  run.patience = 300;
  run.events.push({ type: 'customer', customerType: 'regular', exact: false, tutorial: true });
  return run;
}

export function getHud(run) {
  const c = run.customer;
  return {
    phase: run.phase,
    tutorial: !!run.tutorial,
    day: Math.min(run.dayIndex + 1, DAYS.length),
    dayTotal: DAYS.length,
    dayScore: run.dayScore,
    target: getTarget(run),
    score: run.score,
    served: run.served,
    customerNo: Math.min(run.customerIndex + 1, RULES.dayCustomers),
    customerTotal: RULES.dayCustomers,
    combo: run.combo,
    mult: multiplier(run),
    patience: Math.max(0, run.patience),
    patienceMax: c ? c.patienceMax : RULES.patience,
    items: c ? c.items : [],
    total: c ? c.total : 0,
    payment: c ? c.payment : 0,
    change: c ? c.change : 0,
    givenChange: run.givenChange,
    givenStack: [...run.givenStack],
    scanned: c ? c.items.filter((x) => x.scanned).length : 0,
    exact: c ? c.exact : false,
    type: c ? c.type : 'regular',
    typeName: c ? c.typeName : CUSTOMER_TYPES.regular.name,
    name: c ? c.name : { en: 'Customer', zh: '顾客' },
    hair: c ? c.hair : '#3b2f2f',
    shirt: c ? c.shirt : '#5eead4',
    upgrades: [...run.upgrades],
    stats: { ...run.stats },
    mistakes: run.dayMistakes,
    retries: run.retries,
    bonus: run.lastBonus || 0,
    perfectDay: !!run.lastPerfect,
    rank: getRank(run.score),
    suggest: has(run, 'coin-hint') ? suggestChange(run) : [],
    tipPotential: c
      ? Math.round((Math.max(0, Math.min(1, run.patience / c.patienceMax)) * tipCap(run) * (CUSTOMER_TYPES[c.type] || CUSTOMER_TYPES.regular).tipMul))
      : 0,
    tipMax: c ? Math.round(tipCap(run) * (CUSTOMER_TYPES[c.type] || CUSTOMER_TYPES.regular).tipMul) : tipCap(run),
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}
