// 纯逻辑：霓虹转生街机（人生重开模拟器）。
// 零 DOM / 零浏览器依赖，Node 可直接 import 用于测试与 selfplay。
// 状态机：talent（选天赋）→ allocate（分配点数）→ life（逐年推进）→ summary（终局结算）。
// 事件通过 drainEvents() 消费，UI/音频/selfplay 共用这一条管道。

import { GAME } from '../../config/game.config.js';
import { TALENTS, TALENT_IDS } from '../../config/talents.js';
import { EVENTS, CHOICES, DEATH_EVENT } from '../../config/events.js';
import { ACHIEVEMENTS } from '../../config/achievements.js';

// ---------------- 随机 ----------------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightRandom(list, rng) {
  if (!list || list.length === 0) return null;
  let total = 0;
  for (const [, w] of list) total += w;
  if (total <= 0) return list[list.length - 1][0];
  let r = rng() * total;
  for (const [id, w] of list) {
    r -= w;
    if (r < 0) return id;
  }
  return list[list.length - 1][0];
}

// ---------------- 条件表达式解析 ----------------

function parseCondition(condition) {
  if (!condition) return [];
  const conditions = [];
  const stack = [conditions];
  let cursor = 0;
  const catchString = (i) => {
    const str = condition.substring(cursor, i).trim();
    cursor = i;
    if (str) stack[0].push(str);
  };
  for (let i = 0; i < condition.length; i += 1) {
    const ch = condition[i];
    if (ch === ' ') continue;
    if (ch === '(') {
      catchString(i); cursor += 1;
      const sub = []; stack[0].push(sub); stack.unshift(sub);
    } else if (ch === ')') {
      catchString(i); cursor += 1; stack.shift();
    } else if (ch === '|' || ch === '&') {
      catchString(i); catchString(i + 1);
    }
  }
  catchString(condition.length);
  return conditions;
}

function checkProp(property, condition) {
  const i = condition.search(/[><!?=]/);
  if (i < 0) return false;
  const prop = condition.substring(0, i);
  let symbol = condition.substring(i, i + (condition[i + 1] === '=' ? 2 : 1));
  const d = condition.substring(i + symbol.length);
  const propData = property.get(prop);
  const conditionData = d[0] === '[' ? JSON.parse(d) : Number(d);

  switch (symbol) {
    case '>': return propData > conditionData;
    case '<': return propData < conditionData;
    case '>=': return propData >= conditionData;
    case '<=': return propData <= conditionData;
    case '=':
      if (Array.isArray(propData)) return propData.includes(conditionData);
      return propData === conditionData;
    case '!=':
      if (Array.isArray(propData)) return !propData.includes(conditionData);
      return propData === conditionData;
    case '?':
      if (Array.isArray(propData)) { for (const p of propData) if (conditionData.includes(p)) return true; return false; }
      return conditionData.includes(propData);
    case '!':
      if (Array.isArray(propData)) { for (const p of propData) if (conditionData.includes(p)) return false; return true; }
      return !conditionData.includes(propData);
    default: return false;
  }
}

function checkParsed(property, conditions) {
  if (!Array.isArray(conditions)) return checkProp(property, conditions);
  if (conditions.length === 0) return true;
  if (conditions.length === 1) return checkParsed(property, conditions[0]);
  let ret = checkParsed(property, conditions[0]);
  for (let i = 1; i < conditions.length; i += 2) {
    if (conditions[i] === '&') {
      if (ret) ret = checkParsed(property, conditions[i + 1]);
    } else if (conditions[i] === '|') {
      if (ret) return true;
      ret = checkParsed(property, conditions[i + 1]);
    } else return false;
  }
  return ret;
}

export function checkCondition(property, condition) {
  if (!condition) return true;
  return checkParsed(property, parseCondition(condition));
}

function extractMaxTriggers(condition) {
  const m = /AGE\?\[([0-9,]+)\]/.exec(condition || '');
  if (!m) return 1;
  return m[1].split(',').length;
}

// ---------------- 天赋稀有度加权 ----------------

