// 顾客类型：决定 patience / 小费倍率 / 商品数量 / 外观。
export const CUSTOMER_TYPES = {
  regular: {
    id: 'regular',
    name: { en: 'Regular', zh: '常客' },
    patienceMul: 1,
    tipMul: 1,
    minItems: 3,
    maxItems: 5,
    hair: ['#3b2f2f', '#6b4423', '#1f2937', '#7c2d12'],
    shirt: ['#5eead4', '#fbbf24', '#93c5fd', '#f9a8d4'],
    mood: 'calm',
  },
  hurry: {
    id: 'hurry',
    name: { en: 'In a hurry', zh: '赶时间' },
    patienceMul: 0.7,
    tipMul: 1.5,
    minItems: 2,
    maxItems: 4,
    hair: ['#111827', '#78350f', '#4c1d95'],
    shirt: ['#fb7185', '#f97316', '#a78bfa'],
    mood: 'rushed',
  },
  bulk: {
    id: 'bulk',
    name: { en: 'Big basket', zh: '大采购' },
    patienceMul: 1.15,
    tipMul: 1.1,
    minItems: 4,
    maxItems: 6,
    hair: ['#374151', '#92400e', '#312e81'],
    shirt: ['#34d399', '#60a5fa', '#fbbf24'],
    mood: 'patient',
  },
};

export const CUSTOMER_NAMES = {
  en: ['Alex', 'Sam', 'Riley', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Jamie'],
  zh: ['小林', '阿杰', '小雨', '老王', '小周', '阿May', '大刘', '小陈'],
};

export function pickCustomerType(rng, dayWeights) {
  const entries = Object.entries(dayWeights).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [id, w] of entries) {
    roll -= w;
    if (roll <= 0) return CUSTOMER_TYPES[id];
  }
  return CUSTOMER_TYPES.regular;
}
