// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'CORGI DASH',
    'title.tagline': 'Tap to jump. Herd sheep. Perfect landings unleash the surge.',
    'title.best': 'Best {score}',

    // 按钮
    'btn.start': 'Run',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Run again',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Herding…',
    'set.rotate': 'Rotate for the best view',
    'set.mute': 'Mute',
    'set.shake': 'Screen shake',

    // HUD
    'hud.score': 'Score',
    'hud.distance': 'Distance',
    'hud.flock': 'Sheep',
    'hud.segment': 'Leg',
    'hud.best': 'Best',
    'hud.whistle': 'Whistle',
    'hud.next': 'Next',

    // 章节名
    'seg.1': 'Misty Meadow',
    'seg.2': 'Rolling Hay',
    'seg.3': 'Puddle Hop',
    'seg.4': 'Bridge Run',
    'seg.5': 'Double Fence',
    'seg.6': 'Moving Pen',
    'seg.7': 'Whistle Row',
    'seg.8': 'Wheat Rush',
    'seg.9': 'Storm Hills',
    'seg.10': 'Gauntlet',
    'seg.11': 'All Obstacles',
    'seg.12': 'Final Sprint',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 死亡结算
    'result.title': 'Run Over',
    'result.distance': 'Distance',
    'result.score': 'Score',
    'result.flock': 'Sheep herded',
    'result.segment': 'Deepest leg',
    'result.newRecord': 'NEW RECORD',
    'result.best': 'Best score',
    'result.hint': 'Press R to run again',

    // 首次交互引导
    'tut.title': 'First run',
    'tut.1': 'Tap / Space to jump the fence',
    'tut.2': 'Run through sheep to herd them',
    'tut.3': 'Double-tap / S to whistle',
    'tut.4': 'Graze an obstacle by ≤10px for a perfect jump',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': '柯基冲刺',
    'title.tagline': '点击跳跃，赶羊成群，完美落点触发牧羊冲鸭。',
    'title.best': '最佳 {score}',

    // 按钮
    'btn.start': '开跑',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '再跑一次',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '赶羊中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.mute': '静音',
    'set.shake': '震屏',

    // HUD
    'hud.score': '分数',
    'hud.distance': '距离',
    'hud.flock': '羊群',
    'hud.segment': '路段',
    'hud.best': '最佳',
    'hud.whistle': '口哨',
    'hud.next': '下一目标',

    // 章节名
    'seg.1': '晨雾草原',
    'seg.2': '滚草来袭',
    'seg.3': '水坑跳跃',
    'seg.4': '桥洞穿行',
    'seg.5': '双连栅',
    'seg.6': '移动羊圈',
    'seg.7': '口哨横排',
    'seg.8': '麦浪冲刺',
    'seg.9': '暴雨山丘',
    'seg.10': '混合长跑',
    'seg.11': '全类型',
    'seg.12': '终局冲刺',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 死亡结算
    'result.title': '本局结束',
    'result.distance': '距离',
    'result.score': '分数',
    'result.flock': '赶到的羊',
    'result.segment': '最远路段',
    'result.newRecord': '新纪录',
    'result.best': '历史最佳',
    'result.hint': '按 R 键再跑一次',

    // 首次交互引导
    'tut.title': '初次开跑',
    'tut.1': '点击 / 空格跳过栅栏',
    'tut.2': '跑过羊群把它们赶来',
    'tut.3': '双击 / S 吹口哨',
    'tut.4': '以 ≤10px 擦顶越过障碍完成完美跳',
    'tut.step': '步骤 {n}/{total}',
  },
};
