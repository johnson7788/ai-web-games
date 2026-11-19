// 交通安全判断题库（原创双语文案；不复制参考源码的文本/美术）。
// 每题：scene = 程序化场景 key（render 负责画）；statement = 中英文题干；answer = right/wrong。
// round：1=人行道基础 · 2=过马路 · 3=信号灯与危险（三关递进，对应 design.json 的 levels）。
export const QUESTIONS = [
  {
    id: 0,
    scene: 'jaywalk',
    round: 1,
    answer: 'wrong',
    statement: {
      en: 'Cross the street without checking the traffic light.',
      zh: '不看信号灯，直接横穿马路。',
    },
  },
  {
    id: 1,
    scene: 'sidewalk',
    round: 1,
    answer: 'right',
    statement: {
      en: 'Walk along the sidewalk instead of the roadway.',
      zh: '走在人行道上，不走机动车道。',
    },
  },
  {
    id: 2,
    scene: 'skateboard',
    round: 1,
    answer: 'wrong',
    statement: {
      en: 'Ride a skateboard in the middle of the road.',
      zh: '在马路上玩滑板。',
    },
  },
  {
    id: 3,
    scene: 'crosswalk',
    round: 2,
    answer: 'right',
    statement: {
      en: 'Use the zebra crossing to get to the other side.',
      zh: '走斑马线过马路。',
    },
  },
  {
    id: 4,
    scene: 'guardrail',
    round: 2,
    answer: 'wrong',
    statement: {
      en: 'Climb over the guardrail to save a few steps.',
      zh: '为了少走几步，翻越护栏。',
    },
  },
  {
    id: 5,
    scene: 'lookBoth',
    round: 2,
    answer: 'right',
    statement: {
      en: 'Look left and right before you step off the curb.',
      zh: '下台阶前，先左右观察来车。',
    },
  },
  {
    id: 6,
    scene: 'greenCross',
    round: 3,
    answer: 'right',
    statement: {
      en: 'Wait for the green walk signal, then cross.',
      zh: '等绿灯亮了再通过。',
    },
  },
  {
    id: 7,
    scene: 'redWait',
    round: 3,
    answer: 'right',
    statement: {
      en: 'Stop and wait patiently while the light is red.',
      zh: '红灯亮时停下耐心等待。',
    },
  },
  {
    id: 8,
    scene: 'carChase',
    round: 3,
    answer: 'wrong',
    statement: {
      en: 'Chase after a moving bus to catch it.',
      zh: '追赶行驶中的公交车。',
    },
  },
  {
    id: 9,
    scene: 'push',
    round: 3,
    answer: 'wrong',
    statement: {
      en: 'Play and push your friends right next to traffic.',
      zh: '在车流旁边追逐打闹、推搡同伴。',
    },
  },
];

export const ROUND_NAMES = {
  en: ['Sidewalk Basics', 'Crossing', 'Signals & Danger'],
  zh: ['人行道基础', '过马路', '信号灯与危险'],
};
