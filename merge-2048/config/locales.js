// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（完整才暴露）。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'MERGE 2048',
    'title.tagline': 'Slide the fleet. Merge tonnage. Build a star colony to 2048.',
    'title.best': 'Best score {score}',

    // 按钮
    'btn.start': 'Launch',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Relaunch',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.continue': 'Keep flying',
    'btn.warp': 'WARP',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.rotate': 'Rotate for the best view',
    'set.loading': 'Docking…',
    'set.mute': 'Mute',
    'set.back': 'Back',

    // HUD
    'hud.score': 'Score',
    'hud.best': 'Best ship',
    'hud.level': 'Sector',
    'hud.target': 'Goal',
    'hud.moves': 'Moves',
    'hud.warp': 'Warp',
    'hud.warpReady': 'Select two equal ships',
    'hud.warpUsed': 'Warp used',

    // 关卡名
    'level.name.1': 'Low Orbit',
    'level.name.2': 'First Well',
    'level.name.3': 'Narrow Lane',
    'level.name.4': 'Debris Field',
    'level.name.5': 'Heavy Haul',
    'level.name.6': 'Wild Tonnage',
    'level.name.7': 'Mirror Sector',
    'level.name.8': 'Dense Cluster',
    'level.name.9': 'Twin Lane',
    'level.name.10': 'Deep Vein',
    'level.name.11': 'Final Narrow',
    'level.name.12': 'Warp End',

    // 里程碑建筑
    'unlock.greenhouse': 'Greenhouse online (128t)',
    'unlock.mine': 'Mining rig online (256t)',
    'unlock.station': 'Orbital station online (512t)',
    'unlock.stargate': 'Stargate online (1024t)',
    'unlock.warpdrive': 'WARP DRIVE ONLINE (2048t)',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.win': 'COLONY ONLINE',
    'result.lose': 'Fleet Locked',
    'result.score': 'Score',
    'result.bestTile': 'Best ship',
    'result.level': 'Sector reached',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to relaunch',

    // 首次交互引导
    'tut.title': 'First flight',
    'tut.1': 'Press an arrow key or swipe to slide the whole fleet',
    'tut.2': 'Merge two equal ships into one bigger ship',
    'tut.3': 'Reach 32 tons to clear the first sector',
    'tut.4': 'Press WARP and pick two equal ships to force-merge',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'MERGE 2048',
    'title.tagline': '滑动舰队，合并吨位，把星际殖民地一路建到 2048。',
    'title.best': '最高分 {score}',

    // 按钮
    'btn.start': '启航',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重新启航',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.continue': '继续飞行',
    'btn.warp': '跃迁',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.rotate': '旋转设备获得最佳体验',
    'set.loading': '对接中…',
    'set.mute': '静音',
    'set.back': '返回',

    // HUD
    'hud.score': '得分',
    'hud.best': '最大舰',
    'hud.level': '星区',
    'hud.target': '目标',
    'hud.moves': '步数',
    'hud.warp': '跃迁',
    'hud.warpReady': '选择两艘同吨位舰',
    'hud.warpUsed': '跃迁已用',

    // 关卡名
    'level.name.1': '近地轨道',
    'level.name.2': '第一口井',
    'level.name.3': '窄航道',
    'level.name.4': '残骸带',
    'level.name.5': '重载航线',
    'level.name.6': '狂野吨位',
    'level.name.7': '镜像星区',
    'level.name.8': '密集星团',
    'level.name.9': '双子航道',
    'level.name.10': '深矿脉',
    'level.name.11': '最终窄道',
    'level.name.12': '曲率终点',

    // 里程碑建筑
    'unlock.greenhouse': '温室已上线（128t）',
    'unlock.mine': '矿场已上线（256t）',
    'unlock.station': '轨道站已上线（512t）',
    'unlock.stargate': '星门已上线（1024t）',
    'unlock.warpdrive': '曲率引擎已上线（2048t）',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.win': '殖民地已上线',
    'result.lose': '舰队被锁死',
    'result.score': '得分',
    'result.bestTile': '最大舰',
    'result.level': '到达星区',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键重新启航',

    // 首次交互引导
    'tut.title': '初次飞行',
    'tut.1': '按方向键或滑动，让整支舰队滑行',
    'tut.2': '把两艘同吨位舰合并成一艘更大的',
    'tut.3': '达到 32 吨，通关第一个星区',
    'tut.4': '点「跃迁」，选两艘同吨位舰强制合并',
    'tut.step': '步骤 {n}/{total}',
  },
};
