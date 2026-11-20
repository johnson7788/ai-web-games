# 源码分析 — 全民吃鸡大战（Cocos Creator）

源码根：`/Users/admin/remake-src/CocosCreator-lt-全民吃鸡大战-gt/assets/scripts/`

本改造按「玩法规则 1:1 还原、角色/场景/音乐全原创」执行：还原俯视角双摇杆射击 BR 的**规则骨架**（缩圈、捡枪、AI 敌、击杀计数、最后存活），把玩具兵/桌面战场/三场景包/背包取舍/静步作为原创外壳。

## 1. 入口与主循环

- `GameApp.js:35-39`：脚本加载即 `window.GameApp = new GameApp()` 并 `Start()`；`Start()`（`GameApp.js:27-33`）只初始化碰撞管理器，业务循环在各组件 `update()`。
- `ui/GameUI.js:121-145`：`update(dt)` 是战斗 HUD 主循环——射击/换弹计时（`_shootTimer`/`_reloadTimer`）、毒圈（`gasCountDown`）、空投箱（`boxCountDown`）、轰炸（`boomCountDown`）、闪现/回血技能冷却（`duleFlash`/`duleHealth`）、开局保护倒计时（`protectCcountDown`）。
- `ui/GameMap.js:61-68`：`update(dt)` 驱动毒圈缩圈与同屏排序。
- 无固定步长：Cocos 默认 `dt` 可变步长；改造为 60Hz 固定步长 + 累加器。

## 2. 输入（双摇杆 + 射击按钮）

- `game/Joystick.js:60-67`：`_initTouchEvent` 绑定 TOUCH_START/MOVE/END。
- `game/Joystick.js:99-133`：`_touchMoveEvent` 计算归一化方向 `p`，调 `player.setDir(p)` + `player.setSpeedType(FAST)`；`_touchEndEvent`（`Joystick.js:134-141`）置 STOP。
- `game/Player.js:259-281`：`setDir` 存 moveDir 并同步枪口方向（非瞄准时）；`setGunDir` 计算枪节点旋转与翻面。
- `ui/GameUI.js:384-395`：射击按钮 `onTouchBegin` 置 `_shootFlag`，`onTouchLeave` 清旗并 `EVENT_AIM false`；`shoot()` 发 `EVENT_AIM true` + `EVENT_PLAYER_SHOOT`。
- 自动瞄准：`Player.js:354-391` `aimState`/`aimToNearest`——按住射击时枪口锁定最近敌（距离 `< gunData.range * 1.4`）。
- 摇杆为「移动方向」，射击方向由「自动瞄准最近敌」提供（原作没有独立右摇杆瞄准，是自动索敌）。

## 3. 判定 / 战斗

- `game/Bullet.js:46-58`：子弹沿 `_flyDir * _flySpeed * dt` 飞行，累计 `_curRange`，超过 `gunData.range` 停止（火箭筒 1005/1105 停后变 120×120 爆炸判定框）。
- `game/Bullet.js:85-95`：`onBeginContact` 撞到 `collider/player/enemy` 即停；撞到 `this._belongTag`（同阵营）不判定。
- `game/Player.js:579-655`：`beDamage`——减伤公式 `_isDef = ceil(power*curDef) + ceil(power*equipDef)`，暴击 `power*=2`；死亡时掉枪到地面（`GroundItem`）、从 `allRoleArr` 移除、计算名次 `theRank = allRoleArr.length`、弹结算 `OverPopup`。
- `game/Enemy.js:657-741`：敌方 `beDamage` 同构；击杀者 `_belongIndex==1`（玩家）时记任务击杀。
- `manager/DataManager.js:358-400`：`reduceHp`（≤0 判死）、`reduceAmo`（弹药 <0 返回 false 触发换弹）、`reloadAmo`、`addKillNum`（`_index==1` 玩家 → 0，否则 `-=9` 映射到 `inGameKillNum` 数组）。
- `game/Player.js:337-353`：`checkGas`——毒圈外每 0.5s `beDamage(5, -1)`（-1 = 毒出局）。
- 爆炸（轰炸区/火箭筒）：`beDamage(999, -2)`（`Player.js:547`、`Enemy.js:641`）。

