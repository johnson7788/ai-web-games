// WORD DUEL · 模拟层（纯逻辑，零 DOM/window/Date.now/localStorage/canvas）
// 职责：回合制拼词决斗——手牌发牌、选字拼词、校验、伤害/治疗/护盾/冰冻/换牌、
//       敌人回合、胜负判定、事件表。
// 依赖：config/levels.js（LEVELS）、config/words.js（WORD_SET/WORD_LIST）、config/game.config.js（GAME）。
// 随机：注入 seed 的 mulberry32，可复现。

import { LEVELS } from '../../config/levels.js';
import { WORD_SET, WORD_LIST } from '../../config/words.js';
import { GAME } from '../../config/game.config.js';

// 治愈词（heal 类）：L8+ 解锁，拼出回血而非攻击
export const HEAL_WORDS = new Set([
  'heal', 'cure', 'mend', 'life', 'rest', 'treat', 'soothe', 'revive', 'salve', 'renew',
]);

// 按长度预分桶，供发牌选种子词 + greedy 找最长可拼词（长词优先=高伤）
const WORDS_BY_LEN = [];
for (const w of WORD_LIST) {
  (WORDS_BY_LEN[w.length] || (WORDS_BY_LEN[w.length] = [])).push(w);
}

// 字母权重（近似英语频率，元音偏重，保证手牌可拼）
const LETTER_POOL = (() => {
  const weights = {
    a: 9, b: 2, c: 2, d: 4, e: 12, f: 2, g: 3, h: 2, i: 9, j: 1, k: 1, l: 4, m: 2,
    n: 6, o: 8, p: 2, q: 1, r: 6, s: 4, t: 6, u: 4, v: 2, w: 2, x: 1, y: 2, z: 1,
  };
  const pool = [];
  for (const [ch, n] of Object.entries(weights)) for (let i = 0; i < n; i += 1) pool.push(ch);
  return pool;
})();

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function letterCounts(letters) {
  const cnt = new Array(26).fill(0);
  for (const ch of letters) cnt[ch.charCodeAt(0) - 97] += 1;
  return cnt;
}

/** 单词能否由 letters 的多重集拼出（不关心顺序） */
export function canForm(word, letters) {
  const cnt = letterCounts(letters);
  for (const ch of word) {
    const i = ch.charCodeAt(0) - 97;
    if (i < 0 || i >= 26 || cnt[i] <= 0) return false;
    cnt[i] -= 1;
  }
  return true;
}

/** 返回 letters 中按序拼出 word 的下标序列（letters 与 word 均小写） */
export function indicesForWord(letters, word) {
  const used = new Set();
  const idx = [];
  for (const ch of word) {
    let found = -1;
    for (let i = 0; i < letters.length; i += 1) {
      if (!used.has(i) && letters[i] === ch) { found = i; break; }
    }
    if (found < 0) return null;
    used.add(found);
    idx.push(found);
  }
  return idx;
}

function canFormWithCount(word, cnt) {
  const c = cnt.slice();
  for (const ch of word) {
    const i = ch.charCodeAt(0) - 97;
    if (i < 0 || i >= 26 || c[i] <= 0) return false;
    c[i] -= 1;
  }
  return true;
}

