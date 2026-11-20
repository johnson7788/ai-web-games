// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'BUBBLE REEF',
    'title.tagline': 'Aim, shoot, free the jellyfish.',
    'title.best': 'Best {score}',

    // 按钮
    'btn.start': 'Dive In',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Play again',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.next': 'Next',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Surfacing…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',
    'set.mute': 'Sound',

    // HUD
    'hud.score': 'Score',
    'hud.level': 'Level',
    'hud.combo': 'Combo',
    'hud.clearance': 'Clear',
    'hud.next': 'Next',
    'hud.wildcard': 'Wildcard ready — tap to arm',
    'hud.wildcardLoaded': 'Wildcard loaded',
    'hud.preview': 'Tide preview: {n} left',
    'hud.previewKey': 'P to preview',

    // 关卡
    'level.title': 'Level {n}',
    'level.goal': 'Clear {pct} of the reef',
    'level.cleared': 'Reef Cleared!',

    // 场景包
    'pack.shallow': 'Shallow Reef',
    'pack.night': 'Night Reef',
    'pack.wreck': 'Sunken Wreck',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.win': 'Reef Cleared!',
    'result.lose': 'Tide Too Low',
    'result.score': 'Score',
    'result.level': 'Reached level',
    'result.best': 'Best score',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to play again',

    // 首次交互引导
    'tut.title': 'First dive',
    'tut.1': 'Move to aim the cannon',
    'tut.2': 'Click / tap to shoot',
    'tut.3': 'Match 3 of a color to free them',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'BUBBLE REEF',
    'title.tagline': '瞄准、发射、放归水母。',
    'title.best': '最佳 {score}',

    // 按钮
    'btn.start': '潜入',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '再玩一次',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.next': '下一关',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '上浮中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',
    'set.mute': '声音',

    // HUD
    'hud.score': '分数',
    'hud.level': '关卡',
    'hud.combo': '连击',
    'hud.clearance': '清除',
    'hud.next': '下一颗',
    'hud.wildcard': '百搭就绪——点按装载',
    'hud.wildcardLoaded': '百搭已装载',
    'hud.preview': '潮汐预览：剩 {n} 次',
    'hud.previewKey': '按 P 预览',

    // 关卡
    'level.title': '第 {n} 关',
    'level.goal': '清除礁区 {pct}',
    'level.cleared': '礁区已清！',

    // 场景包
    'pack.shallow': '浅礁',
    'pack.night': '夜礁',
    'pack.wreck': '沉船',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.win': '礁区已清！',
    'result.lose': '潮水太低',
    'result.score': '分数',
    'result.level': '到达关卡',
    'result.best': '最佳分数',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再玩一次',

    // 首次交互引导
    'tut.title': '初次下潜',
    'tut.1': '移动鼠标 / 手指来瞄准炮台',
    'tut.2': '点击 / 轻触发射',
    'tut.3': '同色 3 连即可放归水母',
    'tut.step': '步骤 {n}/{total}',
  },
};
