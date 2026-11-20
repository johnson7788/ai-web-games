// config/story.js — MARRY RICH · 剧情图（原创 IP：小镇姑娘逆袭记，从实习到合伙人）。
// 12 个人生节点（章节），第 9 章「人生十字路口」分三条弧线（大厂 corp / 创业 startup / 合伙 partner），
// 每弧线各 3 个具体节点（n10/n11/n12），共 18 个具体剧情节点，结局在 config/endings.js 判定（8 结局）。
// 属性：abi 能力 / net 人脉 / sav 存款；隐藏好感度：mentor 导师 / partner 搭档 / brand 口碑。
// 每章多为属性取舍（+A −B），关键章节限时（timed）并设 default（保守项，超时自动选）。

export const SCENES = ['town', 'city', 'peak'];

export const NODES = [
  // ---------------------------------------------------------------- 第 1 章 · 毕业选择（小镇）
  {
    id: 'n1',
    chapter: 1,
    scene: 'town',
    timed: false,
    text: {
      en: 'Graduation day. With the 3,000 you scraped together from odd jobs, you stand at the town bus station.',
      zh: '毕业那天，你揣着打工攒下的三千块，站在小镇车站。',
    },
    choices: [
      {
        text: { en: 'Take the bus to the big city', zh: '坐车去大城市闯一闯' },
        effects: { abi: 1, net: 0, sav: -1 },
        result: { en: 'You chase the neon lights.', zh: '你奔向霓虹。' },
        next: 'n2',
      },
      {
        text: { en: 'Stay for a stable town job', zh: '留在家乡安稳上班' },
        effects: { abi: -1, net: 1, sav: 2 },
        result: { en: 'A quiet, safe start.', zh: '安稳平淡的开局。' },
        next: 'n2',
      },
      {
        text: { en: 'Borrow to attend grad school', zh: '借钱读研深造' },
        effects: { abi: 2, net: 0, sav: -2 },
        result: { en: 'Knowledge is your only capital.', zh: '知识是你唯一的资本。' },
        next: 'n2',
      },
    ],
  },

  // ---------------------------------------------------------------- 第 2 章 · 第一份工作（小镇）
  {
    id: 'n2',
    chapter: 2,
    scene: 'town',
    timed: false,
    text: {
      en: 'Your first internship at a small ad agency. The boss wants you to fix the pitch deck all weekend.',
      zh: '你在小广告公司实习，老板让你周末加班改方案。',
    },
    choices: [
      {
        text: { en: 'Polish the deck overnight', zh: '熬夜打磨方案' },
        effects: { abi: 2, net: 0, sav: 0 },
        result: { en: 'Your work gets noticed.', zh: '你的方案被看见。' },
        next: 'n3',
      },
      {
        text: { en: 'Clock out and hit a networking mixer', zh: '准时下班去社交' },
        effects: { abi: 0, net: 2, sav: 0 },
        result: { en: 'You meet useful people.', zh: '你认识了有用的人。' },
        next: 'n3',
      },
      {
        text: { en: 'Take freelance gigs for cash', zh: '接私活赚外快' },
        effects: { abi: 0, net: -1, sav: 2 },
        result: { en: 'Bills covered, contacts thin.', zh: '账单稳了，人脉薄了。' },
        next: 'n3',
      },
    ],
  },

  // ---------------------------------------------------------------- 第 3 章 · 租房与省钱（都市）
  {
    id: 'n3',
    chapter: 3,
    scene: 'city',
    timed: false,
    text: {
      en: 'Rent eats half your paycheck. You must choose how to live.',
      zh: '房租吃掉了半月工资，你要选择怎么活。',
    },
    choices: [
      {
        text: { en: 'Share a cheap flat far away', zh: '合租远郊便宜房' },
        effects: { abi: 0, net: -1, sav: 2 },
        result: { en: 'You save money, lose sleep.', zh: '省了钱，赔了睡眠。' },
        next: 'n4',
      },
      {
        text: { en: 'Rent near the office', zh: '在公司附近租房' },
        effects: { abi: 1, net: 0, sav: -2 },
        result: { en: 'You trade money for time.', zh: '你用钱换了时间。' },
        next: 'n4',
      },
      {
        text: { en: 'Move in with a senior colleague', zh: '搬去和前辈合住' },
        effects: { abi: 1, net: 1, sav: -1 },
        result: { en: 'A mentor by proximity.', zh: '近水楼台的前辈。' },
        next: 'n4',
      },
    ],
  },

  // ---------------------------------------------------------------- 第 4 章 · 职场第一课（都市）
  {
    id: 'n4',
    chapter: 4,
    scene: 'city',
    timed: false,
    text: {
      en: 'A client blames you for a mistake you did not make.',
      zh: '客户把不是你犯的错甩到你头上。',
    },
    choices: [
      {
        text: { en: 'Take the blame quietly', zh: '默默背下这口锅' },
        effects: { abi: -1, net: 2, sav: 0 },
        result: { en: 'You buy peace, lose face.', zh: '你买来安宁，输了面子。' },
        next: 'n5',
      },
      {
        text: { en: 'Present the evidence calmly', zh: '冷静摆出证据' },
        effects: { abi: 2, net: -1, sav: 0 },
        result: { en: 'You earn respect.', zh: '你赢得了尊重。' },
        next: 'n5',
      },
      {
        text: { en: 'Let your boss handle it', zh: '让老板出面解决' },
        effects: { abi: 0, net: 0, sav: 0 },
        flags: { mentor: 1 },
        result: { en: 'You stay safe, learn nothing.', zh: '你躲过一劫，却没长进。' },
        next: 'n5',
      },
    ],
  },

  // ---------------------------------------------------------------- 第 5 章 · 跳槽抉择（都市 · 限时）
  {
    id: 'n5',
    chapter: 5,
    scene: 'city',
    timed: true,
    timeLimitSec: 5,
    default: 1,
    text: {
      en: 'A rival firm offers 40% more. The clock is ticking.',
      zh: '竞对挖你，加薪四成。时间在流逝。',
    },
    choices: [
      {
        text: { en: 'Take the money', zh: '拿钱跳槽' },
        effects: { abi: -1, net: 1, sav: 2 },
        result: { en: 'Jump for pay.', zh: '为钱一跳。' },
        next: 'n6',
      },
      {
        text: { en: 'Stay for the learning curve', zh: '留下继续涨本事' },
        effects: { abi: 2, net: 0, sav: 0 },
        flags: { mentor: 1 },
        result: { en: 'Growth over cash.', zh: '成长胜过现金。' },
        next: 'n6',
      },
      {
        text: { en: 'Counter-offer to both', zh: '两边周旋抬价' },
        effects: { abi: 1, net: 2, sav: -1 },
        result: { en: 'You play both sides.', zh: '你左右逢源。' },
        next: 'n6',
      },
    ],
  },

  // ---------------------------------------------------------------- 第 6 章 · 导师出现（都市）
  {
    id: 'n6',
    chapter: 6,
    scene: 'city',
    timed: false,
    text: {
      en: 'A veteran director offers to mentor you — on her terms.',
      zh: '一位资深总监愿意带你，但有她的条件。',
    },
    choices: [
      {
        text: { en: 'Accept and work twice as hard', zh: '接受，加倍努力' },
        effects: { abi: 2, net: 0, sav: -1 },
        flags: { mentor: 2 },
        result: { en: 'She pushes you hard.', zh: '她把你往死里练。' },
        next: 'n7',
      },
      {
        text: { en: 'Ask for a lighter schedule', zh: '请求轻松一点的安排' },
        effects: { abi: 0, net: 1, sav: 1 },
        result: { en: 'You keep balance.', zh: '你保住了平衡。' },
        next: 'n7',
      },
      {
        text: { en: 'Decline and go independent', zh: '婉拒，独立生长' },
        effects: { abi: 1, net: 0, sav: 1 },
        flags: { mentor: -1 },
        result: { en: 'You walk alone.', zh: '你独自行走。' },
        next: 'n7',
      },
    ],
  },

  // ---------------------------------------------------------------- 第 7 章 · 圈子经营（都市）
  {
    id: 'n7',
    chapter: 7,
    scene: 'city',
    timed: false,
    text: {
      en: 'Industry parties are where deals are born.',
      zh: '行业酒会里藏着机会。',
    },
    choices: [
      {
        text: { en: 'Work the room all night', zh: '整晚满场社交' },
        effects: { abi: 0, net: 3, sav: -1 },
        result: { en: 'Contacts everywhere.', zh: '名片收了一沓。' },
        next: 'n8',
      },
      {
        text: { en: 'Stick with a few real friends', zh: '只和几个真朋友深聊' },
        effects: { abi: 0, net: 1, sav: 0 },
        flags: { partner: 1 },
        result: { en: 'Quality over quantity.', zh: '重质不重量。' },
        next: 'n8',
      },
      {
        text: { en: 'Skip it and do deep work', zh: '不去，埋头打磨' },
        effects: { abi: 2, net: -1, sav: 0 },
        result: { en: 'You master your craft.', zh: '你把本事磨利。' },
        next: 'n8',
      },
    ],
  },

  // ---------------------------------------------------------------- 第 8 章 · 存款危机（都市 · 限时）
  {
    id: 'n8',
    chapter: 8,
    scene: 'city',
    timed: true,
    timeLimitSec: 5,
    default: 1,
    text: {
      en: 'A family emergency drains your savings.',
      zh: '家里急用钱，掏空了你的存款。',
    },
    choices: [
      {
        text: { en: 'Send everything home', zh: '全部寄回家' },
        effects: { abi: 0, net: 1, sav: -2 },
        flags: { partner: 1, brand: 1 },
        result: { en: 'Family first.', zh: '家人第一。' },
        next: 'n9',
      },
      {
        text: { en: 'Send half, keep a buffer', zh: '寄一半，留点缓冲' },
        effects: { abi: 0, net: 0, sav: -1 },
        result: { en: 'A careful balance.', zh: '小心的平衡。' },
        next: 'n9',
      },
      {
        text: { en: 'Borrow to cover it', zh: '借钱周转，保住存款' },
        effects: { abi: 0, net: -1, sav: 0 },
        result: { en: 'Debt, but liquid.', zh: '背了债，但手头不慌。' },
        next: 'n9',
      },
    ],
  },

  // ---------------------------------------------------------------- 第 9 章 · 人生十字路口（限时 · 分弧线）
  {
    id: 'n9',
    chapter: 9,
    scene: 'peak',
    timed: true,
    timeLimitSec: 6,
    default: 0,
    text: {
      en: 'Three doors open at once: a big corp, your own startup, a partnership.',
      zh: '三扇门同时打开：大厂、创业、合伙。',
    },
    choices: [
      {
        text: { en: 'Join the big corp', zh: '加入大厂' },
        effects: { abi: 1, net: 0, sav: 1 },
        arc: 'corp',
        result: { en: 'Stability with a ladder.', zh: '稳定，还有上升梯。' },
        next: 'n10a',
      },
      {
        text: { en: 'Start your own company', zh: '自己创业' },
        effects: { abi: 2, net: 0, sav: -1 },
        flags: { partner: 1 },
        arc: 'startup',
        result: { en: 'All in on yourself.', zh: '把身家押给自己。' },
        next: 'n10b',
      },
      {
        text: { en: 'Accept the partnership offer', zh: '接受合伙人邀请' },
        effects: { abi: 0, net: 2, sav: -1 },
        flags: { partner: 1 },
        arc: 'partner',
        result: { en: 'Trust someone else’s dream.', zh: '相信别人的梦。' },
        next: 'n10c',
      },
    ],
  },

  // ================================================================ 大厂弧线 corp
  {
    id: 'n10a',
    chapter: 10,
    scene: 'peak',
    timed: false,
    arc: 'corp',
    text: {
      en: 'You’re up for a promotion against a senior rival.',
      zh: '你和资深对手竞争同一个晋升名额。',
    },
    choices: [
      {
        text: { en: 'Show results, stay visible', zh: '用业绩说话' },
        effects: { abi: 2, net: 1, sav: 0 },
        result: { en: 'Numbers speak.', zh: '数据替你说话。' },
        next: 'n11a',
      },
      {
        text: { en: 'Ally with your rival', zh: '和对手结盟' },
        effects: { abi: 0, net: 2, sav: 0 },
        flags: { partner: 1 },
        result: { en: 'Enemies to allies.', zh: '化敌为友。' },
        next: 'n11a',
      },
      {
        text: { en: 'Ask your mentor to vouch', zh: '请导师为你背书' },
        effects: { abi: 1, net: 1, sav: 0 },
        flags: { mentor: 1 },
        result: { en: 'Backing matters.', zh: '有人撑腰很重要。' },
        next: 'n11a',
      },
    ],
  },
  {
    id: 'n11a',
    chapter: 11,
    scene: 'peak',
    timed: true,
    timeLimitSec: 5,
    default: 1,
    arc: 'corp',
    text: {
      en: 'A chance to lead the new business unit — but it means relocating.',
      zh: '有机会带队新事业部，但要外派。',
    },
    choices: [
      {
        text: { en: 'Take the leadership role', zh: '接下带队' },
        effects: { abi: 2, net: 1, sav: 1 },
        result: { en: 'You take charge.', zh: '你挑起了大梁。' },
        next: 'n12a',
      },
      {
        text: { en: 'Stay put and stabilize', zh: '留下求稳' },
        effects: { abi: -1, net: 0, sav: 1 },
        result: { en: 'Comfort over climb.', zh: '安稳胜过攀爬。' },
        next: 'n12a',
      },
      {
        text: { en: 'Push for remote leadership', zh: '争取远程带队' },
        effects: { abi: 1, net: 1, sav: 0 },
        result: { en: 'A middle path.', zh: '折中路线。' },
        next: 'n12a',
      },
    ],
  },
  {
    id: 'n12a',
    chapter: 12,
    scene: 'peak',
    timed: false,
    arc: 'corp',
    text: {
      en: 'The board offers you a partner seat. What’s your price?',
      zh: '董事会给你合伙人席位，你的开价是？',
    },
    choices: [
      {
        text: { en: 'Take the seat', zh: '接下席位' },
        effects: { abi: 1, net: 1, sav: 0 },
        result: { en: 'You sign.', zh: '你签了字。' },
        next: 'ending',
      },
      {
        text: { en: 'Demand more equity', zh: '要求更多股权' },
        effects: { abi: 1, net: -1, sav: 1 },
        result: { en: 'You negotiate hard.', zh: '你狠命地谈。' },
        next: 'ending',
      },
      {
        text: { en: 'Step back for life', zh: '退一步，顾生活' },
        effects: { abi: -1, net: 0, sav: -1 },
        result: { en: 'You choose peace.', zh: '你选择了平静。' },
        next: 'ending',
      },
    ],
  },

  // ================================================================ 创业弧线 startup
  {
    id: 'n10b',
    chapter: 10,
    scene: 'peak',
    timed: false,
    arc: 'startup',
    text: {
      en: 'Your startup has no salary and no guarantees.',
      zh: '创业第一年，没工资没保障。',
    },
    choices: [
      {
        text: { en: 'Hustle for your first customer', zh: '先拿下第一个客户' },
        effects: { abi: -1, net: 1, sav: 2 },
        result: { en: 'Revenue first.', zh: '先有营收。' },
        next: 'n11b',
      },
      {
        text: { en: 'Build the product in silence', zh: '埋头打磨产品' },
        effects: { abi: 2, net: 0, sav: -1 },
        result: { en: 'Ship or die.', zh: '要么发布，要么死。' },
        next: 'n11b',
      },
      {
        text: { en: 'Pitch every investor', zh: '到处路演融资' },
        effects: { abi: 1, net: 2, sav: -1 },
        result: { en: 'Story sells.', zh: '故事能卖钱。' },
        next: 'n11b',
      },
    ],
  },
  {
    id: 'n11b',
    chapter: 11,
    scene: 'peak',
    timed: true,
    timeLimitSec: 5,
    default: 0,
    arc: 'startup',
    text: {
      en: 'Cash runs out in six weeks. A buyout offer lands.',
      zh: '现金流只剩六周，收购要约来了。',
    },
    choices: [
      {
        text: { en: 'Sell and walk away', zh: '卖掉离场' },
        effects: { abi: 0, net: 0, sav: 3 },
        flags: { partner: -1 },
        result: { en: 'Take the money.', zh: '落袋为安。' },
        next: 'n12b',
      },
      {
        text: { en: 'Refuse and raise more', zh: '拒绝，再融一轮' },
        effects: { abi: 2, net: 0, sav: -1 },
        flags: { partner: 1 },
        result: { en: 'Double down.', zh: '加注再赌。' },
        next: 'n12b',
      },
      {
        text: { en: 'Sell but stay as CEO', zh: '卖身但留任 CEO' },
        effects: { abi: 1, net: 0, sav: 1 },
        result: { en: 'Both worlds.', zh: '两头都占。' },
        next: 'n12b',
      },
    ],
  },
  {
    id: 'n12b',
    chapter: 12,
    scene: 'peak',
    timed: false,
    arc: 'startup',
    text: {
      en: 'Your company’s fate is decided.',
      zh: '公司的命运即将揭晓。',
    },
    choices: [
      {
        text: { en: 'Push for IPO', zh: '冲击上市' },
        effects: { abi: 1, net: 1, sav: -1 },
        result: { en: 'Go public.', zh: '挂牌敲钟。' },
        next: 'ending',
      },
      {
        text: { en: 'Stay private, stay free', zh: '保持私有，保持自由' },
        effects: { abi: 1, net: 0, sav: 1 },
        result: { en: 'Keep control.', zh: '保住控制权。' },
        next: 'ending',
      },
      {
        text: { en: 'Hand over and rest', zh: '交棒，休息' },
        effects: { abi: -1, net: 0, sav: 1 },
        result: { en: 'Exit quietly.', zh: '安静退场。' },
        next: 'ending',
      },
    ],
  },

  // ================================================================ 合伙弧线 partner
  {
    id: 'n10c',
    chapter: 10,
    scene: 'peak',
    timed: false,
    arc: 'partner',
    text: {
      en: 'Your co-founder wants a different direction.',
      zh: '合伙人和你的方向起了分歧。',
    },
    choices: [
      {
        text: { en: 'Trust their vision', zh: '相信他们的判断' },
        effects: { abi: -1, net: 2, sav: 0 },
        flags: { partner: 2 },
        result: { en: 'Unity first.', zh: '团结优先。' },
        next: 'n11c',
      },
      {
        text: { en: 'Push your own plan', zh: '坚持自己的方案' },
        effects: { abi: 2, net: 0, sav: 0 },
        flags: { partner: -1 },
        result: { en: 'Believe yourself.', zh: '相信自己。' },
        next: 'n11c',
      },
      {
        text: { en: 'Compromise and test both', zh: '折中，两个都试' },
        effects: { abi: 1, net: 1, sav: 0 },
        result: { en: 'Data decides.', zh: '让数据决定。' },
        next: 'n11c',
      },
    ],
  },
  {
    id: 'n11c',
    chapter: 11,
    scene: 'peak',
    timed: true,
    timeLimitSec: 5,
    default: 1,
    arc: 'partner',
    text: {
      en: 'Investors want one clear CEO.',
      zh: '投资人要求一个明确的 CEO。',
    },
    choices: [
      {
        text: { en: 'Step up as CEO', zh: '自己出任 CEO' },
        effects: { abi: 2, net: 1, sav: 0 },
        flags: { partner: -1 },
        result: { en: 'You lead.', zh: '你来掌舵。' },
        next: 'n12c',
      },
      {
        text: { en: 'Back your partner', zh: '力挺合伙人' },
        effects: { abi: -1, net: 1, sav: 0 },
        flags: { partner: 2 },
        result: { en: 'You support.', zh: '你甘当后盾。' },
        next: 'n12c',
      },
      {
        text: { en: 'Split the roles', zh: '拆分职责' },
        effects: { abi: 0, net: 1, sav: 0 },
        flags: { partner: 1 },
        result: { en: 'Shared power.', zh: '共享权力。' },
        next: 'n12c',
      },
    ],
  },
  {
    id: 'n12c',
    chapter: 12,
    scene: 'peak',
    timed: false,
    arc: 'partner',
    text: {
      en: 'The company lands its biggest client.',
      zh: '公司拿下最大客户。',
    },
    choices: [
      {
        text: { en: 'Go all in for scale', zh: '全力扩张' },
        effects: { abi: 2, net: 0, sav: -1 },
        result: { en: 'Grow fast.', zh: '高速扩张。' },
        next: 'ending',
      },
      {
        text: { en: 'Lock in steady profit', zh: '锁定稳定利润' },
        effects: { abi: -1, net: 0, sav: 2 },
        result: { en: 'Profit now.', zh: '当下赚钱。' },
        next: 'ending',
      },
      {
        text: { en: 'Sell your stake high', zh: '高位套现离场' },
        effects: { abi: 0, net: -1, sav: 2 },
        result: { en: 'Cash out.', zh: '套现离场。' },
        next: 'ending',
      },
    ],
  },
];

export function getNode(id) {
  return NODES.find((n) => n.id === id) || null;
}

export function nodeCount() {
  return NODES.length;
}
