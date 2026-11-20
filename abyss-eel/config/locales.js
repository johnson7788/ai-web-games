// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'ABYSS EEL',
    'title.tagline': 'Drag to steer. Hold to dash. Break the deep.',
    'title.best': 'Best {depth}m',

    // 按钮
    'btn.dive': 'Dive',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Dive again',
    'btn.skip': 'Skip',
    'btn.close': 'Close',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Diving…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.depth': 'Depth',
    'hud.orbs': 'Orbs',
    'hud.combo': 'Combo',
    'hud.zone': 'Zone',
    'hud.best': 'Best',
    'hud.dash': 'Dash',
    'hud.dashNeed': 'Need 5 orbs to dash',

    // 深度带
    'zone.1': 'Sunlight',
    'zone.2': 'Twilight',
    'zone.3': 'Midnight',
    'zone.4': 'Abyss',
    'zone.5': 'Geyser',
    'zone.boss': 'Geyser Boss',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 死亡结算
    'result.title': 'Dive Over',
    'result.depth': 'Depth',
    'result.maxCombo': 'Best combo',
    'result.zone': 'Deepest zone',
    'result.newRecord': 'NEW RECORD',
    'result.best': 'Best depth',
    'result.hint': 'Press R to dive again',

    // 首次交互引导
    'tut.title': 'First dive',
    'tut.1': 'Drag left or right to steer',
    'tut.2': 'Eat 3 orbs',
    'tut.3': 'Break through a wall',
    'tut.4': 'Hold to dash for 1 second',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'ABYSS EEL',
    'title.tagline': '左右拖动转向，按住冲刺，撞碎深渊。',
    'title.best': '最深 {depth}m',

    // 按钮
    'btn.dive': '潜入',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '再潜一次',
    'btn.skip': '跳过',
    'btn.close': '关闭',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '潜入中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.depth': '深度',
    'hud.orbs': '光珠',
    'hud.combo': '连击',
    'hud.zone': '深度带',
    'hud.best': '最佳',
    'hud.dash': '冲刺',
    'hud.dashNeed': '需 5 珠才能冲刺',

    // 深度带
    'zone.1': '阳光带',
    'zone.2': '暮光带',
    'zone.3': '午夜带',
    'zone.4': '深渊带',
    'zone.5': '热泉带',
    'zone.boss': '热泉 Boss',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 死亡结算
    'result.title': '下潜结束',
    'result.depth': '深度',
    'result.maxCombo': '最大连击',
    'result.zone': '最深带',
    'result.newRecord': '新纪录',
    'result.best': '历史最深',
    'result.hint': '按 R 键再潜一次',

    // 首次交互引导
    'tut.title': '初次下潜',
    'tut.1': '左右拖动来转向',
    'tut.2': '吃 3 颗光珠',
    'tut.3': '撞碎一面墙',
    'tut.4': '按住冲刺 1 秒',
    'tut.step': '步骤 {n}/{total}',
  },
};
