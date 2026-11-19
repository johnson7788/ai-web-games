// 游戏静态数据：12 个街区、对手（敌人）、部门（装备）、扩张令（升级芯片）、品级。
// 主题：霓虹商战（原创换皮），数值骨架取自「天天挂机」玩法规则（P0 1:1）。
// 版权红线：本文件全部文本/名字为原创，不含参考源码任何美术/音频/原文。

export const MAX_LV = 60;

// 品级：0 普通 / 1 优质 / 2 卓越 / 3 传奇
export const GRADES = [
  { key: 'gradeCommon', color: '#cbd5e1' },
  { key: 'gradeRare', color: '#4ade80' },
  { key: 'gradeEpic', color: '#f472b6' },
  { key: 'gradeLegend', color: '#f87171' },
];

// 部门槽（对应装备部位）：市场/法务/公关/品牌/人脉/物流
export const SLOTS = [
  { id: 0, key: 'deptMarketing', att: 1.0 },
  { id: 1, key: 'deptLegal', def: 1.0, hp: 1.0 },
  { id: 2, key: 'deptPr', def: 1.0 },
  { id: 3, key: 'deptBrand', def: 1.0 },
  { id: 4, key: 'deptNetwork', att: 1.0 },
  { id: 5, key: 'deptLogistics', att: 1.0 },
];

// 12 个霓虹街区。unlockLv = 进入所需等级（idx*5）。
export const DISTRICTS = [
  { key: '夜市地摊', en: 'Night Market', unlockLv: 0 },
  { key: '商业步行街', en: 'Pedestrian Mall', unlockLv: 5 },
  { key: '科技园区', en: 'Tech Park', unlockLv: 10 },
  { key: '金融中心', en: 'Financial Core', unlockLv: 15 },
  { key: '港口码头', en: 'Harbor Docks', unlockLv: 20 },
  { key: '会展中心', en: 'Expo Center', unlockLv: 25 },
  { key: '古城商圈', en: 'Old Town', unlockLv: 30 },
  { key: '航天基地', en: 'Aerospace Base', unlockLv: 35 },
  { key: '影视城', en: 'Film City', unlockLv: 40 },
  { key: '地下城', en: 'The Undercity', unlockLv: 45 },
  { key: '数据中心', en: 'Data Nexus', unlockLv: 50 },
  { key: '龙脊峰', en: 'Dragon Ridge', unlockLv: 55 },
];

// 对手命名池（按街区替换的前缀 + 类型后缀），生成 4 普通 + 1 Boss。
const RIVAL_PREFIX = ['Nova', 'Hyper', 'Qbit', 'Apex', 'Zenith', 'Orbit', 'Pulse', 'Vertex', 'Neon', 'Prime'];
const RIVAL_TYPE = ['Retail', 'Media', 'Fin', 'Cloud', 'Energy', 'Bio', 'Games', 'Mobi', 'Aero', 'Data'];

// 生成某个街区第 slot 个对手（slot 4 = Boss）。数值随街区指数温和成长，保持「挂机碾压 + Boss 略硬」手感。
export function makeRival(districtIdx, slot, rng) {
  const boss = slot === 4;
  const lv = districtIdx * 5 + slot + 1;
  const base = boss
    ? { att: 10 + districtIdx * 4, def: 6 + districtIdx * 3, hp: 150 + districtIdx * 80 }
    : { att: 5 + districtIdx * 3 + slot, def: 2 + districtIdx * 2 + Math.floor(slot / 2), hp: 40 + districtIdx * 25 };
  const name = boss
    ? `${RIVAL_PREFIX[(districtIdx + slot) % RIVAL_PREFIX.length]} Group`
    : `${RIVAL_PREFIX[(districtIdx + slot) % RIVAL_PREFIX.length]} ${RIVAL_TYPE[(districtIdx * 3 + slot) % RIVAL_TYPE.length]}`;
  return {
    id: districtIdx * 10 + slot,
    name,
    lv,
    boss,
    att: base.att,
    def: base.def,
    hp: base.hp,
    maxHp: base.hp,
  };
}

// 部门物品：id / 名称 / 部位 / 品级 / 等级 / 效果 / 售价
export function makeDeptItem(slot, grade, lv) {
  const s = SLOTS[slot];
  const att = s.att ? Math.round((20 + grade * 55) * Math.pow(1.18, lv - 1) * s.att) : 0;
  const def = s.def ? Math.round((10 + grade * 28) * Math.pow(1.16, lv - 1) * s.def) : 0;
  const hp = s.hp ? Math.round((100 + grade * 120) * Math.pow(1.2, lv - 1)) : 0;
  return {
    id: `dept-${slot}-${grade}-${lv}`,
    type: 'dept',
    slot,
    grade,
    lv,
    att,
    def,
    hp,
    sell: (1000 + grade * 2000) * lv,
  };
}

// 新手六件套（品级 0，lv1）
export function starterDepts() {
  return SLOTS.map((s, slot) => makeDeptItem(slot, 0, 1));
}

// 扩张令（升级芯片）：直接用等级提升。
export const CHIP = { id: 'chip', type: 'chip', name: 'expansionChip', effect: { lv: 1 } };

// 升级所需现金（二次曲线，现金是补充路径，扩张令是主力）。
export function levelUpCost(lv) {
  if (lv >= MAX_LV) return Infinity;
  return 120 * lv * lv;
}

// 垄断等级（诅咒→垄断度，金币沉没），每 10 星升 1 级，等级越高「一刀斩」概率越高。
export const MONOPOLY_COST = [500, 1200, 3000, 7000, 15000, 30000, 0];
export function monopolyCutRate(lv) { return Math.min(40, lv * 6); }

// 总部摩天楼（翅膀→总部，羽毛→蓝图），幸运值进阶。
export const HQ_INFO = [
  { lv: 1, name: '街角铺面', en: 'Corner Shop', consume: 5, maxLucky: 300 },
  { lv: 2, name: '霓虹小楼', en: 'Neon Loft', consume: 8, maxLucky: 500 },
  { lv: 3, name: '玻璃塔', en: 'Glass Tower', consume: 12, maxLucky: 800 },
  { lv: 4, name: '双子星', en: 'Twin Spires', consume: 18, maxLucky: 1200 },
  { lv: 5, name: '天际线', en: 'Skyline', consume: 25, maxLucky: 1800 },
  { lv: 6, name: '帝国之巅', en: 'Empire Peak', consume: 0, maxLucky: 0 },
];
export const HQ_MAX = 6;

// IPO 抽奖（转盘→融资轮）：消耗晶核。奖池随等级档位变化。
export function ipoRewards(lv) {
  const stage = Math.min(5, Math.floor(lv / 10));
  return [
    { kind: 'chip', count: 1 + stage, weight: 400 },
    { kind: 'chip', count: 3 + stage, weight: 200 },
    { kind: 'cash', count: 5000 * Math.pow(2, stage), weight: 200 },
    { kind: 'blueprint', count: (stage + 1) * 2, weight: 100 },
    { kind: 'dept', count: 1, weight: 100 },
  ];
}
export const IPO_COST = { one: 100, ten: 900 };
