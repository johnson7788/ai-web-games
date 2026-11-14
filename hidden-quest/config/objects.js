// 寻物对象类型：id / 双语名 / 颜色（图标在 render 中程序化绘制）。
export const OBJECT_TYPES = [
  { id: 'key',      name: { en: 'Key',      zh: '钥匙' },   color: '#fbbf24' },
  { id: 'star',     name: { en: 'Star',     zh: '星星' },   color: '#fde047' },
  { id: 'heart',    name: { en: 'Heart',    zh: '爱心' },   color: '#fb7185' },
  { id: 'gem',      name: { en: 'Gem',      zh: '宝石' },   color: '#60a5fa' },
  { id: 'coin',     name: { en: 'Coin',     zh: '金币' },   color: '#f59e0b' },
  { id: 'apple',    name: { en: 'Apple',    zh: '苹果' },   color: '#ef4444' },
  { id: 'fish',     name: { en: 'Fish',     zh: '小鱼' },   color: '#38bdf8' },
  { id: 'moon',     name: { en: 'Moon',     zh: '月亮' },   color: '#e2e8f0' },
  { id: 'bell',     name: { en: 'Bell',     zh: '铃铛' },   color: '#fbbf24' },
  { id: 'crown',    name: { en: 'Crown',    zh: '皇冠' },   color: '#fde047' },
  { id: 'leaf',     name: { en: 'Leaf',     zh: '叶子' },   color: '#34d399' },
  { id: 'mushroom', name: { en: 'Mushroom', zh: '蘑菇' },   color: '#f472b6' },
];

export const TYPE_BY_ID = Object.fromEntries(OBJECT_TYPES.map((t) => [t.id, t]));