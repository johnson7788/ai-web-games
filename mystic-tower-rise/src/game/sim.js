// 纯逻辑（无 DOM）：魔塔爬塔骨架 1:1 保留战斗公式/钥匙门/宝石药水/商店/楼梯，
// 主题换皮为霓虹街机塔。60Hz 由 main 装配；这里提供同步 moveTo 供 bot 与 UI 共用。
import { MAPS, MONSTERS, PROPS, DOORS, START, GAME, HINTS } from '../../config/maps.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pairTeles(rows) {
  const pads = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const t = rows[y][x];
      if (t && t.kind === 'tele') pads.push({ x, y });
    }
  }
  for (let i = 0; i + 1 < pads.length; i += 2) {
    const a = pads[i], b = pads[i + 1];
    rows[a.y][a.x].pair = { x: b.x, y: b.y };
    rows[b.y][b.x].pair = { x: a.x, y: a.y };
  }
}

export function parseFloor(strings) {
  const rows = strings.map((line, y) => {
    return line.split('').map((ch, x) => {
      if (ch === '#') return { kind: 'wall' };
      if (ch === '.') return { kind: 'floor' };
      if (ch === 'P') return { kind: 'floor', start: true };
      if (ch === '^') return { kind: 'stair', dir: 'up' };
      if (ch === 'v') return { kind: 'stair', dir: 'down' };
      if (ch === '!') return { kind: 'tele' };
      if (ch === '$') return { kind: 'shop' };
      if (ch === 'N') return { kind: 'npc' };
      if (ch === 'C') return { kind: 'crystal' };
      if (ch === 'x') return { kind: 'spike', used: false };
      if (DOORS[ch]) return { kind: 'door', id: DOORS[ch].id, key: DOORS[ch].key };
      if (PROPS[ch]) return { kind: 'prop', id: PROPS[ch].id, char: ch };
      if (MONSTERS[ch]) return { kind: 'monster', id: MONSTERS[ch].id, char: ch };
      return { kind: 'floor' };
    });
  });
  pairTeles(rows);
  return { cols: rows[0].length, rows: rows.length, grid: rows };
}

function cloneFloor(floor) {
  return {
    cols: floor.cols,
    rows: floor.rows,
    grid: floor.grid.map((r) => r.map((t) => ({ ...t, pair: t.pair ? { ...t.pair } : null }))),
  };
}

export function buildFloors() {
  return MAPS.map((strings, i) => ({ ...parseFloor(strings), level: i + 1, hint: HINTS[i] }));
}

// 确定性战斗结算：不改变 hero/monster 对象，返回预测结果
export function simulateFight(hero, monster) {
  const heroDmg = Math.max(0, hero.atk - monster.def);
  const monDmg = Math.max(0, monster.atk - hero.def);
  if (heroDmg <= 0) return { win: false, cannot: true, hpAfter: hero.hp, dmg: 0, perfect: false, heroHits: 0 };
  let mhp = monster.hp;
  let hhp = hero.hp;
  let heroTurn = !monster.firstAttack;
  let guard = 100000;
  while (mhp > 0 && hhp > 0 && guard-- > 0) {
    if (heroTurn) {
      mhp -= heroDmg;
      if (mhp <= 0) break;
    } else {
      hhp -= monDmg;
      if (hhp <= 0) break;
    }
    heroTurn = !heroTurn;
  }
  const win = mhp <= 0 && hhp > 0;
  return { win, cannot: false, hpAfter: hhp, dmg: hero.hp - hhp, perfect: win && hhp === hero.hp, heroHits: Math.ceil(monster.hp / heroDmg) };
}

