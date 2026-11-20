// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（其他语言整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'FISH FRENZY',
    'title.tagline': 'Aim. Net the glow. Chase the forecast.',
    'title.best': 'Best run {stage} stages',

    // 按钮
    'btn.start': 'Dive',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Dive again',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Baiting the waters…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.coins': 'Coins',
    'hud.tier': 'Cannon',
    'hud.stage': 'Stage',
    'hud.target': 'Target',
    'hud.forecast': 'Forecast',
    'hud.electric': 'Shock net',
    'hud.boss': 'Megamouth',

    // 场景 / 关卡
    'scene.1': 'Coral Farm',
    'scene.2': 'Deep Trench',
    'scene.3': 'Hot Vents',
    'stage.name': 'Stage {n}',

    // 鱼种
    'fish.1': 'Lanternfish',
    'fish.2': 'Sardine',
    'fish.3': 'Butterflyfish',
    'fish.4': 'Grouper',
    'fish.5': 'Lionfish',
    'fish.6': 'Sea Turtle',
    'fish.7': 'Manta Ray',
    'fish.8': 'Hammerhead',
    'fish.9': 'Oarfish',
    'fish.10': 'Megamouth',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Nets Down',
    'result.won': 'ALL STAGES CLEARED',
    'result.stage': 'Stage reached',
    'result.revenue': 'Total revenue',
    'result.catches': 'Fish caught',
    'result.best': 'Best run',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to dive again',

    // 首次交互引导
    'tut.title': 'First dive',
    'tut.1': 'Move to aim the cannon',
    'tut.2': 'Tap / click to fire a net',
    'tut.3': 'Catch a fish',
    'tut.4': 'Change your cannon tier',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'FISH FRENZY',
    'title.tagline': '瞄准、撒网，追着鱼汛跑。',
    'title.best': '最佳战绩 {stage} 场',

    // 按钮
    'btn.start': '下海',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '再下一网',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '正在投饵…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.coins': '金币',
    'hud.tier': '炮档',
    'hud.stage': '场次',
    'hud.target': '目标',
    'hud.forecast': '鱼汛预报',
    'hud.electric': '电击网',
    'hud.boss': '巨口鲨',

    // 场景 / 关卡
    'scene.1': '珊瑚渔场',
    'scene.2': '深沟',
    'scene.3': '热泉',
    'stage.name': '第 {n} 场',

    // 鱼种
    'fish.1': '灯笼鱼',
    'fish.2': '沙丁鱼',
    'fish.3': '蝴蝶鱼',
    'fish.4': '石斑鱼',
    'fish.5': '狮子鱼',
    'fish.6': '海龟',
    'fish.7': '魔鬼鱼',
    'fish.8': '锤头鲨',
    'fish.9': '皇带鱼',
    'fish.10': '巨口鲨',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '收网',
    'result.won': '全部场次通关',
    'result.stage': '到达场次',
    'result.revenue': '总营收',
    'result.catches': '捕获数',
    'result.best': '最佳战绩',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再下一网',

    // 首次交互引导
    'tut.title': '初次下海',
    'tut.1': '移动鼠标来瞄准炮台',
    'tut.2': '点击 / 点按发射渔网',
    'tut.3': '捕获一条鱼',
    'tut.4': '切换你的炮档',
    'tut.step': '步骤 {n}/{total}',
  },
};
