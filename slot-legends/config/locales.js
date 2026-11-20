// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（其他语言整块不暴露）。
// key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'SLOT LEGENDS',
    'title.tagline': 'Spin the reels, match the heroes, win the legend\'s chips.',
    'title.best': 'Best balance {bal}',
    'title.level': 'Level {level}',

    // 按钮
    'btn.play': 'Play',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Back to title',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',
    'btn.share': 'Share',
    'btn.again': 'Play again',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Shuffling…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',
    'set.mute.on': 'Sound: on',
    'set.mute.off': 'Sound: off',

    // HUD
    'hud.balance': 'Chips',
    'hud.bet': 'Bet',
    'hud.level': 'Level',
    'hud.tokens': 'Hero tokens',
    'hud.freespin': 'Free spins',
    'hud.win': 'Win',
    'hud.goal': 'Match 3+ on a line to win chips',

    // 场景包
    'scene.tavern': 'Tavern',
    'scene.stronghold': 'Stronghold',
    'scene.nightmarket': 'Night Market',

    // 符号
    'sym.official': 'Official',
    'sym.escort': 'Escort',
    'sym.wine': 'Wine Sage',
    'sym.thief': 'Thief',
    'sym.blade': 'Blade',
    'sym.ingot': 'Ingot',
    'sym.token': 'Gathering Token',
    'sym.wild': 'Hero Wild',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算卡（破产）
    'result.title': 'The tale ends…',
    'result.level': 'Level reached',
    'result.biggestWin': 'Biggest win',
    'result.jackpots': 'Jackpots',
    'result.spins': 'Spins',
    'result.newRecord': 'NEW BEST BALANCE',
    'result.hint': 'Press R or tap Play again',

    // 首次交互引导
    'tut.title': 'First spin',
    'tut.1': 'Tap SPIN to set the reels rolling',
    'tut.2': 'Match 3 heroes on a line to win chips',
    'tut.3': 'Change your bet with the chip buttons',
    'tut.step': 'Step {n}/{total}',

    // 控制 / 反馈
    'ctl.spin': 'SPIN',
    'ctl.stop': 'STOP',
    'ctl.escort': 'Escort bet',
    'ctl.escort.on': 'Escort ON',
    'ctl.escort.off': 'Escort OFF',
    'ctl.escort.locked': 'Escort · Lv.{level}',
    'ctl.pity': 'Pity ready!',
    'ctl.free': 'FREE SPIN',
    'ctl.win': 'WIN {amount}',
    'ctl.bigwin': 'BIG WIN!',
    'ctl.jackpot': 'JACKPOT!',
    'ctl.levelup': 'LEVEL {level}',
    'ctl.freespins': '{n} FREE SPINS',
    'ctl.bankrupt': 'Out of chips',

    // 合规（虚拟筹码）
    'note.fun': 'Virtual chips — for fun only, no real money.',

    // 倍率表
    'pay.title': 'Paytable',
    'pay.bet': '× bet',
  },
  zh: {
    // 标题屏
    'title.logo': 'SLOT LEGENDS',
    'title.tagline': '转动轮盘，凑齐好汉，赢下侠盗的传说筹码。',
    'title.best': '最高余额 {bal}',
    'title.level': '等级 {level}',

    // 按钮
    'btn.play': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '返回标题',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',
    'btn.share': '分享',
    'btn.again': '再来一局',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '洗牌中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',
    'set.mute.on': '声音：开',
    'set.mute.off': '声音：关',

    // HUD
    'hud.balance': '筹码',
    'hud.bet': '下注',
    'hud.level': '等级',
    'hud.tokens': '好汉令',
    'hud.freespin': '免费旋转',
    'hud.win': '赢得',
    'hud.goal': '一条线凑齐 3 个以上即赢筹码',

    // 场景包
    'scene.tavern': '酒馆',
    'scene.stronghold': '山寨',
    'scene.nightmarket': '夜市',

    // 符号
    'sym.official': '官府',
    'sym.escort': '镖师',
    'sym.wine': '酒仙',
    'sym.thief': '神偷',
    'sym.blade': '刀客',
    'sym.ingot': '元宝',
    'sym.token': '聚义令',
    'sym.wild': '好汉',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算卡（破产）
    'result.title': '传说落幕…',
    'result.level': '达到等级',
    'result.biggestWin': '最大单赢',
    'result.jackpots': '大奖次数',
    'result.spins': '旋转次数',
    'result.newRecord': '新最高余额',
    'result.hint': '按 R 或点「再来一局」',

    // 首次交互引导
    'tut.title': '初次旋转',
    'tut.1': '点「旋转」让轮盘转起来',
    'tut.2': '一条线上凑齐 3 个好汉即赢筹码',
    'tut.3': '用筹码按钮调整下注',
    'tut.step': '步骤 {n}/{total}',

    // 控制 / 反馈
    'ctl.spin': '旋转',
    'ctl.stop': '停止',
    'ctl.escort': '押镖',
    'ctl.escort.on': '押镖开',
    'ctl.escort.off': '押镖关',
    'ctl.escort.locked': '押镖 · 等级{level}',
    'ctl.pity': '保底就绪！',
    'ctl.free': '免费旋转',
    'ctl.win': '赢得 {amount}',
    'ctl.bigwin': '大奖！',
    'ctl.jackpot': '大奖！',
    'ctl.levelup': '等级 {level}',
    'ctl.freespins': '{n} 次免费旋转',
    'ctl.bankrupt': '筹码用尽',

    // 合规（虚拟筹码）
    'note.fun': '虚拟筹码，纯娱乐，无真钱。',

    // 倍率表
    'pay.title': '倍率表',
    'pay.bet': '×下注',
  },
};
