// IDLE FORGE · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：自动锻造产金币、四线升级、大师之作进度、炉候窗口/学徒罢工/稀有矿脉/订单限时、
//       离线收益折算、事件表。
// 依赖：config/levels.js（LEVELS/LEVEL_COUNT）、config/game.config.js（GAME）。
// 契约：createRun(levelIndex, opts) → { state, step, tap, buy, stoke, appease, getHud, drainEvents }。
// 随机：注入 seed 的 mulberry32（供 bot random 策略）；关卡内机制按固定时刻调度，保证可复现。

import { LEVELS } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

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

// ------------------------------------------------------------------ 数值曲线
export function forgeIntervalSec(state) {
  const speed = state.upgrades.speed || 0;
  const strikeMult = state.strike.active ? GAME.STRIKE_SPEED_PENALTY : 1;
  return (GAME.BASE_FORGE_SEC / (1 + speed * GAME.SPEED_PER_LV)) * strikeMult;
}

export function incomePerForge(state) {
  const level = LEVELS[state.level - 1];
  const power = state.upgrades.power || 0;
  const temp = state.upgrades.temp || 0;
  let mult = (1 + power * GAME.POWER_PER_LV) * (1 + temp * GAME.TEMP_COIN_PER_LV);
  if (state.buffs.temp.active) mult *= (1 + GAME.STOKE_BUFF);
  if (state.buffs.vein.active) mult *= GAME.VEIN_MULT;
  return Math.max(1, Math.round(level.yield * mult));
}

export function masterpieceGainPerForge(state) {
  const temp = state.upgrades.temp || 0;
  return (1 / state.target) * (1 + temp * GAME.TEMP_PROG_PER_LV);
}

export function passivePerSec(state) {
  const level = LEVELS[state.level - 1];
  const app = state.upgrades.apprentice || 0;
  const temp = state.upgrades.temp || 0;
  return app * GAME.APPRENTICE_YIELD_PER_LV * level.yield * (1 + temp * GAME.TEMP_COIN_PER_LV);
}

export function upgradeCost(state, line) {
  const base = GAME.UPGRADE_BASE[line];
  const lv = state.upgrades[line] || 0;
  const level = LEVELS[state.level - 1];
  let cost = Math.round(base * Math.pow(GAME.UPGRADE_GROWTH, lv));
  if (level.mechanic === 'shortage' && level.shortage === line) cost = Math.round(cost * GAME.SHORTAGE_MULT);
  if (level.mechanic === 'all' && (line === 'temp' || line === 'speed')) cost = Math.round(cost * GAME.SHORTAGE_MULT);
  return cost;
}

