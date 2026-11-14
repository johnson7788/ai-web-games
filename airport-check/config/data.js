// 旅客与行李数据：姓名/国家/目的地/物品（含违禁品）。
export const NAMES = [
  'Alice Chen', 'Bob Smith', 'Carla Diaz', 'David Kim', 'Elena Rossi',
  'Frank Weber', 'Grace Liu', 'Hiro Tanaka', 'Ivan Petrov', 'Julia Costa',
  'Karl Hansen', 'Lina Haddad', 'Marco Bianchi', 'Nina Sokolova', 'Omar Farouk',
  'Priya Nair', 'Quinn Murphy', 'Rosa Mendez', 'Sven Larsen', 'Tara Singh',
];

export const COUNTRIES = ['USA', 'UK', 'Japan', 'Brazil', 'France', 'India', 'Germany', 'Canada'];
export const DESTINATIONS = ['Tokyo', 'London', 'Paris', 'New York', 'Sydney', 'Dubai', 'Berlin', 'Rome'];

// 行李物品：contraband=true 为违禁品（X 光红色）。shape 用于 X 光剪影。
export const ITEMS = [
  { id: 'laptop',  name: { en: 'Laptop',  zh: '笔记本' }, contraband: false, shape: 'rect' },
  { id: 'book',    name: { en: 'Book',    zh: '书' },     contraband: false, shape: 'rect' },
  { id: 'clothes', name: { en: 'Clothes', zh: '衣物' },   contraband: false, shape: 'blob' },
  { id: 'shoes',   name: { en: 'Shoes',   zh: '鞋' },     contraband: false, shape: 'blob' },
  { id: 'camera',  name: { en: 'Camera',  zh: '相机' },   contraband: false, shape: 'rect' },
  { id: 'umbrella',name: { en: 'Umbrella',zh: '雨伞' },   contraband: false, shape: 'line' },
  { id: 'keys',    name: { en: 'Keys',    zh: '钥匙' },   contraband: false, shape: 'blob' },
  { id: 'knife',   name: { en: 'Knife',   zh: '刀具' },   contraband: true,  shape: 'knife' },
  { id: 'gun',     name: { en: 'Gun',     zh: '枪支' },   contraband: true,  shape: 'gun' },
  { id: 'scissors',name: { en: 'Scissors',zh: '剪刀' },   contraband: true,  shape: 'knife' },
  { id: 'liquid',  name: { en: 'Large Liquid', zh: '超量液体' }, contraband: true, shape: 'bottle' },
];

export const NORMAL_ITEMS = ITEMS.filter((i) => !i.contraband);
export const CONTRABAND_ITEMS = ITEMS.filter((i) => i.contraband);