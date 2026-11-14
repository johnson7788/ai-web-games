// 双人问答题库：每题 4 选项 + 正确索引，双语。
export const QUESTIONS = [
  { q: { en: 'What is the capital of France?', zh: '法国的首都是？' }, options: [{ en: 'Paris', zh: '巴黎' }, { en: 'London', zh: '伦敦' }, { en: 'Berlin', zh: '柏林' }, { en: 'Rome', zh: '罗马' }], correct: 0 },
  { q: { en: 'How many continents are there?', zh: '地球有几大洲？' }, options: [{ en: '5', zh: '5' }, { en: '6', zh: '6' }, { en: '7', zh: '7' }, { en: '8', zh: '8' }], correct: 2 },
  { q: { en: 'Which planet is the Red Planet?', zh: '哪颗行星被称为红色星球？' }, options: [{ en: 'Venus', zh: '金星' }, { en: 'Mars', zh: '火星' }, { en: 'Jupiter', zh: '木星' }, { en: 'Saturn', zh: '土星' }], correct: 1 },
  { q: { en: 'What is the largest ocean?', zh: '最大的海洋是？' }, options: [{ en: 'Atlantic', zh: '大西洋' }, { en: 'Indian', zh: '印度洋' }, { en: 'Arctic', zh: '北冰洋' }, { en: 'Pacific', zh: '太平洋' }], correct: 3 },
  { q: { en: 'How many legs does a spider have?', zh: '蜘蛛有几条腿？' }, options: [{ en: '6', zh: '6' }, { en: '8', zh: '8' }, { en: '10', zh: '10' }, { en: '12', zh: '12' }], correct: 1 },
  { q: { en: 'What gas do plants absorb?', zh: '植物吸收什么气体？' }, options: [{ en: 'Oxygen', zh: '氧气' }, { en: 'Nitrogen', zh: '氮气' }, { en: 'Carbon dioxide', zh: '二氧化碳' }, { en: 'Hydrogen', zh: '氢气' }], correct: 2 },
  { q: { en: 'Which is the fastest land animal?', zh: '陆地上最快的动物是？' }, options: [{ en: 'Lion', zh: '狮子' }, { en: 'Cheetah', zh: '猎豹' }, { en: 'Horse', zh: '马' }, { en: 'Kangaroo', zh: '袋鼠' }], correct: 1 },
  { q: { en: 'What is H2O?', zh: 'H2O 是什么？' }, options: [{ en: 'Salt', zh: '盐' }, { en: 'Water', zh: '水' }, { en: 'Air', zh: '空气' }, { en: 'Gold', zh: '黄金' }], correct: 1 },
  { q: { en: 'How many colors in a rainbow?', zh: '彩虹有几种颜色？' }, options: [{ en: '5', zh: '5' }, { en: '6', zh: '6' }, { en: '7', zh: '7' }, { en: '9', zh: '9' }], correct: 2 },
  { q: { en: 'Which country invented pizza?', zh: '披萨起源于哪个国家？' }, options: [{ en: 'France', zh: '法国' }, { en: 'Italy', zh: '意大利' }, { en: 'USA', zh: '美国' }, { en: 'Greece', zh: '希腊' }], correct: 1 },
  { q: { en: 'What is the tallest mountain?', zh: '最高的山是？' }, options: [{ en: 'K2', zh: '乔戈里峰' }, { en: 'Everest', zh: '珠穆朗玛峰' }, { en: 'Fuji', zh: '富士山' }, { en: 'Alps', zh: '阿尔卑斯山' }], correct: 1 },
  { q: { en: 'How many sides does a hexagon have?', zh: '六边形有几条边？' }, options: [{ en: '5', zh: '5' }, { en: '6', zh: '6' }, { en: '7', zh: '7' }, { en: '8', zh: '8' }], correct: 1 },
  { q: { en: 'Which animal is the king of the jungle?', zh: '哪种动物是丛林之王？' }, options: [{ en: 'Tiger', zh: '老虎' }, { en: 'Lion', zh: '狮子' }, { en: 'Bear', zh: '熊' }, { en: 'Elephant', zh: '大象' }], correct: 1 },
  { q: { en: 'What do bees make?', zh: '蜜蜂制造什么？' }, options: [{ en: 'Milk', zh: '牛奶' }, { en: 'Honey', zh: '蜂蜜' }, { en: 'Silk', zh: '丝绸' }, { en: 'Wax only', zh: '只有蜡' }], correct: 1 },
  { q: { en: 'Which season comes after summer?', zh: '夏天之后是哪个季节？' }, options: [{ en: 'Spring', zh: '春天' }, { en: 'Winter', zh: '冬天' }, { en: 'Autumn', zh: '秋天' }, { en: 'Monsoon', zh: '雨季' }], correct: 2 },
  { q: { en: 'How many players in a soccer team on field?', zh: '足球场上每队几名球员？' }, options: [{ en: '9', zh: '9' }, { en: '10', zh: '10' }, { en: '11', zh: '11' }, { en: '12', zh: '12' }], correct: 2 },
  { q: { en: 'What is the boiling point of water (°C)?', zh: '水的沸点是多少摄氏度？' }, options: [{ en: '50', zh: '50' }, { en: '90', zh: '90' }, { en: '100', zh: '100' }, { en: '120', zh: '120' }], correct: 2 },
  { q: { en: 'Which is a primary color?', zh: '哪个是三原色之一？' }, options: [{ en: 'Green', zh: '绿色' }, { en: 'Red', zh: '红色' }, { en: 'Orange', zh: '橙色' }, { en: 'Purple', zh: '紫色' }], correct: 1 },
  { q: { en: 'How many minutes in an hour?', zh: '一小时有多少分钟？' }, options: [{ en: '30', zh: '30' }, { en: '60', zh: '60' }, { en: '90', zh: '90' }, { en: '100', zh: '100' }], correct: 1 },
  { q: { en: 'Which planet has rings?', zh: '哪颗行星有光环？' }, options: [{ en: 'Mars', zh: '火星' }, { en: 'Saturn', zh: '土星' }, { en: 'Mercury', zh: '水星' }, { en: 'Venus', zh: '金星' }], correct: 1 },
];

export const QUESTION_COUNT = QUESTIONS.length;