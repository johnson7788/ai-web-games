# ALIEN SIEGE — 源码分析（3d枪战 creator3d → 伪 3D 光线投射改造）

> 源码目录：`/Users/admin/remake-src/3d枪战-creator3d/`
> 本文件按「入口 → 主循环 → 输入 → 判定 → 关卡 → UI」记录事实，标注 `文件:行号`。

## 1. 入口与资源装配

- 启动组件 `assets/Scripts/Game/GameLanch.ts` 与 `Game.ts` 为入口。`Game.gameStart()` 先弹加载层 `ResLoading`，再用 `ResMgr.preloadResPackage(resPkg, ...)` 预载地图 `map/Level1`、环境 `Env/Env`、敌人 `charctors/enemy`、音效（BGM0 / M60_fire / Pistol_magin / Smash）与 `ui_prefabs/MainUI`（`Game.ts:84-92`）。
- 资源清单在 `Game.ts:11-35`：3D 场景、3D 角色、UI 图集、音效、UI prefab 五类。
- 加载完成后 `onResLoaded()` 移除加载层并进入 `EnterGame()`（`Game.ts:94-99`）。

## 2. 主循环 / 状态机

- 单例 `Game.Instance`，`onLoad()` 注册 `PlayerDead`、`GenEnemyEnd` 事件并挂载 `EnmeyMgr`（`Game.ts:55-67`）。
- `EnterGame()` 实例化地图、环境，从 `Env/Shooter` 取射击节点挂 `ShootCtrl`，绑定 `GameCamera` 与 `EnemyCamera`（双摄像机：玩家视角 / 敌人视角），再显示 MainUI 并进入 `EnterStart()`（`Game.ts:102-133`）。
- `EnterStart()`：隐藏 shooter、显示 ShowPlayer 播放开场动画、清空敌人根节点、播 BGM0、派发 `UIEvent_EnterStart`（`Game.ts:135-150`）。
- `EnterGameMode()`：切到敌人视角，`gameStarted=true`，播放拉枪音效，`EnmeyMgr.loadLevelData(1, roadEditor)` 加载关卡，`shootCtrl.initPlayer({hp:100, killVlaue:10})` 初始化玩家，3 秒后 `genEnmeies()` 出兵，并每 3 秒 `checkGame()` 判定胜负（`Game.ts:152-200`）。
- 失败：`onPlayerDead()` 取消所有定时器（`Game.ts:73-77`）；胜利：`onPlayerWin()` 仅打日志（`Game.ts:80-82`）。胜负判定：`checkGame()` 当 `isEnemyGenEnd && monestRoot.children.length <= 0` 判胜（`Game.ts:193-200`）。

## 3. 输入

- 触屏：`ShootCtrl.onLoad()` 监听 `TOUCH_START/TOUCH_END`，`onTouchStart` 置 `isShooting=true` 且 `nowTime=shootTime`（0.3s），`onTouchEnd` 停止（`ShootCtrl.ts:31-64`）。即「按住连发、0.3s 一发」。
- 准星：`MainUI_Ctrl.onTouchMove()` 用 `e.getDelta()` 移动 UI 光标，再 `worldToScreen` 后派发 `UICursorMove`（`MainUI_Ctrl.ts:31-50`）。
- 瞄准：`ShootCtrl.onUICursorMove()` 用 `camera.screenPointToRay` + `PhysicsSystem.raycastClosest` 求出命中点，让枪口 `lookAt(point)` 并把 3D 光标移到命中点（`ShootCtrl.ts:70-84`）。

## 4. 射击与命中判定

- `ShootCtrl.shootUpdate(dt)`：`nowTime += dt`，≥0.3s 就 `doShoot()`（`ShootCtrl.ts:113-120`）。
- `doShoot()`：播 `M60_fire`，再次 `screenPointToRay` + `raycastClosest`；若命中物体名为 `"enemy"`，取 `EnemyCtrl` 调 `onAttacked(killVlaue)`；枪口 `lookAt(hitPoint)`（`ShootCtrl.ts:91-111`）。
- 玩家受击：`onAttackPlayer(uname, killVlaue)` 扣 `hp`，clamp 到 0，派发 `UIEvent_BloodChange`；`hp<=0` 派发 `PlayerDead`（`ShootCtrl.ts:39-50`）。

