// 纯逻辑核心：魔塔爬塔 sim。零 DOM，Node 可直接 import（node --test / selfplay 共用）。
// 状态机：playing → won（踩核心）/ lost（血尽无复活核）。
// 事件经 emit() 进队列，drainEvents() 取走（main 消费渲染/音频，selfplay 消费遥测）。

import { GAME } from '../../config/game.config.js';
import { ITEMS, levelReward, nextExpFor, mulberry32, enhancePrice } from './data.js';
import { generateFloor } from './floorgen.js';
import { findPath } from './astar.js';

const k = (r, c) => `${r},${c}`;

function freshPlayer() {
  const s = GAME.START;
  return {
    level: s.level, hp: s.hp, maxHp: s.maxHp, attack: s.attack, defence: s.defence,
    exp: s.exp, nextExp: s.nextExp,
    sword: { tier: 0, stones: 0, enhance: 0 },
    shield: { tier: 0, stones: 0, enhance: 0 },
  };
}

function freshBag() {
  return { coins: 0, items: { cross: 2 } };
}

export function effAttack(player) {
  return player.attack * (1 + Math.min(player.combo ?? 0, GAME.COMBO_MAX) * GAME.COMBO_ATK);
}

export function predictBattle(player, combo, monster) {
  const atk = (player.attack) * (1 + Math.min(combo, GAME.COMBO_MAX) * GAME.COMBO_ATK);
  const pDmg = Math.max(0, atk - monster.def);
  if (pDmg <= 0) return { safe: false, playerDmg: 0, monsterDmg: Math.max(0, monster.atk - player.defence), turns: Infinity, hpLoss: Infinity };
  const hits = Math.ceil(monster.hp / pDmg);
  const mDmg = Math.max(0, monster.atk - player.defence);
  const hpLoss = mDmg * (hits - 1);
  return { safe: hpLoss < player.hp, playerDmg: pDmg, monsterDmg: mDmg, turns: hits, hpLoss };
}

