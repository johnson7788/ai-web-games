// 班间升级：8 个，5 个 rule / 3 个 stat。
// rule = 改变规则或提供新能力；stat = 数值增强。
export const UPGRADES = [
  {
    id: 'quick-hands',
    kind: 'rule',
    icon: '⚡',
    name: { en: 'Quick Hands', zh: '快手' },
    desc: { en: 'Every scanned item adds +5 score. Rewards clean scanning.', zh: '每扫一件商品 +5 分，扫得干净就有额外收入。' },
  },
  {
    id: 'generous-tips',
    kind: 'stat',
    icon: '💛',
    name: { en: 'Generous Tips', zh: '大方小费' },
    desc: { en: 'Tip cap +25. Fast, perfect service pays more.', zh: '小费上限 +25，服务越快越赚。' },
  },
  {
    id: 'patient-customers',
    kind: 'rule',
    icon: '🕰️',
    name: { en: 'Patient Customers', zh: '耐心顾客' },
    desc: { en: 'Everyone waits 25% longer before leaving.', zh: '所有顾客的耐心 +25%。' },
  },
  {
    id: 'combo-master',
    kind: 'rule',
    icon: '🔥',
    name: { en: 'Combo Master', zh: '连击大师' },
    desc: { en: 'Combo starts at ×1.25 and can reach ×6.', zh: '连击从 ×1.25 起步，最高 ×6。' },
  },
  {
    id: 'coin-hint',
    kind: 'rule',
    icon: '🪙',
    name: { en: 'Coin Sense', zh: '硬币直觉' },
    desc: { en: 'Shows one exact coin combination when you are close.', zh: '找零接近正确时，提示一组可用硬币。' },
  },
  {
    id: 'exact-bonus',
    kind: 'rule',
    icon: '🧾',
    name: { en: 'Exact Change Bonus', zh: '整钞奖励' },
    desc: { en: 'Exact-cash customers pay +40 bonus.', zh: '付整钞的顾客额外 +40。' },
  },
  {
    id: 'express-target',
    kind: 'stat',
    icon: '🎯',
    name: { en: 'Express Lane', zh: '快速通道' },
    desc: { en: 'Daily target is 10% lower.', zh: '每日目标降低 10%。' },
  },
  {
    id: 'loyalty',
    kind: 'stat',
    icon: '⭐',
    name: { en: 'Loyalty Card', zh: '会员卡' },
    desc: { en: 'Day-clear bonus +100.', zh: '每日通关奖励 +100。' },
  },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
