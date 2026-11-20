// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'KNIFE LORE',
    'title.tagline': 'Throw shuriken into the spinning scroll post. Never nick your own blades.',
    'title.best': 'Best level {level}',
    'title.start': 'Throw',
    'title.how': 'How to play',
    'title.settings': 'Settings',

    // 按钮
    'btn.resume': 'Resume',
    'btn.restart': 'Back to title',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.next': 'Next level',
    'btn.retry': 'Retry level',
    'btn.settings': 'Settings',
    'btn.how': 'How to play',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Sharpening…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.level': 'Level',
    'hud.knives': 'Knives',
    'hud.score': 'Score',
    'hud.zantie': 'Iron Cut',
    'hud.zantieHint': 'Reveal a safe angle',

    // 场景包
    'pack.bamboo': 'Bamboo Garden',
    'pack.dusk': 'Dusk City',
    'pack.snow': 'Snow Peak',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 过关
    'clear.title': 'Post Cleaved',
    'clear.score': 'Score',
    'clear.bonus': 'Level bonus',
    'clear.new': 'NEW LEVEL UNLOCKED',
    'clear.hint': 'Next post awaits',

    // 失败
    'fail.title': 'Blade Shattered',
    'fail.score': 'Score',
    'fail.best': 'Best level',
    'fail.hint': 'Your shuriken struck a stuck blade',

    // 通关
    'won.title': 'Master of the Scroll',
    'won.score': 'Total score',
    'won.hint': 'All 12 posts cleaved',

    // 首次交互引导
    'tut.title': 'First throw',
    'tut.1': 'Click or press Space to throw a shuriken',
    'tut.2': 'Stick a blade without hitting another',
    'tut.3': 'Cleave the post to clear the level',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'KNIFE LORE',
    'title.tagline': '向旋转的卷轴桩掷出手里剑，绝不刮到自己插下的刀。',
    'title.best': '最佳关卡 {level}',
    'title.start': '掷刀',
    'title.how': '怎么玩',
    'title.settings': '设置',

    // 按钮
    'btn.resume': '继续',
    'btn.restart': '返回标题',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.next': '下一关',
    'btn.retry': '重试本关',
    'btn.settings': '设置',
    'btn.how': '怎么玩',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '磨刀中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.level': '关卡',
    'hud.knives': '飞刀',
    'hud.score': '分数',
    'hud.zantie': '斩铁',
    'hud.zantieHint': '揭示一个安全角度',

    // 场景包
    'pack.bamboo': '竹庭',
    'pack.dusk': '暮城',
    'pack.snow': '雪岳',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 过关
    'clear.title': '桩已绽裂',
    'clear.score': '分数',
    'clear.bonus': '关卡奖励',
    'clear.new': '解锁新关卡',
    'clear.hint': '下一座桩在等你',

    // 失败
    'fail.title': '刀崩碎了',
    'fail.score': '分数',
    'fail.best': '最佳关卡',
    'fail.hint': '手里剑撞上了已插下的刀',

    // 通关
    'won.title': '卷轴大师',
    'won.score': '总分',
    'won.hint': '十二座桩全部绽裂',

    // 首次交互引导
    'tut.title': '初次掷刀',
    'tut.1': '点击或按空格掷出手里剑',
    'tut.2': '插下一刀且不撞到别的刀',
    'tut.3': '集满刻纹、绽裂卷轴桩过关',
    'tut.step': '步骤 {n}/{total}',
  },
};
