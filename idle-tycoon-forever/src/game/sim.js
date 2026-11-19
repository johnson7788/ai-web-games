// 模拟层（纯逻辑，零 DOM/window/canvas）：霓虹商战挂机。
// 职责：街区/对手生成、自动战斗、掉落、连击、星级、被动收入、投资（升级/部门/垄断/总部/IPO）。
// 依赖：src/game/data.js、config/game.config.js。随机：注入 seed 的 mulberry32，可复现。

import {
  DISTRICTS, MAX_LV, SLOTS, GRADES,
  makeRival, makeDeptItem, starterDepts, levelUpCost,
  MONOPOLY_COST, monopolyCutRate, HQ_INFO, HQ_MAX, ipoRewards, IPO_COST,
} from './data.js';
import { GAME } from '../../config/game.config.js';

const RIVALS_PER_DISTRICT = 10;
const PLAYER_ATK = 0.4;   // 玩家攻击间隔（秒）
const ENEMY_ATK = 0.6;    // 对手攻击间隔（秒）

// ------------------------------------------------------------------ RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng, min, max) {
  return Math.floor(rng() * (max - min)) + min;
}

// ------------------------------------------------------------------ 玩家工厂
export function createPlayer() {
  const equip = {};
  for (const s of SLOTS) equip[s.id] = null;
  const backpack = starterDepts().map((d) => ({ ...d, count: 1 }));
  // 新手附赠一些扩张令与蓝图，方便立刻体验投资
  backpack.push({ id: 'chip', type: 'chip', count: 5 });
  backpack.push({ id: 'blueprint', type: 'blueprint', count: 20 });
  const p = {
    lv: 1,
    cash: 3000,
    gems: 300,
    equip,
    backpack,
    monopoly: { lv: 1, stars: 0 },
    hq: { lv: 1, lucky: 0 },
    att: 10,
    def: 5,
    hp: 100,
    maxHp: 100,
    power: 0,
  };
  recomputeStats(p);
  return p;
}

export function recomputeStats(p) {
  let att = p.lv * 10;
  let def = p.lv * 5;
  let hp = p.lv * 100;
  for (const s of SLOTS) {
    const d = p.equip[s.id];
    if (d) {
      att += d.att || 0;
      def += d.def || 0;
      hp += d.hp || 0;
    }
  }
  p.att = att;
  p.def = def;
  p.hp = hp;
  p.maxHp = hp;
  p.power = (att + def) * 10 + hp * 2;
  return p;
}

// ------------------------------------------------------------------ 背包工具
export function addItem(player, item) {
  if (item.type === 'chip' || item.type === 'blueprint') {
    const exist = player.backpack.find((b) => b.id === item.id);
    if (exist) { exist.count += item.count; return; }
  }
  player.backpack.push({ ...item, count: item.count ?? 1 });
}

function removeItem(player, index, count = 1) {
  const it = player.backpack[index];
  if (!it) return false;
  it.count -= count;
  if (it.count <= 0) player.backpack.splice(index, 1);
  return true;
}

function countOf(player, id) {
  return player.backpack.filter((b) => b.id === id).reduce((s, b) => s + b.count, 0);
}

