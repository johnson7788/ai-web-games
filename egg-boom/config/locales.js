// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'EGG BOOM',
    'title.tagline': 'Roll, jump, shoot. Crack every dough row.',
    'title.best': 'Best {score}',

    // 按钮
    'btn.start': 'Play',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Play again',
    'btn.again': 'Play again',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Cracking…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.score': 'Score',
    'hud.ammo': 'Ammo',
    'hud.combo': 'Combo',
    'hud.targets': 'Targets',
    'hud.level': 'Level',
    'hud.shell': 'Shell',
    'hud.best': 'Best',

    // 关卡
    'level.1': 'Kitchen Rise',
    'level.2': 'Thick Dough',
    'level.3': 'Floating Fluff',
    'level.4': 'Wiggly Dough',
    'level.5': 'Dessert Line',
    'level.6': 'Armored Shells',
    'level.7': 'Sugar Rush',
    'level.8': 'Narrow Gaps',
    'level.9': 'Midnight Canteen',
    'level.10': 'Late Shift',
    'level.11': 'Full Mix',
    'level.12': 'Final Bake',

    // 场景
    'scene.kitchen': 'Morning Kitchen',
    'scene.dessert': 'Dessert Station',
    'scene.canteen': 'Midnight Canteen',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc or P to resume',

    // 结算
    'result.title': 'Cracked!',
    'result.win': 'KITCHEN CLEAR!',
    'result.score': 'Score',
    'result.level': 'Level',
    'result.maxCombo': 'Best combo',
    'result.best': 'Best score',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to play again',

    // 首次交互引导
    'tut.title': 'First crack',
    'tut.1': 'Hold and release to jump the egg',
    'tut.2': 'Shoot a dough ball with a rice shot',
    'tut.3': 'Crack a dough ball',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'EGG BOOM',
    'title.tagline': '滚、跳、射，打碎每一排面粉团。',
    'title.best': '最佳 {score}',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '再来一局',
    'btn.again': '再来一局',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '开蛋中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.score': '分数',
    'hud.ammo': '弹药',
    'hud.combo': '连击',
    'hud.targets': '目标',
    'hud.level': '关卡',
    'hud.shell': '蛋壳',
    'hud.best': '最佳',

    // 关卡
    'level.1': '厨房初醒',
    'level.2': '厚面团',
    'level.3': '悬空粉团',
    'level.4': '摇摆面团',
    'level.5': '甜品线',
    'level.6': '护甲面团',
    'level.7': '糖霜冲刺',
    'level.8': '窄缝夹击',
    'level.9': '午夜食堂',
    'level.10': '晚班时段',
    'level.11': '全家福',
    'level.12': '终极烘焙',

    // 场景
    'scene.kitchen': '清晨厨房',
    'scene.dessert': '甜品站',
    'scene.canteen': '午夜食堂',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 或 P 继续',

    // 结算
    'result.title': '碎蛋啦！',
    'result.win': '厨房清空！',
    'result.score': '分数',
    'result.level': '关卡',
    'result.maxCombo': '最大连击',
    'result.best': '历史最佳',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再来一局',

    // 首次交互引导
    'tut.title': '初次开蛋',
    'tut.1': '按住再松开，让蛋跳起来',
    'tut.2': '用米粒弹射中一个面粉团',
    'tut.3': '打碎一个面粉团',
    'tut.step': '步骤 {n}/{total}',
  },
};
