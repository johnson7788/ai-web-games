/**
 * config/units.js — 机体/机师数据库
 *
 * 数据来源：
 * - 名称、关卡出场、等级、经验、资金：GCGX 逐话坐标表（data/gcgx.json）
 * - 数值/武器：按原作量级分档（hero/super/grunt/boss…），随等级成长
 *
 * 这里的 key 是「日文原名（规范化）」；引擎也接受中文名与 sprite key，
 * 便于手写关卡时用简写。
 */

import { AI_HD } from "./sprites-generated.js";

/** 机体立绘：hd 表示 assets/hd/units/<key>.webp，其余用矢量绘制 */
export const SPRITES = {
  /* ---- 已有 HD 立绘（12 台） ---- */
  gundam:    { hd: true, shape: "mech", main: "#eef3fb", sub: "#2f5fbf", accent: "#d84b4b", trim: "#e9c34a" },
  mazinger:  { hd: true, shape: "mech", main: "#2a2f3a", sub: "#c9302c", accent: "#e2e8f2", trim: "#e9b34a" },
  getter:    { hd: true, shape: "mech", main: "#eef3fb", sub: "#d84b4b", accent: "#8fb7ff", trim: "#e9c34a" },
  aphrodite: { hd: true, shape: "mech", main: "#f2b6c8", sub: "#eef1f6", accent: "#6fd39a", trim: "#ffffff" },
  texas:     { hd: true, shape: "mech", main: "#8a5a35", sub: "#d9b07a", accent: "#4a3421", trim: "#e9b34a" },
  whitebase: { hd: true, shape: "ship", main: "#dfe7f2", sub: "#3b6fa8", accent: "#d84b4b", trim: "#c9d6e8" },
  zaku:      { hd: true, shape: "mech", main: "#4f7a4a", sub: "#33502f", accent: "#2a3d27", trim: "#7f9c6e" },
  zakuChar:  { hd: true, shape: "mech", main: "#c0392b", sub: "#7a1f1f", accent: "#f0a08a", trim: "#e9b34a" },
  rada:      { hd: true, shape: "beast", main: "#6f5a8c", sub: "#3d3150", accent: "#c8b3e8", trim: "#9a86bd" },
  buda:      { hd: true, shape: "beast", main: "#5b6b7a", sub: "#2f3a44", accent: "#9fb3c4", trim: "#7d8fa0" },
  barrel:    { hd: true, shape: "beast", main: "#6a6f78", sub: "#3a3e45", accent: "#a9b0ba", trim: "#8b929c" },
  zain:      { hd: true, shape: "mech", main: "#4a3b6b", sub: "#2a2140", accent: "#8f79c9", trim: "#b9a6f0" },

  /* ---- 矢量机体（按原作配色） ---- */
  zeta:      { shape: "mech", main: "#e8eef8", sub: "#2f6fd0", accent: "#e04f4f", trim: "#e9c34a" },
  nu:        { shape: "mech", main: "#f0f4fb", sub: "#2b4fa8", accent: "#7fd4ff", trim: "#e9c34a" },
  zz:        { shape: "bulky", main: "#eef2fa", sub: "#c9342c", accent: "#2f5fbf", trim: "#e9c34a" },
  f91:       { shape: "mech", main: "#eef3fb", sub: "#2f5fbf", accent: "#e05a8a", trim: "#cfe9ff" },
  metz:      { shape: "mech", main: "#f3d7e2", sub: "#d05a86", accent: "#ffffff", trim: "#ffd0e0" },
  great:     { shape: "bulky", main: "#22262e", sub: "#c9302c", accent: "#e2e8f2", trim: "#e9b34a" },
  grendizer: { shape: "bulky", main: "#eef3fb", sub: "#2f5fbf", accent: "#d84b4b", trim: "#e9c34a" },
  daitarn:   { shape: "bulky", main: "#e0762b", sub: "#8a3d10", accent: "#f2e2b8", trim: "#e9c34a" },
  bosses:    { shape: "bulky", main: "#d9c04a", sub: "#3f6fbf", accent: "#eef1f6", trim: "#c9a53a" },
  cybuster:  { shape: "mech", main: "#eef1f8", sub: "#5b3fa8", accent: "#7fd4ff", trim: "#e9c34a" },
  getterg:   { shape: "bulky", main: "#eef3fb", sub: "#d84b4b", accent: "#8fb7ff", trim: "#e9c34a" },
  getterq:   { shape: "beast", main: "#e8d24a", sub: "#8a6d10", accent: "#eef1f6", trim: "#e9c34a" },
  argama:    { shape: "ship", main: "#dfe7f2", sub: "#3b6fa8", accent: "#d84b4b", trim: "#c9d6e8" },
  neelagama: { shape: "ship", main: "#e6edf6", sub: "#4a7fb5", accent: "#e9b34a", trim: "#c9d6e8" },
  racalium:  { shape: "ship", main: "#e2e8f2", sub: "#375f8f", accent: "#c9302c", trim: "#c9d6e8" },
  minerva:   { shape: "ship", main: "#8f79c9", sub: "#4a3b6b", accent: "#e0c04a", trim: "#b9a6f0" },
  midia:     { shape: "ship", main: "#c9d6e8", sub: "#5b6b7a", accent: "#e9b34a", trim: "#eef1f6" },

  /* ---- 敌方量产机 ---- */
  marasai:   { shape: "mech", main: "#6a4a8a", sub: "#3a2850", accent: "#c8b3e8", trim: "#9a86bd" },
  dreissen:  { shape: "bulky", main: "#4f7a4a", sub: "#2f4a2c", accent: "#c9b04a", trim: "#7f9c6e" },
  bau:       { shape: "mech", main: "#8a6a4a", sub: "#4a3524", accent: "#d9b07a", trim: "#a08060" },
  gazaC:     { shape: "bulky", main: "#5b8a4a", sub: "#2f4a24", accent: "#c9d97a", trim: "#7f9c6e" },
  giradoga:  { shape: "mech", main: "#4a7a5a", sub: "#24402c", accent: "#c9e0b3", trim: "#6f9c7e" },
  zusa:      { shape: "mech", main: "#7a4a8a", sub: "#402450", accent: "#d9b3e0", trim: "#9a6fbd" },
  yact:      { shape: "mech", main: "#c04040", sub: "#6a1f1f", accent: "#f0a08a", trim: "#e9b34a" },
  doven:     { shape: "bulky", main: "#3a4a7a", sub: "#1f2540", accent: "#9fb3e0", trim: "#6f7fbd" },
  hambrabi:  { shape: "mech", main: "#8a5aa8", sub: "#4a2f60", accent: "#e0c0f0", trim: "#b98fd0" },
  jamrufin:  { shape: "mech", main: "#c9a53a", sub: "#6a5410", accent: "#f0e0a0", trim: "#d9c04a" },
  geymalk:   { shape: "bulky", main: "#3a5a8a", sub: "#1f2f50", accent: "#8fb7ff", trim: "#6f8fbd" },
  palace:    { shape: "mech", main: "#8a6a9a", sub: "#4a3050", accent: "#e0c0e8", trim: "#b98fbd" },
  dom:       { shape: "mech", main: "#2a2a2e", sub: "#111114", accent: "#6a3a3a", trim: "#8a8a8e" },
  hygogg:    { shape: "bulky", main: "#3a8a8a", sub: "#1f4a4a", accent: "#a0e0e0", trim: "#6fbdbd" },
  gogge:     { shape: "bulky", main: "#4a8a5a", sub: "#24502c", accent: "#a0e0b3", trim: "#6fbd7e" },
  gyan:      { shape: "mech", main: "#e8eef8", sub: "#3b6fa8", accent: "#c9a53a", trim: "#e9c34a" },
  byarlant:  { shape: "mech", main: "#4a6a9a", sub: "#243a5a", accent: "#9fd0ff", trim: "#6f8fbd" },
  asshimar:  { shape: "bulky", main: "#5a7a4a", sub: "#2f4024", accent: "#c9d97a", trim: "#8fa06f" },
  bog:       { shape: "mech", main: "#3a5a7a", sub: "#1f3040", accent: "#8fb3d9", trim: "#6f8fa0" },
  zakrello:  { shape: "beast", main: "#6a5a4a", sub: "#352f24", accent: "#c9b09f", trim: "#8f7f6f" },
  sig:       { shape: "mech", main: "#5a7a3a", sub: "#2f4020", accent: "#c9d99f", trim: "#8fa06f" },
  zaku3:     { shape: "mech", main: "#5a7a4a", sub: "#2f4024", accent: "#a0b98f", trim: "#7f9c6e" },
  zaku3kai:  { shape: "mech", main: "#6a5a8a", sub: "#352f50", accent: "#c0b3e0", trim: "#8f7fbd" },
  redzaku:   { shape: "mech", main: "#c0392b", sub: "#7a1f1f", accent: "#f0a08a", trim: "#e9b34a" },
  elmes:     { shape: "beast", main: "#e8e2f0", sub: "#8a7aa8", accent: "#c9a53a", trim: "#e9c34a" },
  messala:   { shape: "bulky", main: "#8a8a9a", sub: "#4a4a5a", accent: "#c9c9d9", trim: "#9a9aad" },
  beguina:   { shape: "mech", main: "#e8c0d0", sub: "#a05a7a", accent: "#ffffff", trim: "#f0d0e0" },
  quin:      { shape: "boss", main: "#8f79c9", sub: "#4a3b6b", accent: "#e0c04a", trim: "#b9a6f0" },
  psyco:     { shape: "boss", main: "#c04040", sub: "#6a1f1f", accent: "#2a2a2e", trim: "#f0a08a" },
  psyco2:    { shape: "boss", main: "#7a3a8a", sub: "#3f1f4a", accent: "#e0c0e8", trim: "#b98fd0" },
  bigzam:    { shape: "boss", main: "#5a6a7a", sub: "#2f3a44", accent: "#c9a53a", trim: "#8fa0b3" },
  valshione: { shape: "boss", main: "#c9302c", sub: "#5a1010", accent: "#e9d34a", trim: "#f0a08a" },
  granzon:   { shape: "boss", main: "#2a2140", sub: "#120d1f", accent: "#8f79c9", trim: "#b9a6f0" },
  gio:       { shape: "boss", main: "#4a2a2a", sub: "#241212", accent: "#c9a53a", trim: "#8a5a5a" },
  alpha:     { shape: "boss", main: "#7a7a8a", sub: "#3a3a44", accent: "#c9d0e0", trim: "#9fa0b3" },
  rafflesia: { shape: "boss", main: "#4a7a5a", sub: "#24402c", accent: "#e0c04a", trim: "#8fb39f" },
  gigilgan:  { shape: "boss", main: "#8a6a3a", sub: "#4a3510", accent: "#e0c04a", trim: "#b98f5a" },
  gigil:     { shape: "beast", main: "#8a6a3a", sub: "#4a3510", accent: "#e0c04a", trim: "#b98f5a" },
  monster:   { shape: "beast", main: "#7a5a8a", sub: "#3f2a4a", accent: "#e0c0e8", trim: "#b98fbd" },
  kinggori:  { shape: "beast", main: "#5a4a3a", sub: "#2f2410", accent: "#c9b09f", trim: "#8f7f6f" },
  gushios:   { shape: "beast", main: "#6a8a7a", sub: "#2f4a3a", accent: "#c9e0d9", trim: "#8fb3a0" },
  brawler:   { shape: "bulky", main: "#8a5a3a", sub: "#4a2f10", accent: "#e0c04a", trim: "#b98f5a" },
  dablas:    { shape: "beast", main: "#5a6a4a", sub: "#2f3a24", accent: "#c9d99f", trim: "#8fa06f" },
  garada:    { shape: "beast", main: "#7a6a4a", sub: "#3f3524", accent: "#e0d09f", trim: "#b9a06f" },
  zen2:      { shape: "boss", main: "#4a3b6b", sub: "#2a2140", accent: "#8f79c9", trim: "#b9a6f0" },
  ghoul:     { shape: "beast", main: "#7a3a3a", sub: "#3f1f1f", accent: "#e0a08a", trim: "#b98f6f" },
  jalaga:    { shape: "mech", main: "#6a6a5a", sub: "#353524", accent: "#d9d9c0", trim: "#8f8f7a" },
  alsos:     { shape: "beast", main: "#5a7a8a", sub: "#2f404a", accent: "#c9e0e8", trim: "#8fa0b3" },
  minervaX:  { shape: "ship", main: "#8f79c9", sub: "#4a3b6b", accent: "#e0c04a", trim: "#b9a6f0" },
  lineX1:    { shape: "boss", main: "#4a4a5a", sub: "#242430", accent: "#c9a53a", trim: "#8a8a9a" },
  turret:    { shape: "turret", main: "#8a8a7a", sub: "#4a4a3a", accent: "#c9c0a0", trim: "#a0a090" },
  mirror:    { shape: "mirror", main: "#9fc9e8", sub: "#3a5a7a", accent: "#eef6ff", trim: "#bfe0f0" },
  missile:   { shape: "missile", main: "#c9c9c9", sub: "#6a6a6a", accent: "#e05a3a", trim: "#eef1f6" },
  bad:       { shape: "mech", main: "#5a6a3a", sub: "#2f3a1f", accent: "#c9d99f", trim: "#8fa06f" },
  zai:       { shape: "bulky", main: "#6a5a3a", sub: "#3a2f10", accent: "#e0c04a", trim: "#b98f5a" },
  tros:      { shape: "ship", main: "#7a6a5a", sub: "#3f3524", accent: "#c9a53a", trim: "#a08060" },
  bound:     { shape: "heavy", main: "#4a5a7a", sub: "#243040", accent: "#9fb3e0", trim: "#6f7fbd" }
};

