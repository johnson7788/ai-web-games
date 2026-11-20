// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'ALIEN SIEGE',
    'title.tagline': 'Purple fog. Fast bugs. One shotgun.',
    'title.best': 'Best wave {wave}',
    'title.controls': 'WASD move · Mouse look · Click shoot · R reload · E mark · Q shield',

    // 按钮
    'btn.start': 'Enter the Alley',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Restart',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',
    'btn.again': 'Fight again',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Loading…',
    'set.rotate': 'Rotate for the best view',

    // HUD
    'hud.wave': 'Wave',
    'hud.boss': 'MOTHER NEST',
    'hud.hp': 'HP',
    'hud.ammo': 'AMMO',
    'hud.shield': 'Shield',
    'hud.weapon': 'Weapon',
    'hud.score': 'Score',
    'hud.scene': 'Zone',

    // 武器
    'weapon.pistol': 'Pistol',
    'weapon.rifle': 'Rifle',
    'weapon.shotgun': 'Shotgun',
    'weapon.laser': 'Laser',

    // 场景
    'scene.1': 'Colonial Alley',
    'scene.2': 'Reaction Field',
    'scene.3': 'Night Sky Port',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.win': 'ALLEY SECURED',
    'result.lose': 'SIEGE BROKEN',
    'result.wave': 'Wave reached',
    'result.kills': 'Kills',
    'result.score': 'Score',
    'result.best': 'Best wave',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to fight again',

    // 首次交互引导
    'tut.title': 'First contact',
    'tut.1': 'Move with WASD (or the left joystick)',
    'tut.2': 'Click to shoot the crawler',
    'tut.3': 'Press E to laser-mark an enemy',
    'tut.4': 'Hold Q to raise your shield',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': '异星围攻',
    'title.tagline': '紫雾巷战，快虫扑脸，一把霰弹枪。',
    'title.best': '最佳波次 {wave}',
    'title.controls': 'WASD 移动 · 鼠标转向 · 点击射击 · R 换弹 · E 标记 · Q 护盾',

    // 按钮
    'btn.start': '进入巷战',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重新开始',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',
    'btn.again': '再战一次',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '加载中…',
    'set.rotate': '旋转设备获得最佳体验',

    // HUD
    'hud.wave': '波次',
    'hud.boss': '母巢',
    'hud.hp': '生命',
    'hud.ammo': '弹药',
    'hud.shield': '护盾',
    'hud.weapon': '武器',
    'hud.score': '分数',
    'hud.scene': '区域',

    // 武器
    'weapon.pistol': '手枪',
    'weapon.rifle': '步枪',
    'weapon.shotgun': '霰弹枪',
    'weapon.laser': '镭射',

    // 场景
    'scene.1': '殖民巷',
    'scene.2': '反应场',
    'scene.3': '夜空港',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.win': '巷战告捷',
    'result.lose': '围攻破防',
    'result.wave': '到达波次',
    'result.kills': '击杀',
    'result.score': '分数',
    'result.best': '最佳波次',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再战',

    // 首次交互引导
    'tut.title': '首次接触',
    'tut.1': '用 WASD 移动（或左摇杆）',
    'tut.2': '点击射击爬行者',
    'tut.3': '按 E 镭射标记敌人',
    'tut.4': '按住 Q 开启护盾',
    'tut.step': '步骤 {n}/{total}',
  },
};
