// EGG BOOM · 排（rack）生成器：给定关卡 + rng，产出一排 6 行的面团规格。
// 每关一个 pattern（basic/high/floating/moving/doubleGap/armored/mixed/finale）。
import { ROWS, DOUGH, doughValueMaxAt, armoredUnlocked, movingUnlocked } from '../../config/gameplay.js';
import { levelDef } from '../../config/levels.js';
import { randInt } from './rng.js';

const PATTERNS = {
  basic: fillBasic,
  high: fillHigh,
  floating: fillFloating,
  moving: fillMoving,
  doubleGap: fillDoubleGap,
  armored: fillArmored,
  mixed: fillMixed,
  finale: fillFinale,
};

/**
 * 生成一排面团（不含 id；sim 会赋 id）。
 * @returns {Array} 每个元素 { row, value, armored, moving } 或 null（该行空）
 */
export function spawnRack(rng, level, distance) {
  const def = levelDef(level);
  const slots = new Array(ROWS.COUNT).fill(null);
  const fn = PATTERNS[def.pattern] || fillBasic;
  fn(rng, level, def, slots);
  return slots.map((s) => (s == null ? null : { ...s, atDistance: distance }));
}

function valueFor(rng, level, bonus = 0) {
  const v = doughValueMaxAt(level, rng) + bonus;
  return Math.max(1, Math.min(20, v));
}

function make(rng, level, def, row, opts = {}) {
  const armored = opts.armored ?? (armoredUnlocked(level) && rng() < def.armoredRate);
  const moving = opts.moving ?? (movingUnlocked(level) && rng() < def.movingRate);
  const value = armored ? randInt(rng, 1, 2) : valueFor(rng, level, opts.bonus ?? 0);
  return { row, value, armored, moving, phase: rng() * Math.PI * 2 };
}

// ---- 各 pattern 填行 ----

function fillBasic(rng, level, def, slots) {
  // 基础：地面行必填（教「不清就撞」），再随机填 fill-1 行
  slots[5] = make(rng, level, def, 6, { bonus: 0 });
  const others = [1, 2, 3, 4, 5];
  shuffle(rng, others);
  for (let i = 0; i < Math.min(def.fill - 1, others.length); i += 1) {
    slots[others[i] - 1] = make(rng, level, def, others[i], { bonus: 0 });
  }
}

function fillHigh(rng, level, def, slots) {
  // 高数字：值 +2，地面行仍必填
  slots[5] = make(rng, level, def, 6, { bonus: 2 });
  const others = [1, 2, 3, 4, 5];
  shuffle(rng, others);
  for (let i = 0; i < Math.min(def.fill - 1, others.length); i += 1) {
    slots[others[i] - 1] = make(rng, level, def, others[i], { bonus: 2 });
  }
}

function fillFloating(rng, level, def, slots) {
  // 悬空团：无地面行（row6 空），全部浮空，留至少一个空隙
  const rows = [1, 2, 3, 4, 5];
  shuffle(rng, rows);
  const n = Math.min(def.fill, rows.length - 1); // 保证至少留一个空行
  for (let i = 0; i < n; i += 1) {
    slots[rows[i] - 1] = make(rng, level, def, rows[i], { bonus: 1 });
  }
}

function fillMoving(rng, level, def, slots) {
  // 移动团：部分地面行 + 大部分移动
  if (rng() < 0.6) slots[5] = make(rng, level, def, 6, { moving: rng() < 0.5 });
  const rows = [1, 2, 3, 4, 5];
  shuffle(rng, rows);
  for (let i = 0; i < Math.min(def.fill - (slots[5] ? 1 : 0), rows.length); i += 1) {
    slots[rows[i] - 1] = make(rng, level, def, rows[i], { moving: rng() < def.movingRate });
  }
}

function fillDoubleGap(rng, level, def, slots) {
  // 双排夹缝：随机选两行填满，两行之间至少隔一行空隙（窄缝）
  const rows = [1, 2, 3, 4, 5, 6];
  shuffle(rng, rows);
  rows.sort((a, b) => a - b);
  // 取两个相隔 >=2 的行（中间留至少一行空隙）
  let picked = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const a = randInt(rng, 1, 6);
    const b = randInt(rng, 1, 6);
    if (Math.abs(a - b) >= 2) { picked = [a, b]; break; }
  }
  if (!picked) picked = [2, 4];
  for (const r of picked) slots[r - 1] = make(rng, level, def, r, { bonus: 1 });
  // 再随机补 1–2 行（保持密度，但不填满窄缝两侧以外的所有行）
  const extra = [1, 2, 3, 4, 5, 6].filter((r) => !picked.includes(r));
  shuffle(rng, extra);
  for (let i = 0; i < Math.min(Math.max(0, def.fill - 2), extra.length); i += 1) {
    slots[extra[i] - 1] = make(rng, level, def, extra[i], { bonus: 0 });
  }
}

function fillArmored(rng, level, def, slots) {
  // 护甲团：至少一个护甲团（可能在地面行），普通团陪衬
  const armRow = randInt(rng, 1, 6);
  slots[armRow - 1] = make(rng, level, def, armRow, { armored: true });
  const rows = [1, 2, 3, 4, 5, 6].filter((r) => r !== armRow);
  shuffle(rng, rows);
  for (let i = 0; i < Math.min(def.fill - 1, rows.length); i += 1) {
    slots[rows[i] - 1] = make(rng, level, def, rows[i], { bonus: 0 });
  }
}

function fillMixed(rng, level, def, slots) {
  // 全家福：护甲 + 移动 + 高数字全混
  const rows = [1, 2, 3, 4, 5, 6];
  shuffle(rng, rows);
  for (let i = 0; i < Math.min(def.fill, rows.length); i += 1) {
    const r = rows[i];
    const roll = rng();
    if (roll < def.armoredRate) slots[r - 1] = make(rng, level, def, r, { armored: true });
    else slots[r - 1] = make(rng, level, def, r, { moving: rng() < def.movingRate, bonus: 1 });
  }
}

function fillFinale(rng, level, def, slots) {
  // 终极：满 6 行，混合护甲 + 移动 + 高数字
  for (let r = 1; r <= 6; r += 1) {
    const roll = rng();
    if (roll < def.armoredRate) slots[r - 1] = make(rng, level, def, r, { armored: true });
    else slots[r - 1] = make(rng, level, def, r, { moving: rng() < def.movingRate, bonus: 2 });
  }
}

function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