## 5. 关卡 / 出怪

- `EnmeyMgr.loadLevelData(level, roadEditor)`：把 `roadEditor` 的路径点按 9 条车道（`j=-4..4`，x 坐标取车道号）展开成 `roadSet`，每条车道一串路径点（`EnmeyMgr.ts:38-53`）。
- `genEnemiesOneTime()`：每条车道生成 1 只敌人，`speed = 2 + random*3`，`killValue=10`，`initEnemyConfig({hp:10, speed, roadData, killValue})` 后进入 `Run` 状态（`EnmeyMgr.ts:56-71`）。
- `genEnmeies(root)`：一轮生成 9 只（9 车道），共 `genCount=5` 波，波间隔 `3+random*2` 秒；第 5 波后派发 `GenEnemyEnd`（`EnmeyMgr.ts:73-92`）。每波派发 `UIEvent_GenEnmey` 提示「第 N 波已产生」。

## 6. 敌人 AI（寻路 + 状态）

- `EnemyCtrl` 状态机 `EnmeyState`：Idle(0)/Run(1)/Attack(2)/Dead(3)（`EnemyCtrl.ts:6-11`）。
- `onAttacked(killValue)`：状态 > Run 时忽略；扣血至 0 进 Dead（`EnemyCtrl.ts:33-42`）。
- `setState`：Run 走 `MapNavAgent.NavOnRoadWithFirst(roadData, cb)`，走到终点回调进 Attack（`EnemyCtrl.ts:57-63`）；Attack 播攻击动画、派发 `AttackPlayer`（对玩家造成 killValue 伤害）、0.75s 后自毁（`EnemyCtrl.ts:63-70`）；Dead 停寻路、0.79s 后自毁（`EnemyCtrl.ts:71-77`）。
- 寻路 `MapNavAgent`：沿路径点按 `speed` 匀速插值，逐点 `MoveToNext()`，`Quat.slerp` 平滑转身，走完回调（`MapNavAgent.ts:40-121`）。

## 7. UI

- `MainUI_Ctrl.configStartUI()`：显示 Logo + Start，隐藏 info/倒计时/准星（`MainUI_Ctrl.ts:52-61`）。
- `configGameUI()`：显示 info_root、倒计时、准星；倒计时 3-2-1（`showTime`）；显示出怪信息（`MainUI_Ctrl.ts:63-98`）。
- `showEnmeyInfo(genNumber, desc)`：按波次点亮 info_root 里的圆点并写文案（`MainUI_Ctrl.ts:101-118`）。
- 开始按钮 `onStartGame()` → `Game.EnterGameMode()`（`MainUI_Ctrl.ts:140-142`）。

## 8. 改造映射（原作 → alien-siege）

| 原作机制 | alien-siege 实现 |
| --- | --- |
| 双摄像机 FPS 视角 | 伪 3D 光线投射（Canvas 2D DDA 射线 + billboard 敌人） |
| 触屏按住连发（0.3s 一发 M60） | 鼠标/触屏按住射击，4 把武器各自射速 |
| `screenPointToRay` 命中判定 | 角度锥 + 距离 + 视线（`hasLineOfSight`）hitscan |
| 9 车道路径寻路敌人 | 2D 竞技场敌人朝玩家推进（爬行者/浮游者漂移/巨兽/母巢） |
| 5 波 → 杀光判胜 | 12 波（每波清空推进），Boss 母巢收尾 |
| `hp:100 / killValue:10` | 玩家 100 HP / 敌人分型血量与伤害 |
| 准星 3D 光标 | 屏幕十字准星 + 镭射标记高亮 |
| 3-2-1 倒计时 | 波间 1.6s 清场延迟 + waveStart 提示 |
| 音效 M60_fire / Pistol_magin / Smash | 程序化 WebAudio：shoot/reload/hit/kill/splat 等 |
| 换弹（原作无显式换弹） | R 键换弹 + 打空自动换弹（原创扩充） |