export function createRun(opts = {}) {
  const seed = (opts.seed | 0) || 1;
  const state = {
    phase: 'playing',           // playing | won | dead
    floor: 1,
    hero: { hp: START.hp, maxHp: START.hp, atk: START.atk, def: START.def, gold: START.gold },
    keys: { yellow: START.yellow, blue: START.blue, red: START.red },
    pick: START.pick,
    pos: { x: START.x, y: START.y },
    prevPos: { x: START.x, y: START.y },
    floors: buildFloors(),
    shopCount: 0,
    combo: 0,
    bestCombo: 0,
    kills: 0,
    time: 0,
    moveSeq: 0,
    events: [],
    log: [],
  };

  const floor = () => state.floors[state.floor - 1];
  const tile = (x, y) => floor().grid[y][x];
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < floor().cols && y < floor().rows;

  function emit(type, payload = {}) {
    const ev = { type, ...payload };
    state.events.push(ev);
    state.log.push(ev);
    return ev;
  }

  // 可穿越的地块（走路径中间）：地板 / 道具 / 尖刺 / 商店
  function passThrough(t) {
    return t.kind === 'floor' || t.kind === 'prop' || t.kind === 'spike' || t.kind === 'shop';
  }

  // A*（4 方向，代价 1）
  function findPath(toX, toY, walkFn) {
    const f = floor();
    const key = (x, y) => y * f.cols + x;
    const start = key(state.pos.x, state.pos.y);
    const goal = key(toX, toY);
    const open = new Map();
    const gScore = new Map([[start, 0]]);
    const came = new Map();
    open.set(start, 0);
    const h = (x, y) => Math.abs(x - toX) + Math.abs(y - toY);
    while (open.size) {
      let cur = null, curF = Infinity;
      for (const [k, fv] of open) { if (fv < curF) { curF = fv; cur = k; } }
      if (cur === goal) break;
      open.delete(cur);
      const cx = cur % f.cols, cy = Math.floor(cur / f.cols);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (!inBounds(nx, ny)) continue;
        const isGoal = nx === toX && ny === toY;
        if (!walkFn(tile(nx, ny), isGoal)) continue;
        const nk = key(nx, ny);
        const tentative = gScore.get(cur) + 1;
        if (tentative < (gScore.get(nk) ?? Infinity)) {
          came.set(nk, cur);
          gScore.set(nk, tentative);
          open.set(nk, tentative + h(nx, ny));
        }
      }
    }
    if (!came.has(goal) && start !== goal) return null;
    const path = [];
    let c = goal;
    while (c !== start) { path.push([c % f.cols, Math.floor(c / f.cols)]); c = came.get(c); }
    path.reverse();
    return path; // 不含起点，含终点
  }

  function applyProp(t) {
    const p = PROPS[t.char] || {};
    switch (p.kind) {
      case 'gem':
        if (p.id === 'gemAtk') state.hero.atk += p.value;
        else state.hero.def += p.value;
        break;
      case 'potion':
        state.hero.hp += p.value;
        state.hero.maxHp = Math.max(state.hero.maxHp, state.hero.hp);
        break;
      case 'sword': state.hero.atk += p.value; break;
      case 'shield': state.hero.def += p.value; break;
      case 'key': state.keys[p.key] += p.value; break;
      case 'pick': state.pick += p.value; break;
      default: break;
    }
  }

  function stepOnto(x, y, isLast) {
    const t = tile(x, y);
    const res = { arrived: true, stop: false, teleported: false, reason: null };
    switch (t.kind) {
      case 'prop': {
        applyProp(t);
        emit('pickup', { prop: t.id, atk: state.hero.atk, def: state.hero.def, hp: state.hero.hp });
        tile(x, y).kind = 'floor'; delete tile(x, y).id; delete tile(x, y).char;
        break;
      }
      case 'spike': {
        state.hero.hp -= GAME.SPIKE_DAMAGE;
        emit('spike', { dmg: GAME.SPIKE_DAMAGE, hp: state.hero.hp });
        if (state.hero.hp <= 0) { state.hero.hp = 0; state.phase = 'dead'; emit('lose', { reason: 'spike' }); res.stop = true; res.arrived = false; }
        break;
      }
      case 'monster': {
        const m = MONSTERS[t.char] || MONSTERS[t.id] || MONSTERS['1'];
        const fight = simulateFight(state.hero, m);
        if (!fight.win) {
          res.stop = true; res.arrived = false; res.reason = 'cannot-beat';
          emit('blocked', { monster: m.id });
        } else {
          state.hero.hp = fight.hpAfter;
          const perfect = fight.perfect;
          let gold = m.gold;
          if (perfect) {
            state.combo += 1;
            state.bestCombo = Math.max(state.bestCombo, state.combo);
            gold *= GAME.COMBO_GOLD_MULT;
            emit('combo', { combo: state.combo, gold });
          } else {
            state.combo = 0;
          }
          state.hero.gold += gold;
          state.kills += 1;
          emit('fight', { monster: m.id, perfect, dmg: fight.dmg, gold });
          emit('kill', { monster: m.id, gold, perfect });
          tile(x, y).kind = 'floor'; delete tile(x, y).id; delete tile(x, y).char;
          if (m.boss) {
            state.phase = 'won';
            emit('win', { gold: state.hero.gold, combo: state.bestCombo, kills: state.kills });
            res.stop = true;
          }
        }
        break;
      }
      case 'door': {
        if (state.keys[t.key] > 0) {
          state.keys[t.key] -= 1;
          emit('door', { door: t.id, key: t.key });
          tile(x, y).kind = 'floor'; delete tile(x, y).id; delete tile(x, y).key;
        } else {
          res.stop = true; res.arrived = false; res.reason = 'no-key';
          emit('blocked', { door: t.id });
        }
        break;
      }
      case 'crystal': {
        if (state.pick > 0) {
          state.pick -= 1;
          state.hero.atk += GAME.CRYSTAL_BONUS_ATK;
          state.hero.def += GAME.CRYSTAL_BONUS_DEF;
          emit('crystal', { atk: state.hero.atk, def: state.hero.def });
          tile(x, y).kind = 'floor';
        } else {
          res.stop = true; res.arrived = false; res.reason = 'no-pick';
          emit('blocked', { crystal: true });
        }
        break;
      }
      case 'shop': {
        emit('shop', { cost: GAME.SHOP.beginGold + GAME.SHOP.ratio * state.shopCount });
        res.stop = true;
        break;
      }
      case 'npc': {
        emit('talk', { hint: state.floor - 1 });
        res.stop = true;
        break;
      }
      case 'tele': {
        if (t.pair) {
          state.pos = { x: t.pair.x, y: t.pair.y };
          res.teleported = true;
          emit('tele', { x: t.pair.x, y: t.pair.y });
          res.stop = true;
        }
        break;
      }
      case 'stair': {
        climbStair(t.dir);
        res.stop = true;
        break;
      }
      default:
        break;
    }
    return res;
  }

  function climbStair(dir) {
    const targetLevel = dir === 'up' ? state.floor + 1 : state.floor - 1;
    if (targetLevel < 1 || targetLevel > state.floors.length) return;
    state.floor = targetLevel;
    const target = state.floors[targetLevel - 1];
    const counterpart = dir === 'up' ? 'down' : 'up';
    for (let y = 0; y < target.grid.length; y++) {
      for (let x = 0; x < target.grid[y].length; x++) {
        const t = target.grid[y][x];
        if (t && t.kind === 'stair' && t.dir === counterpart) {
          state.pos = { x, y };
          state.prevPos = { x, y };
        }
      }
    }
    emit('stair', { floor: state.floor, dir });
  }

  function moveTo(tx, ty) {
    if (state.phase !== 'playing') return { ok: false, arrived: false, events: [] };
    tx = Math.max(0, Math.min(floor().cols - 1, tx | 0));
    ty = Math.max(0, Math.min(floor().rows - 1, ty | 0));
    if (tx === state.pos.x && ty === state.pos.y) return { ok: false, arrived: true, events: [] };
    const path = findPath(tx, ty, (t, isGoal) => (isGoal ? true : passThrough(t)));
    if (!path || path.length === 0) return { ok: false, arrived: false, events: [] };
    state.prevPos = { ...state.pos };
    const before = state.events.length;
    for (let i = 0; i < path.length; i++) {
      const [nx, ny] = path[i];
      state.pos = { x: nx, y: ny };
      state.moveSeq += 1;
      emit('step', { x: nx, y: ny });
      const r = stepOnto(nx, ny, i === path.length - 1);
      if (state.phase === 'dead' || state.phase === 'won') {
        state.prevPos = { ...state.pos };
        break;
      }
      if (r.teleported) break;
      if (r.stop) break;
    }
    state.prevPos = { ...state.pos };
    const events = state.events.slice(before);
    return { ok: true, arrived: state.phase === 'playing' || state.phase === 'won', events, path };
  }

  // 商店购买：返回 { ok, attr, price }
  function buy(attr) {
    const price = GAME.SHOP.beginGold + GAME.SHOP.ratio * state.shopCount;
    if (state.hero.gold < price) return { ok: false, price };
    state.hero.gold -= price;
    state.shopCount += 1;
    const region = Math.floor((state.floor - 1) / 10) + 1;
    if (attr === 'hp') state.hero.hp += GAME.SHOP.hp;
    else if (attr === 'atk') state.hero.atk += GAME.SHOP.atk * region;
    else if (attr === 'def') state.hero.def += GAME.SHOP.def * region;
    state.hero.maxHp = Math.max(state.hero.maxHp, state.hero.hp);
    emit('buy', { attr, price });
    return { ok: true, attr, price };
  }

  function step(dt) {
    state.time += dt;
  }

  function drainEvents() {
    const out = state.events;
    state.events = [];
    return out;
  }

  function canBeatMonster(t) {
    if (t.kind !== 'monster') return false;
    const m = MONSTERS[t.char] || MONSTERS[t.id];
    return m ? simulateFight(state.hero, m).win : false;
  }

  return {
    state,
    moveTo,
    buy,
    step,
    drainEvents,
    tile,
    inBounds,
    canBeatMonster,
    simulateFight: (t) => {
      const m = MONSTERS[t.char] || MONSTERS[t.id];
      return m ? simulateFight(state.hero, m) : null;
    },
  };
}