## 4. 缩圈（毒圈）

- `ui/GameUI.js:44-51`：初始参数——`safeCircle=150`（地图 204 单位），`_gasCountDownTimer=40`（首圈倒计时）、`_gasCountDownInterval=20`（后续间隔）、`_boxCountDownTimer=20/_boxCountDownInterval=50`、`_boomCountDownTimer=30/_boomCountDownInterval=50`。
- 状态机 `GameUI.js:194-202`：`_gasState` 0=安静（等待）→1=画圈倒计时→2=缩圈。
- `quietGasState`（`GameUI.js:204-228`）：倒计时 <16s 时在安全区内随机定下一个安全区（`pointOfRandom`），发 `gasAlert`。
- `refreshCircleAndCD`（`GameUI.js:230-245`）：倒计时归零 → `_gasState=2`，发 `EVENT_UPDATE_GAS_SHOW`。
- `reduceCircleAndTip`（`GameUI.js:246-285`）：外圈 `gasNode.width -= dt*10`，圆心沿内圈方向平移；外圈缩到 `safeCircle` 后重置 `_gasCountDownTimer=20`、`safeCircle -= 50`（每轮半径 -50），`safeCircle<0` 为最终圈。
- `ui/GameMap.js:86-141`：`gasCountDown` 把 UI 的 204 单位映射到地图 10240 单位（`safeCircle = 10240*(safeCircle/204)`），实做外圈缩放 + 圆心平移，更新 `globalData.gasConfig`（含 `safePosition`/`gasCircle`，供角色 `checkGas` 用）。

## 5. 武器

`assets/resources/data/weapon.json`（`WeaponData`，6 把）：

| weaponid | 名称 | clipnum | speed | range | shootdelay | reloaddelay | power |
|---|---|---|---|---|---|---|---|
| 1002 | 霰弹枪 | 8 | 850 | 350 | 1.5 | 1.5 | 15 |
| 1003 | 机关枪 | 30 | 1400 | 340 | 0.2 | 1.5 | 5 |
| 1005 | 火箭筒 | 5 | 1600 | 320 | 2.0 | 1.5 | 25 |
| 1102 | 手枪 | 15 | 850 | 450 | 1.0 | 1.5 | 8 |
| 1103 | AK47 | 35 | 1400 | 340 | 0.3 | 1.5 | 5 |
| 1105 | Kar98K | 15 | 1600 | 320 | 1.5 | 1.5 | 20 |

- `Player.js:413-479` / `Enemy.js:490-553`：`shoot()`——1002 霰弹枪 3 发扇形（±30°）；伤害 `power = ceil(gunData.power * (curDamage + equipDamage))`，暴击（`curCrit+equipCrit`）翻倍；`reduceAmo()` 失败或弹药归零触发 `reload()`。
- `Player.js:487-507` / `Enemy.js:585-602`：`equipWeapon(_kind)` 设置 `gunData/shootInterval/reloadInterval/clipnum` 并 `reloadAmo()`。

## 6. 物资 / 空投箱

- `game/GroundItem.js:20-32`：`init`——`_type==weapon` 显示武器图标，`_type==item` 显示装备文字。
- `data/Consts.js:49-106`：`ItemAttr` 4 类（伤害/减伤/移速/暴击）×3 级（+10%/+20%/+30%，暴击 +10/+20/+30 点）。
- `ui/GameUI.js:302-317`：`dropBox()` 每轮投 `[10,6,3,2]` 个空投箱到安全区。
- `game/DropBox.js:27-49`：箱子开启需 5s（`_openTimer>=5`），玩家在箱内 → `EVENT_SHOW_BOXITEM`（给玩家选装备），否则给敌对 `enemyEquipBoxItem()`。
- `ui/GameUI.js:332-366`：`showBoxItemUI()` 从 4 类随机 3~4 项给玩家选；`boxItemUIBtnClick` → `equipBoxItem`。
- 装备加成 `DataManager.js:412-431`：`equipBoxItem` 提升该属性等级并写 `equipItemAttr`；敌人 `Enemy.js:188-207` `enemyEquipBoxItem` 同构（随机选未满级属性）。