// AI 补全的 HD 立绘（tools/sync_ai_sprites.py 生成）
for (const key of AI_HD) {
  if (SPRITES[key]) SPRITES[key].hd = true;
}

/** 战斗数值档位（1 级基准，按等级线性成长） */
export const ARCHETYPES = {
  heroReal:  { hp: 300, power: 60, armor: 45, speed: 80, move: 5, type: "land", sp: 60,
    weapons: [
      { name: "光束步枪", hit: 90,  range: 2, atk: 78, kind: "beam" },
      { name: "光束军刀", hit: 110, range: 1, atk: 68, kind: "melee" }
    ] },
  heroSuper: { hp: 380, power: 85, armor: 70, speed: 40, move: 4, type: "land", sp: 55,
    weapons: [
      { name: "火箭飞拳", hit: 95,  range: 1, atk: 62, kind: "melee" },
      { name: "光子力射线", hit: 90, range: 2, atk: 54, kind: "beam" },
      { name: "胸部火焰", hit: 100, range: 1, atk: 88, kind: "fire" }
    ] },
  heroAir:   { hp: 320, power: 72, armor: 55, speed: 58, move: 5, type: "air", sp: 60,
    weapons: [
      { name: "盖塔战斧", hit: 105, range: 1, atk: 66, kind: "melee" },
      { name: "盖塔射线", hit: 90,  range: 2, atk: 56, kind: "beam" }
    ] },
  support:   { hp: 280, power: 30, armor: 40, speed: 35, move: 4, type: "land", sp: 80,
    repair: { amount: 140, range: 1 },
    weapons: [{ name: "火箭飞拳", hit: 95, range: 1, atk: 28, kind: "melee" }] },
  battleship:{ hp: 620, power: 55, armor: 85, speed: 22, move: 3, type: "air", sp: 50, ship: true,
    repair: { amount: 100, range: 2 },
    weapons: [
      { name: "主炮", hit: 95,  range: 4, atk: 70, kind: "beam" },
      { name: "机炮", hit: 120, range: 1, atk: 16, kind: "gun" }
    ] },
  grunt:     { hp: 110, power: 26, armor: 22, speed: 30, move: 4, type: "land", sp: 0,
    weapons: [
      { name: "热能斧", hit: 100, range: 1, atk: 32, kind: "melee" },
      { name: "机枪",   hit: 85,  range: 2, atk: 26, kind: "gun" }
    ] },
  gruntFast: { hp: 100, power: 28, armor: 20, speed: 45, move: 5, type: "land", sp: 0,
    weapons: [
      { name: "光束刀", hit: 105, range: 1, atk: 36, kind: "beam" },
      { name: "导弹",   hit: 80,  range: 2, atk: 30, kind: "gun" }
    ] },
  elite:     { hp: 160, power: 40, armor: 34, speed: 48, move: 5, type: "land", sp: 0,
    weapons: [
      { name: "光束步枪", hit: 95,  range: 2, atk: 46, kind: "beam" },
      { name: "光束军刀", hit: 105, range: 1, atk: 48, kind: "melee" }
    ] },
  heavy:     { hp: 200, power: 46, armor: 48, speed: 28, move: 4, type: "land", sp: 0,
    weapons: [
      { name: "加农炮", hit: 90, range: 3, atk: 56, kind: "gun" },
      { name: "机枪",   hit: 85, range: 1, atk: 34, kind: "gun" }
    ] },
  boss:      { hp: 300, power: 70, armor: 52, speed: 55, move: 5, type: "land", sp: 0, boss: true,
    weapons: [
      { name: "扩散光束", hit: 100, range: 3, atk: 70, kind: "beam" },
      { name: "格斗",     hit: 110, range: 1, atk: 76, kind: "melee" }
    ] },
  bigBoss:   { hp: 500, power: 90, armor: 64, speed: 45, move: 4, type: "land", sp: 0, boss: true,
    weapons: [
      { name: "主炮", hit: 100, range: 4, atk: 84, kind: "beam" },
      { name: "格斗", hit: 110, range: 1, atk: 92, kind: "melee" }
    ] },
  titan:     { hp: 700, power: 110, armor: 72, speed: 40, move: 3, type: "land", sp: 0, boss: true,
    weapons: [
      { name: "地图兵器", hit: 100, range: 5, atk: 100, kind: "beam" },
      { name: "格斗",     hit: 110, range: 1, atk: 88, kind: "melee" }
    ] },
  turret:    { hp: 120, power: 40, armor: 30, speed: 0, move: 0, type: "land", sp: 0,
    weapons: [{ name: "固定炮", hit: 95, range: 4, atk: 44, kind: "gun" }] },
  mirror:    { hp: 200, power: 0, armor: 20, speed: 0, move: 0, type: "land", sp: 0,
    weapons: [{ name: "反射光", hit: 100, range: 3, atk: 24, kind: "beam" }] },
  missile:   { hp: 80, power: 35, armor: 15, speed: 90, move: 7, type: "air", sp: 0,
    weapons: [{ name: "弹头", hit: 90, range: 2, atk: 38, kind: "gun" }] },
  beast:     { hp: 140, power: 34, armor: 30, speed: 35, move: 4, type: "land", sp: 0,
    weapons: [
      { name: "格斗", hit: 100, range: 1, atk: 38, kind: "melee" },
      { name: "光弹", hit: 90,  range: 2, atk: 34, kind: "beam" }
    ] },
  enemyShip: { hp: 500, power: 60, armor: 70, speed: 25, move: 3, type: "air", sp: 0, ship: true,
    weapons: [
      { name: "舰炮", hit: 95, range: 4, atk: 70, kind: "beam" },
      { name: "机炮", hit: 110, range: 1, atk: 20, kind: "gun" }
    ] }
};

