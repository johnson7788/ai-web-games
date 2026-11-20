// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'FOOD CHAIN',
    'title.tagline': 'Swim. Eat what is smaller. Grow up the glowing food web.',
    'title.best': 'Best stage {stage}',

    // 按钮
    'btn.play': 'Swim',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Swim again',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Glowing…',
    'set.rotate': 'Rotate for the best view',

    // HUD
    'hud.stage': 'Stage',
    'hud.mass': 'Mass',
    'hud.score': 'Score',
    'hud.best': 'Best',
    'hud.zone': 'Zone',
    'hud.sting': 'Sting',
    'hud.growTo': 'Grow to {mass} to evolve',

    // 阶段名（12）
    'stage.0': 'Plankton',
    'stage.1': 'Krill',
    'stage.2': 'Glow Fry',
    'stage.3': 'Reef Darter',
    'stage.4': 'Lantern Fish',
    'stage.5': 'Viper Wrasse',
    'stage.6': 'Abyss Hunter',
    'stage.7': 'Ghost Ray',
    'stage.8': 'Fang Eel',
    'stage.9': 'Vent Lurker',
    'stage.10': 'Leviathan',
    'stage.11': 'Apex Light',

    // 场景（3 章）
    'zone.0': 'Photic Zone',
    'zone.1': 'Twilight Zone',
    'zone.2': 'Vent Zone',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 死亡结算
    'result.title': 'Consumed',
    'result.stage': 'Stage reached',
    'result.mass': 'Peak mass',
    'result.score': 'Score',
    'result.best': 'Best stage',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to swim again',

    // 胜利
    'win.title': 'Apex Predator',
    'win.sub': 'You reached the top of the food chain.',

    // 首次交互引导
    'tut.title': 'First dive',
    'tut.1': 'Move toward a glowing plankton cloud to eat',
    'tut.2': 'Eat 3 plankton to grow',
    'tut.3': 'Eat a fish smaller than you',
    'tut.4': 'Avoid the bigger fish that hunts you',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'FOOD CHAIN',
    'title.tagline': '游动，吃掉比你小的，在发光食物网里一路进化。',
    'title.best': '最佳阶段 {stage}',

    // 按钮
    'btn.play': '开游',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '再游一局',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '发光中…',
    'set.rotate': '旋转设备获得最佳体验',

    // HUD
    'hud.stage': '阶段',
    'hud.mass': '体型',
    'hud.score': '分数',
    'hud.best': '最佳',
    'hud.zone': '深度带',
    'hud.sting': '毒刺',
    'hud.growTo': '再吃 {mass} 体型即可进化',

    // 阶段名（12）
    'stage.0': '浮游生物',
    'stage.1': '磷虾',
    'stage.2': '发光鱼苗',
    'stage.3': '礁石飞鱼',
    'stage.4': '灯笼鱼',
    'stage.5': '毒蛇隆头鱼',
    'stage.6': '深渊猎手',
    'stage.7': '幽灵鳐',
    'stage.8': '尖牙鳗',
    'stage.9': '热泉潜伏者',
    'stage.10': '利维坦',
    'stage.11': '顶点之光',

    // 场景（3 章）
    'zone.0': '光合带',
    'zone.1': '中层带',
    'zone.2': '热泉带',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 死亡结算
    'result.title': '被吃掉了',
    'result.stage': '到达阶段',
    'result.mass': '巅峰体型',
    'result.score': '分数',
    'result.best': '历史最佳阶段',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再游一局',

    // 胜利
    'win.title': '顶级捕食者',
    'win.sub': '你登上了食物链顶端。',

    // 首次交互引导
    'tut.title': '初次下潜',
    'tut.1': '游向发光浮游群去进食',
    'tut.2': '吃掉 3 颗浮游以长大',
    'tut.3': '吃掉一条比你小的鱼',
    'tut.4': '避开追杀你的大鱼',
    'tut.step': '步骤 {n}/{total}',
  },
};
