// 国际化文案：en 默认，zh 必做；只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'CONSTELLATION LINE',
    'title.tagline': 'Trace every line once to light a constellation in the sky.',
    'title.best': 'Stars {stars} · Constellations {done}/{total}',

    // 按钮
    'btn.start': 'Trace',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Restart',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.next': 'Next',
    'btn.retry': 'Retry',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Charting the sky…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.level': 'Level',
    'hud.time': 'Time',
    'hud.steps': 'Steps',
    'hud.left': 'Lines left',
    'hud.mistakes': 'Misses',
    'hud.goal': 'Connect every line once',
    'hud.waypoint': 'Reach the North Star',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Constellation Lit!',
    'result.stars': 'Stars',
    'result.score': 'Score',
    'result.steps': 'Steps',
    'result.mistakes': 'Misses',
    'result.time': 'Time',
    'result.best': 'Best score',
    'result.newRecord': 'NEW RECORD',
    'result.fail': 'The sky dimmed',
    'result.failHint': 'Time ran out — trace faster next time.',
    'result.hint': 'Press Enter to retry',

    // 首次交互引导
    'tut.title': 'First trace',
    'tut.1': 'Tap the next star to draw your first line',
    'tut.2': 'Keep connecting — cover every line once',
    'tut.3': 'Light the whole constellation to win',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': '星座连线',
    'title.tagline': '每条线只画一次，把散星连成一整个星座。',
    'title.best': '星星 {stars} · 星座 {done}/{total}',

    // 按钮
    'btn.start': '开始连线',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重来',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.next': '下一关',
    'btn.retry': '再试一次',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '正在铺展星空…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.level': '关卡',
    'hud.time': '时间',
    'hud.steps': '步数',
    'hud.left': '剩余线段',
    'hud.mistakes': '失误',
    'hud.goal': '每条线只连一次',
    'hud.waypoint': '到达北极星',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '星座点亮！',
    'result.stars': '星级',
    'result.score': '得分',
    'result.steps': '步数',
    'result.mistakes': '失误',
    'result.time': '用时',
    'result.best': '最佳得分',
    'result.newRecord': '新纪录',
    'result.fail': '星空暗了下去',
    'result.failHint': '时间用完了——下次连得更快些。',
    'result.hint': '按 Enter 重来',

    // 首次交互引导
    'tut.title': '初次连线',
    'tut.1': '点下一颗星，画出第一条线',
    'tut.2': '继续连线——每条线只画一次',
    'tut.3': '点亮整座星座即可过关',
    'tut.step': '步骤 {n}/{total}',
  },
};
