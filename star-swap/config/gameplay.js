// config/gameplay.js — 三消玩法数值（M1 纯逻辑，全部 config-first，逻辑层不写死数字）
export const BOARD = {
  ROWS: 8,
  COLS: 8,
  COLORS: 5,          // 常规关颜色数（六色关由 levels 覆盖为 6）
};

// 特殊星类型
export const SPECIAL = {
  ROW: 'row',      // 行爆：清整行
  COL: 'col',      // 列爆：清整列
  NOVA: 'nova',    // 超新星：同色湮灭 + 全屏白闪（签名）
};

// 非颜色格子的哨兵值
export const CELL = {
  DARK: -1,        // 暗物质格：占位不消除，靠相邻特殊星爆开
};

export const MATCH_MIN = 3;
export const SPECIAL_LEN = 4;   // 四连生成特殊星
export const NOVA_LEN = 5;      // 五连生成超新星

// 计分：每颗消除星基础分，再按连线长度 / 连锁层数加成
export const SCORE = {
  BASE_PER_STAR: 20,
  LEN_BONUS: 0.5,        // 每颗星 = BASE * (1 + LEN_BONUS * (len - 3))，match3 即 20，match4 30，match5 40
  CASCADE_BONUS: 0.25,   // 第 n 层连锁额外乘 (1 + CASCADE_BONUS * (n - 1))
  SPECIAL_BONUS: 60,     // 特殊星额外加分
  DARK_BONUS: 40,        // 爆开暗物质格额外加分
  MILESTONE_EVERY: 250,  // 每 250 分一个里程碑事件（保证反馈密度）
};

// 重力反转一回合：该关的 refill 从顶部改为底部（level 配置 gravityReverse 时启用）
export const GRAVITY = {
  DOWN: 'down',
  UP: 'up',
};

// 透镜：每关 3 次，拖动放大 2×2 区域做「隔空换位」
export const LENS = {
  CHARGES_PER_LEVEL: 3,
  REGION: 2,           // 2×2
};

export const COMBO_WINDOW_SEC = 6;   // 连击窗口（关卡内）

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
