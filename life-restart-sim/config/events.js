// 人生事件（Life Events）内容表 —— 霓虹转生街机原创主题。
// 字段：
//   age      [min, max] 适用年龄（含）
//   w        权重（可小数）
//   en / zh  事件正文
//   postEn / postZh  事件后记（可选，另起一行展示）
//   fx       效果 { CHR/INT/STR/MNY/SPR/LIF: delta }
//   cond     必须满足才进入候选池（include）
//   excl     满足则排除（exclude）
//   branch   [ [条件, 事件id], ... ] 命中则连锁到下一事件
//   good/bad 幸运连击标记（不写则按 fx 净效果自动判断）
//   nopool   true = 不在候选池（仅被 branch/强制引用）

// 终局事件
export const DEATH_EVENT = {
  id: 19999,
  age: [0, 999],
  w: 0,
  nopool: true,
  en: 'You died.',
  zh: '你死了。',
  fx: { LIF: -1 },
};

export const EVENTS = [
  // ---- 婴幼儿 1-5 ----
  { id: 20001, age: [1, 5], w: 3, en: 'You learned to walk.', zh: '你学会了走路。', fx: { STR: 1 }, good: true },
  { id: 20002, age: [1, 5], w: 2, en: 'You caught a bad cold.', zh: '你得了一场重感冒。', fx: { STR: -1 }, bad: true, branch: [['STR<1', 19999]] },
  { id: 20003, age: [1, 5], w: 2, en: 'Your family bought you a new toy.', zh: '家人给你买了新玩具。', fx: { SPR: 1 }, good: true },
  { id: 20004, age: [1, 5], w: 2, en: 'You made your first friend.', zh: '你交到了第一个朋友。', fx: { SPR: 1, CHR: 1 }, good: true },
  { id: 20005, age: [1, 5], w: 2, en: 'You fell off the bed.', zh: '你从床上摔了下来。', fx: { STR: -1 }, bad: true },
  { id: 20006, age: [1, 5], w: 1, en: 'You became obsessed with numbers.', zh: '你开始对数字着迷。', fx: { INT: 1 }, good: true },

  // ---- 童年 6-12 ----
  { id: 20101, age: [6, 12], w: 2, en: 'You ranked first in class.', zh: '你在班级里拿了第一名。', fx: { INT: 1, SPR: 1 }, good: true },
  { id: 20102, age: [6, 12], w: 2, en: 'You were left out by classmates.', zh: '你被同学排挤了。', fx: { SPR: -1, CHR: -1 }, bad: true },
  { id: 20103, age: [6, 12], w: 2, en: 'You picked up a musical instrument.', zh: '你开始学习一门乐器。', fx: { CHR: 1, SPR: 1 }, good: true },
  { id: 20104, age: [6, 12], w: 1, en: 'You became nearsighted.', zh: '你近视了。', fx: { INT: 1, STR: -1 } },
  { id: 20105, age: [6, 12], w: 2, en: 'You won the sports day.', zh: '你在运动会上夺冠了。', fx: { STR: 1, SPR: 1 }, good: true },
  { id: 20106, age: [6, 12], w: 1, en: 'Trouble struck your family.', zh: '家里发生了变故。', fx: { MNY: -1, SPR: -1 }, bad: true },
  { id: 20107, age: [6, 12], w: 1, en: 'You got hooked on games.', zh: '你沉迷于游戏。', fx: { INT: -1, SPR: 1 } },
  { id: 20108, age: [6, 12], w: 2, en: 'You got a pet.', zh: '你养了一只宠物。', fx: { SPR: 2 }, good: true },

  // ---- 少年 13-17 ----
  { id: 20201, age: [13, 17], w: 2, en: 'You entered an elite school.', zh: '你考入了重点学校。', fx: { INT: 2 }, good: true },
  { id: 20202, age: [13, 17], w: 2, en: 'You had your first crush.', zh: '你情窦初开。', fx: { SPR: 1, CHR: 1 }, good: true },
  { id: 20203, age: [13, 17], w: 2, en: 'You failed an important exam.', zh: '你在重要考试中失利。', fx: { SPR: -1, INT: -1 }, bad: true },
  { id: 20204, age: [13, 17], w: 2, en: 'You joined the school team.', zh: '你加入了校队。', fx: { STR: 2, CHR: 1 }, good: true },
  { id: 20205, age: [13, 17], w: 1, en: 'You fell into confusion.', zh: '你陷入了迷茫。', fx: { SPR: -2 }, bad: true },
  { id: 20206, age: [13, 17], w: 2, en: 'You earned your first pocket money.', zh: '你赚到了第一笔零花钱。', fx: { MNY: 1 }, good: true },
  { id: 20207, age: [13, 17], w: 1, en: 'You had a huge argument with your family.', zh: '你和家人大吵了一架。', fx: { SPR: -1 }, bad: true },
  { id: 20208, age: [13, 17], w: 1, en: 'You discovered your own talent.', zh: '你发现了自己的天赋。', fx: { INT: 1, CHR: 1 }, good: true },

  // ---- 青年 18-29 ----
  { id: 20301, age: [18, 29], w: 2, en: 'You got into university.', zh: '你考上了大学。', fx: { INT: 2 }, good: true },
  { id: 20302, age: [18, 29], w: 2, en: 'You fell in love for the first time.', zh: '你谈了第一场恋爱。', fx: { SPR: 2, CHR: 1 }, good: true },
  { id: 20303, age: [18, 29], w: 1, en: 'You went through a breakup.', zh: '你失恋了。', fx: { SPR: -2 }, bad: true },
  { id: 20304, age: [18, 29], w: 2, en: 'You landed your first job.', zh: '你找到了第一份工作。', fx: { MNY: 2 }, good: true },
  { id: 20305, age: [18, 29], w: 1, en: 'Your startup failed.', zh: '你的创业失败了。', fx: { MNY: -2, SPR: -1 }, bad: true },
  { id: 20306, age: [18, 29], w: 2, en: 'You started working out.', zh: '你开始健身。', fx: { STR: 2 }, good: true },
  { id: 20307, age: [18, 29], w: 2, en: 'You moved to a new city.', zh: '你搬到了新的城市。', fx: { MNY: -1, SPR: 1 } },
  { id: 20308, age: [18, 29], w: 2, en: 'You saved your first nest egg.', zh: '你攒下了第一桶金。', fx: { MNY: 2 }, good: true },

  // ---- 中年 30-49 ----
  { id: 20401, age: [30, 49], w: 2, en: 'You got a promotion.', zh: '你在职场获得了晋升。', fx: { MNY: 2, SPR: 1 }, good: true },
  { id: 20402, age: [30, 49], w: 2, en: 'You started a family.', zh: '你成家了。', fx: { SPR: 2, MNY: -1 }, good: true },
  { id: 20403, age: [30, 49], w: 1, en: 'You were hospitalized.', zh: '你生病住院了。', fx: { STR: -2, MNY: -1 }, bad: true, branch: [['STR<2', 19999]] },
  { id: 20404, age: [30, 49], w: 2, en: 'You bought your own home.', zh: '你买下了自己的房子。', fx: { MNY: -2, SPR: 1 } },
  { id: 20405, age: [30, 49], w: 2, en: 'Your career took off.', zh: '你的事业蒸蒸日上。', fx: { MNY: 3 }, good: true },
  { id: 20406, age: [30, 49], w: 1, en: 'A midlife crisis hit you.', zh: '你遭遇了中年危机。', fx: { SPR: -2 }, bad: true },

  // ---- 中老年 50-69 ----
  { id: 20501, age: [50, 69], w: 2, en: 'Your children grew up.', zh: '你的孩子长大成人。', fx: { SPR: 2 }, good: true },
  { id: 20502, age: [50, 69], w: 1, en: 'Your health began to decline.', zh: '你的身体开始走下坡。', fx: { STR: -2 }, bad: true, branch: [['STR<2', 19999]] },
  { id: 20503, age: [50, 69], w: 2, en: 'You enjoyed calm days before retirement.', zh: '你享受退休前的宁静时光。', fx: { SPR: 2 }, good: true },
  { id: 20504, age: [50, 69], w: 1, en: 'Your investment went bad.', zh: '你的投资失败了。', fx: { MNY: -2 }, bad: true },
  { id: 20505, age: [50, 69], w: 1, en: 'You reached the peak of your career.', zh: '你登上了事业巅峰。', fx: { MNY: 2, CHR: 1 }, good: true },

  // ---- 老年 70-89 ----
  { id: 20601, age: [70, 89], w: 2, en: 'You doted on your grandchildren.', zh: '你含饴弄孙。', fx: { SPR: 3 }, good: true },
  { id: 20602, age: [70, 89], w: 1, en: 'An old friend passed away.', zh: '你的老友离世了。', fx: { SPR: -2 }, bad: true },
  { id: 20603, age: [70, 89], w: 1, en: 'Your body grew frail.', zh: '你的身体抱恙。', fx: { STR: -2 }, bad: true, branch: [['STR<2', 19999]] },
  { id: 20604, age: [70, 89], w: 2, en: 'You looked back on your life.', zh: '你回望了自己的一生。', fx: { SPR: 1, INT: 1 }, good: true },
  { id: 20605, age: [70, 89], w: 1, en: 'You wrote your memoirs.', zh: '你写下了回忆录。', fx: { INT: 1, SPR: 1 }, good: true },

  // ---- 百岁 90-100 ----
  { id: 20701, age: [90, 100], w: 2, en: 'You became a living legend of the family.', zh: '你成了家族传奇。', fx: { SPR: 3, CHR: 1 }, good: true },
  { id: 20702, age: [90, 100], w: 4, en: 'Your body reached its limit.', zh: '你的身体到了极限。', fx: { LIF: -1 }, bad: true },
  { id: 20703, age: [90, 100], w: 3, en: 'You passed away peacefully in your sleep.', zh: '你在睡梦中安详离世。', fx: { LIF: -1 } },
];

