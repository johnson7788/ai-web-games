// STAR SLAYER · 技能卡牌（波间三选一）
// kind: rule = 改规则；stat = 纯数值。rule 占比 ≥35%（fun-audit 硬校验）。
// 每张卡带 apply(run) 应用一次；id 唯一；descKey 指向 i18n。

export const CARDS = [
  { id: 'twinCore', kind: 'rule', descKey: 'card.twinCore',
    apply(run) { run.cards.twinCore = true; } },
  { id: 'echoStrike', kind: 'rule', descKey: 'card.echoStrike',
    apply(run) { run.cards.echoStrike = true; } },
  { id: 'overloadSpike', kind: 'rule', descKey: 'card.overloadSpike',
    apply(run) { run.cards.overloadSpike = true; } },
  { id: 'coldCore', kind: 'rule', descKey: 'card.coldCore',
    apply(run) { run.cards.coldCore = true; } },
  { id: 'pierce', kind: 'rule', descKey: 'card.pierce',
    apply(run) { run.cards.pierce = true; } },
  { id: 'ricochet', kind: 'rule', descKey: 'card.ricochet',
    apply(run) { run.cards.ricochet = true; } },
  { id: 'armorRegen', kind: 'rule', descKey: 'card.armorRegen',
    apply(run) { run.cards.armorRegen = true; } },
  { id: 'killHeal', kind: 'rule', descKey: 'card.killHeal',
    apply(run) { run.cards.killHeal = true; } },
  { id: 'rapidFire', kind: 'stat', descKey: 'card.rapidFire',
    apply(run) { run.mods.fireIntervalMul *= 0.82; } },
  { id: 'bigMag', kind: 'stat', descKey: 'card.bigMag',
    apply(run) { run.mods.dmgMul *= 1.3; } },
  { id: 'movespeed', kind: 'stat', descKey: 'card.movespeed',
    apply(run) { run.mods.speedMul *= 1.16; } },
  { id: 'bulk', kind: 'stat', descKey: 'card.bulk',
    apply(run) {
      run.player.maxHp += 25;
      run.player.hp = Math.min(run.player.maxHp, run.player.hp + 25);
    } },
];

export const CARD_IDS = CARDS.map((c) => c.id);

export function cardById(id) {
  return CARDS.find((c) => c.id === id) || null;
}

// 波间三选一：从「尚未持有」的卡里取 3 张；不足 3 张时允许重复（转成数值补偿）。
export function drawChoices(run, rng) {
  const pool = CARDS.filter((c) => !(run.cards[c.id]));
  const picks = [];
  const copy = pool.length ? pool.slice() : CARDS.slice();
  while (picks.length < 3 && copy.length) {
    const idx = Math.floor(rng() * copy.length);
    picks.push(copy.splice(idx, 1)[0]);
  }
  return picks;
}
