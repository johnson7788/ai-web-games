# neo-tetra · 源码分析

> 改造自 `/Users/admin/remake-src/俄罗斯方块/`（Cocos Creator 2.x 工程，assets-only）。
> 原则：玩法规则 1:1 还原，角色/场景/音乐全原创。以下结论直接指导 `src/game/sim.js` 的实现。

## 1. 源码结构（事实）

| 事实 | 位置 | 结论 |
| --- | --- | --- |
| 井宽 10 列、格子 16px | `assets/script/block.ts`（`blockSize = 16`，`checkMove` 边界 `blockSize*10`） | 10 列棋盘，与我方 `WELL.COLS=10` 对齐 |
| 初始下落计时 2s/行 | `assets/script/game.ts:28`（`@property timer: number = 2`） | 经典 Tetris 低速起手；我方改为按等级加速（config-first） |
| 7 种四格块，各含 4 个旋转 state | `assets/script/block-I.ts / block-T.ts / block-S.ts / block-L.ts / block-LI.ts / block-SI.ts / block-Sq.ts`（`state: number = 0`，`canRotate()` 按 state 分支） | 7 块 + SRS 旋转/踢墙 |
| Hold + Next 双面板 | `assets/script/Hold.ts / Next.ts`（占位组件），`game.ts` 持有 `NextBlock/HoldBlock` 节点 | 单 next + hold；我方扩展双 next（矿层特性） |
| 逐行消判 + 分数/暂停/结算/音效 | `assets/script/game.ts`（`Score`、`GameOverPopUp`、`PausePopUp`、`SoundButton`） | 经典 Tetris 判定闭环 |
| 素材仅贴图/动画，无规则创新 | `assets/tile/block-*.png`、`assets/anim/destroyI.anim`、`assets/game.fire` | 原素材与 IP 名一律不搬，美术全程序化 |

## 2. 还原清单（P0，写入 `src/game/sim.js`）

- 10×20 井；7 种四格块（I/O/T/S/Z/J/L）；SRS 旋转 + 踢墙（`src/game/tetromino.js` 状态表 + 踢墙表）。
- 软降（↓，逐行 +1 分）/ 硬降（空格，直达底部 +2 分/行）。
- 逐行消判，行分 1/2/3/4 = 100/300/500/800 × 等级。
- 每 10 行 +1 级，等级加速下落。
- next 队列（7-bag）+ ghost 投影 + hold（每落一块可换一次，换后本块锁禁）。
- 顶出判负（新块生成即碰撞 → `death`）。

## 3. 原创改造（P0，写入 `config/levels.js` + `src/game/sim.js` + `src/render/`）

- **霓虹炼金炉**：方块是元素晶块（铜/铁/金/钻石…按矿层换矿石视觉）；消行 = 熔炼出炉。
- **signature**：一次消 4 行（TETRA）触发「熔炉喷发」全屏流光 + 金锭飞溅（`tetra` 事件 → render 粒子 + 全屏反馈）。
- **热力条**：连续消行蓄热（1/2/3/4 行 = 1/2/3/4 热），满热自动进入 10s「白热态」分数 ×2 但下落加速。
- **12 层推进**：每层目标行数 + 特性轮换（加速矿脉 / 双 next / 暗井 / 窄井 / 重块 / gift 块）。
- **三场景包**：铜矿层（暖橙）/ 冰晶层（青蓝）/ 熔核层（红黑），换章必换色板 + 构图 + 装饰 + 专属 BGM 层。

## 4. 关键接口（与 abyss-eel 契约对齐）

- `createRun({seed})` → `run.step(input)` / `run.getHud()` / `run.drainEvents()` / `run.phase ∈ playing|dead|won`。
- 输入：`{ moveLeft, moveRight, softDrop, rotateCW, rotateCCW, hardDrop, hold }`（held vs edge 由 main/selfplay 归边）。
- 事件名：`pieceSpawn / move / rotate / softDrop / hardDrop / hold / lock / lineClear / tetra / heatUp / whiteHotStart / whiteHotEnd / levelUp / layerEnter / gift / milestone / death / win`。
