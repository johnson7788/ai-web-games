/**
 * config/data.js — 规则常量：格子 / 地形 / 精神指令
 *
 * 地形数值来自原作资料（GCGX「地形・移動力」）：
 *   移动消耗按 空 / 陸 / 海 三种移动类型分别给出；
 *   建筑（町・基地）、山、海、陨石 让被攻击方的命中 ×80%；
 *   空型机体不受地形影响。
 */

export { UNIT_DB, UNIT_EN, unitName, resolveUnit, SPRITES, ARCHETYPES, SPIRIT_SETS } from "./units.js";

/** 画布基础参数：一格 55px，16×11 格视口（相机随光标滚动） */
export const GRID = { cols: 16, rows: 11, tile: 55 };

/**
 * 地形定义
 *   move: { air, land, sea } 移动消耗（0 / 99 = 不可通行）
 *   hitMod: 被攻击方站在此地形时的命中修正（空型无效）
 *   heal: 每回合回复最大 HP 的比例
 */
const T = (key, name, air, land, sea, hitMod, opts = {}) => ({
  key, name, move: { air, land, sea }, hitMod, heal: 0, pass: air > 0 || land > 0, ...opts
});

export const TERRAIN = {
  plain:    T("plain",    "平地", 1, 1, 2, 1.0),
  bush:     T("bush",     "茂密", 1, 1, 2, 1.0),
  rough:    T("rough",    "荒地", 1, 2, 3, 1.0),
  forest:   T("forest",   "森林", 1, 2, 3, 1.0),
  mountain: T("mountain", "山地", 1, 3, 4, 0.8),
  sea:      T("sea",      "海",   1, 3, 1, 0.8),
  rock:     T("rock",     "岩地", 1, 1, 2, 0.8),
  desert:   T("desert",   "沙漠", 1, 2, 3, 1.0),
  town:     T("town",     "城市", 1, 1, 1, 0.8),
  base:     T("base",     "基地", 1, 1, 1, 0.8, { heal: 0.1 }),
  tank:     T("tank",     "不可通行", 0, 0, 0, 1.0),
  wall:     T("wall",     "围墙", 0, 0, 0, 1.0)
};

/** 地图字符 → 地形。字符表见 tools/build_scenarios.py */
export const LEGEND = {
  ".": "plain", ",": "bush", "~": "rough", "f": "forest",
  "m": "mountain", "w": "sea", "o": "rock", "d": "desert",
  "c": "town", "B": "base", "T": "tank", "#": "wall",
  "r": "plain", "b": "base"
};

/** 精神指令：id / 名称 / 消耗 / 说明 */
export const SPIRITS = {
  guts:      { id: "guts",      name: "毅力", cost: 10,  desc: "自身回复 50 HP" },
  sense:     { id: "sense",     name: "直觉", cost: 10,  desc: "本次攻击命中 +10%" },
  accel:     { id: "accel",     name: "加速", cost: 10,  desc: "本回合移动力 +3" },
  guard:     { id: "guard",     name: "防守", cost: 20,  desc: "下次受伤害减半" },
  friend:    { id: "friend",    name: "友情", cost: 30,  desc: "我方单体回复 50 HP" },
  critical:  { id: "critical",  name: "必杀", cost: 40,  desc: "下次攻击命中 100%" },
  drive:     { id: "drive",     name: "强攻", cost: 40,  desc: "下次攻击伤害 2 倍" },
  dodge:     { id: "dodge",     name: "回避", cost: 50,  desc: "完全闪避一次攻击" },
  swift:     { id: "swift",     name: "疾风", cost: 50,  desc: "本回合移动力 +5" },
  potential: { id: "potential", name: "潜力", cost: 60,  desc: "自身 HP 全回复" },
  bond:      { id: "bond",      name: "情义", cost: 70,  desc: "我方单体 HP 全回复" },
  hotblood:  { id: "hotblood",  name: "热血", cost: 80,  desc: "下次攻击伤害 3 倍" },
  support:   { id: "support",   name: "援助", cost: 80,  desc: "我方全体回复 50 HP" },
  jam:       { id: "jam",       name: "干扰", cost: 100, desc: "本回合敌方命中减半" },
  anger:     { id: "anger",     name: "怒",   cost: 100, desc: "敌方全体 1~128 伤害" },
  pray:      { id: "pray",      name: "祈祷", cost: 100, desc: "我方全体回复 100 HP" },
  love:      { id: "love",      name: "爱心", cost: 150, desc: "我方全体 HP 全回复" },
  rage:      { id: "rage",      name: "狂怒", cost: 150, desc: "敌方全体 10~255 伤害" },
  teleport:  { id: "teleport",  name: "传真", cost: 150, desc: "我方单体传送到指定位置" }
};
