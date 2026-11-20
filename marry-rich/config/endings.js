// config/endings.js — MARRY RICH · 8 结局判定。
// 结局按顺序匹配，第一个 (arc 匹配 && rule 通过) 者胜出；每条弧线末尾都有一个恒真兜底，保证总能出结局。
// 隐藏好感度（mentor 导师 / partner 搭档 / brand 口碑）参与巅峰结局判定，让「分支好感度」真正影响结局。

export const ENDINGS = [
  {
    id: 'queen',
    arc: 'any',
    title: { en: 'Comeback Queen', zh: '逆袭女王' },
    tagline: { en: 'From a small town to the very top.', zh: '从小镇一路登顶。' },
    text: {
      en: 'You turned every setback into a step up. Capable, connected and wealthy — the town girl who wrote her own empire.',
      zh: '你把每一次挫折都踩成台阶。有能力、有人脉、有存款——那个小镇姑娘，亲手写下自己的帝国。',
    },
    rule: (s) => s.abi >= 7 && s.net >= 6 && s.sav >= 4 && s.brand >= 1,
  },
  {
    id: 'home',
    arc: 'any',
    title: { en: 'A Quiet Return', zh: '小镇归隐' },
    tagline: { en: 'Burnout sent you home — and you found peace.', zh: '耗尽后你回家，反而找到了安宁。' },
    text: {
      en: 'The city wore you out. You came home with little to show but a clear heart, and it was enough.',
      zh: '城市把你耗干了。你两手空空地回家，却带着一颗通透的心——这已经足够。',
    },
    rule: (s) => s.abi <= 5 && s.net <= 5 && s.sav <= 3,
  },
  {
    id: 'corp_peak',
    arc: 'corp',
    title: { en: 'Partner of the Firm', zh: '巅峰合伙人' },
    tagline: { en: 'You climbed the ladder to the boardroom.', zh: '你顺着梯子爬进了董事会。' },
    text: {
      en: 'Your mentor’s backing and your own results put you on the board. The big corp finally has your name on the door.',
      zh: '导师的背书加上你的业绩，把你送进了董事会。大厂门口，终于挂上了你的名字。',
    },
    rule: (s) => s.abi >= 6 && s.net >= 4 && s.mentor >= 2,
  },
  {
    id: 'corp_steady',
    arc: 'corp',
    title: { en: 'The Steady Manager', zh: '稳健中层' },
    tagline: { en: 'A solid career, a balanced life.', zh: '扎实的事业，平衡的生活。' },
    text: {
      en: 'You traded the very top for a stable, respected position — and a life outside the office.',
      zh: '你用最高处换来了一个稳定受尊敬的位置，以及办公室之外的生活。',
    },
    rule: () => true,
  },
  {
    id: 'startup_ipo',
    arc: 'startup',
    title: { en: 'Founder of the IPO', zh: '上市创始人' },
    tagline: { en: 'The little startup that made the bell ring.', zh: '一家小公司，敲响了上市的钟。' },
    text: {
      en: 'You refused to sell, kept your co-founders close, and took the company public. The risk paid off.',
      zh: '你拒绝收购、紧抱合伙人，把公司带上了市。那一把赌赢了。',
    },
    rule: (s) => s.abi >= 6 && s.sav >= 4 && s.partner >= 2,
  },
  {
    id: 'startup_survivor',
    arc: 'startup',
    title: { en: 'The Survivor', zh: '幸存小老板' },
    tagline: { en: 'You kept the lights on.', zh: '你把公司熬活了。' },
    text: {
      en: 'No IPO, no fireworks — but you own a business that pays and a life you control.',
      zh: '没有上市，没有烟花——但你拥有一家能赚钱的公司，和一个自己说了算的人生。',
    },
    rule: () => true,
  },
  {
    id: 'partner_cofound',
    arc: 'partner',
    title: { en: 'Co-founder, Full Circle', zh: '联合创始人' },
    tagline: { en: 'Trust turned into a company you built together.', zh: '信任变成了你们一起建起来的公司。' },
    text: {
      en: 'You and your partner built something neither of you could have alone. The name on the door is plural.',
      zh: '你和合伙人一起，建成了单打独斗做不出的东西。门上的名字，是两个人。',
    },
    rule: (s) => s.net >= 6 && s.abi >= 5 && s.partner >= 2,
  },
  {
    id: 'partner_out',
    arc: 'partner',
    title: { en: 'Bought Out', zh: '合伙人出局' },
    tagline: { en: 'You took the money and left the table.', zh: '你拿了钱，离开牌桌。' },
    text: {
      en: 'The partnership frayed, and you walked away with a check. Not the dream — but a clean exit.',
      zh: '合伙关系裂了，你带着一张支票离场。不是梦想中的结局，但走得很干净。',
    },
    rule: () => true,
  },
];

export function resolveEnding(state) {
  const { abi = 0, net = 0, sav = 0, mentor = 0, partner = 0, brand = 0, arc = null } = state;
  const s = { abi, net, sav, mentor, partner, brand };
  for (const e of ENDINGS) {
    if (e.arc !== 'any' && e.arc !== arc) continue;
    if (e.rule(s)) return e;
  }
  return ENDINGS[ENDINGS.length - 1]; // 理论不可达；兜底
}

export function endingById(id) {
  return ENDINGS.find((e) => e.id === id) || null;
}
