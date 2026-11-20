# brick-six 源码分析（改造自 66消除）

> 源码：`/Users/admin/remake-src/66消除creator/`（Cocos Creator 2.x 工程）。
> 目标：玩法规则 1:1 还原，角色/场景/音乐全原创（六角消除 → 蜂巢工坊）。

## 1. 入口与场景流转

- 入口 `EntryScene.js:startGame()` → `cc.director.loadScene("World")`（`assets/scripts/scene/EntryScene.js:70-72`）。
- 主场景 `WorldScene` 维护 `STAGE.GAME / COUNTDOWN / OVER` 三态（`assets/scripts/logic/WorldScene.js:44-72` 的 `stage` setter 切换 mainView/overView/countdownView 显隐）。
- 失败路径：棋盘放不下 → `stage=COUNTDOWN`（倒计时）→ `onSkipCountdownEvent()` 进 `OVER`（`WorldScene.js:107-127` / `211-215`）。

## 2. 棋盘几何（核心，必须还原）

- 蜂窝六边形盘：61 格，行数为 5/6/7/8/9/8/7/6/5（`assets/scripts/common/Models.js` 的 `bgPosList`，9 行）。
- 格子索引 0..60 由 `GameControl.onLoad()` 按「一列列生成」的 `fPosList` 顺序赋值（`assets/scripts/logic/GameControl.js:22-66`）。
- 六边形参数：`Constants.LIUBIANXING_A = 75/2`、`LIUBIANXING_H = 69/2`（`assets/scripts/common/Constants.js:2-3`）；格子间距用 `LIUBIANXING_H*2` 与 `pForAngle(240°)`（`GameControl.js:26-27`）。

## 3. 消除判定（P0 还原重点）

- 消除线 `disList` 共 **27 条**：3 个方向 × 9 条（`assets/scripts/common/Models.js` 的 `disList`）。
- `GameControl.checkEliminate(nodeNum)`：取已占格 `havaList` 与每条线的交集，交集长度==线长即整行消除（`GameControl.js:124-188`）。
- 计分：消除 `count*50`；未消除则 `nodeNum*10`（放块奖励）（`GameControl.js:173-185`）。
- 消除动画：逐格 `fadeOut` + 延时 0.05s 串行（`GameControl.js:156-172`）。
- 连续消除（combo）天然存在：一次落位可同时满足多条线（`checkEliminate` 遍历全部 `disList`）。

## 4. 块组生成与放置

- `BlockGroup.buildModel()`：随机取一个 `modelList` 形状（1–4 格，共 33 种，`Models.js` 的 `modelList`），随机一色填充所有格子（`BlockGroup.js:40-70`）。
- 拖拽：`TOUCH_MOVE` 更新位置 → `checkCollisionBoard()` 命中棋盘格记录 `selecdPosList` → 高亮（`BlockGroup.js:84-112`）。
- 落位 `dropBlock()`：`checkIsCanDrop()` 校验「每格都有命中且棋盘空」→ `gameControl.dropBlockToBoard()` 逐个入盘 → `checkEliminate()` → `buildModel()` 换下一组（`BlockGroup.js:120-158`）。
- 判负 `WorldScene.checkIsLose()`：任一空位能容下任意一个操作块组即未输；否则 `stage=COUNTDOWN`（`WorldScene.js:107-127`）。

## 5. 道具/货币（原作有，本作可原创替换）

- 金币 `money` 初始 99：换一批（`REQ_CHANGE_MONEY=2`）、提示（`REQ_TIPS_MONEY=2`）（`WorldScene.js:10-14, 161-205`）。
- 提示 `onTipsEvent()`：遍历空位找第一个能放的位置并闪烁（`WorldScene.js:184-205`）。
- 存档：`66eliminate.topScore` / `66eliminate.money` 走 `cc.sys.localStorage`（`WorldScene.js:99-107, 147-152`）。

## 6. 渲染/素材（全部原创替换，不复用）

- 原作用图集 `new_images/`（block/board/logo/bg 等 PNG）与 `fnt.labelatlas` 位图字体。
- 本作改用全程序化 Canvas：六边形格 + 蜂巢块组 + 三个场景包（春巢/蜜库/冬巢），不引任何外部素材。

## 7. 本作改造映射

| 原作 | brick-six 原创 |
| --- | --- |
| 六边形 61 格盘 | 同几何（轴向坐标 side=5 程序化生成） |
| 33 种 1–4 格形状 | 自建 2–4 格「蜂巢块组」形状池 |
| 27 条消除线 | 同 3 方向 9 线（程序化生成） |
| 换一批/提示（金币） | 改为 12 档推进 + 特性轮换 |
| 单色块组 | 块组单色 + 花粉块/封蜡格机制 |
| 计分 50/格 + 10/格 | 保留，新增 combo 倍率 + 金瀑奖励 |

## 8. 结论

P0 还原点：随机 2–4 格形状落盘堆叠、整线消除、放不下判负、连消 combo。原作几何（61 格六边形 + 27 线）是标准数学结构，本作用轴向坐标自行生成等价棋盘，不复制原数组字面量；玩法规则保留，视觉/音频/文案全原创。
