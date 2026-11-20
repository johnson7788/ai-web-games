// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（其他语言已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'CAKE KART',
    'title.tagline': 'Frosting drift. Sweet weapons. Win the Fondant GP.',
    'title.best': 'Best finish {best}',
    'title.gp': 'Grand Prix · Station {n}/12',

    // 按钮
    'btn.race': 'Race',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Race again',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Baking the track…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.lap': 'Lap',
    'hud.pos': 'Pos',
    'hud.speed': 'Speed',
    'hud.drift': 'Frosting',
    'hud.item': 'Item',
    'hud.itemNone': '—',
    'hud.item.missile': 'Cherry Missile',
    'hud.item.shield': 'Wafer Shield',
    'hud.item.boost': 'Jelly Boost',
    'hud.item.cake': 'Cake Bomb',

    // 场景包
    'scene.1': 'Fondant Plains',
    'scene.2': 'Chocolate Valley',
    'scene.3': 'Ice Cream Peak',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Finish',
    'result.rank': 'Rank',
    'result.time': 'Race time',
    'result.best': 'Best finish',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to race again',

    // 首次交互引导
    'tut.title': 'First lap',
    'tut.1': 'Hold ↑ or press ↑ to throttle',
    'tut.2': 'Press ← → to steer',
    'tut.3': 'Hold Shift while turning to charge a drift',
    'tut.4': 'Release the drift to unleash a frosting boost',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'CAKE KART',
    'title.tagline': '糖霜漂移，甜点武器，赢下翻糖大奖赛。',
    'title.best': '最佳名次 {best}',
    'title.gp': '大奖赛 · 第 {n}/12 站',

    // 按钮
    'btn.race': '开赛',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '再赛一局',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '正在烘焙赛道…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.lap': '圈数',
    'hud.pos': '名次',
    'hud.speed': '速度',
    'hud.drift': '糖霜',
    'hud.item': '道具',
    'hud.itemNone': '—',
    'hud.item.missile': '樱桃导弹',
    'hud.item.shield': '威化护盾',
    'hud.item.boost': '果冻加速',
    'hud.item.cake': '蛋糕炸弹',

    // 场景包
    'scene.1': '翻糖平原',
    'scene.2': '巧克力谷',
    'scene.3': '冰淇淋峰',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '完赛',
    'result.rank': '名次',
    'result.time': '用时',
    'result.best': '最佳名次',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再赛一局',

    // 首次交互引导
    'tut.title': '第一圈',
    'tut.1': '按住 ↑ 或按 ↑ 踩油门',
    'tut.2': '按 ← → 转向',
    'tut.3': '转向时按住 Shift 蓄力漂移',
    'tut.4': '松开漂移，释放糖霜加速',
    'tut.step': '步骤 {n}/{total}',
  },
};
