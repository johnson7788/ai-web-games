// 主题词库：每主题 10 个有效英文词（长度 3–7），每关随机取 8 个。
// 名称双语；词本体为英文（找词玩法）。
export const THEMES = [
  {
    id: 'animals', name: { en: 'Animals', zh: '动物' },
    words: ['TIGER', 'ZEBRA', 'PANDA', 'EAGLE', 'SHARK', 'WHALE', 'SNAKE', 'HORSE', 'MOUSE', 'RABBIT'],
  },
  {
    id: 'food', name: { en: 'Food', zh: '美食' },
    words: ['PIZZA', 'BREAD', 'APPLE', 'MANGO', 'PASTA', 'SALAD', 'CHEESE', 'BURGER', 'NOODLE', 'COOKIE'],
  },
  {
    id: 'space', name: { en: 'Space', zh: '太空' },
    words: ['COMET', 'ORBIT', 'PLANET', 'GALAXY', 'ROCKET', 'NEBULA', 'SATURN', 'METEOR', 'COSMOS', 'LUNAR'],
  },
  {
    id: 'ocean', name: { en: 'Ocean', zh: '海洋' },
    words: ['CORAL', 'WHALE', 'SHARK', 'TIDES', 'KELP', 'REEF', 'WAVES', 'PEARL', 'OCTOPUS', 'DOLPHIN'],
  },
  {
    id: 'sports', name: { en: 'Sports', zh: '运动' },
    words: ['RUGBY', 'TENNIS', 'SOCCER', 'HOCKEY', 'BOXING', 'SKIING', 'ROWING', 'KARATE', 'CRICKET', 'ARCHERY'],
  },
  {
    id: 'music', name: { en: 'Music', zh: '音乐' },
    words: ['PIANO', 'VIOLIN', 'GUITAR', 'FLUTE', 'DRUMS', 'TEMPO', 'CHORD', 'MELODY', 'RHYTHM', 'OPERA'],
  },
  {
    id: 'nature', name: { en: 'Nature', zh: '自然' },
    words: ['RIVER', 'FOREST', 'CLOUD', 'STORM', 'MEADOW', 'CANYON', 'DESERT', 'VALLEY', 'GLACIER', 'VOLCANO'],
  },
  {
    id: 'colors', name: { en: 'Colors', zh: '色彩' },
    words: ['ORANGE', 'PURPLE', 'YELLOW', 'INDIGO', 'VIOLET', 'SILVER', 'GOLDEN', 'MAROON', 'SCARLET', 'CRIMSON'],
  },
];