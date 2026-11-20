# light-grid 源码分析（改造自《点亮绿宝石》Cocos Creator）

源码根：`/Users/admin/remake-src/点亮绿宝石creator/`（只读参考，未复制任何素材/IP）。

## 1. 核心玩法还原（Lights Out）

`assets/Script/gameControl.js`：

- **点击翻转** `changeState(tag)`（`gameControl.js:257`）：`tag = i*10 + j` 编码格坐标；取
  `topTag = tag-10`、`leftTag = tag-1`、`rightTag = tag+1`、`bottomTag = tag+10`
  （`gameControl.js:262-270`），依次翻转自身 + 上/下/左/右五个格（越界则 `getChildByTag` 返回空，天然忽略）。
- **过关判定** `checkPassStatus()`（`gameControl.js:422`）：遍历 `COLUMN_NUM×ROW_NUM` 统计已点亮数
  `countNum`，当 `countNum >= STAGE_INFO[current_stage].goal` 时 `passStage()`（`gameControl.js:440`）。
- **计分/目标** `updateTarget()`（`gameControl.js:447`）：显示 `${lightNumber}/${goal}`。
- **倒计时** `countTime()`（`gameControl.js:471`）：按 `STAGE_INFO[stage].time` 倒计时，归零 `showGameOver()`。
- **存档** `save_data()`（`gameControl.js:379`）把状态写入 `localStorage("state_data"/"stage"/"lightNumber")`，
  `initGame()`（`gameControl.js:82`）按存档恢复。

`assets/Script/config.js`：

- `ROW_NUM=8`、`COLUMN_NUM=8`（`config.js:56-57`）——原作为固定 8×8。
- `STAGE_INFO`（`config.js:21-54`）：8 关，`goal` 从 36 → 64，`time` 从 30s → 600s。
  **注意**：原作目标是「点亮到 goal 个」而非「全部点亮」；本作按规格改为「全部点亮过关」，并改用步数计分（低于 par 三星）。

## 2. 与 light-grid 规格的映射

| 原作 | light-grid 规格 |
| --- | --- |
| 8×8 固定盘 | N×N（5→6→7），36 关 |
| 目标点亮 goal 个 + 倒计时 | 全部点亮 + 步数上限（过载熔断） |
| 只有普通格 | 新增二极管/电容/继电器/绝缘格 |
| 8 关线性 | 12 关推进结构 × 3 场景包 |

## 3. 原创改造设计（对应 spec 的 P0 + 区别点）

- **P0 还原**：N×N 灯阵、点一格翻转自身+上下左右、全部点亮过关、步数计分（≤par 三星）、关卡库手工设计保证可解。
- **二极管格**：单向翻转，只影响自身 + 下方两格（`config/gameplay.js` 的 `down2`）。
- **过载**：每关 `maxSteps = par + 5`，超步保险丝熔断重开。
- **电容格**：状态式「点两次才翻转」——第一下蓄能不翻转，第二下放电翻转自身+上下左右。
- **继电器格**：联动对角（自身 + 四对角）。
- **绝缘格**：不可直接点按，仍可被邻格翻转。
- **三场景包**：主板（绿黑）→ 显卡（蓝银）→ 霓虹管（粉紫），换章换色板+构图+装饰。

## 4. 关卡可解性保证

`config/levels.js` 用「从全亮状态施加一组线性按压（只按 node/diode/relay，不直接按 capacitor/insulator）
得到初始盘面」生成 36 关，这组按压本身就是一个可行解。`src/game/solver.js` 提供 GF(2) Gauss 求解器，
对不含电容的线性格型关卡做独立可解性验证；含电容关卡用正向重放验证（见 `tests/solver.test.mjs`）。

## 5. 事件契约（sim 发出）

`levelStart` / `press` / `charge` / `blocked` / `toggle` / `milestone` / `solved` / `signature` / `overload` / `hint` / `complete`。
渲染、音频、UI 各自消费；埋点只走 `src/core/sdk.js`。
