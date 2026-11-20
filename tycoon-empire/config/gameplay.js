// config/gameplay.js — 经营数值（M1）：12 产业、点击产出、升级/经理、股市日、贷款、离线收益。
// 全部数值 config-first，逻辑层不写死数字。

// ---------- 单位格式化 ----------
// 大数字缩写（K/M/B/T/AA/AB/...），与 abyss-eel 的 countUnit 思路一致但独立实现。
const UNITS = ['', 'K', 'M', 'B', 'T', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK'];

export function formatMoney(n) {
  if (!Number.isFinite(n)) return '$0';
  if (n < 0) return '-$' + formatMoney(-n);
  let v = n;
  let unit = 0;
  while (v >= 1000 && unit < UNITS.length - 1) {
    v /= 1000;
    unit += 1;
  }
  const dec = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return '$' + v.toFixed(dec) + UNITS[unit];
}

export function formatInt(n) {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) < 1000) return String(Math.floor(n));
  return formatMoney(n);
}

// ---------- 点击（主资产产出） ----------
export const TAP = {
  base: 1,
  perLevel: 0.5,   // 每次点击产出 = base * (1 + 全产业总等级 * perLevel)
  comboWindow: 1.5, // 连续点击判定窗口（秒）
  comboN: 10,       // 连点 N 次触发爆发
  comboMult: 2,     // 爆发倍率
};

// ---------- 产业（12 个里程碑，顺序解锁） ----------
// costGrowth / incomeGrowth：升级成本与产出的几何曲线。
export const INDUSTRIES = [
  { id: 'newsstand', cost: 0,       income: 1,      costGrowth: 1.15, incomeGrowth: 1.12, managerCost: 25,        scene: 0 },
  { id: 'laundry',   cost: 15,      income: 4,      costGrowth: 1.15, incomeGrowth: 1.12, managerCost: 80,        scene: 0 },
  { id: 'diner',     cost: 90,      income: 16,     costGrowth: 1.15, incomeGrowth: 1.12, managerCost: 260,       scene: 0 },
  { id: 'radio',     cost: 420,     income: 62,     costGrowth: 1.15, incomeGrowth: 1.12, managerCost: 950,       scene: 0 },
  { id: 'theater',   cost: 2100,    income: 260,    costGrowth: 1.15, incomeGrowth: 1.12, managerCost: 4300,      scene: 1 },
  { id: 'newspaper', cost: 9500,    income: 1150,   costGrowth: 1.15, incomeGrowth: 1.12, managerCost: 19000,     scene: 1 },
  { id: 'deptstore', cost: 42000,   income: 5200,   costGrowth: 1.15, incomeGrowth: 1.12, managerCost: 85000,     scene: 1 },
  { id: 'autoworks', cost: 190000,  income: 23000,  costGrowth: 1.15, incomeGrowth: 1.12, managerCost: 380000,    scene: 1 },
  { id: 'shipping',  cost: 900000,  income: 105000, costGrowth: 1.15, incomeGrowth: 1.12, managerCost: 1800000,   scene: 2 },
  { id: 'railway',   cost: 4500000, income: 470000, costGrowth: 1.15, incomeGrowth: 1.12, managerCost: 9000000,   scene: 2 },
  { id: 'oil',       cost: 26000000,income: 2100000,costGrowth: 1.15, incomeGrowth: 1.12, managerCost: 52000000,  scene: 2 },
  { id: 'bank',      cost: 180000000,income: 10000000,costGrowth: 1.15, incomeGrowth: 1.12, managerCost: 360000000, scene: 2 },
];

export const INDUSTRY_COUNT = INDUSTRIES.length;

// ---------- 升级 ----------
export const UPGRADE = {
  batchDefault: 1,
  batchMax: 10,
};

// ---------- 股市日 ----------
export const STOCK = {
  intervalSec: 30,   // 每 30s 一个行情日
  betWindowSec: 10,  // 押注窗口（行情日揭晓前的决策时间）
  upMult: 2,         // 行情向上：该产业产出 ×2
  downMult: 0.5,     // 行情向下：该产业产出 ×0.5
  winMult: 2,        // all in 押中：现金 ×2
  loseMult: 0.5,     // all in 押错：现金 ×0.5
};

// ---------- 贷款 ----------
export const LOAN = {
  borrowMult: 10,    // 借 10 倍现金
  interestRate: 0.05,// 每 interestSec 利息 5%（从现金扣除）
  interestSec: 60,
  minCashToBorrow: 10,
};

// ---------- 离线收益 ----------
export const OFFLINE = {
  minSec: 60,          // 离开不足 1 分钟不算离线（避免刷新弹窗）
  capSec: 8 * 3600,
  rate: 0.5,           // 离线收益 = 总收入速率 × 离线秒 × rate
};

// ---------- 破产 ----------
export const BANKRUPT = {
  minDebtToFail: 1,
};

// ---------- 场景章节 ----------
export function chapterOf(unlockedCount) {
  if (unlockedCount <= 4) return 0;
  if (unlockedCount <= 8) return 1;
  return 2;
}

// ---------- 派生数值 ----------
export function upgradeCost(i, level) {
  const ind = INDUSTRIES[i];
  return Math.round(ind.cost === 0 ? 4 * Math.pow(ind.costGrowth, level) : ind.cost * Math.pow(ind.costGrowth, level));
}

export function incomeRate(i, level) {
  const ind = INDUSTRIES[i];
  return ind.income * Math.pow(ind.incomeGrowth, level);
}

export function industryValue(i, level) {
  const ind = INDUSTRIES[i];
  return ind.cost === 0 ? 10 * Math.pow(ind.costGrowth, level) : ind.cost * Math.pow(ind.costGrowth, level);
}

export function tapValue(totalLevel) {
  return TAP.base * (1 + totalLevel * TAP.perLevel);
}

export function netWorth(cash, industries) {
  let worth = cash;
  for (let i = 0; i < industries.length; i += 1) {
    const ind = industries[i];
    if (ind.owned) worth += industryValue(i, ind.level);
  }
  return worth;
}

// 某产业当前总产出速率（含股市日倍率）
export function effectiveRate(i, level, stock) {
  let mult = 1;
  if (stock && stock.active && stock.target === i) mult = stock.up ? STOCK.upMult : STOCK.downMult;
  return incomeRate(i, level) * mult;
}
