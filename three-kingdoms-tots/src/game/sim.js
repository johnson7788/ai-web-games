// Three Kingdoms Tots · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：能量/卡牌冷却、出兵/法术/建筑、单位自动索敌与移动、箭塔主城射击、
//       连击能量、胜负与星级、事件表。
// 依赖：config/levels.js（CARDS/LEVELS）、config/game.config.js（GAME/LAYOUT）。
// 随机：注入 seed 的 mulberry32，可复现。

import { CARDS, CARD_MAP, LEVELS, LEVEL_COUNT, levelAt } from '../../config/levels.js';
import { GAME, LAYOUT } from '../../config/game.config.js';

export { LEVEL_COUNT };

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

function statScale(level) {
  return level.enemyLevel >= 2 ? GAME.ENEMY_LEVEL_STAT : 1;
}

function makeUnit(run, side, card, lane, x, scale) {
  return {
    id: run._uid++,
    side,
    kind: card.kind === 'building' ? 'building' : 'unit',
    cardId: card.id,
    lane,
    x,
    hp: Math.round(card.hp * scale),
    maxHp: Math.round(card.hp * scale),
    atk: Math.round(card.atk * scale),
    range: card.range,
    cd: card.cd,
    cdLeft: 0,
    speed: card.speed,
    aoe: card.aoe,
    slowUntil: 0,
    flash: 0,
  };
}