function rateOf(type, value) {
  if (type === 'times') {
    if (value >= 100) return { 2: 6 };
    if (value >= 70) return { 2: 5 };
    if (value >= 50) return { 2: 4 };
    if (value >= 30) return { 2: 3 };
    if (value >= 10) return { 2: 2 };
    return { 2: 1 };
  }
  if (type === 'achievement') {
    if (value >= 100) return { 3: 6 };
    if (value >= 70) return { 3: 5 };
    if (value >= 50) return { 3: 4 };
    if (value >= 30) return { 3: 3 };
    if (value >= 10) return { 3: 2 };
    return { 3: 1 };
  }
  return {};
}

function talentRandom(rng, times, achievements) {
  const rate = { 1: 100, 2: 10, 3: 1 };
  const addition = { 1: 1, 2: 1, 3: 1 };
  const timesRate = rateOf('times', times);
  const achRate = rateOf('achievement', achievements);
  for (const g of [1, 2, 3]) {
    addition[g] += (timesRate[g] || 1) - 1;
    addition[g] += (achRate[g] || 1) - 1;
    rate[g] *= addition[g];
  }
  const randomGrade = () => {
    let r = Math.floor(rng() * 1000);
    if ((r -= rate[3]) < 0) return 3;
    if ((r -= rate[2]) < 0) return 2;
    if ((r -= rate[1]) < 0) return 1;
    return 0;
  };
  const remaining = TALENT_IDS.map((id) => TALENTS[id]);
  const out = [];
  for (let i = 0; i < GAME.TALENT_OFFER && remaining.length; i += 1) {
    let g = randomGrade();
    let candidates = remaining.filter((t) => t.grade === g);
    while (candidates.length === 0) {
      g = Math.max(0, g - 1);
      candidates = remaining.filter((t) => t.grade === g);
      if (g === 0 && candidates.length === 0) { candidates = remaining; break; }
    }
    const idx = Math.floor(rng() * candidates.length) % candidates.length;
    const picked = candidates[idx];
    out.push(picked);
    remaining.splice(remaining.indexOf(picked), 1);
  }
  return out;
}

// ---------------- 主运行 ----------------

