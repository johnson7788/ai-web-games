# STAR SWAP · 源码分析（creator星星消消乐）

> 源码路径：`/Users/admin/remake-src/creator星星消消乐/assets/src/`（Cocos Creator 2.x，`project.json` 标注 `engine: cocos-creator-js`）。
> 本文件只记录**事实 + 文件:行号**，用于指导改造；所有素材/IP 名一律原创替换。

## 0. 一句话结论（重要）

源码实际是**点击连通消除（tap-to-pop）**，不是交换三消：点击一颗星 → 四方向泛洪找同色连通块 → 块 ≥2 就整块消除 → 上方下落补齐 → 整列空则左移。
而 `spec-star-swap.md` 明确把本作重定义为 **swap-match3（相邻交换成 ≥3 连）**，并与 gem-cascade（tap-chain-pop）区分。因此本作**按 spec 实现交换三消**，只复用源码里可迁移的通用机制：星阵、下落补齐、目标分过关、无解重排、特殊星「行/列/同色」的命名。

## 1. 入口 / 主循环

- `Game.js:30` `onLoad()` → `MatrixCtrl.init()`、`LocalStorage.init()`，按屏幕宽高比做 Widget 适配（`ratio>2.06` 等分支）。
- `Game.js:39` `start()` → `ifContinue ? play() : 重置道具并 play()`。
- `Game.js:82` `play()` → 读 `LocalStorage.get("level")` → `G.getTargetScore(level)`（`G.js:8` 目标分曲线）→ 首次进入走 `firstGame()`，否则 `goInAnimation()`。
- 判定循环由 `MatrixCtrl` 内部 `cc.sequence/cc.repeat/cc.callFunc` 驱动（`MatrixCtrl.js:64-75`），非逐帧 update。

## 2. 核心判定（源码实际玩法）

- `MatrixCtrl.js:293` `gameModel(t)`：`pos2Grid` 命中格 → `Utils.removeStarsList(...)` 找连通块 → `c.length >= 2` 才 `deleteSprites(c)`。**没有交换逻辑**。
- `Utils.js:39` `removeStarsList(sprite, matrix, n)`：从点击格开始，四方向 BFS 泛洪同色连通块，边访问边高亮。
- `Utils.js:66` `gameOver(matrix)`：全盘无任何相邻同色即无解（返回 true）。
- `MatrixCtrl.js:224` 三件道具：`blastOne`（锤子单点消除）、`changeColor`（刷子改色）、`retryColor`（重置重排，`MatrixCtrl.js:242`）。

## 3. 下落 / 补齐

- `MatrixCtrl.js:97` `updateMatrix()`：等所有爆炸动画走完 → `Utils.needCheckCols` 收集涉及列（`Utils.js:58`）。
- `MatrixCtrl.js:108` `tampRows(t)`：列内星星下落到 `s` 指针，`cc.moveTo(0.13, grid2Pos)` 补间。
- `MatrixCtrl.js:125` `tampCols(t)`：整列空则左移相邻列，`cc.moveBy(0.17, -(cellSize+2), 0)`。

## 4. 计分 / 过关 / 奖励

- `MatrixCtrl.js:159` `countScore(t) = t*t*5`（t = 块大小）。
- `MatrixCtrl.js:78` `bombStar`：每颗星加 `5*n`（n=块大小），等价 `5 * 块²`；`progressBar.progress = curr/target`。
- `MatrixCtrl.js:212` `over()`：`currScore >= targetScore` → `Game.next()`（过关），否则 `Game.over()`（失败）。
- `gameData.js:15` `getRewardScore(remaining) = 2000 - remaining² * 20`（最低 0），过关时加成剩余星奖励。
- `G.js:8` `getTargetScore(level)`：1–3 关 `1000 + 2000*(l-1)`，4–5 关 `5000 + 2500*(l-3)`，6–10 关 `10000 + 3000*(l-5)` …逐段递增。

## 5. 棋盘 / 颜色 / 坐标

- `psconfig.js`：`cellSize:74, matrixRow:10, matrixCol:10, totalColors:[0,1,2,3,4]`（10×10、5 色）。
- `Utils.js:8` `grid2Pos(row,col)` = `(cellSize/2 + (cellSize+2)*col, cellSize/2 + (cellSize+2)*row)`（y 为行，注意与屏幕 y 方向一致）。
- `Utils.js:13` `pos2Grid` 取 `Math.round`。
- `Utils.js:26` `indexValue(row,col) = row*matrixCol + col`。

## 6. 星 / 粒子

- `Star.js:14` `initStar(type,gx,gy)`：设星类型 + 网格坐标；`Star.js:24` `changeStarType` 换贴图；`Star.js:27` `updateGrid` 只更新 `_gx/_gy`。
- `StarParticle.js:9` `play({position,type})`：按类型换粒子贴图后 `resetSystem()`。
- 星星用 SpriteFrame 数组按 `_starType` 取帧（`Star.js:10-15`），无形状区分（同形异色）。

## 7. 新手引导（源码）

- `Game.js:98` `first()` → 依次 `step1()`（点同色星）→ `step2()`（用锤子）→ …→ `step7()`（重置）共 7 步，`GuideLayer` 高亮 + 文案驱动（`Game.js:102-211`）。
- 本作原创引导改为 3 步：交换 / 三连消除 / 锻造特殊星（见 `src/ui/tutorial.js`）。

## 8. 改造映射（源码 → star-swap）

| 源码机制 | 文件:行号 | star-swap 处理 |
| --- | --- | --- |
| 点击泛洪消除 | `Utils.js:39` | **弃用**，改为相邻交换成 ≥3 连（spec P0） |
| 星阵 / 网格坐标 | `psconfig.js` `Utils.js:8` | 保留思路，改为 8×8（spec） |
| 上方下落补齐 | `MatrixCtrl.js:108` | 保留，改为列内分段重力 + 底部补给 |
| 整列左移 | `MatrixCtrl.js:125` | 弃用（交换三消不需要列移位） |
| 目标分过关 | `MatrixCtrl.js:212` `G.js:8` | 保留，改为每关独立目标分 + 有限步数 |
| 无解重排 | `MatrixCtrl.js:242` | 保留，改为「无有效交换时自动重排」 |
| 奖励分 | `gameData.js:15` | 弃用，改为过关星级评级（rating 钩子） |
| 道具（锤/刷/重置） | `MatrixCtrl.js:224-265` | 原创为「引力透镜」隔空换位（spec 区别点） |
| 特殊星命名（行/列/同色） | spec | 原创实现：四连→行/列爆，五连→超新星同色湮灭 |
