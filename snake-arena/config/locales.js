// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'SNAKE ARENA',
    'title.tagline': 'Steer. Boost. Cut them down.',
    'title.best': 'Best {length}',

    // 按钮
    'btn.start': 'Enter Arena',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Play again',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',
    'btn.boost': 'BOOST',
    'btn.pulse': 'PULSE',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Linking…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.round': 'Match',
    'hud.length': 'Length',
    'hud.rank': 'Rank',
    'hud.best': 'Best',
    'hud.time': 'Time',
    'hud.kills': 'Kills',
    'hud.boost': 'Boost',
    'hud.pulse': 'Pulse',
    'hud.pulseReady': 'Pulse ready',
    'hud.pulseNeed': 'Need {n} length',
    'hud.goal': 'Eat data · Grow · Rank #1',

    // 主题
    'theme.core': 'DATA CORE',
    'theme.meltdown': 'MELTDOWN',
    'theme.deepnet': 'DEEP NET',

    // 场次名
    'round.1': 'Data Core I',
    'round.2': 'Overclock',
    'round.3': 'Pulse Unlocked',
    'round.4': 'Drift Nodes',
    'round.5': 'Meltdown I',
    'round.6': 'Heat Tides',
    'round.7': 'Hunter Pack',
    'round.8': 'Melt Storm',
    'round.9': 'Deep Net I',
    'round.10': 'Dark Hunt',
    'round.11': 'Data Storm',
    'round.12': 'Final Core',

    // 场间新元素（升级屏脚注）
    'novel.1': 'Data Core: steer, boost, eat, grow; the wall kills.',
    'novel.2': 'More rivals: 5 AI snakes, aggression rises.',
    'novel.3': 'EMP pulse unlocked: stun nearby foes.',
    'novel.4': 'Drifting data nodes.',
    'novel.5': 'Meltdown theme + hunter AI.',
    'novel.6': 'Hot food tides.',
    'novel.7': 'Hunter AI pincers.',
    'novel.8': 'Melt storm: fast food + max aggression.',
    'novel.9': 'Deep Net theme + long lethal AI.',
    'novel.10': 'Dark hunt: richer shards.',
    'novel.11': 'Data storm: saturated food, fast AI.',
    'novel.12': 'Final core: full AI gauntlet.',

    // 升级
    'up.title': 'Pick an upgrade',
    'up.subtitle': 'Match {round} cleared · choose your build',
    'up.turnSpeed': 'Steering speed +18%',
    'up.magnetRadius': 'Magnet pulls data within 130px',
    'up.pulseCooldown': 'Pulse cooldown −25%',
    'up.shardRefund': 'Boost drops half the shards',
    'up.tailArmor': 'Enemy heads pass through your tail',
    'up.pulseShield': '1s invulnerability after pulse',
    'up.overclock': 'Boost no longer drops shards',
    'up.coreSteal': 'Kills grant +2 length',
    'up.shockAbsorb': 'Near-miss cuts pulse cooldown',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Eliminated',
    'result.winTitle': 'Arena Cleared',
    'result.rank': 'Final rank',
    'result.length': 'Length',
    'result.kills': 'Kills',
    'result.round': 'Match',
    'result.best': 'Best length',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to re-enter the arena',

    // 首次交互引导
    'tut.title': 'First run',
    'tut.1': 'Move the pointer / drag to steer',
    'tut.2': 'Eat 3 data nodes',
    'tut.3': 'Hold BOOST for a second',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'SNAKE ARENA',
    'title.tagline': '转向 · 超频 · 截杀对手。',
    'title.best': '最佳 {length}',

    // 按钮
    'btn.start': '进入竞技场',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '再来一局',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',
    'btn.boost': '超频',
    'btn.pulse': '脉冲',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '连接中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.round': '场次',
    'hud.length': '长度',
    'hud.rank': '名次',
    'hud.best': '最佳',
    'hud.time': '时间',
    'hud.kills': '击杀',
    'hud.boost': '超频',
    'hud.pulse': '脉冲',
    'hud.pulseReady': '脉冲就绪',
    'hud.pulseNeed': '需 {n} 长度',
    'hud.goal': '吃数据 · 变长 · 争第一',

    // 主题
    'theme.core': '数据核心',
    'theme.meltdown': '熔断区',
    'theme.deepnet': '深网',

    // 场次名
    'round.1': '数据核心 I',
    'round.2': '超频',
    'round.3': '脉冲解锁',
    'round.4': '漂移数据点',
    'round.5': '熔断区 I',
    'round.6': '高热潮',
    'round.7': '猎手小队',
    'round.8': '熔断风暴',
    'round.9': '深网 I',
    'round.10': '暗网猎杀',
    'round.11': '数据风暴',
    'round.12': '终局核心',

    // 场间新元素
    'novel.1': '数据核心：转向、超频、吃数据点、变长；撞墙即死。',
    'novel.2': '对手增员：5 条 AI 蛇，攻击性初现。',
    'novel.3': '电磁脉冲解锁：震晕附近敌蛇。',
    'novel.4': '漂移数据点。',
    'novel.5': '熔断区换章 + 猎手 AI。',
    'novel.6': '高热食物潮。',
    'novel.7': '猎手 AI 夹击围堵。',
    'novel.8': '熔断风暴：食物快速刷新 + 最高攻击性。',
    'novel.9': '深网换章 + 更长更致命的大蛇 AI。',
    'novel.10': '暗网猎杀：光屑更肥。',
    'novel.11': '数据风暴：食物饱和 + 高速 AI。',
    'novel.12': '终局核心：满编 AI 车轮战。',

    // 升级
    'up.title': '选择一项升级',
    'up.subtitle': '第 {round} 场已清 · 选择你的 build',
    'up.turnSpeed': '转向速度 +18%',
    'up.magnetRadius': '磁吸 130px 内的数据点',
    'up.pulseCooldown': '脉冲冷却 −25%',
    'up.shardRefund': '超频掉落光屑减半',
    'up.tailArmor': '敌蛇头可穿过你的尾部',
    'up.pulseShield': '放脉冲后 1s 无敌',
    'up.overclock': '超频不再掉落光屑',
    'up.coreSteal': '击杀 +2 长度',
    'up.shockAbsorb': '擦肩缩短脉冲冷却',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '已被淘汰',
    'result.winTitle': '竞技场通关',
    'result.rank': '最终名次',
    'result.length': '长度',
    'result.kills': '击杀',
    'result.round': '场次',
    'result.best': '最佳长度',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键重新进入竞技场',

    // 首次交互引导
    'tut.title': '初次入场',
    'tut.1': '移动指针 / 拖动来转向',
    'tut.2': '吃 3 颗数据点',
    'tut.3': '按住超频 1 秒',
    'tut.step': '步骤 {n}/{total}',
  },
};
