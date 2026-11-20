// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'STACK SKY',
    'title.tagline': 'Tap to drop the floating island. Align to grow. Reach the sky.',
    'title.best': 'Best {height} islands',

    // 按钮
    'btn.start': 'Ascend',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Ascend again',
    'btn.skip': 'Skip',
    'btn.close': 'Close',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Rising…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.height': 'Height',
    'hud.width': 'Width',
    'hud.combo': 'Perfect',
    'hud.segment': 'Realm',
    'hud.best': 'Best',
    'hud.wind': 'Wind shear!',
    'hud.shrine': 'Shrine layer',

    // 场景包
    'scene.dawn': 'Dawn Clouds',
    'scene.storm': 'Storm Layer',
    'scene.night': 'Starry Palace',

    // 段位名
    'seg.1': 'Dawn Village',
    'seg.2': 'Windrise',
    'seg.3': 'Gust Alley',
    'seg.4': 'Shrine Gate',
    'seg.5': 'Storm Line',
    'seg.6': 'Cloud Wraps',
    'seg.7': 'Thin Air',
    'seg.8': 'Twin Gusts',
    'seg.9': 'Starry Sky',
    'seg.10': 'Narrow Shrine',
    'seg.11': 'Sky Rush',
    'seg.12': 'Heaven Apex',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc or P to resume',

    // 死亡结算
    'result.title': 'Tower Fell',
    'result.height': 'Height',
    'result.maxCombo': 'Best perfect streak',
    'result.segment': 'Highest realm',
    'result.best': 'Best height',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to ascend again',

    // 首次交互引导
    'tut.title': 'First climb',
    'tut.1': 'Tap or press Space to drop the island',
    'tut.2': 'Align with the tower for a Perfect',
    'tut.3': 'Stack 5 islands high',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'STACK SKY',
    'title.tagline': '点击截停浮空岛，对齐叠高，直上云霄。',
    'title.best': '最高 {height} 层',

    // 按钮
    'btn.start': '登塔',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '再登一次',
    'btn.skip': '跳过',
    'btn.close': '关闭',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '升腾中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.height': '高度',
    'hud.width': '宽度',
    'hud.combo': '完美',
    'hud.segment': '层界',
    'hud.best': '最佳',
    'hud.wind': '风切来袭！',
    'hud.shrine': '神龛层',

    // 场景包
    'scene.dawn': '晨曦云海',
    'scene.storm': '雷雨层',
    'scene.night': '星夜天宫',

    // 段位名
    'seg.1': '晨曦民居',
    'seg.2': '风起',
    'seg.3': '风切巷',
    'seg.4': '神龛门',
    'seg.5': '雷雨线',
    'seg.6': '彩云缠绕',
    'seg.7': '稀薄高空',
    'seg.8': '双风阵',
    'seg.9': '星夜',
    'seg.10': '窄神龛',
    'seg.11': '极速登天',
    'seg.12': '天宫之巅',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 或 P 继续',

    // 死亡结算
    'result.title': '塔倒了',
    'result.height': '高度',
    'result.maxCombo': '最大完美连击',
    'result.segment': '最高层界',
    'result.best': '历史最高',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再登一次',

    // 首次交互引导
    'tut.title': '初次登塔',
    'tut.1': '点击或按空格截停浮空岛',
    'tut.2': '对齐塔心拿一次完美',
    'tut.3': '叠到 5 层高',
    'tut.step': '步骤 {n}/{total}',
  },
};
