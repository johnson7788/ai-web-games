// config/locales.js — 国际化文案：en 默认，zh 必做；只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'STAR SWAP',
    'title.tagline': 'Swap stardust in a deep-space observatory. Line up three to clear.',
    'title.best': 'Best {score}',

    // 按钮
    'btn.start': 'Observe',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Restart',
    'btn.again': 'Play again',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',
    'btn.next': 'Next level',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Focusing…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.level': 'Level',
    'hud.target': 'Target',
    'hud.score': 'Score',
    'hud.moves': 'Moves',
    'hud.lens': 'Lens',
    'hud.combo': 'Combo',
    'hud.scene': 'Sector',
    'hud.gravity': 'Gravity reversed',

    // 场景名
    'scene.river': 'Milky River',
    'scene.orion': 'Orion',
    'scene.south': 'South Gate',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.win.title': 'Sector Clear',
    'result.fail.title': 'Signal Lost',
    'result.score': 'Score',
    'result.level': 'Level',
    'result.stars': 'Rating',
    'result.best': 'Best score',
    'result.newRecord': 'NEW RECORD',
    'result.hint.win': 'Press Enter for the next level',
    'result.hint.fail': 'Press R to observe again',

    // 首次交互引导（≥3 步真实动作）
    'tut.title': 'First observation',
    'tut.1': 'Tap two neighbouring stars to swap them',
    'tut.2': 'Line up 3 or more of one colour to clear',
    'tut.3': 'Clear 4 in a row to forge a special star',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'STAR SWAP',
    'title.tagline': '在深空观测站里交换星屑，连成三颗即消除。',
    'title.best': '最佳 {score}',

    // 按钮
    'btn.start': '开始观测',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '重新开始',
    'btn.again': '再玩一局',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',
    'btn.next': '下一关',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '对焦中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.level': '关卡',
    'hud.target': '目标',
    'hud.score': '得分',
    'hud.moves': '步数',
    'hud.lens': '透镜',
    'hud.combo': '连击',
    'hud.scene': '星区',
    'hud.gravity': '重力已反转',

    // 场景名
    'scene.river': '河内（天河）',
    'scene.orion': '猎户',
    'scene.south': '南门',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.win.title': '星区通关',
    'result.fail.title': '信号中断',
    'result.score': '得分',
    'result.level': '关卡',
    'result.stars': '评级',
    'result.best': '最佳得分',
    'result.newRecord': '新纪录',
    'result.hint.win': '按 Enter 进入下一关',
    'result.hint.fail': '按 R 键重新观测',

    // 首次交互引导
    'tut.title': '首次观测',
    'tut.1': '点击相邻两颗星屑进行交换',
    'tut.2': '同色连成 3 颗即可消除',
    'tut.3': '四连可锻造特殊星',
    'tut.step': '步骤 {n}/{total}',
  },
};