/** 精神指令按定位分配 */
const SPIRIT_SETS = {
  heroReal: ["guts", "drive", "critical", "swift", "dodge", "hotblood"],
  heroSuper: ["guts", "guard", "critical", "potential", "hotblood"],
  heroAir: ["guts", "friend", "drive", "potential", "hotblood", "support"],
  support: ["guts", "friend", "bond", "support", "pray", "love"],
  battleship: ["guts", "guard", "anger", "rage"]
};
export { SPIRIT_SETS };

/**
 * 机体表：key = 日文原名（规范化后）。
 * name=中文名；sprite=立绘 key；arch=数值档；type 可覆盖移动类型。
 */
export const UNIT_DB = {
  /* ---------------- 我方（按作品） ---------------- */
  "ガンダム": { name: "高达", sprite: "gundam", arch: "heroReal", pilot: "阿姆罗" },
  "Ｚガンダム": { name: "Z高达", sprite: "zeta", arch: "heroReal", pilot: "卡缪" },
  "νガンダム": { name: "ν高达", sprite: "nu", arch: "heroReal", pilot: "阿姆罗" },
  "ＺＺガンダム": { name: "ZZ高达", sprite: "zz", arch: "heroReal", pilot: "捷多" },
  "F-91": { name: "F91", sprite: "f91", arch: "heroReal", pilot: "西布克" },
  "メタス": { name: "米塔斯", sprite: "metz", arch: "support", pilot: "由美" },
  "アフロダイＡ": { name: "阿芙罗迪A", sprite: "aphrodite", arch: "support", pilot: "爱美神" },
  "マジンガーＺ": { name: "魔神Z", sprite: "mazinger", arch: "heroSuper", pilot: "甲儿" },
  "グレートマジンガー": { name: "大魔神", sprite: "great", arch: "heroSuper", pilot: "铁也" },
  "グレンダイザー": { name: "古连泰沙", sprite: "grendizer", arch: "heroSuper", pilot: "大介" },
  "ダイ": { name: "戴莫斯", sprite: "daitarn", arch: "heroSuper", pilot: "一矢" },
  "ゲッター１": { name: "盖塔1", sprite: "getter", arch: "heroAir", pilot: "龙马" },
  "ゲッターロボＧ": { name: "盖塔G", sprite: "getterg", arch: "heroAir", pilot: "龙马" },
  "ゲッターＱ": { name: "盖塔Q", sprite: "getterq", arch: "beast", pilot: "沙也加" },
  "テキサスマック": { name: "德州麦克", sprite: "texas", arch: "heroReal", pilot: "杰克" },
  "ホワイトベース": { name: "白色要塞", sprite: "whitebase", arch: "battleship", pilot: "乔" },
  "アーガマ": { name: "亚加玛", sprite: "argama", arch: "battleship", pilot: "乔" },
  "ネェル・アーガマ": { name: "拟·亚加玛", sprite: "neelagama", arch: "battleship", pilot: "乔" },
  "ラー・カイラム": { name: "拉·凯拉姆", sprite: "racalium", arch: "battleship", pilot: "乔" },
  "ミデア": { name: "米迪亚", sprite: "midia", arch: "enemyShip", pilot: "玛蒂尔达" },
  "ボスボロット": { name: "波士机器人", sprite: "bosses", arch: "heroSuper", pilot: "波士" },
  "サイバスター": { name: "塞巴斯塔", sprite: "cybuster", arch: "heroReal", pilot: "正树" },
  "ミネルバＸ": { name: "密涅瓦X", sprite: "minervaX", arch: "heroSuper", pilot: "密涅瓦X" },
  "ギャン": { name: "强人", sprite: "gyan", arch: "elite", pilot: "马·库贝" },

  /* ---------------- 吉翁 / 提坦斯 / 新吉翁 ---------------- */
  "ザク": { name: "扎古Ⅱ", sprite: "zaku", arch: "grunt", pilot: "DC 士兵" },
  "赤ザク": { name: "红色扎古", sprite: "redzaku", arch: "elite", pilot: "夏亚" },
  "ザクⅢ": { name: "扎古Ⅲ", sprite: "zaku3", arch: "grunt" },
  "ザクⅢ改": { name: "扎古Ⅲ改", sprite: "zaku3kai", arch: "elite" },
  "ドライセン": { name: "德莱森", sprite: "dreissen", arch: "heavy" },
  "バウ": { name: "巴乌", sprite: "bau", arch: "gruntFast" },
  "マラサイ": { name: "马拉赛", sprite: "marasai", arch: "grunt" },
  "ガザＣ": { name: "加撒C", sprite: "gazaC", arch: "grunt" },
  "ギラ・ドーガ": { name: "基拉·德卡", sprite: "giradoga", arch: "grunt" },
  "ズサ": { name: "兹萨", sprite: "zusa", arch: "gruntFast" },
  "ヤクト・ドーガ": { name: "亚克托·德卡", sprite: "yact", arch: "elite" },
  "ドーベンウルフ": { name: "多本·沃尔夫", sprite: "doven", arch: "heavy" },
  "ハンブラビ": { name: "汉布拉比", sprite: "hambrabi", arch: "elite" },
  "ジャムルフィン": { name: "贾姆鲁芬", sprite: "jamrufin", arch: "gruntFast" },
  "ゲーマルク": { name: "盖马尔克", sprite: "geymalk", arch: "elite",
    weapons: [{ name: "扩散光束", hit: 95, range: 9, atk: 42, kind: "beam" }] },
  "パラス・アテネ": { name: "帕拉斯·雅典娜", sprite: "palace", arch: "heavy" },
  "ドム": { name: "德姆", sprite: "dom", arch: "grunt" },
  "ハイゴッグ": { name: "高战蟹", sprite: "hygogg", arch: "heavy" },
  "ズゴックＥ": { name: "兹高克E", sprite: "gogge", arch: "grunt" },
  "グフ": { name: "古夫", sprite: "gyan", arch: "grunt" },
  "バイアラン": { name: "拜亚兰", sprite: "byarlant", arch: "elite" },
  "アッシマー": { name: "阿西玛", sprite: "asshimar", arch: "elite" },
  "ボング": { name: "邦格", sprite: "bog", arch: "grunt" },
  "ザクレロ": { name: "扎古雷罗", sprite: "zakrello", arch: "grunt" },
  "シグ": { name: "希格", sprite: "sig", arch: "elite", pilot: "拉德拉舰长" },
  "エルメス": { name: "艾尔美斯", sprite: "elmes", arch: "beast", pilot: "拉拉" },
  "メッサーラ": { name: "梅萨拉", sprite: "messala", arch: "elite" },
  "ビギナ・ギナ": { name: "比基纳·基纳", sprite: "beguina", arch: "elite", pilot: "塞西莉" },
  "キュベレイ": { name: "卡碧尼", sprite: "quin", arch: "boss", pilot: "哈曼" },
  "キュベレイmkⅡ": { name: "卡碧尼MkⅡ", sprite: "quin", arch: "boss", pilot: "普露" },
  "サイコガンダム": { name: "精神感应高达", sprite: "psyco", arch: "boss", pilot: "凤" },
  "サイコガンダムmkⅡ": { name: "精神感应高达MkⅡ", sprite: "psyco2", arch: "boss" },
  "クインマンサ": { name: "昆曼沙", sprite: "quin", arch: "bigBoss", pilot: "普露茨" },
  "ビグザム": { name: "比格扎姆", sprite: "bigzam", arch: "bigBoss", pilot: "德兹尔" },
  "ジ・オ": { name: "铁奥", sprite: "gio", arch: "bigBoss", pilot: "西洛克" },
  "α・アジール": { name: "α·阿吉尔", sprite: "alpha", arch: "bigBoss" },
  "ラフレシア": { name: "拉芙蕾西亚", sprite: "rafflesia", arch: "titan" },
  "ヴァルシオン": { name: "瓦尔西昂", sprite: "valshione", arch: "titan", boss: true },
  "グランゾン": { name: "古兰森", sprite: "granzon", arch: "titan", boss: true },
  "ラインＸ１": { name: "莱茵X1", sprite: "lineX1", arch: "bigBoss", pilot: "罗蕾莱" },

  /* ---------------- DC 机械兽 / 要塞 ---------------- */
  "ギルギル": { name: "基尔基尔", sprite: "gigil", arch: "beast" },
  "ギルギルガン": { name: "基尔基尔甘", sprite: "gigilgan", arch: "bigBoss", boss: true },
  "ジェノバＭ９": { name: "杰诺巴M9", sprite: "monster", arch: "elite",
    weapons: [{ name: "步枪", hit: 90, range: 7, atk: 38, kind: "gun" }] },
  "ブラッガーＳ１": { name: "布拉格S1", sprite: "brawler", arch: "heavy" },
  "グシオスβⅢ": { name: "古西奥斯βⅢ", sprite: "gushios", arch: "beast" },
  "キングゴリ": { name: "金刚猩猩", sprite: "kinggori", arch: "beast" },
  "メカ雷獣鬼": { name: "机械雷兽鬼", sprite: "monster", arch: "beast" },
  "メカ胡蝶鬼": { name: "机械胡蝶鬼", sprite: "monster", arch: "beast", pilot: "胡蝶" },
  "ダブラスＭ２": { name: "达布拉斯M2", sprite: "dablas", arch: "beast" },
  "ガラダＫ７": { name: "加拉达K7", sprite: "garada", arch: "beast" },
  "ゼンⅡ": { name: "宰恩Ⅱ", sprite: "zen2", arch: "boss" },
  "グール": { name: "古尔", sprite: "ghoul", arch: "beast", pilot: "阿修罗男爵" },
  "ジャラガ": { name: "贾拉加", sprite: "jalaga", arch: "grunt" },
  "アルソス": { name: "阿尔索斯", sprite: "alsos", arch: "beast" },
  "固定砲台": { name: "固定炮台", sprite: "turret", arch: "turret" },
  "発電ミラー": { name: "发电镜", sprite: "mirror", arch: "mirror" },
  "誘導ミサイル": { name: "诱导导弹", sprite: "missile", arch: "missile" },
  "バド": { name: "巴德", sprite: "bad", arch: "grunt" },
  "ザイ": { name: "扎伊", sprite: "zai", arch: "elite", ability: "防御態勢" },
  "トロスＤ７": { name: "特罗斯D7", sprite: "tros", arch: "enemyShip" },
  "バウンド・ドック": { name: "巴恩德克", sprite: "bound", arch: "heavy" }
};

