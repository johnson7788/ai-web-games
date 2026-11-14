// 题库：大众答案排行（Family Feud 式）。每题若干答案按热度赋分。
// 答案双语（en/zh）+ 英文别名（aliases）用于匹配；玩家可输入英文或中文。
// 分数大致合计 100，模拟调查占比。
export const QUESTIONS = [
  {
    prompt: { en: 'Name a popular pizza topping.', zh: '说出一种常见的披萨配料。' },
    answers: [
      { en: 'Pepperoni', zh: '意式辣肠', points: 35, aliases: ['pepperoni', 'peperoni'] },
      { en: 'Cheese', zh: '芝士', points: 25, aliases: ['cheese', 'mozzarella'] },
      { en: 'Mushroom', zh: '蘑菇', points: 15, aliases: ['mushroom', 'mushrooms'] },
      { en: 'Sausage', zh: '香肠', points: 12, aliases: ['sausage'] },
      { en: 'Onion', zh: '洋葱', points: 8, aliases: ['onion', 'onions'] },
      { en: 'Bacon', zh: '培根', points: 5, aliases: ['bacon'] },
    ],
  },
  {
    prompt: { en: 'Name a fruit that is red.', zh: '说出一种红色的水果。' },
    answers: [
      { en: 'Apple', zh: '苹果', points: 30, aliases: ['apple', 'apples'] },
      { en: 'Strawberry', zh: '草莓', points: 25, aliases: ['strawberry', 'strawberries'] },
      { en: 'Cherry', zh: '樱桃', points: 20, aliases: ['cherry', 'cherries'] },
      { en: 'Watermelon', zh: '西瓜', points: 15, aliases: ['watermelon'] },
      { en: 'Raspberry', zh: '树莓', points: 10, aliases: ['raspberry', 'raspberries'] },
    ],
  },
  {
    prompt: { en: 'Name a planet in our solar system.', zh: '说出太阳系的一颗行星。' },
    answers: [
      { en: 'Mars', zh: '火星', points: 28, aliases: ['mars'] },
      { en: 'Earth', zh: '地球', points: 24, aliases: ['earth'] },
      { en: 'Jupiter', zh: '木星', points: 18, aliases: ['jupiter'] },
      { en: 'Venus', zh: '金星', points: 12, aliases: ['venus'] },
      { en: 'Saturn', zh: '土星', points: 10, aliases: ['saturn'] },
      { en: 'Mercury', zh: '水星', points: 8, aliases: ['mercury'] },
    ],
  },
  {
    prompt: { en: 'Name something you find in a kitchen.', zh: '说出厨房里的一样东西。' },
    answers: [
      { en: 'Fridge', zh: '冰箱', points: 30, aliases: ['fridge', 'refrigerator', 'freezer'] },
      { en: 'Oven', zh: '烤箱', points: 22, aliases: ['oven', 'stove'] },
      { en: 'Sink', zh: '水槽', points: 18, aliases: ['sink'] },
      { en: 'Microwave', zh: '微波炉', points: 14, aliases: ['microwave'] },
      { en: 'Knife', zh: '刀', points: 9, aliases: ['knife', 'knives'] },
      { en: 'Toaster', zh: '烤面包机', points: 7, aliases: ['toaster'] },
    ],
  },
  {
    prompt: { en: 'Name a popular pet.', zh: '说出一种常见的宠物。' },
    answers: [
      { en: 'Dog', zh: '狗', points: 35, aliases: ['dog', 'dogs', 'puppy'] },
      { en: 'Cat', zh: '猫', points: 30, aliases: ['cat', 'cats', 'kitten'] },
      { en: 'Fish', zh: '鱼', points: 15, aliases: ['fish', 'goldfish'] },
      { en: 'Hamster', zh: '仓鼠', points: 10, aliases: ['hamster'] },
      { en: 'Bird', zh: '鸟', points: 6, aliases: ['bird', 'parrot'] },
      { en: 'Rabbit', zh: '兔子', points: 4, aliases: ['rabbit', 'bunny'] },
    ],
  },
  {
    prompt: { en: 'Name a season of the year.', zh: '说出一年中的一个季节。' },
    answers: [
      { en: 'Summer', zh: '夏天', points: 30, aliases: ['summer'] },
      { en: 'Winter', zh: '冬天', points: 28, aliases: ['winter'] },
      { en: 'Spring', zh: '春天', points: 22, aliases: ['spring'] },
      { en: 'Autumn', zh: '秋天', points: 20, aliases: ['autumn', 'fall'] },
    ],
  },
  {
    prompt: { en: 'Name a yellow food.', zh: '说出一种黄色的食物。' },
    answers: [
      { en: 'Banana', zh: '香蕉', points: 32, aliases: ['banana', 'bananas'] },
      { en: 'Lemon', zh: '柠檬', points: 24, aliases: ['lemon', 'lemons'] },
      { en: 'Corn', zh: '玉米', points: 18, aliases: ['corn', 'sweetcorn'] },
      { en: 'Cheese', zh: '芝士', points: 14, aliases: ['cheese'] },
      { en: 'Pineapple', zh: '菠萝', points: 12, aliases: ['pineapple'] },
    ],
  },
  {
    prompt: { en: 'Name a sport played with a ball.', zh: '说出一项用球的运动。' },
    answers: [
      { en: 'Soccer', zh: '足球', points: 30, aliases: ['soccer', 'football'] },
      { en: 'Basketball', zh: '篮球', points: 24, aliases: ['basketball'] },
      { en: 'Tennis', zh: '网球', points: 18, aliases: ['tennis'] },
      { en: 'Baseball', zh: '棒球', points: 14, aliases: ['baseball'] },
      { en: 'Golf', zh: '高尔夫', points: 8, aliases: ['golf'] },
      { en: 'Volleyball', zh: '排球', points: 6, aliases: ['volleyball'] },
    ],
  },
  {
    prompt: { en: 'Name a mode of transport.', zh: '说出一种交通工具。' },
    answers: [
      { en: 'Car', zh: '汽车', points: 32, aliases: ['car', 'cars', 'automobile'] },
      { en: 'Bus', zh: '公交', points: 22, aliases: ['bus'] },
      { en: 'Train', zh: '火车', points: 18, aliases: ['train'] },
      { en: 'Bicycle', zh: '自行车', points: 14, aliases: ['bicycle', 'bike', 'cycle'] },
      { en: 'Plane', zh: '飞机', points: 9, aliases: ['plane', 'airplane', 'aeroplane'] },
      { en: 'Boat', zh: '船', points: 5, aliases: ['boat', 'ship'] },
    ],
  },
  {
    prompt: { en: 'Name a hot drink.', zh: '说出一种热饮。' },
    answers: [
      { en: 'Coffee', zh: '咖啡', points: 35, aliases: ['coffee'] },
      { en: 'Tea', zh: '茶', points: 30, aliases: ['tea'] },
      { en: 'Hot Chocolate', zh: '热巧克力', points: 20, aliases: ['hot chocolate', 'hot cocoa', 'cocoa'] },
      { en: 'Milk', zh: '牛奶', points: 10, aliases: ['milk', 'hot milk'] },
      { en: 'Chai', zh: '奶茶', points: 5, aliases: ['chai', 'milk tea', 'latte'] },
    ],
  },
];

export const QUESTION_COUNT = QUESTIONS.length;