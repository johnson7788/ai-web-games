# SNAKE ARENA · 源码分析（改造自《贪吃蛇大作战》）

> 源码根：`/Users/admin/remake-src/贪吃蛇大作战/tcs/assets/src/`（Cocos Creator 2.x 项目，slither.io 玩法）
> 原则：玩法规则 1:1 还原，角色/场景/音乐全原创。以下事实均带 `文件:行号`。

## 1. 入口与主循环

- `Game.js:47-55` `onLoad()` 预实例化对象池：11 个头、300 个身体节、300 个食物、10 个名字标签；`cc.director.setAnimationInterval(60)` 固定 60Hz。
- `UIGame.js:254-287` `update()` 是游戏主循环：逐蛇 `update(e)` → 相机跟随玩家头（`this.Camera.node.position = this._SnakeList[0]._SnakeHead.position`，`UIGame.js:259`）→ 加速/减速速度缓动 → 倒计时 → 每 1.2s 刷新排行榜。
- `UIGame.js:105-134` `onEnable()` 开局：10 条蛇（玩家 index 0 + 9 AI），80 个食物，计时 120s；`UIGame.js:133` `setGameState(f)`（f=2=进行中）。

## 2. 蛇的移动与身体跟随

- `Snake.js:12-16` 字段：`_MoveVec`（当前方向）、`_LastMoveVec`、`_MoveSpeed`、`_BodySpace=30`（身体节间距）。
- `Snake.js:223-232` `update()`：头沿 `_MoveVec * _MoveSpeed` 移动，每前进 1px 向 `_MovePath` 头部插一个轨迹点，身体第 n 节取 `_MovePath[(n+1)*_BodySpace]`；轨迹过长则 pop。这就是「身体沿头部轨迹跟随」的核心。
- `Snake.js:101-102` `setMoveDir(e,t,i,n)` 玩家转向：直接把方向向量设为摇杆输入并旋转头部。
- `Snake.js:94-100` `setMoveSpeed()` 变速并同步给所有身体节。
- `Snake.js:197-200` `update1()` 是「移动+缓动」变体；`updateShow()`（`Snake.js:234-250`）按 `_ShowMovePosList` 走点。

## 3. 吃食与生长

- `Food.js:18-20` `getAddWeight()` 每个食物 +2 重量。
- `Snake.js:109-132` `addWeight()`：累计 `_GrowingWeight`，每满 20 重量加 1 个身体节（`t = _GrowingWeight/20` 向下取整），新节接在尾部并补 `_MovePath`。
- `Snake.js:56-57` `getSnakeLength()` 分数公式：`5*e + (e-5)*(e-5)*5`，e = 身体节数——**比分=长度**。
- `UIGame.js:147-151` `addFood()` 食物随机撒在 `(±(MapWidth/2-200), ±(MapHeight/2-200))`；`UIGame.js:153-155` `checkAddFood()` 食物 <150 就补。

## 4. 加速（消耗长度）

- `UIGame.js:262` 加速键按住：`r += 250*dt` 封顶 500；松开 `r -= 400*dt` 回落到 300（`UIGame.js:197-202` `onSpeedBtnDown/Up` 只设 `_IsSpeedDown`）。
- 原作加速**不直接掉长度**（只是变速）；spec 要求「加速消耗长度」作为原创改造点之一，本作以「超频掉节 + 掉光屑」实现。

## 5. 碰撞与死亡

- `SnakeHead.js:27-63` `onCollisionEnter()`：tag=0 时——撞 `body` 组（他蛇身体）→ 玩家死（`meKill`）或 AI 被杀（`otherKill`，detail 带 killed/beKilled）；撞 `food` 组 → `addWeight` + `onSnakeHitFood`。
- `Snake.js:66-68` `deadFood()` 死亡后身体节逐个变成食物（**尸体化为食物**）。
- `Snake.js:187-191` `update1()` 玩家出界 → 派发 `meBound` → `UIGame.js:223-225` `onMeBound` → `setGameState(h)`（h=3=死亡）。
- `UIGame.js:203-214` `onSelfBeKilled`（玩家死）→ 记分 → 打开 GameOver；`onOtherBeKilled`（AI 死）→ 击杀者 kill+1 → 尸体变食物 → `deadReset()` → `onOtherRelive`（`UIGame.js:216-222`）随机点重生 + 3s 无敌（`setState(1)`）。
- `Snake.js:64-66` `setState(1)` 开启 3s 无敌（`_StateTimer=3`）。

## 6. AI

- `Snake.js:134-168` `aiUpdate()` + `169-180` `changeAI()`：多种 AI 型（0 直线随机转、1/2 定速旋转、6 垂直变向、7 朝目标点、10 朝指定方向），每 0.5~5s 随机切换；出界时 `changeAI(10, 朝中心)`。
- 本作 AI 简化为三态（吃近食/游荡/猎手朝玩家头），攻击性随场次递增。

## 7. 关卡 / 名次 / 皮肤

- `UIGame.js:262-270` 计时模式：`_CurTime` 从 120 倒数，归零 → `setGameState(d)`（d=4=游戏结束）→ 打开 `UIType_GameEnd` 排名结算。
- `UIGame.js:271-284` 排行榜：每 1.2s 取前 10 按 `getSnakeLength()` 降序，玩家绿色高亮。
- `DataManager.js` 管皮肤（`_CurMySKinIndex`）等持久化；本作不做皮肤商店（反范围）。

## 8. 输入

- `GameJoystick.js:56-88` 触摸摇杆：TOUCH_START 把摇杆移到触点、TOUCH_MOVE 按半径 clamp、TOUCH_END 回中；`UIGame.js:194-196` `joyCallback` → `Snake.setMoveDir`。
- 本作输入契约：`steerAngle`（键盘向量 / 指针指向 / 触屏拖动）+ `boost` + `pulse` 三键，桌面 `WASD/方向` + `Space` + `E`。

## 9. 还原映射（P0 对照）

| 原作规则 | 本作实现 | 位置 |
| --- | --- | --- |
| 摇杆转向 | steerAngle → steerToward | `src/game/sim.js` `steerToward` |
| 地图食物点吃食变长 | weight ≥4 加一节 | `src/game/sim.js` `eatFood`/`addSegment` |
| 加速消耗长度 | 超频每 0.6s 掉 1 节 + 掉光屑 | `src/game/sim.js` `dropShard` |
| 头撞他蛇身体判死 | headHitsBody | `src/game/sim.js` `headHitsBody` |
| 死后尸体化为食物 | killSnake 里 segments→foods | `src/game/sim.js` `killSnake` |
| AI 蛇群 | 4~6 条 AI 三态 | `src/game/sim.js` `decideAI` |
| 比分=长度 | length = segments.length | `config/gameplay.js` `lengthOf` |
| 限时名次赛 | 90s × 12 场 | `config/rounds.js` |
