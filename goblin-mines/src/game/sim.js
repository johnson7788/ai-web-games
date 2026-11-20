// src/game/sim.js — GOBLIN MINES · 纯逻辑模拟（无 DOM / 无 Date.now / 无 Math.random）。
//
// 核心循环（忠实还原「地精旷工」三消挖矿 + 原创矿灯/矿难改造）：
//   1. 交换相邻矿脉（swap）凑 3+ 连消 → 采资源、炸裂相邻岩壁；
//   2. 清空当前矿层的岩壁后可「向下挖」（dig）→ 深度 +6m、步数 +3、换一层新矿；
//   3. 头目矿兽每 12m（偶数矿道末层）出现，需贴着它连消击杀；
//   4. 矿难（塌方）周期性预警：加固（花金币）或赌一把（扣安全度 + 落岩）；
//   5. 提灯地精照亮列：该列连消产出加成，且每 2s 自动产出（挂机收益）；
//   6. 失败 = 步数耗尽 或 安全度归零；胜利 = 挖穿 12 条矿道。
//
// 契约：createRun({seed, shaft, coins, bestShaft}) → run
//   run.step(input) 每 1/60s 推进一步；input 为单个动作（swap/skill/dig/reinforce/hire/upgrade/move）
//   run.drainEvents() / run.getHud() / run.snapshot()
// 事件表（谁发谁消费见 docs/analysis.md）：swap match matchBig rockBreak frozenBreak
//   oreGain coinGain produce dig collapse reinforce bossHit bossBreak bossAction skill
//   shaftClear depthMilestone goblinHire goblinUpgrade death newRecord

import { TILE, ORE_IDS, ORE_KEYS, CAPS, MOVES, STABILITY, DIG, BOSS, GOBLIN, SKILLS } from '../../config/gameplay.js';
import { LEVELS, levelOf, rockHpFor, collapseIntervalFor } from '../../config/levels.js';
import { mulberry32 } from './rng.js';

const COLS = 9;
const ROWS = 9;
const EMPTY = TILE.EMPTY;
const ROCK = TILE.ROCK;
const BOSS_T = TILE.BOSS;

function cell(type, c, r, extra = {}) {
  return { t: type, hp: extra.hp ?? 0, frozen: !!extra.frozen, c, r };
}
function emptyCell(c, r) { return cell(EMPTY, c, r); }
function key(c, r) { return c + ',' + r; }

function isOre(t) { return t >= 0 && t <= 5; }