// ------------------------------------------------------------------ createRun
export function createRun(opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const player = opts.player ? JSON.parse(JSON.stringify(opts.player)) : createPlayer();

  const state = {
    phase: 'idle',          // idle | battle | lost
    district: 0,
    player,
    rivals: [],
    currentRivalIdx: null,
    battle: null,
    combo: 0,
    comboBest: 0,
    stats: { wins: 0, losses: 0, districtsCleared: 0 },
    districtHpSum: 0,
    districtWins: 0,
    districtLosses: 0,
    districtStars: {},
    districtCleared: {},
    result: null,           // 最近一次战斗结算（UI 用）
  };

  const run = {
    state,
    _rng: rng,
    _events: [],
    _clock: 0,
    _idleTick: 0,

    // ---- 事件 ----
    _emit(ev) {
      ev.t = Number(this._clock.toFixed(2));
      this._events.push(ev);
    },
    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---- 街区 ----
    unlockedDistrictCount() {
      return Math.min(DISTRICTS.length, Math.floor(player.lv / 5) + 1);
    },
    enterDistrict(idx) {
      idx = Math.max(0, Math.min(DISTRICTS.length - 1, idx | 0));
      if (idx > 0 && player.lv < DISTRICTS[idx].unlockLv) {
        return { ok: false, reason: 'locked' };
      }
      state.district = idx;
      state.phase = 'idle';
      state.combo = 0;
      state.comboBest = 0;
      state.districtHpSum = 0;
      state.districtWins = 0;
      state.districtLosses = 0;
      state.currentRivalIdx = null;
      state.battle = null;
      state.result = null;
      state.rivals = [];
      for (let i = 0; i < RIVALS_PER_DISTRICT; i += 1) {
        state.rivals.push(makeRival(idx, i === RIVALS_PER_DISTRICT - 1 ? 4 : i % 4, rng));
      }
      player.hp = player.maxHp;
      this._emit({ type: 'enterDistrict', district: idx, name: DISTRICTS[idx].en });
      return { ok: true };
    },

    // ---- 战斗 ----
    pickRival(i) {
      if (state.phase !== 'idle') return { ok: false, reason: 'busy' };
      const r = state.rivals[i];
      if (!r || r.hp <= 0) return { ok: false, reason: 'gone' };
      state.currentRivalIdx = i;
      state.phase = 'battle';
      state.battle = {
        playerHp: player.maxHp,
        enemyHp: r.hp,
        enemyMaxHp: r.maxHp,
        playerAtkT: 0,
        enemyAtkT: 0,
        won: false,
      };
      this._emit({ type: 'strike', rival: r.name, boss: r.boss });
      return { ok: true };
    },

    _dealPlayerAttack() {
      const b = state.battle;
      const r = state.rivals[state.currentRivalIdx];
      // 垄断斩：一刀切对手估值
      const cutRate = monopolyCutRate(player.monopoly.lv);
      if (player.monopoly.lv > 1 && rng() * 100 < cutRate) {
        const cutVal = Math.max(1, Math.round(b.enemyMaxHp * 0.15));
        b.enemyHp = Math.max(0, b.enemyHp - cutVal);
        this._emit({ type: 'cut', value: cutVal, rival: r.name });
        return;
      }
      const dmg = Math.max(1, Math.round((player.att - r.def) * (0.6 + rng() * 0.8)));
      b.enemyHp = Math.max(0, b.enemyHp - dmg);
      this._emit({ type: 'hitEnemy', value: dmg, rival: r.name });
    },

    _dealEnemyAttack() {
      const b = state.battle;
      const r = state.rivals[state.currentRivalIdx];
      const dmg = Math.max(1, Math.round((r.att - player.def) * (0.6 + rng() * 0.8)));
      b.playerHp = Math.max(0, b.playerHp - dmg);
      this._emit({ type: 'hitPlayer', value: dmg, rival: r.name });
    },

    _win() {
      const r = state.rivals[state.currentRivalIdx];
      const comboMult = 1 + Math.min(GAME.COMBO_MAX, state.combo + 1) * GAME.COMBO_CASH_PER_STACK;
      let baseCash = randRange(rng, r.lv * 100, r.lv * 200);
      let chips = 1 + (rng() < 0.5 ? 1 : 0);
      if (r.boss) { baseCash *= 3; chips += 2; }
      const cash = Math.round(baseCash * comboMult);
      player.cash += cash;
      addItem(player, { id: 'chip', type: 'chip', count: chips });
      state.combo += 1;
      state.comboBest = Math.max(state.comboBest, state.combo);
      state.stats.wins += 1;
      state.districtWins += 1;
      state.districtHpSum += Math.max(0, state.battle.playerHp) / Math.max(1, player.maxHp);
      // 偶尔掉落随机部门（10% 概率）
      let deptDrop = null;
      if (rng() < 0.1) {
        const slot = randRange(rng, 0, 6);
        const grade = rng() < 0.6 ? 0 : (rng() < 0.8 ? 1 : 2);
        deptDrop = makeDeptItem(slot, grade, Math.max(1, player.lv));
        addItem(player, { ...deptDrop, count: 1 });
      }
      r.hp = 0;
      state.battle.won = true;
      state.battle = null;
      state.phase = 'idle';
      state.result = { won: true, cash, chips, dept: deptDrop, combo: state.combo };
      this._emit({ type: 'win', cash, chips, combo: state.combo, rival: r.name });
      if (deptDrop) this._emit({ type: 'deptDrop', slot: deptDrop.slot, grade: deptDrop.grade });
      this._maybeClearDistrict();
    },

    _maybeClearDistrict() {
      if (!state.rivals.every((x) => x.hp <= 0)) return { ok: false };
      const stars = this._districtStars();
      state.stats.districtsCleared += 1;
      state.districtCleared[state.district] = true;
      state.districtStars[state.district] = Math.max(state.districtStars[state.district] | 0, stars);
      player.cash += stars * 500 * (state.district + 1);
      this._emit({ type: 'districtClear', district: state.district, stars });
      return { ok: true, stars };
    },

    // 调试/验收辅助：直接清空街区（不逐个打），复用结算逻辑。
    debugClearDistrict() {
      for (const r of state.rivals) r.hp = 0;
      state.comboBest = Math.max(state.comboBest, RIVALS_PER_DISTRICT);
      return this._maybeClearDistrict();
    },

    _lose() {
      state.stats.losses += 1;
      state.districtLosses += 1;
      state.combo = 0;
      state.battle = null;
      state.phase = 'idle';
      player.hp = player.maxHp;
      state.result = { won: false };
      this._emit({ type: 'lose', reason: 'defeat' });
    },

    _districtStars() {
      const avgHp = state.districtWins > 0 ? state.districtHpSum / state.districtWins : 0;
      const stars = 1
        + (avgHp >= GAME.STAR_HP_RATIO ? 1 : 0)
        + (state.comboBest >= RIVALS_PER_DISTRICT && state.districtLosses === 0 ? 1 : 0);
      return Math.min(3, stars);
    },

    // ---- 时间推进 ----
    step(dt) {
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;

      // 被动收入：每秒自动入账（可感知事件，保证事件密度）
      const idleRate = GAME.IDLE_CASH_BASE + player.lv * GAME.IDLE_CASH_PER_LV + player.hq.lv * 5 + state.combo * 2;
      this._idleTick += dt;
      if (this._idleTick >= 1) {
        this._idleTick -= 1;
        const amt = Math.round(idleRate);
        player.cash += amt;
        this._emit({ type: 'idleCash', amount: amt });
      }

      if (state.phase === 'battle' && state.battle) {
        const b = state.battle;
        b.playerAtkT += dt;
        b.enemyAtkT += dt;
        if (b.playerAtkT >= PLAYER_ATK) {
          b.playerAtkT -= PLAYER_ATK;
          this._dealPlayerAttack();
          if (b.enemyHp <= 0) { this._win(); return; }
        }
        if (b.enemyAtkT >= ENEMY_ATK) {
          b.enemyAtkT -= ENEMY_ATK;
          this._dealEnemyAttack();
          if (b.playerHp <= 0) { this._lose(); return; }
        }
      }
    },

    // ---- 动词：投资 ----
    useChip(count = 1) {
      const idx = player.backpack.findIndex((b) => b.id === 'chip');
      if (idx < 0 || player.backpack[idx].count < count) return { ok: false, reason: 'noChip' };
      if (player.lv >= MAX_LV) return { ok: false, reason: 'maxLv' };
      const gained = Math.min(count, MAX_LV - player.lv);
      removeItem(player, idx, gained);
      player.lv += gained;
      recomputeStats(player);
      this._emit({ type: 'levelUp', lv: player.lv, gained });
      return { ok: true, gained };
    },

    levelUpViaCash() {
      if (player.lv >= MAX_LV) return { ok: false, reason: 'maxLv' };
      const cost = levelUpCost(player.lv);
      if (player.cash < cost) return { ok: false, reason: 'noCash', cost };
      player.cash -= cost;
      player.lv += 1;
      recomputeStats(player);
      this._emit({ type: 'levelUp', lv: player.lv, gained: 1 });
      return { ok: true, cost };
    },

    equipDept(backpackIdx) {
      const it = player.backpack[backpackIdx];
      if (!it || it.type !== 'dept') return { ok: false, reason: 'notDept' };
      const old = player.equip[it.slot];
      player.equip[it.slot] = { ...it, count: 1 };
      removeItem(player, backpackIdx, 1);
      if (old) addItem(player, { ...old, count: 1 });
      recomputeStats(player);
      this._emit({ type: 'equip', slot: it.slot, grade: it.grade });
      return { ok: true };
    },

    synthesize(indices) {
      if (!Array.isArray(indices) || indices.length !== 3) return { ok: false, reason: 'need3' };
      const items = indices.map((i) => player.backpack[i]).filter((it) => it && it.type === 'dept');
      if (items.length !== 3) return { ok: false, reason: 'badItems' };
      const a = items[0];
      const same = items.every((it) => it.slot === a.slot && it.grade === a.grade);
      if (!same) return { ok: false, reason: 'mismatch' };
      if (a.grade >= GRADES.length - 1) return { ok: false, reason: 'maxGrade' };
      // 消耗三件，得到品级 +1 的新部门
      const sorted = [...indices].sort((x, y) => y - x);
      for (const i of sorted) player.backpack.splice(i, 1);
      addItem(player, { ...makeDeptItem(a.slot, a.grade + 1, a.lv), count: 1 });
      recomputeStats(player);
      this._emit({ type: 'synthesize', slot: a.slot, grade: a.grade + 1 });
      return { ok: true };
    },

    monopolyUpgrade() {
      const lv = player.monopoly.lv;
      const cost = MONOPOLY_COST[Math.min(lv - 1, MONOPOLY_COST.length - 1)];
      if (cost <= 0) return { ok: false, reason: 'max' };
      if (player.cash < cost) return { ok: false, reason: 'noCash', cost };
      player.cash -= cost;
      player.monopoly.stars += 1;
      if (player.monopoly.stars >= 10) {
        player.monopoly.stars = 0;
        player.monopoly.lv += 1;
        this._emit({ type: 'monopolyUp', lv: player.monopoly.lv });
      } else {
        this._emit({ type: 'monopolyStar', stars: player.monopoly.stars });
      }
      return { ok: true };
    },

    hqUpgrade() {
      const lv = player.hq.lv;
      if (lv >= HQ_MAX) return { ok: false, reason: 'max' };
      const info = HQ_INFO[lv - 1];
      const idx = player.backpack.findIndex((b) => b.id === 'blueprint');
      if (idx < 0 || player.backpack[idx].count < info.consume) return { ok: false, reason: 'noBlueprint' };
      removeItem(player, idx, info.consume);
      const luckyNeed = info.maxLucky;
      const success = rng() < (player.hq.lucky >= luckyNeed ? 1 : 0.5);
      if (success) {
        player.hq.lv += 1;
        player.hq.lucky = 0;
        this._emit({ type: 'hqUp', lv: player.hq.lv });
      } else {
        player.hq.lucky += 50;
        this._emit({ type: 'hqLucky', lucky: player.hq.lucky });
      }
      return { ok: true, success };
    },

    ipoSpin(count = 1) {
      const cost = count >= 10 ? IPO_COST.ten : IPO_COST.one * count;
      if (player.gems < cost) return { ok: false, reason: 'noGems' };
      player.gems -= cost;
      const rewards = [];
      for (let i = 0; i < count; i += 1) {
        const pool = ipoRewards(player.lv);
        const total = pool.reduce((s, r) => s + r.weight, 0);
        let roll = rng() * total;
        let pick = pool[0];
        for (const r of pool) { roll -= r.weight; if (roll <= 0) { pick = r; break; } }
        rewards.push(pick);
        if (pick.kind === 'chip') addItem(player, { id: 'chip', type: 'chip', count: pick.count });
        else if (pick.kind === 'cash') player.cash += pick.count;
        else if (pick.kind === 'blueprint') addItem(player, { id: 'blueprint', type: 'blueprint', count: pick.count });
        else if (pick.kind === 'dept') addItem(player, { ...makeDeptItem(randRange(rng, 0, 6), randRange(rng, 0, 3), Math.max(1, player.lv)), count: 1 });
      }
      this._emit({ type: 'ipo', count, rewards: rewards.map((r) => r.kind) });
      return { ok: true, rewards };
    },

    // ---- HUD 快照 ----
    getHud() {
      const d = DISTRICTS[state.district];
      return {
        phase: state.phase,
        district: state.district,
        districtName: d ? d.en : '',
        lv: player.lv,
        cash: player.cash,
        gems: player.gems,
        power: player.power,
        att: player.att,
        def: player.def,
        hp: player.hp,
        maxHp: player.maxHp,
        combo: state.combo,
        idleRate: Math.round(GAME.IDLE_CASH_BASE + player.lv * GAME.IDLE_CASH_PER_LV + player.hq.lv * 5 + state.combo * 2),
        rivalsLeft: state.rivals.filter((r) => r.hp > 0).length,
        monopoly: player.monopoly.lv,
        hq: player.hq.lv,
        chips: countOf(player, 'chip'),
        blueprints: countOf(player, 'blueprint'),
      };
    },
  };

  run.enterDistrict(0);
  return run;
}
