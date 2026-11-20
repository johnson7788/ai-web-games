// config/locales.js — 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'LIGHT GRID',
    'title.tagline': 'Tap a node to flip it and its neighbors. Light every circuit to clear the board.',
    'title.best': 'Best {stars}★ · Level {level}',
    'title.chapter': 'Chapter {n} · {name}',

    // 按钮
    'btn.start': 'Power On',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Restart',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.next': 'Next board',
    'btn.retry': 'Retry',
    'btn.share': 'Share',
    'btn.hint': 'Hint',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Charging…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',
    'set.mute': 'Mute',
    'set.volume': 'Volume',

    // HUD
    'hud.level': 'Board',
    'hud.steps': 'Moves',
    'hud.par': 'Par',
    'hud.remaining': 'Fuse',
    'hud.stars': 'Stars',
    'hud.chapter': 'Chapter',
    'hud.best': 'Best',
    'hud.goal': 'GOAL · Light every node',
    'hud.progress': '{lit}/{total} lit',

    // 场景包
    'chapter.motherboard': 'Motherboard',
    'chapter.gpu': 'Graphics Card',
    'chapter.neon': 'Neon Tube',

    // 格型（图例 / 引导）
    'cell.node': 'Node',
    'cell.diode': 'Diode',
    'cell.capacitor': 'Capacitor',
    'cell.relay': 'Relay',
    'cell.insulator': 'Insulator',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.win.title': 'Circuit Complete',
    'result.overload.title': 'Fuse Blown',
    'result.steps': 'Moves',
    'result.par': 'Par',
    'result.stars': 'Stars',
    'result.best': 'Best',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to retry',
    'result.nextHint': 'Enter for next board',

    // 首次交互引导（3 步：真实点击点亮 → 二极管单向下传 → 全部点亮过关）
    'tut.title': 'First power-on',
    'tut.1': 'Tap any node to flip it and its neighbors',
    'tut.2': 'A diode only sends current downward',
    'tut.3': 'Light every cell to clear the board',
    'tut.step': 'Step {n}/{total}',

    // 状态 / 提示
    'status.solved': 'Solved',
    'status.overload': 'Overload!',
    'status.charge': 'Charged',
    'status.blocked': 'Insulated',
    'hint.used': 'Hint reveals one move of a solution',
  },
  zh: {
    // 标题屏
    'title.logo': '光网电路',
    'title.tagline': '点一个节点，翻转它和上下左右。把整块电路点亮即可过关。',
    'title.best': '最佳 {stars}★ · 第 {level} 关',
    'title.chapter': '第 {n} 章 · {name}',

    // 按钮
    'btn.start': '通电',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重新开始',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.next': '下一关',
    'btn.retry': '重试',
    'btn.share': '分享',
    'btn.hint': '提示',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '充电中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',
    'set.mute': '静音',
    'set.volume': '音量',

    // HUD
    'hud.level': '关卡',
    'hud.steps': '步数',
    'hud.par': '标准',
    'hud.remaining': '保险丝',
    'hud.stars': '星级',
    'hud.chapter': '章节',
    'hud.best': '最佳',
    'hud.goal': '目标 · 点亮所有节点',
    'hud.progress': '{lit}/{total} 已点亮',

    // 场景包
    'chapter.motherboard': '主板',
    'chapter.gpu': '显卡',
    'chapter.neon': '霓虹管',

    // 格型（图例 / 引导）
    'cell.node': '节点',
    'cell.diode': '二极管',
    'cell.capacitor': '电容',
    'cell.relay': '继电器',
    'cell.insulator': '绝缘格',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.win.title': '电路已通',
    'result.overload.title': '保险丝熔断',
    'result.steps': '步数',
    'result.par': '标准',
    'result.stars': '星级',
    'result.best': '最佳',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 重试',
    'result.nextHint': '回车进入下一关',

    // 首次交互引导（3 步：真实点击点亮 → 二极管单向下传 → 全部点亮过关）
    'tut.title': '首次通电',
    'tut.1': '点任意节点，翻转它和上下左右',
    'tut.2': '二极管只会把电流往下方传递',
    'tut.3': '点亮每一格即可过关',
    'tut.step': '步骤 {n}/{total}',

    // 状态 / 提示
    'status.solved': '已解决',
    'status.overload': '过载！',
    'status.charge': '已蓄能',
    'status.blocked': '已绝缘',
    'hint.used': '提示会亮出解中的一步',
  },
};