export function createRun(opts = {}) {
  const seed = (opts.seed >>> 0) || 1;
  const rng = mulberry32(seed);

  const state = {
    phase: 'playing',        // playing | won | lost
    seed,
    time: 0,
    floor: 0,
    maxFloorReached: 0,
    deaths: 0,
    kills: 0,
    player: freshPlayer(),
    bag: freshBag(),
    stars: {},
    combo: 0,
    comboBest: 0,
    pos: { r: 3, c: 3 },
    grid: [],
    entities: {},
    floors: {},
    mapState: {},
    path: [],
    floorStats: { total: 0, kills: 0, hpStart: 0 },
    tasks: { quest: 'new' },
    won: false,
  };

  const events = [];

  function emit(type, payload = {}) {
    events.push({ type, ...payload, t: state.time });
  }

  function getFloor(id) {
    if (!state.floors[id]) state.floors[id] = generateFloor(id, seed);
    return state.floors[id];
  }

  function loadFloor(id, pos, dir) {
    const f = getFloor(id);
    state.floor = id;
    state.grid = f.grid.map((row) => row.slice());
    state.entities = {};
    for (const [key, ent] of Object.entries(f.entities)) {
      const removed = state.mapState[`${id}|${key}`];
      if (removed === 'filled') { /* pit 已填平 */ }
      else if (removed) continue;
      else state.entities[key] = { ...ent };
    }
    // 填平的坑恢复成地板
    for (const [key, val] of Object.entries(state.mapState)) {
      if (val !== 'filled') continue;
      const [fid, rc] = key.split('|');
      if (Number(fid) !== id) continue;
      const [r, c] = rc.split(',').map(Number);
      if (state.grid[r] && state.grid[r][c] === 'pit') state.grid[r][c] = 'floor';
    }
    const target = pos || f.spawn;
    state.pos = { r: target.r, c: target.c };
    const monsters = Object.values(state.entities).filter((e) => e.kind === 'monster');
    state.floorStats = { total: monsters.length, kills: 0, hpStart: state.player.hp };
    state.path = [];
    if (id > state.maxFloorReached) state.maxFloorReached = id;
  }

  function newRun() {
    Object.assign(state, {
      phase: 'playing', time: 0, deaths: 0, kills: 0,
      player: freshPlayer(), bag: freshBag(), stars: {}, combo: 0, comboBest: 0,
      floors: {}, mapState: {}, path: [], tasks: { quest: 'new' }, won: false,
    });
    loadFloor(0, null);
  }

  function isBlocked(r, c) {
    if (!state.grid[r] || state.grid[r][c] === undefined) return true;
    const t = state.grid[r][c];
    if (t === 'wall' || t === 'pit') return true;
    const e = state.entities[k(r, c)];
    if (!e) return false;
    return e.kind === 'monster' || e.kind === 'door' || e.kind === 'rock';
  }

  function pathTo(r, c) {
    const goal = { r, c };
    state.path = findPath(state.grid.length, state.grid[0] ? state.grid[0].length : 0, state.pos, goal, isBlocked);
    return { ok: state.path.length > 0, len: state.path.length };
  }

  function stepPath() {
    if (!state.path.length) return { moved: false };
    const next = state.path.shift();
    state.pos = { r: next.r, c: next.c };
    emit('step', { r: next.r, c: next.c });
    const ent = state.entities[k(next.r, next.c)];
    if (ent) {
      if (ent.kind === 'item') collect(next.r, next.c, ent);
      else if (ent.kind === 'stairs') enterStairs(ent.dir);
      else if (ent.kind === 'core') winGame();
    }
    return { moved: true, cell: next, entity: ent };
  }

  function collect(r, c, ent) {
    const id = ent.id;
    state.mapState[`${state.floor}|${k(r, c)}`] = true;
    delete state.entities[k(r, c)];
    const item = ITEMS[id];
    if (!item) return;
    if (item.kind === 'gem') {
      if (item.atk) state.player.attack += item.atk;
      if (item.def) state.player.defence += item.def;
      emit('gem', { id, atk: item.atk || 0, def: item.def || 0 });
    } else if (item.kind === 'potion' || item.kind === 'key' || item.kind === 'scroll' || item.kind === 'cross') {
      state.bag.items[id] = (state.bag.items[id] || 0) + 1;
      emit(item.kind === 'key' ? 'key' : item.kind === 'potion' ? 'potion' : item.kind === 'scroll' ? 'scroll' : 'pickup', { id });
    } else if (item.kind === 'sword' || item.kind === 'shield') {
      equip(item.kind, item.tier, item.base);
    } else if (item.kind === 'stone') {
      addStone(item.slot);
    }
  }

  function equip(kind, tier, base) {
    const slot = state.player[kind];
    if (slot.tier >= tier) { emit('pickup', { id: `${kind}_${tier}` }); return; }
    const bases = kind === 'sword' ? GAME.SWORD_BASE : GAME.SHIELD_BASE;
    const old = slot.tier > 0 ? bases[slot.tier - 1] : 0;
    const delta = base - old;
    if (kind === 'sword') state.player.attack += delta;
    else state.player.defence += delta;
    slot.tier = tier;
    emit('gear', { kind, tier });
  }

  function addStone(slot) {
    const s = state.player[slot];
    s.stones += 1;
    if (s.stones >= GAME.STONES_NEEDED && s.tier < 6) {
      s.stones -= GAME.STONES_NEEDED;
      const bases = slot === 'sword' ? GAME.SWORD_BASE : GAME.SHIELD_BASE;
      const old = s.tier > 0 ? bases[s.tier - 1] : 0;
      s.tier += 1;
      const delta = bases[s.tier - 1] - old;
      if (slot === 'sword') state.player.attack += delta;
      else state.player.defence += delta;
      emit('gear', { kind: slot, tier: s.tier });
    } else {
      emit('stone', { slot });
    }
  }

  function fightMonster(r, c) {
    const ent = state.entities[k(r, c)];
    if (!ent || ent.kind !== 'monster') return { ok: false };
    emit('battleStart', { name: ent.name });
    const p = state.player;
    const critChance = Math.min(0.5, GAME.BASE_CRIT + Math.min(state.combo, GAME.COMBO_MAX) * GAME.COMBO_CRIT);
    const atk = effAttack(p);
    const m = { hp: ent.hp, maxHp: ent.maxHp, atk: ent.atk, def: ent.def };
    const pDmg = Math.max(0, atk - m.def);
    if (pDmg <= 0) {
      // 打不动 → 不进入死循环，安全返回（主 UI 会提示放弃）
      emit('miss', { who: 'p' });
      return { ok: true, won: false, fled: true, tookDamage: 0 };
    }
    const log = [];
    let turn = 0;
    let tookDamage = 0;
    while (p.hp > 0 && m.hp > 0) {
      if (turn % 2 === 0) {
        let dmg = Math.max(0, atk - m.def);
        let crit = false;
        if (dmg > 0 && rng() < critChance) { dmg = Math.floor(dmg * 1.5); crit = true; }
        m.hp = Math.max(0, m.hp - dmg);
        log.push({ who: 'p', dmg, crit });
        if (crit) emit('crit', { dmg });
        else if (dmg > 0) emit('hit', { dmg });
        else emit('miss', { who: 'p' });
      } else {
        let dmg = Math.max(0, m.atk - p.def);
        let dodge = false;
        if (rng() < GAME.DODGE) { dmg = 0; dodge = true; }
        p.hp = Math.max(0, p.hp - dmg);
        tookDamage += dmg;
        log.push({ who: 'm', dmg, dodge });
        if (dodge) emit('miss', { who: 'm' });
        else if (dmg > 0) emit('monsterHit', { dmg });
      }
      turn += 1;
    }
    const won = m.hp <= 0;
    if (won) {
      onMonsterKilled(r, c, ent);
    } else {
      onPlayerDefeated();
    }
    // 连击结算
    if (won) {
      if (tookDamage === 0) {
        state.combo = Math.min(GAME.COMBO_MAX, state.combo + 1);
        state.comboBest = Math.max(state.comboBest, state.combo);
        emit('comboUp', { combo: state.combo });
      } else {
        if (state.combo > 0) emit('comboLost', { combo: state.combo });
        state.combo = 0;
      }
    }
    return { ok: true, won, log, tookDamage };
  }

  function onMonsterKilled(r, c, ent) {
    state.mapState[`${state.floor}|${k(r, c)}`] = true;
    delete state.entities[k(r, c)];
    state.kills += 1;
    state.floorStats.kills += 1;
    const exp = ent.exp;
    const gold = ent.gold;
    state.bag.coins += gold;
    emit('kill', { exp, gold, name: ent.name });
    grantExp(exp);
    if (ent.tier === 'boss') {
      // boss 死亡不掉核心位置（核心独立），但播放大奖励
      emit('gear', { kind: 'boss', tier: 0 });
    }
  }

  function grantExp(exp) {
    const p = state.player;
    p.exp += exp;
    let guard = 0;
    while (p.level < GAME.MAX_LEVEL && p.exp >= p.nextExp && guard++ < 60) {
      p.exp -= p.nextExp;
      const r = levelReward(p.level + 1);
      p.maxHp += r.hp;
      p.hp = p.maxHp;            // 升级回满
      p.attack += r.atk;
      p.defence += r.def;
      p.level += 1;
      p.nextExp = r.nextExp;
      emit('levelup', { level: p.level });
    }
  }

  function onPlayerDefeated() {
    state.deaths += 1;
    emit('death', { hp: 0 });
    const p = state.player;
    if ((state.bag.items.cross || 0) > 0) {
      state.bag.items.cross -= 1;
      p.hp = p.maxHp;
      emit('revive', {});
    } else {
      state.phase = 'lost';
      emit('lose', { floor: state.floor });
    }
  }

  function usePotion(id) {
    const p = state.player;
    const item = ITEMS[id];
    if (!item || item.kind !== 'potion') return { ok: false };
    if ((state.bag.items[id] || 0) <= 0) return { ok: false };
    state.bag.items[id] -= 1;
    const heal = Math.round(p.maxHp * item.ratio);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    emit('potion', { id, heal });
    return { ok: true, heal };
  }

  function useScroll() {
    if ((state.bag.items.scroll_teleport || 0) <= 0) return { ok: false };
    state.bag.items.scroll_teleport -= 1;
    const up = getFloor(state.floor).stairsUp;
    if (up) {
      state.mapState[`${state.floor}|${k(up.r, up.c)}`] = true;
      state.path = [];
      loadFloor(state.floor + 1, null);
      emit('teleport', {});
      emit('floorUp', { floor: state.floor });
    } else {
      state.bag.items.scroll_teleport += 1; // 顶层不退
      return { ok: false };
    }
    return { ok: true };
  }

  function enterStairs(dir) {
    if (dir === 'up') {
      const cur = state.floor;
      awardStars(cur);
      if (cur >= GAME.FLOORS) { winGame(); return; }
      loadFloor(cur + 1, null);
      emit('floorUp', { floor: state.floor });
    } else {
      if (state.floor <= 0) return;
      loadFloor(state.floor - 1, null);
      emit('floorDown', { floor: state.floor });
    }
  }

  function awardStars(floor) {
    if (floor <= 0) return;
    let stars = 1;
    if (state.floorStats.total === 0 || state.floorStats.kills >= Math.ceil(state.floorStats.total * GAME.STAR_KILL_RATIO)) stars += 1;
    if (state.player.hp / state.player.maxHp >= GAME.STAR_HP_RATIO) stars += 1;
    state.stars[floor] = Math.max(state.stars[floor] || 0, stars);
    emit('rating', { floor, stars });
  }

  function winGame() {
    state.won = true;
    state.phase = 'won';
    emit('win', { floor: state.floor });
  }

  function openDoor(r, c) {
    const ent = state.entities[k(r, c)];
    if (!ent || ent.kind !== 'door') return { ok: false };
    const keyId = `key_${ent.color}`;
    if ((state.bag.items[keyId] || 0) > 0) {
      state.bag.items[keyId] -= 1;
      state.mapState[`${state.floor}|${k(r, c)}`] = true;
      delete state.entities[k(r, c)];
      emit('doorOpen', { color: ent.color });
      return { ok: true };
    }
    emit('doorLocked', { color: ent.color });
    return { ok: false, locked: true };
  }

  function pushRock(r, c) {
    const ent = state.entities[k(r, c)];
    if (!ent || ent.kind !== 'rock') return { ok: false };
    // 推动方向 = 玩家所在 → 石头（玩家须相邻）
    const dr = r - state.pos.r;
    const dc = c - state.pos.c;
    if (Math.abs(dr) + Math.abs(dc) !== 1) return { ok: false };
    const nr = r + dr;
    const nc = c + dc;
    if (!state.grid[nr] || state.grid[nr][nc] === undefined) return { ok: false };
    const beyond = state.grid[nr][nc];
    if (beyond === 'wall' || state.entities[k(nr, nc)]) return { ok: false };
    if (beyond === 'pit') {
      state.mapState[`${state.floor}|${k(nr, nc)}`] = 'filled';
      state.grid[nr][nc] = 'floor';
      state.mapState[`${state.floor}|${k(r, c)}`] = true;
      delete state.entities[k(r, c)];
      emit('rock', { into: 'pit' });
      return { ok: true };
    }
    if (beyond === 'floor') {
      delete state.entities[k(r, c)];
      state.entities[k(nr, nc)] = { kind: 'rock' };
      emit('rock', { into: 'floor' });
      return { ok: true };
    }
    return { ok: false };
  }

  function buy(slotIndex) {
    const defs = [
      { id: 'potion_small', price: 50 },
      { id: 'potion_large', price: 200 },
      { id: 'gem_atk', price: 100 },
      { id: 'gem_def', price: 100 },
      { id: 'key_yellow', price: 40 },
      { id: 'key_blue', price: 60 },
      { id: 'key_red', price: 90 },
    ];
    const d = defs[slotIndex];
    if (!d) return { ok: false };
    if (state.bag.coins < d.price) { emit('shop', { fail: true }); return { ok: false }; }
    state.bag.coins -= d.price;
    collect(0, 0, { id: d.id }); // 复用 collect 逻辑（物品直接进袋/即时生效）
    emit('shop', { id: d.id });
    return { ok: true };
  }

  function enhance(kind) {
    const slot = state.player[kind];
    if (!slot || slot.enhance >= GAME.ENHANCE_MAX) return { ok: false };
    const price = enhancePrice(slot.enhance);
    if (state.bag.coins < price) { emit('shop', { fail: true }); return { ok: false }; }
    state.bag.coins -= price;
    slot.enhance += 1;
    if (kind === 'sword') state.player.attack += GAME.ENHANCE_ATT;
    else state.player.defence += GAME.ENHANCE_DEF;
    emit('gear', { kind, enhance: slot.enhance });
    return { ok: true };
  }

  function tapCell(r, c) {
    if (!state.grid[r] || state.grid[r][c] === undefined) return { ok: false };
    const t = state.grid[r][c];
    if (t === 'wall' || t === 'pit') return { ok: false, reason: 'blocked' };
    const ent = state.entities[k(r, c)];
    if (ent && ent.kind === 'monster') return { ok: true, action: 'fight', r, c, ent };
    if (ent && ent.kind === 'door') return { ok: true, action: 'door', r, c, ent };
    if (ent && ent.kind === 'rock') return { ok: true, action: 'rock', r, c, ent };
    if (ent && ent.kind === 'npc') return { ok: true, action: 'npc', r, c, ent };
    const res = pathTo(r, c);
    return { ok: res.ok, action: 'move', len: res.len };
  }

  function interactNpc(role) {
    if (role === 'shop') return { action: 'shop' };
    if (role === 'quest') {
      if (state.tasks.quest === 'new') {
        state.tasks.quest = 'accepted';
        emit('quest', { state: 'accepted' });
        return { action: 'talk', text: 'questGive' };
      }
      if (state.tasks.quest === 'accepted') {
        if (state.kills >= 5) {
          state.tasks.quest = 'done';
          state.bag.items.cross = (state.bag.items.cross || 0) + 1;
          state.bag.coins += 100;
          emit('quest', { state: 'done' });
          return { action: 'talk', text: 'questDone' };
        }
        return { action: 'talk', text: 'questGive' };
      }
      return { action: 'talk', text: 'questDone' };
    }
    return { action: 'talk', text: 'questTitle' };
  }

  function getHud() {
    const b = state.bag.items;
    return {
      floor: state.floor,
      level: state.player.level,
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      attack: state.player.attack,
      defence: state.player.defence,
      exp: state.player.exp,
      nextExp: state.player.nextExp,
      coins: state.bag.coins,
      keys: {
        yellow: b.key_yellow || 0,
        blue: b.key_blue || 0,
        red: b.key_red || 0,
      },
      combo: state.combo,
      starsTotal: Object.values(state.stars).reduce((a, x) => a + x, 0),
      swordTier: state.player.sword.tier,
      shieldTier: state.player.shield.tier,
      cross: b.cross || 0,
      potionSmall: b.potion_small || 0,
      potionLarge: b.potion_large || 0,
      scroll: b.scroll_teleport || 0,
    };
  }

  function dump() {
    return {
      seed, floor: state.floor, maxFloorReached: state.maxFloorReached,
      phase: state.phase, deaths: state.deaths, kills: state.kills,
      player: state.player, bag: state.bag, stars: state.stars, combo: state.combo,
      comboBest: state.comboBest, mapState: state.mapState, tasks: state.tasks, won: state.won,
    };
  }

  function restore(save) {
    if (!save || !save.player) return;
    state.seed = save.seed || seed;
    state.player = save.player;
    state.bag = save.bag;
    state.stars = save.stars || {};
    state.combo = save.combo || 0;
    state.comboBest = save.comboBest || 0;
    state.mapState = save.mapState || {};
    state.tasks = save.tasks || { quest: 'new' };
    state.maxFloorReached = save.maxFloorReached || 0;
    state.deaths = save.deaths || 0;
    state.kills = save.kills || 0;
    state.won = !!save.won;
    state.phase = 'playing';
    loadFloor(save.floor || 0, null);
  }

  newRun();

  return {
    state,
    step(dt) { state.time += dt; },
    drainEvents() { return events.splice(0, events.length); },
    emit,
    getHud,
    dump,
    restore,
    newRun,
    loadFloor,
    pathTo,
    stepPath,
    tapCell,
    fightMonster,
    openDoor,
    pushRock,
    usePotion,
    useScroll,
    buy,
    enhance,
    isBlocked,
    getFloor,
    predictBattle,
    interactNpc,
  };
}

export { predictBattle as predict, nextExpFor };
