// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'OCEAN DASH',
    'title.tagline': 'Lead the school. Hold to gather. Ride the current to the finish.',
    'title.best': 'Best segment {n}',
    'title.controls': '↑↓ / WS steer · hold Space gather · J jump',

    // 按钮
    'btn.start': 'Race',
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
    'set.loading': 'Diving in…',
    'set.rotate': 'Rotate for the best view',

    // HUD
    'hud.segment': 'Segment',
    'hud.rank': 'Rank',
    'hud.school': 'School',
    'hud.gather': 'Gather',
    'hud.glide': 'Glide',

    // 场景
    'scene.coral': 'Coral Shallows',
    'scene.trench': 'Deep Trench',
    'scene.mangrove': 'Mangrove',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Race Over',
    'result.win': 'Segment clear!',
    'result.lose': 'Outpaced',
    'result.rank': 'Rank',
    'result.segment': 'Segment',
    'result.school': 'School',
    'result.best': 'Best segment',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to race again',

    // 首次交互引导
    'tut.title': 'First migration',
    'tut.1': 'Steer up or down',
    'tut.2': 'Eat a bubble',
    'tut.3': 'Hold Space to gather',
    'tut.4': 'Win the segment',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'OCEAN DASH',
    'title.tagline': '带领鱼群洄游：按住收拢，借洋流冲向终点。',
    'title.best': '最佳赛段 {n}',
    'title.controls': '↑↓/WS 上下 · 按住空格收拢 · J 跃起',

    // 按钮
    'btn.start': '开跑',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '再跑一局',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '潜入中…',
    'set.rotate': '旋转设备获得最佳体验',

    // HUD
    'hud.segment': '赛段',
    'hud.rank': '名次',
    'hud.school': '鱼群',
    'hud.gather': '收拢',
    'hud.glide': '滑翔',

    // 场景
    'scene.coral': '珊瑚浅滩',
    'scene.trench': '深沟',
    'scene.mangrove': '红树林',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '赛段结束',
    'result.win': '赛段通过！',
    'result.lose': '被反超了',
    'result.rank': '名次',
    'result.segment': '赛段',
    'result.school': '鱼群',
    'result.best': '最佳赛段',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 再跑一局',

    // 首次交互引导
    'tut.title': '初次洄游',
    'tut.1': '上下移动转向',
    'tut.2': '吃一个气泡',
    'tut.3': '按住空格收拢',
    'tut.4': '赢下本赛段',
    'tut.step': '步骤 {n}/{total}',
  },
};
