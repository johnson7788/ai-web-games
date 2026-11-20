// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'CELL WARS',
    'title.tagline': 'Infect the dish. Outgrow the red strain.',
    'title.best': 'Best dish {dish}',

    // 按钮
    'btn.start': 'Start',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Play again',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.continue': 'Continue',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.sound': 'Sound',
    'set.loading': 'Culturing…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.dish': 'Dish',
    'hud.rounds': 'Rounds',
    'hud.yourTurn': 'Your turn',
    'hud.enemyTurn': 'Enemy spreading…',
    'hud.phage': 'Phage',
    'hud.phageReady': 'Phage ready',
    'hud.phageCharging': 'Charging {n}/{total}',
    'hud.blue': 'Blue',
    'hud.red': 'Red',

    // 场景包
    'scene.classic': 'CLASSIC DISH',
    'scene.resistance': 'RESISTANCE DISH',
    'scene.mutation': 'MUTATION DISH',

    // 动作提示
    'act.infect': 'Infect',
    'act.nutrient': 'Nutrient',
    'act.phage': 'Phage',
    'hint.tapEnemy': 'Tap an enemy or neutral cell next to your blue cells.',
    'hint.tapOwn': 'Tap your own cell to drop nutrient.',
    'hint.selectPhage': 'Tap a cell to clear a 2×2 enemy area.',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 失败结算
    'result.title': 'Colony Lost',
    'result.dish': 'Dish reached',
    'result.cleared': 'Dishes cleared',
    'result.best': 'Best dish',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to try again',

    // 胜利
    'victory.title': 'Dish Conquered',
    'victory.hint': 'You purified all 12 dishes.',

    // 过关
    'clear.title': 'Dish {dish} cleared',
    'clear.next': 'Next dish {dish}',

    // 首次交互引导
    'tut.title': 'First culture',
    'tut.1': 'Tap a red or gray cell next to your blue cells to infect it',
    'tut.2': 'Tap one of your blue cells to drop nutrient',
    'tut.3': 'Capture an enemy cell to spread your colony',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'CELL WARS',
    'title.tagline': '感染整只培养皿，压过红菌株。',
    'title.best': '最高第 {dish} 皿',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '再来一局',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.continue': '继续',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.sound': '声音',
    'set.loading': '培养中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.dish': '皿',
    'hud.rounds': '回合',
    'hud.yourTurn': '你的回合',
    'hud.enemyTurn': '敌方扩散中…',
    'hud.phage': '噬菌体',
    'hud.phageReady': '噬菌体就绪',
    'hud.phageCharging': '充能 {n}/{total}',
    'hud.blue': '蓝菌',
    'hud.red': '红菌',

    // 场景包
    'scene.classic': '经典皿',
    'scene.resistance': '抗性皿',
    'scene.mutation': '变异皿',

    // 动作提示
    'act.infect': '感染',
    'act.nutrient': '营养滴',
    'act.phage': '噬菌体',
    'hint.tapEnemy': '点击蓝菌旁的红格或灰格发起感染。',
    'hint.tapOwn': '点击己方格子滴下营养。',
    'hint.selectPhage': '点击一个格子，清空 2×2 敌格。',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 失败结算
    'result.title': '菌落覆灭',
    'result.dish': '到达皿',
    'result.cleared': '已通皿数',
    'result.best': '最高皿',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再来一局',

    // 胜利
    'victory.title': '皿盘征服',
    'victory.hint': '你净化了全部 12 只培养皿。',

    // 过关
    'clear.title': '第 {dish} 皿已清',
    'clear.next': '下一皿 {dish}',

    // 首次交互引导
    'tut.title': '首次培养',
    'tut.1': '点击蓝菌旁的红格或灰格发起感染',
    'tut.2': '点击一个己方蓝格滴下营养',
    'tut.3': '占领一个敌方格，让菌落扩散',
    'tut.step': '步骤 {n}/{total}',
  },
};
