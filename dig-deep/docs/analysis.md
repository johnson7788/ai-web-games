# dig-deep 源码分析（改造自 ddddig 挖挖挖）

> 源码路径：`/Users/admin/remake-src/ddddig/`（Cocos Creator 2.x TypeScript 工程）。
> 原则：**玩法规则 1:1 还原，角色/场景/音乐/IP 全原创**。本文件只记录「事实」，供改造设计对照。

## 入口与主循环

| 事实 | 位置 |
| --- | --- |
| 关卡方块配置 `pass_1` 是 5 列 × 24 行的 0/1 数组，1=生成方块，0=空 | `assets/Script/common/config.ts:5-30` |
| 场景入口 `GameScene.onLoad()`：开物理 → 生成 3 张循环背景 → 用 `pass_1` 生成方块坐标 → `createBlock()` 先铺一批 | `assets/Script/gameScene.ts:270-289` |
| 每帧 `update(dt)`：`moveBackground()`（背景循环）+ `isPreCreateBlock()`（预生成/回收方块） | `assets/Script/gameScene.ts:361-365` |
| 方块坐标：`x = visi.width/10 + visi.width/5 * 列号`，5 列均分屏宽；每批方块 `y` 递减 `block_Between_Height`(=300) | `assets/Script/gameScene.ts:146-164` |

## 核心玩法（竖直挖掘 + 砖块硬度 + 钻石计数）

| 事实 | 位置 |
| --- | --- |
| 角色（robot）以 `GameInfo.moveSpeed = (0,-640)` 匀速下落 | `assets/Script/common/gameHelper.ts:38-47`、`assets/Script/robot/figure.ts:59-61` |
| 玩家左右拖动控制角色横移：`TOUCH_MOVE` 里 `per = (pos.x - touch_Start_Point.x)*0.8 + robot.x`，并夹在屏宽边界内 | `assets/Script/camera.ts:41-58` |
| `isVilidPosition`：角色矩形与可见方块矩形相交即判定「位置非法」，阻止横移穿过方块 | `assets/Script/camera.ts:71-84` |
| 方块硬度：生成时给 label 赋随机数 `1..30` | `assets/Script/gameScene.ts:220`（`label.string = Math.floor(Math.random()*30+1)`） |
| 撞方块判定：角色与 `block` 相对速度 `(0,0)`（落在方块上方）时发 `HitBlock` | `assets/Script/robot/figure.ts:20-37` |
| `HitBlock` 处理：`GameInfo.blood--`；方块 label 数字 `-1`；数字归 0 则回收方块（摧毁） | `assets/Script/gameScene.ts:238-252` |
| 血量归 0 = Game Over（`robot.removeFromParent()`） | `assets/Script/gameScene.ts:240-244` |
| 加血 buff `bloodNode`：碰到即 `GameInfo.blood += 数字` 并回收；约 60% 概率随机 1~3 个 | `assets/Script/gameScene.ts:166-195`、`assets/Script/gameScene.ts:254-262` |
| 星星方块（钻石）由 `DiamondNum.showStart()` 标记 `isStart`，用于计数/计分 | `assets/Script/DiamondNum.ts:36-41` |
| 闪电道具 `Lightning.setEnergy()` 只设 label，是能量/道具计数 UI | `assets/Script/Lightning.ts:25-31` |

## 判定与关卡

| 事实 | 位置 |
| --- | --- |
| 初始血量 `GameInfo.blood = 10`（静态共享状态） | `assets/Script/common/gameHelper.ts:40-45` |
| 方块与 buff 的回收：屏幕上方不可见即回收进对象池 | `assets/Script/gameScene.ts:329-353` |
| 背景循环：3 张背景图按 `bg.height` 轮换，`currentBackgroundId` 循环 | `assets/Script/gameScene.ts:126-140`、`assets/Script/gameScene.ts:313-324` |
| 深度即进度：`blockCurrentPOSY` 不断下移，`blockCurrentId` 递增直到 `blockConfig.length` 结束 | `assets/Script/gameScene.ts:202-231` |
| 原版只有一张 `pass_1` 配置（单关卡，无多章/多场景包） | `assets/Script/common/config.ts:5-30` |

## 结论（改造要点）

原版是一个「下落 + 磨方块」的被动下潜游戏：角色自动下落，玩家只做左右横移，撞到数字方块双方各扣 1，方块归 0 即摧毁、继续下落；血量靠随机加血 buff 维持。**本作 `dig-deep` 把「被动磨」改为「主动挖」**：玩家点击/滑动指定格子，按硬度多次点击或换更强工具秒挖；障碍岩不可挖、钻石/化石收集计分、体力限制、深度即进度。角色/场景/音乐全部原创（地质分层钻探主题），不复用任何原素材与 IP 名。
