# cell-wars 源码分析（改造自「动物同化」）

> 源码：`/Users/admin/remake-src/动物同化/`（Cocos2d-html5 v2.1.2，`project.json`）。本文件是「玩法规则 1:1 还原」的事实底账，所有结论带 `文件:行号`。

## 1. 源码事实

### 入口与主逻辑
- 唯一业务脚本 `assets/Script/gameLayer.js`（Cocos `cc.Component`），格子脚本 `assets/Script/aniItem.js`。
- 场景 `assets/Scene/start.fire`（主界面）与 `Scene_end.fire`（结算），预制体 `assets/Prefab/aniItem.prefab`。

### 棋盘与棋子
- `ANI_ROW = 14`（14 行/列）、`ANI_TYPE = 14`（动物种类池）、`MAX_COUNT = 36`（最大次数，`gameLayer.js:3-5`）。
- `createAnis()`：先从 14 种里随机不重复抽 6 种（`gameLayer.js:222-240`），再建 14×14 格子，每格随机取 6 种之一（`gameLayer.js:242-263`）。
- 底部 6 个按钮对应这 6 种（`gameLayer.js:265-270`）。

### 核心判定：点击换色 → 邻接扩散（「同化」）
- `aniBtnCallBack()`：点一个颜色按钮，把**所有已同化的格子**改成该颜色，再扩散（`gameLayer.js:543-581`）。
- `computeAnis()`：遍历所有「未同化且类型 == 新颜色」的格子，若其**上下左右**（非斜角、非自身，`gameLayer.js:295-298`）有**已同化**邻居，则它被同化（`gameLayer.js:273-316`）。外层 `num < ANI_ROW-1` 循环保证整块连通域逐层吞并（`gameLayer.js:275`）。
- 首格：`nextGame()` 把 `_allAnimals[0]`（左上角）设为已同化，作为种子（`gameLayer.js:509-514`）。

### 步数 / 得分 / 胜负
- 步数：`_restTimes = MAX_COUNT - _curLevel`（`gameLayer.js:495-497`），每有效换色 `-1`（`gameLayer.js:566-568`）。
- 得分：`computeScore()` 按本步新增同化数 `num = _curNum - _lastNum` 分段乘倍（≤2 单倍、≤5 双倍、≤10 三倍、>10 四倍，`gameLayer.js:384-408`）。
- 胜利：全部 196 格同化 → `gameWinLayer()`，奖励 `_restTimes * 100` 分（`gameLayer.js:411-420, 422-439`）。
- 失败：步数用尽 → `gameFailLayer()`（`gameLayer.js:416-418, 441-445`）。
- 红边 `showRedLine()` 标出已同化区域的前沿（`gameLayer.js:318-382`）。

## 2. 改造映射（原创 cell-wars）

| 原作 | cell-wars 改造 |
| --- | --- |
| 单机解谜：从左上角扩散染满全盘 | **vs AI 领土战**：蓝菌(玩家) vs 红菌(AI)，交替回合 |
| 换色 = 整块连通域变型 | 点击相邻敌格感染：按**邻接己方数量**决定感染力，成功则占领 + 光丝蔓延 |
| 无防御概念 | 格子有**防御等级**（def 1–4），感染力 > 防御才占领 |
| 6 色按钮 | 3 动作：感染 / 营养滴 / 噬菌体 |
| 36 步内染满 | 12 皿推进，每皿消灭敌方或回合数结算领土 |
| 单一背景 | 三场景包：经典皿(青白)/抗性皿(金紫)/变异皿(红黑) |

## 3. 原创机制（spec 指定）
- **营养滴**：每回合 1 次，在任意格滴营养，该格及 4 邻格己方下回合感染力 +2（布局资源）。
- **噬菌体**：3 回合充能一次，清空 2×2 敌格（清场大招）。
- **光丝蔓延**（签名记忆点）：占领成功时按剩余感染力预算 BFS 连锁吞并，渲染放线光丝动画。
- **推进**：12 皿，AI 强度递进 + 特性轮换（地图形状/初始布局/中立堡垒/病毒风暴）。
