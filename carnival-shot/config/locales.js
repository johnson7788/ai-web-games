// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'CARNIVAL SHOT',
    'title.tagline': 'Shoot lantern ducks at the night fair. Reload early for a speed clip.',
    'title.best': 'Best {score}',
    'title.level': 'Reach {level}',

    // 按钮
    'btn.start': 'Play',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Play again',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Hanging lanterns…',
    'set.rotate': 'Rotate for the best view',

    // HUD
    'hud.score': 'Score',
    'hud.level': 'Level',
    'hud.time': 'Time',
    'hud.ammo': 'Ammo',
    'hud.combo': 'Combo',
    'hud.reload': 'Reload',
    'hud.target': 'Target',
    'hud.quick': 'Speed clip ready',

    // 关卡名
    'level.1': 'Lantern Fair I',
    'level.2': 'Lantern Fair II',
    'level.3': 'Lantern Fair III',
    'level.4': 'Lantern Fair IV',
    'level.5': 'River Lantern I',
    'level.6': 'River Lantern II',
    'level.7': 'River Lantern III',
    'level.8': 'River Lantern IV',
    'level.9': 'Fireworks Night I',
    'level.10': 'Fireworks Night II',
    'level.11': 'Fireworks Night III',
    'level.12': 'Grand Finale',

    // 场景
    'scene.lantern': 'Lantern Fair',
    'scene.river': 'River Lantern',
    'scene.fireworks': 'Fireworks Night',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算卡
    'result.title': 'Fair Closed',
    'result.winTitle': 'Fair Champion!',
    'result.score': 'Score',
    'result.maxCombo': 'Best combo',
    'result.level': 'Level reached',
    'result.best': 'Best score',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to play again',
    'result.target': 'Target {score}',
    'result.missed': 'You needed {need} more points',

    // 奖励轮盘
    'wheel.title': 'Red Duck Reward!',
    'wheel.double': 'Double points',
    'wheel.addTime': '+5 seconds',
    'wheel.fullAmmo': 'Full clip',

    // 首次交互引导
    'tut.title': 'First visit',
    'tut.1': 'Move to aim at a duck',
    'tut.2': 'Click a duck to shoot it',
    'tut.3': 'Press R to reload early (speed clip)',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'CARNIVAL SHOT',
    'title.tagline': '夜市灯笼下打提灯鸭。提前换弹，装速装匣。',
    'title.best': '最高 {score}',
    'title.level': '打到第 {level} 关',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '再玩一次',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '挂灯笼中…',
    'set.rotate': '旋转设备获得最佳体验',

    // HUD
    'hud.score': '分数',
    'hud.level': '关卡',
    'hud.time': '时间',
    'hud.ammo': '弹药',
    'hud.combo': '连击',
    'hud.reload': '换弹',
    'hud.target': '目标',
    'hud.quick': '速装匣就绪',

    // 关卡名
    'level.1': '灯会 一',
    'level.2': '灯会 二',
    'level.3': '灯会 三',
    'level.4': '灯会 四',
    'level.5': '河灯 一',
    'level.6': '河灯 二',
    'level.7': '河灯 三',
    'level.8': '河灯 四',
    'level.9': '烟花夜 一',
    'level.10': '烟花夜 二',
    'level.11': '烟花夜 三',
    'level.12': '终章盛典',

    // 场景
    'scene.lantern': '灯会',
    'scene.river': '河灯',
    'scene.fireworks': '烟花夜',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算卡
    'result.title': '打烊了',
    'result.winTitle': '庙会冠军！',
    'result.score': '分数',
    'result.maxCombo': '最大连击',
    'result.level': '到达关卡',
    'result.best': '历史最高',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再玩一次',
    'result.target': '目标 {score}',
    'result.missed': '还差 {need} 分',

    // 奖励轮盘
    'wheel.title': '红灯鸭奖励！',
    'wheel.double': '双倍积分',
    'wheel.addTime': '+5 秒',
    'wheel.fullAmmo': '弹匣填满',

    // 首次交互引导
    'tut.title': '初次游玩',
    'tut.1': '移动准星瞄准鸭子',
    'tut.2': '点击鸭子射击',
    'tut.3': '按 R 提前换弹（速装匣）',
    'tut.step': '步骤 {n}/{total}',
  },
};
