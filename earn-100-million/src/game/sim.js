// EARN 100 MILLION · 纯逻辑模拟（无 DOM，可在 Node 下跑测试与自对弈）
// 玩法骨架 1:1 源自「挣他一个亿」：倒卖商品 / 公司持股分红 / 房车 / 恋爱 / 随机事件 / 天赋。
// 新机制：① 连击 FLOW（连续盈利卖单放大下一笔收益）② 牛熊市周期（影响商品/股价漂移）③ 星级评级（结算重玩钩子）。
import { GOODS, COMPANIES, HOUSES, CARS, MATES, SKILLS, EVENTS, ACHIEVEMENTS, INIT_CASH } from '../../config/data.js';
import { ECONOMY } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

// ---- 技能加成查找 ----
function skillLevel(skills, id, subId) {
  return (skills && skills[`${id}:${subId}`]) || 0;
}
function skillBonusByType(skills, type) {
  let sum = 0;
  for (const s of SKILLS) {
    if (s.type !== type) continue;
    const lv = skillLevel(skills, s.id, s.subId);
    if (lv >= 1 && lv <= s.cost.length) sum += s.cost[lv - 1][1];
  }
  return sum;
}

// 从技能等级 + 已婚伴侣计算每年/每局加成
export function computeBonuses(skills, marriedMateId) {
  const b = {
    warehouseBonus: skillBonusByType(skills, 1),
    dateBonus: skillBonusByType(skills, 2),
    cashRatio: skillBonusByType(skills, 3),
    initMoney: skillBonusByType(skills, 4),
    stockAdd: skillBonusByType(skills, 5),
    stockUp: skillBonusByType(skills, 6),
    skillPointGet: skillBonusByType(skills, 7),
    dateDiscount: skillBonusByType(skills, 8),
    betBonus: skillBonusByType(skills, 9),
    retireBonus: skillBonusByType(skills, 10),
    initRep: skillBonusByType(skills, 11),
    carDiscount: skillBonusByType(skills, 12),
    eventDiscount: skillBonusByType(skills, 13),
    houseDiscount: skillBonusByType(skills, 14),
    cashPerYear: 0,
    repPerYear: 0,
    hpPerYear: 0,
    treatDiscount: 0,
  };
  if (marriedMateId) {
    const mate = MATES.find((m) => m.id === marriedMateId);
    if (mate) {
      for (const [type, val] of mate.bonus) {
        if (type === 1) b.hpPerYear += val;
        else if (type === 2) b.repPerYear += val;
        else if (type === 3) b.cashPerYear += val;
        else if (type === 4) b.warehouseBonus += val;
        else if (type === 5) b.treatDiscount += val;
      }
    }
  }
  return b;
}

function tierRoll(good, mood, rng) {
  const [t0, t1, t2] = good.tiers;
  let p0 = t0[2];
  let p1 = t0[2] + t1[2];
  if (mood === 1) { p0 = Math.max(0.05, p0 - 0.12); p1 = Math.max(p0 + 0.05, p1 - 0.05); }
  else if (mood === -1) { p0 = Math.min(0.8, p0 + 0.12); p1 = Math.min(0.95, p1 + 0.05); }
  const s = rng();
  if (s < p0) return 0;
  if (s < p1) return 1;
  return 2;
}

function tierPrice(good, tier, rng) {
  const t = good.tiers[tier];
  return Math.floor(t[0] + rng() * (t[1] - t[0]));
}

