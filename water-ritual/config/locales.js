// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（完整才暴露）。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'WATER RITUAL',
    'title.tagline': 'Hold to pour. Hit the line, catch the heat.',
    'title.best': 'Best: {days} days · {coins} coins',

    // 按钮
    'btn.start': 'Open the Teahouse',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Restart',
    'btn.again': 'Run it again',
    'btn.skip': 'Skip',
    'btn.close': 'Close',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Steeping…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.day': 'Day',
    'hud.target': 'Left',
    'hud.hearts': 'Hearts',
    'hud.coins': 'Coins',
    'hud.combo': 'Combo',
    'hud.rush': 'RUSH HOUR',

    // 订单票
    'order.title': 'Order',
    'order.temp': 'Temp',
    'order.line': 'Line',
    'order.reward': 'Reward',
    'order.patience': 'Patience',

    // 茶型
    'tea.green': 'Green Tea',
    'tea.black': 'Black Tea',
    'tea.flower': 'Flower Tea',

    // 客型
    'guest.regular': 'Regular',
    'guest.noble': 'Noble Guest',
    'guest.oldFriend': 'Old Friend',
    'guest.hurried': 'Hurried Guest',
    'guest.picky': 'Picky Guest',

    // 场景
    'scene.morning': 'Morning Tea',
    'scene.noon': 'Noon Market',
    'scene.night': 'Night Talk',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'The Kettle Rests',
    'result.days': 'Days run',
    'result.perfects': 'Perfect pours',
    'result.fullhouse': 'Full house',
    'result.coins': 'Coins earned',
    'result.rating': 'Rating',
    'result.best': 'Best run',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to run it again',

    // 评级
    'rating.perfect': 'Perfect',
    'rating.good': 'Good',
    'rating.ok': 'Okay',
    'rating.poor': 'Poor',

    // 首次交互引导
    'tut.title': 'First Pour',
    'tut.1': 'Hold the teapot to pour water',
    'tut.2': 'Fill one order to the line',
    'tut.3': 'Land a perfect pour (gold ripple)',
    'tut.step': 'Step {n}/{total}',

    // 升级商店
    'shop.title': 'Teahouse Upgrades',
    'shop.buy': 'Buy',
    'shop.coins': 'Coins',
    'shop.next': 'Next day',
    'up.thermometer': 'Thermometer',
    'up.slowPour': 'Slow Pour',
    'up.iceReserve': 'Ice Reserve',
    'up.secondChance': 'Second Chance',
    'up.goldenRipple': 'Golden Ripple',
    'up.rushMaster': 'Rush Master',
    'up.regularFriend': 'Regular Friend',
    'up.cozyPot': 'Cozy Pot',
    'up.heartUp': 'Bigger Heart',
    'up.coinUp': 'Better Tips',
    'upDesc.thermometer': 'Show each guest\'s temperature window on the gauge',
    'upDesc.slowPour': 'Water rises 20% slower for finer control',
    'upDesc.iceReserve': 'Temperature falls 28% slower',
    'upDesc.secondChance': 'Forgive one failed order each day',
    'upDesc.goldenRipple': 'Perfect pours pay double',
    'upDesc.rushMaster': 'Rush-hour orders pay double',
    'upDesc.regularFriend': 'Regular guests wait 35% longer',
    'upDesc.cozyPot': 'Release grace +90ms (more forgiving)',
    'upDesc.heartUp': 'Start each day with +1 heart',
    'upDesc.coinUp': 'All tips +30%',

    // 天切换
    'day.end': 'Day {day} done',
    'day.earned': 'Earned',
    'day.target': 'Orders filled',
  },
  zh: {
    // 标题屏
    'title.logo': '水之仪式',
    'title.tagline': '按住倒水，贴线入温，一口回甘。',
    'title.best': '最佳：{days} 天 · {coins} 金币',

    // 按钮
    'btn.start': '开张茶馆',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '重开',
    'btn.again': '再来一局',
    'btn.skip': '跳过',
    'btn.close': '关闭',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '温壶中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.day': '第',
    'hud.target': '剩余',
    'hud.hearts': '心',
    'hud.coins': '金币',
    'hud.combo': '连击',
    'hud.rush': '客流高峰',

    // 订单票
    'order.title': '订单',
    'order.temp': '水温',
    'order.line': '水位线',
    'order.reward': '报酬',
    'order.patience': '耐心',

    // 茶型
    'tea.green': '绿茶',
    'tea.black': '红茶',
    'tea.flower': '花茶',

    // 客型
    'guest.regular': '常客',
    'guest.noble': '贵客',
    'guest.oldFriend': '老茶客',
    'guest.hurried': '急客',
    'guest.picky': '挑剔客',

    // 场景
    'scene.morning': '晨茶',
    'scene.noon': '午市',
    'scene.night': '夜谈',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '茶壶歇了',
    'result.days': '经营天数',
    'result.perfects': '完美倒水',
    'result.fullhouse': '满堂彩',
    'result.coins': '总收入',
    'result.rating': '评级',
    'result.best': '最佳纪录',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 再来一局',

    // 评级
    'rating.perfect': '一口回甘',
    'rating.good': '好',
    'rating.ok': '尚可',
    'rating.poor': '差',

    // 首次交互引导
    'tut.title': '第一次倒水',
    'tut.1': '按住茶壶倒水',
    'tut.2': '把一单倒到水位线',
    'tut.3': '完成一次完美倒水（金圈涟漪）',
    'tut.step': '步骤 {n}/{total}',

    // 升级商店
    'shop.title': '茶馆升级',
    'shop.buy': '购买',
    'shop.coins': '金币',
    'shop.next': '下一天',
    'up.thermometer': '温度计',
    'up.slowPour': '慢倒',
    'up.iceReserve': '冰镇',
    'up.secondChance': '二次机会',
    'up.goldenRipple': '金圈涟漪',
    'up.rushMaster': '高峰大师',
    'up.regularFriend': '熟客缘',
    'up.cozyPot': '温壶',
    'up.heartUp': '加心',
    'up.coinUp': '好小费',
    'upDesc.thermometer': '把客人水温区间画在温度计上',
    'upDesc.slowPour': '水位上升慢 20%，更好微调',
    'upDesc.iceReserve': '水温下降慢 28%',
    'upDesc.secondChance': '每天第一次失败单不扣心',
    'upDesc.goldenRipple': '完美倒水金币翻倍',
    'upDesc.rushMaster': '高峰单金币翻倍',
    'upDesc.regularFriend': '常客耐心 +35%',
    'upDesc.cozyPot': '松手宽限 +90ms（更宽容）',
    'upDesc.heartUp': '每天开局多 1 颗心',
    'upDesc.coinUp': '所有小费 +30%',

    // 天切换
    'day.end': '第 {day} 天结束',
    'day.earned': '收入',
    'day.target': '完成单数',
  },
};
