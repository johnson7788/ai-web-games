# BALL ORBIT · 源码分析（改造自 BB弹 / 弹球射击 Cocos）

> 源码路径：`/Users/admin/remake-src/BB弹/`（主）与 `/Users/admin/remake-src/弹球射击-cocos/`（同源副本）。
> 结论：两者是同一款 Cocos Creator 的 ballz 类弹球射击，核心逻辑集中在 `assets/src/*.js`。
> 本文只记录「玩法规则事实」，不复制任何素材/IP。落地实现见 `src/game/sim.js` 与 `config/waves.js`。

## 1. 入口与主循环

- `MainController.js:onLoad` 打开物理/碰撞管理器，设重力 `cc.v2(0, -1500)`，调 `init()` / `initHpFull()` / `addBarriersAtBottom()`。
- 输入：`MainController.js:AddListener` 挂 `TOUCH_START`（`onTouchBeStart`→隐藏引导）与 `TOUCH_END`（`onTouchIsEnd`）。
- 发射判定：`MainController.js:onTouchIsEnd` 只有在 `isRecycleBallsFinished()`（本轮球全部回收）时才 `shootAllBallsOut(touchPos - cc.v2(0,420))`——即「一串球逐发延迟射出，方向 = 触点到发射点」。

## 2. 发射 / 瞄准

- `MainController.js:shootAllBallsOut`：`scheduleOnce(shootOneBallOut, 0.1 * index)`，每颗球间隔 0.1s 依次射出。
- `MainController.js:shootOneBallOut`：球先 spline 到发射点 `(0,420)`，再 `linearVelocity = dir * 3`；若 `dir.mag() < 300` 则力度放大到 `*5`（短拉 = 大力补足）。
- `TakeAim.js:onTouchMove`：画虚线瞄准轨迹（每 40px 一点），并旋转箭头 `Math.atan2`——虚线 + 箭头就是瞄准反馈。

## 3. 球与回收

- `Ball.js:update`：`isTouchedGround` 为真时，球跑 `cardinalSplineTo` 回收到顶部一侧（x>0 → 右侧/上，x<0 → 左侧/上），完成时 `recycleOneShootOutBall()`。
- `Ball.js:onBeginContact`：撞到 `ground` 节点 → `isTouchedGround = true` + 播放 `undo` + 震屏（`QuakeScreen(false)`）。
- `MainController.js:recycleOneShootOutBall`：`recycleBallsCount++`；当 `recycleBallsCount === balls.length`（本轮回收完成）→ 砖阵整体 `moveBy(0.5, cc.v2(0, 100))` 下移（+100），并 `addBarriersAtBottom()` 补底行。

## 4. 砖（障碍）与判定

- `BarrierType.js`：5 类——`IsBomb(1) / IsAddBall(2) / IsAddScore(3) / IsHell(4) / IsCuty(5)`。
- `Barrier.js:start`：随机染色，`setScore(this.main.setBarrierScore())`。
- `Barrier.js:onBeginContact`：
  - `IsAddBall` → 播 `addone`，`addBallInGameIng(pos)`（+1 球），移除。
  - `IsBomb` → 播 `newstage`，爆炸 `addBombExploreAtPos`，移除。
  - `IsCuty` → 爆炸 + `addBallInGameIngFromCuty`（8 方向各射 1 球），移除。
  - `IsAddScore` → 播 `block`，`addScore()`；`score==1` 移除，否则 `SubScore()` + `shake`。
  - `IsHell` → 播 `hammer`，`addNumScore(10)`，`hellSubBall(ball)`（吞掉一颗球），`score==1` 移除否则 `SubScore()`。
- 数值砖：每次球撞 `-1`，归零消除（`IsAddScore` 分支 `1==score → removeOneBarrier`）。

## 5. 关卡 / 砖阵推进

- `MainController.js:addBarriersAtBottom`：从 `x = -270 + randomSpace` 到 `x < 270`，按概率生成普通砖或 3 种 buff 砖（概率由 `gameStep` 决定：第 0 步 `0.5/0.15/0.2`，第 1 步 `0.7/0.4/0.7`），砖宽由 `getRandomSpace() = 80 + 200*rand` 决定。
- `MainController.js:setBarrierScore`：`floor(rand(1 + 2*barrierScoreRate, 5 + 3*barrierScoreRate))`，`barrierScoreRate` 每回收一颗球 +0.2——分数随回收次数上涨。
- 失败：`recycleOneShootOutBall` 回调里 `o.node.position.y > 380` 时扣血（`SubPlayerHp`），`Hp` 归零 → `gameOver()`；`IsAddBall` 砖触底不扣血。
- 生命：`Hp = 3`（`initHpFull`），触底扣 1，`IsAddBall` 除外。

## 6. 升级 / 道具 / 结算

- `MainController.js:upGradeBoom / adsUpGradeBoom`：`boomScale`（爆弹爆破范围）1 → 1.2 → 1.4 → 1.5，走激励视频。
- `MainController.js:gameOver`：`boomScale` 重置 1，播 `lose`，展示分数；星级 = `score>3000→3 / >1800→2 / >800→1`；破纪录时粒子 + `SaveData` + 云存档。
- `LvConfig.js`：空壳（关卡配置未实作，说明原版「关」结构很弱）——这正是本次「原创改造」补 12 波推进结构的切入点。

## 7. 本次改造映射（spec 要求）

| 原版 | BALL ORBIT 落地 |
| --- | --- |
| 数字砖（IsAddScore，撞 -1 归零） | 陨石（硬度 = 数值，撞 -1 归零消除） |
| 附加球（IsAddBall +1） | 拾取道具「流星 +1」 |
| 炸弹/可爱（爆炸） | 改为「引力涟漪」（清整行 → 邻行吸歪，signature） |
| 触底扣血/Hp | 陨石触底判负（单条命，12 波推进） |
| 无关卡结构（LvConfig 空） | 12 波：行数/值分布轮换 + 特性 |
| （无引力） | **引力偏折**：场中行星弯曲弹道（绕背打高值陨石） |
| （无蓄力） | **彗星蓄力**：每清 50 硬度蓄一颗彗星（撞击力 ×3） |
| 单套视觉 | 三场景包：内环尘带（暖灰）/ 气态巨星（青绿）/ 深空（蓝紫） |
