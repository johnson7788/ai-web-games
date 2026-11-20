// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'HELIX ORBIT',
    'title.tagline': 'Rotate the volcano. Drop through the gaps. Become the meteor.',
    'title.best': 'Best depth {depth}',

    // 按钮
    'btn.start': 'Launch',
    'btn.how': 'How to play',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Launch again',
    'btn.skip': 'Skip',
    'btn.close': 'Close',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Heating up…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.depth': 'Depth',
    'hud.score': 'Score',
    'hud.best': 'Best',
    'hud.crystal': 'Ice',
    'hud.meteor': 'Meteor',
    'hud.freeze': 'Frozen',

    // 主题名
    'theme.crust': 'Crust',
    'theme.obsidian': 'Obsidian',
    'theme.ice': 'Ice Cap',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 死亡结算
    'result.title': 'Descent Over',
    'result.depth': 'Depth',
    'result.score': 'Score',
    'result.newRecord': 'NEW RECORD',
    'result.best': 'Best depth',
    'result.hint': 'Press R to launch again',

    // 首次交互引导
    'tut.title': 'First descent',
    'tut.1': 'Hold ← → or drag to rotate the tower',
    'tut.2': 'Align a gap under the ball to drop through',
    'tut.3': 'Pass 3 layers to enter meteor state',
    'tut.4': 'Smash a magma segment with the meteor',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'HELIX ORBIT',
    'title.tagline': '旋转火山塔，穿过层间缺口，化身流星坠向地心。',
    'title.best': '最深 {depth} 层',

    // 按钮
    'btn.start': '出发',
    'btn.how': '怎么玩',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '再来一次',
    'btn.skip': '跳过',
    'btn.close': '关闭',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '正在加热…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.depth': '深度',
    'hud.score': '分数',
    'hud.best': '最佳',
    'hud.crystal': '冰晶',
    'hud.meteor': '陨石态',
    'hud.freeze': '冻结中',

    // 主题名
    'theme.crust': '岩壳',
    'theme.obsidian': '黑曜',
    'theme.ice': '冰帽',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 死亡结算
    'result.title': '坠落结束',
    'result.depth': '深度',
    'result.score': '分数',
    'result.newRecord': '新纪录',
    'result.best': '历史最深',
    'result.hint': '按 R 键再来一次',

    // 首次交互引导
    'tut.title': '初次下潜',
    'tut.1': '按住 ← → 或拖动来旋转塔层',
    'tut.2': '把缺口对齐到球正下方让它穿落',
    'tut.3': '连穿 3 层进入陨石态',
    'tut.4': '用陨石砸穿一段岩浆',
    'tut.step': '步骤 {n}/{total}',
  },
};
