// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值（i18n-check 校验）。
// 物品名不在这里：物品库自带 en/zh，见 config/items.js。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'SPOT IT',
    'title.tagline': 'Night flea market. One flashlight. Find the goods before the dark wins.',
    'title.best': 'Best level {level} · {score} pts',

    // 按钮
    'btn.start': 'Start',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Play again',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',

    // HUD
    'hud.level': 'Level',
    'hud.time': 'Time',
    'hud.battery': 'Light',
    'hud.score': 'Score',
    'hud.checklist': 'Find these',
    'hud.tapHint': 'Tap items to pick them up',

    // 场景包名
    'scene.book': 'Book Stall',
    'scene.toy': 'Toy Heap',
    'scene.ghost': 'Ghost Market',

    // 结算
    'result.win': 'Market Lit!',
    'result.fail': 'Lights Out',
    'result.score': 'Score',
    'result.level': 'Level reached',
    'result.best': 'Best level',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'The market lights up one stall at a time',
    'result.again': 'Play again',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Setting up the market…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // 首次交互引导（3 步，真实动作）
    'tut.title': 'First night shift',
    'tut.1': 'Move the mouse to sweep your flashlight',
    'tut.2': 'Tap one item from the checklist',
    'tut.3': 'Find them all to light the market',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'SPOT IT',
    'title.tagline': '深夜跳蚤市场，一盏手电，抢在黑暗前找齐清单。',
    'title.best': '最佳第 {level} 关 · {score} 分',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '再来一局',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',

    // HUD
    'hud.level': '关卡',
    'hud.time': '时间',
    'hud.battery': '电量',
    'hud.score': '分数',
    'hud.checklist': '找齐这些',
    'hud.tapHint': '点击物品把它捡起',

    // 场景包名
    'scene.book': '旧书摊',
    'scene.toy': '玩具堆',
    'scene.ghost': '鬼市',

    // 结算
    'result.win': '市场点亮！',
    'result.fail': '灯灭了',
    'result.score': '分数',
    'result.level': '到达关卡',
    'result.best': '最佳关卡',
    'result.newRecord': '新纪录',
    'result.hint': '市场灯一盏盏亮起',
    'result.again': '再来一局',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '正在布置市场…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // 首次交互引导（3 步，真实动作）
    'tut.title': '第一次夜班',
    'tut.1': '移动鼠标扫动手电筒',
    'tut.2': '点击清单里的一件物品',
    'tut.3': '找齐所有物品点亮市场',
    'tut.step': '步骤 {n}/{total}',
  },
};
