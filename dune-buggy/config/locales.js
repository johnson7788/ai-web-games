// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'DUNE BUGGY',
    'title.tagline': 'Baja rally: ride the golden ridge, tune your tires, beat the clock.',
    'title.best': 'Best stage {stage} · {time}s',
    'title.press': 'Press Enter or tap Start',

    // 按钮
    'btn.start': 'Start Rally',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Back to title',
    'btn.next': 'Next stage',
    'btn.retry': 'Retry stage',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Kicking up sand…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.stage': 'Stage',
    'hud.time': 'Time',
    'hud.target': 'Target',
    'hud.speed': 'Speed',
    'hud.pressure': 'Tires',
    'hud.best': 'Best',
    'hud.ridge': 'On the ridge!',
    'hud.offtrack': 'Off track — slow down',

    // 胎压
    'pressure.high': 'High',
    'pressure.low': 'Low',
    'pressure.hint': 'T: switch tire pressure',

    // 赛段名
    'stage.1': 'Dawn Sand',
    'stage.2': 'Golden Ridge',
    'stage.3': 'Rock Field',
    'stage.4': 'Oasis Jump',
    'stage.5': 'White Heat',
    'stage.6': 'Pressure Pit',
    'stage.7': 'Ridge Maze',
    'stage.8': 'Rock Ridge',
    'stage.9': 'Dusk Ridge',
    'stage.10': 'Black Storm',
    'stage.11': 'Twin Ridge',
    'stage.12': 'Baja Enduro',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算卡
    'result.clear': 'Stage Clear',
    'result.dnf': 'DNF — Out of Time',
    'result.champion': 'BAJA CHAMPION',
    'result.time': 'Time',
    'result.target': 'Target',
    'result.rating': 'Rating',
    'result.stage': 'Stage',
    'result.total': 'Total time',
    'result.best': 'Best stage',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'R retry · N next stage',
    'result.nextHint': 'Press N for the next stage',

    // 评级
    'rating.gold': 'Gold',
    'rating.silver': 'Silver',
    'rating.bronze': 'Bronze',
    'rating.finish': 'Finish',

    // 首次交互引导
    'tut.title': 'First rally',
    'tut.1': 'Steer with ← → (or A/D)',
    'tut.2': 'Hold ↑ (or W) to accelerate',
    'tut.3': 'Ride the golden ridge for a boost',
    'tut.4': 'Press T to switch tire pressure',
    'tut.step': 'Step {n}/{total}',

    // 分享
    'share.text': 'I raced {stage} stages in DUNE BUGGY!',
  },
  zh: {
    // 标题屏
    'title.logo': 'DUNE BUGGY',
    'title.tagline': '巴哈拉力：骑上金色沙脊、切换胎压、抢时间。',
    'title.best': '最佳赛段 {stage} · {time}s',
    'title.press': '按回车或点开始',

    // 按钮
    'btn.start': '开始拉力',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '回到标题',
    'btn.next': '下一赛段',
    'btn.retry': '重试赛段',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '扬起沙尘…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.stage': '赛段',
    'hud.time': '用时',
    'hud.target': '目标',
    'hud.speed': '速度',
    'hud.pressure': '胎压',
    'hud.best': '最佳',
    'hud.ridge': '骑上沙脊！',
    'hud.offtrack': '冲出赛道 — 减速',

    // 胎压
    'pressure.high': '高',
    'pressure.low': '低',
    'pressure.hint': 'T：切换胎压',

    // 赛段名
    'stage.1': '晨沙',
    'stage.2': '金色沙脊',
    'stage.3': '岩区',
    'stage.4': '绿洲跳台',
    'stage.5': '白热午漠',
    'stage.6': '胎压试炼',
    'stage.7': '沙脊迷宫',
    'stage.8': '岩脊',
    'stage.9': '暮丘沙脊',
    'stage.10': '黑沙暴',
    'stage.11': '双脊岔路',
    'stage.12': '巴哈耐力',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算卡
    'result.clear': '赛段完成',
    'result.dnf': '未完成 — 超时',
    'result.champion': '巴哈冠军',
    'result.time': '用时',
    'result.target': '目标',
    'result.rating': '评级',
    'result.stage': '赛段',
    'result.total': '总用时',
    'result.best': '最佳赛段',
    'result.newRecord': '新纪录',
    'result.hint': 'R 重试 · N 下一赛段',
    'result.nextHint': '按 N 进入下一赛段',

    // 评级
    'rating.gold': '金牌',
    'rating.silver': '银牌',
    'rating.bronze': '铜牌',
    'rating.finish': '完赛',

    // 首次交互引导
    'tut.title': '初次拉力',
    'tut.1': '用 ← →（或 A/D）转向',
    'tut.2': '按住 ↑（或 W）加速',
    'tut.3': '骑上金色沙脊获得加速',
    'tut.4': '按 T 切换胎压',
    'tut.step': '步骤 {n}/{total}',

    // 分享
    'share.text': '我在 DUNE BUGGY 跑完了 {stage} 个赛段！',
  },
};
