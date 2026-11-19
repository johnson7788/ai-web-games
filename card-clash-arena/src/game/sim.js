// 纯逻辑：霓虹 1v1 卡牌对决（无 DOM，可在 Node 直接跑）。
// 玩法骨架 1:1 沿用参考（三属性比牌 / 百分比伤害 2-4-6 / 10 生命 / 5 张手牌 /
// 金币技能 buff·debuff·cancel / 赢回合金币奖励），另加 3 个新机制：
//   1. 连击 combo：连胜 ≥2/≥4 额外伤害；   2. 超频 overdrive：×2 出牌属性；
//   3. 星级 stars：结算 1–3 星（按剩余生命）。
// 参考源码只提取规则，不复制其美术/音频/文本。
import { CARDS, ATTR_KEYS } from '../../config/cards.js';
import { GAME } from '../../config/game.config.js';

export { ATTR_KEYS };

// 可复现随机（mulberry32）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function cardStat(cardId, attr) {
  return CARDS[cardId].stats[attr];
}

// 百分比伤害：|差比| ≤20% → 2；≤40% → 4；否则 6。胜者扣败者血。
export function damageFor(playerVal, enemyVal) {
  if (playerVal === enemyVal) return { winner: 'draw', dmg: 0 };
  const winner = playerVal > enemyVal ? 'player' : 'enemy';
  const win = Math.max(playerVal, enemyVal);
  const lose = Math.min(playerVal, enemyVal);
  const perc = Math.abs(Math.round(((win - lose) / win) * 100));
  const dmg = perc <= 20 ? 2 : perc <= 40 ? 4 : 6;
  return { winner, dmg };
}

function comboBonus(combo) {
  if (combo >= GAME.COMBO_BONUS_2_AT) return GAME.COMBO_BONUS_2;
  if (combo >= GAME.COMBO_BONUS_1_AT) return GAME.COMBO_BONUS_1;
  return 0;
}

