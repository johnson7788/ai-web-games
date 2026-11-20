// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'DONKEY HURDLE',
    'title.tagline': 'Run the Silk Road. Jump the hurdles. Keep the jars.',
    'title.best': 'Best {dist}m',

    // 按钮
    'btn.start': 'Start',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Run again',
    'btn.skip': 'Skip',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Loading the caravan…',
    'set.rotate': 'Rotate for the best view',

    // HUD
    'hud.distance': 'Distance',
    'hud.jars': 'Jars',
    'hud.combo': 'Combo',
    'hud.best': 'Best',
    'hud.segment': 'Leg',
    'hud.full': 'Full load',

    // 段名
    'seg.1': 'Silk Dawn',
    'seg.2': 'Silk Dawn',
    'seg.3': 'Silk Dawn',
    'seg.4': 'Silk Dawn',
    'seg.5': 'Oasis Noon',
    'seg.6': 'Oasis Noon',
    'seg.7': 'Oasis Noon',
    'seg.8': 'Oasis Noon',
    'seg.9': 'Star Night',
    'seg.10': 'Star Night',
    'seg.11': 'Star Night',
    'seg.12': 'Star Night',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 死亡结算
    'result.title': 'Caravan Broken',
    'result.distance': 'Distance',
    'result.jars': 'Jars left',
    'result.segment': 'Farthest leg',
    'result.newRecord': 'NEW RECORD',
    'result.best': 'Best distance',
    'result.hint': 'Press R to run again',

    // 首次交互引导
    'tut.title': 'First caravan',
    'tut.1': 'Tap or press Space to jump',
    'tut.2': 'Hold to jump higher over walls',
    'tut.3': 'Press K to drop a jar for a super jump',
    'tut.4': 'Catch a jar to refill your load',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'DONKEY HURDLE',
    'title.tagline': '赶着商队跑丝路，跳过障碍，护住陶罐。',
    'title.best': '最佳 {dist}m',

    // 按钮
    'btn.start': '出发',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '再跑一次',
    'btn.skip': '跳过',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '商队整装中…',
    'set.rotate': '旋转设备获得最佳体验',

    // HUD
    'hud.distance': '距离',
    'hud.jars': '陶罐',
    'hud.combo': '连击',
    'hud.best': '最佳',
    'hud.segment': '路段',
    'hud.full': '满载',

    // 段名
    'seg.1': '丝路晨',
    'seg.2': '丝路晨',
    'seg.3': '丝路晨',
    'seg.4': '丝路晨',
    'seg.5': '绿洲午',
    'seg.6': '绿洲午',
    'seg.7': '绿洲午',
    'seg.8': '绿洲午',
    'seg.9': '星夜',
    'seg.10': '星夜',
    'seg.11': '星夜',
    'seg.12': '星夜',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 死亡结算
    'result.title': '商队散架',
    'result.distance': '距离',
    'result.jars': '剩余陶罐',
    'result.segment': '最远路段',
    'result.newRecord': '新纪录',
    'result.best': '历史最佳',
    'result.hint': '按 R 键再跑一次',

    // 首次交互引导
    'tut.title': '初次上路',
    'tut.1': '点击或按空格跳跃',
    'tut.2': '长按跳得更高，越过高墙',
    'tut.3': '按 K 丢一个罐换一次超高跳',
    'tut.4': '接住陶罐补充货物',
    'tut.step': '步骤 {n}/{total}',
  },
};