## 7. 敌人 AI（15 名，原作实际生成 30）

- `ui/GameMap.js:381-425`：`showEnemy()` 生成 30 个敌人（`tempPosArr` 30 个随机点；spec 定为 15 名），跳过 `i+1 == choosedSkinId` 的位置，`tagNum` 从 `Tags.enemy=10` 起自增，写入 `inGameKillNum`。
- `game/Enemy.js:258-312`：`doParser` 决策——毒圈外 → 朝安全区跑（`setDir(dir.normalize())`）；无枪 → `searchGun()`（找圈内最近枪）；有枪在游戏中 → `searchBox()`（找空投箱）；否则随机巡逻（`_desTime = random(1,3)` 变向）。
- `game/Enemy.js:457-488`：`aimToNearest`——有敌在 `range*1.4` 内即瞄准（无枪时 `range=400` 用于逃跑判定）；`Enemy.js:293-302` 无枪遇敌时 `setDir(this._aimDir.rotate(180))` 逃跑，有枪则 `setDir(this._aimDir)` 追踪。
- `game/Enemy.js:408-450`：`update`——瞄准时 `_shootTimer` 到点 `shoot()`；`_reloadFlag` 计时换弹。
- 碰撞绕障：`Enemy.js:635-640` 撞 `Tags.collider` 时 `_isBlock=true`，`moveDir` 随机转 90–180°，0.5s 后解除。

## 8. 玩家基础数值 / 技能

- `manager/DataManager.js:22-57`：`userData` 基础属性 `baseHp=100, baseDamage=1, baseCrit=0, baseSpeed=200, baseDef=0, baseRecovery=1`；皮肤加成 `addSkinAttr`（`DataManager.js:345-354`）改写 `maxHp/curDamage/curCrit/curSpeed/curCd/curDef/curRecovery`。
- 闪现：`ui/GameUI.js:146-158` `duleFlash` + `Player.js:211-231` `move(_flash)`——朝 moveDir 瞬移 1000 单位并夹到边界，CD `getSkillCD() = 10*(1-curCd)`。
- 回血：`ui/GameUI.js:159-171` `duleHealth` + `Player.js:157-171` `resumeHealth`——每次 +`getResumeHealthNum()=10*curRecovery`，重复 4 次。
- 开局保护：`Player.js:137-148` `roleProtect`（无枪时无敌 + 箭头指向最近枪），`GameUI.js:172-184` `protectCcountDown` 8s 倒计时后发 `EVENT_THEGAMESTART` 解除。

## 9. 胜负

- `ui/GameUI.js:410-421`：`updateAllRoleNumUIShow`——`allRoleArr.length==1` 且存活者是玩家（tag==player）→ 弹 `OverPopup` 胜利。
- `Player.js:645-655`：死亡后 `theRank = allRoleArr.length`，`OverPopup.init(false, theRank+1)`（失败结算显示名次）。
- 击杀数排行 `ui/GameUI.js:428-440`：`updateRankShow` 对 `inGameKillNum` 降序取前 5。

## 10. 落地 / 地图规模

- `ui/GameMap.js:53-59`：`init` → `showCloud`（跳伞云层）、`showParatrooperPlayer`、0.1s 间隔生成 29 个跳伞敌人。
- `ui/GameMap.js:310-328`：`gameBegin`——落地后 `showGun`（地面撒枪）、`showPlayer`、`showEnemy`。
- 地图单位：TiledMap 204 单位，`GameMap` 节点 10240 单位（`GameMap.js:77` `safeCircle = 10240*(event.safeCircle/204)`）。

## 关键还原决策

- 玩法骨架 1:1：双摇杆移动 + 自动索敌射击、缩圈掉血、捡枪（6 把同数值）、药/甲/背包取舍、15 名 AI、击杀计数、最后存活。
- 原创外壳：玩具兵 + 桌面战场（文具/书堆掩体）、三场景包（书桌暖木/玩具城彩/夜库靛蓝）、决赛圈台灯聚光签名、2 格背包取舍、静步（不射击移速 +30% 且不暴露——枪声引 AI）。