export function createRun(opts = {}) {
  const seed = (opts.seed == null ? 1 : opts.seed) >>> 0;
  const rng = mulberry32(seed || 1);
  const times = opts.times | 0 || 0;
  const achievements = opts.achievements | 0 || 0;

  const state = {
    phase: 'talent', // talent | allocate | life | summary
    seed,
    age: -1,
    props: { CHR: 0, INT: 0, STR: 0, MNY: 0, SPR: 0, LIF: 1 },
    max: { CHR: 0, INT: 0, STR: 0, MNY: 0, SPR: 0, AGE: 0 },
    talents: [],           // 已选天赋 id
    talentPool: [],        // 候选
    selectedIndices: [],   // 已选索引（最多 3）
    triggers: {},          // talentId -> 已触发次数
    alloc: { CHR: 0, INT: 0, STR: 0, MNY: 0, SPR: GAME.SPR_BASE },
    allocPoints: GAME.ALLOC_POINTS,
    allocBonus: 0,
    luck: 0,
    bestLuck: 0,
    luckBoons: 0,
    track: [],             // 人生日志
    pendingChoice: null,
    summary: null,
    stars: 0,
    grade: 0,
    score: 0,
    stages: 0,
    deaths: 0,
    completed: false,
    records: [],
    autoPlay: false,
    autoAcc: 0,
  };

  state.talentPool = talentRandom(rng, times, achievements);

  const queue = [];
  const push = (ev) => queue.push(ev);

  const property = {
    get(prop) {
      switch (prop) {
        case 'AGE': return state.age;
        case 'CHR': case 'INT': case 'STR': case 'MNY': case 'SPR': case 'LIF': return state.props[prop];
        case 'TLT': return state.talents.slice();
        case 'EVT': return state.track.filter((t) => t.kind === 'event').map((t) => t.id);
        case 'TMS': return times;
        default: return 0;
      }
    },
  };

  function applyFx(fx) {
    if (!fx) return;
    for (const k of Object.keys(fx)) {
      if (k === 'LIF') { state.props.LIF += fx[k]; continue; }
      if (k in state.props) {
        state.props[k] += fx[k];
        if (state.props[k] > state.max[k]) state.max[k] = state.props[k];
      }
    }
  }

  function updateLuck(ev) {
    let good = ev.good;
    let bad = ev.bad;
    if (good == null && bad == null && ev.fx) {
      let net = 0;
      for (const k of Object.keys(ev.fx)) if (k !== 'LIF') net += ev.fx[k];
      good = net > 0;
      bad = net < 0;
    }
    if (good) {
      const step = state.talents.includes(1303) ? 2 : 1;
      state.luck += step;
      if (state.luck > state.bestLuck) state.bestLuck = state.luck;
      if (state.luck >= GAME.LUCK_TARGET) {
        state.luck = 0;
        state.luckBoons += 1;
        applyFx({ SPR: 1 });
        push({ type: 'luck', text: { en: 'Fortune smiles on you! Spirit +1.', zh: '幸运女神眷顾了你！心境 +1。' } });
        state.track.push({ age: state.age, kind: 'luck', text: { en: 'Fortune smiles on you! Spirit +1.', zh: '幸运女神眷顾了你！心境 +1。' } });
      }
    } else if (bad) {
      state.luck = 0;
    }
  }

  function applyEventChain(evId) {
    const ev = evId === DEATH_EVENT.id ? DEATH_EVENT : EVENTS.find((e) => e.id === evId);
    if (!ev) return;
    applyFx(ev.fx);
    const entry = { id: ev.id, age: state.age, kind: 'event', text: { en: ev.en, zh: ev.zh } };
    if (ev.postEn) entry.post = { en: ev.postEn, zh: ev.postZh };
    state.track.push(entry);
    push({ type: 'event', age: state.age, id: ev.id, text: entry.text, post: entry.post, good: ev.good, bad: ev.bad });
    updateLuck(ev);
    if (ev.branch) {
      for (const [cond, nextId] of ev.branch) {
        if (checkCondition(property, cond)) {
          applyEventChain(nextId);
          break;
        }
      }
    }
  }

  function applyTalentEffects() {
    for (const tid of state.talents) {
      const t = TALENTS[tid];
      if (!t) continue;
      const maxTrig = extractMaxTriggers(t.condition);
      const used = state.triggers[tid] || 0;
      if (used >= maxTrig) continue;
      if (t.condition && !checkCondition(property, t.condition)) continue;
      state.triggers[tid] = used + 1;
      if (t.effect) applyFx(t.effect);
      push({ type: 'talentTrigger', id: tid, name: t.name, desc: t.desc, grade: t.grade });
      state.track.push({ age: state.age, kind: 'talent', text: { en: `Gift【${t.name.en}】triggered: ${t.desc.en}`, zh: `天赋【${t.name.zh}】发动：${t.desc.zh}` } });
    }
  }

  function setMaxBaseline() {
    for (const k of ['CHR', 'INT', 'STR', 'MNY', 'SPR']) {
      state.max[k] = state.props[k];
      if (state.props[k] > state.max[k]) state.max[k] = state.props[k];
    }
    state.max.AGE = Math.max(state.max.AGE, state.age);
  }

  function computeSummary() {
    const m = state.max;
    const sum = Math.floor((m.CHR + m.INT + m.STR + m.MNY + m.SPR) * 2 + m.AGE / 2);
    state.score = sum;
    if (sum >= 120) state.grade = 3;
    else if (sum >= 100) state.grade = 2;
    else if (sum >= 80) state.grade = 1;
    else state.grade = 0;
    state.stars = state.grade;
    state.stages = GAME.STAGES.filter((s) => m.AGE >= s).length;
    state.summary = {
      age: m.AGE,
      max: { ...m },
      score: sum,
      grade: state.grade,
      stars: state.stars,
      stages: state.stages,
    };
  }

  function checkRecords() {
    for (const a of ACHIEVEMENTS) {
      if (state.records.includes(a.id)) continue;
      let hit = false;
      if (a.kind === 'age') hit = state.max.AGE >= a.value;
      else if (a.kind === 'score') hit = state.summary && state.summary.score >= a.value;
      else if (a.kind === 'luck') hit = state.luckBoons >= a.value;
      else if (a.kind === 'times') hit = times >= a.value;
      if (hit) {
        state.records.push(a.id);
        push({ type: 'record', record: a });
      }
    }
  }

  function endLife(reason) {
    if (state.phase === 'summary') return;
    state.phase = 'summary';
    state.completed = true;
    state.deaths += 1;
    computeSummary();
    checkRecords();
    push({ type: 'death', reason: reason || 'end' });
    push({ type: 'summary', summary: state.summary });
  }

  // ---------------- 对外动作 ----------------

  function pickTalent(index) {
    if (state.phase !== 'talent') return { ok: false };
    if (index < 0 || index >= state.talentPool.length) return { ok: false };
    const i = state.selectedIndices.indexOf(index);
    if (i >= 0) {
      state.selectedIndices.splice(i, 1);
    } else {
      if (state.selectedIndices.length === GAME.TALENT_PICKS) state.selectedIndices.splice(GAME.TALENT_PICKS - 1, 1);
      state.selectedIndices.push(index);
    }
    push({ type: 'talentPick', index, count: state.selectedIndices.length });
    return { ok: true, count: state.selectedIndices.length };
  }

  function confirmTalents() {
    if (state.phase !== 'talent') return { ok: false };
    if (state.selectedIndices.length !== GAME.TALENT_PICKS) return { ok: false, count: state.selectedIndices.length };
    state.talents = state.selectedIndices.map((i) => state.talentPool[i].id);
    state.allocBonus = state.talents.reduce((s, id) => s + (TALENTS[id].status || 0), 0);
    state.allocPoints = GAME.ALLOC_POINTS + state.allocBonus;
    state.phase = 'allocate';
    push({ type: 'talentPick', done: true, count: state.selectedIndices.length });
    return { ok: true };
  }

  function startLife(allocation) {
    if (state.phase !== 'allocate') return { ok: false };
    state.alloc.CHR = (allocation && allocation.CHR) | 0 || 0;
    state.alloc.INT = (allocation && allocation.INT) | 0 || 0;
    state.alloc.STR = (allocation && allocation.STR) | 0 || 0;
    state.alloc.MNY = (allocation && allocation.MNY) | 0 || 0;
    state.alloc.SPR = GAME.SPR_BASE;
    // 重置本局
    state.props = { CHR: state.alloc.CHR, INT: state.alloc.INT, STR: state.alloc.STR, MNY: state.alloc.MNY, SPR: state.alloc.SPR, LIF: 1 };
    state.age = -1;
    state.max = { CHR: 0, INT: 0, STR: 0, MNY: 0, SPR: 0, AGE: 0 };
    state.triggers = {};
    state.track = [];
    state.luck = 0;
    state.bestLuck = 0;
    state.luckBoons = 0;
    applyTalentEffects();
    setMaxBaseline();
    state.phase = 'life';
    push({ type: 'year', age: state.age, start: true });
    return { ok: true };
  }

  function autoAllocate() {
    if (state.phase !== 'allocate') return { ok: false };
    // greedy 分配：体能优先（保命）→ 才智 → 魅力 → 财富
    let pts = state.allocPoints;
    const put = (k, n) => { const v = Math.min(pts, n); state.alloc[k] += v; pts -= v; };
    put('STR', 8);
    put('INT', 5);
    put('CHR', 4);
    put('MNY', 3);
    state.alloc.MNY += pts;
    return { ok: true };
  }

  function nextYear() {
    if (state.phase !== 'life') return { ok: false };
    if (state.pendingChoice) return { ok: false, reason: 'choice-pending' };

    state.age += 1;
    if (state.age > state.max.AGE) state.max.AGE = state.age;
    push({ type: 'year', age: state.age });

    applyTalentEffects();

    // 出生
    if (state.age === 0) {
      const boy = rng() < 0.5;
      const birth = boy
        ? { en: 'You were born — a boy.', zh: '你出生了，是个男孩。' }
        : { en: 'You were born — a girl.', zh: '你出生了，是个女孩。' };
      state.track.push({ age: 0, kind: 'event', text: birth });
      push({ type: 'event', age: 0, text: birth, good: true });
      if (state.props.STR < 0) {
        state.track.push({ age: 0, kind: 'death', text: { en: 'Too frail to survive, you died at birth.', zh: '体质过弱，你胎死腹中。' } });
        endLife('stillborn');
        return { ok: true };
      }
    }

    // 命运抉择
    const choice = CHOICES[state.age];
    if (choice) {
      state.pendingChoice = { age: state.age, ...choice };
      push({ type: 'choice', age: state.age, choice });
      state.track.push({ age: state.age, kind: 'choice', text: { en: choice.en, zh: choice.zh }, choice });
      return { ok: true };
    }

    // 随机事件
    const pool = EVENTS
      .filter((ev) => !ev.nopool && ev.age[0] <= state.age && ev.age[1] >= state.age)
      .filter((ev) => (ev.cond ? checkCondition(property, ev.cond) : true))
      .filter((ev) => (ev.excl ? !checkCondition(property, ev.excl) : true))
      .map((ev) => [ev.id, ev.w == null ? 1 : ev.w]);
    const evId = weightRandom(pool, rng);
    if (evId != null) applyEventChain(evId);

    if (state.props.LIF < 1) {
      // 不朽之魂：40% 概率逃脱死亡一次
      if (state.talents.includes(1304) && rng() < 0.4) {
        state.props.LIF = 1;
        state.track.push({ age: state.age, kind: 'luck', text: { en: 'Your undying soul pulled you back from death.', zh: '你的不朽之魂把你从死亡边缘拉了回来。' } });
        push({ type: 'luck', text: { en: 'Your undying soul pulled you back from death.', zh: '你的不朽之魂把你从死亡边缘拉了回来。' } });
      } else {
        endLife('death');
        return { ok: true };
      }
    }

    if (state.age >= GAME.MAX_AGE) {
      state.track.push({ age: state.age, kind: 'death', text: { en: 'At the end of the arcade, your life faded out.', zh: '在街机的尽头，你的生命熄灭了。' } });
      endLife('maxage');
      return { ok: true };
    }

    return { ok: true };
  }

  function resolveChoice(option) {
    if (!state.pendingChoice) return { ok: false };
    if (option !== 'a' && option !== 'b') return { ok: false };
    const c = state.pendingChoice[option];
    applyFx(c.fx);
    const entry = { age: state.age, kind: 'event', text: { en: c.en, zh: c.zh } };
    state.track.push(entry);
    push({ type: 'event', age: state.age, text: entry.text });
    // 抉择本身不结算幸运（neutral），除非 fx 明显正/负
    let net = 0;
    for (const k of Object.keys(c.fx)) if (k !== 'LIF') net += c.fx[k];
    if (net > 0) {
      const step = state.talents.includes(1303) ? 2 : 1;
      state.luck += step;
      if (state.luck >= GAME.LUCK_TARGET) {
        state.luck = 0; state.luckBoons += 1;
        applyFx({ SPR: 1 });
        push({ type: 'luck', text: { en: 'Fortune smiles on you! Spirit +1.', zh: '幸运女神眷顾了你！心境 +1。' } });
      }
    } else if (net < 0) state.luck = 0;

    state.pendingChoice = null;
    if (state.props.LIF < 1) {
      endLife('death');
      return { ok: true };
    }
    if (state.age >= GAME.MAX_AGE) {
      endLife('maxage');
      return { ok: true };
    }
    return { ok: true };
  }

  function setAutoPlay(on) {
    state.autoPlay = !!on;
    state.autoAcc = 0;
    return { ok: true };
  }

  function step(dt) {
    if (state.phase === 'life' && state.autoPlay && !state.pendingChoice) {
      state.autoAcc += dt;
      if (state.autoAcc >= GAME.AUTO_INTERVAL) {
        state.autoAcc = 0;
        nextYear();
      }
    }
  }

  function drainEvents() {
    if (queue.length === 0) return [];
    return queue.splice(0, queue.length);
  }

  function getHud() {
    return {
      age: state.age,
      props: { ...state.props },
      max: { ...state.max },
      luck: state.luck,
      luckBoons: state.luckBoons,
      phase: state.phase,
      pendingChoice: !!state.pendingChoice,
      allocPoints: state.allocPoints,
      alloc: { ...state.alloc },
    };
  }

  return {
    state,
    rng,
    pickTalent,
    confirmTalents,
    startLife,
    autoAllocate,
    nextYear,
    resolveChoice,
    setAutoPlay,
    step,
    drainEvents,
    getHud,
  };
}

// 兼容调试契约：run.step 别名
export function decorate(run) {
  return run;
}