/** 从 letters 找能拼出的最长词典词（长词优先 = 高伤） */
export function findBestWord(letters) {
  const cnt = letterCounts(letters);
  for (let len = Math.min(8, letters.length); len >= 3; len -= 1) {
    const bucket = WORDS_BY_LEN[len];
    if (!bucket) continue;
    for (const w of bucket) {
      if (canFormWithCount(w, cnt)) return w;
    }
  }
  return null;
}

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    level: level.index,
    scene: level.scene,
    phase: 'playing', // 'playing' | 'won' | 'lost'
    turn: 0,
    playerHp: GAME.PLAYER_MAX_HP,
    playerMaxHp: GAME.PLAYER_MAX_HP,
    enemyHp: level.enemyHp,
    enemyMaxHp: level.enemyHp,
    enemyShield: level.shield,
    enemyShieldMax: level.shield,
    enemyName: level.name,
    element: level.element,
    elementLabel: level.elementLabel,
    hand: [],           // { ch, selected }
    selection: [],      // 已选 hand 下标（按序）
    word: '',
    timeLeft: level.turnTime,
    turnTime: level.turnTime,
    frozen: false,
    combo: 0,
    result: null,
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0,
    _lastTickSec: Math.ceil(level.turnTime),

    // ---- 时间推进（回合倒计时；超时=空过，敌人行动）----
    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;

      s.timeLeft -= dt;
      const sec = Math.ceil(s.timeLeft);
      if (sec < this._lastTickSec && sec >= 0) {
        this._lastTickSec = sec;
        this._emit({ type: 'turnTick', timeLeft: sec });
      }
      if (s.timeLeft <= 0) {
        s.timeLeft = 0;
        this._emit({ type: 'timeout' });
        this._endPlayerTurn();
      }
    },

    // ---- 选字：toggle（再点取消）----
    selectLetter(i) {
      const s = this.state;
      if (s.phase !== 'playing' || s.frozen) return { ok: false, reason: 'locked' };
      if (i < 0 || i >= s.hand.length) return { ok: false, reason: 'bounds' };
      const tile = s.hand[i];
      if (tile.selected) {
        tile.selected = false;
        const pos = s.selection.indexOf(i);
        if (pos >= 0) s.selection.splice(pos, 1);
        s.word = s.selection.map((j) => s.hand[j].ch).join('');
        this._emit({ type: 'letterDeselect', index: i });
      } else {
        tile.selected = true;
        s.selection.push(i);
        s.word = s.selection.map((j) => s.hand[j].ch).join('');
        this._emit({ type: 'letterSelect', index: i, word: s.word });
      }
      return { ok: true, word: s.word };
    },

    // ---- 退格：取消最后一个字母 ----
    deselectLast() {
      const s = this.state;
      if (s.phase !== 'playing' || s.frozen) return { ok: false, reason: 'locked' };
      if (!s.selection.length) return { ok: false, reason: 'empty' };
      const i = s.selection.pop();
      s.hand[i].selected = false;
      s.word = s.selection.map((j) => s.hand[j].ch).join('');
      this._emit({ type: 'letterDeselect', index: i });
      return { ok: true, word: s.word };
    },

    // ---- 提交单词（施法）----
    submitWord() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.frozen) return { ok: false, reason: 'frozen' };
      const word = s.selection.map((i) => s.hand[i].ch).join('');
      this._emit({ type: 'submit', word });

      if (word.length === 0) return { ok: false, reason: 'empty' };

      const inDict = WORD_SET.has(word);
      const tooShort = word.length < this._level.minWordLen;
      if (inDict && !tooShort) {
        this._applyCast(word);
      } else {
        // 拼错：吃反伤（雷系双倍）
        const mult = this._level.doubleCounter ? 2 : 1;
        this._emit({ type: 'miss', word, reason: tooShort ? 'tooShort' : 'notAWord' });
        this._emit({ type: 'bubbleTip', msgKey: tooShort ? 'wordTooShort' : 'notAWord', vars: { n: this._level.minWordLen } });
        this._damagePlayer(this._level.enemyDamage * mult, { counter: true, word });
        s.combo = 0;
      }
      this._endPlayerTurn();
      return { ok: true, word, valid: inDict && !tooShort };
    },

    // ---- 换牌：弃 3 补 3（优先已选），结束回合 ----
    swap() {
      const s = this.state;
      if (s.phase !== 'playing' || s.frozen) return { ok: false, reason: 'locked' };
      const swapSize = Math.min(GAME.SWAP_SIZE, s.hand.length);
      const chosen = s.selection.slice(0, swapSize);
      // 若未选满，补选未选中的前几枚
      for (let i = 0; chosen.length < swapSize && i < s.hand.length; i += 1) {
        if (!chosen.includes(i)) chosen.push(i);
      }
      chosen.sort((a, b) => a - b);
      const removed = [];
      for (let k = chosen.length - 1; k >= 0; k -= 1) {
        const i = chosen[k];
        removed.push(s.hand[i].ch);
        s.hand.splice(i, 1);
      }
      for (const ch of removed) {
        s.hand.push({ ch: this._rollLetter(), selected: false });
      }
      s.selection = [];
      s.word = '';
      this._emit({ type: 'swap', removed, word: s.word });
      this._endPlayerTurn();
      return { ok: true, removed };
    },

    // ---- 调试：自动拼出当前手牌最长词并提交 ----
    autoSpell() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const letters = s.hand.map((h) => h.ch);
      const word = findBestWord(letters);
      if (!word) { this.swap(); return { ok: false, reason: 'noWord', swapped: true }; }
      const idx = indicesForWord(letters, word);
      if (!idx) return { ok: false, reason: 'noIndices' };
      for (const i of idx) this.selectLetter(i);
      const res = this.submitWord();
      return { ok: true, word, ...res };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        scene: s.scene,
        phase: s.phase,
        turn: s.turn,
        playerHp: s.playerHp,
        playerMaxHp: s.playerMaxHp,
        enemyHp: s.enemyHp,
        enemyMaxHp: s.enemyMaxHp,
        enemyShield: s.enemyShield,
        enemyShieldMax: s.enemyShieldMax,
        enemyName: s.enemyName,
        element: s.element,
        elementLabel: s.elementLabel,
        hand: s.hand.map((h) => h.ch),
        selection: s.selection.slice(),
        word: s.word,
        timeLeft: s.timeLeft,
        turnTime: s.turnTime,
        frozen: s.frozen,
        combo: s.combo,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _rollLetter() {
      return LETTER_POOL[Math.floor(this._rng() * LETTER_POOL.length)];
    },

    _pickSeedWord() {
      // 选一个 4–6 字母词做种子，保证手牌必能拼出至少一个合法词
      const len = 4 + Math.floor(this._rng() * 3);
      const bucket = WORDS_BY_LEN[len] || WORDS_BY_LEN[4];
      return bucket[Math.floor(this._rng() * bucket.length)];
    },

    _dealHand() {
      const s = this.state;
      const letters = this._pickSeedWord().split('');
      while (letters.length < GAME.HAND_SIZE) letters.push(this._rollLetter());
      // Fisher–Yates 洗牌
      for (let i = letters.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this._rng() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
      }
      s.hand = letters.map((ch) => ({ ch, selected: false }));
      s.selection = [];
      s.word = '';
    },

    _applyCast(word) {
      const s = this.state;
      const L = this._level;
      // 速度加成：提交越快伤害越高（剩余时间占比）
      const ratio = s.turnTime > 0 ? Math.max(0, s.timeLeft / s.turnTime) : 0;
      const speedBonus = Math.round(ratio * GAME.SPEED_BONUS_MAX);
      const isHeal = L.healWords && HEAL_WORDS.has(word);

      s.combo += 1;
      this._emit({ type: 'spell', word, length: word.length, speedBonus });

      if (isHeal) {
        const heal = word.length * GAME.HEAL_PER_LEN;
        s.playerHp = Math.min(s.playerMaxHp, s.playerHp + heal);
        this._emit({ type: 'heal', amount: heal, playerHp: s.playerHp });
        this._emit({ type: 'bubbleTip', msgKey: 'healCast', vars: { n: heal } });
        return;
      }

      const damage = GAME.DAMAGE_BASE + word.length * GAME.DAMAGE_PER_LEN + speedBonus;
      this._damageEnemy(damage, { word, length: word.length });
    },

    _damageEnemy(damage, meta) {
      const s = this.state;
      let hp = s.enemyHp;
      let shield = s.enemyShield;
      if (shield > 0) {
        const absorbed = Math.min(shield, damage);
        shield -= absorbed;
        s.enemyShield = shield;
        if (shield <= 0) {
          this._emit({ type: 'shieldBreak' });
          this._emit({ type: 'bubbleTip', msgKey: 'shieldBroken' });
        }
        this._emit({ type: 'hit', damage: absorbed, target: 'shield', ...meta });
        // 破盾剩余伤害打到本体
        const leftover = damage - absorbed;
        if (leftover > 0) this._damageEnemy(leftover, { ...meta, leftover: true });
        return;
      }
      hp = Math.max(0, hp - damage);
      s.enemyHp = hp;
      this._emit({ type: 'hit', damage, target: 'hp', ...meta });
      // 长词签名：符文链在对手身上炸成词云
      if (meta.length && meta.length >= 6) {
        this._emit({ type: 'wordCloud', word: meta.word, length: meta.length });
      }
      if (hp <= 0) this._win();
    },

    _damagePlayer(damage, meta) {
      const s = this.state;
      const total = Math.max(0, Math.round(damage));
      s.playerHp = Math.max(0, s.playerHp - total);
      this._emit({ type: 'enemyAttack', damage: total, ...meta });
      this._emit({ type: 'playerHit', damage: total, ...meta });
      if (s.playerHp <= 0) this._lose();
    },

    _stealLetter() {
      const s = this.state;
      if (s.hand.length <= 1) return;
      const i = Math.floor(this._rng() * s.hand.length);
      const stolen = s.hand[i].ch;
      s.hand.splice(i, 1);
      // 若偷走的正是已选字母，清掉对应选择
      s.selection = s.selection.filter((j) => j !== i).map((j) => (j > i ? j - 1 : j));
      s.word = s.selection.map((j) => s.hand[j] ? s.hand[j].ch : '').join('');
      this._emit({ type: 'letterTheft', stolen });
      this._emit({ type: 'bubbleTip', msgKey: 'letterTheft', vars: { ch: stolen } });
    },

    // 敌人回合：攻击（可两段连击 / 偷字 / 自愈 / 冻结）
    _resolveEnemyTurn() {
      const s = this.state;
      const L = this._level;
      const hits = L.twinAttack ? 2 : 1;
      for (let i = 0; i < hits; i += 1) {
        if (s.phase !== 'playing') return;
        this._damagePlayer(L.enemyDamage, { element: L.element });
      }
      if (s.phase !== 'playing') return;
      if (L.letterTheft > 0) this._stealLetter();
      if (L.enemyHeal > 0) {
        const before = s.enemyHp;
        s.enemyHp = Math.min(s.enemyMaxHp, s.enemyHp + L.enemyHeal);
        if (s.enemyHp > before) this._emit({ type: 'enemyHeal', amount: s.enemyHp - before });
      }
      if (L.freezeChance > 0 && this._rng() < L.freezeChance) {
        s.frozen = true;
      }
    },

    _endPlayerTurn() {
      if (this.state.phase !== 'playing') return;
      this._resolveEnemyTurn();
      if (this.state.phase !== 'playing') return;
      this._startPlayerTurn();
    },

    _startPlayerTurn() {
      const s = this.state;
      // 冻结跳过（对手免费多打一轮），带 guard 防极端连环冻
      let guard = 0;
      while (s.frozen && guard++ < 8) {
        s.frozen = false;
        this._emit({ type: 'frozen' });
        this._emit({ type: 'bubbleTip', msgKey: 'frozen' });
        this._resolveEnemyTurn();
        if (s.phase !== 'playing') return;
      }
      s.frozen = false;
      s.turn += 1;
      this._dealHand();
      s.timeLeft = this._level.turnTime;
      this._lastTickSec = Math.ceil(s.timeLeft);
      this._emit({ type: 'turnBegin', turn: s.turn });
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      const stars = (s.playerHp >= s.playerMaxHp * 0.8 ? 3 : s.playerHp >= s.playerMaxHp * 0.5 ? 2 : 1);
      s.result = { won: true, stars, turns: s.turn, playerHp: s.playerHp };
      this._emit({ type: 'win', stars, turns: s.turn });
    },

    _lose() {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, turns: s.turn, playerHp: s.playerHp };
      this._emit({ type: 'lose', reason: 'hp' });
    },
  };

  run._startPlayerTurn();

  return run;
}

// 兼容骨架别名
export function createSim() {
  return createRun(0, { seed: 1 });
}
