// config/gameplay.js — 玩法数值（纯配置 + 少量 apply 函数，逻辑层不写死数字）
// 英雄 / 敌人 / 阵位 / 粮草 / 战斗（速度条+技能CD）/ 远征军势 / 升级 / 事件。

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------- 阵位（前/中/后三列影响承伤与输出） ----------
export const ROWS = [
  { key: 'form.front', dmgDealt: 1.0, dmgTaken: 1.0, aggro: 1.0 },
  { key: 'form.mid',  dmgDealt: 1.1, dmgTaken: 0.85, aggro: 0.7 },
  { key: 'form.back', dmgDealt: 0.9, dmgTaken: 0.6,  aggro: 0.3 },
];

// ---------- 粮草 ----------
export const SUPPLY = {
  start: 8,
  moveCost: 2,
  battleGain: 5,
  eliteGain: 7,
  bossGain: 20,
  restGain: 1,
  starvingDefMult: 0.9, // 断粮时英雄攻防 -10%
};

// ---------- 战斗（速度条 + 技能 CD） ----------
export const BATTLE = {
  turnBase: 100,        // 速度条满值：nextAt = time + turnBase / speed
  chargePerAction: 8,   // 英雄每次行动积攒「远征军势」
  chargePerSkill: 12,
  chargePerNode: 4,     // 每走一节点也积攒
  chargePerDown: 10,    // 英雄倒下积攒
  signatureMax: 100,
  signaturePower: 1.4,  // 合击 = 三英雄攻击和 × 系数，无视部分防御
  reviveRatio: 0.4,     // 战后倒地英雄恢复到 40% 上限
  defFactor: 0.5,       // 伤害公式：dmg = max(1, atk*mult - def*defFactor)
};

// ---------- 英雄（三英雄：先锋 / 游侠 / 先知） ----------
// rowPref：默认阵位（前/中/后）。skill.power 为技能系数。
export const HEROES = {
  vanguard: {
    id: 'vanguard', nameKey: 'hero.vanguard', cls: 'tank',
    hp: 130, atk: 12, def: 8, speed: 60, rowPref: 0, color: '#e8b04b',
    skills: [
      { id: 'guard',  nameKey: 'skill.guard',  cd: 3, kind: 'guard', power: 0.5, descKey: 'skill.guard.desc' },
      { id: 'cleave', nameKey: 'skill.cleave', cd: 4, kind: 'aoe',   power: 0.8, descKey: 'skill.cleave.desc' },
    ],
  },
  ranger: {
    id: 'ranger', nameKey: 'hero.ranger', cls: 'dps',
    hp: 85, atk: 16, def: 4, speed: 100, rowPref: 1, color: '#5fd0a0',
    skills: [
      { id: 'volley', nameKey: 'skill.volley', cd: 2, kind: 'multi', power: 0.9, descKey: 'skill.volley.desc' },
      { id: 'mark',   nameKey: 'skill.mark',   cd: 4, kind: 'mark',  power: 1.6, descKey: 'skill.mark.desc' },
    ],
  },
  seer: {
    id: 'seer', nameKey: 'hero.seer', cls: 'heal',
    hp: 70, atk: 9, def: 3, speed: 90, rowPref: 2, color: '#7fb8ff',
    skills: [
      { id: 'heal',  nameKey: 'skill.heal',  cd: 3, kind: 'heal', power: 1.6, descKey: 'skill.heal.desc' },
      { id: 'bless', nameKey: 'skill.bless', cd: 4, kind: 'buff', power: 0.25, descKey: 'skill.bless.desc' },
    ],
  },
};
export const HERO_IDS = ['vanguard', 'ranger', 'seer'];

// ---------- 敌人（按章缩放；group 见 config/levels.js） ----------
export const ENEMIES = {
  grunt:  { id: 'grunt',  nameKey: 'enemy.grunt',  hp: 60, atk: 10, def: 3, speed: 70, row: 0, color: '#e06b4f' },
  archer: { id: 'archer', nameKey: 'enemy.archer', hp: 45, atk: 11, def: 2, speed: 95, row: 1, color: '#e0a04f' },
  brute:  { id: 'brute',  nameKey: 'enemy.brute',  hp: 115, atk: 14, def: 6, speed: 55, row: 0, color: '#c14f5e' },
  shaman: { id: 'shaman', nameKey: 'enemy.shaman', hp: 55, atk: 12, def: 3, speed: 85, row: 2, color: '#a06be0' },
  boss:   { id: 'boss',   nameKey: 'enemy.boss',   hp: 260, atk: 16, def: 7, speed: 62, row: 0, color: '#8b2f3f', heavy: true },
};

