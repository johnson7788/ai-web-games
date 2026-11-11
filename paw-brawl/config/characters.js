// 八只原创糖果色动物。数值与设计源 §5 一一对应。
export const CHARACTERS = [
  {
    id: 'shiba', name: { zh: '旺财', en: 'Wangcai' }, species: '柴犬',
    speed: 1.00, weight: 1.00, power: 1.00, jump: 1.00,
    passive: 'balanced', passiveText: { zh: '均衡：没有短板', en: 'Balanced: no weaknesses' },
    colors: { fur: '#F2C14E', fur2: '#FFF3E2', belly: '#FFF3E2', accent: '#FF7A59', cheek: '#FF9E8C', nose: '#3B2B33' },
    build: { head: 0.52, body: 0.46, ear: 'pointy', tail: 'curl', snout: true, brow: false },
  },
  {
    id: 'cat', name: { zh: '咪咪', en: 'Mimi' }, species: '猫',
    speed: 1.10, weight: 0.85, power: 1.05, jump: 1.05,
    passive: 'airControl', passiveText: { zh: '灵巧：空中可微调一次', en: 'Agile: one extra air adjustment' },
    colors: { fur: '#9BB8E8', fur2: '#D7E6FF', belly: '#FFF3E2', accent: '#6B5B95', cheek: '#FF9EB5', nose: '#57354A' },
    build: { head: 0.50, body: 0.43, ear: 'pointy', tail: 'thin', snout: true, brow: false },
  },
  {
    id: 'rabbit', name: { zh: '兔兔', en: 'Tutu' }, species: '兔',
    speed: 1.15, weight: 0.65, power: 1.15, jump: 1.20,
    passive: 'doubleJump', passiveText: { zh: '弹跳：二段跳更低但更远', en: 'Bouncy: a lower, longer second jump' },
    colors: { fur: '#F2B8D0', fur2: '#FFE3EF', belly: '#FFF8F0', accent: '#7C5CA8', cheek: '#FF8FA8', nose: '#9B4F68' },
    build: { head: 0.49, body: 0.40, ear: 'floppy', tail: 'puff', snout: true, brow: false },
  },
  {
    id: 'panda', name: { zh: '团团', en: 'Tuan' }, species: '熊猫',
    speed: 0.88, weight: 1.40, power: 0.90, jump: 0.90,
    passive: 'heavy', passiveText: { zh: '铁墩：受击位移 −20%', en: 'Solid: 20% less knockback' },
    colors: { fur: '#FFFDF8', fur2: '#2E2A3A', belly: '#FFFFFF', accent: '#2E2A3A', cheek: '#F4A6A6', nose: '#2E2A3A' },
    build: { head: 0.56, body: 0.52, ear: 'round', tail: 'puff', snout: true, brow: true, eyePatch: 1.2 },
  },
  {
    id: 'bear', name: { zh: '熊大', en: 'Xiong' }, species: '棕熊',
    speed: 0.92, weight: 1.30, power: 1.00, jump: 0.95,
    passive: 'steady', passiveText: { zh: '稳重：眩晕时间 −30%', en: 'Steady: 30% shorter dizziness' },
    colors: { fur: '#8B6146', fur2: '#C99B78', belly: '#F4D9B0', accent: '#4F7B72', cheek: '#EB9687', nose: '#54383A' },
    build: { head: 0.55, body: 0.50, ear: 'round', tail: 'puff', snout: true, brow: true },
  },
  {
    id: 'fox', name: { zh: '狐狐', en: 'Huhu' }, species: '狐狸',
    speed: 1.08, weight: 0.90, power: 1.05, jump: 1.10,
    passive: 'dash', passiveText: { zh: '疾冲：冲刺冷却 −40%', en: 'Swift: 40% shorter dash cooldown' },
    colors: { fur: '#FF8A4C', fur2: '#FFF6EA', belly: '#FFF6EA', accent: '#5B4A78', cheek: '#FF9A9A', nose: '#543345' },
    build: { head: 0.51, body: 0.43, ear: 'pointy', tail: 'thin', snout: true, brow: true },
  },
  {
    id: 'frog', name: { zh: '蛙蛙', en: 'Wawa' }, species: '青蛙',
    speed: 1.02, weight: 0.80, power: 1.15, jump: 1.25,
    passive: 'tongue', passiveText: { zh: '长舌：抓取距离 +40%', en: 'Long tongue: 40% more grab range' },
    colors: { fur: '#79D6A4', fur2: '#C8F2C4', belly: '#FFF0B8', accent: '#496B64', cheek: '#F5A3A0', nose: '#3D5C54' },
    build: { head: 0.54, body: 0.43, ear: 'tiny', tail: 'puff', snout: false, brow: false },
  },
  {
    id: 'duck', name: { zh: '鸭鸭', en: 'Yaya' }, species: '鸭',
    speed: 1.05, weight: 0.75, power: 1.05, jump: 1.15,
    passive: 'slippery', passiveText: { zh: '滑溜：落地无硬直', en: 'Slippery: no landing recovery' },
    colors: { fur: '#FFFDF4', fur2: '#FFF3D6', belly: '#FFFDF4', accent: '#65A9C9', cheek: '#F2A18F', nose: '#F5B942', beak: '#F5B942' },
    build: { head: 0.51, body: 0.44, ear: 'tiny', tail: 'puff', snout: false, brow: false },
  },
];

export const CHARACTER_MAP = Object.fromEntries(CHARACTERS.map((character) => [character.id, character]));
