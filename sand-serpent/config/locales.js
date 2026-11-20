// 国际化文案：en 默认，zh 必做。未完整翻译的语言整块删除（当前只暴露 en/zh）。
export const locales = {
  en: {
    title: 'SAND SERPENT',
    subtitle: 'Burrow the dunes. Eat the desert alive.',
    start: 'Start',
    resume: 'Resume',
    restart: 'Restart',
    home: 'Menu',
    paused: 'Paused',
    language: 'Language',

    // HUD
    level: 'Level',
    length: 'LENGTH',
    score: 'SCORE',
    best: 'Best',
    goal: 'Goal',

    // 食物图鉴（侧栏）
    beetleName: 'Beetle',
    scorpionName: 'Scorpion',
    thornName: 'Camel Thorn',
    beetleDesc: '+1 · safe snack',
    scorpionDesc: '+3 · runs sideways',
    thornDesc: '+5 · drops a tail',

    // 结算
    winTitle: 'Dune Devoured!',
    loseTitle: 'Swallowed by Sand',
    winReason: 'You grew to the goal length!',
    loseWall: 'You slammed into a wall.',
    loseSelf: 'You bit your own tail.',
    loseCactus: 'You impaled yourself on a cactus.',
    loseHard: 'You slid into hard ground.',
    retry: 'Retry',
    next: 'Next',
    nextLevel: 'Next Level',

    // 引导 / 帮助
    replayGuide: 'How to Play',
    howtoTitle: 'How to Burrow',
    tutTitle: 'How to Burrow',
    tutStep1: 'Steer with arrow keys, WASD or a swipe. Turn the serpent now to change direction.',
    tutStep2: 'Chase the glowing beetle and eat it to grow. Scorpions are worth +3 but they run away.',
    tutStep3: 'Grow to the goal length (top bar) to clear the level. Don’t hit walls, cacti or yourself.',
    tutSkip: 'Skip',
    tutNext: 'Got it',

    // 章节名
    chapter1: 'Day Dunes',
    chapter2: 'Oasis Edge',
    chapter3: 'Starlit Desert',

    locked: 'Locked',
    rotateHint: 'Rotate for a bigger board',
    rotateSkip: 'Play anyway',
    sandstormLabel: 'SANDSTORM',
    boostLabel: 'BOOST',
  },
  zh: {
    title: '沙漠沙蟒',
    subtitle: '钻过沙丘，把沙漠吃干抹净。',
    start: '开始',
    resume: '继续',
    restart: '重开',
    home: '菜单',
    paused: '暂停',
    language: '语言',

    level: '关卡',
    length: '长度',
    score: '得分',
    best: '最佳',
    goal: '目标',

    beetleName: '甲虫',
    scorpionName: '蝎子',
    thornName: '骆驼刺',
    beetleDesc: '+1 · 安稳小吃',
    scorpionDesc: '+3 · 会横逃',
    thornDesc: '+5 · 掉一节尾巴',

    winTitle: '吞下整片沙丘！',
    loseTitle: '被流沙吞没',
    winReason: '你长到了目标长度！',
    loseWall: '你一头撞上了墙。',
    loseSelf: '你咬到了自己的尾巴。',
    loseCactus: '你撞上了仙人掌。',
    loseHard: '你滑进了硬地。',
    retry: '再试一次',
    next: '下一关',
    nextLevel: '下一关',

    replayGuide: '玩法说明',
    howtoTitle: '怎么钻沙',
    tutTitle: '怎么钻沙',
    tutStep1: '用方向键 / WASD / 滑动来转向。现在就转个弯试试。',
    tutStep2: '追着发光的甲虫吃下去就能变长。蝎子值 +3 分，但它们会跑。',
    tutStep3: '长到目标长度（顶部长条）就能过关。别撞墙、别撞仙人掌、别咬到自己。',
    tutSkip: '跳过',
    tutNext: '知道了',

    chapter1: '白日沙丘',
    chapter2: '绿洲边缘',
    chapter3: '星夜荒漠',

    locked: '未解锁',
    rotateHint: '转成横屏，棋盘更大更清楚',
    rotateSkip: '就这样玩',
    sandstormLabel: '沙暴',
    boostLabel: '加速',
  },
};
