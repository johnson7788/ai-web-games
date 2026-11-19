// 纯逻辑：宠物养成（无 DOM / 无渲染）。浏览器 60Hz 与 tools/selfplay.mjs 共用。
// 状态：4 项健康（hunger 越高越饿 / clean / energy / mood 越高越好）+ gold + level/xp。
// 核心循环：动作改状态 → 心愿（wish）驱动连击 → 升级 → 到 3 级结算。
import { GAME } from '../../config/game.config.js';

const clamp = (v) => Math.max(GAME.STAT_MIN, Math.min(GAME.STAT_MAX, v));

export function xpNeed(level) {
  return GAME.XP_NEED[level] ?? GAME.XP_NEED[GAME.XP_NEED.length - 1];
}

export function computeWish(s) {
  if (s.hunger > GAME.WISH.hunger) return 'feed';
  if (s.clean < GAME.WISH.clean) return 'wash';
  if (s.energy < GAME.WISH.energy) return 'rest';
  if (s.mood < GAME.WISH.mood) return 'play';
  return 'train';
}

export function computeStars(s) {
  let good = 0;
  if (s.hunger <= GAME.STAR_GOOD.hunger) good += 1;
  if (s.energy >= GAME.STAR_GOOD.energy) good += 1;
  if (s.mood >= GAME.STAR_GOOD.mood) good += 1;
  if (s.clean >= GAME.STAR_GOOD.clean) good += 1;
  if (good <= 1) return 1;
  if (good <= 3) return 2;
  return 3;
}

export function createRun(opts = {}) {
  const s = {
    phase: 'playing',          // 'playing' | 'won'
    level: 1,
    xp: 0,
    hunger: 30,
    energy: 80,
    mood: 70,
    clean: 70,
    gold: 15,
    combo: 0,
    bestCombo: 0,
    wish: 'train',
    time: 0,
    stars: 0,
    won: false,
    lastAmbient: 0,
  };
  const events = [];
  const push = (type, payload = {}) => events.push({ type, ...payload });

  function grantXp(n) {
    if (s.won) return;
    s.xp += n;
    let guard = 0;
    while (s.xp >= xpNeed(s.level) && guard < 8) {
      guard += 1;
      s.xp -= xpNeed(s.level);
      s.level += 1;
      push('levelup', { level: s.level });
      if (s.level >= GAME.GOAL_LEVEL) {
        s.won = true;
        s.phase = 'won';
        s.stars = computeStars(s);
        push('win', { level: s.level, stars: s.stars });
        return;
      }
    }
  }

  function recomputeWish() {
    const w = computeWish(s);
    if (w !== s.wish) {
      s.wish = w;
      push('need', { wish: w });
    }
  }

  function act(name) {
    if (s.won) return { ok: false, reason: 'ended' };
    const a = GAME.ACTIONS[name];
    if (!a) return { ok: false, reason: 'unknown' };

    s.hunger = clamp(s.hunger + (a.hunger || 0));
    s.clean = clamp(s.clean + (a.clean || 0));
    s.energy = clamp(s.energy + (a.energy || 0));
    s.mood = clamp(s.mood + (a.mood || 0));
    s.gold = Math.max(0, s.gold + (a.gold || 0));
    if (a.xp) grantXp(a.xp);

    let bonus = false;
    if (name === s.wish) {
      s.combo += 1;
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      grantXp(GAME.COMBO.bonusXp);
      s.gold += GAME.COMBO.bonusGold;
      bonus = true;
      push('combo', { combo: s.combo });
    } else {
      s.combo = 0;
    }
    push(name, { wish: s.wish, combo: s.combo, bonus });
    recomputeWish();
    return { ok: true, action: name, bonus };
  }

  function buy(item) {
    if (s.won) return { ok: false, reason: 'ended' };
    const g = GAME.SHOP[item];
    if (!g) return { ok: false, reason: 'unknown' };
    if (s.gold < g.gold) {
      push('denied', { reason: 'noGold', item });
      return { ok: false, reason: 'noGold' };
    }
    s.gold -= g.gold;
    if (g.hunger) s.hunger = clamp(s.hunger + g.hunger);
    if (g.mood) s.mood = clamp(s.mood + g.mood);
    if (g.xp) grantXp(g.xp);
    push('buy', { item, gold: s.gold });
    recomputeWish();
    return { ok: true, action: 'buy', item };
  }

  function step(dt) {
    if (s.won) return;
    s.time += dt;
    const D = GAME.DECAY;
    s.hunger = clamp(s.hunger + D.hunger * dt);
    s.clean = clamp(s.clean - D.clean * dt);
    s.energy = clamp(s.energy - D.energy * dt);   // D.energy 为负 → 回复
    let moodDown = D.mood * dt;
    if (s.hunger > GAME.WISH.hunger) moodDown += D.moodHunger * dt;
    if (s.clean < GAME.WISH.clean) moodDown += D.moodDirty * dt;
    s.mood = clamp(s.mood - moodDown);

    recomputeWish();

    if (s.time - s.lastAmbient >= GAME.AMBIENT_SEC) {
      s.lastAmbient = s.time;
      push('ambient', { time: s.time });
    }
  }

  function drainEvents() {
    if (!events.length) return [];
    return events.splice(0, events.length);
  }

  function getHud() {
    return {
      level: s.level,
      xp: s.xp,
      xpNeed: xpNeed(s.level),
      gold: s.gold,
      hunger: Math.round(s.hunger),
      energy: Math.round(s.energy),
      mood: Math.round(s.mood),
      clean: Math.round(s.clean),
      combo: s.combo,
      wish: s.wish,
      won: s.won,
      stars: s.stars,
      time: s.time,
    };
  }

  function setStat(key, value) {
    if (key === 'level') { s.level = Math.max(1, Math.floor(value)); return; }
    if (key === 'gold') { s.gold = Math.max(0, value); return; }
    if (key === 'xp') { s.xp = Math.max(0, value); return; }
    if (key in s) s[key] = clamp(value);
  }

  return {
    state: s,
    act,
    buy,
    step,
    drainEvents,
    getHud,
    grantXp,
    setStat,
    xpNeed,
    computeWish,
    computeStars,
  };
}
