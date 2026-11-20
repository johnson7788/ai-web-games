// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'IDIOM FORGE',
    'title.tagline': 'Fill the idiom. Forge the blade.',
    'title.best': 'Best {score}',
    'title.forge': '{n}/12 weapons forged',
    'title.sub': '成语熔炉',

    // 按钮
    'btn.forge': 'Forge',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Forge again',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.hint': 'Hint',
    'btn.reset': 'Reset',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Heating the forge…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',
    'set.mute': 'Sound',

    // HUD
    'hud.level': 'Level',
    'hud.score': 'Score',
    'hud.combo': 'Combo',
    'hud.time': 'Time',
    'hud.hints': 'Hints',
    'hud.resets': 'Resets',
    'hud.slag': 'Slag',
    'hud.weapons': 'Weapons',
    'hud.forge': 'Forge',

    // 场景包
    'scene.0': 'Blacksmith',
    'scene.1': 'Academy',
    'scene.2': 'Sky Workshop',

    // 题目
    'q.meaning': 'Meaning',
    'q.riddle': 'Riddle · ×2',
    'q.riddleClue': 'Clue',
    'q.fillIn': 'Fill the missing {n}',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Forge Over',
    'result.winTitle': 'Master Smith!',
    'result.score': 'Score',
    'result.level': 'Level reached',
    'result.maxCombo': 'Best combo',
    'result.weapons': 'Weapons forged',
    'result.newRecord': 'NEW RECORD',
    'result.best': 'Best score',
    'result.hint': 'Press R to forge again',
    'result.winHint': 'All 12 weapons forged',

    // 首次交互引导
    'tut.title': 'First forge',
    'tut.1': 'Tap a tile from the grid',
    'tut.2': 'Fill the correct character',
    'tut.3': 'Complete an idiom to forge',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': '成语熔炉',
    'title.tagline': '补全成语，锻造成刃。',
    'title.best': '最高 {score}',
    'title.forge': '已铸 {n}/12 件神兵',
    'title.sub': 'IDIOM FORGE',

    // 按钮
    'btn.forge': '开铸',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '再铸一次',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.hint': '提示',
    'btn.reset': '重置',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '熔炉加热中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',
    'set.mute': '声音',

    // HUD
    'hud.level': '关卡',
    'hud.score': '得分',
    'hud.combo': '连击',
    'hud.time': '时间',
    'hud.hints': '提示',
    'hud.resets': '重置',
    'hud.slag': '炉渣',
    'hud.weapons': '神兵',
    'hud.forge': '熔炉',

    // 场景包
    'scene.0': '铁匠铺',
    'scene.1': '书院',
    'scene.2': '天工阁',

    // 题目
    'q.meaning': '释义',
    'q.riddle': '字谜 · ×2',
    'q.riddleClue': '谜面',
    'q.fillIn': '补全缺失的 {n} 字',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '铸炼结束',
    'result.winTitle': '铸成大师！',
    'result.score': '得分',
    'result.level': '到达关卡',
    'result.maxCombo': '最大连击',
    'result.weapons': '铸成神兵',
    'result.newRecord': '新纪录',
    'result.best': '最高分',
    'result.hint': '按 R 键再铸一次',
    'result.winHint': '十二神兵全部铸成',

    // 首次交互引导
    'tut.title': '初次铸炼',
    'tut.1': '从字格里点选一个字',
    'tut.2': '填对缺失的字',
    'tut.3': '补全成语完成铸造',
    'tut.step': '步骤 {n}/{total}',
  },
};
