// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'SAUCER STRIKE',
    'title.tagline': 'Drag to aim & charge. Release to fire. Hold the radar.',
    'title.best': 'Best {score}',

    // 按钮
    'btn.dive': 'Defend',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Defend again',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.tracer': 'Tracer',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Locking on…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.score': 'Score',
    'hud.wave': 'Wave',
    'hud.lives': 'Lives',
    'hud.heat': 'Heat',
    'hud.tracer': 'Tracer',
    'hud.combo': 'Combo',
    'hud.chapter': 'Sector',

    // 章节
    'chapter.1': 'Desert Radar',
    'chapter.2': 'Aurora Base',
    'chapter.3': 'Skyline Grid',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.victory': 'SECTOR CLEAR',
    'result.defeat': 'RADAR LOST',
    'result.score': 'Score',
    'result.bestWave': 'Wave reached',
    'result.rating': 'Rating',
    'result.best': 'Best score',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to defend again',

    // 首次交互引导
    'tut.title': 'First contact',
    'tut.1': 'Drag to aim the railgun',
    'tut.2': 'Release to fire',
    'tut.3': 'Hit a saucer',
    'tut.4': 'Fire the tracer to reveal cloaked saucers',
    'tut.step': 'Step {n}/{total}',

    // 升级
    'upgrade.title': 'Choose an upgrade',
    'upgrade.pick': 'Pick 1 of 3',
    'upgrade.coolant': 'Coolant loop — overheat lock halved',
    'upgrade.pierce': 'Piercing coil — shots pierce +1 saucer',
    'upgrade.tracerPlus': 'Flare reserve — +1 tracer per wave, reveal +3s',
    'upgrade.split': 'Split shell — hits split into 2 shards',
    'upgrade.overcharge': 'Overcharge — full-charge +50% dmg, hotter gun',
    'upgrade.radar': 'Radar boost — cloaked saucers flicker 2× more',
    'upgrade.comboBank': 'Combo shield — combo ≥5 blocks one escape',
    'upgrade.magnet': 'Seeker coil — shots home slightly',
    'upgrade.rapid': 'Rapid relay — fire cooldown −20%',
    'upgrade.damage': 'Focus lens — damage +25%',
    'upgrade.lives': 'Aux power — +1 life',
    'upgrade.coolRate': 'Heat sink — overheat cools +30%',
  },
  zh: {
    // 标题屏
    'title.logo': 'SAUCER STRIKE',
    'title.tagline': '拖动瞄准蓄力，松开发射，守住雷达。',
    'title.best': '最高分 {score}',

    // 按钮
    'btn.dive': '出击',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '再守一次',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.tracer': '曳光弹',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '锁定中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.score': '得分',
    'hud.wave': '波次',
    'hud.lives': '生命',
    'hud.heat': '热量',
    'hud.tracer': '曳光',
    'hud.combo': '连击',
    'hud.chapter': '战区',

    // 章节
    'chapter.1': '荒漠雷达站',
    'chapter.2': '极光基地',
    'chapter.3': '城市天际线',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.victory': '战区肃清',
    'result.defeat': '雷达失守',
    'result.score': '得分',
    'result.bestWave': '到达波次',
    'result.rating': '评级',
    'result.best': '最高分',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再守一次',

    // 首次交互引导
    'tut.title': '初次接触',
    'tut.1': '拖动来瞄准磁轨炮',
    'tut.2': '松开手指发射',
    'tut.3': '命中一架飞碟',
    'tut.4': '发射曳光弹，让隐形碟现形',
    'tut.step': '步骤 {n}/{total}',

    // 升级
    'upgrade.title': '选择一项升级',
    'upgrade.pick': '三选一',
    'upgrade.coolant': '冷却回路 — 过热锁炮时长减半',
    'upgrade.pierce': '穿透线圈 — 炮弹多穿透 1 个飞碟',
    'upgrade.tracerPlus': '曳光储备 — 每波 +1 发、显形 +3s',
    'upgrade.split': '分裂弹 — 命中后分裂 2 个弹片',
    'upgrade.overcharge': '过载 — 满蓄伤害 +50%，但更易过热',
    'upgrade.radar': '雷达增强 — 隐形碟闪烁现身翻倍',
    'upgrade.comboBank': '连击护盾 — 连击 ≥5 挡一次漏碟',
    'upgrade.magnet': '追踪线圈 — 炮弹轻微追踪目标',
    'upgrade.rapid': '速射继电器 — 发射冷却 −20%',
    'upgrade.damage': '聚焦透镜 — 伤害 +25%',
    'upgrade.lives': '辅助电源 — 生命 +1',
    'upgrade.coolRate': '散热片 — 过热降温 +30%',
  },
};
