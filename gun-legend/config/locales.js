// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'GUN LEGEND',
    'title.tagline': 'Aim. Fire. Roll. Reload to the rhythm of the alley.',
    'title.best': 'Best round {round}',
    'title.score': 'Best score {score}',

    // 按钮
    'btn.dive': 'Enter the alley',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Restart',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Loading…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.round': 'Round',
    'hud.hp': 'HP',
    'hud.score': 'Score',
    'hud.combo': 'Combo',
    'hud.weapon': 'Weapon',
    'hud.roll': 'Roll',
    'hud.reload': 'Reload',
    'hud.targets': 'Targets',

    // 武器
    'weapon.revolver': 'Twin Revolvers',
    'weapon.shotgun': 'Twin Shotguns',
    'weapon.smg': 'Twin SMGs',

    // 敌人
    'enemy.knife': 'Blade',
    'enemy.gunner': 'Gunner',
    'enemy.grenadier': 'Bomber',
    'enemy.elite': 'Elite',
    'enemy.boss': 'Boss',

    // 场景
    'scene.alley': 'Rainy Alley',
    'scene.rooftop': 'Rooftop Dusk',
    'scene.restaurant': 'Crimson Hall',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 死亡结算
    'result.title': 'Legend Falls',
    'result.round': 'Round reached',
    'result.score': 'Score',
    'result.maxCombo': 'Best combo',
    'result.best': 'Best round',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to rise again',

    // 白鸽时刻
    'dove.title': 'JOHN WOO MOMENT',
    'dove.sub': 'Both guns empty — a white dove crosses the alley',

    // 首次交互引导
    'tut.title': 'First stand',
    'tut.1': 'Move the pointer to aim',
    'tut.2': 'Click to fire',
    'tut.3': 'Take down an enemy',
    'tut.4': 'Press Shift to roll-dodge',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': '枪神传说',
    'title.tagline': '瞄准、开火、翻滚、踩着巷战的节奏换弹。',
    'title.best': '最佳第 {round} 场',
    'title.score': '最佳得分 {score}',

    // 按钮
    'btn.dive': '踏入巷战',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重开',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '加载中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.round': '第几场',
    'hud.hp': '血量',
    'hud.score': '得分',
    'hud.combo': '连杀',
    'hud.weapon': '武器',
    'hud.roll': '翻滚',
    'hud.reload': '换弹',
    'hud.targets': '目标',

    // 武器
    'weapon.revolver': '双持左轮',
    'weapon.shotgun': '双持散弹',
    'weapon.smg': '双持冲锋',

    // 敌人
    'enemy.knife': '刀手',
    'enemy.gunner': '枪手',
    'enemy.grenadier': '投弹手',
    'enemy.elite': '双持精英',
    'enemy.boss': '大哥',

    // 场景
    'scene.alley': '雨巷',
    'scene.rooftop': '天台夕照',
    'scene.restaurant': '朱红酒楼',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 死亡结算
    'result.title': '枪神陨落',
    'result.round': '到达场次',
    'result.score': '得分',
    'result.maxCombo': '最大连杀',
    'result.best': '最佳场次',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键重新站起',

    // 白鸽时刻
    'dove.title': '吴宇森时刻',
    'dove.sub': '双枪同时清空——白鸽飞过巷口',

    // 首次交互引导
    'tut.title': '初次站场',
    'tut.1': '移动指针来瞄准',
    'tut.2': '点击开火',
    'tut.3': '放倒一个敌人',
    'tut.4': '按 Shift 翻滚闪避',
    'tut.step': '步骤 {n}/{total}',
  },
};
