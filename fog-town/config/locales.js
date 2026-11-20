// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 整块删除）。
// 全部平铺字符串（i18n-check 要求），key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'FOG TOWN',
    'title.tagline': 'Oil-lamp detective: light the fog, find the key, reach the door.',
    'title.best': 'Best block {n}',

    // 按钮
    'btn.start': 'Enter the fog',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Start over',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',
    'btn.echo': 'Echo',
    'btn.next': 'Next block',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Lighting the lamp…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.block': 'Block',
    'hud.oil': 'Oil',
    'hud.steps': 'Steps',
    'hud.keys': 'Keys',
    'hud.clues': 'Clues',
    'hud.goal': 'Goal',
    'hud.echo': 'Echo',
    'hud.goal.exit': 'Reach the exit',
    'hud.goal.key': 'Find the key, reach the exit',
    'hud.goal.lever': 'Flip the lever, reach the exit',
    'hud.goal.keyAndLever': 'Key + lever, then exit',
    'hud.goal.clues': 'Assemble 3 clues, reach the exit',

    // 场景包
    'scene.0': 'Dusk Alley',
    'scene.1': 'Market Ruins',
    'scene.2': 'Lakeside',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Fog Cleared',
    'result.dead': 'Lost in the fog',
    'result.deadGuard': 'Caught by the guard',
    'result.block': 'Block',
    'result.steps': 'Steps',
    'result.rating': 'Rating',
    'result.best': 'Best block',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to try again',

    // 首次交互引导
    'tut.title': 'First night',
    'tut.1': 'Move into a lit cell (arrows / tap)',
    'tut.2': 'Step to reveal fog',
    'tut.3': 'Reach the exit door',
    'tut.4': 'Press Space to echo for traps',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': '雾町寻踪',
    'title.tagline': '油灯侦探：提灯照亮迷雾，找钥匙、拨机关、抵达出口。',
    'title.best': '最远街区 {n}',

    // 按钮
    'btn.start': '走进迷雾',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重新开始',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',
    'btn.echo': '回声',
    'btn.next': '下一街区',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '点亮油灯…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.block': '街区',
    'hud.oil': '灯油',
    'hud.steps': '步数',
    'hud.keys': '钥匙',
    'hud.clues': '线索',
    'hud.goal': '目标',
    'hud.echo': '回声',
    'hud.goal.exit': '抵达出口',
    'hud.goal.key': '找到钥匙，抵达出口',
    'hud.goal.lever': '拨动机关，抵达出口',
    'hud.goal.keyAndLever': '钥匙 + 机关，再抵达出口',
    'hud.goal.clues': '拼齐 3 条线索，抵达出口',

    // 场景包
    'scene.0': '暮巷',
    'scene.1': '集市废墟',
    'scene.2': '湖畔',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '迷雾散尽',
    'result.dead': '迷失在雾中',
    'result.deadGuard': '被守卫抓住了',
    'result.block': '街区',
    'result.steps': '步数',
    'result.rating': '评级',
    'result.best': '最远街区',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再来一局',

    // 首次交互引导
    'tut.title': '第一夜',
    'tut.1': '走进亮起的格子（方向键 / 点按）',
    'tut.2': '移动揭开迷雾',
    'tut.3': '抵达出口门',
    'tut.4': '按空格使用回声探听机关',
    'tut.step': '步骤 {n}/{total}',
  },
};
