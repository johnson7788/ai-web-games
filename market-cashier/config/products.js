// 商品库：双语名 + 价格（分）+ emoji + 卡片色。
export const PRODUCTS = [
  { name: { en: 'Apple', zh: '苹果' }, price: 120, emoji: '🍎', color: '#ef4444' },
  { name: { en: 'Bread', zh: '面包' }, price: 250, emoji: '🍞', color: '#d97706' },
  { name: { en: 'Milk', zh: '牛奶' }, price: 180, emoji: '🥛', color: '#93c5fd' },
  { name: { en: 'Cheese', zh: '奶酪' }, price: 350, emoji: '🧀', color: '#facc15' },
  { name: { en: 'Eggs', zh: '鸡蛋' }, price: 220, emoji: '🥚', color: '#fde68a' },
  { name: { en: 'Banana', zh: '香蕉' }, price: 90, emoji: '🍌', color: '#fbbf24' },
  { name: { en: 'Tomato', zh: '番茄' }, price: 150, emoji: '🍅', color: '#f87171' },
  { name: { en: 'Carrot', zh: '胡萝卜' }, price: 110, emoji: '🥕', color: '#fb923c' },
  { name: { en: 'Chicken', zh: '鸡肉' }, price: 480, emoji: '🍗', color: '#fca5a5' },
  { name: { en: 'Fish', zh: '鱼' }, price: 520, emoji: '🐟', color: '#67e8f9' },
  { name: { en: 'Rice', zh: '大米' }, price: 300, emoji: '🍚', color: '#e5e7eb' },
  { name: { en: 'Pasta', zh: '意面' }, price: 270, emoji: '🍝', color: '#fcd34d' },
  { name: { en: 'Soap', zh: '肥皂' }, price: 160, emoji: '🧼', color: '#a5b4fc' },
  { name: { en: 'Juice', zh: '果汁' }, price: 230, emoji: '🧃', color: '#f9a8d4' },
  { name: { en: 'Cookie', zh: '饼干' }, price: 190, emoji: '🍪', color: '#d6a06a' },
  { name: { en: 'Coffee', zh: '咖啡' }, price: 400, emoji: '☕', color: '#a16207' },
];

// 钱币面额（分）
export const DENOMINATIONS = [1000, 500, 100, 25, 10, 5, 1];

export const PRODUCT_COUNT = PRODUCTS.length;
