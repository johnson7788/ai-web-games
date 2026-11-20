// IDLE FORGE · 全局配置（Lead 拥有；数值改动只改这里）
// 铁匠挂机铺：锤子自动锻造装备产金币，四线升级（锤力/锤速/火温/学徒）。
// 零构建纯静态 + 零运行期依赖（唯一例外站点 SDK）。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算锻造台/升级栏/进度条几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 48,            // 顶部 HUD 条高
  MARGIN_X: 24,         // 左右安全边
  MARGIN_Y: 16,
  UPGRADE_H: 150,       // 底部升级栏高度
  UPGRADE_COLS: 4,
  UPGRADE_GAP: 12,
  PROGRESS_Y: 96,       // 大师之作进度条（HUD 下方）
  ANVIL_X: 430,         // 铁砧中心（锻造区，可点击）
  ANVIL_Y: 430,
  ANVIL_W: 360,
  ANVIL_H: 220,
  ITEM_X: 1030,         // 装备立绘展示区
  ITEM_Y: 360,
  ITEM_W: 220,
  ITEM_H: 300,
};

// 语言：默认英文；zh 必做；未完整翻译的语言整块不暴露（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'idle-forge-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'idle-forge-save',
};

// 挂机数值曲线（sim 读取；价格指数递增 + 线性产量成长）
export const GAME = {
  BASE_FORGE_SEC: 1.0,          // 锤速 0 级时一次自动锻造间隔（秒）
  POWER_PER_LV: 0.15,           // 锤力每级 +15% 金币
  SPEED_PER_LV: 0.12,           // 锤速每级 锻造间隔 ÷(1+lv*0.12)
  TEMP_COIN_PER_LV: 0.02,       // 火温每级 +2% 金币
  TEMP_PROG_PER_LV: 0.10,       // 火温每级 +10% 大师之作进度
  APPRENTICE_YIELD_PER_LV: 0.20,// 学徒每级：每秒被动产出 = lv*0.2*本关基础产量
  UPGRADE_BASE: { power: 25, speed: 30, temp: 40, apprentice: 50 },
  UPGRADE_GROWTH: 1.18,         // 价格指数递增基数
  SHORTAGE_MULT: 1.6,           // 材料短缺：该线价格 ×1.6
  TAP_COOLDOWN: 0.3,            // 手动敲击冷却（秒）
  STOKE_WINDOW_EVERY: 30,       // 炉候窗口每 30s 一次
  STOKE_WINDOW_LEN: 10,         // 窗口持续 10s
  STOKE_BUFF: 0.25,             // 加温 +25% 火温收益
  STOKE_BUFF_SEC: 45,
  STRIKE_AT: 15,                // 学徒罢工触发时刻（秒，进关后）
  STRIKE_EVERY: 45,             // 之后每 45s 一次
  STRIKE_SEC: 25,               // 罢工持续
  STRIKE_SPEED_PENALTY: 2.0,    // 罢工时锻造间隔 ×2（产量不变）
  APPEASE_COST_MULT: 3,         // 安抚贿赂 = 当前单次产量 ×3
  VEIN_SEC: 60,                 // 稀有矿脉持续 60s
  VEIN_MULT: 3,                 // 爆发收益 ×3
  ORDER_TIME: 90,               // 订单限时（秒）
  ORDER_BONUS_MULT: 3,          // 限时内完成大师之作：额外金币 = 单次产量 ×3
  OFFLINE_CAP_SEC: 8 * 3600,    // 离线收益封顶 8h
  OFFLINE_RATE: 0.5,            // 离线产出按在线 50% 折算
  TUTORIAL_STEPS: 3,
};
