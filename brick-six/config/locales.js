// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'BRICK SIX',
    'title.tagline': 'Fill honeycomb rings. Clear three at once for the Royal Jelly cascade.',
    'title.best': 'Best {score}',

    // 按钮
    'btn.play': 'Play',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Play again',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Warming the hive…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.score': 'SCORE',
    'hud.tier': 'TIER',
    'hud.target': 'TARGET',
    'hud.combo': 'COMBO',
    'hud.best': 'BEST',
    'hud.next': 'NEXT',

    // 场景包
    'scene.spring': 'Spring Nest',
    'scene.honey': 'Honey Vault',
    'scene.winter': 'Winter Nest',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Hive Full',
    'result.score': 'Score',
    'result.tier': 'Tier reached',
    'result.cascade': 'Golden cascades',
    'result.combo': 'Best combo',
    'result.best': 'Best score',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to play again',

    // 首次交互引导
    'tut.title': 'First harvest',
    'tut.1': 'Tap a cell to place the glowing piece',
    'tut.2': 'Rotate a piece to fit (R or tap ↻)',
    'tut.3': 'Fill a full ring to clear it',
    'tut.step': 'Step {n}/{total}',

    // 玩法提示（How to play）
    'how.1': 'Place pieces on the hex board.',
    'how.2': 'A full ring clears and scores.',
    'how.3': 'Three rings at once = Royal Jelly gold.',
    'how.4': 'Wax cells need two clears.',
    'how.5': 'Pollen cleared in time infects neighbours.',
  },
  zh: {
    // 标题屏
    'title.logo': 'BRICK SIX',
    'title.tagline': '铺满蜂巢环即消除，一次消三环触发蜂王浆金瀑。',
    'title.best': '最佳 {score}',

    // 按钮
    'btn.play': '开始',
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
    'set.loading': '蜂巢升温中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.score': '分数',
    'hud.tier': '档位',
    'hud.target': '目标',
    'hud.combo': '连消',
    'hud.best': '最佳',
    'hud.next': '下一个',

    // 场景包
    'scene.spring': '春巢',
    'scene.honey': '蜜库',
    'scene.winter': '冬巢',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '蜂巢已满',
    'result.score': '得分',
    'result.tier': '到达档位',
    'result.cascade': '金瀑次数',
    'result.combo': '最大连消',
    'result.best': '历史最佳',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再来一局',

    // 首次交互引导
    'tut.title': '初次采蜜',
    'tut.1': '点击一个格子放下发光的块组',
    'tut.2': '旋转块组以贴合（R 或点 ↻）',
    'tut.3': '铺满一整环即可消除',
    'tut.step': '步骤 {n}/{total}',

    // 玩法提示（How to play）
    'how.1': '把块组放到六边形棋盘上。',
    'how.2': '铺满一整环即消除得分。',
    'how.3': '一次消三环触发蜂王浆金瀑。',
    'how.4': '封蜡格需要消两次。',
    'how.5': '花粉块限时消除会传染邻格。',
  },
};
