// config/quiz.js — 题库：判断对错（true/false），双语（en/zh），全部原创常识题。
// 每局随机抽取、不重复；抽完从头循环。答案必须无歧义（以一般常识为准）。
export const QUESTIONS = [
  { en: 'The Moon orbits the Earth.', zh: '月球绕地球运行。', answer: true },
  { en: 'Water boils at 100°C at sea level.', zh: '在海平面，水在 100°C 沸腾。', answer: true },
  { en: 'A tomato is a fruit, not a vegetable.', zh: '番茄是水果，不是蔬菜。', answer: true },
  { en: 'The Sun rises in the west.', zh: '太阳从西方升起。', answer: false },
  { en: 'Humans normally have 46 chromosomes.', zh: '人类通常有 46 条染色体。', answer: true },
  { en: 'The Pacific Ocean is the largest ocean on Earth.', zh: '太平洋是地球上最大的海洋。', answer: true },
  { en: 'Penguins can fly.', zh: '企鹅会飞。', answer: false },
  { en: 'There are seven continents on Earth.', zh: '地球上有七个大洲。', answer: true },
  { en: 'The capital of France is London.', zh: '法国的首都是伦敦。', answer: false },
  { en: 'Light travels faster than sound.', zh: '光比声音传播得更快。', answer: true },
  { en: 'Spiders are insects.', zh: '蜘蛛是昆虫。', answer: false },
  { en: 'A normal year on Earth has about 365 days.', zh: '地球上普通的一年大约有 365 天。', answer: true },
  { en: 'Fish breathe underwater using gills.', zh: '鱼用鳃在水下呼吸。', answer: true },
  { en: 'The Great Wall of China is visible from the Moon.', zh: '从月球上能看见中国长城。', answer: false },
  { en: 'Honey can stay edible for a very long time.', zh: '蜂蜜可以保存很久而不变质。', answer: true },
  { en: 'Dogs can only see in black and white.', zh: '狗只能看到黑白两色。', answer: false },
  { en: 'The Earth revolves around the Sun.', zh: '地球绕太阳公转。', answer: true },
  { en: 'Venus is the closest planet to the Sun.', zh: '金星是离太阳最近的行星。', answer: false },
  { en: 'Octopuses have three hearts.', zh: '章鱼有三颗心脏。', answer: true },
  { en: 'The human body has two lungs.', zh: '人体有两个肺。', answer: true },
  { en: 'Diamonds are made of carbon.', zh: '钻石由碳构成。', answer: true },
  { en: 'Mount Everest is the tallest mountain above sea level.', zh: '珠穆朗玛峰是海拔最高的山峰。', answer: true },
  { en: 'Sound can travel through empty space.', zh: '声音可以在真空中传播。', answer: false },
  { en: 'Bats are completely blind.', zh: '蝙蝠是完全看不见的。', answer: false },
  { en: 'An octopus has eight arms.', zh: '章鱼有八条腕足。', answer: true },
  { en: 'The currency of Japan is the yen.', zh: '日本的货币是日元。', answer: true },
  { en: 'Sharks are mammals.', zh: '鲨鱼是哺乳动物。', answer: false },
  { en: 'A leap year has 366 days.', zh: '闰年有 366 天。', answer: true },
  { en: 'The Statue of Liberty was a gift from France.', zh: '自由女神像是法国赠送的礼物。', answer: true },
  { en: 'Gravity pulls objects toward Earth.', zh: '重力把物体拉向地球。', answer: true },
  { en: 'There are twelve months in a year.', zh: '一年有十二个月。', answer: true },
  { en: 'The Moon is a planet.', zh: '月球是一颗行星。', answer: false },
  { en: 'Plants make their own food through photosynthesis.', zh: '植物通过光合作用制造养分。', answer: true },
  { en: 'A triangle has four sides.', zh: '三角形有四条边。', answer: false },
  { en: 'Snow is frozen water.', zh: '雪是冻结的水。', answer: true },
  { en: 'The human heart has four chambers.', zh: '人的心脏有四个腔室。', answer: true },
  { en: 'A cheetah is the fastest land animal.', zh: '猎豹是跑得最快的陆地动物。', answer: true },
  { en: 'The Sahara is the largest hot desert.', zh: '撒哈拉沙漠是最大的热沙漠。', answer: true },
  { en: 'A baby chicken is called a chick.', zh: '小鸡的幼崽叫 chick。', answer: true },
  { en: 'Chickens are birds.', zh: '鸡是鸟类。', answer: true },
];

// 从题库按 rng 抽一题（避免重复，抽完重置）
export function pickQuestion(rng, usedSet) {
  if (usedSet.size >= QUESTIONS.length) usedSet.clear();
  let idx = Math.floor(rng() * QUESTIONS.length);
  let guard = 0;
  while (usedSet.has(idx) && guard < QUESTIONS.length * 4) {
    idx = (idx + 1) % QUESTIONS.length;
    guard += 1;
  }
  usedSet.add(idx);
  return { ...QUESTIONS[idx], index: idx };
}
