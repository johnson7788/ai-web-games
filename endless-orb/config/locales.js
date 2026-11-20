// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'ENDLESS ORB',
    'title.tagline': 'Tap to pin photons into the spinning core. Clear all 12 rings.',
    'title.best': 'Best {score}',

    // 按钮
    'btn.start': 'Launch',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Launch again',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.back': 'Back',
    'set.loading': 'Charging…',
    'set.rotate': 'Rotate for the best view',

    // HUD
    'hud.ring': 'Ring',
    'hud.score': 'Score',
    'hud.best': 'Best',
    'hud.pins': 'Pins',
    'hud.overload': 'Heavy photon next',

    // 场景
    'scene.blue': 'BLUE CORE',
    'scene.red': 'RED GIANT',
    'scene.black': 'BLACK HOLE',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc or P to resume',

    // 死亡结算
    'result.title': 'Core Collapse',
    'result.score': 'Score',
    'result.ring': 'Ring reached',
    'result.best': 'Best score',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to launch again',

    // 通关
    'win.title': 'CORE IGNITED',
    'win.score': 'Final score',
    'win.ring': 'All 12 rings cleared',
    'win.hint': 'Press R to launch again',

    // 首次交互引导（3 步真实交互）
    'tut.title': 'First launch',
    'tut.1': 'Tap or press Space to fire a photon',
    'tut.2': 'Pin 3 photons onto the core',
    'tut.3': 'Clear your first ring',
    'tut.step': 'Step {n}/{total}',

    // 环间升级
    'up.title': 'Choose an upgrade',
    'up.pick': 'Pick one to keep this run alive',
    'up.shield': 'Shield',
    'up.polarityResist': 'Polarity Armor',
    'up.heavyBonus': 'Overload Link',
    'up.ghostSlot': 'Ghost Window',
    'up.comboBank': 'Resonance Combo',
    'up.grace': 'Safe Start',
    'up.biggerCore': 'Expanded Core',
    'up.slowCore': 'Decelerator',
    'up.pinSpeed': 'Quick Pin',
    'up.resonance': 'Amplifier',
  },
  zh: {
    // 标题屏
    'title.logo': 'ENDLESS ORB',
    'title.tagline': '点击把光子钉进旋转能量核，清空全部 12 环。',
    'title.best': '最高 {score}',

    // 按钮
    'btn.start': '发射',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '再来一局',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.back': '返回',
    'set.loading': '充能中…',
    'set.rotate': '旋转设备获得最佳体验',

    // HUD
    'hud.ring': '环',
    'hud.score': '得分',
    'hud.best': '最高',
    'hud.pins': '光子',
    'hud.overload': '下一颗是重光子',

    // 场景
    'scene.blue': '蓝星核',
    'scene.red': '红巨核',
    'scene.black': '黑洞核',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 或 P 继续',

    // 死亡结算
    'result.title': '星核坍缩',
    'result.score': '得分',
    'result.ring': '到达环数',
    'result.best': '最高分',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 再来一局',

    // 通关
    'win.title': '星核点燃',
    'win.score': '最终得分',
    'win.ring': '全部 12 环已清空',
    'win.hint': '按 R 再来一局',

    // 首次交互引导
    'tut.title': '初次发射',
    'tut.1': '点击或按空格发射一颗光子',
    'tut.2': '把 3 颗光子钉到能量核上',
    'tut.3': '清空你的第一环',
    'tut.step': '步骤 {n}/{total}',

    // 环间升级
    'up.title': '选择一项升级',
    'up.pick': '选一项让这局继续',
    'up.shield': '护盾',
    'up.polarityResist': '极性护甲',
    'up.heavyBonus': '过载链接',
    'up.ghostSlot': '幽灵窗口',
    'up.comboBank': '共振连击',
    'up.grace': '安全开局',
    'up.biggerCore': '膨胀星核',
    'up.slowCore': '减速器',
    'up.pinSpeed': '快速钉入',
    'up.resonance': '放大器',
  },
};
