// 国旗库：条纹旗（竖条 v / 横条 h），colors 为 PALETTE 键。
// 玩家按国家名给每条色带填正确颜色。
export const FLAGS = [
  { country: { en: 'France', zh: '法国' }, orient: 'v', colors: ['blue', 'white', 'red'] },
  { country: { en: 'Italy', zh: '意大利' }, orient: 'v', colors: ['green', 'white', 'red'] },
  { country: { en: 'Belgium', zh: '比利时' }, orient: 'v', colors: ['black', 'yellow', 'red'] },
  { country: { en: 'Ireland', zh: '爱尔兰' }, orient: 'v', colors: ['green', 'white', 'orange'] },
  { country: { en: 'Germany', zh: '德国' }, orient: 'h', colors: ['black', 'red', 'yellow'] },
  { country: { en: 'Netherlands', zh: '荷兰' }, orient: 'h', colors: ['red', 'white', 'blue'] },
  { country: { en: 'Russia', zh: '俄罗斯' }, orient: 'h', colors: ['white', 'blue', 'red'] },
  { country: { en: 'Austria', zh: '奥地利' }, orient: 'h', colors: ['red', 'white', 'red'] },
  { country: { en: 'Spain', zh: '西班牙' }, orient: 'h', colors: ['red', 'yellow', 'red'] },
  { country: { en: 'Ukraine', zh: '乌克兰' }, orient: 'h', colors: ['blue', 'yellow'] },
  { country: { en: 'Poland', zh: '波兰' }, orient: 'h', colors: ['white', 'red'] },
  { country: { en: 'Indonesia', zh: '印度尼西亚' }, orient: 'h', colors: ['red', 'white'] },
  { country: { en: 'Colombia', zh: '哥伦比亚' }, orient: 'h', colors: ['yellow', 'blue', 'red'] },
  { country: { en: 'Armenia', zh: '亚美尼亚' }, orient: 'h', colors: ['red', 'blue', 'orange'] },
  { country: { en: 'Lithuania', zh: '立陶宛' }, orient: 'h', colors: ['yellow', 'green', 'red'] },
  { country: { en: 'Estonia', zh: '爱沙尼亚' }, orient: 'h', colors: ['blue', 'black', 'white'] },
];

export const FLAG_COUNT = FLAGS.length;