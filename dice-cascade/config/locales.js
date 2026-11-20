// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'DICE CASCADE',
    'title.tagline': 'Bet the runes. Roll the dice. Fill the temple.',
    'title.best': 'Best score {score}',

    // 按钮
    'btn.play': 'Enter temple',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Restart',
    'btn.share': 'Share',
    'btn.bank': 'Bank score',
    'btn.roll': 'Roll',
    'btn.skip': 'Skip',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Entering the temple…',
    'set.rotate': 'Rotate for the best view',

    // HUD
    'hud.score': 'Score',
    'hud.pot': 'Unbanked',
    'hud.target': 'Target',
    'hud.rolls': 'Rolls',
    'hud.bet': 'Bet',
    'hud.rune': 'Rune',
    'hud.stage': 'Temple',
    'hud.betCost': 'cost',

    // 场景名
    'scene.1': 'Stone Temple',
    'scene.2': 'Jade Temple',
    'scene.3': 'Lava Temple',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算卡
    'result.title': 'Temple Run Over',
    'result.win': 'Temple Cleared',
    'result.score': 'Score',
    'result.stage': 'Reached temple',
    'result.best': 'Best score',
    'result.runes': 'Rune level',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to try again',

    // 首次交互引导
    'tut.title': 'First ritual',
    'tut.1': 'Tap a die slot to bet',
    'tut.2': 'Press ROLL to cast the dice',
    'tut.3': 'Reach the target, then BANK your score',
    'tut.step': 'Step {n}/{total}',

    // 玩法提示（HUD 底部提示）
    'hint.needTarget': 'Reach {target} to bank',
    'hint.rollsLeft': '{n} rolls left',
  },
  zh: {
    // 标题屏
    'title.logo': 'DICE CASCADE',
    'title.tagline': '押符文，掷骰子，点亮神殿。',
    'title.best': '最高分 {score}',

    // 按钮
    'btn.play': '进入神殿',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重新开始',
    'btn.share': '分享',
    'btn.bank': '收手保分',
    'btn.roll': '掷骰',
    'btn.skip': '跳过',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '进入神殿中…',
    'set.rotate': '旋转设备获得最佳体验',

    // HUD
    'hud.score': '得分',
    'hud.pot': '未锁定',
    'hud.target': '目标',
    'hud.rolls': '次数',
    'hud.bet': '押注',
    'hud.rune': '符文',
    'hud.stage': '神殿',
    'hud.betCost': '成本',

    // 场景名
    'scene.1': '石殿',
    'scene.2': '翡翠殿',
    'scene.3': '熔岩殿',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算卡
    'result.title': '神殿之行结束',
    'result.win': '神殿已点亮',
    'result.score': '得分',
    'result.stage': '到达神殿',
    'result.best': '历史最高分',
    'result.runes': '符文等级',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再来一局',

    // 首次交互引导
    'tut.title': '首次仪式',
    'tut.1': '点一个骰位下注',
    'tut.2': '按「掷骰」投出符文骰',
    'tut.3': '达到目标后「收手保分」',
    'tut.step': '步骤 {n}/{total}',

    // 玩法提示
    'hint.needTarget': '达到 {target} 分即可收手',
    'hint.rollsLeft': '剩余 {n} 次投掷',
  },
};
