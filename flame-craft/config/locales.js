// config/locales.js — 国际化文案：en 默认，zh 必做；只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// 所有 key 平铺字符串、en/zh 一一对应、无空值（i18n-check 硬校验）。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'FLAME CRAFT',
    'title.tagline': 'Feed the ember, craft the perfect flame, dodge the rain.',
    'title.best': 'Best level {level}',
    'title.hint': 'Move · collect fuel · craft 3 flame layers',

    // 按钮
    'btn.start': 'Ignite',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Restart',
    'btn.again': 'Play again',
    'btn.next': 'Next level',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Stoking the coals…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',
    'set.mute': 'Sound',

    // HUD
    'hud.level': 'Level',
    'hud.score': 'Score',
    'hud.lives': 'Lives',
    'hud.combo': 'Combo',
    'hud.tier': 'Flame',
    'hud.fuel': 'Fuel',

    // 火焰三层（焰心/内焰/外焰）——教学核心
    'flame.core': 'Core',
    'flame.inner': 'Inner',
    'flame.outer': 'Outer',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.win.title': 'Flame Forged',
    'result.fail.title': 'Ember Out',
    'result.score': 'Score',
    'result.level': 'Level',
    'result.stars': 'Rating',
    'result.best': 'Best level',
    'result.newRecord': 'NEW RECORD',
    'result.hint.win': 'Press Enter for the next level',
    'result.hint.fail': 'Press R to rekindle',

    // 首次交互引导（3 步真实动作）
    'tut.title': 'First spark',
    'tut.1': 'Move left / right to catch the falling fuel',
    'tut.2': 'Fill the gauge to craft the next flame layer',
    'tut.3': 'Dodge blue rain and hot sparks, catch coal for big fuel',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'FLAME CRAFT',
    'title.tagline': '喂饱火苗，锻造完美火焰，躲开落下的雨滴。',
    'title.best': '最佳关卡 {level}',
    'title.hint': '左右移动 · 收集燃料 · 锻造三层火焰',

    // 按钮
    'btn.start': '点火',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重新开始',
    'btn.again': '再玩一局',
    'btn.next': '下一关',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '正在拨旺炉火…',
    'set.rotate': '旋转屏幕获得最佳视角',
    'set.back': '返回',
    'set.mute': '声音',

    // HUD
    'hud.level': '关卡',
    'hud.score': '分数',
    'hud.lives': '生命',
    'hud.combo': '连击',
    'hud.tier': '火焰',
    'hud.fuel': '燃料',

    // 火焰三层（焰心/内焰/外焰）
    'flame.core': '焰心',
    'flame.inner': '内焰',
    'flame.outer': '外焰',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.win.title': '火焰铸成',
    'result.fail.title': '火苗熄灭',
    'result.score': '分数',
    'result.level': '关卡',
    'result.stars': '评级',
    'result.best': '最佳关卡',
    'result.newRecord': '新纪录',
    'result.hint.win': '按 Enter 进入下一关',
    'result.hint.fail': '按 R 重新点燃',

    // 首次交互引导（3 步真实动作）
    'tut.title': '第一缕火苗',
    'tut.1': '左右移动，接住落下的燃料',
    'tut.2': '填满能量条，锻造下一层火焰',
    'tut.3': '躲开蓝色雨滴与灼热火星，煤块给大份燃料',
    'tut.step': '第 {n}/{total} 步',
  },
};
