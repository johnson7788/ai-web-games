# GEM CASCADE · 源码分析

> 参考源码：`/Users/admin/remake-src/PopStar-一起消灭星星-210/`（Cocos Creator 工程，主逻辑 `assets/Script/GamePopStar.js`）。
> 原则：玩法规则 1:1 还原，角色/场景/音乐全原创。以下是事实带 `文件:行号` 的证据链。

## 入口与主循环

- `assets/Script/GamePopStar.js` 是唯一玩法逻辑类，继承 `cc.Node`。
- `ctor`（`GamePopStar.js:21-25`）设置节点尺寸并调用 `init()`。
- `init()`（`GamePopStar.js:27-35`）按 `GameConfig.CAED_LINES` 建二维 `cardArr`。
- `initUI()`（`GamePopStar.js:36-71`）注册 `TOUCH_START` 监听 `onTouchBegan`，并 `createCardSprite()` 铺棋盘。

## 棋盘与颜色

- 原工程 `GameConfig.CAED_LINES = 4`（`assets/Script/GameConfig.js:37`）——本构建是 4×4；`CARD_WIDTH` 运行时计算。
- 随机颜色：`randomCreateCardNumber()`（`GamePopStar.js:317-322`）用 `Math.random()*5` 取 5 色。
- spec 的 P0 已按经典 PopStar 归一为 **10×10 棋盘、5 色**（`docs/remake-all/games/spec-gem-cascade.md` P0），本作照此实现。

## 点选与连通判定（核心规则还原点）

- `onTouchBegan()`（`GamePopStar.js:72-94`）：触摸命中某格后 `inspectionSelect(i,j)`。
- `inspectionSelect(i,j)`（`GamePopStar.js:228-255`）：**递归四方向（上下左右）扩散**，只并入同色、可见、未选中的格子，累计 `selectAmount`，记录 `selectNumber`。→ 本作 `src/game/sim.js` 的 `componentAt()`（四方向 BFS）与 `allComponents()`。

## 消除得分（P0：n²×5）

- `cardVanish()`（`GamePopStar.js:194-225`）：`selectAmount >= 2` 才消除；`this.score = this.score + this.selectAmount * this.selectAmount * 5`（`GamePopStar.js:213`）。
  → 本作 `popScore(n, color, doubleColor)` = `n*n*5`（`config/gameplay.js`），双倍矿脉色再 ×2。

## 下落与空列左移（P0）

- `doDown()`（`GamePopStar.js:256-277`）：逐列把上方可见块下移填补空位（重力）。
- `doLeft()`（`GamePopStar.js:278-301`）：某列为空时，把右侧整列左移。
  → 本作 `applyGravity()` + `collapseColumns()`（`src/game/sim.js`）。

## 关卡结算（P0：目标分 / 剩块惩罚 / 无剩奖励）

- `doCheck(dt)`（`GamePopStar.js:342-391`）：棋盘无同色相邻（`isPassGame=true`）时结算：
  - 剩余块 <5 时加分 `(5-deTime)*(5-deTime)*5`（`GamePopStar.js:380-383`）。
  - 再与目标分比较：`if (this.score < GameData.getGamePassScore())` → 失败 `gameOver`，否则 `gamePass`（`GamePopStar.js:384-389`）。
- 目标分公式：`getGamePassScore()` = `1000 + (passNum-1)*1500 + (passNum-1)^2*500`（`assets/Script/GameData.js:225-228`）。
  → 本作目标分 `targetScore(level)` = `1400 + (lv-1)*700 + (lv-1)^2*120`（`config/gameplay.js`），结尾奖励 `clearBonus(remaining)`：0 剩 = 2000 满额，越多越少（经典 PopStar 全套）。

## 道具（改造点：矿镐 / 淘洗为原创，非源码复刻）

- 源码道具为 `GamePopStarProperty()`（`GamePopStar.js:96-174`）：销毁单块 / 交换 / 横排 / 竖排。本作**不移植这些**。
- 原创改造（spec）：**矿镐蓄力**（每消一次蓄力，满 5 可劈碎任意单块）+ **淘洗**（每关 1 次重排，代价连消清零）。见 `src/game/sim.js` 的 `doPick()` / `doWash()`。

## 结论

- 1:1 还原的规则：四方向同色连通、`score = n²×5`、重力下落、空列左移、目标分结算、剩块奖励/惩罚。
- 全原创的部分：矿脉宝石主题、矿镐蓄力、淘洗、三场景包、程序化美术与音频。
