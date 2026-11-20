// ENDLESS ORB · 环间升级定义（每清一环 3 选 1，本局内生效，构建重玩钩子 newBuild）。
// kind: rule（改规则）| stat（改数值）。规则型占比 ≥35% 由 design.json 对齐。

export const UPGRADES = [
  {
    id: 'shield',
    kind: 'rule',
    key: 'up.shield',
    desc: '每环首次碰撞被抵消（一次免死）',
  },
  {
    id: 'polarityResist',
    kind: 'rule',
    key: 'up.polarityResist',
    desc: '极性反转不再吸入光子，只换向',
  },
  {
    id: 'heavyBonus',
    kind: 'rule',
    key: 'up.heavyBonus',
    desc: '重光子计入 3 钉进度',
  },
  {
    id: 'ghostSlot',
    kind: 'rule',
    key: 'up.ghostSlot',
    desc: '擦肩不判负且 +分（每 2.5s 最多一次）',
  },
  {
    id: 'comboBank',
    kind: 'rule',
    key: 'up.comboBank',
    desc: '连续 clean 钉叠加 combo 分',
  },
  {
    id: 'grace',
    kind: 'rule',
    key: 'up.grace',
    desc: '每环开局 2.5 秒内碰撞不判负',
  },
  {
    id: 'biggerCore',
    kind: 'rule',
    key: 'up.biggerCore',
    desc: '能量核半径 +8%，落点更宽容',
  },
  {
    id: 'slowCore',
    kind: 'stat',
    key: 'up.slowCore',
    desc: '核转速 -12%',
  },
  {
    id: 'pinSpeed',
    kind: 'stat',
    key: 'up.pinSpeed',
    desc: '光子飞行速度 +18%（更快出手）',
  },
  {
    id: 'resonance',
    kind: 'stat',
    key: 'up.resonance',
    desc: '每钉得分 +30%',
  },
];

export const UPGRADES_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export function pickUpgradeOptions(rng, takenIds = []) {
  const pool = UPGRADES.filter((u) => !takenIds.includes(u.id));
  const out = [];
  const p = [...pool];
  while (out.length < 3 && p.length) {
    const i = Math.floor(rng() * p.length);
    out.push(p.splice(i, 1)[0]);
  }
  return out;
}