// 离线收益折算：按离线时长（封顶 8h）× 在线产出 × 50%
export function offlineEarnings(state, elapsedSec) {
  const capped = Math.max(0, Math.min(elapsedSec, GAME.OFFLINE_CAP_SEC));
  const perSec = passivePerSec(state) + incomePerForge(state) / Math.max(0.1, forgeIntervalSec(state));
  return Math.round(capped * perSec * GAME.OFFLINE_RATE);
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const rng = mulberry32((opts.seed ?? 1) >>> 0);

  const state = {
    level: level.index,
    scene: level.scene,
    tier: level.tier,
    tierName: level.tierName,
    name: level.name,
    target: level.target,
    yield: level.yield,
    mechanic: level.mechanic,
    shortage: level.shortage || null,
    phase: 'active',          // 'active' | 'won'
    coins: Math.max(0, Math.round(opts.coins ?? 0)),
    upgrades: { power: 0, speed: 0, temp: 0, apprentice: 0 },
    masterpiece: 0,           // 0..1
    forges: 0,                // 本关锻造次数
    forgeProgress: 0,         // 0..1 朝向下一锤
    buffs: { temp: { active: false, until: 0 }, vein: { active: false, until: 0 } },
    strike: { active: false, until: 0 },
    furnaceWindow: { active: false, until: 0 },
    order: null,
    clock: 0,
    totalCoins: Math.max(0, Math.round(opts.coins ?? 0)),
    totalForges: 0,
    taps: 0,
    lastTap: -999,
    result: null,
    _nextFurnaceAt: 5,
    _nextStrikeAt: GAME.STRIKE_AT,
    _lastOrderSec: -1,
  };

  const run = {
    state,
    _rng: rng,
    _events: [],
    _dripAcc: 0,

    // ---- 时间推进（60Hz 固定步长由 main 驱动；这里吃任意 dt）----
    step(dt) {
      const s = this.state;
      if (s.phase === 'won') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1; // 防大跳帧
      s.clock += dt;
      this._updateMechanics(dt);
      this._expireBuffs();

      // 学徒被动收入（每秒结算一次，保证事件密度）
      const passive = passivePerSec(s);
      if (passive > 0) {
        this._dripAcc += passive * dt;
        if (this._dripAcc >= 1) {
          const coins = Math.floor(this._dripAcc);
          this._dripAcc -= coins;
          s.coins += coins;
          s.totalCoins += coins;
          this._emit({ type: 'drip', coins });
        }
      }

      // 自动锻造推进
      s.forgeProgress += dt / forgeIntervalSec(s);
      while (s.forgeProgress >= 1 && s.phase === 'active') {
        s.forgeProgress -= 1;
        this._doForge();
      }
    },

    // ---- 手动补锤（点击铁砧）----
    tap() {
      const s = this.state;
      if (s.phase === 'won') return { ok: false, reason: 'phase' };
      if (s.clock - s.lastTap < GAME.TAP_COOLDOWN) return { ok: false, reason: 'cooldown' };
      s.lastTap = s.clock;
      s.taps += 1;
      this._doForge(true);
      return { ok: true, coins: incomePerForge(s) };
    },

    // ---- 升级四线 ----
    buy(line) {
      const s = this.state;
      if (s.phase === 'won') return { ok: false, reason: 'phase' };
      if (!GAME.UPGRADE_BASE[line]) return { ok: false, reason: 'badLine' };
      const cost = upgradeCost(s, line);
      if (s.coins < cost) return { ok: false, reason: 'poor', cost };
      s.coins -= cost;
      s.upgrades[line] += 1;
      this._emit({ type: 'upgrade', line, level: s.upgrades[line], cost });
      return { ok: true, line, level: s.upgrades[line], cost };
    },

    // ---- 炉候窗口加温 ----
    stoke() {
      const s = this.state;
      if (s.phase === 'won') return { ok: false, reason: 'phase' };
      if (!s.furnaceWindow.active) return { ok: false, reason: 'noWindow' };
      s.buffs.temp.active = true;
      s.buffs.temp.until = s.clock + GAME.STOKE_BUFF_SEC;
      this._emit({ type: 'stoke', until: s.buffs.temp.until });
      return { ok: true };
    },

    // ---- 安抚学徒（付金币贿赂）----
    appease() {
      const s = this.state;
      if (s.phase === 'won') return { ok: false, reason: 'phase' };
      if (!s.strike.active) return { ok: false, reason: 'noStrike' };
      const bribe = Math.max(1, Math.round(incomePerForge(s) * GAME.APPEASE_COST_MULT));
      if (s.coins < bribe) return { ok: false, reason: 'poor', bribe };
      s.coins -= bribe;
      s.strike.active = false;
      s.strike.until = 0;
      this._emit({ type: 'appease', bribe });
      return { ok: true, bribe };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        scene: s.scene,
        phase: s.phase,
        coins: s.coins,
        masterpiece: s.masterpiece,
        forges: s.forges,
        target: s.target,
        forgeInterval: forgeIntervalSec(s),
        incomePerForge: incomePerForge(s),
        passivePerSec: passivePerSec(s),
        upgrades: { ...s.upgrades },
        strike: s.strike.active,
        furnaceWindow: s.furnaceWindow.active,
        vein: s.buffs.vein.active,
        order: s.order,
        totalCoins: s.totalCoins,
        taps: s.taps,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _initMechanics() {
      const s = this.state;
      const level = LEVELS[s.level - 1];
      s.target = level.target;
      s.yield = level.yield;
      s.tier = level.tier;
      s.tierName = level.tierName;
      s.name = level.name;
      s.scene = level.scene;
      s.mechanic = level.mechanic;
      s.shortage = level.shortage || null;
      s.masterpiece = 0;
      s.forges = 0;
      s.forgeProgress = 0;
      s.buffs.temp.active = false;
      s.buffs.vein.active = false;
      s.strike.active = false;
      s.furnaceWindow.active = false;
      s._nextFurnaceAt = s.clock + 5;
      s._nextStrikeAt = s.clock + GAME.STRIKE_AT;
      s._lastOrderSec = -1;

      if (level.mechanic === 'vein' || level.mechanic === 'all') {
        s.buffs.vein.active = true;
        s.buffs.vein.until = s.clock + GAME.VEIN_SEC;
        this._emit({ type: 'vein', until: s.buffs.vein.until });
      }
      if (level.mechanic === 'order' || level.mechanic === 'all') {
        s.order = { active: true, until: s.clock + GAME.ORDER_TIME, bonus: false };
        this._emit({ type: 'order', until: s.order.until });
      } else {
        s.order = null;
      }
    },

    _updateMechanics(dt) {
      const s = this.state;
      const level = LEVELS[s.level - 1];
      const hasFurnace = level.mechanic === 'furnace' || level.mechanic === 'all';
      const hasStrike = level.mechanic === 'strike' || level.mechanic === 'all';

      // 炉候窗口
      if (hasFurnace) {
        if (!s.furnaceWindow.active && s.clock >= s._nextFurnaceAt) {
          s.furnaceWindow.active = true;
          s.furnaceWindow.until = s.clock + GAME.STOKE_WINDOW_LEN;
          s._nextFurnaceAt = s.clock + GAME.STOKE_WINDOW_EVERY;
          this._emit({ type: 'furnaceWindow', until: s.furnaceWindow.until });
        } else if (s.furnaceWindow.active && s.clock >= s.furnaceWindow.until) {
          s.furnaceWindow.active = false;
          this._emit({ type: 'furnaceClose' });
        }
      }

      // 学徒罢工
      if (hasStrike) {
        if (!s.strike.active && s.clock >= s._nextStrikeAt) {
          s.strike.active = true;
          s.strike.until = s.clock + GAME.STRIKE_SEC;
          s._nextStrikeAt = s.clock + GAME.STRIKE_EVERY;
          this._emit({ type: 'strike', until: s.strike.until });
        } else if (s.strike.active && s.clock >= s.strike.until) {
          s.strike.active = false;
          this._emit({ type: 'strikeEnd' });
        }
      }

      // 订单倒计时（最后 5 秒每秒 tick）
      if (s.order && s.order.active) {
        const remain = s.order.until - s.clock;
        if (remain <= 0) {
          s.order.active = false;
          this._emit({ type: 'orderMiss' });
        } else {
          const sec = Math.ceil(remain);
          if (sec !== s._lastOrderSec && sec <= 5) {
            s._lastOrderSec = sec;
            this._emit({ type: 'countdownTick', timeLeft: sec });
          }
        }
      }
    },

    _expireBuffs() {
      const s = this.state;
      if (s.buffs.temp.active && s.clock >= s.buffs.temp.until) {
        s.buffs.temp.active = false;
        this._emit({ type: 'buffEnd', buff: 'temp' });
      }
      if (s.buffs.vein.active && s.clock >= s.buffs.vein.until) {
        s.buffs.vein.active = false;
        this._emit({ type: 'veinEnd' });
      }
    },

    _doForge(isTap = false) {
      const s = this.state;
      const coins = incomePerForge(s);
      s.coins += coins;
      s.totalCoins += coins;
      s.forges += 1;
      s.totalForges += 1;
      s.masterpiece = Math.min(1, s.masterpiece + masterpieceGainPerForge(s));
      this._emit({ type: isTap ? 'tap' : 'forge', coins, forges: s.forges, masterpiece: s.masterpiece });
      if (s.masterpiece >= 1) this._win();
    },

    _win() {
      const s = this.state;
      s.masterpiece = 1;
      const level = LEVELS[s.level - 1];
      let bonus = 0;
      if (s.order && s.order.active) {
        s.order.active = false;
        s.order.bonus = true;
        bonus = Math.round(incomePerForge(s) * GAME.ORDER_BONUS_MULT);
        s.coins += bonus;
        s.totalCoins += bonus;
        this._emit({ type: 'orderDone', bonus });
      }
      this._emit({ type: 'masterpiece', level: s.level, name: level.name, bonus });

      if (s.level >= LEVELS.length) {
        s.phase = 'won';
        s.result = { won: true, level: s.level, totalCoins: s.totalCoins, totalForges: s.totalForges, taps: s.taps };
        this._emit({ type: 'win', level: s.level, totalCoins: s.totalCoins });
      } else {
        const prevTier = s.tier;
        s.level += 1;
        this._initMechanics();
        this._emit({ type: 'levelUp', level: s.level, tier: s.tier });
        if (s.tier > prevTier) this._emit({ type: 'tierUp', tier: s.tier, tierName: s.tierName });
      }
    },
  };

  // 初始机制结算
  run._initMechanics();

  return run;
}

export function createSim() {
  return createRun(0, { seed: 1 });
}
