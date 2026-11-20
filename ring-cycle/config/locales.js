// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'RING CYCLE',
    'title.tagline': 'Steer the candy ball. Land on your color. Chain five for a rainbow.',
    'title.best': 'Best {score}',

    // 按钮
    'btn.start': 'Play',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Play again',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Mixing candy…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.score': 'Score',
    'hud.band': 'Band',
    'hud.combo': 'Combo',
    'hud.best': 'Best',
    'hud.dye': 'Your color',
    'hud.next': '{n} to next band',

    // 场景包
    'scene.fruity': 'Fruity Workshop',
    'scene.mint': 'Mint Vault',
    'scene.glow': 'Glow Vault',

    // 12 带
    'band.1': 'Fruity · Standard',
    'band.2': 'Fruity · Sparse',
    'band.3': 'Fruity · Moving',
    'band.4': 'Fruity · Color Swap',
    'band.5': 'Mint · Standard',
    'band.6': 'Mint · Narrow',
    'band.7': 'Mint · No White',
    'band.8': 'Mint · Moving Narrow',
    'band.9': 'Glow · Standard',
    'band.10': 'Glow · Swap Scarce',
    'band.11': 'Glow · Moving Fast',
    'band.12': 'Glow · Finale',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Spilled!',
    'result.score': 'Score',
    'result.band': 'Band reached',
    'result.maxCombo': 'Best combo',
    'result.rainbow': 'Rainbow rains',
    'result.best': 'Best score',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to play again',

    // 首次交互引导
    'tut.title': 'First drop',
    'tut.1': 'Steer left / right with arrows or drag',
    'tut.2': 'Land on the ring matching your color',
    'tut.3': 'Chain 5 same colors to rain candy',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'RING CYCLE',
    'title.tagline': '左右操控糖球，落在同色环上，连吃五个触发彩虹糖雨。',
    'title.best': '最高分 {score}',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '再来一局',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '搅拌糖果中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.score': '分数',
    'hud.band': '带',
    'hud.combo': '连击',
    'hud.best': '最佳',
    'hud.dye': '你的颜色',
    'hud.next': '再吃 {n} 环进下一带',

    // 场景包
    'scene.fruity': '果味车间',
    'scene.mint': '薄荷库',
    'scene.glow': '夜光仓',

    // 12 带
    'band.1': '果味 · 标准',
    'band.2': '果味 · 稀疏',
    'band.3': '果味 · 移动',
    'band.4': '果味 · 变色',
    'band.5': '薄荷 · 标准',
    'band.6': '薄荷 · 窄格',
    'band.7': '薄荷 · 无白',
    'band.8': '薄荷 · 移动窄格',
    'band.9': '夜光 · 标准',
    'band.10': '夜光 · 变色稀缺',
    'band.11': '夜光 · 高速移动',
    'band.12': '夜光 · 终章',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '糖球洒了！',
    'result.score': '分数',
    'result.band': '到达带',
    'result.maxCombo': '最大连击',
    'result.rainbow': '彩虹糖雨',
    'result.best': '历史最高分',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再来一局',

    // 首次交互引导
    'tut.title': '初次下落',
    'tut.1': '用左右键或拖动左右操控',
    'tut.2': '落在与你颜色相同的环上',
    'tut.3': '连吃 5 个同色环触发彩虹糖雨',
    'tut.step': '步骤 {n}/{total}',
  },
};