// 命运抉择（关键年龄必定触发，替代当年随机事件）
export const CHOICES = {
  6: {
    id: 'c06',
    en: 'Pick an after-school class.',
    zh: '选一个兴趣班。',
    a: { en: 'Learn piano', zh: '学钢琴', fx: { CHR: 1 } },
    b: { en: 'Learn chess', zh: '学棋', fx: { INT: 1 } },
  },
  13: {
    id: 'c13',
    en: 'Which path for your studies?',
    zh: '升学之路怎么走？',
    a: { en: 'Grind the exams', zh: '拼命刷题', fx: { INT: 2, SPR: -1 } },
    b: { en: 'Develop fully', zh: '全面发展', fx: { CHR: 1, SPR: 1 } },
  },
  18: {
    id: 'c18',
    en: 'A fork in the road.',
    zh: '人生路口。',
    a: { en: 'Go to university', zh: '去读大学', fx: { INT: 2, MNY: -1 } },
    b: { en: 'Start working', zh: '直接工作', fx: { MNY: 2, INT: -1 } },
  },
  25: {
    id: 'c25',
    en: 'Choose your career path.',
    zh: '事业抉择。',
    a: { en: 'Stable job', zh: '稳定工作', fx: { MNY: 1, SPR: 1 } },
    b: { en: 'Risky venture', zh: '冒险创业', fx: { MNY: 2, STR: -1 } },
  },
  35: {
    id: 'c35',
    en: 'Family or career?',
    zh: '家庭与事业。',
    a: { en: 'Spend time with family', zh: '多陪家人', fx: { SPR: 2 } },
    b: { en: 'Chase the career', zh: '冲刺事业', fx: { MNY: 2, SPR: -1 } },
  },
  50: {
    id: 'c50',
    en: 'Invest in your health.',
    zh: '健康投资。',
    a: { en: 'Exercise regularly', zh: '规律锻炼', fx: { STR: 2 } },
    b: { en: 'Keep working hard', zh: '拼命工作', fx: { MNY: 2, STR: -2 } },
  },
  65: {
    id: 'c65',
    en: 'Arrange your later years.',
    zh: '晚年安排。',
    a: { en: 'Travel the world', zh: '环游世界', fx: { SPR: 2, MNY: -1 } },
    b: { en: 'Rest and settle down', zh: '安享晚年', fx: { STR: 1, SPR: 1 } },
  },
};