export function createRun(levelIndex = 0, opts = {}) {
  const level = levelAt(levelIndex);
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    level: level.index,
    phase: 'playing', // 'playing' | 'won' | 'lost'
    time: GAME.BATTLE_TIME,
    initialTime: GAME.BATTLE_TIME,
    energy: GAME.ENERGY_START,
    maxEnergy: GAME.ENERGY_MAX,
    combo: 0,
    comboT: 0,
    stars: 0,
    result: null,
    deployCount: 0,
    player: {
      keep: { side: 'player', kind: 'keep', lane: -1, x: LAYOUT.KEEP_PLAYER_X, hp: level.keepPlayerHp, maxHp: level.keepPlayerHp, atk: GAME.KEEP_ATK, range: GAME.KEEP_RANGE, cd: GAME.KEEP_CD, cdLeft: 0 },
      towers: [
        { side: 'player', kind: 'tower', lane: 0, x: LAYOUT.TOWER_PLAYER_X, hp: GAME.TOWER_HP, maxHp: GAME.TOWER_HP, atk: GAME.TOWER_ATK, range: GAME.TOWER_RANGE, cd: GAME.TOWER_CD, cdLeft: 0 },
        { side: 'player', kind: 'tower', lane: 1, x: LAYOUT.TOWER_PLAYER_X, hp: GAME.TOWER_HP, maxHp: GAME.TOWER_HP, atk: GAME.TOWER_ATK, range: GAME.TOWER_RANGE, cd: GAME.TOWER_CD, cdLeft: 0 },
      ],
      units: [],
    },
    enemy: {
      keep: { side: 'enemy', kind: 'keep', lane: -1, x: LAYOUT.KEEP_ENEMY_X, hp: level.keepEnemyHp, maxHp: level.keepEnemyHp, atk: GAME.KEEP_ATK, range: GAME.KEEP_RANGE, cd: GAME.KEEP_CD, cdLeft: 0 },
      towers: [
        { side: 'enemy', kind: 'tower', lane: 0, x: LAYOUT.TOWER_ENEMY_X, hp: GAME.TOWER_HP, maxHp: GAME.TOWER_HP, atk: GAME.TOWER_ATK, range: GAME.TOWER_RANGE, cd: GAME.TOWER_CD, cdLeft: 0 },
        { side: 'enemy', kind: 'tower', lane: 1, x: LAYOUT.TOWER_ENEMY_X, hp: GAME.TOWER_HP, maxHp: GAME.TOWER_HP, atk: GAME.TOWER_ATK, range: GAME.TOWER_RANGE, cd: GAME.TOWER_CD, cdLeft: 0 },
      ],
      units: [],
    },
    cards: CARDS.map((c) => ({ id: c.id, cost: c.cost, cd: 0, cdMax: c.cd })),
    _energyFloor: GAME.ENERGY_START,
  };

  const run = {
    state,
    _uid: 1,
    _rng: rng,
    _level: level,
    _events: [],
    _clock: 0,
    _enemyEnergy: GAME.ENERGY_START,
    _enemyAiT: 1.2,

    // ---- 时间推进 ----
    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;

      // 能量恢复
      if (s.energy < s.maxEnergy) {
        s.energy = Math.min(s.maxEnergy, s.energy + GAME.ENERGY_REGEN * dt);
      }
      {
        const newFloor = Math.floor(s.energy);
        if (newFloor > s._energyFloor) {
          this._emit({ type: 'energy', energy: newFloor });
        }
        s._energyFloor = newFloor;
      }

      // 卡牌冷却
      for (const c of s.cards) {
        if (c.cd > 0) c.cd = Math.max(0, c.cd - dt);
      }

      // 连击衰减
      if (s.comboT > 0) {
        s.comboT -= dt;
        if (s.comboT <= 0) s.combo = 0;
      }

      // 战斗：双方单位/建筑/塔/主城
      this._fight(dt);

      // 敌方 AI 出兵
      this._enemyAi(dt);

      // 时间
      s.time -= dt;
      if (s.time <= 0) {
        s.time = 0;
        this._emit({ type: 'overtime' });
        this._resolveOvertime();
        return;
      }
    },

    // ---- 我方出兵 / 法术 / 建筑 ----
    deploy(cardId, lane, x) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const card = CARD_MAP[cardId];
      if (!card) return { ok: false, reason: 'unknown' };
      const slot = s.cards.find((c) => c.id === cardId);
      if (!slot) return { ok: false, reason: 'unknown' };
      if (slot.cd > 0) return { ok: false, reason: 'cooldown' };
      if (s.energy < card.cost) return { ok: false, reason: 'energy' };
      const ln = Math.max(0, Math.min(1, lane | 0));

      if (card.kind === 'spell') {
        this._castSpell(card, slot, ln, x);
        s.energy -= card.cost;
        slot.cd = slot.cdMax;
        s.deployCount += 1;
        return { ok: true };
      }

      // 建筑/单位：出兵点固定在我方出兵线，x 仅用于岩石落点
      let ux = LAYOUT.PLAYER_SPAWN_X;
      if (card.kind === 'building') {
        ux = Math.max(100, Math.min(620, x == null ? LAYOUT.PLAYER_SPAWN_X : x));
      }
      const u = makeUnit(this, 'player', card, ln, ux, 1);
      s.player.units.push(u);
      s.energy -= card.cost;
      slot.cd = slot.cdMax;
      s.deployCount += 1;
      this._emit({ type: 'spawn', side: 'player', cardId: card.id, lane: ln, x: ux });
      return { ok: true };
    },

    // ---- 战斗主循环 ----
    _fight(dt) {
      const s = this.state;
      const sides = [s.player, s.enemy];

      // 塔/主城射击（无冷却用）
      for (const side of sides) {
        const shooters = [side.keep, ...side.towers];
        for (const sh of shooters) {
          if (sh.hp <= 0) continue;
          if (sh.cdLeft > 0) sh.cdLeft -= dt;
          const target = this._nearestEnemy(sh);
          if (!target) continue;
          if (Math.abs(target.x - sh.x) <= sh.range) {
            if (sh.cdLeft <= 0) {
              this._deal(sh, target, sh.atk, sh);
              sh.cdLeft = sh.cd;
            }
          }
        }
      }

      // 单位行动
      for (const side of sides) {
        for (const u of side.units) {
          if (u.hp <= 0) continue;
          if (u.cdLeft > 0) u.cdLeft -= dt;
          if (u.slowUntil > this._clock) u.flash = 0.2;
          const target = this._nearestEnemy(u);
          if (!target) continue;
          const dist = target.x - u.x;
          const adist = Math.abs(dist);
          if (adist <= u.range) {
            if (u.cdLeft <= 0) {
              this._deal(u, target, u.atk, u);
              u.cdLeft = u.cd;
            }
          } else {
            const sp = u.slowUntil > this._clock ? u.speed * 0.6 : u.speed;
            const dir = u.side === 'player' ? 1 : -1;
            u.x += dir * sp * dt;
            u.x = Math.max(LAYOUT.KEEP_PLAYER_X + 30, Math.min(LAYOUT.KEEP_ENEMY_X - 30, u.x));
          }
        }
        // 移除死亡单位
        side.units = side.units.filter((u) => {
          if (u.hp > 0) return true;
          this._emit({ type: 'death', id: u.id, side: u.side, cardId: u.cardId, kind: u.kind });
          return false;
        });
      }
    },

    // ---- 最近敌方（含主城/塔/单位/建筑），同 x 优先同兵线 ----
    _nearestEnemy(e) {
      const s = this.state;
      const oppo = e.side === 'player' ? s.enemy : s.player;
      const list = [oppo.keep, ...oppo.towers, ...oppo.units].filter((t) => t.hp > 0);
      if (!list.length) return null;
      let best = list[0];
      let bestD = Math.abs(best.x - e.x);
      for (const t of list) {
        const d = Math.abs(t.x - e.x);
        if (d < bestD - 0.001 || (Math.abs(d - bestD) <= 0.001 && this._laneMatch(e, t) > this._laneMatch(e, best))) {
          best = t;
          bestD = d;
        }
      }
      return best;
    },

    _laneMatch(a, b) {
      if (a.lane === -1 || b.lane === -1) return 1;
      return a.lane === b.lane ? 2 : 0;
    },

    // ---- 结算一次攻击（含 aoe / 连击） ----
    _deal(attacker, target, dmg, source) {
      const s = this.state;
      this._applyDamage(attacker, target, dmg, source);
      if (attacker.aoe > 0 && attacker.kind === 'unit') {
        const oppo = attacker.side === 'player' ? s.enemy : s.player;
        for (const t of [...oppo.towers, ...oppo.units]) {
          if (t !== target && t.hp > 0 && Math.abs(t.x - target.x) <= attacker.aoe) {
            this._applyDamage(attacker, t, dmg, source, true);
          }
        }
      }
    },

    _applyDamage(attacker, target, dmg, source, splash) {
      const s = this.state;
      if (target.hp <= 0) return;
      target.hp -= dmg;
      this._emit({ type: 'hit', side: attacker.side, targetId: target.id || target.kind, targetKind: target.kind, dmg, splash: !!splash });
      if (target.kind === 'keep') {
        this._emit({ type: 'keepHit', side: target.side, hp: Math.max(0, target.hp), maxHp: target.maxHp });
      }
      if (target.hp <= 0) {
        target.hp = 0;
        if (target.kind === 'tower') {
          this._emit({ type: 'towerDown', side: target.side, lane: target.lane });
        } else if (target.kind === 'unit' || target.kind === 'building') {
          // 单位死亡在 _fight 过滤时发 death；这里发击杀连击
          if (attacker.side === 'player') {
            s.combo += 1;
            s.comboT = GAME.COMBO_WINDOW;
            this._emit({ type: 'combo', combo: s.combo });
            if (s.combo % GAME.COMBO_ENERGY_EVERY === 0 && s.energy < s.maxEnergy) {
              s.energy = Math.min(s.maxEnergy, s.energy + 1);
              s._energyFloor = Math.max(s._energyFloor, Math.floor(s.energy));
              this._emit({ type: 'energy', energy: Math.floor(s.energy), combo: true });
            }
          }
        }
        // 主城被摧毁 → 胜负
        if (target.kind === 'keep') {
          if (target.side === 'enemy') this._win();
          else this._lose('destroyed');
        }
      }
    },

    _enemyAi(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      if (this._enemyEnergy < s.maxEnergy) this._enemyEnergy = Math.min(s.maxEnergy, this._enemyEnergy + GAME.ENERGY_REGEN * dt);
      this._enemyAiT -= dt;
      if (this._enemyAiT > 0) return;
      const deck = this._level.enemyDeck.map((id) => CARD_MAP[id]).filter(Boolean);
      const affordable = deck.filter((c) => c.cost <= this._enemyEnergy);
      if (!affordable.length) {
        this._enemyAiT = 0.4;
        return;
      }
      // 优先贵的卡，其次随机
      affordable.sort((a, b) => b.cost - a.cost);
      const pick = affordable[0].cost >= 3 ? affordable[0] : affordable[Math.floor(this._rng() * Math.min(affordable.length, 2))];
      const lane = this._enemyLane();
      const scale = statScale(this._level);
      if (pick.kind === 'spell') {
        // 敌方只带建筑/单位，不带法术（当前 deck 无法术）
        this._enemyAiT = 0.5;
        return;
      }
      const ux = pick.kind === 'building' ? (LAYOUT.KEEP_ENEMY_X - 220 - Math.floor(this._rng() * 180)) : LAYOUT.ENEMY_SPAWN_X;
      const u = makeUnit(this, 'enemy', pick, lane, ux, scale);
      s.enemy.units.push(u);
      this._enemyEnergy -= pick.cost;
      this._enemyAiT = (this._level.enemyRush ? 1.4 : 2.6) + this._rng() * 1.4;
      this._emit({ type: 'spawn', side: 'enemy', cardId: pick.id, lane, x: ux });
    },

    _enemyLane() {
      const s = this.state;
      const c0 = s.enemy.units.filter((u) => u.lane === 0).length;
      const c1 = s.enemy.units.filter((u) => u.lane === 1).length;
      return c0 <= c1 ? 0 : 1;
    },

    // ---- 法术 ----
    _castSpell(card, slot, lane, x) {
      const s = this.state;
      if (card.id === 'fire') {
        const target = this._frontEnemyX();
        this._emit({ type: 'spell', cardId: 'fire', x: target });
        for (const t of [...s.enemy.towers, ...s.enemy.units, s.enemy.keep]) {
          if (t.hp > 0 && Math.abs(t.x - target) <= card.aoe) {
            this._applyDamage({ side: 'player', aoe: 0 }, t, card.atk, { side: 'player' });
          }
        }
      } else if (card.id === 'frost') {
        const target = this._frontEnemyX();
        this._emit({ type: 'spell', cardId: 'frost', x: target });
        for (const t of [...s.enemy.towers, ...s.enemy.units]) {
          if (t.hp > 0 && Math.abs(t.x - target) <= card.aoe) {
            if (t.kind === 'unit') t.slowUntil = this._clock + 5;
            this._applyDamage({ side: 'player', aoe: 0 }, t, card.atk, { side: 'player' });
          }
        }
      } else if (card.id === 'heal') {
        this._emit({ type: 'spell', cardId: 'heal', x: LAYOUT.KEEP_PLAYER_X });
        s.player.keep.hp = Math.min(s.player.keep.maxHp, s.player.keep.hp + card.atk);
        for (const u of s.player.units) {
          if (u.hp > 0 && Math.abs(u.x - LAYOUT.KEEP_PLAYER_X) <= card.aoe) {
            u.hp = Math.min(u.maxHp, u.hp + card.atk * 0.5);
          }
        }
        for (const t of s.player.towers) t.hp = Math.min(t.maxHp, t.hp + card.atk * 0.5);
      }
    },

    _frontEnemyX() {
      const s = this.state;
      const list = [...s.enemy.units, ...s.enemy.towers].filter((t) => t.hp > 0);
      if (!list.length) return LAYOUT.KEEP_ENEMY_X;
      return Math.min(...list.map((t) => t.x));
    },

    _win() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.phase = 'won';
      const elapsed = s.initialTime - s.time;
      const hpRatio = s.player.keep.hp / s.player.keep.maxHp;
      s.stars = 1 + (hpRatio >= GAME.STAR_HP_RATIO ? 1 : 0) + (elapsed <= GAME.STAR_TIME ? 1 : 0);
      s.result = { won: true, stars: s.stars, time: elapsed, keepHp: s.player.keep.hp, keepMax: s.player.keep.maxHp };
      this._emit({ type: 'win', stars: s.stars, time: elapsed });
    },

    _lose(reason) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, time: s.initialTime - s.time, keepHp: s.player.keep.hp, keepMax: s.player.keep.maxHp, reason };
      this._emit({ type: 'lose', reason });
    },

    _resolveOvertime() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      // 你是攻城方：时间耗尽仍未攻破主城 = 战败（保证 noinput 基线有死亡，也带来时间压力）
      this._lose('timeUp');
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        time: s.time,
        energy: s.energy,
        maxEnergy: s.maxEnergy,
        combo: s.combo,
        playerKeepHp: s.player.keep.hp,
        playerKeepMax: s.player.keep.maxHp,
        enemyKeepHp: s.enemy.keep.hp,
        enemyKeepMax: s.enemy.keep.maxHp,
        deployCount: s.deployCount,
        stars: s.stars,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    _emit(e) { this._events.push(e); },
  };

  // 关卡预置岩石（敌方半场）
  for (let i = 0; i < level.preRocks; i += 1) {
    const lane = i % 2;
    const rock = CARD_MAP.rock;
    const u = makeUnit(run, 'enemy', rock, lane, LAYOUT.KEEP_ENEMY_X - 200 - i * 120, 1);
    state.enemy.units.push(u);
  }

  return run;
}

// ------------------------------------------------------------------ 兼容别名
export function createSim() {
  return createRun(0, { seed: 1 });
}
export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