export function createRun(seed = 1) {
  const rng = mulberry32(seed);
  const pool = shuffle(CARDS.map((_, i) => i), rng);
  const events = [];
  const emit = (type, payload = {}) => events.push({ type, ...payload });

  const hand = [];
  const enemyHand = [];
  for (let i = 0; i < GAME.HAND_SIZE; i += 1) {
    hand.push(pool.pop());
    enemyHand.push(pool.pop());
  }

  const state = {
    phase: 'reveal',            // reveal | playerTurn | resolving | won | lost
    round: 1,
    roundAttribute: Math.floor(rng() * 3),
    playerHp: GAME.MAX_HEALTH,
    enemyHp: GAME.MAX_HEALTH,
    coins: 0,
    combo: 0,
    hand,
    enemyHand,
    playerPlayed: null,
    enemyPlayed: null,
    playerVal: 0,
    enemyVal: 0,
    buffActive: false,
    debuffActive: false,
    overdriveActive: false,
    cancelActive: false,
    lastDamage: { winner: null, dmg: 0, bonus: 0, total: 0, to: null },
    revealT: GAME.REVEAL_TIME,
    turnT: GAME.TURN_TIME,
    resolveT: GAME.RESOLVE_TIME,
    stars: 0,
    roundsWon: 0,
    roundsLost: 0,
    draws: 0,
    bestStars: 0,
  };

  let endAfterResolve = null;
  let heartbeat = GAME.HEARTBEAT_SEC;

  function drawCard() {
    if (pool.length === 0) return null;
    const i = Math.floor(rng() * pool.length);
    return pool.splice(i, 1)[0];
  }

  function enemyAI() {
    const attr = state.roundAttribute;
    const useBest = rng() < GAME.ENEMY_BEST_P;
    if (useBest) {
      let best = enemyHand[0];
      let bestV = -1;
      for (const id of enemyHand) {
        const v = CARDS[id].stats[attr];
        if (v > bestV) { bestV = v; best = id; }
      }
      return best;
    }
    return enemyHand[Math.floor(rng() * enemyHand.length)];
  }

  function resolve() {
    const attr = state.roundAttribute;
    const buffMult = state.buffActive ? GAME.BUFF_INC : 1;
    const overMult = state.overdriveActive ? GAME.OVERDRIVE_INC : 1;
    const debuffMult = state.debuffActive ? GAME.DEBUFF_DEC : 1;

    state.playerVal = Math.round(CARDS[state.playerPlayed].stats[attr] * buffMult * overMult);
    state.enemyVal = Math.round(CARDS[state.enemyPlayed].stats[attr] * debuffMult);

    let winner;
    let dmg;
    if (state.cancelActive) {
      winner = 'draw';
      dmg = 0;
    } else {
      const r = damageFor(state.playerVal, state.enemyVal);
      winner = r.winner;
      dmg = r.dmg;
    }

    let bonus = 0;
    let total = 0;
    if (winner === 'player') {
      state.combo += 1;
      bonus = comboBonus(state.combo);
      total = dmg + bonus;
      state.enemyHp = Math.max(0, state.enemyHp - total);
      state.roundsWon += 1;
      state.coins += dmg * GAME.WIN_REWARD_PER_DMG;
    } else if (winner === 'enemy') {
      const hadCombo = state.combo > 0;
      state.combo = 0;
      total = dmg;
      state.playerHp = Math.max(0, state.playerHp - total);
      state.roundsLost += 1;
      state.coins += dmg * GAME.LOSE_REWARD_PER_DMG;
      if (hadCombo) emit('comboBreak', {});
    } else {
      total = 0;
      state.draws += 1;
    }

    state.lastDamage = {
      winner,
      dmg,
      bonus,
      total,
      to: winner === 'player' ? 'enemy' : winner === 'enemy' ? 'player' : null,
    };

    emit('cardPlayed', { card: state.playerPlayed, value: state.playerVal, attr });
    emit('enemyPlayed', { card: state.enemyPlayed, value: state.enemyVal, attr });
    if (winner === 'player') {
      emit('roundWin', { dmg, bonus, total, coins: dmg * GAME.WIN_REWARD_PER_DMG });
      emit('damage', { to: 'enemy', amount: total });
      if (bonus > 0) emit('combo', { combo: state.combo, bonus });
    } else if (winner === 'enemy') {
      emit('roundLose', { dmg, total });
      emit('damageTaken', { amount: total });
    } else {
      emit('roundDraw', {});
    }
    emit('coin', { coins: state.coins });

    state.phase = 'resolving';
    state.resolveT = GAME.RESOLVE_TIME;

    if (state.enemyHp <= 0) endAfterResolve = 'won';
    else if (state.playerHp <= 0) endAfterResolve = 'lost';
    else endAfterResolve = null;
  }

  function nextRound() {
    state.round += 1;
    state.roundAttribute = Math.floor(rng() * 3);
    state.playerPlayed = null;
    state.enemyPlayed = null;
    state.playerVal = 0;
    state.enemyVal = 0;
    state.buffActive = false;
    state.debuffActive = false;
    state.overdriveActive = false;
    state.cancelActive = false;
    state.lastDamage = { winner: null, dmg: 0, bonus: 0, total: 0, to: null };
    state.phase = 'reveal';
    state.revealT = GAME.REVEAL_TIME;
    emit('roundStart', { round: state.round });
    emit('attributeReveal', { attr: state.roundAttribute });
  }

  function finish(phase) {
    state.phase = phase;
    state.stars = phase === 'won'
      ? (state.playerHp >= GAME.STARS_3_AT ? 3 : state.playerHp >= GAME.STARS_2_AT ? 2 : 1)
      : 0;
    state.bestStars = Math.max(state.bestStars, state.stars);
    emit(phase === 'won' ? 'win' : 'lose', {
      stars: state.stars,
      rounds: state.round,
      hp: state.playerHp,
    });
  }

  function playCard(cardId) {
    if (state.phase !== 'playerTurn') return { ok: false, reason: 'not-your-turn' };
    if (state.hand.indexOf(cardId) === -1) return { ok: false, reason: 'not-in-hand' };

    state.hand.splice(state.hand.indexOf(cardId), 1);
    state.playerPlayed = cardId;

    state.enemyPlayed = enemyAI();
    enemyHand.splice(enemyHand.indexOf(state.enemyPlayed), 1);

    // 出的牌回池，再各抽一张补满手牌（共享卡池）
    pool.push(cardId);
    pool.push(state.enemyPlayed);
    shuffle(pool, rng);
    const drawn = drawCard();
    if (drawn != null) state.hand.push(drawn);
    const drawnE = drawCard();
    if (drawnE != null) enemyHand.push(drawnE);

    resolve();
    return { ok: true };
  }

  function useAbility(kind) {
    if (state.phase !== 'playerTurn') return { ok: false, reason: 'not-your-turn' };
    const cost = kind === 'buff' ? GAME.BUFF_COST
      : kind === 'debuff' ? GAME.DEBUFF_COST
      : kind === 'overdrive' ? GAME.OVERDRIVE_COST
      : GAME.CANCEL_COST;
    if (state.coins < cost) return { ok: false, reason: 'no-coins' };
    if (kind === 'buff') { if (state.buffActive) return { ok: false, reason: 'already' }; state.buffActive = true; }
    if (kind === 'debuff') { if (state.debuffActive) return { ok: false, reason: 'already' }; state.debuffActive = true; }
    if (kind === 'overdrive') { if (state.overdriveActive) return { ok: false, reason: 'already' }; state.overdriveActive = true; }
    if (kind === 'cancel') { if (state.cancelActive) return { ok: false, reason: 'already' }; state.cancelActive = true; }
    state.coins -= cost;
    emit(kind, { cost });
    return { ok: true };
  }

  function autoPlay() {
    if (state.phase !== 'playerTurn' || state.hand.length === 0) return { ok: false };
    const pick = state.hand[Math.floor(rng() * state.hand.length)];
    return playCard(pick);
  }

  function step(dt) {
    if (state.phase === 'reveal') {
      state.revealT -= dt;
      if (state.revealT <= 0) {
        state.phase = 'playerTurn';
        state.turnT = GAME.TURN_TIME;
        emit('yourTurn', { round: state.round });
      }
    } else if (state.phase === 'playerTurn') {
      state.turnT -= dt;
      if (state.turnT <= 0) autoPlay();
    } else if (state.phase === 'resolving') {
      state.resolveT -= dt;
      if (state.resolveT <= 0) {
        if (endAfterResolve) finish(endAfterResolve);
        else nextRound();
      }
    }

    if (state.phase !== 'won' && state.phase !== 'lost') {
      heartbeat -= dt;
      if (heartbeat <= 0) {
        heartbeat = GAME.HEARTBEAT_SEC;
        emit('heartbeat', { round: state.round });
      }
    }
  }

  function getHud() {
    return {
      phase: state.phase,
      round: state.round,
      roundAttribute: state.roundAttribute,
      playerHp: state.playerHp,
      enemyHp: state.enemyHp,
      coins: state.coins,
      combo: state.combo,
    };
  }

  emit('roundStart', { round: 1 });
  emit('attributeReveal', { attr: state.roundAttribute });

  return {
    state,
    step,
    playCard,
    useAbility,
    autoPlay,
    getHud,
    drainEvents() { return events.splice(0, events.length); },
  };
}
