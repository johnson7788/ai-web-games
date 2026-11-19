// 成就（Records）内容表 —— 霓虹转生街机原创主题。
// 字段：
//   kind   'age'   到达某年龄
//          'score' 总评达到某值
//          'luck'  触发幸运馈赠
//          'times' 重开次数达到某值
//   value  阈值
export const ACHIEVEMENTS = [
  { id: 1, name: { en: 'First Reincarnation', zh: '初次转生' }, desc: { en: 'Complete one life.', zh: '完成一次人生。' }, kind: 'age', value: 0 },
  { id: 2, name: { en: 'Coming of Age', zh: '成年' }, desc: { en: 'Reach age 18.', zh: '活到 18 岁。' }, kind: 'age', value: 18 },
  { id: 3, name: { en: 'Sixty Springs', zh: '花甲之年' }, desc: { en: 'Reach age 60.', zh: '活到 60 岁。' }, kind: 'age', value: 60 },
  { id: 4, name: { en: 'Century Soul', zh: '百岁之魂' }, desc: { en: 'Reach age 100.', zh: '活到 100 岁。' }, kind: 'age', value: 100 },
  { id: 5, name: { en: 'Living Legend', zh: '活成传说' }, desc: { en: 'Score 120 or more.', zh: '总评达到 120。' }, kind: 'score', value: 120 },
  { id: 6, name: { en: 'Fortune Favors', zh: '好运连连' }, desc: { en: 'Trigger a fortune boon.', zh: '触发一次幸运馈赠。' }, kind: 'luck', value: 1 },
  { id: 7, name: { en: 'Five Lives', zh: '轮回五次' }, desc: { en: 'Restart 5 times.', zh: '重开 5 次。' }, kind: 'times', value: 5 },
  { id: 8, name: { en: 'Ten Lives', zh: '轮回十次' }, desc: { en: 'Restart 10 times.', zh: '重开 10 次。' }, kind: 'times', value: 10 },
];