// 章节难度缩放（乘到敌人 hp/atk）
export const CHAPTER_DIFF = {
  1: { hp: 1.0, atk: 1.0 },
  2: { hp: 1.35, atk: 1.15 },
  3: { hp: 1.8, atk: 1.3 },
};

// ---------- 事件（随机节点：两个选择，各有代价） ----------
export const EVENTS = [
  {
    id: 'cache', textKey: 'evt.cache',
    choices: [
      { textKey: 'evt.cache.a', effect: { supplies: 4 } },
      { textKey: 'evt.cache.b', effect: {} },
    ],
  },
  {
    id: 'scout', textKey: 'evt.scout',
    choices: [
      { textKey: 'evt.scout.a', effect: { supplies: -2, signature: 18 } },
      { textKey: 'evt.scout.b', effect: {} },
    ],
  },
  {
    id: 'spring', textKey: 'evt.spring',
    choices: [
      { textKey: 'evt.spring.a', effect: { healPct: 0.35 } },
      { textKey: 'evt.spring.b', effect: { supplies: 2 } },
    ],
  },
  {
    id: 'relic', textKey: 'evt.relic',
    choices: [
      { textKey: 'evt.relic.a', effect: { supplies: -3, healPct: 0.5 } },
      { textKey: 'evt.relic.b', effect: { signature: 30 } },
    ],
  },
];

// ---------- 升级（≥8；规则型占比 ≥35%） ----------
export const UPGRADES = {
  vanguardBulwark: { id: 'vanguardBulwark', kind: 'rule', nameKey: 'up.vanguardBulwark', descKey: 'up.vanguardBulwark.desc',
    apply: (run) => { run.mods.frontDmgTaken *= 0.7; } },
  backlineAegis: { id: 'backlineAegis', kind: 'rule', nameKey: 'up.backlineAegis', descKey: 'up.backlineAegis.desc',
    apply: (run) => { run.mods.backDmgTaken *= 0.7; } },
  rangerRapid: { id: 'rangerRapid', kind: 'rule', nameKey: 'up.rangerRapid', descKey: 'up.rangerRapid.desc',
    apply: (run) => { run.mods.volleyAll = true; } },
  seerOverflow: { id: 'seerOverflow', kind: 'rule', nameKey: 'up.seerOverflow', descKey: 'up.seerOverflow.desc',
    apply: (run) => { run.mods.healShield = true; } },
  signatureFervor: { id: 'signatureFervor', kind: 'rule', nameKey: 'up.signatureFervor', descKey: 'up.signatureFervor.desc',
    apply: (run) => { run.mods.sigChargeMult *= 1.25; } },
  supplyRaider: { id: 'supplyRaider', kind: 'rule', nameKey: 'up.supplyRaider', descKey: 'up.supplyRaider.desc',
    apply: (run) => { run.mods.supplyGainBonus += 2; } },
  starvingVigor: { id: 'starvingVigor', kind: 'rule', nameKey: 'up.starvingVigor', descKey: 'up.starvingVigor.desc',
    apply: (run) => { run.mods.starvingImmune = true; } },
  firstStrike: { id: 'firstStrike', kind: 'rule', nameKey: 'up.firstStrike', descKey: 'up.firstStrike.desc',
    apply: (run) => { run.mods.firstActionMult = 1.4; } },
  vanguardAtk: { id: 'vanguardAtk', kind: 'stat', nameKey: 'up.vanguardAtk', descKey: 'up.vanguardAtk.desc',
    apply: (run) => { for (const h of run.heroes) h.atk += 5; } },
  vanguardHp: { id: 'vanguardHp', kind: 'stat', nameKey: 'up.vanguardHp', descKey: 'up.vanguardHp.desc',
    apply: (run) => { for (const h of run.heroes) { h.maxHp += 20; h.hp += 20; } } },
  seerSpeed: { id: 'seerSpeed', kind: 'stat', nameKey: 'up.seerSpeed', descKey: 'up.seerSpeed.desc',
    apply: (run) => { for (const h of run.heroes) h.speed += 15; } },
  rangerAtk: { id: 'rangerAtk', kind: 'stat', nameKey: 'up.rangerAtk', descKey: 'up.rangerAtk.desc',
    apply: (run) => { const r = run.heroes.find((h) => h.id === 'ranger'); if (r) r.atk += 4; } },
};

// 每次升级三选一（随机抽取 3 个不同的）
export function rollUpgrades(rng) {
  const pool = Object.values(UPGRADES);
  const ids = [];
  const copy = [...pool];
  while (ids.length < 3 && copy.length) {
    const i = Math.floor(rng() * copy.length);
    const u = copy.splice(i, 1)[0];
    ids.push(u.id);
  }
  return ids;
}
