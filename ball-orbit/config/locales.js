// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'BALL ORBIT',
    'title.tagline': 'Slingshot meteor swarms. Bend around planets. Break the asteroid belt.',
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
    'set.rotate': 'Rotate for the best view',
    'set.loading': 'Charging…',

    // HUD
    'hud.wave': 'Wave',
    'hud.score': 'Hardness',
    'hud.balls': 'Meteors',
    'hud.comet': 'Comet',

    // 场景
    'scene.dust': 'Inner Dust Belt',
    'scene.gas': 'Gas Giant',
    'scene.deep': 'Deep Space',
    'wave.label': 'Wave {n}',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Belt Overrun',
    'result.score': 'Hardness cleared',
    'result.wave': 'Wave reached',
    'result.best': 'Best hardness',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to launch again',

    // 首次交互引导
    'tut.title': 'First launch',
    'tut.1': 'Drag to aim your slingshot',
    'tut.2': 'Release to fire the meteor swarm',
    'tut.3': 'Break an asteroid',
    'tut.step': 'Step {n}/{total}',

    // 画布内首次提示（无教程时的目标说明）
    'hint.aim': 'Drag to aim · Release to fire',
    'hint.goal': 'Shatter the falling asteroids',
  },
  zh: {
    // 标题屏
    'title.logo': 'BALL ORBIT',
    'title.tagline': '弹弓发射流星群，借行星引力绕背，击碎下坠的陨石带。',
    'title.best': '最佳 {score}',

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
    'set.rotate': '旋转设备获得最佳体验',
    'set.loading': '蓄力中…',

    // HUD
    'hud.wave': '波次',
    'hud.score': '硬度',
    'hud.balls': '流星',
    'hud.comet': '彗星',

    // 场景
    'scene.dust': '内环尘带',
    'scene.gas': '气态巨星',
    'scene.deep': '深空',
    'wave.label': '第 {n} 波',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '陨石带失守',
    'result.score': '清除硬度',
    'result.wave': '到达波次',
    'result.best': '历史最高硬度',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再发射',

    // 首次交互引导
    'tut.title': '首次发射',
    'tut.1': '拖动来瞄准弹弓',
    'tut.2': '松开发射流星群',
    'tut.3': '击碎一颗陨石',
    'tut.step': '步骤 {n}/{total}',

    // 画布内首次提示（无教程时的目标说明）
    'hint.aim': '拖动瞄准 · 松开发射',
    'hint.goal': '击碎下坠的陨石带',
  },
};