/** 英文名（i18n 用；缺失时回退中文名） */
export const UNIT_EN = {
  "ガンダム": "Gundam", "Ｚガンダム": "Z Gundam", "νガンダム": "ν Gundam",
  "ＺＺガンダム": "ZZ Gundam", "F-91": "F91", "メタス": "Methuss",
  "アフロダイＡ": "Aphrodite A", "マジンガーＺ": "Mazinger Z",
  "グレートマジンガー": "Great Mazinger", "グレンダイザー": "Grendizer",
  "ダイ": "Daimos", "ゲッター１": "Getter-1", "ゲッターロボＧ": "Getter Robo G",
  "ゲッターＱ": "Getter Q", "テキサスマック": "Texas Mack",
  "ホワイトベース": "White Base", "アーガマ": "Argama",
  "ネェル・アーガマ": "Nahel Argama", "ラー・カイラム": "Ra Cailum",
  "ミデア": "Medea", "ボスボロット": "Boss Borot", "サイバスター": "Cybuster",
  "ミネルバＸ": "Minerva X", "ギャン": "Gyan",
  "ザク": "Zaku II", "赤ザク": "Red Zaku", "ザクⅢ": "Zaku III",
  "ザクⅢ改": "Zaku III Custom", "ドライセン": "Dreissen", "バウ": "Bawoo",
  "マラサイ": "Marasai", "ガザＣ": "Gaza C", "ギラ・ドーガ": "Geara Doga",
  "ズサ": "Zssa", "ヤクト・ドーガ": "Jagd Doga", "ドーベンウルフ": "Doven Wolf",
  "ハンブラビ": "Hambrabi", "ジャムルフィン": "Jamru Fin", "ゲーマルク": "Geymalk",
  "パラス・アテネ": "Palace Athene", "ドム": "Dom", "ハイゴッグ": "Hygogg",
  "ズゴックＥ": "Z'Gok E", "グフ": "Gouf", "バイアラン": "Byarlant",
  "アッシマー": "Asshimar", "ボング": "Bong", "ザクレロ": "Zakrello",
  "シグ": "Zig", "エルメス": "Elmeth", "メッサーラ": "Messala",
  "ビギナ・ギナ": "Begina Gina", "キュベレイ": "Qubeley",
  "キュベレイmkⅡ": "Qubeley Mk-II", "サイコガンダム": "Psycho Gundam",
  "サイコガンダムmkⅡ": "Psycho Gundam Mk-II", "クインマンサ": "Quin Mantha",
  "ビグザム": "Big Zam", "ジ・オ": "The-O", "α・アジール": "Alpha Azieru",
  "ラフレシア": "Rafflesia", "ヴァルシオン": "Valsione", "グランゾン": "Granzon",
  "ラインＸ１": "Line X1", "ギルギル": "Girgil", "ギルギルガン": "Girgilgan",
  "ジェノバＭ９": "Genob M9", "ブラッガーＳ１": "Bragger S1",
  "グシオスβⅢ": "Gushios βIII", "キングゴリ": "King Gori",
  "メカ雷獣鬼": "Mecha Raijuuki", "メカ胡蝶鬼": "Mecha Kochouki",
  "ダブラスＭ２": "Dablas M2", "ガラダＫ７": "Garada K7", "ゼンⅡ": "Zen II",
  "グール": "Ghoul", "ジャラガ": "Jalaga", "アルソス": "Alsos",
  "固定砲台": "Fixed Turret", "発電ミラー": "Solar Mirror",
  "誘導ミサイル": "Guided Missile", "バド": "Bado", "ザイ": "Zai",
  "トロスＤ７": "Tros D7", "バウンド・ドック": "Bound Doc"
};

/** 中文名 / 别名 → 日文原名 */
export const UNIT_ALIASES = (() => {
  const map = {};
  for (const [jp, def] of Object.entries(UNIT_DB)) {
    map[jp] = jp;
    if (def.name) map[def.name] = jp;
    if (def.sprite) map[def.sprite] = jp;
  }
  return map;
})();

/** 取显示名（日文原名 / 中文名 / 英文名） */
export function unitName(key, lang = "zh") {
  const def = UNIT_DB[key];
  if (!def) return key;
  if (lang === "en") return UNIT_EN[key] || def.name || key;
  return def.name || key;
}

/** 立绘形状（矢量绘制时用） */
export function spriteShape(sprite) {
  return (SPRITES[sprite] && SPRITES[sprite].shape) || "mech";
}

/** 把任意名字/别名解析成 { key, def } */
export function resolveUnit(name) {
  if (!name) return null;
  const raw = String(name).replace(/\s+/g, "").replace(/（.*?）/g, "").replace(/\(.*?\)/g, "");
  const key = UNIT_ALIASES[raw] || UNIT_ALIASES[name] || (UNIT_DB[raw] ? raw : null);
  if (!key) return null;
  return { key, def: UNIT_DB[key] };
}
