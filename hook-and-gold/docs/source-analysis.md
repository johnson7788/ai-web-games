# 源码分析：黄金矿工 creator2.4.12

源码目录 `local/src1/黄金矿工creator2.4.12/assets/scripts/`（Cocos Creator 2.4）。

## 入口与状态机

- `GameController.js:36` `start()` 初始化世界边界 `_minX=50/_maxX=1050/_minY=50/_maxY=400`、`_playerMoney=0`。
- `GameController.js:55` `setGameState(gameState)` 状态机：START / PAUSE / MAIN_MENU / START_LEVEL / END_LEVEL。
- `GameController.js:89` `onHookEnd(price)` 钩回后 `_playerMoney += price` 并刷新 UI。

## 钩臂（核心玩法）—— `HookController.js`

- `HookController.js:13` 钩子三态 `NOT_HOOKING / HOOK_START(伸出) / HOOK_BACK(回收)`。
- `HookController.js:53` `_rotateRange = 75`（度）、`_hookSpeed = 400`（px/s）。
- `HookController.js:213` 钟摆：`node.angle = 75 * Math.cos(_rotateTime * 0.9 + Math.PI/2)`，`_rotateTime += dt`。角度在 ±75° 间余弦摆动。
- `HookController.js:79` `onActionHook()` 点击时若在 START 态则 `_hookState = HOOK_START`（直线伸出）。
- `HookController.js:156` `moveHookHead(deltaY)`：回收速度 `speedRatio = hookWeight !== 0 ? 100/hookWeight : 1`；`hookHead.y += deltaY * speedRatio`。**重量越大回收越慢**（100/weight）。
- `HookController.js:225` `onHookCollide()`：伸出态命中物件 → 切 HOOK_BACK 并入 `_hookObjects`。
- `HookController.js:126` `hookEnd()`：累加被钩物件 `Price`，删除物件，`emit(priceSum)`。
- `HookController.js:170` `isOutRange()`：钩头世界坐标出界（x<0 / x>宽 / y<0）→ 转回收。

## 物件 —— `MiningObjectController.js` + `config/MiningObjectConfig.js`

- `MiningObjectConfig.js:5` MASS：BIG_GOLD 300 / MED_GOLD 200 / SMALL_GOLD 100 / SMALL_STONE 300 / MED_STONE 500 / DIAMOND 100 / MONEY_PACK 100。
- `MiningObjectConfig.js:35` PRICE：BIG_GOLD 200 / MED_GOLD 100 / SMALL_GOLD 50 / MED_STONE 20 / SMALL_STONE 10 / DIAMOND 500 / MONEY_PACK 300。
- 物件有 `Mass`/`Price` 两属性，命中判定用 BoxCollider + 碰撞回调。

## 关卡与计时

- `config/LevelConfig.js:6` GOAL = [100, 200, 300]，`PopUpStartLevel.js:49` 越界取 1000。
- `TimerController.js:53` 每关倒计时 `GameConfig.LEVEL_COUNTDOWN = 10`（demo 值，10s）。
- 倒计时结束 `GameController.js:106` `onCountDownEnd()` → END_LEVEL。

## 道具/UI

- `buttons/DynamiteButton.js:36` 炸药按钮 → `g_gameController._hookController.cancelHook()`（清空当前钩住物件 + 爆炸动画，用于中途放弃重物）。
- `UIController.js:58` `addPrice` / `flyMoney`：金币飞字动画。

## 事实要点（用于 1:1 还原）

1. 钩臂余弦钟摆摆动，点击直线伸出，命中后回收，回收速度 = 基速 × (100/总重)。
2. 物件的 Mass/Price 分离：重物贵且慢、轻物快、废石重而贱。
3. 按目标金额过关 + 限时。
4. 炸药道具可中途放弃当前拖拽物。
