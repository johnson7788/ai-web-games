// 纯逻辑模拟（可 node 测试，不碰 DOM/window/localStorage/Date.now）。
// 六边形棋盘堆叠消除：随机 2–4 格蜂巢块组落盘、整线消除、封蜡需消两次、
// 花粉块 3 步内被消除会传染邻格、12 档推进 + 特性轮换、放不下判负。
import { STEP } from '../../config/game.config.js';
import { mulberry32 } from './rng.js';
import {
  allCells, buildLines, neighbors, rotateOffsets, RADIUS,
} from './hex.js';
import {
  SHAPES, TIERS, SCORING, POLLEN_LIFE, scenePackOf,
} from '../../config/gameplay.js';

export function createRun({ seed = 1 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    time: 0,
    phase: 'playing',       // playing | dead
    tier: 1,
    score: 0,
    placements: 0,
    cells: [],              // 61 个 { q, r, filled, color, wax, pollen, pollenAge, wall }
    indexByCoord: new Map(),
    lines: [],              // 每条消除线 = 可放置格索引数组
    shapes: [],             // 候选块组 [{ offsets, rot, pollen }]
    selected: 0,
    hover: null,
    lastLines: 0,
    events: [],
    stats: {
      tierReached: 1, maxCombo: 0, clears: 0, cascadeCount: 0,
      pollenSpreads: 0, waxApplied: 0, nearMisses: 0, placements: 0,
    },
  };

  const tierConfig = () => TIERS[run.tier - 1] || TIERS[TIERS.length - 1];

  function indexOf(cell) {
    return run.indexByCoord.get(`${cell.q},${cell.r}`);
  }

  function computePlayable() {
    const playable = run.cells.filter((c) => !c.wall);
    run.lines = buildLines(playable).map((arr) => arr.map((c) => indexOf(c)));
  }

  function initBoard() {
    const cells = allCells().sort((a, b) => a.r - b.r || a.q - b.q);
    run.cells = cells.map((c) => ({
      q: c.q, r: c.r, filled: false, color: 0, wax: 0, pollen: false, pollenAge: 0, wall: false,
    }));
    run.indexByCoord = new Map();
    run.cells.forEach((c, i) => run.indexByCoord.set(`${c.q},${c.r}`, i));
    computePlayable();
  }

  function rotatedOffsets(offsets, rot) {
    let o = offsets;
    for (let i = 0; i < rot; i += 1) o = rotateOffsets(o);
    return o;
  }

  // 形状（已旋转）以 anchor 为 (0,0) 落位所需的格子索引；不合法返回 null
  function placementCells(shape, anchorIdx) {
    const anchor = run.cells[anchorIdx];
    if (!anchor || anchor.wall || anchor.filled) return null;
    const offs = rotatedOffsets(shape.offsets, shape.rot);
    const out = [];
    for (const [dq, dr] of offs) {
      const idx = run.indexByCoord.get(`${anchor.q + dq},${anchor.r + dr}`);
      if (idx == null) return null;
      const cell = run.cells[idx];
      if (cell.wall || cell.filled) return null;
      out.push(idx);
    }
    return out;
  }

  function spawnShape() {
    const t = tierConfig();
    const pool = SHAPES;
    let base;
    const roll = run.rng();
    if (roll < t.bigBlockRatio) {
      const big = pool.filter((s) => s.length === 4);
      base = big[Math.floor(run.rng() * big.length)] || pool[0];
    } else if (roll < 0.5) {
      const small = pool.filter((s) => s.length <= 2);
      base = small[Math.floor(run.rng() * small.length)] || pool[0];
    } else {
      base = pool[Math.floor(run.rng() * pool.length)];
    }
    return {
      offsets: base.map(([q, r]) => [q, r]),
      rot: 0,
      pollen: run.rng() < t.pollenChance,
    };
  }

  function refillShapes() {
    const t = tierConfig();
    while (run.shapes.length < t.shapeSlots) run.shapes.push(spawnShape());
  }

  function clearCell(i) {
    const c = run.cells[i];
    c.filled = false;
    c.color = 0;
    c.pollen = false;
    c.pollenAge = 0;
    c.wax = 0;
  }

  function checkNearMiss() {
    for (const line of run.lines) {
      let empty = 0;
      for (const i of line) if (!run.cells[i].filled) empty += 1;
      if (empty === 1) {
        run.stats.nearMisses += 1;
        run.events.push({ type: 'nearMiss', t: run.time });
        return;
      }
    }
  }

  function eliminate() {
    const fullLines = run.lines.filter((line) => line.every((i) => run.cells[i].filled));
    if (fullLines.length === 0) return;

    const removed = new Set();
    for (const line of fullLines) for (const i of line) removed.add(i);

    // 封蜡：wax>0 的格子第一次消除只破蜡，不消失
    for (const i of [...removed]) {
      const c = run.cells[i];
      if (c.wax > 0) {
        c.wax -= 1;
        if (c.wax > 0) {
          removed.delete(i);
          run.events.push({ type: 'waxBreak', cell: i, t: run.time });
        }
      }
    }

    // 花粉传染：被消除的花粉块（age>0）消掉相邻已填格
    const chain = tierConfig().pollenChain;
    const spread = new Set();
    const queue = [];
    const seed = [...removed].filter((i) => run.cells[i].pollen && run.cells[i].pollenAge > 0);
    for (const i of seed) {
      const c = run.cells[i];
      for (const [nq, nr] of neighbors(c.q, c.r)) {
        const ni = run.indexByCoord.get(`${nq},${nr}`);
        if (ni == null) continue;
        const nc = run.cells[ni];
        if (nc.filled && !nc.wall && !removed.has(ni) && !spread.has(ni)) {
          spread.add(ni);
          queue.push(ni);
        }
      }
    }
    while (queue.length) {
      const i = queue.shift();
      const c = run.cells[i];
      if (chain && c.pollen && c.pollenAge > 0) {
        for (const [nq, nr] of neighbors(c.q, c.r)) {
          const ni = run.indexByCoord.get(`${nq},${nr}`);
          if (ni == null) continue;
          const nc = run.cells[ni];
          if (nc.filled && !nc.wall && !removed.has(ni) && !spread.has(ni)) {
            spread.add(ni);
            queue.push(ni);
          }
        }
      }
    }

    let clearedCount = 0;
    for (const i of removed) { clearCell(i); clearedCount += 1; }
    for (const i of spread) {
      if (run.cells[i].filled) {
        clearCell(i);
        clearedCount += 1;
        run.stats.pollenSpreads += 1;
        run.events.push({ type: 'pollenSpread', cell: i, t: run.time });
      }
    }

    const linesCleared = fullLines.length;
    const scoreGain = clearedCount * SCORING.clearPerCell * linesCleared
      + (linesCleared - 1) * SCORING.comboBonus
      + spread.size * SCORING.pollenCellBonus
      + (linesCleared >= 3 ? SCORING.cascadeBonus : 0);
    run.score += scoreGain;
    run.lastLines = linesCleared;
    run.stats.maxCombo = Math.max(run.stats.maxCombo, linesCleared);
    run.stats.clears += linesCleared;
    if (linesCleared >= 3) {
      run.stats.cascadeCount += 1;
      run.events.push({ type: 'cascade', lines: linesCleared, t: run.time });
    }
    run.events.push({
      type: 'clear', cells: clearedCount, lines: linesCleared, score: scoreGain, t: run.time,
      cellIds: [...removed, ...spread],
    });
  }

  function applyWax() {
    const t = tierConfig();
    if (!t.waxEvery || run.placements % t.waxEvery !== 0) return;
    const empties = run.cells.filter((c) => !c.filled && !c.wall);
    if (!empties.length) return;
    const c = empties[Math.floor(run.rng() * empties.length)];
    c.wax = 2;
    run.stats.waxApplied += 1;
    run.events.push({ type: 'wax', cell: indexOf(c), t: run.time });
  }

  function decayPollen() {
    for (const c of run.cells) {
      if (c.filled && c.pollen && c.pollenAge > 0) c.pollenAge -= 1;
    }
  }

  function applyNarrow() {
    for (const c of run.cells) {
      if (Math.max(Math.abs(c.q), Math.abs(c.r), Math.abs(c.q + c.r)) === RADIUS && !c.filled) {
        c.wall = true;
      }
    }
    computePlayable();
    if (run.hover != null && run.cells[run.hover].wall) run.hover = null;
  }

  function advanceTier() {
    while (run.tier < TIERS.length && run.score >= TIERS[run.tier].target) {
      run.tier += 1;
      run.stats.tierReached = Math.max(run.stats.tierReached, run.tier);
      run.events.push({ type: 'tierUp', tier: run.tier, t: run.time });
      if (tierConfig().narrow) applyNarrow();
    }
  }

  function enumeratePlacements() {
    const out = [];
    for (let s = 0; s < run.shapes.length; s += 1) {
      const shape = run.shapes[s];
      for (let rot = 0; rot < 6; rot += 1) {
        const saved = shape.rot;
        shape.rot = rot;
        for (let idx = 0; idx < run.cells.length; idx += 1) {
          const cells = placementCells(shape, idx);
          if (cells) out.push({ slot: s, rot, anchor: idx, cells });
        }
        shape.rot = saved;
      }
    }
    return out;
  }

  function checkLose() {
    if (enumeratePlacements().length === 0) {
      run.phase = 'dead';
      run.events.push({ type: 'death', t: run.time, score: run.score, tier: run.tier });
    }
  }

  function doDrop() {
    if (run.hover == null) return;
    const shape = run.shapes[run.selected];
    if (!shape) return;
    const cells = placementCells(shape, run.hover);
    if (!cells) {
      run.events.push({ type: 'blocked', t: run.time });
      return;
    }
    const color = Math.floor(run.rng() * 6);
    for (const i of cells) {
      const c = run.cells[i];
      c.filled = true;
      c.color = color;
      if (shape.pollen) { c.pollen = true; c.pollenAge = POLLEN_LIFE; }
    }
    run.placements += 1;
    run.stats.placements += 1;
    run.score += cells.length * SCORING.placePerCell;
    run.events.push({ type: 'place', cells: cells.length, t: run.time });

    run.shapes.splice(run.selected, 1);
    run.selected = Math.min(run.selected, Math.max(0, run.shapes.length - 1));
    refillShapes();

    checkNearMiss();
    eliminate();
    applyWax();
    decayPollen();
    advanceTier();
    checkLose();
  }

  // ---- 对外 API ----
  run.step = (input = {}) => {
    run.time += STEP;
    if (run.phase !== 'playing') return run;
    if (input.select != null && input.select >= 0 && input.select < run.shapes.length && input.select !== run.selected) {
      run.selected = input.select;
      run.events.push({ type: 'select', slot: input.select, t: run.time });
    }
    if (input.rotate && run.shapes[run.selected]) {
      run.shapes[run.selected].rot = (run.shapes[run.selected].rot + 1) % 6;
      run.events.push({ type: 'rotate', slot: run.selected, t: run.time });
    }
    if (input.hover != null) {
      const idx = Number(input.hover);
      if (run.cells[idx] && !run.cells[idx].wall && idx !== run.hover) {
        run.hover = idx;
      }
    }
    if (input.drop) doDrop();
    return run;
  };

  run.drainEvents = () => {
    const e = run.events;
    run.events = [];
    return e;
  };

  run.getHud = () => {
    const t = tierConfig();
    const target = run.tier < TIERS.length ? TIERS[run.tier].target : null;
    return {
      score: run.score,
      tier: run.tier,
      target,
      shapes: run.shapes.length,
      scene: scenePackOf(run.tier),
      combo: run.stats.maxCombo,
      lastLines: run.lastLines,
      cascadeCount: run.stats.cascadeCount,
      placements: run.placements,
      waxOnBoard: run.cells.filter((c) => c.wax > 0).length,
      pollenOnBoard: run.cells.filter((c) => c.pollen).length,
      phase: run.phase,
    };
  };

  // 调试/验收辅助：直接落一块（不推进时间），用于截图与定点测试
  run.debugPlace = (slot, rot, anchor) => {
    if (run.phase !== 'playing') return false;
    const shape = run.shapes[slot];
    if (!shape) return false;
    const saved = shape.rot;
    shape.rot = rot;
    const cells = placementCells(shape, anchor);
    shape.rot = saved;
    if (!cells) return false;
    run.selected = slot;
    run.hover = anchor;
    run.shapes[slot].rot = rot;
    doDrop();
    return true;
  };

  run.enumeratePlacements = enumeratePlacements;
  run.tierConfig = tierConfig;
  run.cellAt = (q, r) => {
    const i = run.indexByCoord.get(`${q},${r}`);
    return i == null ? null : run.cells[i];
  };

  initBoard();
  refillShapes();

  // 仅供纯逻辑测试直接驱动内部步骤（不对外暴露到游戏 UI）
  run._debug = { eliminate, applyWax, applyNarrow, advanceTier, checkLose, placementCells, decayPollen, spawnShape };
  return run;
}
