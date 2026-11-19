// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'CROW BLASTER',
    'title.tagline': 'Blast neon crows off the night skyline with your plasma slingshot.',
    'title.best': 'Best {score}',
    'title.level': 'Level {level}',
    'title.stars': 'Stars {stars}',

    // 按钮
    'btn.start': 'Play',
    'btn.how': 'How to play',
    'btn.resume': 'Resume',
    'btn.restart': 'Play again',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',

    // 设置 / 旋转提示
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.rotate': 'Rotate your device for the best view',
    'set.pause': 'Pause',

    // HUD
    'hud.score': 'SCORE',
    'hud.level': 'LEVEL',
    'hud.crows': 'CROWS',
    'hud.ammo': 'AMMO',
    'hud.time': 'TIME',
    'hud.combo': 'COMBO',

    // 关卡名
    'level.1': 'Neon Skyline',
    'level.2': 'Rooftop Rush',
    'level.3': 'Circuit Nest',
    'level.4': 'Golden Storm',
    'level.5': 'Overclock',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算卡
    'result.winTitle': 'Skyline Cleared!',
    'result.loseTitle': 'Crows Got Away',
    'result.score': 'Score',
    'result.maxCombo': 'Best combo',
    'result.level': 'Level reached',
    'result.stars': 'Stars',
    'result.best': 'Best score',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to play again',

    // 首次交互引导
    'tut.title': 'First flight',
    'tut.step': 'Step {n}/{total}',
    'tut.1': 'Move your finger or mouse to aim the launcher',
    'tut.2': 'Release to fire an energy bolt',
    'tut.3': 'Hit a crow to clear the sky',
  },
  zh: {
    // 标题屏
    'title.logo': 'CROW BLASTER',
    'title.tagline': '用等离子弹弓把霓虹乌鸦打下来。',
    'title.best': '最高 {score}',
    'title.level': '打到第 {level} 关',
    'title.stars': '星星 {stars}',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.resume': '继续',
    'btn.restart': '再玩一次',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',

    // 设置 / 旋转提示
    'set.title': '设置',
    'set.language': '语言',
    'set.rotate': '旋转设备获得最佳体验',
    'set.pause': '暂停',

    // HUD
    'hud.score': '分数',
    'hud.level': '关卡',
    'hud.crows': '乌鸦',
    'hud.ammo': '弹药',
    'hud.time': '时间',
    'hud.combo': '连击',

    // 关卡名
    'level.1': '霓虹天际线',
    'level.2': '屋顶突袭',
    'level.3': '电路巢穴',
    'level.4': '金色风暴',
    'level.5': '超频',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算卡
    'result.winTitle': '天际线清空！',
    'result.loseTitle': '乌鸦逃走了',
    'result.score': '分数',
    'result.maxCombo': '最大连击',
    'result.level': '到达关卡',
    'result.stars': '星星',
    'result.best': '历史最高',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再玩一次',

    // 首次交互引导
    'tut.title': '初次飞行',
    'tut.step': '步骤 {n}/{total}',
    'tut.1': '移动手指或鼠标瞄准弹弓',
    'tut.2': '松开以发射能量弹',
    'tut.3': '命中乌鸦清空天空',
  },
};