export function createRun(opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const shaft0 = Math.max(1, Math.min(LEVELS.length, Math.floor(opts.shaft ?? 1)));
  const bestShaft = Math.max(1, Math.floor(opts.bestShaft ?? 1));

  const run = {
    phase: 'playing',          // playing | dead | won
    shaft: shaft0,
    depth: (shaft0 - 1) * 12,
    digCount: 0,
    moves: MOVES.start,
    stability: STABILITY.max,
    reinforced: false,
    coins: Math.max(0, Math.floor(opts.coins ?? 0)),
    resources: { ruby: 0, sapphire: 0, amethyst: 0, emerald: 0, fuel: 8 },
    goblins: [],
    board: [],
    richColumn: -1,
    hotspringCell: null,
    boss: null,
    time: 0,
    events: [],
    stats: { matches: 0, maxCombo: 0, totalOres: 0, coins: 0, bossKills: 0, digs: 0, collapses: 0, shaftReached: shaft0 },
    nextCollapseAt: STABILITY.firstSec,
    nextBossActionAt: 0,
    nextProduceAt: new Map(),
    rng,
    goblinSeq: 1,
  };

  const level = () => levelOf(run.shaft);

  const NAME_TO_ID = { ruby: TILE.RUBY, sapphire: TILE.SAPPHIRE, amethyst: TILE.AMETHYST, emerald: TILE.EMERALD, fuel: TILE.FUEL, gold: TILE.GOLD };

  function levelOres() {
    return (level().ores || ['ruby', 'sapphire', 'gold']).map((n) => NAME_TO_ID[n] ?? TILE.RUBY);
  }

  function randOre() {
    const ores = levelOres();
    return ores[Math.floor(rng() * ores.length)];
  }

  // ---------- 资源 ----------
  function capOf(type) {
    return { 0: CAPS.ruby, 1: CAPS.sapphire, 2: CAPS.amethyst, 3: CAPS.emerald, 4: CAPS.fuel, 5: Infinity }[type] ?? Infinity;
  }
  function addResource(type, amount) {
    if (!isOre(type)) return;
    amount = Math.max(1, Math.floor(amount));
    if (type === TILE.GOLD) { run.coins += amount; run.stats.coins += amount; return; }
    const k = ORE_KEYS[type];
    run.resources[k] = Math.min(capOf(type), run.resources[k] + amount);
    run.stats.totalOres += amount;
  }
  function costOf(cost) {
    const c = { ...cost };
    for (const k of ['ruby', 'sapphire', 'amethyst', 'emerald', 'fuel']) {
      if (c[k] != null) c[k] = run.resources[k] - c[k] >= 0 ? c[k] : Infinity;
    }
    return c;
  }
  function pay(cost) {
    for (const k of ['ruby', 'sapphire', 'amethyst', 'emerald', 'fuel']) {
      if (cost[k] != null) run.resources[k] -= cost[k];
    }
  }
  function canPay(cost) {
    return costOf(cost).ruby !== Infinity && costOf(cost).sapphire !== Infinity
      && costOf(cost).amethyst !== Infinity && costOf(cost).emerald !== Infinity
      && costOf(cost).fuel !== Infinity;
  }

  // ---------- 事件 ----------
  function emit(type, payload = {}) {
    run.events.push({ type, time: run.time, ...payload });
  }

  // ---------- 棋盘 ----------
  function initBoard() {
    run.board = [];
    for (let c = 0; c < COLS; c += 1) {
      run.board[c] = [];
      for (let r = 0; r < ROWS; r += 1) run.board[c][r] = emptyCell(c, r);
    }
  }

  function inBoard(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }

  function spawnLayer() {
    // 清空旧盘面
    for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1) run.board[c][r] = emptyCell(c, r);

    const lv = level();
    const hp = rockHpFor(lv);

    // 头目矿兽：偶数矿道末层出现（3×3 岩块）
    const bossLayer = run.shaft >= 2 && run.shaft % 2 === 0 && run.digCount === lv.digs - 1;
    if (bossLayer) {
      run.boss = { hp: BOSS.hpBase + run.shaft * BOSS.hpPerShaft, max: BOSS.hpBase + run.shaft * BOSS.hpPerShaft };
      for (let c = 3; c <= 5; c += 1) for (let r = 0; r < BOSS.size; r += 1) run.board[c][r] = cell(BOSS_T, c, r, { hp: 1 });
      run.nextBossActionAt = run.time + BOSS.actionIntervalSec;
      emit('bossAction', { kind: 'spawn', hp: run.boss.hp });
    } else {
      run.boss = null;
    }

    // 岩壁（frozen 特性额外加冻结岩）
    let rocks = lv.rocks || 0;
    let placed = 0;
    let guard = 0;
    while (placed < rocks && guard < 300) {
      guard += 1;
      const c = Math.floor(rng() * COLS);
      const r = Math.floor(rng() * ROWS);
      if (run.board[c][r].t !== EMPTY) continue;
      const frozen = lv.feature === 'frozen' && rng() < 0.4;
      run.board[c][r] = cell(ROCK, c, r, { hp: frozen ? hp + 1 : hp, frozen });
      placed += 1;
    }

    // 富矿段：随机竖列 3×；温泉：随机格 2×
    run.richColumn = lv.feature === 'rich' ? Math.floor(rng() * COLS) : -1;
    run.hotspringCell = lv.feature === 'hotspring' ? { c: Math.floor(rng() * COLS), r: Math.floor(rng() * ROWS) } : null;

    // 填充矿石
    for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1) {
      if (run.board[c][r].t === EMPTY) run.board[c][r] = cell(randOre(), c, r);
    }
    ensurePlayable();
  }

  // ---------- 消除检测 ----------
  function sameType(a, b) { return isOre(a.t) && isOre(b.t) && a.t === b.t; }

  function findMatches() {
    const set = new Set();
    let big = false;

    // 横向
    for (let r = 0; r < ROWS; r += 1) {
      let c = 0;
      while (c < COLS) {
        const t = run.board[c][r].t;
        if (!isOre(t)) { c += 1; continue; }
        let end = c;
        while (end + 1 < COLS && run.board[end + 1][r].t === t) end += 1;
        const len = end - c + 1;
        if (len >= 3) {
          for (let i = c; i <= end; i += 1) set.add(key(i, r));
          if (len >= 5) { big = true; for (let i = 0; i < COLS; i += 1) if (run.board[i][r].t === t) set.add(key(i, r)); }
          else if (len === 4) { big = true; for (let i = 0; i < COLS; i += 1) if (isOre(run.board[i][r].t)) set.add(key(i, r)); }
        }
        c = end + 1;
      }
    }
    // 纵向
    for (let c = 0; c < COLS; c += 1) {
      let r = 0;
      while (r < ROWS) {
        const t = run.board[c][r].t;
        if (!isOre(t)) { r += 1; continue; }
        let end = r;
        while (end + 1 < ROWS && run.board[c][end + 1].t === t) end += 1;
        const len = end - r + 1;
        if (len >= 3) {
          for (let i = r; i <= end; i += 1) set.add(key(c, i));
          if (len >= 5) { big = true; for (let i = 0; i < ROWS; i += 1) if (run.board[c][i].t === t) set.add(key(c, i)); }
          else if (len === 4) { big = true; for (let i = 0; i < ROWS; i += 1) if (isOre(run.board[c][i].t)) set.add(key(c, i)); }
        }
        r = end + 1;
      }
    }
    return { set, big };
  }

  function wouldMatch(a, b) {
    swapCells(a, b);
    const m = findMatches().set.size > 0;
    swapCells(a, b);
    return m;
  }

  function findAnyMatch() {
    return findSwap(false);
  }

  /** 找一个能产生消除的交换；clearsRock=true 时要求该消除能炸到相邻岩壁/矿兽。 */
  function findSwap(clearsRock) {
    for (let c = 0; c < COLS; c += 1) {
      for (let r = 0; r < ROWS; r += 1) {
        if (!isOre(run.board[c][r].t)) continue;
        const cands = [];
        if (c + 1 < COLS && isOre(run.board[c + 1][r].t)) cands.push([{ c, r }, { c: c + 1, r }]);
        if (r + 1 < ROWS && isOre(run.board[c][r + 1].t)) cands.push([{ c, r }, { c, r: r + 1 }]);
        for (const [a, b] of cands) {
          swapCells(a, b);
          const m = findMatches();
          let ok = m.set.size > 0;
          if (ok && clearsRock) {
            ok = false;
            for (const k of m.set) {
              const [mc, mr] = k.split(',').map(Number);
              const nbrs = [[mc + 1, mr], [mc - 1, mr], [mc, mr + 1], [mc, mr - 1]];
              for (const [nc, nr] of nbrs) {
                if (inBoard(nc, nr) && (run.board[nc][nr].t === ROCK || run.board[nc][nr].t === BOSS_T)) { ok = true; break; }
              }
              if (ok) break;
            }
          }
          swapCells(a, b);
          if (ok) return [[a.c, a.r], [b.c, b.r]];
        }
      }
    }
    return null;
  }

  function shuffleOres() {
    const cells = [];
    for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1) if (isOre(run.board[c][r].t)) cells.push([c, r]);
    const types = cells.map(([c, r]) => run.board[c][r].t);
    for (let i = types.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    cells.forEach(([c, r], i) => { run.board[c][r].t = types[i]; });
  }

  function ensurePlayable() {
    let guard = 0;
    while (findAnyMatch() == null && guard < 60) {
      shuffleOres();
      guard += 1;
    }
  }

  // ---------- 交换 / 消除 ----------
  function swapCells(a, b) {
    const tmp = run.board[a.c][a.r];
    run.board[a.c][a.r] = run.board[b.c][b.r];
    run.board[b.c][b.r] = tmp;
    run.board[a.c][a.r].c = a.c; run.board[a.c][a.r].r = a.r;
    run.board[b.c][b.r].c = b.c; run.board[b.c][b.r].r = b.r;
  }

  function litLevel(col) {
    let lv = 0;
    for (const g of run.goblins) if (g.col === col) lv = Math.max(lv, g.level);
    return lv;
  }

  function yieldFor(c, r) {
    let m = 1;
    const ll = litLevel(c);
    if (ll > 0) m *= 1 + GOBLIN.lightBonusPerLevel * ll;
    if (c === run.richColumn) m *= 3;
    if (run.hotspringCell && run.hotspringCell.c === c && run.hotspringCell.r === r) m *= 2;
    return Math.max(1, Math.floor(m));
  }

  function applyMatch(m, combo) {
    // 1) 收集资源
    const cleared = [];
    for (const k of m.set) {
      const [c, r] = k.split(',').map(Number);
      if (isOre(run.board[c][r].t)) cleared.push({ c, r, t: run.board[c][r].t });
    }
    const gains = {};
    for (const cell of cleared) {
      const y = yieldFor(cell.c, cell.r);
      if (cell.t === TILE.GOLD) gains.gold = (gains.gold || 0) + y;
      else if (cell.t === TILE.FUEL) gains.fuel = (gains.fuel || 0) + y;
      else gains[ORE_KEYS[cell.t]] = (gains[ORE_KEYS[cell.t]] || 0) + y;
      addResource(cell.t, y);
    }
    emit(m.big ? 'matchBig' : 'match', { combo, count: cleared.length, gains });

    // 2) 相邻岩壁/矿兽伤害
    const rockHits = new Map();
    let bossHits = 0;
    for (const cell of cleared) {
      const nbrs = [[cell.c + 1, cell.r], [cell.c - 1, cell.r], [cell.c, cell.r + 1], [cell.c, cell.r - 1]];
      for (const [nc, nr] of nbrs) {
        if (!inBoard(nc, nr)) continue;
        const t = run.board[nc][nr].t;
        if (t === ROCK) rockHits.set(key(nc, nr), (rockHits.get(key(nc, nr)) || 0) + 1);
        else if (t === BOSS_T) bossHits += 1;
      }
    }

    // 3) 清除矿石
    for (const cell of cleared) run.board[cell.c][cell.r] = emptyCell(cell.c, cell.r);

    // 4) 岩壁扣血
    for (const [k, hits] of rockHits) {
      const [c, r] = k.split(',').map(Number);
      const rock = run.board[c][r];
      if (rock.t !== ROCK) continue;
      rock.hp -= hits;
      if (rock.hp <= 0) {
        const wasFrozen = rock.frozen;
        run.board[c][r] = emptyCell(c, r);
        emit(wasFrozen ? 'frozenBreak' : 'rockBreak', { c, r });
      }
    }

    // 5) 矿兽扣血
    if (bossHits > 0 && run.boss) {
      run.boss.hp -= bossHits;
      emit('bossHit', { hp: run.boss.hp, max: run.boss.max });
      if (run.boss.hp <= 0) {
        run.boss = null;
        run.moves += MOVES.bossKillGain;
        run.stats.bossKills += 1;
        for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1) if (run.board[c][r].t === BOSS_T) run.board[c][r] = emptyCell(c, r);
        emit('bossBreak', {});
      }
    }
  }

  function applyGravity() {
    for (let c = 0; c < COLS; c += 1) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r -= 1) {
        const cur = run.board[c][r];
        if (cur.t === EMPTY) continue;
        if (cur.t === ROCK && cur.frozen) {
          if (write !== r) { run.board[c][write] = cur; run.board[c][write].r = write; run.board[c][r] = emptyCell(c, r); }
          write = r - 1;
          continue;
        }
        if (write !== r) { run.board[c][write] = cur; run.board[c][write].r = write; run.board[c][r] = emptyCell(c, r); }
        write -= 1;
      }
    }
  }

  function refill() {
    for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1) {
      if (run.board[c][r].t === EMPTY) run.board[c][r] = cell(randOre(), c, r);
    }
  }

  function resolveCascade() {
    let combo = 0;
    while (combo < 25) {
      const m = findMatches();
      if (m.set.size === 0) break;
      combo += 1;
      applyMatch(m, combo);
      applyGravity();
      refill();
    }
    if (combo > 0) {
      run.stats.matches += combo;
      if (combo > run.stats.maxCombo) run.stats.maxCombo = combo;
    }
    return combo;
  }

  // ---------- 动作 ----------
  function doSwap(a, b) {
    if (run.phase !== 'playing') return false;
    if (!inBoard(a.c, a.r) || !inBoard(b.c, b.r)) return false;
    const ca = run.board[a.c][a.r];
    const cb = run.board[b.c][b.r];
    if (!isOre(ca.t) || !isOre(cb.t)) return false;
    const dc = Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
    if (dc !== 1) return false;

    emit('swap', { a: [a.c, a.r], b: [b.c, b.r] });
    swapCells(a, b);
    const first = findMatches().set.size > 0;
    if (!first) {
      swapCells(a, b);   // 无消除，交换回去
      return false;
    }
    run.moves -= MOVES.matchCost;
    resolveCascade();
    ensurePlayable();
    checkDeath();
    return true;
  }

  function canDig() {
    if (run.phase !== 'playing') return false;
    for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1) {
      if (run.board[c][r].t === ROCK || run.board[c][r].t === BOSS_T) return false;
    }
    return run.resources.fuel >= DIG.cost;
  }

  function doDig() {
    if (!canDig()) return false;
    run.resources.fuel -= DIG.cost;
    run.depth += DIG.depthPerDig;
    run.moves += MOVES.digGain;
    run.digCount += 1;
    run.stats.digs += 1;
    emit('dig', { depth: run.depth });
    emit('depthMilestone', { depth: run.depth });

    const lv = level();
    if (run.digCount >= lv.digs) {
      // 矿道打通
      run.shaft += 1;
      run.digCount = 0;
      run.stats.shaftReached = Math.max(run.stats.shaftReached, run.shaft - 1);
      emit('shaftClear', { shaft: run.shaft - 1 });
      if (run.shaft > LEVELS.length) {
        run.phase = 'won';
        emit('death', { won: true });
        return true;
      }
      spawnLayer();
    } else {
      spawnLayer();
    }
    checkDeath();
    return true;
  }

  function doReinforce() {
    if (run.phase !== 'playing') return false;
    if (run.coins < STABILITY.reinforceCost) return false;
    run.coins -= STABILITY.reinforceCost;
    run.reinforced = true;
    emit('reinforce', {});
    return true;
  }

  function doSkill(spec) {
    if (run.phase !== 'playing') return false;
    const skill = SKILLS.find((s) => s.id === spec.id);
    if (!skill || !canPay(skill.cost)) return false;
    const pos = spec.pos || { c: 0, r: 0 };

    if (skill.id === 'fuelSurge') {
      pay(skill.cost);
      run.moves += 1;
      emit('skill', { id: skill.id });
      return true;
    }
    if (skill.id === 'fuelCollect') {
      pay(skill.cost);
      let total = 0;
      for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1) {
        if (run.board[c][r].t === TILE.FUEL) { total += yieldFor(c, r); run.board[c][r] = emptyCell(c, r); }
      }
      addResource(TILE.FUEL, Math.max(0, total));
      emit('skill', { id: skill.id });
      applyGravity(); refill(); ensurePlayable();
      return true;
    }
    if (skill.id === 'tnt' || skill.id === 'precisePick') {
      if (!inBoard(pos.c, pos.r)) return false;
      pay(skill.cost);
      const center = run.board[pos.c][pos.r];
      if (skill.id === 'precisePick') {
        if (!isOre(center.t)) return false;
        const y = yieldFor(pos.c, pos.r) * 2;
        addResource(center.t, y);
        run.board[pos.c][pos.r] = emptyCell(pos.c, pos.r);
        emit('oreGain', { kind: ORE_KEYS[center.t] || 'gold', amount: y });
      } else {
        // TNT：3×3 清除矿石 + 炸岩壁
        for (let dc = -1; dc <= 1; dc += 1) for (let dr = -1; dr <= 1; dr += 1) {
          const c = pos.c + dc; const r = pos.r + dr;
          if (!inBoard(c, r)) continue;
          const t = run.board[c][r].t;
          if (isOre(t)) { addResource(t, yieldFor(c, r)); run.board[c][r] = emptyCell(c, r); }
          else if (t === ROCK) { run.board[c][r].hp -= 1; if (run.board[c][r].hp <= 0) { run.board[c][r] = emptyCell(c, r); emit('rockBreak', { c, r }); } }
          else if (t === BOSS_T && run.boss) { run.boss.hp -= 1; emit('bossHit', { hp: run.boss.hp, max: run.boss.max }); if (run.boss.hp <= 0) { run.boss = null; run.moves += MOVES.bossKillGain; run.stats.bossKills += 1; for (let cc = 0; cc < COLS; cc += 1) for (let rr = 0; rr < ROWS; rr += 1) if (run.board[cc][rr].t === BOSS_T) run.board[cc][rr] = emptyCell(cc, rr); emit('bossBreak', {}); } }
        }
      }
      emit('skill', { id: skill.id });
      applyGravity(); refill(); ensurePlayable();
      resolveCascade();
      checkDeath();
      return true;
    }
    return false;
  }

  function hireGoblin(col) {
    if (run.phase !== 'playing' || run.goblins.length >= GOBLIN.maxCount) return false;
    const cost = GOBLIN.hireCostBase + run.goblins.length * GOBLIN.hireCostStep;
    if (run.coins < cost) return false;
    const c = Math.max(0, Math.min(COLS - 1, Math.floor(col ?? 4)));
    run.coins -= cost;
    const g = { id: run.goblinSeq++, col: c, level: 1, nextProduceAt: run.time + 2 };
    run.goblins.push(g);
    run.nextProduceAt.set(g.id, g.nextProduceAt);
    emit('goblinHire', { id: g.id, col: c, cost });
    return true;
  }

  function upgradeGoblin(id) {
    const g = run.goblins.find((x) => x.id === id);
    if (!g || run.phase !== 'playing') return false;
    const cost = GOBLIN.upgradeCostBase + (g.level - 1) * GOBLIN.upgradeCostStep;
    if (run.coins < cost) return false;
    run.coins -= cost;
    g.level += 1;
    emit('goblinUpgrade', { id, level: g.level, cost });
    return true;
  }

  function moveGoblin(id, col) {
    const g = run.goblins.find((x) => x.id === id);
    if (!g) return false;
    g.col = Math.max(0, Math.min(COLS - 1, Math.floor(col)));
    emit('goblinUpgrade', { id, move: true, col: g.col });
    return true;
  }

  // ---------- 计时器 ----------
  function tickTimers() {
    // 燃料消耗（每照亮一列持续耗燃料）
    const lit = new Set(run.goblins.map((g) => g.col));
    if (lit.size > 0) {
      run.resources.fuel = Math.max(0, run.resources.fuel - GOBLIN.oilDrainPerColPerSec * lit.size * (1 / 60));
    }

    // 地精挂机产出（每 2s 一次）
    for (const g of run.goblins) {
      if (run.time >= g.nextProduceAt) {
        g.nextProduceAt += 2;
        produceGoblin(g);
      }
    }

    // 塌方
    if (run.time >= run.nextCollapseAt) {
      resolveCollapse();
      run.nextCollapseAt = run.time + collapseIntervalFor(level());
    }

    // 矿兽行动
    if (run.boss && run.time >= run.nextBossActionAt) {
      bossAction();
      run.nextBossActionAt = run.time + BOSS.actionIntervalSec;
    }
  }

  function produceGoblin(g) {
    const col = g.col;
    const counts = {};
    for (let r = 0; r < ROWS; r += 1) {
      const t = run.board[col][r].t;
      if (isOre(t)) counts[t] = (counts[t] || 0) + 1;
    }
    let type = TILE.GOLD;
    let best = -1;
    for (const k in counts) if (counts[k] > best) { best = counts[k]; type = Number(k); }
    const y = Math.max(1, Math.floor(1 * (1 + GOBLIN.lightBonusPerLevel * g.level)));
    addResource(type, y);
    emit('produce', { col, kind: ORE_KEYS[type] || 'gold', amount: y, goblin: g.id });
  }

  function resolveCollapse() {
    if (run.reinforced) {
      run.reinforced = false;
      run.stability = Math.max(0, run.stability - STABILITY.reinforceDamage);
      emit('reinforce', { applied: true, stability: run.stability });
    } else {
      run.stability = Math.max(0, run.stability - STABILITY.collapseDamage);
      run.stats.collapses += 1;
      // 落岩：随机位置新增岩壁
      let placed = 0;
      let guard = 0;
      while (placed < STABILITY.rocksPerCollapse && guard < 200) {
        guard += 1;
        const c = Math.floor(rng() * COLS);
        const r = Math.floor(rng() * ROWS);
        if (run.board[c][r].t !== EMPTY) continue;
        run.board[c][r] = cell(ROCK, c, r, { hp: rockHpFor(level()) });
        placed += 1;
      }
      emit('collapse', { stability: run.stability });
    }
    checkDeath();
  }

  function bossAction() {
    if (!run.boss) return;
    // 矿兽每次行动：随机落一个冻结岩或普通岩
    let guard = 0;
    while (guard < 200) {
      guard += 1;
      const c = Math.floor(rng() * COLS);
      const r = Math.floor(rng() * ROWS);
      if (run.board[c][r].t !== EMPTY) continue;
      const frozen = rng() < 0.5;
      run.board[c][r] = cell(ROCK, c, r, { hp: rockHpFor(level()) + (frozen ? 1 : 0), frozen });
      emit('bossAction', { kind: frozen ? 'frozen' : 'rock', c, r });
      return;
    }
  }

  function checkDeath() {
    if (run.phase !== 'playing') return;
    if (run.moves <= 0 || run.stability <= 0) {
      run.phase = 'dead';
      emit('death', { moves: run.moves, stability: run.stability });
    }
  }

  // ---------- 公开 ----------
  function applyInput(input) {
    if (!input) return;
    if (input.swap) {
      const [a, b] = input.swap;
      doSwap({ c: a[0], r: a[1] }, { c: b[0], r: b[1] });
    } else if (input.skill) {
      doSkill(input.skill);
    } else if (input.dig) {
      doDig();
    } else if (input.reinforce) {
      doReinforce();
    } else if (input.hire != null) {
      hireGoblin(input.hire);
    } else if (input.upgrade != null) {
      upgradeGoblin(input.upgrade);
    } else if (input.move) {
      moveGoblin(input.move.id, input.move.col);
    }
  }

  run.step = function step(input) {
    if (run.phase !== 'playing') return run;
    run.time += 1 / 60;
    applyInput(input);
    tickTimers();
    checkDeath();
    return run;
  };

  run.drainEvents = function drainEvents() {
    const ev = run.events;
    run.events = [];
    return ev;
  };

  run.getHud = function getHud() {
    const lv = level();
    return {
      shaft: run.shaft,
      chapter: lv.chapter,
      depth: run.depth,
      moves: run.moves,
      stability: run.stability,
      coins: run.coins,
      fuel: run.resources.fuel,
      resources: { ...run.resources },
      goblins: run.goblins.map((g) => ({ ...g })),
      boss: run.boss ? { hp: run.boss.hp, max: run.boss.max } : null,
      canDig: canDig(),
      collapseIn: Math.max(0, run.nextCollapseAt - run.time),
      reinforced: run.reinforced,
      richColumn: run.richColumn,
      hotspring: run.hotspringCell,
    };
  };

  run.snapshot = function snapshot() {
    return {
      phase: run.phase,
      shaft: run.shaft,
      depth: run.depth,
      moves: run.moves,
      stability: run.stability,
      coins: run.coins,
      resources: { ...run.resources },
      goblins: run.goblins.map((g) => ({ ...g })),
      board: run.board.map((col) => col.map((c) => ({ t: c.t, hp: c.hp, frozen: c.frozen }))),
      stats: { ...run.stats },
      time: run.time,
    };
  };

  run.findAnyMatch = findAnyMatch;
  run.findSwap = findSwap;
  run.canDig = canDig;

  // 初始化
  initBoard();
  spawnLayer();
  run.nextCollapseAt = run.time + STABILITY.firstSec;
  return run;
}

export { TILE, ORE_KEYS };
