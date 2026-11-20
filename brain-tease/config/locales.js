// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（其他语言整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值、全平铺。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'BRAIN TEASE',
    'title.tagline': 'Crack the doctor\'s trap puzzles. Every answer is a prank.',
    'title.best': 'Best run {time}',
    'title.cleared': 'Cleared {n}/{total}',

    // 按钮
    'btn.start': 'Start',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Restart',
    'btn.next': 'Next level',
    'btn.retry': 'Retry',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.hint': 'Hint',
    'btn.help': 'Doctor helps',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Warming the lab…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.level': 'Level',
    'hud.chapter': 'Chapter',
    'hud.time': 'Time',
    'hud.stars': 'Stars',
    'hud.mistakes': 'Mistakes',
    'hud.goal': 'Goal',
    'hud.helpUnlocked': 'Doctor is ready to help!',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算（过关）
    'result.title': 'Solved!',
    'result.stars': 'Stars',
    'result.time': 'Time',
    'result.newRecord': 'NEW RECORD',
    'result.best': 'Best',
    'result.hint': 'Press Enter for the next level',
    'result.roastLabel': 'The Doctor says',

    // 通关
    'complete.title': 'You beat the doctor!',
    'complete.sub': 'All 24 pranks cleared',
    'complete.hint': 'Replay for a faster time',

    // 首次交互引导
    'tut.title': 'First prank',
    'tut.1': 'Tap an object to try it',
    'tut.2': 'Drag the thermometer into the ice water',
    'tut.3': 'Crack the level and watch the doctor grin',
    'tut.step': 'Step {n}/{total}',

    // 章节名
    'chapter.1': 'The Lab',
    'chapter.2': 'The Kitchen',
    'chapter.3': 'The Garden',
    'chapter.4': 'The Control Room',
  },
  zh: {
    // 标题屏
    'title.logo': '脑力试炼',
    'title.tagline': '破解博士的整蛊机关，每个答案都是恶作剧。',
    'title.best': '最佳 {time}',
    'title.cleared': '已通 {n}/{total}',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重新开始',
    'btn.next': '下一关',
    'btn.retry': '重试',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.hint': '提示',
    'btn.help': '博士帮你',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '实验室预热中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.level': '关卡',
    'hud.chapter': '章节',
    'hud.time': '时间',
    'hud.stars': '星级',
    'hud.mistakes': '失误',
    'hud.goal': '目标',
    'hud.helpUnlocked': '博士准备好帮你了！',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算（过关）
    'result.title': '破解成功！',
    'result.stars': '星级',
    'result.time': '用时',
    'result.newRecord': '新纪录',
    'result.best': '最佳',
    'result.hint': '按回车进入下一关',
    'result.roastLabel': '博士吐槽',

    // 通关
    'complete.title': '你打败了博士！',
    'complete.sub': '24 关整蛊全部破解',
    'complete.hint': '再玩一次，冲击更快纪录',

    // 首次交互引导
    'tut.title': '初次整蛊',
    'tut.1': '点一下物体试试',
    'tut.2': '把温度计拖进冰水',
    'tut.3': '破解关卡，看博士坏笑',
    'tut.step': '步骤 {n}/{total}',

    // 章节名
    'chapter.1': '实验室',
    'chapter.2': '厨房',
    'chapter.3': '花园',
    'chapter.4': '控制室',
  },
};
