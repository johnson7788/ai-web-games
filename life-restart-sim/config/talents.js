// 天赋（Gifts）内容表 —— 霓虹转生街机原创主题，替换参考实现的“天赋”文案。
// 字段：
//   grade    0-3 稀有度（越高越稀有）
//   effect   开局一次性效果 { CHR/INT/STR/MNY/SPR: delta }
//   status   额外初始可分配点数
//   condition 条件表达式（AGE?[40] = 40 岁触发；无则开局触发一次）
//   exclusive 互斥天赋 id 列表
//   luckBoost true = 幸运连击翻倍累积
//   revive    true = 死亡时 40% 概率复活一次
export const TALENTS = {
  // ---- grade 0：常见 ----
  '1001': { id: 1001, grade: 0, name: { en: 'Ordinary', zh: '平凡' }, desc: { en: 'No special gifts, no burdens.', zh: '没有特殊的天赋，也没有负担。' } },
  '1002': { id: 1002, grade: 0, name: { en: 'Myopic', zh: '近视' }, desc: { en: 'Intellect +1, Vitality -1.', zh: '才智 +1，体能 -1。' }, effect: { INT: 1, STR: -1 } },
  '1003': { id: 1003, grade: 0, name: { en: 'Night Owl', zh: '夜猫子' }, desc: { en: 'Spirit +1.', zh: '心境 +1。' }, effect: { SPR: 1 } },
  '1004': { id: 1004, grade: 0, name: { en: 'Foodie', zh: '吃货' }, desc: { en: 'Vitality +1.', zh: '体能 +1。' }, effect: { STR: 1 } },
  '1005': { id: 1005, grade: 0, name: { en: 'Introvert', zh: '社恐' }, desc: { en: 'Charm -1, Intellect +1.', zh: '魅力 -1，才智 +1。' }, effect: { CHR: -1, INT: 1 } },
  '1006': { id: 1006, grade: 0, name: { en: 'Collector', zh: '收藏家' }, desc: { en: 'Fortune +1.', zh: '财富 +1。' }, effect: { MNY: 1 } },

  // ---- grade 1：少见 ----
  '1101': { id: 1101, grade: 1, name: { en: 'Precocious', zh: '早慧' }, desc: { en: 'Intellect +1.', zh: '才智 +1。' }, effect: { INT: 1 } },
  '1102': { id: 1102, grade: 1, name: { en: 'Athlete', zh: '运动健将' }, desc: { en: 'Vitality +1.', zh: '体能 +1。' }, effect: { STR: 1 } },
  '1103': { id: 1103, grade: 1, name: { en: 'Artist', zh: '艺术天赋' }, desc: { en: 'Charm +1.', zh: '魅力 +1。' }, effect: { CHR: 1 } },
  '1104': { id: 1104, grade: 1, name: { en: 'Saver', zh: '理财头脑' }, desc: { en: 'Fortune +1.', zh: '财富 +1。' }, effect: { MNY: 1 } },
  '1105': { id: 1105, grade: 1, name: { en: 'Cheerful', zh: '乐天派' }, desc: { en: 'Spirit +1.', zh: '心境 +1。' }, effect: { SPR: 1 } },
  '1106': { id: 1106, grade: 1, name: { en: 'Scholar', zh: '学霸' }, desc: { en: 'Intellect +1.', zh: '才智 +1。' }, effect: { INT: 1 } },
  '1107': { id: 1107, grade: 1, name: { en: 'Rebel', zh: '叛逆者' }, desc: { en: 'Spirit +1, Fortune -1.', zh: '心境 +1，财富 -1。' }, effect: { SPR: 1, MNY: -1 } },
  '1108': { id: 1108, grade: 1, name: { en: 'Silver Spoon', zh: '富家子' }, desc: { en: 'Fortune +2 and +1 starting point.', zh: '财富 +2，初始点数 +1。' }, effect: { MNY: 2 }, status: 1 },
  '1109': { id: 1109, grade: 1, name: { en: 'Late Bloomer', zh: '大器晚成' }, desc: { en: 'At 40, Intellect +4.', zh: '40 岁时才智 +4。' }, condition: 'AGE?[40]', effect: { INT: 4 } },
  '1110': { id: 1110, grade: 1, name: { en: 'Longevity', zh: '长寿基因' }, desc: { en: 'At 60, Vitality +3.', zh: '60 岁时体能 +3。' }, condition: 'AGE?[60]', effect: { STR: 3 } },

  // ---- grade 2：稀有 ----
  '1201': { id: 1201, grade: 2, name: { en: 'Golden Touch', zh: '金手指' }, desc: { en: 'Fortune +3.', zh: '财富 +3。' }, effect: { MNY: 3 } },
  '1202': { id: 1202, grade: 2, name: { en: 'Genius Mind', zh: '天才头脑' }, desc: { en: 'Intellect +3.', zh: '才智 +3。' }, effect: { INT: 3 } },
  '1203': { id: 1203, grade: 2, name: { en: 'Radiant', zh: '倾城之貌' }, desc: { en: 'Charm +3.', zh: '魅力 +3。' }, effect: { CHR: 3 } },
  '1204': { id: 1204, grade: 2, name: { en: 'Iron Body', zh: '钢铁之躯' }, desc: { en: 'Vitality +3.', zh: '体能 +3。' }, effect: { STR: 3 } },
  '1205': { id: 1205, grade: 2, name: { en: 'Optimist', zh: '乐观之心' }, desc: { en: 'Spirit +2.', zh: '心境 +2。' }, effect: { SPR: 2 } },
  '1206': { id: 1206, grade: 2, name: { en: 'Second Wind', zh: '第二人生' }, desc: { en: '+4 starting points.', zh: '初始点数 +4。' }, status: 4 },

  // ---- grade 3：传说 ----
  '1301': { id: 1301, grade: 3, name: { en: 'Chosen Soul', zh: '天命之子' }, desc: { en: '+8 starting points.', zh: '初始点数 +8。' }, status: 8 },
  '1302': { id: 1302, grade: 3, name: { en: 'Echoes of Lives', zh: '轮回之忆' }, desc: { en: 'All stats +2.', zh: '所有属性 +2。' }, effect: { CHR: 2, INT: 2, STR: 2, MNY: 2, SPR: 2 } },
  '1303': { id: 1303, grade: 3, name: { en: 'Lucky Star', zh: '幸运星' }, desc: { en: 'Fortune combo builds twice as fast.', zh: '幸运连击累积速度翻倍。' }, luckBoost: true },
  '1304': { id: 1304, grade: 3, name: { en: 'Undying Soul', zh: '不朽之魂' }, desc: { en: '40% chance to cheat death once.', zh: '死亡时 40% 概率逃脱一次。' }, revive: true },
};

export const TALENT_IDS = Object.keys(TALENTS).map(Number);
