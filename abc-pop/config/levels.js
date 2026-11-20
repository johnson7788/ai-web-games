// ABC POP · 字母与关卡数据（26 字母 × 3 轮）。
// 场景包按字母分段：A–I 晨云 / J–R 雨后 / S–Z 夜空。

const WORDS = {
  A: ['Apple', '苹果', '🍎'],
  B: ['Ball', '球', '⚽'],
  C: ['Cat', '猫', '🐱'],
  D: ['Dog', '狗', '🐶'],
  E: ['Egg', '蛋', '🥚'],
  F: ['Fish', '鱼', '🐟'],
  G: ['Gift', '礼物', '🎁'],
  H: ['Hat', '帽子', '🎩'],
  I: ['Ice', '冰', '🧊'],
  J: ['Juice', '果汁', '🧃'],
  K: ['Kite', '风筝', '🪁'],
  L: ['Lion', '狮子', '🦁'],
  M: ['Moon', '月亮', '🌙'],
  N: ['Nest', '鸟巢', '🪺'],
  O: ['Owl', '猫头鹰', '🦉'],
  P: ['Pig', '猪', '🐷'],
  Q: ['Queen', '女王', '👑'],
  R: ['Rabbit', '兔子', '🐰'],
  S: ['Sun', '太阳', '☀️'],
  T: ['Tree', '树', '🌳'],
  U: ['Umbrella', '雨伞', '☂️'],
  V: ['Violin', '小提琴', '🎻'],
  W: ['Whale', '鲸鱼', '🐳'],
  X: ['Xylophone', '木琴', '🎵'],
  Y: ['Yoyo', '溜溜球', '🪀'],
  Z: ['Zebra', '斑马', '🦓'],
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const SCENES = [
  { id: 'morning', key: 'scene.morning' },
  { id: 'rain', key: 'scene.rain' },
  { id: 'night', key: 'scene.night' },
];

export const LETTERS = ALPHABET.split('').map((char, i) => {
  const [wordEn, wordZh, emoji] = WORDS[char];
  return {
    char,
    lower: char.toLowerCase(),
    index: i,
    scene: Math.min(2, Math.floor(i / 9)), // 0 晨云 / 1 雨后 / 2 夜空
    wordEn,
    wordZh,
    emoji,
  };
});

export const LETTER_COUNT = LETTERS.length;
export const TOTAL_LEVELS = LETTER_COUNT * 3;

// 字母索引 → 数据
export function letterAt(index) {
  return LETTERS[Math.max(0, Math.min(LETTER_COUNT - 1, index))];
}

// 字母索引 → 场景数据
export function sceneAt(letterIndex) {
  return SCENES[letterAt(letterIndex).scene];
}

// 单词（按语言）
export function wordFor(letterIndex, lang = 'en') {
  const l = letterAt(letterIndex);
  return {
    en: l.wordEn,
    zh: l.wordZh,
    emoji: l.emoji,
    first: l.char,
    label: lang === 'zh' ? `${l.wordZh} ${l.emoji}` : `${l.wordEn} ${l.emoji}`,
  };
}