export function createRun(opts = {}) {
  const seed = (opts.seed == null ? (Date.now() % 2147483647) : opts.seed) >>> 0;
  const rng = mulberry32(seed || 1);
  const sex = opts.sex || 1;
  const skills = opts.skillLevels ? { ...opts.skillLevels } : {};
  const skillPoints = opts.skillPoints || 0;
  const bonuses = computeBonuses(skills, null);

  // 初始现金
  let initCash = opts.initCash;
  if (initCash == null) {
    const roll = rng();
    let acc = 0;
    initCash = INIT_CASH[1].cash;
    for (const c of INIT_CASH) {
      acc += c.weight;
      if (roll <= acc) { initCash = c.cash; break; }
    }
  }
  initCash += bonuses.initMoney;

  const retireAge = ECONOMY.RETIRE_AGE + bonuses.retireBonus;
  const warehouseCap = Math.min(ECONOMY.MAX_WAREHOUSE, ECONOMY.START_WAREHOUSE + bonuses.warehouseBonus);

  const goods = GOODS.map((g) => ({
    id: g.id, ownNum: 0, buyPrice: 0, marketPrice: tierPrice(g, 0, rng), tier: 0,
  }));
  const companies = COMPANIES.map((c) => ({
    id: c.id, shares: 0, costBasis: 0, sharePrice: c.sharePrice, lockYears: 0, bankrupted: false,
  }));
  const houses = HOUSES.map((h) => ({ id: h.id, ownNum: 0 }));
  const cars = CARS.map((c) => ({ id: c.id, ownNum: 0 }));
  const mates = MATES.filter((m) => m.sex === sex).map((m) => ({
    id: m.id, love: 0, level: 0, married: false, canDate: true,
  }));

  const state = {
    phase: 'playing',
    age: ECONOMY.START_AGE,
    retireAge,
    sex,
    cash: initCash,
    hp: ECONOMY.START_HP,
    reputation: bonuses.initRep,
    assets: initCash,
    highAssets: initCash,
    warehouseCap,
    combo: 0,
    bestCombo: 0,
    marketMood: 0,
    inHospital: false,
    goods,
    shownIds: [],
    companies,
    houses,
    cars,
    mates,
    skills,
    skillPoints,
    pendingEvent: null,
    eventPool: EVENTS.map((e) => e.id),
    counters: { bankrupt: 0, create: 0, hospital: 0, million: 0, tenMillion: 0, hundredMillion: 0 },
    achievements: ACHIEVEMENTS.map((a) => ({ id: a.id, done: false })),
    marriedMateId: null,
    marriedAge: 0,
    foundedAge: 0,
    foundedCompanyId: null,
    won: false,
    stars: 0,
    summary: null,
    year: 0,
    simTime: 0,
    betCost: 1000,
    _events: [],
  };

  const emit = (type, payload = {}) => state._events.push({ type, ...payload });

  // ---- 市场：刷新 5 件商品 ----
  function refreshMarket() {
    // 牛熊市转移
    const moodRoll = rng();
    let nextMood = state.marketMood;
    if (nextMood === 0) nextMood = moodRoll < 0.30 ? 1 : (moodRoll < 0.55 ? -1 : 0);
    else if (nextMood === 1) nextMood = moodRoll < 0.55 ? 1 : (moodRoll < 0.75 ? 0 : -1);
    else nextMood = moodRoll < 0.55 ? -1 : (moodRoll < 0.75 ? 0 : 1);
    state.marketMood = nextMood;

    // 抽 5 件展示
    const pool = goods.map((g) => g.id);
    const shown = [];
    while (shown.length < 5 && pool.length) {
      const idx = Math.floor(rng() * pool.length);
      shown.push(pool.splice(idx, 1)[0]);
    }
    state.shownIds = shown;
    for (const g of state.goods) {
      if (shown.includes(g.id)) {
        const good = GOODS.find((x) => x.id === g.id);
        g.tier = tierRoll(good, state.marketMood, rng);
        g.marketPrice = tierPrice(good, g.tier, rng);
      }
    }
    emit('mood', { mood: state.marketMood });
  }

  // ---- 公司股价漂移 ----
  function refreshCompanies() {
    for (const c of state.companies) {
      const data = COMPANIES.find((x) => x.id === c.id);
      if (c.bankrupted) {
        c.sharePrice = data.sharePrice;
        c.bankrupted = false;
        continue;
      }
      const owned = c.shares > 0;
      const table = owned ? data.drift.own : data.drift.idle;
      let s = rng() + (owned ? skillBonusByType(state.skills, 6) / 100 : 0);
      let factor;
      if (s < table[0][2]) {
        const iseed = rng() * (table[0][1] - table[0][0]) + (1 - table[0][1]);
        factor = 1 - iseed;
      } else {
        const iseed = rng() * (table[1][1] - table[1][0]) + (table[1][0] - 1);
        factor = 1 + iseed;
      }
      if (state.marketMood === 1) factor = 1 + (factor - 1) * 1.15;
      if (state.marketMood === -1) factor = 1 + (factor - 1) * 0.85;
      c.sharePrice = Math.round(c.sharePrice * factor * 100) / 100;
      if (c.sharePrice <= data.bankruptAt) {
        if (c.shares > 0) {
          state.cash += Math.floor(c.sharePrice * 0.5 * c.shares);
          c.shares = 0; c.costBasis = 0;
          state.counters.bankrupt += 1;
          emit('bankrupt', { id: c.id });
        }
        c.bankrupted = true;
      }
      if (c.shares > 0 && c.lockYears > 0) c.lockYears -= 1;
    }
  }

  function recomputeAssets() {
    let a = state.cash;
    for (const g of state.goods) {
      const val = state.shownIds.includes(g.id) ? g.marketPrice : g.buyPrice;
      a += g.ownNum * val;
    }
    for (const h of state.houses) {
      const data = HOUSES.find((x) => x.id === h.id);
      a += h.ownNum * data.price;
    }
    for (const c of state.cars) {
      const data = CARS.find((x) => x.id === c.id);
      a += c.ownNum * data.price;
    }
    for (const c of state.companies) a += c.shares * c.sharePrice;
    state.assets = a;
    if (a > state.highAssets) state.highAssets = a;
    if (a >= 1_000_000 && state.counters.million === 0) { state.counters.million = state.age; emit('milestone', { tier: 1 }); }
    if (a >= 10_000_000 && state.counters.tenMillion === 0) { state.counters.tenMillion = state.age; emit('milestone', { tier: 2 }); }
    if (a >= 100_000_000 && state.counters.hundredMillion === 0) { state.counters.hundredMillion = state.age; emit('milestone', { tier: 3 }); }
  }

  function computeStars() {
    let stars = 1;
    if (state.assets >= 1_000_000) stars += 1;
    if (state.assets >= 10_000_000) stars += 1;
    if (state.assets >= 100_000_000) stars += 1;
    if (state.marriedMateId) stars += 1;
    return Math.min(5, stars);
  }

  function finish(phase) {
    state.phase = phase;
    state.won = phase === 'won';
    state.stars = computeStars();
    state.summary = {
      age: state.age,
      assets: state.assets,
      highAssets: state.highAssets,
      millionAge: state.counters.million,
      tenMillionAge: state.counters.tenMillion,
      hundredMillionAge: state.counters.hundredMillion,
      marriedAge: state.marriedAge,
      marriedMateId: state.marriedMateId,
      foundedAge: state.foundedAge,
      foundedCompanyId: state.foundedCompanyId,
      stars: state.stars,
      achievements: state.achievements.filter((a) => a.done).length,
      bankrupt: state.counters.bankrupt,
    };
    emit(phase === 'won' ? 'win' : 'retire', { stars: state.stars });
  }

  // ---- 推进一年 ----
  function nextYear() {
    if (state.phase !== 'playing') return { ok: false };
    if (state.pendingEvent) return { ok: false, reason: 'event' };
    state.age += 1;
    state.year += 1;

    refreshCompanies();
    refreshMarket();

    // 每年加成
    const b = computeBonuses(state.skills, state.marriedMateId);
    state.cash += b.cashPerYear;
    state.cash = Math.floor(state.cash * (1 + b.cashRatio));
    state.reputation += b.repPerYear;
    if (state.reputation < 0) state.reputation = 0;
    state.hp = Math.min(100, state.hp + b.hpPerYear);

    // 公司分红
    for (const c of state.companies) {
      if (c.shares > 0 && c.lockYears <= 0) {
        const data = COMPANIES.find((x) => x.id === c.id);
        const div = Math.floor(c.shares * c.sharePrice * (data.dividend + b.stockAdd / 100));
        if (div > 0) { state.cash += div; emit('dividend', { id: c.id, amount: div }); }
      }
    }

    recomputeAssets();

    // 健康衰减
    if (state.inHospital) {
      state.inHospital = false;
      state.hp = 100;
      emit('recover');
    } else if (state.age >= ECONOMY.HEALTH_SUB_AGE) {
      state.hp -= randInt(rng, 2, 4);
      if (state.hp < ECONOMY.HP_LINE) {
        state.hp = Math.max(0, state.hp);
        state.inHospital = true;
        state.counters.hospital += 1;
        emit('hospital');
      }
    }

    // 胜利判定
    if (state.assets >= ECONOMY.GOAL) { finish('won'); return { ok: true }; }
    // 退休判定
    if (state.age > state.retireAge) { finish('retired'); return { ok: true }; }

    // 随机事件（25 岁后，约每年 45%）
    if (state.age >= 25 && state.eventPool.length > 0 && !state.inHospital && rng() < 0.45) {
      const idx = Math.floor(rng() * state.eventPool.length);
      state.pendingEvent = state.eventPool.splice(idx, 1)[0];
      emit('event', { id: state.pendingEvent });
    }

    emit('year', { age: state.age });
    return { ok: true };
  }

  function answerEvent(choice) {
    if (!state.pendingEvent) return { ok: false };
    const ev = EVENTS.find((e) => e.id === state.pendingEvent);
    const results = choice === 'Y' ? ev.y : ev.n;
    const cost = choice === 'Y' ? ev.costY : ev.costN;
    const [costType, costVal] = cost;
    const b = computeBonuses(state.skills, state.marriedMateId);

    // 支付代价
    if (costType === 1001) {
      const pay = Math.max(0, Math.floor(costVal * (1 - b.eventDiscount)));
      if (state.cash < pay) { state.pendingEvent = null; emit('eventResult', { text: 'noMoney' }); return { ok: true }; }
      state.cash -= pay;
    } else if (costType === 1002) {
      state.hp = Math.max(0, state.hp - costVal);
    } else if (costType === 1003) {
      state.reputation = Math.max(0, state.reputation - costVal);
    }

    // 应用结果（随机取一）
    const res = results[Math.floor(rng() * results.length)];
    applyReward(res, b);
    state.pendingEvent = null;
    recomputeAssets();
    emit('eventResult', { choice, id: ev.id });
    return { ok: true };
  }

  function applyReward([type, value, subId], b) {
    if (type === 1001) {
      state.cash += value;
      if (state.cash < 0) state.cash = 0;
    } else if (type === 1002) {
      state.hp = Math.max(0, Math.min(100, state.hp + value));
    } else if (type === 1003) {
      state.reputation = Math.max(0, state.reputation + value);
    } else if (type === 1004) {
      const g = state.goods.find((x) => x.id === subId);
      if (g && value > 0) {
        const room = state.warehouseCap - warehouseUsed();
        const add = Math.min(value, room);
        if (add > 0) {
          const total = g.buyPrice * g.ownNum + 0; // 白拿，拉低成本
          g.ownNum += add;
          g.buyPrice = g.ownNum ? Math.floor(total / g.ownNum) : 0;
        }
      }
    } else if (type === 1007) {
      const c = state.companies.find((x) => x.id === subId);
      if (c) c.shares += value;
    } else if (type === 1008) {
      const c = state.companies.find((x) => x.id === subId);
      if (c && c.shares > 0) c.sharePrice += value;
    }
  }

  function warehouseUsed() {
    return state.goods.reduce((s, g) => s + g.ownNum, 0);
  }

  function goodShown(id) {
    return state.shownIds.includes(id);
  }

  // ---- 交易 ----
  function buyGoods(id, qty = 1) {
    if (state.phase !== 'playing' || state.inHospital) return { ok: false };
    if (!goodShown(id)) return { ok: false, reason: 'notShown' };
    const g = state.goods.find((x) => x.id === id);
    qty = Math.max(1, qty | 0);
    const cost = g.marketPrice * qty;
    if (state.cash < cost) return { ok: false, reason: 'money' };
    if (warehouseUsed() + qty > state.warehouseCap) return { ok: false, reason: 'space' };
    state.cash -= cost;
    const total = g.buyPrice * g.ownNum + cost;
    g.ownNum += qty;
    g.buyPrice = Math.floor(total / g.ownNum);
    emit('buy', { id, qty, price: g.marketPrice });
    return { ok: true };
  }

  function sellGoods(id, qty = 1) {
    if (state.phase !== 'playing' || state.inHospital) return { ok: false };
    const g = state.goods.find((x) => x.id === id);
    if (!g || g.ownNum <= 0) return { ok: false, reason: 'none' };
    qty = Math.min(g.ownNum, Math.max(1, qty | 0));
    const price = goodShown(id) ? g.marketPrice : g.buyPrice;
    const profit = price >= g.buyPrice;
    const comboMult = 1 + state.combo * 0.08;
    const revenue = Math.floor(price * qty * comboMult);
    state.cash += revenue;
    g.ownNum -= qty;
    if (profit) {
      state.combo = Math.min(5, state.combo + 1);
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      emit('profit', { id, profit: revenue - price * qty });
    } else {
      state.combo = 0;
    }
    emit('sell', { id, qty, price, revenue, combo: state.combo });
    return { ok: true };
  }

  // ---- 公司 ----
  function hasCompany() {
    return state.companies.some((c) => c.shares > 0);
  }
  function createCompany(id) {
    if (state.phase !== 'playing' || state.inHospital) return { ok: false };
    if (hasCompany()) return { ok: false, reason: 'hasCompany' };
    const data = COMPANIES.find((x) => x.id === id);
    const c = state.companies.find((x) => x.id === id);
    const cost = 100 * data.sharePrice;
    if (state.cash < cost) return { ok: false, reason: 'money' };
    state.cash -= cost;
    c.shares = 100;
    c.costBasis = data.sharePrice;
    c.lockYears = data.lockYears;
    c.bankrupted = false;
    state.counters.create += 1;
    if (state.foundedAge === 0) { state.foundedAge = state.age; state.foundedCompanyId = id; }
    emit('company', { id, price: data.sharePrice });
    return { ok: true };
  }
  function buyStock(id, blocks = 1) {
    if (state.phase !== 'playing' || state.inHospital) return { ok: false };
    const c = state.companies.find((x) => x.id === id);
    if (!c || c.shares <= 0) return { ok: false, reason: 'none' };
    if (c.lockYears > 0) return { ok: false, reason: 'locked' };
    blocks = Math.max(1, blocks | 0);
    const cost = 100 * blocks * c.sharePrice;
    if (state.cash < cost) return { ok: false, reason: 'money' };
    state.cash -= cost;
    c.shares += 100 * blocks;
    c.costBasis = (c.costBasis * (c.shares - 100 * blocks) + 100 * blocks * c.sharePrice) / c.shares;
    emit('stockBuy', { id, blocks });
    return { ok: true };
  }
  function sellStock(id, blocks = 1) {
    if (state.phase !== 'playing' || state.inHospital) return { ok: false };
    const c = state.companies.find((x) => x.id === id);
    if (!c || c.shares <= 0) return { ok: false, reason: 'none' };
    if (c.lockYears > 0) return { ok: false, reason: 'locked' };
    blocks = Math.min(Math.floor(c.shares / 100), Math.max(1, blocks | 0));
    state.cash += 100 * blocks * c.sharePrice;
    c.shares -= 100 * blocks;
    if (c.shares <= 0) { c.costBasis = 0; }
    emit('stockSell', { id, blocks });
    return { ok: true };
  }

  // ---- 房 / 车 ----
  function buyHouse(id) {
    if (state.phase !== 'playing' || state.inHospital) return { ok: false };
    const data = HOUSES.find((x) => x.id === id);
    const h = state.houses.find((x) => x.id === id);
    const b = computeBonuses(state.skills, state.marriedMateId);
    const cost = data.price - Math.floor(data.price * b.houseDiscount);
    if (state.cash < cost) return { ok: false, reason: 'money' };
    state.cash -= cost;
    h.ownNum += 1;
    state.reputation += data.rep;
    state.hp = Math.min(100, state.hp + data.hp);
    emit('house', { id });
    return { ok: true };
  }
  function sellHouse(id) {
    const h = state.houses.find((x) => x.id === id);
    if (!h || h.ownNum <= 0) return { ok: false, reason: 'none' };
    const data = HOUSES.find((x) => x.id === id);
    h.ownNum -= 1;
    state.cash += Math.floor(data.price / 2);
    emit('houseSell', { id });
    return { ok: true };
  }
  function buyCar(id) {
    if (state.phase !== 'playing' || state.inHospital) return { ok: false };
    const data = CARS.find((x) => x.id === id);
    const c = state.cars.find((x) => x.id === id);
    const b = computeBonuses(state.skills, state.marriedMateId);
    const cost = data.price - Math.floor(data.price * b.carDiscount);
    if (state.cash < cost) return { ok: false, reason: 'money' };
    state.cash -= cost;
    c.ownNum += 1;
    state.reputation += data.rep;
    state.hp = Math.min(100, state.hp + data.hp);
    emit('car', { id });
    return { ok: true };
  }
  function sellCar(id) {
    const c = state.cars.find((x) => x.id === id);
    if (!c || c.ownNum <= 0) return { ok: false, reason: 'none' };
    const data = CARS.find((x) => x.id === id);
    c.ownNum -= 1;
    state.cash += Math.floor(data.price / 2);
    emit('carSell', { id });
    return { ok: true };
  }

  // ---- 恋爱 ----
  function date(id) {
    if (state.phase !== 'playing' || state.inHospital) return { ok: false };
    const m = state.mates.find((x) => x.id === id);
    if (!m || m.married) return { ok: false, reason: 'married' };
    const data = MATES.find((x) => x.id === id);
    const b = computeBonuses(state.skills, state.marriedMateId);
    const ladder = data.love;
    const cur = ladder[m.level] || ladder[ladder.length - 1];
    const cost = Math.max(0, Math.floor(cur[2] * (1 - b.dateDiscount)));
    if (state.cash < cost) return { ok: false, reason: 'money' };
    // 99 → 100 结婚需满足条件
    if (m.level === 5) {
      if (!mateCondMet(data)) return { ok: false, reason: 'cond' };
      state.cash -= cost;
      m.level = 6; m.love = 100; m.married = true;
      state.marriedMateId = id; state.marriedAge = state.age;
      emit('marry', { id });
      return { ok: true };
    }
    state.cash -= cost;
    m.level += 1;
    m.love = ladder[m.level][1];
    emit('date', { id, love: m.love });
    return { ok: true };
  }
  function mateCondMet(data) {
    for (const [type, value] of data.cond) {
      let ok = false;
      if (type === 1) ok = state.cash >= value;
      else if (type === 2) ok = value === 0 ? state.houses.some((h) => h.ownNum > 0) : state.houses.some((h) => h.id === value && h.ownNum > 0);
      else if (type === 3) ok = value === 0 ? state.cars.some((c) => c.ownNum > 0) : state.cars.some((c) => c.id === value && c.ownNum > 0);
      else if (type === 4) ok = state.assets >= value;
      else if (type === 5) ok = state.reputation >= value;
      else if (type === 6) ok = state.hp >= value;
      else if (type === 7) ok = hasCompany();
      if (!ok) return false;
    }
    return true;
  }
  function divorce(id) {
    const m = state.mates.find((x) => x.id === id);
    if (!m || !m.married) return { ok: false };
    m.married = false; m.level = 0; m.love = 0;
    state.marriedMateId = null;
    state.cash = Math.floor(state.cash * 0.8);
    state.hp = Math.floor(state.hp * 0.8);
    state.reputation = Math.floor(state.reputation * 0.8);
    for (const c of state.companies) if (c.shares > 0) c.shares = Math.floor(c.shares * 0.8);
    emit('divorce', { id });
    return { ok: true };
  }

  // ---- 赌 / 医 ----
  function bet() {
    if (state.phase !== 'playing' || state.inHospital) return { ok: false };
    if (state.cash < state.betCost) return { ok: false, reason: 'money' };
    state.cash -= state.betCost;
    const b = computeBonuses(state.skills, state.marriedMateId);
    let s = rng() - b.betBonus;
    let rate = 0;
    if (s < 0.69) rate = 0;
    else if (s < 0.85) rate = 3;
    else if (s < 0.95) rate = 4;
    else rate = 5;
    const win = rate > 0;
    if (win) state.cash += state.betCost * rate;
    state.betCost *= 2;
    emit('bet', { win, rate });
    return { ok: true };
  }
  function treat() {
    if (state.phase !== 'playing') return { ok: false };
    if (state.hp >= 100 && !state.inHospital) return { ok: false, reason: 'healthy' };
    const b = computeBonuses(state.skills, state.marriedMateId);
    const cost = Math.floor(2000 * Math.pow(1.18, state.age - 20) * (1 - state.hp / 100) * (1 - b.treatDiscount));
    if (state.cash < cost) return { ok: false, reason: 'money' };
    state.cash -= cost;
    state.hp = 100;
    state.inHospital = false;
    emit('treat');
    return { ok: true };
  }

  // ---- 天赋 ----
  function upgradeSkill(id, subId) {
    const s = SKILLS.find((x) => x.id === id && x.subId === subId);
    if (!s) return { ok: false };
    const cur = state.skills[`${id}:${subId}`] || 0;
    if (cur >= 5) return { ok: false, reason: 'max' };
    if (subId > 1) {
      const prev = state.skills[`${id}:${subId - 1}`] || 0;
      if (prev <= 0) return { ok: false, reason: 'prev' };
    }
    const cost = s.cost[cur][2];
    if (state.skillPoints < cost) return { ok: false, reason: 'points' };
    state.skillPoints -= cost;
    state.skills[`${id}:${subId}`] = cur + 1;
    emit('skill', { id, subId, level: cur + 1 });
    return { ok: true };
  }

  const run = {
    state,
    step(dt) { state.simTime += dt; },
    drainEvents() { const e = state._events; state._events = []; return e; },
    getHud() {
      return {
        cash: state.cash,
        assets: state.assets,
        age: state.age,
        retireAge: state.retireAge,
        hp: state.hp,
        reputation: state.reputation,
        warehouseUsed: warehouseUsed(),
        warehouseCap: state.warehouseCap,
        combo: state.combo,
        marketMood: state.marketMood,
        goal: ECONOMY.GOAL,
        phase: state.phase,
        inHospital: state.inHospital,
        pendingEvent: state.pendingEvent,
        stars: state.stars,
        summary: state.summary,
      };
    },
    nextYear,
    answerEvent,
    buyGoods,
    sellGoods,
    createCompany,
    buyStock,
    sellStock,
    buyHouse,
    sellHouse,
    buyCar,
    sellCar,
    date,
    divorce,
    bet,
    treat,
    upgradeSkill,
    retireNow() { if (state.phase === 'playing' && !state.pendingEvent) finish('retired'); return { ok: true }; },
  };

  // 初始市场
  refreshMarket();
  recomputeAssets();

  return run;
}
